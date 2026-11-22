import { useState, type ReactNode } from 'react';
import { GoingPeopleSheet, organiserNightView, useMyEventGoing, type MyEventGoingNight } from '@/modules/going';
import { Sheet } from '../screens/Sheet';
import { p3GoingOn, p3GoingSlot, p3NightOf } from '../screens/P3Going';
import { RaffleSheet } from '../events/raffle/RaffleSheet';
import { useRaffleNights, rowFor } from '../events/raffle/RaffleParts';
import type { Night } from '../events/eventsModel';
import { V2Sheet } from './V2Sheet';
import { V2 } from './copy';

/** Money as the prototype gbp(): whole pounds with no pence, else 2 decimals. */
export const gbp = (pence: number): string => {
  const p = Number.isFinite(pence) ? Math.max(0, Math.round(pence)) : 0;
  return p % 100 === 0 ? `£${p / 100}` : `£${(p / 100).toFixed(2)}`;
};

const initialOf = (name: string): string => Array.from(name.trim())[0]?.toUpperCase() ?? '';

/** Going card (N-31): up to 3 first-name initials, "+N", "<n> going", chevron. Opens the people list in a sheet. */
function GoingCard({ seriesId, seriesName, occurrenceId }: { seriesId: string; seriesName: string; occurrenceId: string }) {
  const g = useMyEventGoing(seriesId, { bySeries: true });
  const [open, setOpen] = useState<MyEventGoingNight | null>(null);
  if (p3GoingSlot(g.view) !== 'night') return null;
  const night = p3NightOf(g.nights, { occurrenceId });
  if (!night) return null;
  const v = organiserNightView(night);
  if (!v.openable || night.is_cancelled) return null;
  const count = Math.max(night.going_count, night.people.length);
  const faces = night.people.map((p) => initialOf(p.first_name ?? '')).filter(Boolean).slice(0, 3);
  const more = count - faces.length;
  return (
    <>
      <button type="button" className="card going" data-testid="hub-going" aria-haspopup="dialog" onClick={() => setOpen(night)}>
        {faces.length > 0 && (
          <span className="av" aria-hidden="true">
            {faces.map((f, i) => <i key={i}>{f}</i>)}
            {more > 0 && <i>+{more}</i>}
          </span>
        )}
        <b>{V2.goingN(count)}</b>
        <span className="fgo" style={{ marginLeft: 'auto' }} aria-hidden="true">&rsaquo;</span>
      </button>
      {open && (
        <Sheet title={seriesName} onClose={() => setOpen(null)}>
          <GoingPeopleSheet night={open} eventId={seriesId} />
        </Sheet>
      )}
    </>
  );
}

export const entriesPill = (n: number): string => V2.raffleOn(n);

/** Raffle row (N-36): one line, pill On / Off, opens today's RaffleSheet. Nothing while loading; no pill on error. */
function RaffleRow({ night }: { night: Night }) {
  const q = useRaffleNights(night.seriesId);
  const [open, setOpen] = useState(false);
  if (q.isPending) return null;
  const n = q.isError || q.data.kind === 'refused' ? null : rowFor(q.data.read, night);
  const pill = n ? (n.raffleOn ? { text: entriesPill(n.entries), off: false } : { text: V2.raffleOff, off: true }) : null;
  return (
    <div className="fwrap">
      <button type="button" className="fbtn ln" data-testid="hub-raffle" onClick={() => setOpen(true)}>
        <span className="lt">{V2.raffle}</span>
        <span className="lv">{pill && <span className={pill.off ? 'pill off' : 'pill'} data-testid="hub-raffle-pill">{pill.text}</span>}</span>
        <span className="fgo" aria-hidden="true">&rsaquo;</span>
      </button>
      {open && <RaffleSheet night={night} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** SH-SHARE: the link box selects all on tap; Copy link uses the clipboard and says what happened. */
export function ShareSheet({ open, link, onClose, toast }: { open: boolean; link: string; onClose: () => void; toast: (text: string) => void }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast(V2.linkCopied);
    } catch {
      toast(V2.linkBlocked);
    }
  };
  const selectAll = (e: { currentTarget: HTMLElement }) => {
    const sel = window.getSelection?.();
    if (!sel) return;
    const r = document.createRange();
    r.selectNodeContents(e.currentTarget);
    sel.removeAllRanges();
    sel.addRange(r);
  };
  return (
    <V2Sheet open={open} title={V2.shareNight} onClose={onClose}>
      <p className="txt">{V2.shareLine}</p>
      <div className="box" id="f-link" data-testid="share-link" onClick={selectAll}>{link}</div>
      <button type="button" className="btn pri" data-testid="share-copy" onClick={() => { void copy(); }}>{V2.copyLink}</button>
    </V2Sheet>
  );
}

export interface NightHubProps {
  seriesId: string;
  seriesName: string;
  occurrenceId: string;
  /** The picked night as the Events list sees it (RaffleSheet reads it). */
  raffleNight: Night;
  oneOff: boolean;
  ticketsSold?: number;
  moneyPence?: number;
  shareLink: string | null;
  toast: (text: string) => void;
  /** Rows of later slices (refund, Guest list, Note) render after the Raffle row. */
  children?: ReactNode;
}

/** Slice 5: going card, two tiles, the "This night" group (Raffle row), Share this night. */
export function NightHub({ seriesId, seriesName, occurrenceId, raffleNight, oneOff, ticketsSold = 0, moneyPence = 0, shareLink, toast, children }: NightHubProps) {
  const [shareOpen, setShareOpen] = useState(false);
  return (
    <div className="hub" data-testid="night-hub">
      {p3GoingOn() && <GoingCard seriesId={seriesId} seriesName={seriesName} occurrenceId={occurrenceId} />}
      <div className="tiles">
        <div className="card tile"><div className="lab">{V2.ticketsSold}</div><div className="num" data-testid="hub-sold">{ticketsSold}</div></div>
        <div className="card tile"><div className="lab">{V2.money}</div><div className="num" data-testid="hub-money">{gbp(moneyPence)}</div><div className="quiet">{V2.afterFees}</div></div>
      </div>
      <div className="grp" data-testid="hub-group">
        <div className="lab hd">{oneOff ? V2.onTheNight : V2.thisNight}</div>
        <div className="card">
          <div className="fb-list">
            <RaffleRow night={raffleNight} />
            {children}
          </div>
        </div>
      </div>
      <div>
        <button type="button" className="btn pri" data-testid="hub-share" disabled={!shareLink} onClick={() => setShareOpen(true)}>{V2.shareNight}</button>
        <div className="why">{V2.shareLine}</div>
      </div>
      <ShareSheet open={shareOpen && !!shareLink} link={shareLink ?? ''} onClose={() => setShareOpen(false)} toast={toast} />
    </div>
  );
}
