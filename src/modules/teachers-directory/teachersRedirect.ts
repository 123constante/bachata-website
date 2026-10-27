// Kept apart from teachersCity.ts: AnimatedRoutes (the app shell's first-load
// graph) needs only this, and perf-budgets.json has no room for the rest.
import { buildCityPath } from '@/lib/cityPath';

export const DEFAULT_TEACHERS_CITY = { slug: 'london-gb', name: 'London' } as const;

export function teachersPath(slug: string): string {
  return buildCityPath(slug, 'teachers');
}

/** Where bare /teachers sends a visitor: their city, else London. */
export function teachersRedirectTarget(visitorCitySlug: string | null | undefined): string {
  return teachersPath(visitorCitySlug || DEFAULT_TEACHERS_CITY.slug);
}
