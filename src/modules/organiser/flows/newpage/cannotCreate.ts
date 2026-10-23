// Pure, client-free: Arc 1 flow 8, the create refusal `organiser_invite_required`
// (_organiser_create_allowed_v1 said no). The old line "You cannot start an event
// yet" lives in flows/new (a page that is not live yet); this is the PAGE door.

export const CANNOT_CREATE = {
  title: 'Events are not open to you yet',
  sub: 'New pages are approved by hand during the beta.',
  ask: 'Ask us to open it',
} as const;

export const OPEN_REQUESTED = {
  title: 'We are checking',
  sub: 'We will email you when you can add events.',
  home: 'Back to Home',
} as const;

/** request_signup_access_v1's rate_limited, worded as everywhere else in Arc 1. */
export const TRY_LATER = 'Try again later.';
export const NOT_SENT = 'That did not send. Check your connection and try again.';

export type OpenRequestResult = 'sent' | 'rate_limited' | 'failed';

/** `{ok:true}` is sent; `rate_limited` waits; anything else (invalid_email, invalid_note, a bad shape) failed. */
export function parseOpenRequest(data: unknown): OpenRequestResult {
  const row = (data ?? {}) as { ok?: unknown; reason?: unknown };
  if (row.ok === true) return 'sent';
  return row.reason === 'rate_limited' ? 'rate_limited' : 'failed';
}

export const openRequestError = (result: OpenRequestResult): string | null =>
  result === 'sent' ? null : result === 'rate_limited' ? TRY_LATER : NOT_SENT;

/** The note the admin list shows beside the email (300 characters at most, one line). */
export function openRequestNote(pageName: string): string {
  const name = pageName.replace(/\s+/g, ' ').trim();
  return (name ? `Wants to create the page ${name}` : 'Wants to create a page').slice(0, 300);
}
