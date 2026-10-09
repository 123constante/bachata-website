import { supabase } from '@/integrations/supabase/client';
import { FLYER_BUCKET, FlyerError, flyerObjectPath, type EncodedFlyer, type FlyerProblem } from './flyerModel';

/**
 * Which problem a Storage refusal is. The policy refusal (not owner/manager)
 * arrives as 403 / "row-level security"; the bucket's own size and type
 * limits as 413 / 415.
 */
export function flyerUploadProblem(error: unknown): FlyerProblem {
  const e = (error ?? {}) as { status?: unknown; statusCode?: unknown; message?: unknown };
  const status = String(e.status ?? e.statusCode ?? '');
  const message = typeof e.message === 'string' ? e.message : '';
  if (status === '403' || status === '401' || /row-level security|unauthori[sz]ed|permission/i.test(message)) return 'permission';
  if (status === '413' || /too large|exceeded the maximum/i.test(message)) return 'too_big';
  if (status === '415' || /mime type|content type/i.test(message)) return 'type';
  return 'upload';
}

/**
 * Upload a re-encoded flyer under <series_id>/<random>.<ext> and return its
 * public URL. Never overwrites (upsert false): a replace is a new object.
 */
export async function uploadFlyer(seriesId: string, flyer: EncodedFlyer): Promise<string> {
  const path = flyerObjectPath(seriesId, flyer.ext);
  const bucket = supabase.storage.from(FLYER_BUCKET);
  const { error } = await bucket.upload(path, flyer.blob, {
    contentType: flyer.mime,
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) throw new FlyerError(flyerUploadProblem(error));
  return bucket.getPublicUrl(path).data.publicUrl;
}
