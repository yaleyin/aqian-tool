import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { addPerson, deletePerson, renamePerson } from '@shared/projectOps';
import type { Person, Project } from '@shared/types';
import Button from '../components/Button';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';

export interface PeopleDrawerProps {
  open: boolean;
  project: Project;
  onClose: () => void;
  mutate: (updater: (project: Project) => Project) => void;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function affectedActivities(project: Project, person: Person): number {
  return project.activities.filter((activity) =>
    activity.mode === 'equal'
      ? activity.participantIds.includes(person.id)
      : activity.shares.some((share) => share.personId === person.id),
  ).length;
}

function emptyActivities(project: Project, person: Person): number {
  try {
    return project.activities.length - deletePerson(project, person.id).activities.length;
  } catch {
    return 0;
  }
}

export default function PeopleDrawer({
  open,
  project,
  onClose,
  mutate,
}: PeopleDrawerProps) {
  const [addName, setAddName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const skipEditBlurRef = useRef(false);

  const handleAdd = () => {
    const value = addName.trim();
    if (!value) {
      setAddError('人员名称不能为空');
      return;
    }

    try {
      const next = addPerson(project, value);
      mutate(() => next);
      setAddName('');
      setAddError(null);
      queueMicrotask(() => addInputRef.current?.focus());
    } catch (error) {
      setAddError(messageOf(error, '添加人员失败'));
    }
  };

  const handleAddSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleAdd();
  };

  const handleAddKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleAdd();
    }
  };

  const startRename = (person: Person) => {
    setEditingId(person.id);
    setEditName(person.name);
    setEditError(null);
  };

  const cancelRename = () => {
    skipEditBlurRef.current = true;
    setEditingId(null);
    setEditError(null);
  };

  const commitRename = (person: Person) => {
    const value = editName.trim();
    if (!value) {
      setEditError('人员名称不能为空');
      return;
    }
    if (value === person.name) {
      setEditingId(null);
      setEditError(null);
      return;
    }

    try {
      const next = renamePerson(project, person.id, value);
      mutate(() => next);
      setEditingId(null);
      setEditError(null);
    } catch (error) {
      setEditError(messageOf(error, '修改人员名称失败'));
    }
  };

  const handleRenameKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    person: Person,
  ) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelRename();
    } else if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      commitRename(person);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    try {
      const next = deletePerson(project, deleteTarget.id);
      mutate(() => next);
      setDeleteTarget(null);
    } catch {
      setDeleteTarget(null);
    }
  };

  const affected = deleteTarget ? affectedActivities(project, deleteTarget) : 0;
  const empty = deleteTarget ? emptyActivities(project, deleteTarget) : 0;

  return (
    <>
      <Modal open={open} onClose={onClose} title="人员" variant="drawer">
        <div className="people-drawer">
          {project.people.length === 0 ? (
            <div className="drawer-empty">
              <p>还没有人员</p>
              <span>先在下面添加参与这次出行的人。</span>
            </div>
          ) : (
            <div className="people-list">
              {project.people.map((person) => (
                <div className="person-row" key={person.id}>
                  {editingId === person.id ? (
                    <div className="person-edit-block">
                      <input
                        className="text-input"
                        aria-label={`编辑人员姓名：${person.name}`}
                        value={editName}
                        autoFocus
                        maxLength={20}
                        aria-invalid={Boolean(editError)}
                        onChange={(event) => {
                          setEditName(event.target.value);
                          if (editError) setEditError(null);
                        }}
                        onBlur={() => {
                          if (skipEditBlurRef.current) {
                            skipEditBlurRef.current = false;
                            return;
                          }
                          commitRename(person);
                        }}
                        onKeyDown={(event) => handleRenameKeyDown(event, person)}
                      />
                      {editError ? (
                        <p className="inline-error" role="alert">
                          {editError}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <span className="person-row-name">{person.name}</span>
                  )}
                  <div className="person-row-actions">
                    <Button
                      variant="ghost"
                      className="icon-button"
                      aria-label={`编辑人员：${person.name}`}
                      onClick={() => startRename(person)}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      className="icon-button icon-button--danger"
                      aria-label={`删除人员：${person.name}`}
                      onClick={() => setDeleteTarget(person)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form className="add-person-form" onSubmit={handleAddSubmit}>
            <label htmlFor="new-person-name">人员姓名</label>
            <div className="add-person-row">
              <input
                ref={addInputRef}
                id="new-person-name"
                className="text-input"
                value={addName}
                autoFocus
                maxLength={20}
                placeholder="输入人员姓名"
                aria-invalid={Boolean(addError)}
                onChange={(event) => {
                  setAddName(event.target.value);
                  if (addError) setAddError(null);
                }}
                onKeyDown={handleAddKeyDown}
              />
              <Button
                type="submit"
                variant="primary"
                className="icon-button"
                aria-label="添加人员"
              >
                <Plus size={20} aria-hidden="true" />
              </Button>
            </div>
            {addError ? (
              <p className="inline-error" role="alert">
                {addError}
              </p>
            ) : null}
          </form>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除人员？"
        description={
          deleteTarget
            ? `删除后，TA 将从 ${affected} 个活动中移除；其中 ${empty} 个活动会因没有有效分摊而删除。`
            : ''
        }
        confirmLabel="删除人员"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
