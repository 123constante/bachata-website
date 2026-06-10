// Festival Map mobile sheet -- "What's New" tab: the brand hero (logo + tagline +
// live stats) then recently added/updated events, freshest first. The map keeps
// the whole city visible and glows new pins (useMapList mapVisibleFor/glowFor).

import type { UseMapListResult } from '../useMapList';
import { NewsRow, EmptyState } from '../cards/cards';
import { NewsBrandCard } from '../cards/NewsBrandCard';

export function SheetNewsTab({ state }: { state: UseMapListResult }) {
  const events = state.listEvents;
  return (
    <div className="space-y-1">
      <NewsBrandCard state={state} />
      <h3 className="px-1 pb-1 pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Latest news</h3>
      {events.length === 0 ? (
        <EmptyState>No recent additions or updates.</EmptyState>
      ) : (
        events.map((e) => (
          <NewsRow
            key={e.occurrence_id}
            event={e}
            selected={state.selected === e.occurrence_id}
            onSelect={state.fromCard}
            onHover={state.setHovered}
          />
        ))
      )}
    </div>
  );
}
