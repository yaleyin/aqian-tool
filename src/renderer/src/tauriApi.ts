import { invoke } from '@tauri-apps/api/core';
import type { AqianApi } from '@shared/api';
import type { LoadProjectResult, Project, ProjectSummary } from '@shared/types';

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(typeof error === 'string' && error ? error : '操作失败');
  }
}

export const tauriApi: AqianApi = {
  listProjects: () => call<ProjectSummary[]>('list_projects'),
  createProject: (name) => call<Project>('create_project', { name }),
  loadProject: (id) => call<LoadProjectResult>('load_project', { id }),
  saveProject: (project) => call<Project>('save_project', { project }),
  deleteProject: (id) => call<void>('delete_project', { id }),
  openDataFolder: () => call<void>('open_data_folder'),
};
