// Pure rules for the organiser editor's safety nets: when to warn about
// unsaved edits, the hard-confirm copy for the actions that hide or remove
// things from Bachata Calendar, and where "View on the site" points.
// No React and no client here, so the rules are unit-tested directly.

import { eventHref } from '@/lib/seo/eventHref';

/** The event page's section listing future dates taken off, each with Put back. Every pointer to it uses this name. */
export const TAKEN_OFF_LABEL = 'Dates taken off';

/** Where a date taken off (a break, a removed date) can be put back. */
export const PUT_BACK_WHERE = `You can put it back later from "${TAKEN_OFF_LABEL}" on the event page.`;

/** Shown by the browser prompt when an organiser leaves with edits not saved. */
export const UNSAVED_MESSAGE = 'You have changes that are not saved. If you leave now, you will lose them.';

/**
 * The leave warning is on only while there is something to lose: edits made,
 * and no save running or already finished (the create screen navigates away
 * itself once its draft has landed, which must not ask).
 */
export const leaveGuardEnabled = (state: { dirty: boolean; saving?: boolean; finished?: boolean }) =>
  state.dirty && !state.saving && !state.finished;

/** The public event page for a series: the canonical slug path, the id until it has one. */
export const publicEventPath = (series: { slug: string | null; id: string }) =>
  eventHref({ slug: series.slug, event_id: series.id });

/**
 * The sticky save bar, the same on every organiser editor (event, date, profile):
 * a closed (ended or archived) record shows no bar at all (its lock note says why,
 * and a disabled 'Saved' button next to 'Read only' only read as a broken control);
 * otherwise the button says what pressing it does ('Save changes') while there is
 * something to save, and 'Saved' once there is not.
 */
export interface SaveBarState { show: boolean; label: string; summary: string; compact: boolean; disabled: boolean }

export function saveBarState({ dirty, saving = false, locked = false, saveLabel = 'Save changes' }: {
  dirty: boolean; saving?: boolean; locked?: boolean; saveLabel?: string;
}): SaveBarState {
  return {
    show: !locked,
    label: dirty || saving ? saveLabel : 'Saved',
    summary: 'All changes saved',
    compact: !dirty && !saving,
    disabled: !dirty,
  };
}

export type ConfirmKind = 'cancel_date' | 'remove_date' | 'pause_series' | 'archive_series' | 'one_date';

export interface ConfirmCopy {
  title: string;
  /** What will happen, in plain words. Shown before the organiser can confirm. */
  consequence: string;
  /** What can be done about it afterwards. */
  undo: string;
  confirmLabel: string;
  keepLabel: string;
  /** Hard confirms ask for a tick ("I understand") before the red button works. */
  requireAck: boolean;
  ackLabel: string;
}

interface ConfirmContext {
  /** The date's label ("Tue 6 Oct") or the event's name. */
  subject: string;
  /** The reason dancers will see on a cancelled date. */
  reason?: string | null;
  /** The date is already cancelled (removing it then only tidies the list). */
  alreadyCancelled?: boolean;
  /** one_date: how many listed dates go when the event becomes one date. */
  count?: number;
}

export function confirmCopy(kind: ConfirmKind, ctx: ConfirmContext): ConfirmCopy {
  const s = ctx.subject;
  switch (kind) {
    case 'cancel_date':
      return {
        title: `Cancel ${s}?`,
        consequence: `Dancers will see "Cancelled"${ctx.reason ? ` and your reason, "${ctx.reason}",` : ''} on the event page. Anyone planning to come will know it is off. Only this date is cancelled.`,
        undo: 'You can put it back on later.',
        confirmLabel: 'Yes, cancel this date',
        keepLabel: 'No, keep it on',
        requireAck: true,
        ackLabel: 'I understand dancers will see it is cancelled.',
      };
    case 'remove_date':
      return {
        title: `Remove ${s}?`,
        consequence: ctx.alreadyCancelled
          ? 'The cancelled date goes off the list, so dancers stop seeing it.'
          : 'The date disappears from the list and from Bachata Calendar. Dancers will not see it.',
        undo: PUT_BACK_WHERE,
        confirmLabel: 'Yes, remove this date',
        keepLabel: 'No, keep it',
        requireAck: true,
        ackLabel: 'I understand this date will disappear.',
      };
    case 'pause_series':
      return {
        title: `Pause ${s}?`,
        consequence: 'The page and all its dates are hidden from dancers until you resume. Nothing is deleted.',
        undo: 'Press Resume any time to bring it back.',
        confirmLabel: 'Yes, pause it',
        keepLabel: 'No, leave it live',
        requireAck: false,
        ackLabel: '',
      };
    case 'archive_series':
      return {
        title: `Archive ${s}?`,
        consequence: 'The event and all its dates disappear from Bachata Calendar. Dancers will not be able to find it.',
        undo: 'Only the Bachata Calendar team can bring it back, so ask them if you change your mind.',
        confirmLabel: 'Yes, archive it',
        keepLabel: 'No, keep it',
        requireAck: true,
        ackLabel: 'I understand it will disappear for dancers.',
      };
    case 'one_date': {
      const n = ctx.count ?? 0;
      const dates = n === 1 ? '1 other date' : `${n} other dates`;
      return {
        title: `Keep only ${s}?`,
        consequence: n > 0
          ? `Your event becomes one date, ${s}. The ${dates} listed now go off Bachata Calendar when you save, with their sessions.`
          : `Your event becomes one date, ${s}.`,
        undo: 'You can make it weekly again from Repeats.',
        confirmLabel: n > 0 ? `Yes, take off ${dates}` : 'Yes, make it one date',
        keepLabel: 'No, keep it weekly',
        requireAck: n > 0,
        ackLabel: n > 0 ? `I understand ${n === 1 ? 'that date' : 'those dates'} will disappear.` : '',
      };
    }
  }
}

/** The red button works only once the tick is given (when one is asked for) and nothing is running. */
export const canConfirm = (copy: Pick<ConfirmCopy, 'requireAck'>, acknowledged: boolean, busy: boolean) =>
  !busy && (!copy.requireAck || acknowledged);
