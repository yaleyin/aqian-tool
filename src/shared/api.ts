import type { LoadProjectResult, Project, ProjectSummary } from './types';

export const PROJECT_CHANNELS = {
  list: 'projects:list',
  create: 'projects:create',
  load: 'projects:load',
  save: 'projects:save',
  delete: 'projects:delete',
  openFolder: 'projects:open-folder',
} as const;

export interface AqianApi {
  listProjects(): Promise<ProjectSummary[]>;
  createProject(name: string): Promise<Project>;
  loadProject(id: string): Promise<LoadProjectResult>;
  saveProject(project: Project): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  openDataFolder(): Promise<void>;
}
