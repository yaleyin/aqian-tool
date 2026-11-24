import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { addActivity, addPerson, createProject } from '@shared/projectOps';
import type { Project } from '@shared/types';
import PeopleDrawer from './PeopleDrawer';

afterEach(cleanup);

function baseProject(): Project {
  let project = createProject('云南行');
  project = addPerson(project, '小明');
  project = addPerson(project, '小红');
  project = addPerson(project, '小刚');
  return project;
}

function projectWithActivities(): Project {
  let project = baseProject();
  const [ming, , gang] = project.people.map((person) => person.id);
  project = addActivity(project, {
    name: '住宿',
    mode: 'equal',
    totalCents: 60000,
    participantIds: project.people.map((person) => person.id),
  });
  project = addActivity(project, {
    name: '单人门票',
    mode: 'equal',
    totalCents: 20000,
    participantIds: [gang],
  });
  project = addActivity(project, {
    name: '晚餐',
    mode: 'custom',
    shares: [{ personId: ming, amountCents: 8000 }],
  });
  return project;
}

function applyFirstUpdater(project: Project, mutate: ReturnType<typeof vi.fn>): Project {
  const updater = mutate.mock.calls[0][0] as (current: Project) => Project;
  return updater(project);
}

describe('PeopleDrawer', () => {
  test('lists existing people and adds a person with the plus button', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    const mutate = vi.fn();

    render(<PeopleDrawer open project={project} onClose={vi.fn()} mutate={mutate} />);

    expect(screen.getByRole('button', { name: '编辑人员：小明' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '删除人员：小红' })).toBeInTheDocument();

    const input = screen.getByLabelText('人员姓名');
    await user.type(input, '小美');
    await user.click(screen.getByRole('button', { name: '添加人员' }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const next = applyFirstUpdater(project, mutate);
    expect(next.people.map((person) => person.name)).toContain('小美');
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  test('adds a person with Enter but ignores Enter during IME composition', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    const mutate = vi.fn();

    render(<PeopleDrawer open project={project} onClose={vi.fn()} mutate={mutate} />);
    const input = screen.getByLabelText('人员姓名');

    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(mutate).not.toHaveBeenCalled();

    await user.type(input, '小美');
    await user.keyboard('{Enter}');
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  test('shows a duplicate error without mutating', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    const mutate = vi.fn();

    render(<PeopleDrawer open project={project} onClose={vi.fn()} mutate={mutate} />);
    await user.type(screen.getByLabelText('人员姓名'), '小明');
    await user.click(screen.getByRole('button', { name: '添加人员' }));

    expect(await screen.findByText('人员名称已存在')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  test('renames a person with Enter and cancels with Escape', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    const mutate = vi.fn();

    const { unmount } = render(
      <PeopleDrawer open project={project} onClose={vi.fn()} mutate={mutate} />,
    );
    await user.click(screen.getByRole('button', { name: '编辑人员：小明' }));
    const editInput = screen.getByLabelText('编辑人员姓名：小明');
    await user.clear(editInput);
    await user.type(editInput, '小明明');
    await user.keyboard('{Enter}');

    expect(mutate).toHaveBeenCalledTimes(1);
    const next = applyFirstUpdater(project, mutate);
    expect(next.people.find((person) => person.name === '小明明')).toBeTruthy();
    unmount();

    const secondMutate = vi.fn();
    render(
      <PeopleDrawer open project={project} onClose={vi.fn()} mutate={secondMutate} />,
    );
    await user.click(screen.getByRole('button', { name: '编辑人员：小红' }));
    const cancelInput = screen.getByLabelText('编辑人员姓名：小红');
    await user.clear(cancelInput);
    await user.type(cancelInput, '不要保存');
    await user.keyboard('{Escape}');

    expect(screen.queryByLabelText('编辑人员姓名：小红')).not.toBeInTheDocument();
    expect(secondMutate).not.toHaveBeenCalled();
  });

  test('confirms deletion for a person with no activities', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    const mutate = vi.fn();

    render(<PeopleDrawer open project={project} onClose={vi.fn()} mutate={mutate} />);
    await user.click(screen.getByRole('button', { name: '删除人员：小红' }));

    expect(screen.getByText('删除人员？')).toBeInTheDocument();
    expect(screen.getByText('删除后，TA 将从 0 个活动中移除；其中 0 个活动会因没有有效分摊而删除。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '删除人员' }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const next = applyFirstUpdater(project, mutate);
    expect(next.people.map((person) => person.name)).not.toContain('小红');
  });

  test('explains affected and empty activities, then recomputes', async () => {
    const user = userEvent.setup();
    const project = projectWithActivities();
    const mutate = vi.fn();

    render(<PeopleDrawer open project={project} onClose={vi.fn()} mutate={mutate} />);
    await user.click(screen.getByRole('button', { name: '删除人员：小刚' }));

    expect(screen.getByText('删除人员？')).toBeInTheDocument();
    expect(
      screen.getByText('删除后，TA 将从 2 个活动中移除；其中 1 个活动会因没有有效分摊而删除。'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '删除人员' }));

    const next = applyFirstUpdater(project, mutate);
    expect(next.people.map((person) => person.name)).not.toContain('小刚');
    expect(next.activities.map((activity) => activity.name)).not.toContain('单人门票');
    const hotel = next.activities.find((activity) => activity.name === '住宿');
    expect(hotel?.mode).toBe('equal');
    if (hotel?.mode === 'equal') {
      expect(hotel.totalCents).toBe(40000);
      expect(hotel.participantIds).toHaveLength(2);
    }
  });

  test('counts a custom activity with only zero shares left as deleted', async () => {
    const user = userEvent.setup();
    let project = baseProject();
    const [ming, hong] = project.people.map((person) => person.id);
    project = addActivity(project, {
      name: '零份额晚餐',
      mode: 'custom',
      shares: [
        { personId: ming, amountCents: 8000 },
        { personId: hong, amountCents: 0 },
      ],
    });
    const mutate = vi.fn();

    render(<PeopleDrawer open project={project} onClose={vi.fn()} mutate={mutate} />);
    await user.click(screen.getByRole('button', { name: '删除人员：小明' }));

    expect(
      screen.getByText('删除后，TA 将从 1 个活动中移除；其中 1 个活动会因没有有效分摊而删除。'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '删除人员' }));

    const next = applyFirstUpdater(project, mutate);
    expect(next.activities).toEqual([]);
  });

  test('cancel leaves the project unchanged', async () => {
    const user = userEvent.setup();
    const project = projectWithActivities();
    const mutate = vi.fn();

    render(<PeopleDrawer open project={project} onClose={vi.fn()} mutate={mutate} />);
    await user.click(screen.getByRole('button', { name: '删除人员：小刚' }));
    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByText('删除人员？')).not.toBeInTheDocument();
  });

  test('shows an empty state when there are no people', () => {
    render(
      <PeopleDrawer
        open
        project={createProject('空项目')}
        onClose={vi.fn()}
        mutate={vi.fn()}
      />,
    );
    expect(screen.getByText('还没有人员')).toBeInTheDocument();
  });
});
