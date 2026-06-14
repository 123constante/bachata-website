// Festival Map mobile feed -- "All Events" tab: a date-grouped event list (the
// homepage default). Rows carry the freshness stamp so just-added events stand
// out. Remote festivals (from all cities) are merged upstream in Index and arrive
// via state.listEvents; they render with a pin icon so users know they'd be
// travelling. Navigational search now lives in the header omnibox on mobile, so
// there is no in-feed search field here (the `q` filter stays wired for desktop).

import type { UseMapListResult } from '../useMapList';
import { groupByDate } from '../mapListDerivations';
import { EventRow, EmptyState, RemoteFestivalRow } from '../cards/cards';

export function SheetAllTab({ state }: { state: UseMapListResult }) {
  const groups = groupByDate(state.listEvents);
  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <EmptyState>
          {state.filter !== 'all' ? 'No events match this filter.' : 'Nothing on right now.'}
        </EmptyState>
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <header className="flex items-center gap-2 px-1 pb-1.5 pt-1">
              <span className="text-xs font-bold text-primary">{g.label}</span>
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-bold text-muted-foreground">{g.items.length}</span>
            </header>
            <div className="space-y-1">
              {g.items.map((e) =>
                e.occurrence_id.startsWith('remote-') ? (
                  <RemoteFestivalRow key={e.occurrence_id} event={e} />
                ) : (
                  <EventRow
                    key={e.occurrence_id}
                    event={e}
                    selected={state.selected === e.occurrence_id}
                    onSelect={state.fromCard}
                    onHover={state.setHovered}
                    showFreshness
                  />
                )
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
