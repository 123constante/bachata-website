import { LIFECYCLE_LABEL } from './selfServeApi';

/**
 * THE organiser lifecycle -> copy mapping. Everything is live (D4): a page is
 * live on creation and there is no review step, so the UI knows draft, live,
 * paused, ended and archived; anything else (an older pending_review or
 * rejected row) reads like a paused page: ask the team. series.upsert (create)
 * needs a live organiser, so New event is blocked for every state but live.
 */
export interface OrganiserStatusCopy {
  /** The status tag ("Live", "Paused"). */
  label: string;
  /** StatusTag tone (structurally the ui StatusTone). */
  tone: 'live' | 'draft' | 'neutral';
  /** The status line: where the page stands. */
  line: string | null;
  /** What the person can do now, or null when nothing is needed (live). */
  next: string | null;
  /** Why New event cannot work for this page, and what to do; null when it can. */
  newEventBlock: string | null;
}

export type OrganiserUiState = 'draft' | 'live' | 'paused' | 'ended' | 'archived';

const ASK = 'Ask the Bachata Calendar team.';

export function organiserStatus(name: string, lifecycle: string): OrganiserStatusCopy {
  switch (lifecycle) {
    case 'live':
      return { label: LIFECYCLE_LABEL.live, tone: 'live', line: null, next: null, newEventBlock: null };
    case 'draft':
      return {
        label: LIFECYCLE_LABEL.draft,
        tone: 'draft',
        line: 'Not live yet.',
        next: ASK,
        newEventBlock: `${name} is not live yet, so it cannot take events. ${ASK}`,
      };
    case 'paused':
    case 'ended':
    case 'archived':
      return {
        label: LIFECYCLE_LABEL[lifecycle],
        tone: 'neutral',
        line: null,
        next: ASK,
        newEventBlock: `${name} cannot take new events right now. ${ASK}`,
      };
    default:
      return {
        label: LIFECYCLE_LABEL.paused,
        tone: 'neutral',
        line: null,
        next: ASK,
        newEventBlock: `${name} cannot take new events right now. ${ASK}`,
      };
  }
}
