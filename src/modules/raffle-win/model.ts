// Raffle v3 winner page: the pure state table (reason -> screen). No React, no network.
// RPC shapes read from admin migrations 20261121133453 (claim) and 20261121133455 (lock v2).

import { orderMissing, type ProfileField } from './profileFields';

export type WinScreen =
  | 'loading' | 'error' | 'won' | 'claim' | 'pick' | 'honest' | 'share' | 'qr' | 'none' | 'cancel' | 'other';

export type OpenNight = {
  occurrenceId: string; title: string; startLocal: string;
  venueName: string | null; posterUrl: string | null; publicEventId: string | null;
  /** Optional pick-list keys; a missing key means today's behaviour. */
  featured?: boolean; organiserName?: string | null; needsTick?: boolean; tickOrganiser?: boolean;
};

export type ClaimResult =
  | { kind: 'ok'; winId: string; state: string; qrToken: string | null; night: OpenNight | null; nights: OpenNight[]; firstName: string | null }
  | { kind: 'refused'; reason: string }
  | { kind: 'error' };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

export function parseNight(raw: unknown): OpenNight | null {
  if (!isObj(raw)) return null;
  const occurrenceId = str(raw.occurrence_id);
  const startLocal = str(raw.start_local);
  if (!occurrenceId || !startLocal) return null;
  return { occurrenceId, title: str(raw.title) ?? 'Bachata night', startLocal,
    venueName: str(raw.venue_name), posterUrl: str(raw.poster_url), publicEventId: str(raw.public_event_id),
    featured: raw.featured === true ? true : undefined, organiserName: str(raw.organiser_name) ?? undefined,
    needsTick: raw.needs_tick === false ? false : undefined, tickOrganiser: raw.tick_organiser === true ? true : undefined,
  };
}

export function parseClaim(data: unknown): ClaimResult {
  if (!isObj(data)) return { kind: 'error' };
  if (data.ok !== true) return { kind: 'refused', reason: str(data.reason) ?? 'unknown' };
  const win = isObj(data.win) ? data.win : null;
  const winId = win ? str(win.id) : null;
  if (!win || !winId) return { kind: 'error' };
  const nights = Array.isArray(data.open_nights)
    ? data.open_nights.map(parseNight).filter((n): n is OpenNight => n !== null)
    : [];
  return { kind: 'ok', winId, state: str(win.state) ?? '', qrToken: str(win.qr_token), night: parseNight(win.night), nights, firstName: str(data.first_name) };
}

/** claim result -> first screen. `fromAuth`: the person just came back from sign-in. */
export function screenForClaim(r: ClaimResult, opts: { fromAuth: boolean }): WinScreen {
  if (r.kind === 'error') return 'error';
  if (r.kind === 'refused') return r.reason === 'bound_to_other_account' ? 'other' : 'cancel'; // link_not_found, link_expired, unknown
  if (r.state === 'locked' && r.qrToken) return 'qr';
  if (r.nights.length === 0) return 'none';
  return opts.fromAuth ? 'pick' : 'won';
}

export type LockOutcome =
  | { kind: 'qr'; qrToken: string; night: OpenNight | null; firstName: string | null }
  | { kind: 'back-to-pick'; line: string; reason: string; dropNight: boolean }
  | { kind: 'screen'; screen: WinScreen }
  | { kind: 'profile'; missing: ProfileField[] }
  | { kind: 'error' };

export const LOCK_LINES: Record<string, string> = {
  spot_taken: 'Someone else just took that night. Pick another.',
  night_not_open: 'That night is no longer open. Pick another.',
  honesty_required: 'Please tick the box to confirm.',
};

export function parseLock(data: unknown): LockOutcome {
  if (!isObj(data)) return { kind: 'error' };
  if (data.ok === true) {
    const win = isObj(data.win) ? data.win : null;
    const qrToken = (win && str(win.qr_token)) || str(data.qr_token);
    return qrToken ? { kind: 'qr', qrToken, night: win ? parseNight(win.night) : null, firstName: str(data.first_name) } : { kind: 'error' };
  }
  const reason = str(data.reason) ?? 'unknown';
  if (reason === 'profile_incomplete') {
    const names = Array.isArray(data.missing) ? data.missing : [];
    return { kind: 'profile', missing: orderMissing(names) }; // unknown names ignored
  }
  if (reason === 'not_found') return { kind: 'screen', screen: 'cancel' };
  if (reason === 'not_claimable') return { kind: 'screen', screen: 'cancel' };
  if (reason === 'honesty_required') return { kind: 'back-to-pick', line: LOCK_LINES[reason], reason, dropNight: false };
  // Silent: the event just leaves the list. No sentence names it (owner 2026-11-27).
  if (reason === 'already_been_to_event') return { kind: 'back-to-pick', line: '', reason, dropNight: true };
  if (reason in LOCK_LINES) return { kind: 'back-to-pick', line: LOCK_LINES[reason], reason, dropNight: true };
  return { kind: 'error' };
}

/** Lock confirmed in this visit -> next screen. Share step only with the flag on. */
export const screenAfterLock = (sharePoster: boolean): WinScreen => (sharePoster ? 'share' : 'qr');

/** The in-page tap table: current screen + tap -> next screen. */
export const NEXT: Record<string, Partial<Record<string, WinScreen>>> = {
  won: { chooseNight: 'pick' },
  pick: { lock: 'honest' },
  honest: { back: 'pick' },
  share: { skip: 'qr' },
  none: { refetch: 'loading' },
};

/** 'YYYY-MM-DDTHH:MM:SS' is London local as stored: format the parts, never convert zones. */
export function formatLocalNight(startLocal: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(startLocal);
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
  return `${day}, ${m[4]}:${m[5]}`;
}

export const winReturnTo = (token: string): string => `/raffle/win/${token}`;
export const winAuthHref = (token: string): string => `/auth?returnTo=${encodeURIComponent(winReturnTo(token))}`;
export const doorUrl = (origin: string, qrToken: string): string => `${origin}/raffle/door/${qrToken}`;
