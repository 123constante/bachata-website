import { useRef, useState } from 'react';
import { isRefusal, shareLinkOf } from '../data/analyticsV2';
import { SHARE_REASONS, liveEventOf, shareStateOf, type ShareState } from '../data/shareState';
import type { P3Row } from '../data/home';
import type { ShareCode } from '../data/analyticsV2';
import { useP3Home, useP3ShareCode } from '../data/useP3Data';
import { RetryButton } from './parts';

export type ShareLinkState = ShareState | 'noRef';

/** shareStateOf, plus 'noRef': a live row with no safe public ref gets no link (a link that 404s is worse than none). Stats reads the same. */
export function shareLinkStateOf(code: { pending: boolean; data: ShareCode | undefined }, live: P3Row | null): ShareLinkState {
  const s = shareStateOf(code, live);
  return s === 'ready' && !live?.publicEventRef ? 'noRef' : s;
}

const LINK_REASONS: Record<Exclude<ShareLinkState, 'ready'>, string> = {
  ...SHARE_REASONS,
  noRef: 'Your event has no public address yet. Ask the team.',
};

/**
 * The page's share link for its next live event, with a Copy link control. The link is built
 * from the row's publicEventRef (slug, or legacy_event_id ?? id), never the series id. Hidden
 * (no Retry) when the share code read is refused; it does not depend on analytics.
 */
export function ShareLinkCard({ pageId }: { pageId?: string | null }) {
  const home = useP3Home();
  const org = home.data?.organisers.find((o) => o.id === pageId) ?? undefined;
  const code = useP3ShareCode(org?.id);
  const field = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);

  const next = org && home.data ? liveEventOf(home.data, org) : null;
  const state = shareLinkStateOf({ pending: code.isPending, data: code.data }, next);
  const link = state === 'ready' && next && code.data?.code ? shareLinkOf(window.location.origin, next.publicEventRef, code.data.code) : '';

  // "Link copied." belongs to the link it copied: clear it when the link or its state changes
  // (reset during render on a key change, not in an effect).
  const noteFor = `${state}|${link}`;
  const [noteKey, setNoteKey] = useState(noteFor);
  if (noteKey !== noteFor) {
    setNoteKey(noteFor);
    setNote(null);
  }

  if (!org || !home.data) return null;
  if (code.isError) {
    if (isRefusal(code.error)) return null;
    return (
      <div className="p3-card p3-state" data-testid="p3-share-link-card" role="alert">
        <strong>We couldn&rsquo;t get your link</strong>
        <p>Check your connection, then try again.</p>
        <RetryButton onClick={() => void code.refetch()} />
      </div>
    );
  }
  const reason = state === 'ready' ? null : LINK_REASONS[state];

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
      {/* opacity 1: the disabled rule's 0.8 took --mut below 4.5:1 (4.50 light, 4.31 dark); at 1 it is 7.5 / 5.8 */}
      <button type="button" className="p3-btn p3-btn-line" style={{ minHeight: 44, opacity: 1 }} disabled={!!reason} onClick={() => void copy()} data-testid="p3-share-copy">
        Copy link
      </button>
      {reason && <p data-testid="p3-share-reason">{reason}</p>}
      {note && <p role="status" data-testid="p3-share-note">{note}</p>}
    </div>
  );
}
