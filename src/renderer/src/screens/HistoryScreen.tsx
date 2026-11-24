import { ArrowLeft, FolderOpen, History, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { formatYuan } from '@shared/money';
import type { ProjectSummary } from '@shared/types';
import Button from '../components/Button';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

export interface HistoryScreenProps {
  onBack: () => void;
  onOpenProject: (id: string) => void;
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function HistoryScreen({ onBack, onOpenProject }: HistoryScreenProps) {
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setSummaries(await window.aqian.listProjects());
    } catch (error) {
      setLoadError(errorMessage(error, '读取历史项目失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await window.aqian.deleteProject(deleteTarget.id);
      setDeleteTarget(null);
      await loadProjects();
    } catch (error) {
      setActionError(errorMessage(error, '删除项目失败'));
      setDeleteTarget(null);
    }
  };

  const handleOpenFolder = async () => {
    setActionError(null);
    try {
      await window.aqian.openDataFolder();
    } catch (error) {
      setActionError(errorMessage(error, '无法打开数据文件夹'));
    }
  };

  return (
    <main className="app-shell app-shell--wide">
      <header className="page-header">
        <Button variant="ghost" className="icon-button" aria-label="返回首页" onClick={onBack}>
          <ArrowLeft size={20} aria-hidden="true" />
        </Button>
        <div className="page-heading">
          <p className="eyebrow">本地账本</p>
          <h1>历史消费项目</h1>
        </div>
        <Button variant="secondary" onClick={handleOpenFolder}>
          <FolderOpen size={18} aria-hidden="true" />
          打开数据文件夹
        </Button>
      </header>

      {actionError ? (
        <p className="inline-error banner-error" role="alert">
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <p className="page-status" role="status">
          正在读取历史项目…
        </p>
      ) : loadError ? (
        <EmptyState
          icon={<History size={28} aria-hidden="true" />}
          title="无法读取历史项目"
          description={loadError}
          action={
            <Button variant="primary" onClick={() => void loadProjects()}>
              重试
            </Button>
          }
        />
      ) : summaries.length === 0 ? (
        <EmptyState
          icon={<History size={28} aria-hidden="true" />}
          title="还没有历史项目"
          description="新建一个消费项目，添加人员和活动后会自动保存在这里。"
          action={
            <Button variant="primary" onClick={onBack}>
              新建项目
            </Button>
          }
        />
      ) : (
        <section className="history-list" aria-label="历史项目">
          {summaries.map((summary) => {
            const unreadable = summary.status === 'unreadable';
            return (
              <article
                key={summary.id}
                className={`history-card${unreadable ? ' history-card--unreadable' : ''}`}
              >
                {unreadable ? (
                  <button
                    type="button"
                    className="history-card-main"
                    aria-label={`打开项目：${summary.name}`}
                    onClick={() => onOpenProject(summary.id)}
                  >
                    <div className="history-card-heading">
                      <h2>{summary.name}</h2>
                      <span className="badge badge--danger">无法读取</span>
                    </div>
                    <p className="history-meta">{summary.error ?? '项目文件无法读取'}</p>
                    <p className="history-date">点击尝试从备份恢复</p>
                    <p className="history-date">最后修改：{formatDateTime(summary.updatedAt)}</p>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="history-card-main"
                    aria-label={`打开项目：${summary.name}`}
                    onClick={() => onOpenProject(summary.id)}
                  >
                    <div className="history-card-heading">
                      <h2>{summary.name}</h2>
                      <span className="history-total">{formatYuan(summary.totalCents)}</span>
                    </div>
                    <p className="history-meta">
                      {summary.peopleCount} 人 · {summary.activityCount} 个活动
                    </p>
                    <p className="history-date">最后修改：{formatDateTime(summary.updatedAt)}</p>
                  </button>
                )}
                <div className="history-card-actions">
                  <Button
                    variant="ghost"
                    className="icon-button icon-button--danger"
                    aria-label={`删除项目：${summary.name}`}
                    onClick={() => setDeleteTarget(summary)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除项目？"
        description={
          deleteTarget
            ? `将把“${deleteTarget.name}”移入 Windows 回收站。历史列表中将不再显示，但需要时仍可从回收站恢复。`
            : ''
        }
        confirmLabel="移入回收站"
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </main>
  );
}
