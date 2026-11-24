import { describe, expect, test } from 'vitest';
import {
  DomainError,
  addActivity,
  addPerson,
  createProject,
  deleteActivity,
  deletePerson,
  getActivityShares,
  getActivityTotalCents,
  getPersonTotalCents,
  getProjectTotalCents,
  nameKey,
  normalizeName,
  renamePerson,
  renameProject,
  updateActivity,
} from './projectOps';
import type { Project } from './types';

function personId(project: Project, name: string): string {
  const person = project.people.find((item) => item.name === name);
  if (!person) throw new Error(`missing person ${name}`);
  return person.id;
}

function activityId(project: Project, name: string): string {
  const activity = project.activities.find((item) => item.name === name);
  if (!activity) throw new Error(`missing activity ${name}`);
  return activity.id;
}

function projectWithPeople(names: string[]): Project {
  return names.reduce((project, name) => addPerson(project, name), createProject('云南行'));
}

function sharesFor(project: Project, activityName: string): Record<string, number> {
  const activity = project.activities.find((item) => item.name === activityName);
  if (!activity) throw new Error(`missing activity ${activityName}`);
  return Object.fromEntries(
    getActivityShares(activity, project.people).map((share) => [share.personId, share.amountCents]),
  );
}

describe('names', () => {
  test('normalizes width, whitespace, and case', () => {
    expect(normalizeName('  小  明  ')).toBe('小 明');
    expect(nameKey('  Ａ  ')).toBe('a');
  });
});

describe('createProject and people', () => {
  test('creates an empty project with a UUID and timestamps', () => {
    const project = createProject(' 云南行 ');
    expect(project.name).toBe('云南行');
    expect(project.schemaVersion).toBe(1);
    expect(project.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(project.people).toEqual([]);
    expect(project.activities).toEqual([]);
    expect(project.createdAt).toBeTruthy();
    expect(project.updatedAt).toBeTruthy();
  });

  test('rejects empty project names', () => {
    expect(() => createProject('   ')).toThrow(DomainError);
  });

  test('adds and renames people while blocking duplicates', () => {
    let project = createProject('云南行');
    project = addPerson(project, ' 小明 ');
    const id = personId(project, '小明');
    expect(project.people[0].name).toBe('小明');

    expect(() => addPerson(project, '小明')).toThrow(DomainError);
    expect(() => addPerson(project, '   ')).toThrow(DomainError);

    project = addPerson(project, '小红');
    project = renamePerson(project, id, ' 小明明 ');
    expect(project.people.find((person) => person.id === id)?.name).toBe('小明明');
    expect(() => renamePerson(project, id, '小红')).toThrow(DomainError);
  });

  test('does not mutate the input project', () => {
    const original = createProject('云南行');
    const next = addPerson(original, '小明');
    expect(original.people).toHaveLength(0);
    expect(next.people).toHaveLength(1);
  });

  test('renames a project', () => {
    const project = renameProject(createProject('云南行'), ' 云南七日游 ');
    expect(project.name).toBe('云南七日游');
  });
});

describe('activities and totals', () => {
  test('adds equal and custom activities', () => {
    let project = projectWithPeople(['小明', '小红', '小刚']);
    const ids = project.people.map((person) => person.id);

    project = addActivity(project, {
      name: ' 住宿 ',
      mode: 'equal',
      totalCents: 60000,
      participantIds: [ids[2], ids[0], ids[1]],
    });
    const equal = project.activities[0];
    expect(equal.name).toBe('住宿');
    expect(equal.mode).toBe('equal');
    expect(equal).toMatchObject({ totalCents: 60000, participantIds: [ids[0], ids[1], ids[2]] });

    project = addActivity(project, {
      name: '晚餐',
      mode: 'custom',
      shares: [
        { personId: ids[0], amountCents: 8000 },
        { personId: ids[1], amountCents: 8000 },
      ],
    });
    const custom = project.activities[1];
    expect(custom.mode).toBe('custom');
    expect(getActivityTotalCents(custom)).toBe(16000);
  });

  test('rejects invalid activity input', () => {
    const project = projectWithPeople(['小明']);
    const id = project.people[0].id;

    expect(() =>
      addActivity(project, { name: ' ', mode: 'equal', totalCents: 100, participantIds: [id] }),
    ).toThrow(DomainError);
    expect(() =>
      addActivity(project, { name: '住宿', mode: 'equal', totalCents: 0, participantIds: [id] }),
    ).toThrow(DomainError);
    expect(() =>
      addActivity(project, { name: '住宿', mode: 'equal', totalCents: 100, participantIds: [] }),
    ).toThrow(DomainError);
    expect(() =>
      addActivity(project, {
        name: '晚餐',
        mode: 'custom',
        shares: [{ personId: id, amountCents: -1 }],
      }),
    ).toThrow(DomainError);
    expect(() =>
      addActivity(project, {
        name: '晚餐',
        mode: 'custom',
        shares: [{ personId: id, amountCents: 0 }],
      }),
    ).toThrow(DomainError);
    expect(() =>
      addActivity(project, {
        name: '晚餐',
        mode: 'custom',
        shares: [{ personId: 'missing', amountCents: 100 }],
      }),
    ).toThrow(DomainError);
  });

  test('updates an equal activity without changing the supplied total', () => {
    let project = projectWithPeople(['小明', '小红']);
    const ids = project.people.map((person) => person.id);
    project = addActivity(project, {
      name: '住宿',
      mode: 'equal',
      totalCents: 60000,
      participantIds: ids,
    });

    project = updateActivity(project, activityId(project, '住宿'), {
      name: '住宿',
      mode: 'equal',
      totalCents: 60000,
      participantIds: [ids[0]],
    });

    const activity = project.activities[0];
    expect(activity.mode).toBe('equal');
    expect(getActivityShares(activity, project.people)).toEqual([
      { personId: ids[0], amountCents: 60000 },
    ]);
  });

  test('updates a custom activity and replaces shares', () => {
    let project = projectWithPeople(['小明', '小红']);
    const ids = project.people.map((person) => person.id);
    project = addActivity(project, {
      name: '晚餐',
      mode: 'custom',
      shares: [{ personId: ids[0], amountCents: 1000 }],
    });

    project = updateActivity(project, activityId(project, '晚餐'), {
      name: '晚餐',
      mode: 'custom',
      shares: [
        { personId: ids[0], amountCents: 2000 },
        { personId: ids[1], amountCents: 3000 },
      ],
    });

    expect(getActivityTotalCents(project.activities[0])).toBe(5000);
  });

  test('deletes an activity', () => {
    let project = projectWithPeople(['小明']);
    project = addActivity(project, {
      name: '住宿',
      mode: 'equal',
      totalCents: 100,
      participantIds: [project.people[0].id],
    });
    project = deleteActivity(project, project.activities[0].id);
    expect(project.activities).toHaveLength(0);
    expect(() => deleteActivity(project, 'missing')).toThrow(DomainError);
  });

  test('returns shares in person order and computes the spec example', () => {
    let project = projectWithPeople(['小明', '小红', '小刚']);
    const [ming, hong, gang] = project.people.map((person) => person.id);

    project = addActivity(project, {
      name: '住宿',
      mode: 'equal',
      totalCents: 60000,
      participantIds: [gang, ming, hong],
    });
    project = addActivity(project, {
      name: '晚餐',
      mode: 'custom',
      shares: [
        { personId: ming, amountCents: 8000 },
        { personId: hong, amountCents: 8000 },
        { personId: gang, amountCents: 8000 },
      ],
    });
    project = addActivity(project, {
      name: '门票',
      mode: 'equal',
      totalCents: 20000,
      participantIds: [ming, gang],
    });

    const hotel = project.activities.find((activity) => activity.name === '住宿')!;
    expect(getActivityShares(hotel, project.people)).toEqual([
      { personId: ming, amountCents: 20000 },
      { personId: hong, amountCents: 20000 },
      { personId: gang, amountCents: 20000 },
    ]);

    expect(getPersonTotalCents(project, ming)).toBe(38000);
    expect(getPersonTotalCents(project, hong)).toBe(28000);
    expect(getPersonTotalCents(project, gang)).toBe(38000);
    expect(getProjectTotalCents(project)).toBe(104000);
  });

  test('splits one hundred yuan three ways with a one-cent remainder', () => {
    const project = projectWithPeople(['小明', '小红', '小刚']);
    const ids = project.people.map((person) => person.id);
    const withActivity = addActivity(project, {
      name: '车费',
      mode: 'equal',
      totalCents: 10000,
      participantIds: ids,
    });
    expect(getActivityShares(withActivity.activities[0], project.people)).toEqual([
      { personId: ids[0], amountCents: 3334 },
      { personId: ids[1], amountCents: 3333 },
      { personId: ids[2], amountCents: 3333 },
    ]);
  });
});

describe('deletePerson', () => {
  test('removes the person from equal and custom activities and reduces equal totals', () => {
    let project = projectWithPeople(['小明', '小红', '小刚']);
    const [ming, hong, gang] = project.people.map((person) => person.id);

    project = addActivity(project, {
      name: '住宿',
      mode: 'equal',
      totalCents: 10000,
      participantIds: [ming, hong, gang],
    });
    project = addActivity(project, {
      name: '晚餐',
      mode: 'custom',
      shares: [
        { personId: ming, amountCents: 1000 },
        { personId: hong, amountCents: 2000 },
        { personId: gang, amountCents: 3000 },
      ],
    });

    project = deletePerson(project, hong);

    expect(project.people.map((person) => person.name)).toEqual(['小明', '小刚']);
    const hotel = project.activities.find((activity) => activity.name === '住宿')!;
    expect(hotel.mode).toBe('equal');
    if (hotel.mode === 'equal') {
      expect(hotel.totalCents).toBe(6667);
      expect(hotel.participantIds).toEqual([ming, gang]);
    }
    expect(sharesFor(project, '住宿')).toEqual({ [ming]: 3334, [gang]: 3333 });
    expect(sharesFor(project, '晚餐')).toEqual({ [ming]: 1000, [gang]: 3000 });
  });

  test('deletes activities left with no participants', () => {
    let project = projectWithPeople(['小明', '小红']);
    const [ming, hong] = project.people.map((person) => person.id);
    project = addActivity(project, {
      name: '单人活动',
      mode: 'equal',
      totalCents: 100,
      participantIds: [hong],
    });
    project = addActivity(project, {
      name: '单人晚餐',
      mode: 'custom',
      shares: [{ personId: hong, amountCents: 100 }],
    });

    project = deletePerson(project, hong);
    expect(project.people.map((person) => person.id)).toEqual([ming]);
    expect(project.activities).toEqual([]);
  });

  test('rejects deleting an unknown person', () => {
    expect(() => deletePerson(createProject('云南行'), 'missing')).toThrow(DomainError);
  });
});
