// Pure view model for Home under rule 2 (C1/C1b, D36-D38). Every fact on Home
// is a homeJobs() row (jobs/homeJobs.ts, ONE mapping); this file only says
// what surrounds the list, never a count or a status of its own.
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { calendarDate } from '@/modules/organiser/shared/homeModel';
import { createBlock } from '@/modules/organiser/shared/createModel';
import type { Job } from '@/modules/organiser/jobs/homeJobs';
import { ORG_PATHS } from '../shell/paths';

/** "Fri 20 Nov" for a London calendar date, "Sat 9 Jan 2027" outside today's year (shared calendarDate). */
export const shortDate = (iso: string, today: string): string => calendarDate(iso, today);

/** C1b: the page is on its first steps (homeJobs gave the first-steps list). */
export const isFirstSteps = (jobs: readonly Job[]): boolean => jobs.some((j) => j.kind === 'create_first_event');

/** The two rows of two small buttons under New event (D36, D38), in reading order. */
export const SMALL_BUTTONS: readonly { label: string; to: string }[] = [
  { label: 'Team', to: ORG_PATHS.team },
  { label: 'My page', to: ORG_PATHS.page },
  { label: 'My events', to: ORG_PATHS.events },
  { label: 'More', to: ORG_PATHS.more },
];

/** Organisers whose incoming requests Home may read (owners and managers both can). */
export const readsRequests = (organiser: HomeOrganiser | null): boolean =>
  !!organiser && (organiser.role === 'owner' || organiser.role === 'manager');

/**
 * Why New event cannot work yet on this page, or null: only a live organiser
 * takes events (series.upsert create). D4 makes a new page live on creation;
 * this covers a page an admin parked.
 */
export function newEventBlock(organiser: HomeOrganiser | null): string | null {
  if (!organiser || organiser.lifecycle_status === 'live') return null;
  return createBlock(organiser);
}
