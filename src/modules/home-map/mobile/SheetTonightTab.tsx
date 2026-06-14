// Festival Map mobile feed -- "Today" tab: today's events as distance cards,
// nearest first. Offers a location prompt when geolocation hasn't been requested.

import { MapPin } from 'lucide-react';
import type { UseMapListResult } from '../useMapList';
import { TonightCard, EmptyState } from '../cards/cards';

export function SheetTonightTab({ state }: { state: UseMapListResult }) {
  const events = state.listEvents;
  const showLocate = state.geo.status === 'idle' || state.geo.status === 'denied';
  return (
    <div className="space-y-3">
      {showLocate && (
        <button
          type="button"
          onClick={() => state.geo.request()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 py-2 text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <MapPin className="h-4 w-4" aria-hidden="true" />
          {state.geo.status === 'denied'
            ? 'Location blocked. Enable it to sort by distance'
            : 'Use my location for distances'}
        </button>
      )}
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
