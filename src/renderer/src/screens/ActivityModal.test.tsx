import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { addActivity, addPerson, createProject } from '@shared/projectOps';
import type { Activity, Project } from '@shared/types';
import ActivityModal from './ActivityModal';

afterEach(cleanup);

function baseProject(): Project {
  let project = createProject('云南行');
  project = addPerson(project, '小明');
  project = addPerson(project, '小红');
  project = addPerson(project, '小刚');
  return project;
}

function equalActivity(project: Project): Activity {
  const withActivity = addActivity(project, {
    name: '住宿',
    mode: 'equal',
    totalCents: 60000,
    participantIds: project.people.map((person) => person.id),
  });
  return withActivity.activities[0];
}

function customActivity(project: Project): Activity {
  const [ming, hong, gang] = project.people.map((person) => person.id);
  const withActivity = addActivity(project, {
    name: '晚餐',
    mode: 'custom',
    shares: [
      { personId: ming, amountCents: 10000 },
      { personId: hong, amountCents: 20000 },
      { personId: gang, amountCents: 0 },
    ],
  });
  return withActivity.activities[0];
}

function renderModal(
  project: Project,
  activity: Activity | null = null,
  onSubmit = vi.fn(),
  onDelete = vi.fn(),
) {
  render(
    <ActivityModal
      open
      people={project.people}
      activity={activity}
      onClose={vi.fn()}
      onSubmit={onSubmit}
      onDelete={onDelete}
    />,
  );
  return { onSubmit, onDelete };
}

describe('ActivityModal', () => {
  test('defaults to all people selected and equal mode', () => {
    const project = baseProject();
    renderModal(project);

    expect(screen.getByRole('heading', { name: '添加活动' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '均摊' })).toBeChecked();
    for (const person of project.people) {
      expect(screen.getByRole('checkbox', { name: person.name })).toBeChecked();
    }
    expect(screen.getByLabelText('活动名称')).toHaveValue('');
    expect(screen.getByLabelText('活动总额')).toHaveValue('');
    expect(screen.queryByRole('button', { name: '删除活动' })).not.toBeInTheDocument();
  });

  test('submits a new equal activity', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    const { onSubmit } = renderModal(project);

    await user.type(screen.getByLabelText('活动名称'), ' 住宿 ');
    await user.type(screen.getByLabelText('活动总额'), '600');
    await user.click(screen.getByRole('button', { name: '保存活动' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: '住宿',
      mode: 'equal',
      totalCents: 60000,
      participantIds: project.people.map((person) => person.id),
    });
  });

  test('shows an equal preview and updates when a person is unchecked', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    renderModal(project);

    await user.type(screen.getByLabelText('活动总额'), '600');
    expect(screen.getAllByText('¥200.00')).toHaveLength(3);

    await user.click(screen.getByRole('checkbox', { name: '小刚' }));
    expect(screen.getAllByText('¥300.00')).toHaveLength(2);
  });

  test('prefills custom amounts from the equal total and back again', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    renderModal(project);

    await user.type(screen.getByLabelText('活动总额'), '600');
    await user.click(screen.getByRole('radio', { name: '独立输入' }));

    expect(screen.getByLabelText('小明 的金额')).toHaveValue('200.00');
    expect(screen.getByLabelText('小红 的金额')).toHaveValue('200.00');
    expect(screen.getByLabelText('小刚 的金额')).toHaveValue('200.00');

    await user.clear(screen.getByLabelText('小明 的金额'));
    await user.type(screen.getByLabelText('小明 的金额'), '100');
    await user.clear(screen.getByLabelText('小红 的金额'));
    await user.type(screen.getByLabelText('小红 的金额'), '200');
    await user.clear(screen.getByLabelText('小刚 的金额'));
    await user.type(screen.getByLabelText('小刚 的金额'), '0');
    await user.click(screen.getByRole('radio', { name: '均摊' }));

    expect(screen.getByLabelText('活动总额')).toHaveValue('300.00');
    expect(screen.getAllByText('¥100.00')).toHaveLength(3);
  });

  test('accepts zero for one custom person and emits exact shares', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    const { onSubmit } = renderModal(project);

    await user.type(screen.getByLabelText('活动名称'), '晚餐');
    await user.click(screen.getByRole('radio', { name: '独立输入' }));
    await user.type(screen.getByLabelText('小明 的金额'), '100');
    await user.type(screen.getByLabelText('小红 的金额'), '0');
    await user.type(screen.getByLabelText('小刚 的金额'), '0');
    await user.click(screen.getByRole('button', { name: '保存活动' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: '晚餐',
      mode: 'custom',
      shares: [
        { personId: project.people[0].id, amountCents: 10000 },
        { personId: project.people[1].id, amountCents: 0 },
        { personId: project.people[2].id, amountCents: 0 },
      ],
    });
  });

  test('rejects an all-zero custom activity', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    const { onSubmit } = renderModal(project);

    await user.type(screen.getByLabelText('活动名称'), '晚餐');
    await user.click(screen.getByRole('radio', { name: '独立输入' }));
    for (const person of project.people) {
      await user.type(screen.getByLabelText(`${person.name} 的金额`), '0');
    }
    await user.click(screen.getByRole('button', { name: '保存活动' }));

    expect(screen.getByText('至少填写一笔大于 0 的金额')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('validates name, participants, equal amount, and custom amounts', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    const { onSubmit } = renderModal(project);

    await user.type(screen.getByLabelText('活动总额'), '600');
    await user.click(screen.getByRole('button', { name: '保存活动' }));
    expect(screen.getByText('活动名称不能为空')).toBeInTheDocument();

    await user.type(screen.getByLabelText('活动名称'), '住宿');
    for (const person of project.people) {
      await user.click(screen.getByRole('checkbox', { name: person.name }));
    }
    await user.click(screen.getByRole('button', { name: '保存活动' }));
    expect(screen.getByText('至少选择一名参与人员')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: '小明' }));
    await user.click(screen.getByRole('checkbox', { name: '小红' }));
    await user.click(screen.getByRole('checkbox', { name: '小刚' }));
    await user.clear(screen.getByLabelText('活动总额'));
    await user.type(screen.getByLabelText('活动总额'), '0');
    await user.click(screen.getByRole('button', { name: '保存活动' }));
    expect(screen.getByText('活动总额必须大于 0')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('活动总额'));
    await user.type(screen.getByLabelText('活动总额'), '12.345');
    await user.click(screen.getByRole('button', { name: '保存活动' }));
    expect(screen.getByText('请输入有效的活动总额')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '独立输入' }));
    await user.click(screen.getByRole('button', { name: '保存活动' }));
    expect(screen.getByText('请填写小明 的金额')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('prefills and updates an existing equal activity', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    const activity = equalActivity(project);
    const { onSubmit } = renderModal(project, activity);

    expect(screen.getByRole('heading', { name: '编辑活动' })).toBeInTheDocument();
    expect(screen.getByLabelText('活动名称')).toHaveValue('住宿');
    expect(screen.getByLabelText('活动总额')).toHaveValue('600.00');
    for (const person of project.people) {
      expect(screen.getByRole('checkbox', { name: person.name })).toBeChecked();
    }

    await user.clear(screen.getByLabelText('活动总额'));
    await user.type(screen.getByLabelText('活动总额'), '900');
    await user.click(screen.getByRole('button', { name: '保存活动' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: '住宿',
      mode: 'equal',
      totalCents: 90000,
      participantIds: project.people.map((person) => person.id),
    });
  });

  test('prefills an existing custom activity and exposes delete', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    const activity = customActivity(project);
    const { onDelete } = renderModal(project, activity);

    expect(screen.getByRole('radio', { name: '独立输入' })).toBeChecked();
    expect(screen.getByLabelText('小明 的金额')).toHaveValue('100.00');
    expect(screen.getByLabelText('小红 的金额')).toHaveValue('200.00');
    expect(screen.getByLabelText('小刚 的金额')).toHaveValue('0.00');

    await user.click(screen.getByRole('button', { name: '删除活动' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test('uses the calculator for the equal total and updates the split preview', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    renderModal(project);

    await user.click(screen.getByRole('button', { name: '打开计算器：活动总额' }));
    const panel = screen.getByRole('dialog', { name: '计算器：活动总额' });
    for (const key of ['清空', '6', '0', '0', '加', '5', '0', '等于']) {
      await user.click(within(panel).getByRole('button', { name: key }));
    }

    expect(screen.getByLabelText('活动总额')).toHaveValue('650.00');
    expect(screen.getAllByText('¥216.67')).toHaveLength(2);
    expect(screen.getByText('¥216.66')).toBeInTheDocument();
  });

  test('uses the calculator for a custom person amount and updates the custom total', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    renderModal(project);

    await user.click(screen.getByRole('radio', { name: '独立输入' }));
    await user.click(screen.getByRole('button', { name: '打开计算器：小明 的金额' }));
    const panel = screen.getByRole('dialog', { name: '计算器：小明 的金额' });
    for (const key of ['1', '0', '0', '加', '2', '0', '等于']) {
      await user.click(within(panel).getByRole('button', { name: key }));
    }

    expect(screen.getByLabelText('小明 的金额')).toHaveValue('120.00');
    expect(screen.getByText('活动合计').parentElement).toHaveTextContent('¥120.00');
  });

  test('clears an existing form error when a calculator result is applied', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    renderModal(project);

    await user.click(screen.getByRole('button', { name: '保存活动' }));
    expect(screen.getByText('活动名称不能为空')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开计算器：活动总额' }));
    const panel = screen.getByRole('dialog', { name: '计算器：活动总额' });
    for (const key of ['清空', '1', '0', '0', '等于']) {
      await user.click(within(panel).getByRole('button', { name: key }));
    }

    expect(screen.queryByText('活动名称不能为空')).not.toBeInTheDocument();
    expect(screen.getByLabelText('活动总额')).toHaveValue('100.00');
  });

  test('Escape closes only the calculator panel, not the activity dialog', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    renderModal(project);

    await user.click(screen.getByRole('button', { name: '打开计算器：活动总额' }));
    expect(screen.getByRole('dialog', { name: '计算器：活动总额' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '计算器：活动总额' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '添加活动' })).toBeInTheDocument();
  });

  test('keeps only one calculator panel open at a time', async () => {
    const user = userEvent.setup();
    const project = baseProject();
    renderModal(project);

    await user.click(screen.getByRole('radio', { name: '独立输入' }));
    await user.click(screen.getByRole('button', { name: '打开计算器：小明 的金额' }));
    expect(screen.getByRole('dialog', { name: '计算器：小明 的金额' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开计算器：小红 的金额' }));
    expect(screen.queryByRole('dialog', { name: '计算器：小明 的金额' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '计算器：小红 的金额' })).toBeInTheDocument();
  });
});
