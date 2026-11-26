// Class invite landing page: the three database calls and their typed answers. No React.
import { rpcLoose } from '@/integrations/supabase/rpcLoose';

export type PeekStatus = 'open' | 'claimed' | 'revoked' | 'expired' | 'invalid';
export type Peek = {
  status: PeekStatus;
  displayName: string | null;
  eventName: string | null;
  classTitle: string | null;
  nightDate: string | null;
  forward: boolean;
};
export type Redeemed = {
  already: boolean;
  eventName: string | null;
  classTitle: string | null;
  firstDate: string | null;
};
export type JoinCode =
  | 'sign_in_required' | 'invite_invalid' | 'invite_closed' | 'invite_revoked' | 'invite_expired' | 'no_teacher_profile';

const CODES: JoinCode[] = ['sign_in_required', 'invite_invalid', 'invite_closed', 'invite_revoked', 'invite_expired', 'no_teacher_profile'];
const STATUSES: PeekStatus[] = ['open', 'claimed', 'revoked', 'expired', 'invalid'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** The pinned code inside an error message (Postgres may prefix it); null when unknown. */
export function codeOf(error: unknown): JoinCode | null {
  const msg = typeof error === 'string' ? error : (error as { message?: unknown } | null)?.message;
  if (typeof msg !== 'string') return null;
  return CODES.find((c) => new RegExp(`\\b${c}\\b`).test(msg)) ?? null;
}

/** "Ana Lopez" -> "Ana". */
export function firstName(displayName: string | null): string {
  return (displayName ?? '').trim().split(/\s+/)[0] ?? '';
}

/** "Ana Lopez" -> { first: "Ana", surname: "Lopez" }; split on the first space. */
export function splitName(displayName: string | null): { first: string; surname: string } {
  const t = (displayName ?? '').trim();
  const i = t.indexOf(' ');
  return i < 0 ? { first: t, surname: '' } : { first: t.slice(0, i), surname: t.slice(i + 1).trim() };
}

export async function peekClassInvite(token: string): Promise<Peek> {
  const { data, error } = await rpcLoose('peek_class_invite_v1', { p_token: token });
  if (error) throw new Error(error.message);
  if (!isObj(data)) throw new Error('malformed_answer');
  const s = STATUSES.find((x) => x === data.status) ?? 'invalid';
  const status: PeekStatus = s === 'open' && data.valid === false ? 'invalid' : s;
  return {
    status, displayName: str(data.display_name), eventName: str(data.event_name), classTitle: str(data.class_title),
    nightDate: str(data.night_date), forward: data.forward === true,
  };
}

export async function redeemClassInvite(token: string): Promise<Redeemed> {
  const { data, error } = await rpcLoose('redeem_class_invite_v1', { p_token: token });
  if (error) throw new Error(error.message);
  if (!isObj(data)) throw new Error('malformed_answer');
  return { already: data.already === true, eventName: str(data.event_name), classTitle: str(data.class_title), firstDate: str(data.first_date) };
}

export async function ensureMyProfile(): Promise<void> {
  const { error } = await rpcLoose('ensure_my_dancer_profile_v1');
  if (error) throw new Error(error.message);
}

/** "2026-11-26" (or a timestamp starting with it) -> "Thursday 26 November". */
export function longDay(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...o, timeZone: 'UTC' }).format(d);
  return `${f({ weekday: 'long' })} ${f({ day: 'numeric' })} ${f({ month: 'long' })}`;
}

export const joinReturnTo = (token: string): string => `/join/class/${token}`;
export const joinAuthHref = (token: string, mode: 'signup' | 'signin'): string =>
  `/auth?mode=${mode}&returnTo=${encodeURIComponent(joinReturnTo(token))}`;
