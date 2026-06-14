// Mount-safety for Leaflet maps. Async Leaflet calls (setTimeout callbacks,
// animation/zoom completion handlers, observers) can fire AFTER the map has been
// torn down on unmount — Leaflet then dereferences a removed pane and throws
// `Cannot read properties of undefined (reading '_leaflet_pos')` (BACHATA-WEBSITE-2C).
//
// MapDisposer centralises the guard EventMap previously applied ad-hoc (the
// try/catch in `invalidate`/`pinHalf`): every deferred call goes through here, is
// no-op'd if the map is gone, and any pending timeout is cancelled on dispose().
// Any future async map call added later inherits the same protection.

import type L from 'leaflet';
import type { MutableRefObject } from 'react';

export class MapDisposer {
  private timeouts = new Set<number>();
  private disposed = false;

  constructor(private readonly mapRef: MutableRefObject<L.Map | null>) {}

  /** The map is still mounted and usable. */
  get alive(): boolean {
    return !this.disposed && this.mapRef.current != null;
  }

  /** Run `fn` only while the map is mounted; swallow Leaflet teardown throws. */
  safeCall<T>(fn: (map: L.Map) => T): T | undefined {
    if (!this.alive) return undefined;
    try {
      return fn(this.mapRef.current as L.Map);
    } catch {
      // Map was removed mid-call (teardown race) — nothing actionable.
      return undefined;
    }
  }

  /**
   * `setTimeout` whose callback no-ops if the map was torn down before it fired,
   * and whose handle is cleared by `dispose()` so it can never run post-unmount.
   */
  safeTimeout(fn: (map: L.Map) => void, delay: number): void {
    if (!this.alive) return;
    const id = window.setTimeout(() => {
      this.timeouts.delete(id);
      this.safeCall(fn);
    }, delay);
    this.timeouts.add(id);
  }

  /** Cancel all pending timeouts and mark the map dead. Call from effect cleanup. */
  dispose(): void {
    this.disposed = true;
    for (const id of this.timeouts) window.clearTimeout(id);
    this.timeouts.clear();
  }
}
