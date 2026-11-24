import { describe, expect, test } from 'vitest';
import { MAX_AMOUNT_CENTS, formatCents, formatYuan, parseMoneyToCents, splitEqual } from './money';

describe('parseMoneyToCents', () => {
  test.each([
    ['1,234.5', 123450],
    ['￥ 0.01', 1],
    ['0', 0],
    ['9999999.99', MAX_AMOUNT_CENTS],
    ['１２３．４５', 12345],
  ])('parses %s', (input, expected) => {
    expect(parseMoneyToCents(input)).toBe(expected);
  });

  test.each(['', '12.345', '-1', 'abc', '10000000', '1.2.3'])('rejects %s', (input) => {
    expect(parseMoneyToCents(input)).toBeNull();
  });
});

describe('formatting', () => {
  test('formats cents with two decimals and grouping', () => {
    expect(formatCents(123456)).toBe('1,234.56');
    expect(formatCents(0)).toBe('0.00');
  });

  test('prefixes yuan', () => {
    expect(formatYuan(0)).toBe('¥0.00');
  });
});

describe('splitEqual', () => {
  test('distributes the remainder one cent at a time', () => {
    expect(splitEqual(10000, 3)).toEqual([3334, 3333, 3333]);
  });

  test('sums exactly to the total', () => {
    const shares = splitEqual(99999, 7);
    expect(shares).toHaveLength(7);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(99999);
  });

  test('handles zero and no participants', () => {
    expect(splitEqual(0, 3)).toEqual([0, 0, 0]);
    expect(splitEqual(100, 0)).toEqual([]);
  });
});
