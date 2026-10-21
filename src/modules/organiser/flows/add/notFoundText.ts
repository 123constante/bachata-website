import { lookupMessages } from '@/modules/organiser/shared/eventRules';
import type { OrganiserSeriesState } from '@/modules/organiser/shared/useOrganiserSeries';

/** The sentence for a series the lookup could not give: archived, no access or gone. */
export function notFoundText(state: OrganiserSeriesState['state']): string {
  if (state === 'not-found-archived') return lookupMessages.notFoundArchived;
  if (state === 'no-access') return lookupMessages.noAccess;
  return lookupMessages.gone;
}
