import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import HomeScreen from './HomeScreen';

afterEach(cleanup);

describe('HomeScreen', () => {
  test('shows the two starting actions and creates a project', async () => {
    const user = userEvent.setup();
    const onCreateProject = vi.fn(async () => undefined);
    const onOpenHistory = vi.fn();

    render(<HomeScreen onCreateProject={onCreateProject} onOpenHistory={onOpenHistory} />);

    expect(screen.getByRole('heading', { name: 'A钱小工具' })).toBeInTheDocument();
    expect(screen.getByText('把每一次出行的花销，算得明明白白。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建消费项目' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '历史消费项目' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '新建消费项目' }));
    await user.type(screen.getByLabelText('项目名称'), '云南行');
    await user.click(screen.getByRole('button', { name: '创建项目' }));

    await waitFor(() => expect(onCreateProject).toHaveBeenCalledWith('云南行'));
  });

  test('shows a create error inside the dialog', async () => {
    const user = userEvent.setup();
    const onCreateProject = vi.fn(async () => {
      throw new Error('项目名称已存在');
    });

    render(<HomeScreen onCreateProject={onCreateProject} onOpenHistory={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '新建消费项目' }));
    await user.type(screen.getByLabelText('项目名称'), '云南行');
    await user.click(screen.getByRole('button', { name: '创建项目' }));

    expect(await screen.findByText('项目名称已存在')).toBeInTheDocument();
  });

  test('opens history', async () => {
    const user = userEvent.setup();
    const onOpenHistory = vi.fn();
    render(<HomeScreen onCreateProject={vi.fn(async () => undefined)} onOpenHistory={onOpenHistory} />);

    await user.click(screen.getByRole('button', { name: '历史消费项目' }));
    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });
});
