// =============================================================================
// InstagramInput -- the ONE Instagram field. Takes @name, a name or a pasted
// profile link; shows the bare name it will save and a "tap to check it's you"
// link. The rule is src/lib/instagramHandle.ts (the server's own, by fixture).
// The box holds what the person typed; the caller saves checkInstagramField's
// handle. A stored legacy value (a full link, a 34-character name) is shown as
// it is and only checked once it is edited, so it never blocks another save.
// =============================================================================

import React, { useId } from 'react';
import { cn } from '@/lib/utils';
import { FIELD_CLASS } from '@/modules/organiser/ui';
import { checkInstagramField, instagramProfileUrl } from '@/lib/instagramHandle';

export interface InstagramInputProps {
  id?: string;
  /** What is in the box (starts as the stored value). */
  value: string;
  onChange: (raw: string) => void;
  /** The stored value: while the box still equals it, nothing is checked or shown. */
  stored?: string | null;
  /** A refusal from the server or the form, shown as an alert. */
  error?: string | null;
  /** False when the caller renders the error itself under the id `<id>-error` (the box still points at it). */
  renderError?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Extra ids for aria-describedby (a hint line the caller renders). */
  describedBy?: string;
  onEnter?: () => void;
  testId?: string;
}

export const InstagramInput: React.FC<InstagramInputProps> = ({
  id: idProp,
  value,
  onChange,
  stored = null,
  error = null,
  renderError = true,
  disabled,
  autoFocus,
  describedBy,
  onEnter,
  testId = 'instagram-input',
}) => {
  const fallback = useId();
  const id = idProp ?? fallback;
  const untouched = (stored ?? '') === value;
  const check = untouched ? null : checkInstagramField(value);
  const localError = check && 'error' in check ? check.error : null;
  const handle = check && 'handle' in check ? check.handle : null;
  const shownError = error ?? localError;
  const statusId = `${id}-status`;
  const errorId = `${id}-error`;
  const ids = [describedBy, handle ? statusId : null, shownError ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-[6px]" data-testid={testId}>
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        placeholder="@yourname"
        maxLength={300}
        aria-invalid={shownError ? true : undefined}
        aria-describedby={ids}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
        className={cn(FIELD_CLASS, 'h-[48px]', shownError && 'border-[var(--danger)]')}
      />
      <div aria-live="polite">
        {handle && !shownError && (
          <div id={statusId} data-testid={`${testId}-ok`} className="space-y-[2px] text-[13px]">
            <p className="m-0 text-[var(--ok-fg)]"><span aria-hidden="true">&#10003; </span>@{handle}</p>
            <p className="m-0 text-[var(--mut)]">Saved as {handle}</p>
            <a
              href={instagramProfileUrl(handle)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`${testId}-check`}
              className="inline-flex min-h-[44px] items-center break-all font-semibold text-[var(--gold)] underline underline-offset-4"
            >
              instagram.com/{handle}: tap to check it&rsquo;s you
            </a>
          </div>
        )}
      </div>
      {shownError && renderError && <p id={errorId} role="alert" data-testid={`${testId}-error`} className="m-0 text-[13px] text-[var(--danger)]">{shownError}</p>}
    </div>
  );
};
