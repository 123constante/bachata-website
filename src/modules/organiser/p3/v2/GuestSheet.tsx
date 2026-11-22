import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { flags } from '@/lib/featureFlags';
import { GL_KEY } from '../guestlist/GuestListSheet';
import { readNight, setNight } from '../guestlist/guestListApi';
import { PAGE, READ_ONLY_WORDS, reasonWords } from '../guestlist/guestListModel';
import { V2Sheet } from './V2Sheet';
import { V2 } from './copy';

export interface GuestProps {
  occurrenceId: string;
  /** The picked night's long date, e.g. "Thursday 26 November". */
  longDate: string;
  /** The public event-page link of this night (the same one Share this night uses). */
  link: string | null;
  toast: (text: string) => void;
}

const useGuestRead = (occurrenceId: string) =>
  useQuery({ queryKey: [GL_KEY, occurrenceId, 'names', '', PAGE], queryFn: () => readNight(occurrenceId, 'names', '', PAGE) });

/** Guest list row (N-35): one line, pill "On · n names" / "Off", opens the sheet. Hidden when the flag is off or the night is not ours. */
export function GuestRow(p: GuestProps) {
  const q = useGuestRead(p.occurrenceId);
  const [open, setOpen] = useState(false);
  if (!flags.organiserGuestListLive) return null;
  const d = q.data;
  const refused = d && !d.ok ? (d as { reason: string }).reason : '';
  if (refused === 'night_not_found' || refused === 'not_on_team') return null;
  const pill = d && d.ok ? (d.night.enabled ? { text: V2.guestOn(d.counts.names), off: false } : { text: V2.guestOff, off: true }) : null;
  return (
    <div className="fwrap">
      <button type="button" className="fbtn ln" data-testid="hub-guest" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span className="lt">{V2.guestList}</span>
        <span className="lv">{pill && <span className={pill.off ? 'pill off' : 'pill'} data-testid="hub-guest-pill">{pill.text}</span>}</span>
        <span className="fgo" aria-hidden="true">&rsaquo;</span>
      </button>
      <GuestSheet {...p} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

/** SH-GUEST: switch, names with their extra count, the link and Copy link. Stays open on every toggle. */
export function GuestSheet({ occurrenceId, longDate, link, toast, open, onClose }: GuestProps & { open: boolean; onClose: () => void }) {
  const q = useGuestRead(occurrenceId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const v = q.data && q.data.ok ? q.data : null;
  const on = v?.night.enabled === true;
  const blocked = !v || !v.canEdit || busy;
  const flip = async () => {
    if (!v || blocked) return;
    setBusy(true);
    try {
      const r = await setNight(occurrenceId, !on, v.night.capacityMax, v.night.cutoffTime);
      if (r.ok) {
        await qc.invalidateQueries({ queryKey: [GL_KEY] });
        toast(on ? V2.guestToastOff : V2.guestToastOn);
      } else toast(reasonWords((r as { reason: string }).reason));
    } catch {
      toast(reasonWords(''));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link ?? '');
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
    <V2Sheet open={open} title={V2.guestList} onClose={onClose}>
      {q.isPending && <p className="txt">{V2.guestLoading}</p>}
      {(q.isError || (q.data && !q.data.ok)) && <p className="txt" role="alert" data-testid="guest-err">{q.data && !q.data.ok ? reasonWords((q.data as { reason: string }).reason) : V2.guestLoadFailed}</p>}
      {v && (
        <>
          <button type="button" className="swrow" role="switch" aria-checked={on} disabled={blocked} data-testid="guest-switch" onClick={() => { void flip(); }}>
            <span>{V2.guestList}</span><span className={on ? 'sw on' : 'sw'} />
          </button>
          {v.readOnly && <p className="txt" data-testid="guest-readonly">{READ_ONLY_WORDS[v.readOnly]}</p>}
          {!on ? (
            <p className="txt" data-testid="guest-off">{V2.guestOffText}</p>
          ) : (
            <>
              <p className="txt" data-testid="guest-count">{V2.guestCount(v.counts.names, longDate)}</p>
              {v.entries.length === 0 ? (
                <p className="txt" data-testid="guest-none">{V2.guestNone}</p>
              ) : (
                <div className="card" data-testid="guest-names">
                  {v.entries.map((e) => (
                    <div className="row" key={e.id}><b>{e.firstName}</b>{e.plusOnes > 0 && <span className="v">+{e.plusOnes}</span>}</div>
                  ))}
                </div>
              )}
              {v.total > v.entries.length && <p className="txt" data-testid="guest-cap">{V2.guestShowing(v.entries.length, v.total)}</p>}
              <p className="txt">{V2.guestShareLine}</p>
              <div className="box" id="f-link" data-testid="guest-link" onClick={selectAll}>{link ?? ''}</div>
              <button type="button" className="btn sec" data-testid="guest-copy" disabled={!link} onClick={() => { void copy(); }}>{V2.copyLink}</button>
            </>
          )}
        </>
      )}
    </V2Sheet>
  );
}
