import { vi } from 'vitest';
import type { AqianApi } from '@shared/api';
import { createProject } from '@shared/projectOps';
import type { ProjectSummary } from '@shared/types';

export function createMockApi(overrides: Partial<AqianApi> = {}): AqianApi {
  return {
    listProjects: vi.fn(async () => [] as ProjectSummary[]),
    createProject: vi.fn(async (name: string) => createProject(name)),
    loadProject: vi.fn(async () => ({
      project: createProject('云南行'),
      recoveredFromBackup: false,
    })),
    saveProject: vi.fn(async (project) => project),
    deleteProject: vi.fn(async () => undefined),
    openDataFolder: vi.fn(async () => undefined),
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: '云南行',
    updatedAt: '2026-11-24T10:00:00.000Z',
    peopleCount: 3,
    activityCount: 3,
    totalCents: 104000,
    status: 'ok',
    ...overrides,
  };
}
