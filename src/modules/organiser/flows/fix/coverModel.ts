import { upsertCommand, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import type { DoneState } from '../doneState';
import { ORG_PATHS } from '../../shell/paths';

/** C18b: ONE upsert (the picture is already uploaded). No Undo. */
export const coverFixCommands = (url: string): OwnerCommand[] => [upsertCommand({ default_cover_image_url: url })];

export const COVER_TITLE = 'Add a cover';

/** Done "Cover added"; `next` is the event (the Home no_cover row came from there). */
export const coverDone = (seriesId: string): DoneState => ({
  title: COVER_TITLE,
  message: 'Cover added',
  seriesId,
  next: ORG_PATHS.event(seriesId),
  nextLabel: 'Back to the event',
});
