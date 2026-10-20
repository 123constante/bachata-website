import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { Chip, FIELD_CLASS, GhostButton } from '@/modules/organiser/ui';
import { LIST_ITEM_MAX, LIST_MAX_ITEMS, YEARS_MAX, type RoleField } from './fieldRegistry';
import type { DraftValue } from './roleModel';

// One input per field kind, shared by the profile form and the wizard steps.

export interface FieldInputProps {
  field: RoleField;
  id: string;
  value: DraftValue;
  onChange(value: DraftValue): void;
  disabled?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}

export function YesNoInput({ value, onChange, disabled, label }: { value: boolean | null; onChange(v: boolean | null): void; disabled?: boolean; label: string }) {
  // Tapping the chosen answer again clears it: every field stays optional.
  return (
    <div role="group" aria-label={label} className="flex gap-[8px]">
      <Chip selected={value === true} disabled={disabled} onToggle={() => onChange(value === true ? null : true)}>Yes</Chip>
      <Chip selected={value === false} disabled={disabled} onToggle={() => onChange(value === false ? null : false)}>No</Chip>
    </div>
  );
}

export function ListInput({ id, value, onChange, disabled, describedBy, label, autoFocus }: { id: string; value: string[]; onChange(v: string[]): void; disabled?: boolean; describedBy?: string; label: string; autoFocus?: boolean }) {
  const [text, setText] = useState('');
  const noteId = useId();
  const term = text.trim();
  const full = value.length >= LIST_MAX_ITEMS;
  const duplicate = term !== '' && value.some((v) => v.toLowerCase() === term.toLowerCase());
  const reason = full
    ? `You have added the most this list holds (${LIST_MAX_ITEMS}). Remove one to add another.`
    : duplicate
      ? `${term} is already in the list.`
      : null;
  const add = () => {
    if (term === '' || full || duplicate) return;
    onChange([...value, term]);
    setText('');
  };
  return (
    <div className="space-y-[8px]">
      <div className="flex gap-[8px]">
        <input
          id={id}
          className={`${FIELD_CLASS} h-[48px] min-w-0 flex-1`}
          value={text}
          maxLength={LIST_ITEM_MAX}
          disabled={disabled || full}
          autoFocus={autoFocus}
          aria-describedby={[describedBy, reason ? noteId : undefined].filter(Boolean).join(' ') || undefined}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <GhostButton block={false} size="sm" className="h-[48px] shrink-0" disabled={disabled || term === '' || full || duplicate} onClick={add} aria-label={`Add to ${label}`}>
          Add
        </GhostButton>
      </div>
      {reason && <p id={noteId} className="text-[13px] text-[var(--mut)]">{reason}</p>}
      {value.length > 0 && (
        <ul aria-label={label} className="flex flex-wrap gap-[8px]">
          {value.map((item) => (
            <li key={item} className="inline-flex min-h-[44px] items-center rounded-[8px] border border-[var(--line-strong)] bg-[var(--card2)] pl-[12px] text-[14px]">
              <span className="break-all">{item}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${item}`}
                className="flex h-[44px] w-[44px] items-center justify-center text-[var(--mut)]"
                onClick={() => onChange(value.filter((v) => v !== item))}
              >
                <X aria-hidden="true" className="h-[16px] w-[16px]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FieldInput({ field, id, value, onChange, disabled, describedBy, autoFocus }: FieldInputProps) {
  switch (field.kind) {
    case 'list':
      return <ListInput id={id} label={field.label} value={Array.isArray(value) ? value : []} onChange={onChange} disabled={disabled} describedBy={describedBy} autoFocus={autoFocus} />;
    case 'yesno':
      return <YesNoInput label={field.label} value={typeof value === 'boolean' ? value : null} onChange={onChange} disabled={disabled} />;
    case 'longtext':
      return (
        <textarea
          id={id}
          className={`${FIELD_CLASS} min-h-[112px] py-[10px]`}
          value={typeof value === 'string' ? value : ''}
          maxLength={field.max}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'years':
      return (
        <input
          id={id}
          className={`${FIELD_CLASS} h-[48px] w-[120px]`}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={String(YEARS_MAX).length}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <input
          id={id}
          className={`${FIELD_CLASS} h-[48px]`}
          type={field.kind === 'link' ? 'url' : 'text'}
          inputMode={field.kind === 'link' ? 'url' : undefined}
          autoCapitalize={field.kind === 'link' ? 'off' : undefined}
          maxLength={field.max}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
