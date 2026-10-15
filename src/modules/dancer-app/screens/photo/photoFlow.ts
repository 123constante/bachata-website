import { supabase } from '@/integrations/supabase/client';
import { uploadToR2 } from '@/lib/uploadToR2';
import { saveMyDancerProfile } from '../../api/rpc';
import type { MyDancerEdit } from '../../api/types';

/**
 * Replace the person's photo. The ORDER is the contract (brief W2d):
 *   1. upload the new JPEG            (uploadToR2 -> storage-sign-upload)
 *   2. save { avatar_url } at once    (replace-only: never null)
 *   3. delete the PREVIOUS own object (storage-delete-object), best effort
 * The old object is only deleted after the save succeeded, so a failure at any
 * earlier step leaves the person with the photo they had.
 */

export type PhotoFlowDeps = {
  upload: (blob: Blob) => Promise<string>;
  save: (url: string, current: MyDancerEdit) => Promise<MyDancerEdit>;
  deleteOld: (url: string, uid: string) => Promise<void>;
  log: (message: string, detail?: unknown) => void;
};

export type PhotoFlowStage = 'upload' | 'save';

/** A failure that says which step broke, so the screen can keep the crop and retry the right half. */
export class PhotoFlowError extends Error {
  readonly stage: PhotoFlowStage;
  readonly cause: unknown;
  /** Set when the upload worked but the save did not: a retry saves this URL and does not upload again. */
  readonly uploadedUrl: string | null;
  constructor(stage: PhotoFlowStage, cause: unknown, uploadedUrl: string | null = null) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'PhotoFlowError';
    this.stage = stage;
    this.cause = cause;
    this.uploadedUrl = uploadedUrl;
  }
}

export type PhotoFlowResult = { profile: MyDancerEdit; uploadedUrl: string };

export const replacePhoto = async (
  input: { blob: Blob; current: MyDancerEdit; uploadedUrl?: string | null },
  deps: PhotoFlowDeps,
): Promise<PhotoFlowResult> => {
  let url = input.uploadedUrl ?? null;
  if (!url) {
    try {
      url = await deps.upload(input.blob);
    } catch (err) {
      throw new PhotoFlowError('upload', err);
    }
  }
  let profile: MyDancerEdit;
  try {
    profile = await deps.save(url, input.current);
  } catch (err) {
    throw new PhotoFlowError('save', err, url);
  }
  const previous = input.current.avatar_url;
  if (previous && previous !== url) {
    try {
      await deps.deleteOld(previous, input.current.user_id);
    } catch (err) {
      // The save already succeeded; an orphaned old object is harmless. Never surfaced.
      deps.log('dancer-app photo: old object not deleted', err);
    }
  }
  return { profile, uploadedUrl: url };
};

/**
 * The storage key (`<bucket>/<path>`, what storage-sign-upload returns) for a public
 * URL, only when it sits under this person's own upload prefix `avatars/u/<uid>/`.
 * Anything else (admin-uploaded, legacy, another user's, malformed) is null: the
 * function refuses a whole batch if one key is foreign, so such a key is never sent.
 */
export const keyFromPublicUrl = (url: string | null | undefined, uid: string): string | null => {
  if (!url || !uid) return null;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const key = pathname.replace(/^\/+/, '');
  return key.startsWith(`avatars/u/${uid}/`) && key.length > `avatars/u/${uid}/`.length ? key : null;
};

/**
 * storage-delete-object accepts ONLY `{ keys: string[] }` and lets a non-admin delete
 * keys under its own prefix. Sends nothing when the old photo is not the person's own.
 * Errors still throw; the flow swallows them (the save already succeeded).
 */
export const deleteOwnPhoto = async (publicUrl: string, uid: string): Promise<void> => {
  const key = keyFromPublicUrl(publicUrl, uid);
  if (!key) {
    console.warn('dancer-app photo: old photo is not under the own upload prefix; not deleted');
    return;
  }
  const { error } = await supabase.functions.invoke('storage-delete-object', { body: { keys: [key] } });
  if (error) throw error;
};

export const realPhotoDeps: PhotoFlowDeps = {
  upload: (blob) => uploadToR2(blob, 'avatars'),
  save: (url, current) => saveMyDancerProfile({ avatar_url: url }, current),
  deleteOld: deleteOwnPhoto,
  log: (message, detail) => console.warn(message, detail),
};
