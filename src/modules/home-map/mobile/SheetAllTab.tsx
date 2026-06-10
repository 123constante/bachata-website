// Festival Map mobile sheet -- "All Events" tab: search + category chips + a
// date-grouped event list (the homepage default). Rows carry the freshness
// stamp so just-added events stand out. Map mirrors the filtered list.

import type { UseMapListResult } from '../useMapList';
import { groupByDate } from '../mapListDerivations';
import { EventRow, EmptyState } from '../cards/cards';
import { SearchField } from '../cards/controls';

export function SheetAllTab({ state }: { state: UseMapListResult }) {
  const groups = groupByDate(state.listEvents);
  return (
    <div className="space-y-3">
      <SearchField value={state.q} onChange={state.setQ} />
      {groups.length === 0 ? (
        <EmptyState>No events match your search.</EmptyState>
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <header className="flex items-center gap-2 px-1 pb-1.5 pt-1">
              <span className="text-xs font-bold text-primary">{g.label}</span>
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-bold text-muted-foreground">{g.items.length}</span>
            </header>
            <div className="space-y-1">
              {g.items.map((e) => (
                <EventRow
                  key={e.occurrence_id}
                  event={e}
                  selected={state.selected === e.occurrence_id}
                  onSelect={state.fromCard}
                  onHover={state.setHovered}
                  showFreshness
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
