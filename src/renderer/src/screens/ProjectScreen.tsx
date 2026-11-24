import { ArrowLeft, FolderOpen, Pencil, ReceiptText, Users } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { formatYuan } from '@shared/money';
import {
  addActivity,
  deleteActivity,
  getProjectTotalCents,
  renameProject,
  updateActivity,
  type ActivityInput,
} from '@shared/projectOps';
import type { Activity, Project } from '@shared/types';
import Button from '../components/Button';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ProjectTable from '../components/ProjectTable';
import SaveStatus from '../components/SaveStatus';
import { useProjectEditor } from '../hooks/useProjectEditor';
import ActivityModal from './ActivityModal';
import PeopleDrawer from './PeopleDrawer';

export interface ProjectScreenProps {
  projectId: string;
  onBack: () => void;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function TitleEditor({
  project,
  mutate,
  saveState,
  saveError,
  onClose,
  onRestore,
}: {
  project: Project;
  mutate: (updater: (project: Project) => Project) => void;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  saveError: string | null;
  onClose: () => void;
  onRestore: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const skipBlurRef = useRef(false);

  useEffect(() => {
    if (!pending) return;
    if (saveState === 'saved') {
      setEditing(false);
      setPending(false);
      setError(null);
    } else if (saveState === 'error' && saveError) {
      setError(saveError);
      setPending(false);
    }
  }, [pending, saveState, saveError]);

  const startEditing = () => {
    setDraft(project.name);
    setError(null);
    setPending(false);
    setEditing(true);
  };

  const commit = () => {
    if (pending) return;
    const value = draft.trim();
    if (!value) {
      setError('项目名称不能为空');
      return;
    }
    if (value === project.name) {
      setEditing(false);
      setError(null);
      return;
    }

    setError(null);
    setPending(true);
    try {
      mutate((current) => renameProject(current, value));
    } catch (renameError) {
      setPending(false);
      setError(errorMessage(renameError, '项目名称修改失败'));
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      skipBlurRef.current = true;
      if (error) onRestore();
      setEditing(false);
      setPending(false);
      setError(null);
      setDraft(project.name);
      onClose();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commit();
  };

  if (!editing) {
    return (
      <div className="project-title-block">
        <button
          type="button"
          className="project-title"
          aria-label="编辑项目名称"
          onClick={startEditing}
        >
          <span>{project.name}</span>
          <Pencil size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="project-title-block">
      <form className="project-title-form" onSubmit={handleSubmit}>
        <input
          className="text-input project-title-input"
          aria-label="项目名称"
          value={draft}
          autoFocus
          maxLength={40}
          readOnly={pending}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
          onBlur={() => {
            if (skipBlurRef.current) {
              skipBlurRef.current = false;
              return;
            }
            if (error) return;
            commit();
          }}
          onKeyDown={handleKeyDown}
        />
        {pending ? <span className="title-pending">保存中…</span> : null}
      </form>
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function ProjectScreen({ projectId, onBack }: ProjectScreenProps) {
  const editor = useProjectEditor(projectId);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [deleteActivityTarget, setDeleteActivityTarget] = useState<Activity | null>(null);
  const [titleEditorKey, setTitleEditorKey] = useState(0);
  const [navigationError, setNavigationError] = useState<string | null>(null);

  useEffect(() => {
    if (editor.saveState === 'saved') {
      setNavigationError(null);
    }
  }, [editor.saveState]);

  const restore = () => {
    editor.rollbackToSaved();
    setTitleEditorKey((key) => key + 1);
    setNavigationError(null);
  };

  const handleBack = async () => {
    const result = await editor.flushSaves();
    if (!result.ok) {
      setNavigationError(result.error ?? '保存失败，暂时无法返回历史。');
      return;
    }
    setNavigationError(null);
    onBack();
  };

  if (editor.loading) {
    return (
      <main className="app-shell app-shell--wide">
        <p className="page-status" role="status">
          正在加载项目…
        </p>
      </main>
    );
  }

  if (editor.loadError || !editor.project) {
    return (
      <main className="app-shell app-shell--wide">
        <EmptyState
          icon={<FolderOpen size={28} aria-hidden="true" />}
          title="无法打开项目"
          description={editor.loadError ?? '项目文件无法读取'}
          action={
            <div className="empty-state-actions">
              <Button variant="primary" onClick={onBack}>
                返回历史
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void window.aqian.openDataFolder().catch(() => undefined);
                }}
              >
                <FolderOpen size={18} aria-hidden="true" />
                打开数据文件夹
              </Button>
            </div>
          }
        />
      </main>
    );
  }

  const { project } = editor;
  const totalCents = getProjectTotalCents(project);
  const selectedActivity =
    project.activities.find((activity) => activity.id === editingActivityId) ?? null;

  const openFolder = () => {
    void window.aqian.openDataFolder().catch(() => undefined);
  };

  const openNewActivity = () => {
    setEditingActivityId(null);
    setActivityOpen(true);
  };

  const openEditActivity = (activityId: string) => {
    setEditingActivityId(activityId);
    setActivityOpen(true);
  };

  const handleActivitySubmit = (input: ActivityInput) => {
    const next = selectedActivity
      ? updateActivity(project, selectedActivity.id, input)
      : addActivity(project, input);
    editor.mutate(() => next);
    setActivityOpen(false);
    setEditingActivityId(null);
  };

  const requestDeleteActivity = () => {
    const target = selectedActivity;
    setActivityOpen(false);
    setEditingActivityId(null);
    if (target) setDeleteActivityTarget(target);
  };

  const confirmDeleteActivity = () => {
    if (!deleteActivityTarget) return;
    try {
      const next = deleteActivity(project, deleteActivityTarget.id);
      editor.mutate(() => next);
    } catch {
      // The activity is already gone or the project changed; close the confirmation.
    } finally {
      setDeleteActivityTarget(null);
    }
  };

  return (
    <main className="app-shell app-shell--wide project-screen">
      <header className="project-header">
        <Button
          variant="ghost"
          className="icon-button"
          aria-label="返回历史"
          onClick={() => void handleBack()}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Button>
        <TitleEditor
          key={titleEditorKey}
          project={project}
          mutate={editor.mutate}
          saveState={editor.saveState}
          saveError={editor.saveError}
          onClose={() => undefined}
          onRestore={restore}
        />
        <SaveStatus
          state={editor.saveState}
          savedAt={editor.savedAt}
          error={editor.saveError}
          onRetry={editor.retrySave}
          onRestore={restore}
        />
      </header>

      {navigationError ? (
        <p className="inline-error banner-error" role="alert">
          保存失败，暂时无法返回历史：{navigationError}。请先重试，或恢复上次保存。
        </p>
      ) : null}

      {editor.recoveredFromBackup ? (
        <div className="notice-banner" role="status">
          已从上一版备份恢复。请检查当前数据，再继续编辑。
        </div>
      ) : null}

      <p className="project-summary">
        <span>{project.people.length} 人</span>
        <span aria-hidden="true"> · </span>
        <span>{project.activities.length} 个活动</span>
        <span aria-hidden="true"> · </span>
        <span>总支出 </span>
        <strong className="project-summary-total">{formatYuan(totalCents)}</strong>
      </p>

      <div className="project-actions">
        <Button variant="primary" onClick={() => setPeopleOpen(true)}>
          <Users size={18} aria-hidden="true" />
          添加人员
        </Button>
        <Button
          variant="secondary"
          onClick={openNewActivity}
          disabled={project.people.length === 0}
          title={project.people.length === 0 ? '请先添加人员' : undefined}
        >
          <ReceiptText size={18} aria-hidden="true" />
          添加活动
        </Button>
        <Button variant="ghost" onClick={openFolder}>
          <FolderOpen size={18} aria-hidden="true" />
          打开数据文件夹
        </Button>
      </div>

      <ProjectTable
        project={project}
        onEditActivity={openEditActivity}
        onAddPerson={() => setPeopleOpen(true)}
        onAddActivity={openNewActivity}
      />

      <PeopleDrawer
        open={peopleOpen}
        project={project}
        onClose={() => setPeopleOpen(false)}
        mutate={editor.mutate}
      />

      <ActivityModal
        open={activityOpen}
        people={project.people}
        activity={selectedActivity}
        onClose={() => {
          setActivityOpen(false);
          setEditingActivityId(null);
        }}
        onSubmit={handleActivitySubmit}
        onDelete={selectedActivity ? requestDeleteActivity : undefined}
      />

      <ConfirmDialog
        open={Boolean(deleteActivityTarget)}
        title="删除活动？"
        description={
          deleteActivityTarget
            ? `将删除活动“${deleteActivityTarget.name}”，它对应的分摊金额会从每个人的合计中移除。`
            : ''
        }
        confirmLabel="删除活动"
        onConfirm={confirmDeleteActivity}
        onClose={() => setDeleteActivityTarget(null)}
      />
    </main>
  );
}
