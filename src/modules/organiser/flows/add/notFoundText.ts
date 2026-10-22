import { notFoundLines } from '@/modules/organiser/shared/eventRules';
import type { OrganiserSeriesState } from '@/modules/organiser/shared/useOrganiserSeries';

/** The title for a series the lookup could not give: archived, no access or gone (prototype v7). */
export function notFoundText(state: OrganiserSeriesState['state']): string {
  return notFoundLines(state).title;
}

/** The one-line next step under that title (prototype v7). */
export function notFoundLine(state: OrganiserSeriesState['state']): string {
  return notFoundLines(state).line;
}
