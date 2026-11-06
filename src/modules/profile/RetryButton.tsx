import type { CSSProperties } from 'react';

/**
 * The organiser page's one "Try again" (fix round 1, review LOW-6): while the
 * refetch runs it is disabled and reads "Trying&hellip;", so a second tap cannot
 * fire a second request and the person sees it is working. 44px tall always
 * (explicit px: html is ~13.5px on phones, so rem tap targets render small).
 */
export function RetryButton({ onRetry, pending, style }: { onRetry: () => void; pending: boolean; style?: CSSProperties }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={pending}
      aria-busy={pending || undefined}
      style={{ minHeight: 44, padding: '0 12px', background: 'none', border: 'none', color: '#E7BE6E', fontSize: 14, fontWeight: 700, cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.7 : 1, ...style }}
    >
      {pending ? <>Trying&hellip;</> : 'Try again'}
    </button>
  );
}
