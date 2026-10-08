// "Send for review" on the event editor (G1). An organiser's event is created as a
// draft; series.set_lifecycle {to:'pending_review'} (owner-allowed from draft and
// rejected: _owner_lifecycle_transition_allowed_p5) puts it in the team's
// moderation queue. The team's approval then refuses anything
// event_publish_readiness_v1 reports missing (name, venue, city, start date, the
// city's country, an active organiser), so the screen shows those first, plus what
// only this screen knows: an upcoming date listed, a LIVE organiser and unsaved
// edits (the team reviews what is saved). Pure.
//
// Sessions (owner, 2026-10-08): the button stays off until at least one session
// sits on at least one upcoming listed date, the rule the admin editor applies
// before it publishes (bachata-admin lib/programTreeContentValidation.ts, #711):
// a series programme session (it runs on every date) or a session added to one
// date (admin_event_workspace_p5 occurrences[].added_sessions_count) counts.

import { LIFECYCLE_WORD, TEAM } from '@/modules/organiser/shared/eventState';

export interface ReviewInput {
  status: string;
  /** event_publish_readiness_v1.missing; null while it loads (or when it failed: see readinessError). */
  missing: readonly string[] | null;
  readinessError?: boolean;
  /** Upcoming dates listed and not cancelled. */
  upcomingListed: number;
  /** The organisers the event belongs to (organiser_home_v1); null while loading. */
  organisers: ReadonlyArray<{ name: string; lifecycle_status: string }> | null;
  /** Upcoming listed dates that carry at least one session (sessionDates). */
  datesWithSessions: number;
  dirty: boolean;
}

/** The reason shown while no upcoming listed date has a session. */
export const NO_SESSION_REASON = 'Add at least one session first.';

/**
 * Upcoming listed (not cancelled) dates that have a session: every one of them
 * when the series programme has a session, else those with a per-date added
 * session. `upcoming` is upcomingDates(ws.dates, today).
 */
export function sessionDates(
  seriesHasSessions: boolean,
  upcoming: ReadonlyArray<{ lifecycle_status: string; added_sessions_count: number }>,
): number {
  const listed = upcoming.filter((d) => d.lifecycle_status !== 'cancelled');
  return seriesHasSessions ? listed.length : listed.filter((d) => d.added_sessions_count > 0).length;
}

export interface EventReviewView {
  /** The card is drawn (draft, changes needed, in review). */
  show: boolean;
  label: string;
  /** One plain sentence under the tag. */
  sentence: string | null;
  canSend: boolean;
  /** Plain reasons the send is not possible yet; empty when it is. */
  blockers: string[];
  /** Changes needed: the button says 'Send for review again'. */
  again: boolean;
}

/** event_publish_readiness_v1's missing keys, as what to add. */
const MISSING_WORDS: Record<string, string> = {
  name: 'a name',
  venue: 'a venue',
  city: 'a city (it comes from the venue)',
  start: 'a date',
  organiser: 'an active organiser',
};

const sentenceList = (words: string[]) => (words.length <= 1 ? words[0] ?? '' : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

export function eventReviewView(input: ReviewInput): EventReviewView {
  const label = LIFECYCLE_WORD[input.status] ?? 'Draft';
  if (input.status === 'pending_review') {
    return {
      show: true, label, canSend: false, blockers: [], again: false,
      sentence: `Sent. ${TEAM.charAt(0).toUpperCase()}${TEAM.slice(1)} is checking it, usually within a day. Dancers see it once it is approved.`,
    };
  }
  if (input.status !== 'draft' && input.status !== 'rejected') {
    return { show: false, label, sentence: null, canSend: false, blockers: [], again: false };
  }
  const again = input.status === 'rejected';
  const blockers: string[] = [];
  if (input.missing === null || input.organisers === null) {
    blockers.push(input.readinessError ? 'We could not check what it still needs. Try again in a moment.' : 'Checking what it still needs\u2026');
  } else {
    const add = input.missing.filter((k) => k !== 'country').map((k) => MISSING_WORDS[k] ?? k);
    if (input.upcomingListed === 0 && !input.missing.includes('start')) add.push('an upcoming date');
    if (add.length) blockers.push(`To send it, add ${sentenceList(add)}.`);
    if (input.upcomingListed > 0 && input.datesWithSessions === 0) blockers.push(NO_SESSION_REASON);
    if (input.missing.includes('country')) blockers.push(`The venue\u2019s city has no country on file. Ask ${TEAM}.`);
    const notLive = input.organisers.filter((o) => o.lifecycle_status !== 'live');
    if (input.organisers.length && notLive.length === input.organisers.length) {
      blockers.push(`${sentenceList(notLive.map((o) => o.name))} ${notLive.length === 1 ? 'is' : 'are'} not live yet. Once ${TEAM} approves ${notLive.length === 1 ? 'it' : 'them'}, you can send this event.`);
    }
  }
  if (input.dirty) blockers.push('Save your changes first.');
  return {
    show: true,
    label,
    sentence: again
      ? `${TEAM.charAt(0).toUpperCase()}${TEAM.slice(1)} asked for changes. Make them, then send it again.`
      : 'Only you can see this event. Send it for review and dancers see it once it is approved.',
    canSend: blockers.length === 0,
    blockers,
    again,
  };
}
