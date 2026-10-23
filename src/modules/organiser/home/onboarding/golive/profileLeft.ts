import { fetchGoLiveCheck, showsProfileRow } from '@/modules/organiser/shared/goLiveCheck';

/**
 * Does the server say profile answers stand between this event and Go live?
 * A failed read answers false: the caller goes on and the server decides, so a
 * flaky read never blocks a ready event.
 */
export async function profileQuestionsLeft(seriesId: string): Promise<boolean> {
  try {
    return showsProfileRow(await fetchGoLiveCheck(seriesId));
  } catch {
    return false;
  }
}
