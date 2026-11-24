import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project } from '@shared/types';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface ProjectEditor {
  project: Project | null;
  loading: boolean;
  loadError: string | null;
  recoveredFromBackup: boolean;
  saveState: SaveState;
  saveError: string | null;
  savedAt: string | null;
  mutate: (updater: (project: Project) => Project) => void;
  retrySave: () => void;
  flushSaves: () => Promise<{ ok: boolean; error: string | null }>;
  rollbackToSaved: () => void;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useProjectEditor(projectId: string): ProjectEditor {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recoveredFromBackup, setRecoveredFromBackup] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const projectRef = useRef<Project | null>(null);
  const lastSavedProjectRef = useRef<Project | null>(null);
  const revisionRef = useRef(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const saveStateRef = useRef<SaveState>('idle');
  const saveErrorRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    revisionRef.current += 1;
    projectRef.current = null;
    lastSavedProjectRef.current = null;
    saveStateRef.current = 'idle';
    saveErrorRef.current = null;
    setProject(null);
    setLoading(true);
    setLoadError(null);
    setRecoveredFromBackup(false);
    setSaveState('idle');
    setSaveError(null);
    setSavedAt(null);

    window.aqian
      .loadProject(projectId)
      .then((result) => {
        if (!active) return;
        projectRef.current = result.project;
        lastSavedProjectRef.current = result.project;
        saveStateRef.current = 'saved';
        saveErrorRef.current = null;
        setProject(result.project);
        setRecoveredFromBackup(result.recoveredFromBackup);
        setSavedAt(result.project.updatedAt);
        setSaveState('saved');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(messageOf(error, '项目文件无法读取'));
        saveStateRef.current = 'idle';
        setSaveState('idle');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  const persist = useCallback((next: Project) => {
    const revision = ++revisionRef.current;
    saveStateRef.current = 'saving';
    saveErrorRef.current = null;
    setSaveState('saving');
    setSaveError(null);

    queueRef.current = queueRef.current.then(async () => {
      try {
        const saved = await window.aqian.saveProject(next);
        if (revision === revisionRef.current) {
          lastSavedProjectRef.current = saved;
          saveStateRef.current = 'saved';
          saveErrorRef.current = null;
          setProject((current) =>
            current ? { ...current, updatedAt: saved.updatedAt } : current,
          );
          setSavedAt(saved.updatedAt);
          setSaveState('saved');
        }
      } catch (error) {
        if (revision === revisionRef.current) {
          const message = messageOf(error, '保存失败');
          saveStateRef.current = 'error';
          saveErrorRef.current = message;
          setSaveError(message);
          setSaveState('error');
        }
      }
    });
  }, []);

  const mutate = useCallback(
    (updater: (current: Project) => Project) => {
      const current = projectRef.current;
      if (!current) return;
      const next = updater(current);
      projectRef.current = next;
      setProject(next);
      persist(next);
    },
    [persist],
  );

  const retrySave = useCallback(() => {
    const current = projectRef.current;
    if (current) persist(current);
  }, [persist]);

  const flushSaves = useCallback(async () => {
    await queueRef.current;
    return {
      ok: saveStateRef.current !== 'error',
      error: saveErrorRef.current,
    };
  }, []);

  const rollbackToSaved = useCallback(() => {
    const lastSaved = lastSavedProjectRef.current;
    if (!lastSaved) return;

    revisionRef.current += 1;
    projectRef.current = lastSaved;
    saveStateRef.current = 'saved';
    saveErrorRef.current = null;
    setProject(lastSaved);
    setSavedAt(lastSaved.updatedAt);
    setSaveError(null);
    setSaveState('saved');
  }, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (saveStateRef.current === 'saving' || saveStateRef.current === 'error') {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  return {
    project,
    loading,
    loadError,
    recoveredFromBackup,
    saveState,
    saveError,
    savedAt,
    mutate,
    retrySave,
    flushSaves,
    rollbackToSaved,
  };
}
