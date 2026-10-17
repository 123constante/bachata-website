import { UPLOAD_NETWORK_MESSAGE, uploadErrorMessage } from '@/lib/upload-validation';
import { signUploadMessage } from '@/lib/uploadToR2';

/** Audit M22: the one sentence for an upload failure that is neither the connection nor a known refusal. */
export const UPLOAD_FAILED_MESSAGE = 'We could not upload your photo. Please try again.';

/** The sentences lib/uploadToR2 writes itself for the refusals it knows: already plain words, kept. */
const CURATED = new Set([
  signUploadMessage(401),
  signUploadMessage(403),
  signUploadMessage(413),
  signUploadMessage(422),
  signUploadMessage(422, 'presign_not_allowed'),
]);
const TOO_LARGE = /^That (photo|video) is [\d.]+ MB\. The limit is \d+ MB\./;

/**
 * An upload failure -> what the person reads. A network failure keeps the shared connection
 * sentence (lib/upload-validation) and uploadToR2's own refusals keep theirs; anything else (a raw
 * storage or function message, a reason code) is never shown word for word: it is logged, and the
 * person gets one plain sentence.
 */
export const photoUploadFailureMessage = (cause: unknown, log: (message: string, raw: string) => void = console.warn): string => {
  const mapped = uploadErrorMessage(cause);
  if (mapped === UPLOAD_NETWORK_MESSAGE || CURATED.has(mapped) || TOO_LARGE.test(mapped)) return mapped;
  const raw = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : String(cause);
  log('[dancer-app] photo upload failed', raw);
  return UPLOAD_FAILED_MESSAGE;
};
