import { describe, expect, test } from 'vitest';
import { isValidProjectId } from './ids';

describe('isValidProjectId', () => {
  test('accepts UUIDs in either case', () => {
    expect(isValidProjectId('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isValidProjectId('ABCDEF12-3456-4ABC-8DEF-1234567890AB')).toBe(true);
  });

  test('rejects traversal, paths, and non-strings', () => {
    expect(isValidProjectId('../evil')).toBe(false);
    expect(isValidProjectId('11111111-1111-4111-8111-11111111111/')).toBe(false);
    expect(isValidProjectId('11111111-1111-4111-8111-111111111111.json')).toBe(false);
    expect(isValidProjectId(null)).toBe(false);
    expect(isValidProjectId(42)).toBe(false);
  });
});
