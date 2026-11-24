import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { addActivity, addPerson, createProject } from '@shared/projectOps';
import type { Project } from '@shared/types';
import { createMockApi } from '../../../test/mockApi';
import ProjectScreen from './ProjectScreen';

function makeProject(): Project {
  let project = createProject('云南行');
  project = addPerson(project, '小明');
  project = addPerson(project, '小红');
  project = addPerson(project, '小刚');
  const [ming, hong, gang] = project.people.map((person) => person.id);
  project = addActivity(project, {
    name: '住宿',
    mode: 'equal',
    totalCents: 60000,
    participantIds: [ming, hong, gang],
  });
  project = addActivity(project, {
    name: '晚餐',
    mode: 'custom',
    shares: [
      { personId: ming, amountCents: 8000 },
      { personId: hong, amountCents: 8000 },
    ],
  });
  project = addActivity(project, {
    name: '门票',
    mode: 'equal',
    totalCents: 20000,
    participantIds: [ming, gang],
  });
  return project;
}

let project: Project;

beforeEach(() => {
  project = makeProject();
  window.aqian = createMockApi({
    loadProject: vi.fn(async () => ({ project, recoveredFromBackup: false })),
    saveProject: vi.fn(async (next) => ({
      ...next,
      updatedAt: '2026-11-24T05:00:00.000Z',
    })),
  });
});

afterEach(cleanup);

describe('ProjectScreen', () => {
  test('loads the project, summary, actions, save state, and table', async () => {
    const onBack = vi.fn();
    render(<ProjectScreen projectId={project.id} onBack={onBack} />);

    expect(await screen.findByRole('button', { name: '编辑项目名称' })).toHaveTextContent('云南行');
    const summary = screen.getByText((_, element) =>
      element?.classList.contains('project-summary') ?? false,
    );
    expect(summary).toHaveTextContent('3 人 · 3 个活动 · 总支出');
    expect(screen.getByText('¥960.00', { selector: '.project-summary-total' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加人员' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加活动' })).toBeInTheDocument();
    expect(await screen.findByText(/已保存/)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: '项目分摊表' })).toBeInTheDocument();

    const iconOnlyButtons = screen
      .getAllByRole('button')
      .filter((button) => !button.textContent?.trim());
    expect(iconOnlyButtons.length).toBeGreaterThan(0);
    for (const button of iconOnlyButtons) {
      expect(button).toHaveAccessibleName();
    }

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');

    await userEvent.click(screen.getByRole('button', { name: '返回历史' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('edits the project title with Enter and closes only after save succeeds', async () => {
    const user = userEvent.setup();
    const saveProject = vi.fn(async (next: Project) => ({
      ...next,
      updatedAt: '2026-11-24T06:00:00.000Z',
    }));
    window.aqian = createMockApi({
      loadProject: vi.fn(async () => ({ project, recoveredFromBackup: false })),
      saveProject,
    });

    render(<ProjectScreen projectId={project.id} onBack={vi.fn()} />);
    await screen.findByRole('button', { name: '编辑项目名称' });

    await user.click(screen.getByRole('button', { name: '编辑项目名称' }));
    const input = screen.getByLabelText('项目名称');
    await user.clear(input);
    await user.type(input, ' 云南新行 ');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(saveProject).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '编辑项目名称' })).toHaveTextContent('云南新行'),
    );
    expect(screen.queryByLabelText('项目名称')).not.toBeInTheDocument();
  });

  test('cancels title editing with Escape', async () => {
    const user = userEvent.setup();
    const saveProject = vi.fn(async (next: Project) => next);
    window.aqian = createMockApi({
      loadProject: vi.fn(async () => ({ project, recoveredFromBackup: false })),
      saveProject,
    });

    render(<ProjectScreen projectId={project.id} onBack={vi.fn()} />);
    const title = await screen.findByRole('button', { name: '编辑项目名称' });
    await user.click(title);

    const input = screen.getByLabelText('项目名称');
    await user.clear(input);
    await user.type(input, '不要保存');
    await user.keyboard('{Escape}');

    expect(screen.queryByLabelText('项目名称')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑项目名称' })).toHaveTextContent('云南行');
    expect(saveProject).not.toHaveBeenCalled();
  });

  test('keeps the title editor open and shows a save error for duplicate names', async () => {
    const user = userEvent.setup();
    const saveProject = vi.fn(async () => {
      throw new Error('项目名称已存在');
    });
    window.aqian = createMockApi({
      loadProject: vi.fn(async () => ({ project, recoveredFromBackup: false })),
      saveProject,
    });

    render(<ProjectScreen projectId={project.id} onBack={vi.fn()} />);
    await screen.findByRole('button', { name: '编辑项目名称' });

    await user.click(screen.getByRole('button', { name: '编辑项目名称' }));
    const input = screen.getByLabelText('项目名称');
    await user.clear(input);
    await user.type(input, '已有项目');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('项目名称已存在');
    expect(screen.getByLabelText('项目名称')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });

  test('opens the people drawer and updates the table after adding', async () => {
    const user = userEvent.setup();
    const saveProject = vi.fn(async (next: Project) => ({
      ...next,
      updatedAt: '2026-11-24T07:00:00.000Z',
    }));
    window.aqian = createMockApi({
      loadProject: vi.fn(async () => ({ project, recoveredFromBackup: false })),
      saveProject,
    });

    render(<ProjectScreen projectId={project.id} onBack={vi.fn()} />);
    await screen.findByRole('button', { name: '编辑项目名称' });

    await user.click(screen.getByRole('button', { name: '添加人员' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('人员姓名'), '小美');
    await user.click(within(dialog).getByRole('button', { name: '添加人员' }));
    await user.click(within(dialog).getByRole('button', { name: '关闭' }));

    expect(await screen.findByRole('row', { name: /小美/ })).toBeInTheDocument();
    await waitFor(() => expect(saveProject).toHaveBeenCalled());
  });

  test('adds an activity through the dialog', async () => {
    const user = userEvent.setup();
    const saveProject = vi.fn(async (next: Project) => ({
      ...next,
      updatedAt: '2026-11-24T08:00:00.000Z',
    }));
    window.aqian = createMockApi({
      loadProject: vi.fn(async () => ({ project, recoveredFromBackup: false })),
      saveProject,
    });

    render(<ProjectScreen projectId={project.id} onBack={vi.fn()} />);
    await screen.findByRole('button', { name: '编辑项目名称' });

    await user.click(screen.getByRole('button', { name: '添加活动' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('活动名称'), '车费');
    await user.type(within(dialog).getByLabelText('活动总额'), '300');
    await user.click(within(dialog).getByRole('button', { name: '保存活动' }));

    expect(
      await screen.findByRole('button', { name: /编辑活动：车费/ }),
    ).toBeInTheDocument();
    await waitFor(() => expect(saveProject).toHaveBeenCalled());
  });

  test('deletes an activity through the confirmation dialog', async () => {
    const user = userEvent.setup();
    const saveProject = vi.fn(async (next: Project) => ({
      ...next,
      updatedAt: '2026-11-24T09:00:00.000Z',
    }));
    window.aqian = createMockApi({
      loadProject: vi.fn(async () => ({ project, recoveredFromBackup: false })),
      saveProject,
    });

    render(<ProjectScreen projectId={project.id} onBack={vi.fn()} />);
    await screen.findByRole('button', { name: '编辑项目名称' });

    await user.click(screen.getByRole('button', { name: /编辑活动：住宿/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('活动名称')).toHaveValue('住宿');
    await user.click(within(dialog).getByRole('button', { name: '删除活动' }));

    expect(await screen.findByRole('heading', { name: '删除活动？' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '删除活动' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /编辑活动：住宿/ })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(saveProject).toHaveBeenCalled());
  });

  test('restores the saved title with Escape after a failed rename', async () => {
    const user = userEvent.setup();
    const saveProject = vi.fn(async () => {
      throw new Error('项目名称已存在');
    });
    window.aqian = createMockApi({
      loadProject: vi.fn(async () => ({ project, recoveredFromBackup: false })),
      saveProject,
    });

    render(<ProjectScreen projectId={project.id} onBack={vi.fn()} />);
    await screen.findByRole('button', { name: '编辑项目名称' });

    await user.click(screen.getByRole('button', { name: '编辑项目名称' }));
    const input = screen.getByLabelText('项目名称');
    await user.clear(input);
    await user.type(input, '已有项目');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('项目名称已存在');

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '编辑项目名称' })).toHaveTextContent('云南行'),
    );
    expect(screen.queryByLabelText('项目名称')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '恢复上次保存' })).not.toBeInTheDocument();
  });

  test('blocks back navigation while a save failed and allows restore', async () => {
    const user = userEvent.setup();
    const saveProject = vi.fn(async (next: Project) => {
      if (next.name === '已有项目') throw new Error('项目名称已存在');
      return { ...next, updatedAt: '2026-11-24T10:00:00.000Z' };
    });
    const onBack = vi.fn();
    window.aqian = createMockApi({
      loadProject: vi.fn(async () => ({ project, recoveredFromBackup: false })),
      saveProject,
    });

    render(<ProjectScreen projectId={project.id} onBack={onBack} />);
    await screen.findByRole('button', { name: '编辑项目名称' });

    await user.click(screen.getByRole('button', { name: '编辑项目名称' }));
    const input = screen.getByLabelText('项目名称');
    await user.clear(input);
    await user.type(input, '已有项目');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('项目名称已存在');

    await user.click(screen.getByRole('button', { name: '返回历史' }));
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText(/暂时无法返回历史/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '恢复上次保存' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '编辑项目名称' })).toHaveTextContent('云南行'),
    );

    await user.click(screen.getByRole('button', { name: '返回历史' }));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });

  test('shows the recovery banner and load error actions', async () => {
    window.aqian = createMockApi({
      loadProject: vi.fn(async () => ({ project, recoveredFromBackup: true })),
    });
    const { unmount } = render(<ProjectScreen projectId={project.id} onBack={vi.fn()} />);
    expect(await screen.findByText(/已从上一版备份恢复/)).toBeInTheDocument();
    unmount();

    window.aqian = createMockApi({
      loadProject: vi.fn(async () => {
        throw new Error('项目不存在');
      }),
    });
    render(<ProjectScreen projectId={project.id} onBack={vi.fn()} />);
    expect(await screen.findByText('无法打开项目')).toBeInTheDocument();
    expect(screen.getByText('项目不存在')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回历史' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开数据文件夹' })).toBeInTheDocument();
  });
});
