import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test } from 'vitest';
import { useState } from 'react';
import Button from './Button';
import Modal from './Modal';

afterEach(cleanup);

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>打开对话框</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="测试对话框">
        <label>
          名称
          <input aria-label="名称" />
        </label>
        <Button>确定</Button>
      </Modal>
    </>
  );
}

describe('Modal accessibility', () => {
  test('has an accessible title, traps focus, closes on Escape, and returns focus', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    const trigger = screen.getByRole('button', { name: '打开对话框' });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: '测试对话框' });
    expect(dialog).toBeInTheDocument();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
