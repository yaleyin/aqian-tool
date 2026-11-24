import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import CalculatorPanel from './CalculatorPanel';

afterEach(cleanup);

function renderPanel(initialValue = '') {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <CalculatorPanel
      label="活动总额"
      initialValue={initialValue}
      onApply={onApply}
      onClose={onClose}
    />,
  );
  return { ...view, onApply, onClose };
}

async function clickKeys(user: ReturnType<typeof userEvent.setup>, keys: string[]) {
  for (const key of keys) {
    await user.click(screen.getByRole('button', { name: key }));
  }
}

describe('CalculatorPanel', () => {
  test('opens with the current value and shows a live result', async () => {
    const user = userEvent.setup();
    renderPanel('600.00');

    expect(screen.getByRole('dialog', { name: '计算器：活动总额' })).toBeInTheDocument();
    expect(screen.getByLabelText('计算器表达式')).toHaveTextContent('600.00');

    await clickKeys(user, ['加', '5', '0']);
    expect(screen.getByText('= ¥650.00')).toBeInTheDocument();
  });

  test('applies arithmetic results as two decimal places', async () => {
    const user = userEvent.setup();
    const { onApply } = renderPanel();

    await clickKeys(user, ['清空', '1', '加', '2', '等于']);
    expect(onApply).toHaveBeenCalledWith('3.00');
  });

  test('handles decimals without floating point noise', async () => {
    const user = userEvent.setup();
    const { onApply } = renderPanel();

    await clickKeys(user, ['清空', '0', '小数点', '1', '加', '0', '小数点', '2', '等于']);
    expect(onApply).toHaveBeenCalledWith('0.30');
  });

  test('handles parentheses and division', async () => {
    const user = userEvent.setup();
    const { onApply } = renderPanel();

    await clickKeys(user, [
      '清空',
      '左括号',
      '1',
      '2',
      '0',
      '加',
      '8',
      '0',
      '右括号',
      '除',
      '2',
      '等于',
    ]);
    expect(onApply).toHaveBeenCalledWith('100.00');
  });

  test('rejects division by zero, negative, and over-limit results', async () => {
    const user = userEvent.setup();
    const { onApply } = renderPanel();

    await clickKeys(user, ['清空', '1', '除', '0', '等于']);
    expect(screen.getByRole('alert')).toHaveTextContent('不能除以 0');
    expect(onApply).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '清空' }));
    await clickKeys(user, ['1', '减', '2', '等于']);
    expect(screen.getByRole('alert')).toHaveTextContent('金额不能为负数');

    await user.click(screen.getByRole('button', { name: '清空' }));
    await clickKeys(user, ['9', '9', '9', '9', '9', '9', '9', '小数点', '9', '9', '加', '0', '小数点', '0', '1', '等于']);
    expect(screen.getByRole('alert')).toHaveTextContent('金额过大');
    expect(onApply).not.toHaveBeenCalled();
  });

  test('clears and deletes characters', async () => {
    const user = userEvent.setup();
    renderPanel('120');

    await user.click(screen.getByRole('button', { name: '退格' }));
    expect(screen.getByLabelText('计算器表达式')).toHaveTextContent('12');

    await user.click(screen.getByRole('button', { name: '清空' }));
    expect(screen.getByLabelText('计算器表达式')).toHaveTextContent('0');
  });

  test('supports keyboard input, Enter, and Escape', async () => {
    const user = userEvent.setup();
    const { onApply, onClose } = renderPanel();

    screen.getByRole('dialog').focus();
    await user.keyboard('1+2{Enter}');
    expect(onApply).toHaveBeenCalledWith('3.00');

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  test('keeps keyboard input working after clicking a keypad button', async () => {
    const user = userEvent.setup();
    const { onApply } = renderPanel();

    await user.click(screen.getByRole('button', { name: '1' }));
    await user.keyboard('+2{Enter}');
    expect(onApply).toHaveBeenCalledWith('3.00');
  });
});
