import { Calculator } from 'lucide-react';
import { useRef, type KeyboardEventHandler } from 'react';
import CalculatorPanel from './CalculatorPanel';

export interface MoneyInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  calculatorOpen: boolean;
  onCalculatorOpenChange: (open: boolean) => void;
  autoFocus?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}

export default function MoneyInput({
  id,
  label,
  value,
  onChange,
  calculatorOpen,
  onCalculatorOpenChange,
  autoFocus,
  onKeyDown,
}: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = `calculator-${id}`;

  const closeCalculator = (focusInput = false) => {
    onCalculatorOpenChange(false);
    queueMicrotask(() => {
      if (focusInput) {
        inputRef.current?.focus();
      } else {
        triggerRef.current?.focus();
      }
    });
  };

  const applyAmount = (amount: string) => {
    onChange(amount);
    closeCalculator(true);
  };

  return (
    <div className="form-field money-input-field">
      <label htmlFor={id}>{label}</label>
      <div className="money-input-wrap">
        <input
          ref={inputRef}
          id={id}
          className="text-input money-input"
          inputMode="decimal"
          value={value}
          placeholder="0.00"
          autoFocus={autoFocus}
          aria-controls={calculatorOpen ? panelId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          ref={triggerRef}
          type="button"
          className="calculator-trigger"
          aria-label={`打开计算器：${label}`}
          aria-expanded={calculatorOpen}
          aria-haspopup="dialog"
          aria-controls={calculatorOpen ? panelId : undefined}
          onClick={() => {
            if (calculatorOpen) {
              closeCalculator();
            } else {
              onCalculatorOpenChange(true);
            }
          }}
        >
          <Calculator size={18} aria-hidden="true" />
        </button>
      </div>

      {calculatorOpen ? (
        <div id={panelId}>
          <CalculatorPanel
            label={label}
            initialValue={value}
            onApply={applyAmount}
            onClose={() => closeCalculator()}
          />
        </div>
      ) : null}
    </div>
  );
}
