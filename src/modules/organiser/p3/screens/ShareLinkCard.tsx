import { useRef, useState } from 'react';
import { londonTodayKey } from '@/lib/londonDate';
import { shareLinkOf } from '../data/analyticsV2';
import { nextUpOf, rowsOf } from '../data/home';
import { useP3Home, useP3ShareCode } from '../data/useP3Data';
import { RetryButton } from './parts';

const SHARE_REASONS = {
  off: 'Your link is switched off. Ask the team.',
  noEvent: 'Add an event to get a link',
  loading: 'Getting your link\u2026',
} as const;

/** The page's share link for its next live event, with a Copy link control. */
export function ShareLinkCard() {
  const home = useP3Home();
  const org = home.data?.organisers[0];
  const code = useP3ShareCode(org?.id);
  const field = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!org || !home.data) return null;
  if (code.isError) {
    return (
      <div className="p3-card p3-state" data-testid="p3-share-link-card" role="alert">
        <strong>We couldn&rsquo;t get your link</strong>
        <p>Check your connection, then try again.</p>
        <RetryButton onClick={() => void code.refetch()} />
      </div>
    );
  }
  const today = home.data.today || londonTodayKey();
  const next = nextUpOf(rowsOf({ ...home.data, today, organisers: [org] }));
  const usable = code.data?.code && !code.data.disabled ? code.data.code : null;
  const reason = code.isPending ? SHARE_REASONS.loading : !usable ? SHARE_REASONS.off : !next ? SHARE_REASONS.noEvent : null;
  const link = usable && next ? shareLinkOf(window.location.origin, next.id, usable) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setNote('Link copied.');
    } catch {
      field.current?.focus();
      field.current?.select();
      setNote('Copy didn\u2019t work. The link is selected, so copy it from there.');
    }
  };

  return (
    <div className="p3-card p3-state" data-testid="p3-share-link-card">
      <strong>Your link</strong>
      <p>Anyone who opens this link is counted as coming from you.</p>
      {link && (
        <input ref={field} readOnly value={link} aria-label="Your link" data-testid="p3-share-link-text" onFocus={(e) => e.currentTarget.select()} style={{ width: '100%', minHeight: 44, boxSizing: 'border-box' }} />
      )}
      <button type="button" className="p3-btn p3-btn-line" style={{ minHeight: 44 }} disabled={!!reason} onClick={() => void copy()} data-testid="p3-share-copy">
        Copy link
      </button>
      {reason && <p data-testid="p3-share-reason">{reason}</p>}
      {note && <p role="status" data-testid="p3-share-note">{note}</p>}
    </div>
  );
}
