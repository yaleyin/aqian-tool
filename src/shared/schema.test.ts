import { describe, expect, test } from 'vitest';
import { parseProject } from './schema';

const validProject = {
  schemaVersion: 1,
  id: '11111111-1111-4111-8111-111111111111',
  name: '云南行',
  createdAt: '2026-11-24T00:00:00.000Z',
  updatedAt: '2026-11-24T00:00:00.000Z',
  people: [{ id: 'p1', name: '小明', createdAt: '2026-11-24T00:00:00.000Z' }],
  activities: [
    {
      id: 'a1',
      name: '住宿',
      createdAt: '2026-11-24T00:00:00.000Z',
      mode: 'equal',
      totalCents: 10000,
      participantIds: ['p1'],
    },
  ],
};

describe('parseProject', () => {
  test('accepts a valid project', () => {
    expect(parseProject(validProject).name).toBe('云南行');
  });

  test('rejects negative and fractional cents', () => {
    expect(() =>
      parseProject({
        ...validProject,
        activities: [{ ...validProject.activities[0], totalCents: -1 }],
      }),
    ).toThrow();
    expect(() =>
      parseProject({
        ...validProject,
        activities: [{ ...validProject.activities[0], totalCents: 1.5 }],
      }),
    ).toThrow();
  });

  test('rejects shares that reference unknown people', () => {
    const bad = {
      ...validProject,
      activities: [
        {
          id: 'a2',
          name: '晚餐',
          createdAt: validProject.createdAt,
          mode: 'custom',
          shares: [{ personId: 'missing', amountCents: 100 }],
        },
      ],
    };
    expect(() => parseProject(bad)).toThrow();
  });
});
