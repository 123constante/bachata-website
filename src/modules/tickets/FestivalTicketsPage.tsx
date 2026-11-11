import { useOccurrenceProgram, useProgramItems } from '@/modules/event-page/sections/EventScheduleGrid';
import { EventTicketsPage, type EventTicketsPageProps } from './EventTicketsPage';

/**
 * TICKET_FESTIVAL_IN_SITE: the festival page's door into the SAME buyer checkout page event
 * pages open. Lazy-loaded by FestivalDetail, so the tickets module and the programme hooks it
 * needs stay out of the festival page's first-load graph. No second ticket system.
 */
const PROGRAM_HOOKS = { useOccurrenceProgram, useProgramItems };

export default function FestivalTicketsPage(props: Omit<EventTicketsPageProps, 'programHooks'>) {
  return <EventTicketsPage {...props} programHooks={PROGRAM_HOOKS} />;
}
