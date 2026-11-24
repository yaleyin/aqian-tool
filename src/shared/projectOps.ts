import { MAX_AMOUNT_CENTS, splitEqual } from './money';
import { nameKey, normalizeName } from './names';
import { parseProject } from './schema';
import type { Activity, Person, Project, Share } from './types';

export { nameKey, normalizeName };

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export type ActivityInput =
  | { name: string; mode: 'equal'; totalCents: number; participantIds: string[] }
  | { name: string; mode: 'custom'; shares: Share[] };

function now(): string {
  return new Date().toISOString();
}

function requireName(raw: string, maxLength: number, label: string): string {
  const value = normalizeName(raw);
  if (!value) {
    throw new DomainError(`${label}不能为空`);
  }
  if (value.length > maxLength) {
    throw new DomainError(`${label}不能超过 ${maxLength} 个字符`);
  }
  return value;
}

function requireAmount(amountCents: number, label: string): number {
  if (!Number.isInteger(amountCents)) {
    throw new DomainError(`${label}必须是整数分`);
  }
  if (amountCents < 0) {
    throw new DomainError(`${label}不能为负数`);
  }
  if (amountCents > MAX_AMOUNT_CENTS) {
    throw new DomainError(`${label}过大`);
  }
  return amountCents;
}

function requireProject(project: Project): Project {
  return parseProject(project);
}

function validateParticipants(project: Project, participantIds: string[]): string[] {
  if (participantIds.length === 0) {
    throw new DomainError('至少选择一名参与人员');
  }

  const known = new Set(project.people.map((person) => person.id));
  const seen = new Set<string>();
  for (const personId of participantIds) {
    if (!known.has(personId)) {
      throw new DomainError('参与人员不存在');
    }
    if (seen.has(personId)) {
      throw new DomainError('参与人员不能重复');
    }
    seen.add(personId);
  }

  const order = new Map(project.people.map((person, index) => [person.id, index]));
  return [...participantIds].sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
}

function validateShares(project: Project, shares: Share[]): Share[] {
  if (shares.length === 0) {
    throw new DomainError('至少填写一笔金额');
  }

  const known = new Set(project.people.map((person) => person.id));
  const seen = new Set<string>();
  let hasPositive = false;

  const normalized = shares.map((share) => {
    if (!known.has(share.personId)) {
      throw new DomainError('参与人员不存在');
    }
    if (seen.has(share.personId)) {
      throw new DomainError('同一人员不能重复填写金额');
    }
    seen.add(share.personId);
    const amountCents = requireAmount(share.amountCents, '金额');
    if (amountCents > 0) hasPositive = true;
    return { personId: share.personId, amountCents };
  });

  if (!hasPositive) {
    throw new DomainError('至少填写一笔大于 0 的金额');
  }

  const order = new Map(project.people.map((person, index) => [person.id, index]));
  return normalized.sort(
    (left, right) => (order.get(left.personId) ?? 0) - (order.get(right.personId) ?? 0),
  );
}

function buildActivity(
  project: Project,
  input: ActivityInput,
  existing?: Activity,
): Activity {
  const name = requireName(input.name, 40, '活动名称');
  const id = existing?.id ?? crypto.randomUUID();
  const createdAt = existing?.createdAt ?? now();

  if (input.mode === 'equal') {
    if (input.totalCents <= 0) {
      throw new DomainError('均摊总额必须大于 0');
    }
    const totalCents = requireAmount(input.totalCents, '活动总额');
    const participantIds = validateParticipants(project, input.participantIds);
    return {
      id,
      name,
      createdAt,
      mode: 'equal',
      totalCents,
      participantIds,
    };
  }

  const shares = validateShares(project, input.shares);
  return {
    id,
    name,
    createdAt,
    mode: 'custom',
    shares,
  };
}

export function createProject(name: string): Project {
  const projectName = requireName(name, 40, '项目名称');
  const timestamp = now();
  return requireProject({
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: projectName,
    createdAt: timestamp,
    updatedAt: timestamp,
    people: [],
    activities: [],
  });
}

export function renameProject(project: Project, name: string): Project {
  return requireProject({
    ...project,
    name: requireName(name, 40, '项目名称'),
    updatedAt: now(),
  });
}

export function addPerson(project: Project, name: string): Project {
  const personName = requireName(name, 20, '人员名称');
  const key = nameKey(personName);
  if (project.people.some((person) => nameKey(person.name) === key)) {
    throw new DomainError('人员名称已存在');
  }

  const person: Person = {
    id: crypto.randomUUID(),
    name: personName,
    createdAt: now(),
  };

  return requireProject({
    ...project,
    people: [...project.people, person],
    updatedAt: now(),
  });
}

export function renamePerson(project: Project, personId: string, name: string): Project {
  const personName = requireName(name, 20, '人员名称');
  const key = nameKey(personName);
  if (!project.people.some((person) => person.id === personId)) {
    throw new DomainError('人员不存在');
  }
  if (
    project.people.some(
      (person) => person.id !== personId && nameKey(person.name) === key,
    )
  ) {
    throw new DomainError('人员名称已存在');
  }

  return requireProject({
    ...project,
    people: project.people.map((person) =>
      person.id === personId ? { ...person, name: personName } : person,
    ),
    updatedAt: now(),
  });
}

export function deletePerson(project: Project, personId: string): Project {
  if (!project.people.some((person) => person.id === personId)) {
    throw new DomainError('人员不存在');
  }

  const people = project.people.filter((person) => person.id !== personId);
  const activities = project.activities.flatMap((activity): Activity[] => {
    if (activity.mode === 'equal') {
      if (!activity.participantIds.includes(personId)) {
        return [activity];
      }

      const share = getActivityShares(activity, project.people).find(
        (item) => item.personId === personId,
      );
      const participantIds = activity.participantIds.filter((id) => id !== personId);
      const totalCents = activity.totalCents - (share?.amountCents ?? 0);

      if (participantIds.length === 0 || totalCents <= 0) {
        return [];
      }

      return [{ ...activity, participantIds, totalCents }];
    }

    const shares = activity.shares.filter((share) => share.personId !== personId);
    if (shares.length === 0 || !shares.some((share) => share.amountCents > 0)) {
      return [];
    }

    return [{ ...activity, shares }];
  });

  return requireProject({
    ...project,
    people,
    activities,
    updatedAt: now(),
  });
}

export function addActivity(project: Project, input: ActivityInput): Project {
  const activity = buildActivity(project, input);
  return requireProject({
    ...project,
    activities: [...project.activities, activity],
    updatedAt: now(),
  });
}

export function updateActivity(
  project: Project,
  activityId: string,
  input: ActivityInput,
): Project {
  const existing = project.activities.find((activity) => activity.id === activityId);
  if (!existing) {
    throw new DomainError('活动不存在');
  }

  const activity = buildActivity(project, input, existing);
  return requireProject({
    ...project,
    activities: project.activities.map((item) =>
      item.id === activityId ? activity : item,
    ),
    updatedAt: now(),
  });
}

export function deleteActivity(project: Project, activityId: string): Project {
  if (!project.activities.some((activity) => activity.id === activityId)) {
    throw new DomainError('活动不存在');
  }

  return requireProject({
    ...project,
    activities: project.activities.filter((activity) => activity.id !== activityId),
    updatedAt: now(),
  });
}

export function getActivityShares(activity: Activity, people: Person[]): Share[] {
  if (activity.mode === 'equal') {
    const order = new Map(people.map((person, index) => [person.id, index]));
    const participantIds = [...new Set(activity.participantIds)]
      .filter((personId) => order.has(personId))
      .sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
    const amounts = splitEqual(activity.totalCents, participantIds.length);

    return participantIds.map((personId, index) => ({
      personId,
      amountCents: amounts[index] ?? 0,
    }));
  }

  const shares = new Map(activity.shares.map((share) => [share.personId, share.amountCents]));
  return people
    .filter((person) => shares.has(person.id))
    .map((person) => ({
      personId: person.id,
      amountCents: shares.get(person.id) ?? 0,
    }));
}

export function getActivityTotalCents(activity: Activity): number {
  if (activity.mode === 'equal') {
    return activity.totalCents;
  }
  return activity.shares.reduce((sum, share) => sum + share.amountCents, 0);
}

export function getPersonTotalCents(project: Project, personId: string): number {
  return project.activities.reduce((sum, activity) => {
    const share = getActivityShares(activity, project.people).find(
      (item) => item.personId === personId,
    );
    return sum + (share?.amountCents ?? 0);
  }, 0);
}

export function getProjectTotalCents(project: Project): number {
  return project.activities.reduce(
    (sum, activity) => sum + getActivityTotalCents(activity),
    0,
  );
}
