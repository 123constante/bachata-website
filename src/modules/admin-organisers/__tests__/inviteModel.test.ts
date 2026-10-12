import { describe, expect, it } from 'vitest';
import {
  ACCESS_LABEL,
  ADD_PERSON_CODES,
  ADMIN_COPY,
  REDEEM_COPY,
  REDEEM_FALLBACK,
  accessStatus,
  adminErrorMessage,
  interpretRedeem,
  inviteUrl,
  parseInvites,
  rowActions,
  statusDetail,
  whatsappHref,
  type AccessStatus,
  type InviteRow,
  type InviteStatus,
} from '../inviteModel';

const inv = (status: InviteStatus, issuedAt = '2026-10-01T10:00:00Z'): InviteRow => ({
  inviteId: `i-${status}-${issuedAt}`, status, issuedAt, expiresAt: '2026-10-08T10:00:00Z', usedAt: null, revokedAt: null,
});

describe('accessStatus x invite state (the one mapping)', () => {
  // [managed, newest invite state, expected status]
  const table: [boolean, InviteStatus | 'none', AccessStatus][] = [
    [false, 'none', 'unclaimed'],
    [false, 'sent', 'invited'],
    [false, 'expired', 'invite_expired'],
    [false, 'used', 'unclaimed'],
    [false, 'revoked', 'unclaimed'],
    [true, 'none', 'managed'],
    [true, 'sent', 'managed'],
    [true, 'used', 'managed'],
  ];
  it.each(table)('managed=%s newest=%s -> %s', (managed, state, expected) => {
    expect(accessStatus(managed, state === 'none' ? [] : [inv(state)])).toBe(expected);
  });
  it('the newest invite wins, whatever order the server lists them', () => {
    const old = inv('expired', '2026-09-01T10:00:00Z');
    const live = inv('sent', '2026-10-05T10:00:00Z');
    expect(accessStatus(false, [live, old])).toBe('invited');
    expect(accessStatus(false, [old, live])).toBe('invited');
  });
  it('unloaded invites give no status rather than a guess, but managed needs no invites', () => {
    expect(accessStatus(false, null)).toBeNull();
    expect(accessStatus(true, null)).toBe('managed');
  });
  it('every status has a label', () => {
    expect(Object.keys(ACCESS_LABEL).sort()).toEqual(['invite_expired', 'invited', 'managed', 'unclaimed']);
  });
});

describe('rowActions x status', () => {
  it.each([
    ['unclaimed', { gen: true, confirms: false, revoke: false }],
    ['invited', { gen: true, confirms: true, revoke: true }],
    ['invite_expired', { gen: true, confirms: false, revoke: false }],
    ['managed', { gen: true, confirms: false, revoke: false }],
  ] as const)('%s', (status, want) => {
    const a = rowActions(status, status === 'invited' ? [inv('sent')] : []);
    expect([a.canGenerate, a.generateConfirms, a.canRevoke]).toEqual([want.gen, want.confirms, want.revoke]);
    // a control that cannot work says why
    if (!a.canRevoke) expect(a.revokeNote).toMatch(/no live link/);
    if (a.canRevoke) expect(a.revokeNote).toBeNull();
    expect(a.canAddPerson).toBe(true);
  });
  it('while the links load, generate and revoke are off with a reason', () => {
    const a = rowActions(null);
    expect(a.canGenerate).toBe(false);
    expect(a.canRevoke).toBe(false);
    expect(a.generateNote).toBeTruthy();
    expect(a.revokeNote).toBeTruthy();
  });
  it('detail text names the expiry of a live link and says when nothing was sent', () => {
    const f = (iso: string) => iso.slice(0, 10);
    expect(statusDetail('invited', [inv('sent')], f)).toBe('Link works until 2026-10-08.');
    expect(statusDetail('unclaimed', [], f)).toBe('No link sent yet.');
    expect(statusDetail('unclaimed', [inv('revoked')], f)).toMatch(/revoked/);
  });
});

describe('parseInvites', () => {
  it('drops shapeless rows and unknown statuses', () => {
    const rows = parseInvites([{ invite_id: 'a', status: 'sent', issued_at: 'x', expires_at: 'y' }, { invite_id: 'b', status: 'weird' }, { status: 'sent' }, 'x']);
    expect(rows.map((r) => r.inviteId)).toEqual(['a']);
    expect(parseInvites(null)).toEqual([]);
  });
});

describe('the link', () => {
  const token = 'ab'.repeat(32);
  it('builds the shareable path and a WhatsApp message with no phone number', () => {
    const link = inviteUrl('https://example.test', token);
    expect(link).toBe(`https://example.test/invite/${token}`);
    const href = whatsappHref('Ritmo', link);
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(href.slice('https://wa.me/?text='.length))).toContain(link);
    expect(href).not.toMatch(/wa\.me\/\d/);
    const text = decodeURIComponent(href.slice('https://wa.me/?text='.length));
    expect(text).toMatch(/sign in/i);
    expect(text).toMatch(/first name, city, dance role, photo/);
    expect(text).toMatch(/works once/);
    expect(text).toMatch(/7 days/);
  });
});

describe('redeem: every reason has its own message', () => {
  // The reasons redeem_organiser_invite_v1 returns (live body 2026-10-11, incl. 4b's unconfirmed_account)
  // plus the raised authentication_required.
  const REASONS = ['sign_in_required', 'unconfirmed_account', 'rate_limited', 'invalid', 'used', 'revoked', 'expired', 'authentication_required'];
  it('has copy for each, all distinct', () => {
    expect(REASONS.filter((r) => !(r in REDEEM_COPY))).toEqual([]);
    const bodies = REASONS.map((r) => REDEEM_COPY[r].body);
    expect(new Set(bodies).size).toBe(bodies.length);
  });
  it.each(REASONS)('%s: says what the person can do, and never points at a control that is not on screen', (reason) => {
    const c = REDEEM_COPY[reason];
    expect(c.body.length).toBeGreaterThan(20);
    // The screen only ever has a Sign in link, a Try again button and a home link, and the body names none of them.
    expect(c.body).not.toMatch(/\b(tap|click|press|button|menu|tab)\b/i);
    // Finished-with links say who to ask; recoverable ones say what to do.
    if (c.terminal) expect(c.body).toMatch(/Ask the admin who sent it for a new link|ask the admin/i);
    if (c.action === 'sign_in') expect(c.body).toMatch(/[Ss]ign in/);
  });
  it('terminal reasons strip the token; recoverable ones keep it for the retry', () => {
    expect(['invalid', 'used', 'revoked', 'expired'].every((r) => REDEEM_COPY[r].terminal)).toBe(true);
    expect(['sign_in_required', 'unconfirmed_account', 'rate_limited', 'authentication_required'].every((r) => !REDEEM_COPY[r].terminal)).toBe(true);
  });
  it('interprets the RPC answers', () => {
    expect(interpretRedeem({ ok: true, status: 'redeemed', organiser_id: 'o1' }, null)).toEqual({ kind: 'redeemed', organiserId: 'o1', alreadyMember: false });
    expect(interpretRedeem({ ok: true, status: 'already_member', organiser_id: 'o1', member_role: 'manager' }, null)).toEqual({ kind: 'redeemed', organiserId: 'o1', alreadyMember: true });
    for (const r of REASONS.filter((x) => x !== 'authentication_required')) {
      const out = interpretRedeem({ ok: false, reason: r }, null);
      expect(out).toMatchObject({ kind: 'refused', reason: r });
    }
    expect(interpretRedeem(null, { message: 'authentication_required' })).toMatchObject({ kind: 'refused', reason: 'authentication_required' });
  });
  it('an unknown reason, a network error or a malformed answer is a retryable failure, never raw text', () => {
    for (const out of [interpretRedeem({ ok: false, reason: 'from_the_future' }, null), interpretRedeem(null, { message: 'Failed to fetch' }), interpretRedeem({ ok: true }, null), interpretRedeem(undefined, null)]) {
      expect(out).toEqual({ kind: 'failed', copy: REDEEM_FALLBACK });
    }
    expect(REDEEM_FALLBACK.action).toBe('retry');
  });
});

describe('admin write refusals', () => {
  // Every code admin_add_entity_member_v1 and the invite RPCs can raise (live bodies, 2026-10-11).
  const SERVER_CODES = [
    'authentication_required', 'not_authorised', 'actor_required', 'organiser_not_found', 'invalid_member_role',
    'ambassador_only_on_city', 'use_transfer', 'user_not_found', 'unconfirmed_email',
  ];
  it('has plain-English copy for every code', () => {
    expect(SERVER_CODES.filter((c) => !ADD_PERSON_CODES.includes(c))).toEqual([]);
    for (const c of SERVER_CODES) expect(adminErrorMessage({ message: c })).toBe(ADMIN_COPY[c]);
  });
  it('never surfaces raw server text and does not confuse a code with a longer one', () => {
    expect(adminErrorMessage({ message: 'permission denied for table x' })).toBe('Something went wrong. Please try again.');
    expect(adminErrorMessage({ message: 'some_future_code' })).toBe('Something went wrong. Please try again.');
    expect(adminErrorMessage(null)).toBe('Something went wrong. Please try again.');
  });
});
