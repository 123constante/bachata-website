import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { doorKeys, fetchDoorList } from '../door/data';
import { GUEST_CHIPS, GUEST_COPY, chipCounts, filterGuests, guestRowOf, guestViewOf, type GuestChip } from './r4GuestListModel';

/** The guest list under the numbers on the night page. Names, tickets and in / not yet only: no money, for anyone. */
export function R4GuestList({ seriesId }: { seriesId: string }) {
  const { user } = useAuth();
  const [chip, setChip] = useState<GuestChip>('all');
  const q = useQuery({
    queryKey: doorKeys.list(user?.id, seriesId),
    queryFn: () => fetchDoorList(seriesId),
    enabled: !!user?.id && !!seriesId,
    staleTime: 15_000,
    retry: 1,
    networkMode: 'always',
  });
  if (q.isError && !q.data) {
    return (
      <section className="r4-section" aria-label={GUEST_COPY.title} data-testid="r4-guests">
        <p className="r4-err" role="alert" data-testid="r4-guests-error">{GUEST_COPY.error} <button type="button" className="r4-linkbtn" onClick={() => void q.refetch()}>{GUEST_COPY.retry}</button></p>
      </section>
    );
  }
  if (!q.data) return <p className="r4-note" data-testid="r4-guests-loading">{GUEST_COPY.loading}</p>;
  const v = guestViewOf(q.data);
  if (v.kind === 'hidden') return null;
  return (
    <section className="r4-section" aria-label={GUEST_COPY.title} data-testid="r4-guests">
      <h2 className="r4-label">{GUEST_COPY.title}</h2>
      {v.kind === 'no_night' && <p className="r4-note" data-testid="r4-guests-no-night">{GUEST_COPY.noNight}</p>}
      {v.kind === 'empty' && <p className="r4-note" data-testid="r4-guests-empty">{GUEST_COPY.empty}</p>}
      {v.kind === 'rows' && (() => {
        const counts = chipCounts(v.rows);
        const shown = filterGuests(v.rows, chip);
        return (
          <>
            <div className="r4-chips" role="group" aria-label="Show">
              {GUEST_CHIPS.map((c) => (
                <button key={c.key} type="button" className="r4-chip r4-chip-44" aria-pressed={chip === c.key} onClick={() => setChip(c.key)} data-testid={`r4-guests-chip-${c.key}`}>{c.label} {counts[c.key]}</button>
              ))}
            </div>
            {shown.length === 0 ? <p className="r4-note" data-testid="r4-guests-chip-empty">{GUEST_COPY.emptyChip(chip)}</p> : (
              <ul className="r4-card r4-guest-list" data-testid="r4-guests-list">
                {shown.map((r) => {
                  const g = guestRowOf(r);
                  return (
                    <li key={r.ticketId} className="r4-guest-row" data-testid="r4-guests-row">
                      <span className="r4-row-body">
                        <span className="r4-row-t">{g.name}</span>
                        <span className="r4-row-line">{g.tickets}{g.type ? `, ${g.type}` : ''}</span>
                      </span>
                      <span className={g.isIn ? 'r4-guest-in' : 'r4-mut'}>{g.status}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {v.truncated && <p className="r4-note" data-testid="r4-guests-truncated">{v.truncated}</p>}
          </>
        );
      })()}
    </section>
  );
}
