// The organiser's page photo (avatar_url): checks, re-encode and the storage
// path. Reuses the flyer pipeline (flyerModel.ts) for the checks, the signature
// sniff and the re-encode, with the photo's own smaller limits; flyer behaviour
// is unchanged.
//
// CONTRACT with the admin migration that creates the bucket (separate admin PR,
// applied before this deploys):
//   bucket      organiser-photos (public read)
//   path        <organiserId>/<32 lowercase hex>.<jpg|png|webp>
//   public URL  <VITE_SUPABASE_URL>/storage/v1/object/public/organiser-photos/<path>
//   limits      2 MB per object; image/jpeg, image/png, image/webp only
//   who         INSERT for the organiser's owner or manager only; no update, no delete
// Replacing a photo uploads a NEW object; its URL is then saved as avatar_url by
// the page's single Save (organiser_profile_update_p5_v1). A discarded draft
// leaves an unused object behind: accepted.

import {
  FLYER_ACCEPT,
  FLYER_MIME_TYPES,
  FlyerError,
  browserReencodeDeps,
  checkFlyerBytes,
  checkFlyerFile,
  randomFlyerToken,
  reencodeFlyer,
  type EncodedFlyer,
  type FlyerProblem,
  type ReencodeDeps,
  type ReencodeLimits,
} from '@/modules/organiser/shared/flyerModel';

export const PHOTO_BUCKET = 'organiser-photos';
export const PHOTO_MIME_TYPES = FLYER_MIME_TYPES;
export const PHOTO_ACCEPT = FLYER_ACCEPT;

/** The long edge after resizing. */
export const PHOTO_MAX_EDGE = 1200;
/** The re-encode never shrinks the long edge below this to hit the target. */
export const PHOTO_MIN_EDGE = 600;
/** What the re-encode aims for (smaller images matter: the Vercel request cap is tight). */
export const PHOTO_TARGET_BYTES = 400 * 1024;
/** The bucket's own limit: never send more than this. */
export const PHOTO_BUCKET_LIMIT_BYTES = 2 * 1024 * 1024;

export const PHOTO_REENCODE_LIMITS: ReencodeLimits = {
  maxEdge: PHOTO_MAX_EDGE,
  minEdge: PHOTO_MIN_EDGE,
  targetBytes: PHOTO_TARGET_BYTES,
  limitBytes: PHOTO_BUCKET_LIMIT_BYTES,
};

export type PhotoProblem = FlyerProblem;

/** Plain copy for each problem, shown in the photo sheet. */
export const PHOTO_PROBLEM_COPY: Record<PhotoProblem, string> = {
  type: 'That file type is not supported. Choose a JPEG, PNG or WebP picture.',
  too_big: 'That picture is too big. Choose one under 10 MB.',
  empty: 'That file is empty. Choose another picture.',
  not_image: 'We could not read that file as a picture. Choose a JPEG, PNG or WebP picture.',
  too_detailed: 'We could not make that picture small enough. Try a simpler or smaller picture.',
  upload: 'The photo did not upload. Check your connection and try again. Your other changes are kept.',
  permission: 'You can only change the photo of an organiser you own or manage. Your other changes are kept.',
};

/** Type, size and empty (from what the browser says), then the signature sniff. */
export async function checkPhotoFile(file: Blob & { type: string; size: number }): Promise<PhotoProblem | null> {
  return checkFlyerFile(file) ?? (await checkFlyerBytes(file));
}

/** Always a fresh canvas (no EXIF or GPS survives), long edge 1200, aiming for about 400 KB. */
export function reencodePhoto(file: Blob, deps: ReencodeDeps = browserReencodeDeps): Promise<EncodedFlyer> {
  return reencodeFlyer(file, deps, PHOTO_REENCODE_LIMITS);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_RE = /^[0-9a-f]{32}$/;

/** <organiserId>/<token>.<ext>: the only shape the storage policy admits. */
export function photoObjectPath(organiserId: string, ext: 'webp' | 'jpg' | 'png', token: string = randomFlyerToken()): string {
  const id = organiserId.toLowerCase();
  if (!UUID_RE.test(id)) throw new Error('photoObjectPath: organiser id is not a uuid');
  if (!TOKEN_RE.test(token)) throw new Error('photoObjectPath: token is not 32 hex characters');
  return `${id}/${token}.${ext}`;
}

export { FlyerError as PhotoError };
