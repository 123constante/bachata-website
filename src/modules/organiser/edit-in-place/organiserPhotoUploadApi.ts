import { supabase } from '@/integrations/supabase/client';
import { FlyerError, type ReencodeDeps } from '@/modules/organiser/shared/flyerModel';
import { flyerUploadProblem } from '@/modules/organiser/shared/flyerUploadApi';
import { PHOTO_BUCKET, PHOTO_PROBLEM_COPY, checkPhotoFile, photoObjectPath, reencodePhoto } from './organiserPhotoModel';

type StorageClient = Pick<typeof supabase, 'storage'>;

/**
 * Check, re-encode and upload one organiser photo under
 * <organiser_id>/<random>.<ext>; return its public URL. Never overwrites
 * (upsert false): a replace is a new object. Throws an Error whose message is
 * the plain copy to show (a missing bucket or a policy refusal reads as the
 * 'upload' / 'permission' copy; nothing else on the page is affected).
 */
export async function uploadOrganiserPhoto(
  organiserId: string,
  file: File,
  opts: { client?: StorageClient; deps?: ReencodeDeps } = {},
): Promise<string> {
  const client = opts.client ?? supabase;
  try {
    const problem = await checkPhotoFile(file);
    if (problem) throw new FlyerError(problem);
    const photo = await reencodePhoto(file, opts.deps);
    const path = photoObjectPath(organiserId, photo.ext);
    const bucket = client.storage.from(PHOTO_BUCKET);
    const { error } = await bucket.upload(path, photo.blob, { contentType: photo.mime, upsert: false, cacheControl: '31536000' });
    if (error) throw new FlyerError(flyerUploadProblem(error));
    return bucket.getPublicUrl(path).data.publicUrl;
  } catch (err) {
    throw new Error(PHOTO_PROBLEM_COPY[err instanceof FlyerError ? err.problem : 'upload']);
  }
}
