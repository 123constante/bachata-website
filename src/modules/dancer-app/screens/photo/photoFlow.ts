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
  deleteOld: (url: string) => Promise<void>;
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
      await deps.deleteOld(previous);
    } catch (err) {
      // The save already succeeded; an orphaned old object is harmless. Never surfaced.
      deps.log('dancer-app photo: old object not deleted', err);
    }
  }
  return { profile, uploadedUrl: url };
};

/**
 * storage-delete-object, called through the same supabase client uploadToR2 uses.
 * The site has no other caller of it (docs/briefs/storage-callers-handover.md), so
 * the request body is the one NOT verified against the deployed function; the
 * server refuses anything outside the caller's own prefix (403 not_owner), and the
 * flow swallows that.
 */
export const deleteOwnPhoto = async (publicUrl: string): Promise<void> => {
  const { error } = await supabase.functions.invoke('storage-delete-object', { body: { bucket: 'avatars', publicUrl } });
  if (error) throw error;
};

export const realPhotoDeps: PhotoFlowDeps = {
  upload: (blob) => uploadToR2(blob, 'avatars'),
  save: (url, current) => saveMyDancerProfile({ avatar_url: url }, current),
  deleteOld: deleteOwnPhoto,
  log: (message, detail) => console.warn(message, detail),
};
