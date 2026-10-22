// Pure model for the "type your email" step on an UNBOUND open invite link (signed out).
// ONE copy map for every screen (BIND_COPY); the RPC (bind_organiser_invite_email_v1)
// never returns an email, only a status.

export type BindStatus = 'bound' | 'already_bound' | 'not_open' | 'bad_email' | 'rate_limited';
export type BindOutcome = { kind: 'status'; status: BindStatus } | { kind: 'unavailable' } | { kind: 'failed' };

const STATUSES: readonly string[] = ['bound', 'already_bound', 'not_open', 'bad_email', 'rate_limited'];

/** Printable ASCII only (no spaces, no invisible characters): the server's invisible-character list is incomplete. */
const ASCII_EMAIL = /^[\x21-\x7e]+$/;
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type EmailCheck = { ok: true; email: string } | { ok: false; reason: 'empty' | 'not_ascii' | 'bad_shape' };

/** Trim, then refuse anything the server could mishandle. The server lowercases; so does the confirm line. */
export function checkTypedEmail(raw: string): EmailCheck {
  const email = raw.trim();
  if (!email) return { ok: false, reason: 'empty' };
  if (!ASCII_EMAIL.test(email)) return { ok: false, reason: 'not_ascii' };
  if (!EMAIL_SHAPE.test(email)) return { ok: false, reason: 'bad_shape' };
  return { ok: true, email };
}

export const EMAIL_CHECK_COPY: Record<'empty' | 'not_ascii' | 'bad_shape', string> = {
  empty: 'Type your email address.',
  not_ascii: 'Please type the address with plain letters and numbers only.',
  bad_shape: 'That doesn\u2019t look like an email address.',
};

/** "a***@x.com": the first character, then stars, then the domain. */
export function maskTypedEmail(email: string): string {
  const e = email.trim();
  const at = e.lastIndexOf('@');
  if (at < 1) return e;
  return `${e[0]}***${e.slice(at)}`;
}

export interface BindCopy {
  text: string;
  /** retry = stay on the type-your-email step; stop = the link cannot be used here. */
  next: 'continue' | 'retry' | 'stop';
}

const ASK = (inviter: string | null | undefined) => (inviter ? inviter : 'the person who sent it');

/** THE status -> words map, used by the step and its tests. */
export function bindCopy(status: BindStatus, inviterFirstName?: string | null): BindCopy {
  switch (status) {
    case 'bound':
      return { text: 'Great. Now sign in with that email.', next: 'continue' };
    case 'already_bound':
      return { text: `This link was already used with an email. Ask ${ASK(inviterFirstName)} for a new link.`, next: 'stop' };
    case 'not_open':
      return { text: `This link isn’t active any more. Ask ${ASK(inviterFirstName)} for a new one.`, next: 'stop' };
    case 'bad_email':
      return { text: 'That doesn’t look like an email address.', next: 'retry' };
    case 'rate_limited':
      return { text: 'Too many tries. Wait a few minutes and try again.', next: 'retry' };
  }
}

export const BIND_UNAVAILABLE_COPY = 'This isn’t available yet. Please try again later.';
export const BIND_FAILED_COPY = 'We could not save that. Check your connection and try again.';

/** The RPC does not exist on the server until the migration is applied: degrade to "try again later". */
const FUNCTION_MISSING = /(could not find the function|function .* does not exist|PGRST202|42883)/i;

/** bind_organiser_invite_email_v1's answer (or error) -> one outcome. */
export function interpretBind(data: unknown, error: { message?: string; code?: string } | null): BindOutcome {
  if (error) return FUNCTION_MISSING.test(`${error.code ?? ''} ${error.message ?? ''}`) ? { kind: 'unavailable' } : { kind: 'failed' };
  const status = (data as { status?: unknown } | null)?.status;
  return typeof status === 'string' && STATUSES.includes(status) ? { kind: 'status', status: status as BindStatus } : { kind: 'failed' };
}
