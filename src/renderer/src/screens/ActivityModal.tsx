import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { formatYuan, parseMoneyToCents, splitEqual } from '@shared/money';
import { normalizeName, type ActivityInput } from '@shared/projectOps';
import type { Activity, Person, Share } from '@shared/types';
import Button from '../components/Button';
import Modal from '../components/Modal';
import MoneyInput from '../components/MoneyInput';

export interface ActivityModalProps {
  open: boolean;
  people: Person[];
  activity: Activity | null;
  onClose: () => void;
  onSubmit: (input: ActivityInput) => void;
  onDelete?: () => void;
}

type SplitMode = 'equal' | 'custom';

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function emptyCustomInputs(people: Person[]): Record<string, string> {
  return Object.fromEntries(people.map((person) => [person.id, '']));
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function ActivityModal({
  open,
  people,
  activity,
  onClose,
  onSubmit,
  onDelete,
}: ActivityModalProps) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<SplitMode>('equal');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [totalInput, setTotalInput] = useState('');
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [activeCalculator, setActiveCalculator] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setActiveCalculator(null);

    if (activity?.mode === 'equal') {
      setName(activity.name);
      setMode('equal');
      setSelectedIds(new Set(activity.participantIds));
      setTotalInput(centsToInput(activity.totalCents));
      setCustomInputs(emptyCustomInputs(people));
      return;
    }

    if (activity?.mode === 'custom') {
      const total = activity.shares.reduce((sum, share) => sum + share.amountCents, 0);
      setName(activity.name);
      setMode('custom');
      setSelectedIds(new Set(activity.shares.map((share) => share.personId)));
      setTotalInput(total > 0 ? centsToInput(total) : '');
      setCustomInputs({
        ...emptyCustomInputs(people),
        ...Object.fromEntries(
          activity.shares.map((share) => [share.personId, centsToInput(share.amountCents)]),
        ),
      });
      return;
    }

    setName('');
    setMode('equal');
    setSelectedIds(new Set(people.map((person) => person.id)));
    setTotalInput('');
    setCustomInputs(emptyCustomInputs(people));
  }, [open, activity, people]);

  const selectedPeople = people.filter((person) => selectedIds.has(person.id));
  const parsedTotal = parseMoneyToCents(totalInput);
  const previewShares =
    mode === 'equal' && parsedTotal !== null && parsedTotal > 0 && selectedPeople.length > 0
      ? splitEqual(parsedTotal, selectedPeople.length)
      : [];

  const customTotal = selectedPeople.reduce((sum, person) => {
    const amount = parseMoneyToCents(customInputs[person.id] ?? '');
    return sum + (amount ?? 0);
  }, 0);

  const toggleParticipant = (personId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
    if (activeCalculator === personId) {
      setActiveCalculator(null);
    }
    if (formError) setFormError(null);
  };

  const switchMode = (nextMode: SplitMode) => {
    if (nextMode === mode) return;

    if (nextMode === 'custom') {
      if (parsedTotal !== null && parsedTotal > 0 && selectedPeople.length > 0) {
        const shares = splitEqual(parsedTotal, selectedPeople.length);
        setCustomInputs((current) => {
          const next = { ...current };
          selectedPeople.forEach((person, index) => {
            next[person.id] = centsToInput(shares[index] ?? 0);
          });
          return next;
        });
      }
    } else {
      const sum = selectedPeople.reduce((accumulator, person) => {
        const amount = parseMoneyToCents(customInputs[person.id] ?? '');
        return accumulator + (amount ?? 0);
      }, 0);
      setTotalInput(sum > 0 ? centsToInput(sum) : '');
    }

    setMode(nextMode);
    setFormError(null);
    setActiveCalculator(null);
  };

  const buildInput = (): ActivityInput | null => {
    const activityName = normalizeName(name);
    if (!activityName) {
      setFormError('活动名称不能为空');
      return null;
    }
    if (selectedPeople.length === 0) {
      setFormError('至少选择一名参与人员');
      return null;
    }

    if (mode === 'equal') {
      if (parsedTotal === null) {
        setFormError('请输入有效的活动总额');
        return null;
      }
      if (parsedTotal <= 0) {
        setFormError('活动总额必须大于 0');
        return null;
      }
      return {
        name: activityName,
        mode: 'equal',
        totalCents: parsedTotal,
        participantIds: selectedPeople.map((person) => person.id),
      };
    }

    const shares: Share[] = [];
    let hasPositive = false;

    for (const person of selectedPeople) {
      const amount = parseMoneyToCents(customInputs[person.id] ?? '');
      if (amount === null) {
        setFormError(`请填写${person.name} 的金额`);
        return null;
      }
      if (amount > 0) hasPositive = true;
      shares.push({ personId: person.id, amountCents: amount });
    }

    if (!hasPositive) {
      setFormError('至少填写一笔大于 0 的金额');
      return null;
    }

    return { name: activityName, mode: 'custom', shares };
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = buildInput();
    if (!input) return;

    setFormError(null);
    try {
      onSubmit(input);
    } catch (error) {
      setFormError(messageOf(error, '保存活动失败'));
    }
  };

  const preventComposingEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && event.nativeEvent.isComposing) {
      event.preventDefault();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={activity ? '编辑活动' : '添加活动'}
      footer={
        <>
          {activity ? (
            <Button variant="ghost" className="activity-delete" onClick={() => onDelete?.()}>
              删除活动
            </Button>
          ) : null}
          <Dialog.Close asChild>
            <Button variant="secondary">取消</Button>
          </Dialog.Close>
          <Button type="submit" form="activity-form" variant="primary">
            保存活动
          </Button>
        </>
      }
    >
      <form id="activity-form" className="activity-form" onSubmit={handleSubmit}>
        {formError ? (
          <p className="inline-error form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="form-field">
          <label htmlFor="activity-name">活动名称</label>
          <input
            id="activity-name"
            className="text-input"
            value={name}
            autoFocus
            maxLength={40}
            placeholder="例如：住宿、晚餐、门票"
            onChange={(event) => {
              setName(event.target.value);
              if (formError) setFormError(null);
            }}
            onKeyDown={preventComposingEnter}
          />
        </div>

        <fieldset className="activity-fieldset">
          <legend>参与人员</legend>
          <div className="participant-grid">
            {people.length === 0 ? (
              <p className="field-hint">请先在项目里添加人员。</p>
            ) : (
              people.map((person) => (
                <label className="participant-option" key={person.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(person.id)}
                    onChange={() => toggleParticipant(person.id)}
                  />
                  <span>{person.name}</span>
                </label>
              ))
            )}
          </div>
        </fieldset>

        <fieldset className="activity-fieldset">
          <legend>分摊方式</legend>
          <div className="mode-options">
            <label className="mode-option">
              <input
                type="radio"
                name="split-mode"
                aria-label="均摊"
                checked={mode === 'equal'}
                onChange={() => switchMode('equal')}
              />
              <span>
                <strong>均摊</strong>
                <small>按总额平均分给选中人员</small>
              </span>
            </label>
            <label className="mode-option">
              <input
                type="radio"
                name="split-mode"
                aria-label="独立输入"
                checked={mode === 'custom'}
                onChange={() => switchMode('custom')}
              />
              <span>
                <strong>独立输入</strong>
                <small>逐人填写各自金额</small>
              </span>
            </label>
          </div>
        </fieldset>

        {mode === 'equal' ? (
          <>
            <MoneyInput
              id="activity-total"
              label="活动总额"
              value={totalInput}
              onChange={(value) => {
                setTotalInput(value);
                if (formError) setFormError(null);
              }}
              calculatorOpen={activeCalculator === 'total'}
              onCalculatorOpenChange={(open) =>
                setActiveCalculator(open ? 'total' : null)
              }
              onKeyDown={preventComposingEnter}
            />

            <div className="split-preview">
              <div className="split-preview-heading">
                <span>每人分摊</span>
                <span className="field-hint">除不尽时，前几位多 1 分钱</span>
              </div>
              {parsedTotal !== null && parsedTotal > 0 && selectedPeople.length > 0 ? (
                selectedPeople.map((person, index) => (
                  <div className="split-preview-row" key={person.id}>
                    <span>{person.name}</span>
                    <strong>{formatYuan(previewShares[index] ?? 0)}</strong>
                  </div>
                ))
              ) : (
                <p className="field-hint">输入总额并勾选参与人员后，这里会显示每个人的精确金额。</p>
              )}
            </div>
          </>
        ) : (
          <div className="custom-amounts">
            {selectedPeople.length === 0 ? (
              <p className="field-hint">请先勾选参与人员。</p>
            ) : (
              selectedPeople.map((person) => (
                <MoneyInput
                  key={person.id}
                  id={`activity-amount-${person.id}`}
                  label={`${person.name} 的金额`}
                  value={customInputs[person.id] ?? ''}
                  onChange={(value) => {
                    setCustomInputs((current) => ({
                      ...current,
                      [person.id]: value,
                    }));
                    if (formError) setFormError(null);
                  }}
                  calculatorOpen={activeCalculator === person.id}
                  onCalculatorOpenChange={(open) =>
                    setActiveCalculator(open ? person.id : null)
                  }
                  onKeyDown={preventComposingEnter}
                />
              ))
            )}
            <div className="custom-total">
              <span>活动合计</span>
              <strong>{formatYuan(customTotal)}</strong>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
