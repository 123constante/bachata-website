import { useState, type CSSProperties, type ReactNode } from 'react';
import { addChip, LIST_ITEM_MAX } from '../me/model';

/** Form building blocks for the Edit screen. 16px text stops iOS zooming; every target >= 44px; sizes in px. */

export const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 48,
  boxSizing: 'border-box',
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--da-border)',
  background: 'var(--da-surface-2)',
  color: 'var(--da-text)',
  fontSize: 16,
};

export const Field = ({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) => (
  <div data-testid={`field-${id}`} style={{ display: 'grid', gap: 4 }}>
    <label htmlFor={id} style={{ fontSize: 14, fontWeight: 700 }}>
      {label}
      {hint && <span className="da-muted" style={{ fontWeight: 400 }}> {hint}</span>}
    </label>
    {children}
    {error && (
      <p id={`${id}-error`} role="alert" data-testid={`error-${id}`} style={{ fontSize: 13, margin: 0, color: 'var(--da-danger)' }}>
        {error}
      </p>
    )}
  </div>
);

export const TextInput = ({
  id,
  value,
  onChange,
  error,
  type = 'text',
  inputMode,
  placeholder,
  maxLength,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  type?: string;
  inputMode?: 'text' | 'url' | 'tel';
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
}) => (
  <input
    id={id}
    type={type}
    inputMode={inputMode}
    value={value}
    placeholder={placeholder}
    maxLength={maxLength}
    autoComplete={autoComplete ?? 'off'}
    aria-invalid={error ? true : undefined}
    aria-describedby={error ? `${id}-error` : undefined}
    onChange={(e) => onChange(e.target.value)}
    style={{ ...inputStyle, borderColor: error ? 'var(--da-danger)' : 'var(--da-border)' }}
  />
);

const chipStyle = (on: boolean): CSSProperties => ({
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 999,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  border: `1px solid ${on ? 'var(--da-accent)' : 'var(--da-border)'}`,
  background: on ? 'var(--da-accent)' : 'transparent',
  color: on ? 'var(--da-on-accent)' : 'var(--da-text)',
});

/** Chips. `multi` toggles each; single toggles the one (pressing the chosen chip again clears it). */
export const ChipChoice = <T extends string | number>({
  id,
  options,
  selected,
  onToggle,
}: {
  id: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  selected: ReadonlyArray<T>;
  onToggle: (value: T) => void;
}) => (
  <div id={id} role="group" aria-labelledby={undefined} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
    {options.map((o) => {
      const on = selected.includes(o.value);
      return (
        <button key={String(o.value)} type="button" aria-pressed={on} data-testid={`${id}-${String(o.value)}`} style={chipStyle(on)} onClick={() => onToggle(o.value)}>
          {o.label}
        </button>
      );
    })}
  </div>
);

/** Chips input: type, press Enter / comma / Add; each chip has a remove button. Trimmed, deduped, capped. */
export const ChipListInput = ({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) => {
  const [text, setText] = useState('');
  const commit = (raw: string) => {
    const next = addChip(value, raw);
    if (next !== value) onChange(next);
    setText('');
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {value.length > 0 && (
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', margin: 0, padding: 0 }} data-testid={`${id}-chips`}>
          {value.map((item) => (
            <li key={item}>
              <button
                type="button"
                aria-label={`Remove ${item}`}
                style={{ ...chipStyle(true), background: 'var(--da-surface-2)', color: 'var(--da-text)', borderColor: 'var(--da-border)', overflowWrap: 'anywhere' }}
                onClick={() => onChange(value.filter((x) => x !== item))}
              >
                {item} &times;
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id={id}
          value={text}
          maxLength={LIST_ITEM_MAX}
          placeholder={placeholder}
          autoComplete="off"
          style={inputStyle}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(',')) commit(v.slice(0, -1));
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(text);
            }
          }}
          onBlur={() => text.trim() !== '' && commit(text)}
        />
        <button type="button" style={{ ...chipStyle(false), minWidth: 64 }} onClick={() => commit(text)} data-testid={`${id}-add`}>
          Add
        </button>
      </div>
    </div>
  );
};
