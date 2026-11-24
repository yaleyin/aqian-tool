import { AlertCircle, Check, LoaderCircle, RotateCcw } from 'lucide-react';
import Button from './Button';

export interface SaveStatusProps {
  state: 'idle' | 'saving' | 'saved' | 'error';
  savedAt: string | null;
  error: string | null;
  onRetry: () => void;
  onRestore?: () => void;
}

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
});

function formatSavedAt(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : timeFormatter.format(date);
}

export default function SaveStatus({
  state,
  savedAt,
  error,
  onRetry,
  onRestore,
}: SaveStatusProps) {
  if (state === 'idle') {
    return <span className="save-status" aria-live="polite" />;
  }

  if (state === 'saving') {
    return (
      <span className="save-status save-status--saving" role="status" aria-live="polite">
        <LoaderCircle className="spin" size={16} aria-hidden="true" />
        保存中…
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className="save-status save-status--error" role="status" aria-live="polite">
        <AlertCircle size={16} aria-hidden="true" />
        <span>保存失败{error ? `：${error}` : ''}</span>
        <Button variant="ghost" size="sm" onClick={onRetry}>
          <RotateCcw size={14} aria-hidden="true" />
          重试
        </Button>
        {onRestore ? (
          <Button variant="secondary" size="sm" onClick={onRestore}>
            恢复上次保存
          </Button>
        ) : null}
      </span>
    );
  }

  const time = formatSavedAt(savedAt);
  return (
    <span className="save-status save-status--saved" role="status" aria-live="polite">
      <Check size={16} aria-hidden="true" />
      已保存{time ? ` ${time}` : ''}
    </span>
  );
}
