import { checkFlyerBytes, checkFlyerFile, FLYER_PROBLEM_COPY, FlyerError, reencodeFlyer } from '@/modules/organiser-self-serve/flyerModel';
import { uploadFlyer } from '@/modules/organiser-self-serve/flyerUploadApi';

/**
 * One picture (cover or gallery) through the old flyer pipeline: checked,
 * re-encoded in the browser (no metadata survives) and uploaded under the
 * series' folder. Returns its public URL; throws an Error with plain copy.
 */
export async function uploadEventPicture(seriesId: string, file: File): Promise<string> {
  try {
    const problem = checkFlyerFile(file) ?? (await checkFlyerBytes(file));
    if (problem) throw new FlyerError(problem);
    return await uploadFlyer(seriesId, await reencodeFlyer(file));
  } catch (err) {
    const problem = err instanceof FlyerError ? err.problem : 'upload';
    throw new Error(FLYER_PROBLEM_COPY[problem]);
  }
}
