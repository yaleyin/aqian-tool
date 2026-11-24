import { z } from 'zod';
import { nameKey, normalizeName } from './names';
import type { Activity, Person, Project, Share } from './types';

const NonEmptyName = (max: number, label: string) =>
  z
    .string()
    .transform(normalizeName)
    .refine((value) => value.length > 0, `${label}不能为空`)
    .refine((value) => value.length <= max, `${label}不能超过 ${max} 个字符`);

const PersonSchema = z.object({
  id: z.string().min(1),
  name: NonEmptyName(20, '人员名称'),
  createdAt: z.string().min(1),
});

const ShareSchema = z.object({
  personId: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
});

const EqualActivitySchema = z.object({
  id: z.string().min(1),
  name: NonEmptyName(40, '活动名称'),
  createdAt: z.string().min(1),
  mode: z.literal('equal'),
  totalCents: z.number().int().positive(),
  participantIds: z.array(z.string().min(1)).min(1, '至少选择一名参与人员'),
});

const CustomActivitySchema = z
  .object({
    id: z.string().min(1),
    name: NonEmptyName(40, '活动名称'),
    createdAt: z.string().min(1),
    mode: z.literal('custom'),
    shares: z.array(ShareSchema).min(1, '至少填写一笔金额'),
  })
  .superRefine((value, context) => {
    if (!value.shares.some((share) => share.amountCents > 0)) {
      context.addIssue({
        code: 'custom',
        message: '至少填写一笔大于 0 的金额',
        path: ['shares'],
      });
    }

    const personIds = new Set<string>();
    for (const share of value.shares) {
      if (personIds.has(share.personId)) {
        context.addIssue({
          code: 'custom',
          message: '同一人员不能重复填写金额',
          path: ['shares'],
        });
        break;
      }
      personIds.add(share.personId);
    }
  });

const ActivitySchema = z.discriminatedUnion('mode', [EqualActivitySchema, CustomActivitySchema]);

const ProjectSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    name: NonEmptyName(40, '项目名称'),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    people: z.array(PersonSchema),
    activities: z.array(ActivitySchema),
  })
  .superRefine((project, context) => {
    const personIds = new Set<string>();
    const personNameKeys = new Set<string>();

    for (const person of project.people) {
      if (personIds.has(person.id)) {
        context.addIssue({
          code: 'custom',
          message: '人员 ID 重复',
          path: ['people'],
        });
      }
      personIds.add(person.id);

      const key = nameKey(person.name);
      if (personNameKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          message: '人员名称重复',
          path: ['people'],
        });
      }
      personNameKeys.add(key);
    }

    const activityIds = new Set<string>();
    for (const activity of project.activities) {
      if (activityIds.has(activity.id)) {
        context.addIssue({
          code: 'custom',
          message: '活动 ID 重复',
          path: ['activities'],
        });
      }
      activityIds.add(activity.id);

      if (activity.mode === 'equal') {
        const participantIds = new Set<string>();
        for (const personId of activity.participantIds) {
          if (!personIds.has(personId)) {
            context.addIssue({
              code: 'custom',
              message: '活动包含不存在的人员',
              path: ['activities'],
            });
          }
          if (participantIds.has(personId)) {
            context.addIssue({
              code: 'custom',
              message: '活动人员重复',
              path: ['activities'],
            });
          }
          participantIds.add(personId);
        }
      } else {
        for (const share of activity.shares) {
          if (!personIds.has(share.personId)) {
            context.addIssue({
              code: 'custom',
              message: '活动包含不存在的人员',
              path: ['activities'],
            });
          }
        }
      }
    }
  });

export function parseProject(input: unknown): Project {
  return ProjectSchema.parse(input) as Project;
}

export type { Activity, Person, Project, Share };
