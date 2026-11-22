import { useState } from 'react';
import { useVenueOptions } from '../../shared/publicVenues';
import { V2Sheet } from './V2Sheet';
import { V2 } from './copy';

const W = V2.whereAbout;

/** Where a Where / Description save applies: one night, every night of the series, or the one-off event. */
export type SheetMode = 'night' | 'usual' | 'oneOff';

/** The toast after a Where / Description save, per mode. `dateWords` is the night's full date ("Thursday 26 November"). */
export function savedLabel(mode: SheetMode, dateWords: string): string {
  if (mode === 'night') return V2.session.savedNight(dateWords);
  if (mode === 'usual') return V2.session.savedEvery(dateWords.split(' ')[0]);
  return V2.session.savedOneOff;
}

/**
 * SH-WHERE: pick a venue from the real list. Controlled: `current` is the venue shown now, `onSave(venueId)` is the
 * caller's write (night override today; series default in slice 10). A typed unknown name is NOT offered: there is
 * no venue-create writer yet (see the slice 8 handover).
 */
export function WhereSheet({ current, mode, dateWords, changed, onSave, onBack, onClose }: {
  current: string | null; mode: SheetMode; dateWords: string; changed?: boolean;
  onSave: (venueId: string) => void | Promise<unknown>; onBack?: () => void | Promise<unknown>; onClose: () => void;
}) {
  const venues = useVenueOptions();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const rows = (venues.data ?? []).filter((v) => !needle || `${v.name} ${v.neighbourhood ?? v.city_name ?? ''}`.toLowerCase().includes(needle));
  const pick = (id: string) => { if (id === current) { onClose(); return; } void onSave(id); };
  return (
    <V2Sheet open title={V2.where} onClose={onClose}>
      <div className="grp" data-mode={mode} data-date={dateWords}>
        <label className="flab" htmlFor="wh-q">{W.searchVenue}</label>
        <input id="wh-q" type="search" className="fld" placeholder={W.typeName} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        {venues.isPending && <p className="hint">{W.loading}</p>}
        {venues.data && (
          <div className="card" data-testid="where-rows">
            {rows.map((v) => (
              <button key={v.id} type="button" className="row" data-testid="where-row" onClick={() => pick(v.id)}>
                <span>
                  <b>{v.name}</b>
                  <span className="hint" style={{ display: 'block', margin: 0 }}>{v.neighbourhood ?? v.city_name ?? ''}</span>
                </span>
                <span className="v">{v.id === current ? `${W.now} ` : ''}&rsaquo;</span>
              </button>
            ))}
            {rows.length === 0 && <p className="hint" style={{ padding: '12px 16px' }}>{W.noMatch}</p>}
            <button type="button" className="row" data-testid="where-add-soon" disabled aria-disabled="true">
              <span className="hint">{W.addVenueSoon}</span>
            </button>
          </div>
        )}
        {mode === 'night' && changed && onBack && (
          <button type="button" className="btn sec" data-testid="where-back" onClick={() => { void onBack(); onClose(); }}>{W.backToUsualVenue}</button>
        )}
      </div>
    </V2Sheet>
  );
}
