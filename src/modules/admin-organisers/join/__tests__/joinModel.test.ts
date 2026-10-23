/**
 * The pure join model: the preview contract (A2's `person` / `prefill` objects), the step table's edge
 * rows, the outcome mappings, and the copy rule (PLAN.md section 3: every string says what to do next
 * and never shows a raw code).
 */
import { describe, expect, it } from 'vitest';
import { JOIN_COPY, inviterName } from '../joinCopy';
import {
  checkTypedEmail, classifySendError, classifyVerifyError, codeStepFromSearch, codeStepSearch, deriveJoinStep, failureTag,
  interpretBind, interpretJoinRedeem, isPersonBound, joinProgress, parseJoinPreview, type DeriveInput,
} from '../joinModel';

const OPEN = { status: 'open', organiser_name: 'Sensual Vibes', inviter_first_name: 'Ricky', email_hint: null };

describe('parseJoinPreview: the A2 contract (person / prefill objects)', () => {
  it('person present = a person-bound invite; only first name, photo and city are read', () => {
    const p = parseJoinPreview({ ...OPEN, person: { first_name: 'Papacito', avatar_url: 'https://x/p.jpg', city: 'London', person_profile_id: 'leak', email: 'leak@x' } });
    expect(p?.person).toEqual({ firstName: 'Papacito', avatarUrl: 'https://x/p.jpg', city: 'London' });
    expect(JSON.stringify(p)).not.toMatch(/leak/);
    expect(isPersonBound(p)).toBe(true);
  });
  it.each([
    ['absent', {}],
    ['null', { person: null }],
    ['not an object', { person: 'Papacito' }],
    ['an array', { person: [] }],
    ['flat legacy keys (ignored)', { person_profile_id: 'p1', person_first_name: 'Papacito' }],
  ])('person %s = a page invite', (_n, extra) => {
    const p = parseJoinPreview({ ...OPEN, ...extra });
    expect(p?.person).toBeNull();
    expect(isPersonBound(p)).toBe(false);
  });
  it('person with empty fields is still person-bound (the card falls back to "Hi there")', () => {
    expect(parseJoinPreview({ ...OPEN, person: {} })?.person).toEqual({ firstName: null, avatarUrl: null, city: null });
  });
  it('prefill = { first_name, city_id }; absent or malformed = null', () => {
    expect(parseJoinPreview({ ...OPEN, prefill: { first_name: 'Ana', city_id: 'c1' } })?.prefill).toEqual({ firstName: 'Ana', cityId: 'c1' });
    expect(parseJoinPreview({ ...OPEN, prefill: { first_name: '  ', city_id: 7 } })?.prefill).toEqual({ firstName: null, cityId: null });
    expect(parseJoinPreview({ ...OPEN })?.prefill).toBeNull();
    expect(parseJoinPreview({ ...OPEN, prefill: 'Ana' })?.prefill).toBeNull();
  });
  it('an unknown link (no status) is null; a bad status is rejected like the base parser', () => {
    expect(parseJoinPreview({})).toBeNull();
    expect(parseJoinPreview(null)).toBeNull();
    expect(parseJoinPreview({ ...OPEN, status: 'expired' })?.status).toBe('expired');
  });
});

const base: DeriveInput = {
  preview: parseJoinPreview(OPEN),
  authStatus: 'ready',
  user: null,
  url: { step: null, email: null },
  completion: 'signed_out',
  member: null,
  redeemed: false,
  usedCheckPending: false,
};
const me = { email: 'ana@example.com' };

describe('deriveJoinStep: the edge rows the page table does not reach', () => {
  it.each<[string, Partial<DeriveInput>, string]>([
    ['loading preview', { preview: 'loading' }, 'checking'],
    ['preview lookup failed', { preview: 'failed' }, 'unreachable'],
    ['redeemed this visit, signed out meanwhile: still done', { redeemed: true }, 'done'],
    ['redeemed this visit beats a dead re-read', { preview: parseJoinPreview({ ...OPEN, status: 'used' }), redeemed: true }, 'done'],
    ['unknown link', { preview: null }, 'dead'],
    ['dead link while auth resolves waits', { preview: parseJoinPreview({ ...OPEN, status: 'expired' }), authStatus: 'resolving' }, 'checking'],
    ['used link, signed in, the used-by-me check in flight', { preview: parseJoinPreview({ ...OPEN, status: 'used' }), user: me, usedCheckPending: true }, 'checking'],
    ['used link, signed out: never a redeem check', { preview: parseJoinPreview({ ...OPEN, status: 'used' }), usedCheckPending: true }, 'dead'],
    ['open link while auth resolves', { authStatus: 'resolving' }, 'checking'],
    ['signed out, ?step=code with a bad email falls back to email', { url: { step: 'code', email: 'nope' } }, 'email'],
    ['signed out, ?step=code with an email', { url: { step: 'code', email: 'ana@example.com' } }, 'code'],
    ['signed in: ?step=code is ignored', { user: me, url: { step: 'code', email: 'ana@example.com' }, completion: 'complete', member: false }, 'join'],
    ['member known before completeness', { user: me, completion: 'loading', member: true }, 'done'],
    ['completeness loading', { user: me, completion: 'loading', member: false }, 'checking'],
    ['completeness read failed', { user: me, completion: 'error', member: false }, 'unreachable'],
    ['no dancer profile at all', { user: me, completion: 'no_profile', member: false }, 'no_profile'],
    ['incomplete before the member list answers', { user: me, completion: 'incomplete', member: null }, 'about'],
    ['complete, member list still reading', { user: me, completion: 'complete', member: null }, 'checking'],
    ['bound to another email, even for a member', { preview: parseJoinPreview({ ...OPEN, email_hint: 'z***@other.com' }), user: me, completion: 'complete', member: true }, 'wrong_account'],
    ['bound to this email', { preview: parseJoinPreview({ ...OPEN, email_hint: 'a***@example.com' }), user: me, completion: 'complete', member: false }, 'join'],
  ])('%s', (_n, over, step) => {
    expect(deriveJoinStep({ ...base, ...over }).step).toBe(step);
  });
  it('a dead link carries its reason', () => {
    expect(deriveJoinStep({ ...base, preview: parseJoinPreview({ ...OPEN, status: 'revoked' }) })).toEqual({ step: 'dead', reason: 'revoked' });
    expect(deriveJoinStep({ ...base, preview: null })).toEqual({ step: 'dead', reason: 'invalid' });
  });
});

describe('joinProgress: 1 of 3 over email/code, about, join; a complete account skips About you', () => {
  it.each<[string, Parameters<typeof joinProgress>[1], string | null]>([
    ['email', 'signed_out', 'Step 1 of 3'],
    ['code', 'signed_out', 'Step 1 of 3'],
    ['about', 'incomplete', 'Step 2 of 3'],
    ['join', 'incomplete', 'Step 3 of 3'],
    ['join', 'complete', 'Step 2 of 2'],
    ['done', 'complete', 'Step 2 of 2'],
    ['dead', 'signed_out', null],
    ['wrong_account', 'complete', null],
    ['checking', 'loading', null],
  ])('%s / %s -> %s', (step, completion, label) => {
    const p = joinProgress(step as Parameters<typeof joinProgress>[0], completion);
    expect(p ? `Step ${p.n} of ${p.total}` : null).toBe(label);
  });
});

describe('the code step in the URL', () => {
  it('round-trips a trimmed, lower-cased email and refuses anything else', () => {
    expect(codeStepFromSearch(codeStepSearch('  Ana@Example.com '))).toBe('ana@example.com');
    expect(codeStepFromSearch('?step=code&email=nope')).toBeNull();
    expect(codeStepFromSearch('?step=email&email=ana%40example.com')).toBeNull();
    expect(codeStepFromSearch('')).toBeNull();
  });
});

describe('checkTypedEmail', () => {
  it.each([
    ['', 'empty'], ['   ', 'empty'], ['ana@exämple.com', 'not_ascii'], ['ana @example.com', 'not_ascii'], ['ana-at-example.com', 'bad_shape'], ['ana@example', 'bad_shape'],
  ])('%j -> %s', (raw, reason) => {
    expect(checkTypedEmail(raw)).toEqual({ ok: false, reason });
  });
  it('accepts and normalises', () => {
    expect(checkTypedEmail('  Ana@Example.com ')).toEqual({ ok: true, email: 'ana@example.com' });
  });
});

describe('outcome mappings', () => {
  it.each([
    [{ status: 403, message: 'Sign-up with this email provider is not accepted' }, 'blocked_domain'],
    [{ status: 403, message: 'Sign-up is limited to approved organisers.' }, 'blocked_domain'],
    [{ status: 429, message: 'over_email_send_rate_limit' }, 'rate_limited'],
    [{ message: 'Email rate limit exceeded' }, 'rate_limited'],
    [new Error('Failed to fetch'), 'network'],
    [null, 'network'],
  ])('classifySendError(%j) -> %s', (err, kind) => {
    expect(classifySendError(err).kind).toBe(kind);
  });
  it.each([
    [{ status: 403, message: 'Token has expired or is invalid' }, 'wrong_code'],
    [{ status: 400, message: 'otp_expired' }, 'wrong_code'],
    [{ status: 429, message: 'rate limit' }, 'rate_limited'],
    [new Error('Failed to fetch'), 'network'],
  ])('classifyVerifyError(%j) -> %s', (err, why) => {
    expect(classifyVerifyError(err)).toBe(why);
  });
  it('interpretBind: every status, a missing function is "unavailable", anything else failed', () => {
    for (const status of ['bound', 'already_bound', 'not_open', 'bad_email', 'rate_limited']) expect(interpretBind({ status }, null)).toEqual({ kind: 'status', status });
    expect(interpretBind(null, { code: 'PGRST202', message: 'Could not find the function public.bind_organiser_invite_email_v1' })).toEqual({ kind: 'unavailable' });
    expect(interpretBind(null, { message: 'network' })).toEqual({ kind: 'failed' });
    expect(interpretBind({ status: 'weird' }, null)).toEqual({ kind: 'failed' });
  });
  it.each<[unknown, { message?: string } | null, string]>([
    [{ ok: true, status: 'redeemed', organiser_id: 'o1' }, null, 'done'],
    [{ ok: true, status: 'already_member' }, null, 'done'],
    [{ ok: false, reason: 'not_linked' }, null, 'not_linked'],
    [{ ok: false, reason: 'used' }, null, 'dead'],
    [{ ok: false, reason: 'expired' }, null, 'dead'],
    [{ ok: false, reason: 'revoked' }, null, 'dead'],
    [{ ok: false, reason: 'invalid' }, null, 'dead'],
    [{ ok: false, reason: 'email_mismatch', invite_email_hint: 'z***@o.com' }, null, 'wrong_account'],
    [{ ok: false, reason: 'email_unproven' }, null, 'email_unproven'],
    [{ ok: false, reason: 'rate_limited' }, null, 'rate_limited'],
    [{ ok: false, reason: 'profile_incomplete' }, null, 'profile_incomplete'],
    [{ ok: false, reason: 'sign_in_required' }, null, 'sign_in'],
    [{ ok: false, reason: 'unconfirmed_account' }, null, 'sign_in'],
    [{ ok: false, reason: 'team_full' }, null, 'refused'],
    [{ ok: false }, null, 'failed'],
    [null, { message: 'authentication_required' }, 'sign_in'],
    [null, { message: 'profile_incomplete' }, 'profile_incomplete'],
    [null, { message: 'network' }, 'failed'],
  ])('interpretJoinRedeem(%j, %j) -> %s', (data, error, kind) => {
    expect(interpretJoinRedeem(data, error).kind).toBe(kind);
  });
  it('the refusal keeps the server reason and masked hint; done keeps the organiser id and already_member', () => {
    expect(interpretJoinRedeem({ ok: false, reason: 'team_full', invite_email_hint: 'z***@o.com' }, null)).toEqual({ kind: 'refused', reason: 'team_full', emailHint: 'z***@o.com' });
    expect(interpretJoinRedeem({ ok: true, status: 'already_member', organiser_id: 'o1' }, null)).toEqual({ kind: 'done', organiserId: 'o1', alreadyMember: true });
  });
  it('the failure tag is step + code, nothing else', () => {
    expect(failureTag('join', 'not_linked')).toBe('invite_join:join:not_linked');
  });
});

/** Every string the person can read, with the functions called on sample arguments. */
function allCopy(node: unknown, path: string, out: Array<[string, string]>): void {
  if (typeof node === 'string') out.push([path, node]);
  else if (typeof node === 'function') out.push([path, String((node as (...a: unknown[]) => unknown)('Sensual Vibes', 'z***@other.com'))]);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) allCopy(v, `${path}.${k}`, out);
}

describe('the copy rule (PLAN.md section 3): plain English, what to do next, never a raw code', () => {
  const strings: Array<[string, string]> = [];
  allCopy(JOIN_COPY, 'JOIN_COPY', strings);
  const RAW_CODES = /\b(not_linked|email_mismatch|email_unproven|rate_limited|already_bound|already_member|blocked_domain|profile_incomplete|sign_in_required|unconfirmed_account|invalid|PGRST|P0001|42883|403|429|null|undefined)\b/;

  it('has strings to check', () => expect(strings.length).toBeGreaterThan(40));
  it.each(strings.filter(([p]) => !p.endsWith('helpUrl')))('%s never shows a raw code', (_p, text) => {
    expect(text).not.toMatch(RAW_CODES);
    expect(text).not.toMatch(/[_{}[\]<>]/);
  });
  it('every refusal and failure screen says what the person can do next', () => {
    for (const key of ['notLinked', 'blockedDomain', 'rateLimited', 'network', 'emailUnproven', 'alreadyBound', 'noProfile'] as const) {
      const screen = JOIN_COPY[key] as Record<string, unknown>;
      const text = Object.values(screen).map((v) => (typeof v === 'function' ? String((v as (a: string) => string)('Ricky')) : String(v))).join(' ');
      expect(text, key).toMatch(/\b(try again|use another|ask|message us|sign out|sort it out|wait|check)\b/i);
    }
  });
  it('no raw Unicode punctuation in the source file (CLAUDE.md: entities / escapes only)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../joinCopy.ts', import.meta.url), 'utf-8');
    // The two escapes are defined once at the top as \u escapes; no literal glyph anywhere else.
    expect(src.split('\n').filter((l) => /[‘’“”…—]/.test(l) && !/const (APOS|ELLIPSIS) = /.test(l))).toEqual([]);
  });
  it('inviterName falls back to "the person who sent it"', () => {
    expect(inviterName('  ')).toBe('the person who sent it');
    expect(inviterName('Ricky')).toBe('Ricky');
  });
});
