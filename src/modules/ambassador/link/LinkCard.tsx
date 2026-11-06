import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLinkTracker, setLinkActive, trackerKey } from '../ambassadorApi';
import { cardModel, linkUrl, switchError, type TrackerLink } from './trackerModel';

const btn = 'min-h-[44px] rounded-[10px] border border-border bg-secondary px-3.5 py-2 text-[14px] font-semibold disabled:opacity-50';

interface CardProps {
  link: TrackerLink;
  isAdmin: boolean;
  showWho: boolean;
  busy: boolean;
  error: string | null;
  onSwitch: (next: boolean) => void;
}

/** One link: copy, share, switch on/off (with a confirm sentence), and the two counts. Pure of data fetching. */
export function LinkCard({ link, isAdmin, showWho, busy, error, onSwitch }: CardProps) {
  const m = cardModel(link, isAdmin, showWho);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const url = linkUrl(window.location.origin, link.code);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };
  const share = () => {
    // A dismissed share sheet rejects: that is a choice, not an error.
    void Promise.resolve(navigator.share({ url, title: m.title })).catch(() => undefined);
  };

  return (
    <section className="rounded-[12px] border border-border bg-card p-3" data-testid="link-card" aria-label={m.title}>
      <h2 className="m-0 text-[15px] font-semibold leading-tight">{m.title}</h2>
      <div className="mt-2 flex gap-2 text-[14px]" data-testid="link-counts">
        <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold" data-testid="link-joined">{m.joinedLabel}</span>
        <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold" data-testid="link-cityset">{m.cityLabel}</span>
      </div>
      {m.empty && <p className="m-0 mt-2 text-[14px] text-muted-foreground" data-testid="link-empty">{m.empty}</p>}
      {m.note && <p className="m-0 mt-2 text-[14px] text-muted-foreground" data-testid="link-note">{m.note}</p>}
      {m.canCopy && <p className="m-0 mt-2 break-all text-[12px] text-muted-foreground" data-testid="link-url">{url}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {m.canCopy && (
          <button type="button" className={btn} onClick={() => void copy()}>
            {copied === 'ok' ? 'Copied' : 'Copy link'}
          </button>
        )}
        {m.canCopy && canShare && (
          <button type="button" className={btn} onClick={share}>Share</button>
        )}
        {m.toggle && !confirming && (
          <button
            type="button"
            className={btn}
            disabled={busy || m.toggle.disabledReason !== null}
            aria-describedby={m.toggle.disabledReason ? `why-${link.link_id}` : undefined}
            onClick={() => setConfirming(true)}
          >
            {m.toggle.label}
          </button>
        )}
      </div>
      {copied === 'fail' && <p role="status" className="m-0 mt-2 text-[13px] text-destructive">Could not copy. Select the link above and copy it by hand.</p>}
      {m.toggle?.disabledReason && (
        <p id={`why-${link.link_id}`} className="m-0 mt-2 text-[13px] text-muted-foreground" data-testid="switch-reason">{m.toggle.disabledReason}</p>
      )}
      {m.toggle && confirming && (
        <div className="mt-2 rounded-[10px] border border-border p-2.5" data-testid="switch-confirm">
          <p className="m-0 text-[14px]">{m.toggle.confirm}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={btn} disabled={busy} onClick={() => { onSwitch(m.toggle!.next); setConfirming(false); }}>
              {m.toggle.label}
            </button>
            <button type="button" className={btn} onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="m-0 mt-2 text-[13px] text-destructive" data-testid="switch-error">{error}</p>}
    </section>
  );
}

/** Reads the tracker; renders nothing while loading, on a read error, or when the person has no link. */
export function LinkSection({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const key = trackerKey(userId);
  const tracker = useQuery({ queryKey: key, enabled: !!userId, queryFn: fetchLinkTracker });
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const sw = useMutation({
    mutationFn: (v: { id: string; next: boolean }) => setLinkActive(v.id, v.next),
    onSuccess: () => {
      setError(null);
      return qc.invalidateQueries({ queryKey: key });
    },
    onError: (err, v) => setError({ id: v.id, text: switchError(err) }),
  });
  const links = tracker.data ?? [];
  if (links.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 px-3 pt-3" data-testid="link-section">
      {links.map((l) => (
        <LinkCard
          key={l.link_id}
          link={l}
          isAdmin={isAdmin}
          showWho={links.length > 1}
          busy={sw.isPending}
          error={error?.id === l.link_id ? error.text : null}
          onSwitch={(next) => sw.mutate({ id: l.link_id, next })}
        />
      ))}
    </div>
  );
}
