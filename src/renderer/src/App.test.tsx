import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import App from './App';

test('shows the product title and the two starting actions', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'A钱小工具' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '新建消费项目' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '历史消费项目' })).toBeInTheDocument();
});
