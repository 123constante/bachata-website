import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { CAP_NOTE, MAX_UPCOMING } from '@/modules/organiser/events/dateCap';
import type { WorkspaceDate } from '@/modules/organiser/shared/seriesModel';

/**
 * Done's second button after a cancel (D61): this date's confirm screen in
 * put-back mode, which sends ONE occurrence.cancel {cancelled:false} (D46) on
 * arrival and then goes to Done. Back from that Done finds the date scheduled
 * and sends nothing; a reload after a FAILED put back sends again (a new key).
 */
export const PUT_BACK = 'back';
export const putBackPath = (seriesId: string, occurrenceId: string) => `${ORG_PATHS.cancelDate(seriesId, occurrenceId)}?put=${PUT_BACK}`;
/** Cancel opened from Change "what" (?from=change): Keep it and Back return to Change for that date (INT3). */
export const FROM_CHANGE = 'change';
export const cancelFromChangePath = (seriesId: string, occurrenceId: string) => `${ORG_PATHS.cancelDate(seriesId, occurrenceId)}?from=${FROM_CHANGE}`;

/** Why a cancelled date cannot be put back: the server caps an un-cancel at 30 coming dates (date_cap). */
export const RESTORE_CAP_NOTE = `${CAP_NOTE}, and ${MAX_UPCOMING} or more are listed, so this date can't be put back now.`;

/**
 * True when putting `occurrenceId` back would be refused (prod
 * _cmd_occurrence_cancel_p5: un-cancel needs fewer than MAX_UPCOMING coming
 * SCHEDULED dates). The date itself is left out of the count, so one rule
 * answers both Done after a cancel and C13 for an already-cancelled date.
 */
export const restoreCapped = (dates: WorkspaceDate[], occurrenceId: string, today: string): boolean =>
  dates.filter((d) => d.id !== occurrenceId && d.lifecycle_status === 'scheduled' && d.occurrence_date >= today).length >= MAX_UPCOMING;

/** The server's date_cap on a put back, in restore words (the add-date copy would point at the wrong fix). */
export const restoreRefusal = (err: unknown): string | null => {
  const message = err && typeof err === 'object' ? (err as { message?: unknown }).message : null;
  return typeof message === 'string' && /^(permission_denied: )?date_cap/.test(message.trim()) ? RESTORE_CAP_NOTE : null;
};
