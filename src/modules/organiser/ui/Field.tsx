import type { ReactNode } from 'react';

/** The text input / textarea look: card2, radius 12, 16px text (no iOS zoom), 3:1 border, gold on focus. */
export const FIELD_CLASS =
  'block w-full rounded-[12px] border border-[var(--line-strong)] bg-[var(--card2)] px-[12px] text-[16px] text-[var(--fg)] outline-none placeholder:text-[var(--ph)] focus-visible:border-[var(--gold)]';

export interface FieldProps {
  label: string;
  /** id of the input this label names. */
  htmlFor?: string;
  /** Plain hint under the input (replaced by `error` when there is one). */
  help?: string;
  error?: string | null;
  children: ReactNode;
  testId?: string;
}

/** Label + input + hint or error. The error is role=alert so it is read out. */
export function Field({ label, htmlFor, help, error, children, testId }: FieldProps) {
  const noteId = testId ? `${testId}-error` : htmlFor ? `${htmlFor}-help` : undefined;
  return (
    <div className="space-y-[4px]" data-testid={testId}>
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-[var(--mut)]">{label}</label>
      {children}
      {error ? (
        <p role="alert" className="text-[13px] text-[var(--danger)]" data-testid={noteId}>{error}</p>
      ) : help ? (
        <p className="text-[13px] text-[var(--mut)]" data-testid={htmlFor ? `${htmlFor}-help` : undefined}>{help}</p>
      ) : null}
    </div>
  );
}
