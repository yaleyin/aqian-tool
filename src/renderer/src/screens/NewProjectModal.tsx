import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState, type FormEvent } from 'react';
import Button from '../components/Button';
import Modal from '../components/Modal';

export interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export default function NewProjectModal({ open, onClose, onCreate }: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) {
      setError('请输入项目名称');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onCreate(value);
      onClose();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '创建项目失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新建消费项目"
      footer={
        <>
          <Dialog.Close asChild>
            <Button variant="secondary">取消</Button>
          </Dialog.Close>
          <Button type="submit" form="new-project-form" variant="primary" disabled={submitting}>
            {submitting ? '创建中…' : '创建项目'}
          </Button>
        </>
      }
    >
      <form id="new-project-form" className="form-stack" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="project-name">项目名称</label>
          <input
            id="project-name"
            className="text-input"
            value={name}
            autoFocus
            maxLength={40}
            placeholder="例如：云南七日游"
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'project-name-error' : undefined}
          />
          <p className="field-hint">最多 40 个字符，名称不能与已有项目重复。</p>
          {error ? (
            <p id="project-name-error" className="inline-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
