import { LIFECYCLE_LABEL } from './selfServeApi';

/**
 * THE organiser lifecycle -> copy mapping (draft-organiser dead end,
 * 2026-10-09 walk). Home's status card, the Profile's ReviewCard and the New
 * event refusal all read this one table, so a draft never says one thing on
 * one screen and another elsewhere. submit_organiser_profile_v1 admits draft
 * and rejected only (owner or manager); series.upsert (create) needs a live
 * organiser.
 */
export interface OrganiserStatusCopy {
  /** The status tag ("Draft", "In review"). */
  label: string;
  /** StatusTag tone (structurally the ui StatusTone). */
  tone: 'live' | 'draft' | 'neutral';
  /** The status line: where the organiser stands. Null for a state with nothing to say. */
  line: string | null;
  /** What the person can do now, or null when nothing is needed (live). */
  next: string | null;
  /** Offer "Send for review". */
  canSendForReview: boolean;
  sendLabel: string;
  /** Why New event cannot work for this organiser, and what to do; null when it can. */
  newEventBlock: string | null;
}

export function organiserStatus(name: string, lifecycle: string, reason?: string | null): OrganiserStatusCopy {
  const label = LIFECYCLE_LABEL[lifecycle] ?? lifecycle;
  switch (lifecycle) {
    case 'draft':
      return {
        label,
        tone: 'draft',
        line: 'Draft: not visible to the public yet.',
        next: 'Send it for review. Once the Bachata Calendar team approves it you can add events.',
        canSendForReview: true,
        sendLabel: 'Send for review',
        newEventBlock: `${name} is a draft, so it cannot take events yet. Send it for review first; once the team approves it you can add events.`,
      };
    case 'pending_review':
      return {
        label,
        tone: 'neutral',
        line: 'Waiting for review: not visible to the public yet.',
        next: 'The Bachata Calendar team checks new organisers, usually within a day. You can add events once it is approved.',
        canSendForReview: false,
        sendLabel: 'Send for review',
        newEventBlock: `Your organiser is waiting for approval. The team is checking ${name}, usually within a day; you can add events once it is approved.`,
      };
    case 'rejected': {
      const why = reason?.trim();
      return {
        label,
        tone: 'draft',
        line: why ? `The team asked for changes: ${why}` : 'The team asked for changes.',
        next: 'Make the changes on your Profile page, then send it for review again.',
        canSendForReview: true,
        sendLabel: 'Send for review again',
        newEventBlock: `${name} needs changes before it can take events. Make them on your Profile page, then send it for review again.`,
      };
    }
    case 'live':
      return { label, tone: 'live', line: 'Live on the site.', next: null, canSendForReview: false, sendLabel: 'Send for review', newEventBlock: null };
    default:
      return {
        label,
        tone: 'neutral',
        line: null,
        next: 'Ask the Bachata Calendar team to switch it back on.',
        canSendForReview: false,
        sendLabel: 'Send for review',
        newEventBlock: `${name} cannot take new events right now. Ask the Bachata Calendar team.`,
      };
  }
}
