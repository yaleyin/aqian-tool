import { Plus, ReceiptText, Users } from 'lucide-react';
import { formatYuan } from '@shared/money';
import {
  getActivityShares,
  getActivityTotalCents,
  getPersonTotalCents,
} from '@shared/projectOps';
import type { Project } from '@shared/types';
import Button from './Button';
import EmptyState from './EmptyState';

export interface ProjectTableProps {
  project: Project;
  onEditActivity: (activityId: string) => void;
  onAddPerson: () => void;
  onAddActivity: () => void;
}

export default function ProjectTable({
  project,
  onEditActivity,
  onAddPerson,
  onAddActivity,
}: ProjectTableProps) {
  if (project.people.length === 0) {
    return (
      <EmptyState
        icon={<Users size={28} aria-hidden="true" />}
        title="先添加人员"
        description="添加参与人员后，才能记录活动并计算每个人应付多少。"
        action={
          <Button variant="primary" onClick={onAddPerson}>
            <Plus size={18} aria-hidden="true" />
            添加人员
          </Button>
        }
      />
    );
  }

  const shareMaps = new Map(
    project.activities.map((activity) => [
      activity.id,
      new Map(
        getActivityShares(activity, project.people).map((share) => [
          share.personId,
          share.amountCents,
        ]),
      ),
    ]),
  );

  return (
    <div className="project-table-wrap">
      {project.activities.length === 0 ? (
        <div className="table-hint">
          <div>
            <strong>还没有活动</strong>
            <span>添加第一个活动后这里会自动计算分摊。</span>
          </div>
          <Button variant="secondary" size="sm" onClick={onAddActivity}>
            <Plus size={16} aria-hidden="true" />
            添加活动
          </Button>
        </div>
      ) : null}

      <div className="table-scroll">
        <table className="project-table" aria-label="项目分摊表">
          <thead>
            <tr>
              <th scope="col" className="person-column">
                人员
              </th>
              {project.activities.map((activity) => (
                <th scope="col" key={activity.id} className="activity-column">
                  <button
                    type="button"
                    className="activity-heading"
                    aria-label={`编辑活动：${activity.name}，总额 ${formatYuan(
                      getActivityTotalCents(activity),
                    )}`}
                    title={activity.name}
                    onClick={() => onEditActivity(activity.id)}
                  >
                    <span className="activity-name">{activity.name}</span>
                    <span className="activity-total">
                      {formatYuan(getActivityTotalCents(activity))}
                    </span>
                  </button>
                </th>
              ))}
              <th scope="col" className="total-column">
                应付合计
              </th>
            </tr>
          </thead>
          <tbody>
            {project.people.map((person) => (
              <tr key={person.id}>
                <th scope="row" className="person-name">
                  {person.name}
                </th>
                {project.activities.map((activity) => {
                  const amount = shareMaps.get(activity.id)?.get(person.id);
                  return (
                    <td key={activity.id} className="money-cell">
                      {amount === undefined ? (
                        <span className="dash" aria-label="未参与">
                          —
                        </span>
                      ) : (
                        formatYuan(amount)
                      )}
                    </td>
                  );
                })}
                <td className="money-cell person-total">
                  {formatYuan(getPersonTotalCents(project, person.id))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {project.activities.length === 0 ? (
        <div className="table-empty-note">
          <ReceiptText size={18} aria-hidden="true" />
          活动会自动按参与人员分摊，未参与的人显示为“—”。
        </div>
      ) : null}
    </div>
  );
}
