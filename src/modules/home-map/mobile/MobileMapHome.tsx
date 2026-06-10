// Festival Map mobile home -- full-bleed Leaflet map (between the 60px header
// and the 64px BottomNav) with the persistent discovery sheet over it. Owns the
// map<->sheet glue. The sheet portals to <body>, so it escapes this container and
// anchors to the viewport. The map is position:relative + definite height (per
// EventMap's .home-map__canvas { position:absolute; inset:0 } contract) supplied
// by the .home-map-fill class (vh fallback + min-height + dark bg; audit #4).

import { Suspense, lazy, useCallback, useEffect, useRef } from 'react';
import type { UseMapListResult } from '../useMapList';
import { MapSheet } from './MapSheet';

const EventMap = lazy(() => import('../EventMap'));

// The sheet leads with events (~80% by default), so bias the initial view up so
// the pin cluster sits in the visible top strip rather than behind the sheet
// (audit #10). Fraction of the map height to shift London above the sheet.
const MOBILE_CENTER_BIAS_Y = 0.4;

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
  const wrapRef = useRef<HTMLDivElement>(null);

  // Re-measure Leaflet after a sheet snap / tab swap settles (the visible map
  // area shifts); the timeout clears the vaul transition first.
  const invalidateDeferred = useCallback(() => {
    window.setTimeout(() => apiRef.current?.invalidate(), 260);
  }, [apiRef]);

  useEffect(() => {
    invalidateDeferred();
  }, [state.tab, invalidateDeferred]);

  // iOS Safari resolves svh / safe-area after first paint and on every URL-bar
  // show/hide; without a re-measure the map can stay mis-sized or blank (audit
  // #4). Desktop already does this via ResizeObserver -- mirror it here and also
  // watch visualViewport + orientation.
  useEffect(() => {
    const invalidate = () => apiRef.current?.invalidate();
    let ro: ResizeObserver | undefined;
    if (wrapRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(invalidate);
      ro.observe(wrapRef.current);
    }
    const vv = window.visualViewport;
    vv?.addEventListener('resize', invalidate);
    window.addEventListener('orientationchange', invalidate);
    return () => {
      ro?.disconnect();
      vv?.removeEventListener('resize', invalidate);
      window.removeEventListener('orientationchange', invalidate);
    };
  }, [apiRef]);

  return (
    <div ref={wrapRef} className="home-map-fill relative isolate w-full overflow-hidden">
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
          centerBiasY={MOBILE_CENTER_BIAS_Y}
        />
      </Suspense>
      <MapSheet
        state={state}
        cityName={cityName}
        loading={loading}
        error={error}
        onRetry={onRetry}
        onSnapChange={invalidateDeferred}
      />
    </div>
  );
}
