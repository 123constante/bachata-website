// The event's organisers (parity wave 1, SW1): the organiser pages linked to an event.
// Pure. Owner only (a manager sees the list read-only, with the reason); the last
// organiser cannot be removed; an added page must be live (the search lists live
// pages only). The write is series.set_organisers with the COMPLETE ordered id list.

import type { OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import { setOrganisersCommand } from '@/modules/organiser/shared/selfServeApi';
import { AW1_APPLIED, PARITY_GATE_REASON } from '@/modules/organiser/shared/parityGate';
import { eventLock } from '@/modules/organiser/shared/eventState';

export interface LinkedOrganiser { id: string; name: string; avatarUrl: string | null }

export const MANAGER_REASON = 'Only the owner can change who runs this event.';
export const LAST_ORGANISER_REASON = 'An event needs at least one organiser.';
export const ORGANISERS_EMPTY = 'No organiser is linked yet. Ask the Bachata Calendar team to link your page.';

/** Why the list cannot change here, or null. */
export function organisersOff(input: { lifecycle: string; isOwner: boolean; gate?: boolean }): string | null {
  const lock = eventLock(input.lifecycle);
  if (lock) return lock;
  if (!input.isOwner) return MANAGER_REASON;
  if (!(input.gate ?? AW1_APPLIED)) return PARITY_GATE_REASON;
  return null;
}

/** Why Remove is off for this organiser, or null. */
export const removeOff = (ids: string[]): string | null => (ids.length <= 1 ? LAST_ORGANISER_REASON : null);

export const addOrganiser = (ids: string[], id: string): string[] => (ids.includes(id) ? ids : [...ids, id]);
export const removeOrganiser = (ids: string[], id: string): string[] => (removeOff(ids) ? ids : ids.filter((x) => x !== id));

/** ONE series.set_organisers with the complete list; null when it is the stored list (order counts). */
export function organisersCommand(stored: string[], next: string[]): OwnerCommand | null {
  const same = stored.length === next.length && stored.every((v, i) => v === next[i]);
  return same || next.length === 0 ? null : setOrganisersCommand(next);
}
