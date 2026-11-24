import { describe, expect, test } from 'vitest';
import { calculateAmountExpression } from './calculator';

describe('calculateAmountExpression', () => {
  test.each([
    ['0.1+0.2', '0.30'],
    ['100/3', '33.33'],
    ['(120+80)/2', '100.00'],
    ['2*(3+4)', '14.00'],
    ['-5+10', '5.00'],
    ['0', '0.00'],
    ['1,000+500', '1500.00'],
    ['1.005+0', '1.01'],
    ['2×3+1', '7.00'],
    ['8÷2', '4.00'],
  ])('calculates %s as %s', (expression, amount) => {
    expect(calculateAmountExpression(expression)).toEqual({ ok: true, amount });
  });

  test.each([
    ['1/0', '不能除以 0'],
    ['1-2', '金额不能为负数'],
    ['9999999.99+0.01', '金额过大'],
  ])('reports the expected domain error for %s', (expression, error) => {
    expect(calculateAmountExpression(expression)).toEqual({ ok: false, error });
  });

  test.each(['', '1+', '(1+2', '1+2)', 'abc', '1.2.3', '1++2'])(
    'rejects malformed expression %s',
    (expression) => {
      const result = calculateAmountExpression(expression);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
    },
  );
});
