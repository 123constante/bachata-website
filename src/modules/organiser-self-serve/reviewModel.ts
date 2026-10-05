// Pure, client-free view model for the review status strip on the series page
// (Lever 2 W6, mockup 05-A). Input is the series' lifecycle_status (from
// admin_event_workspace_p5) and organiser_home_v1's series[].latest_decision,
// which carries the moderation verdict and its reason (the admin's message to
// the organiser). The owner transitions the strip offers mirror
// _owner_lifecycle_transition_allowed_p5 (admin 20261108130000): draft and
// rejected -> pending_review. Nothing moves OUT of review from here: there is
// no owner withdraw in v1, and approve / return stay with the admin.

import type { HomeDecision } from './homeModel';

export type StepState = 'done' | 'current' | 'todo' | 'returned';

export interface ReviewStep {
  key: 'draft' | 'review' | 'live';
  label: string;
  state: StepState;
}

export interface ReviewStripModel {
  steps: ReviewStep[];
  headline: string;
  detail: string;
  /** The admin's message when the series was returned; null otherwise. */
  reason: string | null;
  /** When it was returned (a real instant), for "Returned on Thu 1 Oct". */
  returnedAt: string | null;
  /** The submit button, when the server admits the move. */
  submit: { label: string } | null;
  /**
   * Why that button is disabled, or null. The approval refuses a series with no venue
   * (event_publish_readiness_v1, "missing a venue"; Lever 2 B2), so it is not sent without one.
   */
  submitMissing: string | null;
  /** True when the public page is up (live, ended). A paused series' page is hidden (S1: /event/<slug> is a 404). */
  publicPage: boolean;
  /** Why "View as a dancer" is missing, when it is. */
  previewNote: string | null;
}

const steps = (draft: StepState, review: StepState, live: StepState, reviewLabel = 'In review'): ReviewStep[] => [
  { key: 'draft', label: 'Draft', state: draft },
  { key: 'review', label: reviewLabel, state: review },
  { key: 'live', label: 'Live', state: live },
];

// event_view_p5's public viewer refuses a series outside these states
// ("not_found: series not publicly visible", admin 20261108110000), so there is
// no unlisted preview of a draft or a series in review: the gap is said plainly.
// A PAUSED series is also a 404 on /event/<slug> (launch walk S1, observed), so
// it is not a public page either; Resume puts it back.
const PUBLIC_STATES = new Set(['live', 'ended']);
const NO_PREVIEW = 'Dancers cannot see it yet. "View as a dancer" appears once it is live.';
const PAUSED_NOTE = 'The page is hidden while paused. "View as a dancer" returns when you resume.';

export const SUBMIT_NEEDS_VENUE = 'To send it for review, add a venue under Venue and save it.';

export function reviewStrip(
  status: string,
  decision: HomeDecision | null | undefined,
  { hasVenue = true }: { hasVenue?: boolean } = {},
): ReviewStripModel {
  const publicPage = PUBLIC_STATES.has(status);
  const submitMissing = hasVenue ? null : SUBMIT_NEEDS_VENUE;
  const base = { reason: null, returnedAt: null, submit: null, submitMissing: null, publicPage, previewNote: publicPage ? null : status === 'paused' ? PAUSED_NOTE : NO_PREVIEW };
  switch (status) {
    case 'draft':
      return {
        ...base,
        steps: steps('current', 'todo', 'todo'),
        headline: 'Draft, not public yet',
        detail: 'Send it for review when it is ready. The Bachata Calendar team usually answers within a day.',
        submit: { label: 'Send for review' },
        submitMissing,
      };
    case 'pending_review':
      return {
        ...base,
        steps: steps('done', 'current', 'todo'),
        headline: 'Waiting for the Bachata Calendar team',
        detail: 'Usually within a day. We will show the answer here.',
      };
    case 'rejected': {
      const returned = decision && decision.to_state !== 'live' ? decision : null;
      return {
        ...base,
        steps: steps('done', 'returned', 'todo', 'Returned'),
        headline: 'Returned with a message',
        detail: 'Fix what the message asks for, then send it again.',
        reason: returned?.reason?.trim() || null,
        returnedAt: returned?.created_at ?? null,
        submit: { label: 'Send again for review' },
        submitMissing,
      };
    }
    case 'live':
      return {
        ...base,
        steps: steps('done', 'done', 'current'),
        headline: 'Live on the calendar',
        detail: 'Dancers see it in the listings and on your page. Changes to it go live at once.',
      };
    case 'paused':
      return {
        ...base,
        steps: steps('done', 'done', 'done'),
        headline: 'Paused',
        detail: 'The page is hidden while paused. Resume it under Status to put it back.',
      };
    case 'ended':
      return {
        ...base,
        steps: steps('done', 'done', 'done'),
        headline: 'Ended',
        detail: 'Its run is over. The page stays up for people who look it up.',
      };
    default:
      return {
        ...base,
        steps: steps('done', 'todo', 'todo'),
        headline: status === 'archived' ? 'Archived' : 'Not public',
        detail: status === 'archived' ? 'Hidden from Bachata Calendar. The team can restore it.' : '',
      };
  }
}
