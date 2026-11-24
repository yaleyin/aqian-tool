import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createProject, renameProject } from '@shared/projectOps';
import type { Project } from '@shared/types';
import { createMockApi } from '../../../test/mockApi';
import { useProjectEditor } from './useProjectEditor';

const baseProject = createProject('云南行');

beforeEach(() => {
  window.aqian = createMockApi();
});

afterEach(cleanup);

function loadedWith(project: Project) {
  return {
    listProjects: vi.fn(async () => []),
    loadProject: vi.fn(async () => ({ project, recoveredFromBackup: false })),
  };
}

describe('useProjectEditor', () => {
  test('loads the project and marks it saved', async () => {
    const loaded = loadedWith(baseProject);
    window.aqian = createMockApi(loaded);

    const { result } = renderHook(() => useProjectEditor(baseProject.id));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.project?.name).toBe('云南行');
    expect(result.current.savedAt).toBe(baseProject.updatedAt);
    expect(result.current.saveState).toBe('saved');
    expect(loaded.loadProject).toHaveBeenCalledWith(baseProject.id);
  });

  test('updates immediately and saves through the queue', async () => {
    const savedProject = { ...baseProject, name: '新名字', updatedAt: '2026-11-24T02:00:00.000Z' };
    const saveProject = vi.fn(async () => savedProject);
    window.aqian = createMockApi({ ...loadedWith(baseProject), saveProject });

    const { result } = renderHook(() => useProjectEditor(baseProject.id));
    await waitFor(() => expect(result.current.project).not.toBeNull());

    act(() => {
      result.current.mutate((project) => renameProject(project, '新名字'));
    });

    expect(result.current.project?.name).toBe('新名字');
    await waitFor(() => expect(saveProject).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.saveState).toBe('saved'));
    expect(result.current.savedAt).toBe('2026-11-24T02:00:00.000Z');
  });

  test('keeps the latest mutation when two saves overlap', async () => {
    let resolveFirst!: (value: Project) => void;
    const first = new Promise<Project>((resolve) => {
      resolveFirst = resolve;
    });
    const saveProject = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(async (project: Project) => ({
        ...project,
        updatedAt: '2026-11-24T03:00:00.000Z',
      }));
    window.aqian = createMockApi({ ...loadedWith(baseProject), saveProject });

    const { result } = renderHook(() => useProjectEditor(baseProject.id));
    await waitFor(() => expect(result.current.project).not.toBeNull());

    act(() => {
      result.current.mutate((project) => renameProject(project, '第一次'));
      result.current.mutate((project) => renameProject(project, '第二次'));
    });

    await waitFor(() => expect(saveProject).toHaveBeenCalledTimes(1));
    resolveFirst({ ...baseProject, name: '第一次', updatedAt: '2026-11-24T02:00:00.000Z' });
    await waitFor(() => expect(saveProject).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.savedAt).toBe('2026-11-24T03:00:00.000Z'));

    expect(result.current.project?.name).toBe('第二次');
    expect(result.current.saveState).toBe('saved');
  });

  test('surfaces save failures and retries the latest project', async () => {
    const saveProject = vi
      .fn()
      .mockRejectedValueOnce(new Error('磁盘已满'))
      .mockResolvedValueOnce({ ...baseProject, updatedAt: '2026-11-24T04:00:00.000Z' });
    window.aqian = createMockApi({ ...loadedWith(baseProject), saveProject });

    const { result } = renderHook(() => useProjectEditor(baseProject.id));
    await waitFor(() => expect(result.current.project).not.toBeNull());

    act(() => {
      result.current.mutate((project) => renameProject(project, '新名字'));
    });

    await waitFor(() => expect(result.current.saveState).toBe('error'));
    expect(result.current.saveError).toBe('磁盘已满');
    expect(result.current.project?.name).toBe('新名字');

    act(() => result.current.retrySave());
    await waitFor(() => expect(result.current.saveState).toBe('saved'));
    expect(saveProject).toHaveBeenCalledTimes(2);
    expect(result.current.savedAt).toBe('2026-11-24T04:00:00.000Z');
  });

  test('surfaces load failures', async () => {
    window.aqian = createMockApi({
      loadProject: vi.fn(async () => {
        throw new Error('项目文件无法读取');
      }),
    });

    const { result } = renderHook(() => useProjectEditor(baseProject.id));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe('项目文件无法读取');
    expect(result.current.project).toBeNull();
  });

  test('flushSaves waits for the queue and reports the failure', async () => {
    const saveProject = vi.fn().mockRejectedValue(new Error('磁盘已满'));
    window.aqian = createMockApi({ ...loadedWith(baseProject), saveProject });

    const { result } = renderHook(() => useProjectEditor(baseProject.id));
    await waitFor(() => expect(result.current.project).not.toBeNull());

    act(() => {
      result.current.mutate((project) => renameProject(project, '新名字'));
    });

    const outcome = await result.current.flushSaves();
    expect(outcome).toEqual({ ok: false, error: '磁盘已满' });
    await waitFor(() => expect(result.current.saveState).toBe('error'));
  });

  test('rollbackToSaved restores the last saved project', async () => {
    const saveProject = vi.fn().mockRejectedValue(new Error('项目名称已存在'));
    window.aqian = createMockApi({ ...loadedWith(baseProject), saveProject });

    const { result } = renderHook(() => useProjectEditor(baseProject.id));
    await waitFor(() => expect(result.current.project).not.toBeNull());

    act(() => {
      result.current.mutate((project) => renameProject(project, '重复名称'));
    });
    await waitFor(() => expect(result.current.saveState).toBe('error'));

    act(() => result.current.rollbackToSaved());

    expect(result.current.project?.name).toBe('云南行');
    expect(result.current.saveState).toBe('saved');
    expect(result.current.saveError).toBeNull();
    expect(result.current.savedAt).toBe(baseProject.updatedAt);
  });

  test('prevents unload while a save has failed', async () => {
    const saveProject = vi.fn().mockRejectedValue(new Error('磁盘已满'));
    window.aqian = createMockApi({ ...loadedWith(baseProject), saveProject });

    const { result } = renderHook(() => useProjectEditor(baseProject.id));
    await waitFor(() => expect(result.current.project).not.toBeNull());

    act(() => {
      result.current.mutate((project) => renameProject(project, '新名字'));
    });
    await waitFor(() => expect(result.current.saveState).toBe('error'));

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  test('exposes backup recovery', async () => {
    window.aqian = createMockApi({
      loadProject: vi.fn(async () => ({ project: baseProject, recoveredFromBackup: true })),
    });

    const { result } = renderHook(() => useProjectEditor(baseProject.id));
    await waitFor(() => expect(result.current.project).not.toBeNull());
    expect(result.current.recoveredFromBackup).toBe(true);
  });
});
