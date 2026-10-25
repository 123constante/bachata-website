import { useState, type ReactNode } from 'react';
import { Chip, FIELD_CLASS, Field as BlockField, GhostButton } from '@/modules/organiser/ui';
import { cn } from '@/lib/utils';
import { addChip, LIST_ITEM_MAX } from '../me/model';

/** Form building blocks for the Edit screen, on the rebuild's Field / Chip. 16px text stops iOS zooming; every target >= 44px; sizes in px. */

/** The text input look (the rebuild's FIELD_CLASS) at the 48px height this form has always had. */
export const INPUT_CLASS = `${FIELD_CLASS} min-h-[48px]`;
const inputClass = (error?: string | null) => cn(INPUT_CLASS, error && 'border-[var(--danger)]');

/**
 * Label + control on the rebuild's Field (label, spacing, `field-<id>` wrapper). The error and the calm stored-value
 * note keep their own ids and test ids (`<id>-error`, `error-<id>`, `note-<id>`): the controls point aria-describedby
 * at them, and the block's own error line is keyed on a different id scheme.
 */
export const Field = ({
  id,
  label,
  hint,
  error,
  note,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  /** A calm hint about a stored value (real-data fix F2): not an alert, never shown with an error. */
  note?: string | null;
  children: ReactNode;
}) => (
  <BlockField label={hint ? `${label} ${hint}` : label} htmlFor={id} testId={`field-${id}`}>
    {children}
    {error && (
      <p id={`${id}-error`} role="alert" data-testid={`error-${id}`} className="m-0 text-[13px] text-[var(--danger)]">
        {error}
      </p>
    )}
    {!error && note && (
      <p id={`${id}-note`} data-testid={`note-${id}`} className="m-0 text-[14px] text-[var(--mut)]">
        {note}
      </p>
    )}
  </BlockField>
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
    className={inputClass(error)}
  />
);

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
  <div id={id} role="group" aria-labelledby={undefined} className="flex flex-wrap gap-[8px]">
    {options.map((o) => (
      <Chip key={String(o.value)} selected={selected.includes(o.value)} testId={`${id}-${String(o.value)}`} onToggle={() => onToggle(o.value)}>
        {o.label}
      </Chip>
    ))}
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
    <div className="grid gap-[8px]">
      {value.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-[8px] p-0" data-testid={`${id}-chips`}>
          {value.map((item) => (
            <li key={item}>
              <button
                type="button"
                aria-label={`Remove ${item}`}
                className="min-h-[44px] break-words rounded-[var(--r-chip,8px)] border border-[var(--line-strong)] bg-[var(--card2)] px-[14px] text-[15px] font-semibold text-[var(--fg)]"
                onClick={() => onChange(value.filter((x) => x !== item))}
              >
                {item} &times;
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-[8px]">
        <input
          id={id}
          value={text}
          maxLength={LIST_ITEM_MAX}
          placeholder={placeholder}
          autoComplete="off"
          className={INPUT_CLASS}
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
        <GhostButton size="sm" block={false} className="min-w-[64px]" onClick={() => commit(text)} testId={`${id}-add`}>
          Add
        </GhostButton>
      </div>
    </div>
  );
};
