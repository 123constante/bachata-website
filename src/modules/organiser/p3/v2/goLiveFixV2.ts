// Rule-to-fix contract, slice A: every go-live code has a named v2 fix. The server's
// sections (GO_LIVE_SECTIONS) each map to one v2 target; v2FixFor reads a code's section.
import { GO_LIVE_BLOCKERS } from '../../shared/goLiveKeys';

export type V2FixTarget = 'pay' | 'where' | 'dates' | 'prog' | 'flyer' | 'about' | 'name' | 'orgs' | 'tickets';

/** Keyed by the server's SECTION (GO_LIVE_SECTIONS). An unmapped section fails the contract test. */
export const GO_LIVE_V2_FIX: Readonly<Record<string, V2FixTarget>> = {
  venue: 'where',
  basics: 'name',
  about: 'about',
  tickets: 'tickets',
  dates: 'dates',
  programme: 'prog',
  cover: 'flyer',
  organisers: 'orgs',
  payment: 'pay',
};

/** The v2 fix for a go-live code; null for a code the map does not know. */
export const v2FixFor = (code: string): V2FixTarget | null => {
  if (!Object.prototype.hasOwnProperty.call(GO_LIVE_BLOCKERS, code)) return null;
  const section = GO_LIVE_BLOCKERS[code].section;
  return Object.prototype.hasOwnProperty.call(GO_LIVE_V2_FIX, section) ? GO_LIVE_V2_FIX[section] : null;
};

/** Flag VITE_ENABLE_GOLIVE_FIX: on unless the value is exactly the string 'false'. */
export const goLiveFixOn = (): boolean => import.meta.env.VITE_ENABLE_GOLIVE_FIX !== 'false';
