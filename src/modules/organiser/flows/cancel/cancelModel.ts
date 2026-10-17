import { ORG_PATHS } from '@/modules/organiser/shell/paths';

/**
 * Done's second button after a cancel (D61): this date's confirm screen in
 * put-back mode, which sends ONE occurrence.cancel {cancelled:false} (D46) on
 * arrival and replaces itself with Done, so Back or a reload never sends twice.
 */
export const PUT_BACK = 'back';
export const putBackPath = (seriesId: string, occurrenceId: string) => `${ORG_PATHS.cancelDate(seriesId, occurrenceId)}?put=${PUT_BACK}`;
