import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMockApi, makeSummary } from '../../../test/mockApi';
import HistoryScreen from './HistoryScreen';

const valid = makeSummary();
const unreadable = makeSummary({
  id: '22222222-2222-4222-8222-222222222222',
  name: '坏文件',
  updatedAt: '2026-11-23T10:00:00.000Z',
  peopleCount: 0,
  activityCount: 0,
  totalCents: 0,
  status: 'unreadable',
  error: '项目文件无法读取',
});

beforeEach(() => {
  window.aqian = createMockApi();
});

afterEach(cleanup);

describe('HistoryScreen', () => {
  test('loads and renders project summaries', async () => {
    const listProjects = vi.fn(async () => [valid, unreadable]);
    window.aqian = createMockApi({ listProjects });
    const onOpenProject = vi.fn();

    render(<HistoryScreen onBack={vi.fn()} onOpenProject={onOpenProject} />);

    expect(await screen.findByText('云南行')).toBeInTheDocument();
    expect(screen.getByText('¥1,040.00')).toBeInTheDocument();
    expect(screen.getByText('3 人 · 3 个活动')).toBeInTheDocument();
    expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);
    expect(screen.getByText('无法读取')).toBeInTheDocument();
    expect(screen.getByText('点击尝试从备份恢复')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '打开项目：坏文件' }));
    expect(onOpenProject).toHaveBeenLastCalledWith(unreadable.id);

    await userEvent.click(screen.getByRole('button', { name: '打开项目：云南行' }));
    expect(onOpenProject).toHaveBeenLastCalledWith(valid.id);
  });

  test('confirms and deletes a project, then reloads', async () => {
    const user = userEvent.setup();
    const listProjects = vi
      .fn()
      .mockResolvedValueOnce([valid])
      .mockResolvedValueOnce([]);
    const deleteProject = vi.fn(async () => undefined);
    window.aqian = createMockApi({ listProjects, deleteProject });

    render(<HistoryScreen onBack={vi.fn()} onOpenProject={vi.fn()} />);
    await screen.findByText('云南行');

    await user.click(screen.getByRole('button', { name: '删除项目：云南行' }));
    expect(screen.getByRole('heading', { name: '删除项目？' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '移入回收站' }));

    await waitFor(() => expect(deleteProject).toHaveBeenCalledWith(valid.id));
    expect(await screen.findByText('还没有历史项目')).toBeInTheDocument();
    expect(listProjects).toHaveBeenCalledTimes(2);
  });

  test('shows an empty state and goes back to create', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<HistoryScreen onBack={onBack} onOpenProject={vi.fn()} />);

    expect(await screen.findByText('还没有历史项目')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '新建项目' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('opens the data folder', async () => {
    const user = userEvent.setup();
    const openDataFolder = vi.fn(async () => undefined);
    const listProjects = vi.fn(async () => [valid]);
    window.aqian = createMockApi({ openDataFolder, listProjects });

    render(<HistoryScreen onBack={vi.fn()} onOpenProject={vi.fn()} />);
    await screen.findByText('云南行');

    await user.click(screen.getByRole('button', { name: '打开数据文件夹' }));
    expect(openDataFolder).toHaveBeenCalledTimes(1);
  });
});
