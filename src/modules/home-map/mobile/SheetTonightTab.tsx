// Festival Map mobile feed -- "Today" tab: today's events as distance cards,
// nearest first. Offers a location prompt when geolocation hasn't been requested.

import type { UseMapListResult } from '../useMapList';
import { TonightCard, EmptyState } from '../cards/cards';
import { LocateControl } from '../cards/LocateControl';

export function SheetTonightTab({ state }: { state: UseMapListResult }) {
  const events = state.listEvents;
  return (
    <div className="space-y-3">
      <LocateControl geo={state.geo} />
      {events.length === 0 ? (
        <EmptyState>Nothing listed for today yet.</EmptyState>
      ) : (
        events.map((e) => (
          <TonightCard
            key={e.occurrence_id}
            event={e}
            user={state.geo.coords}
            selected={state.selected === e.occurrence_id}
            onSelect={state.fromCard}
            onHover={state.setHovered}
          />
        ))
      )}
    </div>
  );
}
