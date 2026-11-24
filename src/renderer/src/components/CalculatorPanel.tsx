import { X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { formatYuan, parseMoneyToCents } from '@shared/money';
import { calculateAmountExpression } from '../lib/calculator';

export interface CalculatorPanelProps {
  label: string;
  initialValue: string;
  onApply: (amount: string) => void;
  onClose: () => void;
}

type Key =
  | { kind: 'digit'; label: string }
  | { kind: 'operator'; label: string; aria: string; value: string }
  | { kind: 'paren'; label: string; aria: string; value: '(' | ')' }
  | { kind: 'decimal'; label: string }
  | { kind: 'clear' }
  | { kind: 'backspace' }
  | { kind: 'apply' };

const keys: Key[][] = [
  [
    { kind: 'clear' },
    { kind: 'paren', label: '(', aria: '左括号', value: '(' },
    { kind: 'paren', label: ')', aria: '右括号', value: ')' },
    { kind: 'operator', label: '÷', aria: '除', value: '/' },
  ],
  [
    { kind: 'digit', label: '7' },
    { kind: 'digit', label: '8' },
    { kind: 'digit', label: '9' },
    { kind: 'operator', label: '×', aria: '乘', value: '*' },
  ],
  [
    { kind: 'digit', label: '4' },
    { kind: 'digit', label: '5' },
    { kind: 'digit', label: '6' },
    { kind: 'operator', label: '−', aria: '减', value: '-' },
  ],
  [
    { kind: 'digit', label: '1' },
    { kind: 'digit', label: '2' },
    { kind: 'digit', label: '3' },
    { kind: 'operator', label: '+', aria: '加', value: '+' },
  ],
  [
    { kind: 'digit', label: '0' },
    { kind: 'decimal', label: '.' },
    { kind: 'backspace' },
    { kind: 'apply' },
  ],
];

function initialExpression(value: string): string {
  return value.normalize('NFKC').replace(/[,\s¥￥]/g, '');
}

function openParenCount(expression: string): number {
  let count = 0;
  for (const character of expression) {
    if (character === '(') count += 1;
    if (character === ')') count -= 1;
  }
  return count;
}

function formatPreview(amount: string): string {  const cents = parseMoneyToCents(amount);
  return cents === null ? `¥${amount}` : formatYuan(cents);
}

export default function CalculatorPanel({
  label,
  initialValue,
  onApply,
  onClose,
}: CalculatorPanelProps) {
  const [expression, setExpression] = useState(() => initialExpression(initialValue));
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const preview = expression.trim() ? calculateAmountExpression(expression) : null;

  const changeExpression = (updater: (current: string) => string) => {
    setExpression(updater);
    setError(null);
  };

  const append = (text: string) => changeExpression((current) => current + text);

  const pressOperator = (operator: string) => {
    changeExpression((current) => {
      if (!current) return operator === '-' ? '-' : current;
      const last = current.at(-1) ?? '';
      if (last === '(') return operator === '-' ? `${current}-` : current;
      if ('+-*/'.includes(last)) return `${current.slice(0, -1)}${operator}`;
      if (last === '.') return `${current}0${operator}`;
      if (last === ')') return `${current}${operator}`;
      return `${current}${operator}`;
    });
  };

  const pressDecimal = () => {
    changeExpression((current) => {
      const lastNumber = current.split(/[+\-*/()]/).at(-1) ?? '';
      if (lastNumber.includes('.')) return current;
      const last = current.at(-1) ?? '';
      if (!current || '+-*/('.includes(last)) return `${current}0.`;
      if (last === ')') return current;
      return `${current}.`;
    });
  };

  const pressParen = (paren: '(' | ')') => {
    changeExpression((current) => {
      if (paren === '(') {
        if (!current) return '(';
        const last = current.at(-1) ?? '';
        return /[0-9.)]/.test(last) ? current : `${current}(`;
      }

      if (openParenCount(current) <= 0) return current;
      const last = current.at(-1) ?? '';
      return !last || '+-*/.('.includes(last) ? current : `${current})`;
    });
  };

  const pressBackspace = () => {
    changeExpression((current) => current.slice(0, -1));
  };

  const apply = () => {
    const result = calculateAmountExpression(expression);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onApply(result.amount);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (
      event.target instanceof HTMLButtonElement &&
      (event.key === 'Enter' || event.key === ' ')
    ) {
      return;
    }

    if (event.key === 'Enter' || event.key === '=') {
      event.preventDefault();
      apply();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      pressBackspace();
      return;
    }
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      append(event.key);
      return;
    }
    if (event.key === '.') {
      event.preventDefault();
      pressDecimal();
      return;
    }
    if (event.key === '+' || event.key === '-' || event.key === '*' || event.key === '/') {
      event.preventDefault();
      pressOperator(event.key);
      return;
    }
    if (event.key === 'x' || event.key === 'X') {
      event.preventDefault();
      pressOperator('*');
      return;
    }
    if (event.key === '(' || event.key === ')') {
      event.preventDefault();
      pressParen(event.key);
    }
  };

  return (
    <div
      ref={panelRef}
      className="calculator-panel"
      role="dialog"
      aria-label={`计算器：${label}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="calculator-header">
        <span>计算器</span>
        <button
          type="button"
          className="calculator-close"
          aria-label="关闭计算器"
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="calculator-display">
        <div className="calculator-expression" aria-label="计算器表达式">
          {expression || '0'}
        </div>
        <div className="calculator-result" aria-live="polite">
          {error ? (
            <span className="calculator-error" role="alert">
              {error}
            </span>
          ) : preview?.ok ? (
            `= ${formatPreview(preview.amount)}`
          ) : (
            <span className="calculator-placeholder">输入算式后按 =</span>
          )}
        </div>
      </div>

      <div
        className="calculator-grid"
        onMouseDown={(event) => {
          if ((event.target as HTMLElement).closest('button')) {
            event.preventDefault();
          }
        }}
      >
        {keys.flat().map((key, index) => {
          if (key.kind === 'digit') {
            return (
              <button
                type="button"
                className="calculator-key"
                key={`${key.label}-${index}`}
                onClick={() => append(key.label)}
              >
                {key.label}
              </button>
            );
          }
          if (key.kind === 'operator') {
            return (
              <button
                type="button"
                className="calculator-key calculator-key--operator"
                key={`${key.label}-${index}`}
                aria-label={key.aria}
                onClick={() => pressOperator(key.value)}
              >
                {key.label}
              </button>
            );
          }
          if (key.kind === 'paren') {
            return (
              <button
                type="button"
                className="calculator-key calculator-key--utility"
                key={`${key.label}-${index}`}
                aria-label={key.aria}
                onClick={() => pressParen(key.value)}
              >
                {key.label}
              </button>
            );
          }
          if (key.kind === 'decimal') {
            return (
              <button
                type="button"
                className="calculator-key"
                key="decimal"
                aria-label="小数点"
                onClick={pressDecimal}
              >
                .
              </button>
            );
          }
          if (key.kind === 'clear') {
            return (
              <button
                type="button"
                className="calculator-key calculator-key--utility"
                key="clear"
                aria-label="清空"
                onClick={() => {
                  setExpression('');
                  setError(null);
                }}
              >
                C
              </button>
            );
          }
          if (key.kind === 'backspace') {
            return (
              <button
                type="button"
                className="calculator-key calculator-key--utility"
                key="backspace"
                aria-label="退格"
                onClick={pressBackspace}
              >
                ⌫
              </button>
            );
          }
          return (
            <button
              type="button"
              className="calculator-key calculator-key--equals"
              key="apply"
              aria-label="等于"
              onClick={apply}
            >
              =
            </button>
          );
        })}
      </div>
    </div>
  );
}
