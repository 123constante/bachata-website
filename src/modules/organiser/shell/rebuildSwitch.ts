// ER-S0: the rebuild switch. ONE flag, read once in OrganiserRoutes, handed to the
// rebuilt screens through context. Default OFF. VITE_ORGANISER_REBUILD is a comma
// list of organiser (page) ids it is ON for, first the owner's own pages; "*" means
// everyone. Old screens stay mounted until it is "*" and they are deleted after.
import { createContext, useContext } from 'react';

/** Pure: is the rebuild on for a login whose organiser pages have these ids? */
export function rebuildEnabled(raw: string | undefined, organiserIds: readonly string[]): boolean {
  const list = (raw ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  if (list.length === 0) return false;
  if (list.includes('*')) return true;
  return organiserIds.some((id) => list.includes(id));
}

export const RebuildSwitchContext = createContext(false);

/** True when the rebuilt organiser screens are on for this login. */
export const useRebuildSwitch = () => useContext(RebuildSwitchContext);
