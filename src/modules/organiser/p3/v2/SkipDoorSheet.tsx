import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { dateDetailQueryKey, setNightNoDoor } from '../../shared/selfServeApi';
import { V2 } from './copy';
import { V2Sheet } from './V2Sheet';

export interface SkipDoorDate { id: string; label: string; noDoor: boolean }

/** "Skip the door on one night": tick the nights with no "Pay at the door"; Done writes only the nights that changed. */
export function SkipDoorSheet({ dates, onClose, onSaved }: { dates: SkipDoorDate[]; onClose: () => void; onSaved: (count: number) => void }) {
  const qc = useQueryClient();
  const [ticks, setTicks] = useState<Record<string, boolean>>(() => Object.fromEntries(dates.map((d) => [d.id, d.noDoor])));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async () => {
    if (busy) return;
    setBusy(true); setFailed(false);
    let count = 0;
    try {
      for (const d of dates) {
        const next = ticks[d.id] === true;
        if (next === d.noDoor) continue;
        await setNightNoDoor(d.id, next);
        count += 1;
        await qc.invalidateQueries({ queryKey: dateDetailQueryKey(d.id) });
      }
    } catch {
      setFailed(true); setBusy(false);
      return;
    }
    setBusy(false);
    onSaved(count);
    onClose();
  };
  return (
    <V2Sheet open title="Skip the door on one night" onClose={onClose}>
      <div className="grp" data-testid="skip-door-sheet">
        <p className="hint">Pick the nights with no &ldquo;Pay at the door&rdquo;.</p>
        {dates.map((d) => {
          const on = ticks[d.id] === true;
          return (
            <button key={d.id} type="button" className="swrow" role="checkbox" aria-checked={on} disabled={busy} data-testid={`skip-door-${d.id}`}
              onClick={() => setTicks({ ...ticks, [d.id]: !on })}>
              <span>{d.label}</span><span className={on ? 'sw on' : 'sw'} aria-hidden="true" />
            </button>
          );
        })}
        {failed ? <p className="err" role="alert" data-testid="skip-door-err">{V2.noDoor.failed}</p> : null}
        <button type="button" className="btn pri" data-testid="skip-door-done" disabled={busy} aria-busy={busy} onClick={() => { void save(); }}>Done</button>
      </div>
    </V2Sheet>
  );
}
