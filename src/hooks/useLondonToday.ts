import { useTodayKey } from './useTodayKey';

/**
 * Reactive "today" on the London calendar, as a YYYY-MM-DD key.
 *
 * The London-calendar specialisation of useTodayKey (see that hook for the
 * re-anchor and `serverKey` semantics) -- events on the directory surfaces
 * live on the London calendar, so their day-anchored query keys and
 * "Tonight/Tomorrow" labels flip at London midnight.
 */
export const useLondonToday = (serverKey?: string): string =>
  useTodayKey('Europe/London', serverKey);
