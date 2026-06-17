// Festival Map mobile feed -- "What's New" tab: the brand hero (logo + tagline +
// live stats) then recently added/updated events, freshest first. The map keeps
// the whole city visible and glows new pins (useMapList mapVisibleFor/glowFor).

import type { UseMapListResult } from '../useMapList';
import { NewsRow, EmptyState } from '../cards/cards';

export function SheetNewsTab({ state }: { state: UseMapListResult }) {
  const events = state.listEvents;
  return (
    <div className="space-y-1">
      <div className="px-1 pt-1 pb-2">
        <div className="flex items-center gap-2 pb-1.5">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-foreground">Latest news</h3>
          <span className="rounded-full bg-primary px-[5px] py-[1.5px] text-[8px] font-black uppercase leading-none tracking-wide text-black">Live</span>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-primary/70 to-primary/0" />
      </div>
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
