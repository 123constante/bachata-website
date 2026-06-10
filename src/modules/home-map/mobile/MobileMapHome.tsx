// Festival Map mobile home -- full-bleed Leaflet map (between the 60px header
// and the 64px BottomNav) with the persistent discovery sheet over it. Owns the
// map<->sheet glue. The sheet portals to <body>, so it escapes this container and
// anchors to the viewport. The map is position:relative + definite height (per
// EventMap's .home-map__canvas { position:absolute; inset:0 } contract).

import { Suspense, lazy, useCallback, useEffect } from 'react';
import type { UseMapListResult } from '../useMapList';
import { MapSheet } from './MapSheet';
import { MapHint } from '../MapHint';

const EventMap = lazy(() => import('../EventMap'));

export default function MobileMapHome({
  state,
  cityName,
  loading,
  error,
  onRetry,
}: {
  state: UseMapListResult;
  cityName: string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const { apiRef } = state;

  // Re-measure Leaflet after a sheet snap / tab swap settles (the visible map
  // area can shift); the rAF/timeout clears the vaul transition first.
  const invalidate = useCallback(() => {
    window.setTimeout(() => apiRef.current?.invalidate(), 260);
  }, [apiRef]);

  useEffect(() => {
    invalidate();
  }, [state.tab, invalidate]);

  return (
    <div
      className="relative isolate w-full overflow-hidden"
      style={{ height: 'calc(100svh - 124px - env(safe-area-inset-bottom))' }}
    >
      <Suspense fallback={<div className="absolute inset-0" style={{ background: '#11121a' }} />}>
        <EventMap
          events={state.pins}
          visible={state.mapVisible}
          glow={state.glow}
          selected={state.mapSelected}
          hovered={state.mapHovered}
          onSelect={state.fromPin}
          onHover={state.setHovered}
          onReady={state.onMapReady}
          onOpenEvent={state.openEvent}
        />
      </Suspense>
      <div className="pointer-events-none absolute left-3 top-3 z-[500]">
        <MapHint />
      </div>
      <MapSheet
        state={state}
        cityName={cityName}
        loading={loading}
        error={error}
        onRetry={onRetry}
        onSnapChange={invalidate}
      />
    </div>
  );
}
