import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { tauriApi } from './tauriApi';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

beforeEach(() => {
  invokeMock.mockReset();
});

describe('tauriApi', () => {
  test('maps list/create/load/save/delete/open calls to Tauri commands', async () => {
    invokeMock.mockResolvedValue(undefined);

    await tauriApi.listProjects();
    expect(invokeMock).toHaveBeenCalledWith('list_projects', undefined);

    await tauriApi.createProject('云南行');
    expect(invokeMock).toHaveBeenCalledWith('create_project', { name: '云南行' });

    await tauriApi.loadProject('id-1');
    expect(invokeMock).toHaveBeenCalledWith('load_project', { id: 'id-1' });

    const project = { id: 'id-1', name: '云南行' } as never;
    await tauriApi.saveProject(project);
    expect(invokeMock).toHaveBeenCalledWith('save_project', { project });

    await tauriApi.deleteProject('id-1');
    expect(invokeMock).toHaveBeenCalledWith('delete_project', { id: 'id-1' });

    await tauriApi.openDataFolder();
    expect(invokeMock).toHaveBeenCalledWith('open_data_folder', undefined);
  });

  test('normalizes string command errors into Error messages', async () => {
    invokeMock.mockRejectedValue('项目名称已存在');
    await expect(tauriApi.createProject('重复')).rejects.toThrow('项目名称已存在');
  });
});
