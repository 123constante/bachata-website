// Pure model for the About-you screen after a claim. The server (save_my_about_you_v1) owns every rule;
// this maps its answer to plain words and trims what we send.

export type AboutYouReason =
  | 'feature_off' | 'not_claimant' | 'invalid_first_name' | 'invalid_photo' | 'invalid_email'
  | 'email_unverified' | 'profile_unavailable' | 'contact_required';

const REASONS: readonly string[] = [
  'feature_off', 'not_claimant', 'invalid_first_name', 'invalid_photo', 'invalid_email',
  'email_unverified', 'profile_unavailable', 'contact_required',
];

export type AboutYouOutcome =
  | { kind: 'saved'; profileComplete: boolean }
  | { kind: 'refused'; reason: AboutYouReason }
  | { kind: 'signed_out' }
  | { kind: 'failed' };

export function parseAboutYouResult(raw: unknown): AboutYouOutcome {
  if (!raw || typeof raw !== 'object') return { kind: 'failed' };
  const r = raw as Record<string, unknown>;
  if (r.ok === true) return { kind: 'saved', profileComplete: r.profile_complete === true };
  if (r.ok === false && typeof r.reason === 'string' && REASONS.includes(r.reason)) {
    return { kind: 'refused', reason: r.reason as AboutYouReason };
  }
  return { kind: 'failed' };
}

export type AboutYouField = 'name' | 'photo' | 'contact' | 'email';

/** One plain-words message per refusal. `field` says where it shows; null = the generic try-again screen. */
export const ABOUT_YOU_MESSAGES: Record<AboutYouReason, { field: AboutYouField | null; message: string }> = {
  invalid_first_name: { field: 'name', message: 'Please enter your first name.' },
  invalid_photo: { field: 'photo', message: 'Please add a photo of yourself.' },
  invalid_email: { field: 'email', message: 'That email does not look right.' },
  email_unverified: { field: 'email', message: 'Use the email you signed in with.' },
  contact_required: { field: 'contact', message: 'Add a phone number or email so people can reach you.' },
  not_claimant: { field: null, message: 'Something went wrong, try again.' },
  profile_unavailable: { field: null, message: 'Something went wrong, try again.' },
  feature_off: { field: null, message: 'Something went wrong, try again.' },
};

export const ABOUT_YOU_FAILED_MESSAGE = 'Something went wrong, try again.';

export interface AboutYouForm { firstName: string; avatarUrl: string; phone: string; email: string; showContact: boolean }

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const blankToNull = (s: string) => (s.trim() === '' ? null : s.trim());

/** Client-side check: only what we can know without the server (email shape). The server decides what is missing. */
export function validateAboutYou(f: AboutYouForm): { field: AboutYouField; message: string } | null {
  const email = f.email.trim();
  if (email && !EMAIL_RE.test(email)) return { field: 'email', message: ABOUT_YOU_MESSAGES.invalid_email.message };
  return null;
}

/** RPC arguments: blanks become null so already-stored values are kept. */
export function buildAboutYouArgs(f: AboutYouForm): Record<string, unknown> {
  return {
    p_first_name: blankToNull(f.firstName),
    p_avatar_url: blankToNull(f.avatarUrl),
    p_phone: blankToNull(f.phone),
    p_email: blankToNull(f.email),
    p_show_contact_publicly: f.showContact,
  };
}

/** Where Continue on "It's yours" goes. */
export const nextAfterClaim = (aboutYouNeeded: boolean): 'about' | 'done' => (aboutYouNeeded ? 'about' : 'done');
