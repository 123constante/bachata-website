// homePolish search chips: All / Events / People / Venues over the federated search kinds.
import type { SearchKind } from '@/lib/searchEntities';

export type SearchFilter = 'all' | 'events' | 'people' | 'venues';

export const SEARCH_FILTERS: { id: SearchFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'events', label: 'Events' },
  { id: 'people', label: 'People' },
  { id: 'venues', label: 'Venues' },
];

/** Which chip a result kind belongs to. City and vendor rows only show under All. */
export function searchGroupOf(kind: SearchKind): Exclude<SearchFilter, 'all'> | null {
  switch (kind) {
    case 'event':
      return 'events';
    case 'teacher':
    case 'dj':
    case 'dancer':
    case 'person':
    case 'organiser':
      return 'people';
    case 'venue':
      return 'venues';
    default:
      return null;
  }
}
