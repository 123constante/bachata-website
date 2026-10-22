// ER-S0: the rebuild switch. ONE flag, read once in OrganiserRoutes, handed to the
// rebuilt screens through context. Default OFF. VITE_ORGANISER_REBUILD is a comma
// list of organiser (page) ids it is ON for, first the owner's own pages; "*" means
// everyone. Old screens stay mounted until it is "*" and they are deleted after.
//
// ER-FIX-W2 (owner decision 2): the switch is PER EVENT. An event's screens are the
// new ones when its OWNER page (organiser_ids[1] in SQL, the first id here) is on the
// list, so every organiser of that event, co-organisers included, gets the same
// screens. Screens with no event (Home, New event) keep the per-login answer.
import { createContext, useContext } from 'react';

const listOf = (raw: string | undefined): string[] => (raw ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/** Pure: is the rebuild on for a login whose organiser pages have these ids? */
export function rebuildEnabled(raw: string | undefined, organiserIds: readonly string[]): boolean {
  const list = listOf(raw);
  if (list.length === 0) return false;
  if (list.includes('*')) return true;
  return organiserIds.some((id) => list.includes(id));
}

/** Pure: is the rebuild on for an event whose linked organiser pages are these ids (owner first)? */
export function rebuildEnabledForEvent(raw: string | undefined, eventOrganiserIds: readonly string[]): boolean {
  const list = listOf(raw);
  if (list.includes('*')) return true;
  const owner = eventOrganiserIds[0];
  return !!owner && list.includes(owner);
}

/** Pure: must the screens wait (skeleton) instead of guessing? Only a real list waits, and only while the read loads. */
export function rebuildPending(raw: string | undefined, loading: boolean): boolean {
  const list = listOf(raw);
  return loading && list.length > 0 && !list.includes('*');
}

export interface RebuildSwitchState {
  /** VITE_ORGANISER_REBUILD as read by OrganiserRoutes. */
  raw: string | undefined;
  /** The per-login answer. */
  on: boolean;
  /** True while the home read that answers it is loading (OrganiserRoutes shows its skeleton). */
  pending: boolean;
}

export const RebuildSwitchContext = createContext<RebuildSwitchState>({ raw: undefined, on: false, pending: false });

/**
 * True when the rebuilt organiser screens are on. No argument: for this login.
 * With the event's organiser ids (owner first): for that event (decision 2).
 * `null` means the event is not read yet: false, and the screen shows its own loading state.
 */
export function useRebuildSwitch(eventOrganiserIds?: readonly string[] | null): boolean {
  const s = useContext(RebuildSwitchContext);
  if (eventOrganiserIds === undefined) return s.on;
  if (eventOrganiserIds === null) return false;
  return rebuildEnabledForEvent(s.raw, eventOrganiserIds);
}

/** True while the switch cannot answer yet (a real allowlist and the home read loading). */
export const useRebuildSwitchPending = (): boolean => useContext(RebuildSwitchContext).pending;
