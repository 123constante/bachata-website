import { useRef, useState } from 'react';
import { shareLinkOf } from '../data/analyticsV2';
import { SHARE_REASONS, liveEventOf, shareStateOf } from '../data/shareState';
import { useP3Home, useP3ShareCode } from '../data/useP3Data';
import { RetryButton } from './parts';

/** The page's share link for its next live event, with a Copy link control. */
export function ShareLinkCard({ pageId }: { pageId?: string | null }) {
  const home = useP3Home();
  const org = home.data?.organisers.find((o) => o.id === pageId) ?? undefined;
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
  const next = liveEventOf(home.data, org);
  const state = shareStateOf({ pending: code.isPending, data: code.data }, next);
  const reason = state === 'ready' ? null : SHARE_REASONS[state];
  const link = state === 'ready' && next && code.data?.code ? shareLinkOf(window.location.origin, next.id, code.data.code) : '';

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
