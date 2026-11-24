export type SplitMode = 'equal' | 'custom';

export interface Person {
  id: string;
  name: string;
  createdAt: string;
}

export interface Share {
  personId: string;
  amountCents: number;
}

export interface EqualActivity {
  id: string;
  name: string;
  createdAt: string;
  mode: 'equal';
  totalCents: number;
  participantIds: string[];
}

export interface CustomActivity {
  id: string;
  name: string;
  createdAt: string;
  mode: 'custom';
  shares: Share[];
}

export type Activity = EqualActivity | CustomActivity;

export interface Project {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  people: Person[];
  activities: Activity[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  peopleCount: number;
  activityCount: number;
  totalCents: number;
  status: 'ok' | 'unreadable';
  error?: string;
}

export interface LoadProjectResult {
  project: Project;
  recoveredFromBackup: boolean;
}
