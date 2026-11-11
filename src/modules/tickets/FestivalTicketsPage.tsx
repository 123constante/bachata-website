import type { useOccurrenceProgram as UseOccurrenceProgram, useProgramItems as UseProgramItems } from '@/modules/event-page/sections/EventScheduleGrid';
import { EventTicketsPage, type EventTicketsPageProps } from './EventTicketsPage';

/**
 * TICKET_FESTIVAL_IN_SITE: the festival page's door into the SAME buyer checkout page event
 * pages open. Lazy-loaded by FestivalDetail, so the tickets module stays out of the festival
 * page's first-load graph. No second ticket system.
 *
 * The programme hooks are EMPTY on purpose: the festival passes its own start/end into the
 * chips, so the programme fallback is not needed, and importing EventScheduleGrid here (it is
 * static in BentoPage) split it into its own chunk: +1 first-load request on /event (chunk
 * ratchet 40 vs 39). Type-only import: no chunk edge.
 */
const EMPTY = { data: [], isSuccess: true, isPending: false, isLoading: false, isError: false };
const PROGRAM_HOOKS = {
  useOccurrenceProgram: (() => EMPTY) as unknown as typeof UseOccurrenceProgram,
  useProgramItems: (() => EMPTY) as unknown as typeof UseProgramItems,
};

export default function FestivalTicketsPage(props: Omit<EventTicketsPageProps, 'programHooks'>) {
  return <EventTicketsPage {...props} programHooks={PROGRAM_HOOKS} />;
}
