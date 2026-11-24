import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { addActivity, addPerson, createProject } from '@shared/projectOps';
import type { Project } from '@shared/types';
import ProjectTable from './ProjectTable';

afterEach(cleanup);

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

describe('ProjectTable', () => {
  test('renders the activity matrix and person totals without a footer total row', async () => {
    const user = userEvent.setup();
    const project = makeProject();
    const onEditActivity = vi.fn();

    render(
      <ProjectTable
        project={project}
        onEditActivity={onEditActivity}
        onAddPerson={vi.fn()}
        onAddActivity={vi.fn()}
      />,
    );

    expect(screen.getByRole('table', { name: '项目分摊表' })).toBeInTheDocument();
    for (const header of screen.getAllByRole('columnheader')) {
      expect(header).toHaveAttribute('scope', 'col');
    }
    for (const header of screen.getAllByRole('rowheader')) {
      expect(header).toHaveAttribute('scope', 'row');
    }
    expect(screen.getByRole('columnheader', { name: /住宿/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /晚餐/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /门票/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '应付合计' })).toBeInTheDocument();

    const hotelButton = screen.getByRole('button', { name: /编辑活动：住宿/ });
    expect(within(hotelButton).getByText('¥600.00')).toBeInTheDocument();

    const mingRow = screen.getByRole('row', { name: /小明/ });
    expect(within(mingRow).getByText('¥200.00')).toBeInTheDocument();
    expect(within(mingRow).getByText('¥380.00')).toBeInTheDocument();

    const hongRow = screen.getByRole('row', { name: /小红/ });
    expect(within(hongRow).getByText('—')).toBeInTheDocument();
    expect(within(hongRow).getByText('¥280.00')).toBeInTheDocument();

    const gangRow = screen.getByRole('row', { name: /小刚/ });
    expect(within(gangRow).getByText('¥300.00')).toBeInTheDocument();

    expect(screen.queryByRole('row', { name: /活动合计/ })).not.toBeInTheDocument();

    await user.click(hotelButton);
    expect(onEditActivity).toHaveBeenCalledWith(
      project.activities.find((activity) => activity.name === '住宿')?.id,
    );
  });

  test('shows an empty state when there are no people', () => {
    render(
      <ProjectTable
        project={createProject('空项目')}
        onEditActivity={vi.fn()}
        onAddPerson={vi.fn()}
        onAddActivity={vi.fn()}
      />,
    );

    expect(screen.getByText('先添加人员')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加人员' })).toBeInTheDocument();
  });

  test('shows a hint and zero totals when people have no activities', () => {
    const project = addPerson(createProject('云南行'), '小明');
    render(
      <ProjectTable
        project={project}
        onEditActivity={vi.fn()}
        onAddPerson={vi.fn()}
        onAddActivity={vi.fn()}
      />,
    );

    expect(screen.getByText('还没有活动')).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /小明/ });
    expect(within(row).getByText('¥0.00')).toBeInTheDocument();
  });
});
