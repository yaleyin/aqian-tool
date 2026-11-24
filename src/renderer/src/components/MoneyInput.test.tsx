import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useState } from 'react';
import MoneyInput from './MoneyInput';

afterEach(cleanup);

function Harness({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  return (
    <MoneyInput
      id="amount"
      label="活动总额"
      value={value}
      onChange={setValue}
      calculatorOpen={open}
      onCalculatorOpenChange={setOpen}
    />
  );
}

describe('MoneyInput', () => {
  test('renders a labelled amount input and calculator trigger', () => {
    render(<Harness />);
    expect(screen.getByLabelText('活动总额')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开计算器：活动总额' })).toBeInTheDocument();
  });

  test('opens the calculator and writes the result back', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: '打开计算器：活动总额' }));
    expect(screen.getByRole('dialog', { name: '计算器：活动总额' })).toBeInTheDocument();

    for (const key of ['1', '加', '2', '等于']) {
      await user.click(screen.getByRole('button', { name: key }));
    }

    expect(screen.getByLabelText('活动总额')).toHaveValue('3.00');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('opens with the current input value and keeps manual typing working', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCalculatorOpenChange = vi.fn();
    const { rerender } = render(
      <MoneyInput
        id="amount"
        label="活动总额"
        value="600.00"
        onChange={onChange}
        calculatorOpen={false}
        onCalculatorOpenChange={onCalculatorOpenChange}
      />,
    );

    await user.type(screen.getByLabelText('活动总额'), '5');
    expect(onChange).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '打开计算器：活动总额' }));
    expect(onCalculatorOpenChange).toHaveBeenCalledWith(true);

    rerender(
      <MoneyInput
        id="amount"
        label="活动总额"
        value="600.00"
        onChange={onChange}
        calculatorOpen
        onCalculatorOpenChange={onCalculatorOpenChange}
      />,
    );
    expect(screen.getByLabelText('计算器表达式')).toHaveTextContent('600.00');
  });
});
