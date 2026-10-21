import { describe, expect, it } from 'vitest';
import type { AccessStatus, InviteRow } from '../inviteModel';
import {
  INVITE_CHOICES,
  ISSUE_REFUSAL,
  ISSUE_REFUSALS,
  LOAD_FAILED_NOTE,
  LOADING_NOTE,
  PRIMARY_LABEL,
  PRIMARY_OPENS,
  RESOLVE_REFUSALS,
  SENDER_LABEL,
  linkBlockedReason,
  orderAccessRequests,
  parseAccessRequests,
  parseInviteRequests,
  parseIssueResult,
  parseResolveResult,
  pendingInviteRequests,
  resolveRefusalMessage,
  senderActions,
  senderDetail,
} from '../senderModel';

const row = (status: InviteRow['status'], extra: Partial<InviteRow> = {}): InviteRow => ({
  inviteId: `i-${status}`, status, issuedAt: '2026-10-14T10:00:00Z', expiresAt: '2026-10-28T10:00:00Z', usedAt: null, revokedAt: null, ...extra,
});
const fmt = (iso: string) => iso.slice(0, 10);

// Every invite status x the sender's primary button x its disabled reason x Withdraw.
const MATRIX: { name: string; status: AccessStatus | null; invites: InviteRow[]; loadError?: boolean; label: string; opens: 'choose' | 'link'; disabled: string | null; withdraw: boolean; replaces: boolean; chip: string | null; detail: string }[] = [
  { name: 'loading', status: null, invites: [], label: 'Invite', opens: 'choose', disabled: LOADING_NOTE, withdraw: false, replaces: false, chip: null, detail: '' },
  { name: 'load failed', status: null, invites: [], loadError: true, label: 'Invite', opens: 'choose', disabled: LOAD_FAILED_NOTE, withdraw: false, replaces: false, chip: null, detail: '' },
  { name: 'unclaimed, never invited (5a)', status: 'unclaimed', invites: [], label: 'Invite', opens: 'choose', disabled: null, withdraw: false, replaces: false, chip: 'Unclaimed', detail: 'No link sent yet.' },
  { name: 'unclaimed, last revoked', status: 'unclaimed', invites: [row('revoked')], label: 'Invite', opens: 'choose', disabled: null, withdraw: false, replaces: false, chip: 'Unclaimed', detail: 'The last link was withdrawn.' },
  { name: 'unclaimed, last used, owner left', status: 'unclaimed', invites: [row('used')], label: 'Invite', opens: 'choose', disabled: null, withdraw: false, replaces: false, chip: 'Unclaimed', detail: 'The last link was used, but the owner has since left.' },
  { name: 'invited (5d)', status: 'invited', invites: [row('sent')], label: 'Copy new link', opens: 'link', disabled: null, withdraw: true, replaces: true, chip: 'Invited', detail: 'Works until 2026-10-28.' },
  { name: 'invited, load failed', status: 'invited', invites: [row('sent')], loadError: true, label: 'Copy new link', opens: 'link', disabled: LOAD_FAILED_NOTE, withdraw: true, replaces: true, chip: 'Invited', detail: 'Works until 2026-10-28.' },
  { name: 'expired (5e)', status: 'invite_expired', invites: [row('expired')], label: 'Send a new link', opens: 'link', disabled: null, withdraw: false, replaces: false, chip: 'Link ran out', detail: 'Ran out on 2026-10-28.' },
  { name: 'managed, joined by link (5f)', status: 'managed', invites: [row('used', { usedAt: '2026-10-21T09:00:00Z' })], label: 'Add another person', opens: 'choose', disabled: null, withdraw: false, replaces: false, chip: 'Managed', detail: 'Has an owner. Joined 2026-10-21.' },
  { name: 'managed, no invite history', status: 'managed', invites: [], label: 'Add another person', opens: 'choose', disabled: null, withdraw: false, replaces: false, chip: 'Managed', detail: 'Has an owner.' },
  { name: 'managed, live link too', status: 'managed', invites: [row('sent')], label: 'Add another person', opens: 'choose', disabled: null, withdraw: true, replaces: true, chip: 'Managed', detail: 'Has an owner. A link works until 2026-10-28.' },
];

describe('sender row: status x button x disabled reason', () => {
  it.each(MATRIX)('$name', (c) => {
    const a = senderActions(c.status, c.invites, c.loadError);
    expect(PRIMARY_LABEL[a.primary]).toBe(c.label);
    expect(PRIMARY_OPENS[a.primary]).toBe(c.opens);
    expect(a.primaryDisabled).toBe(c.disabled);
    expect(a.showWithdraw).toBe(c.withdraw);
    expect(a.withdrawDisabled).toBe(c.disabled);
    expect(a.replacesLiveLink).toBe(c.replaces);
    expect(c.status === null ? null : SENDER_LABEL[c.status]).toBe(c.chip);
    expect(senderDetail(c.status, c.invites, fmt)).toBe(c.detail);
  });

  it('a disabled button always has a reason, and no reason names a control that is not on screen', () => {
    for (const c of MATRIX) {
      const a = senderActions(c.status, c.invites, c.loadError);
      if (a.primaryDisabled) expect(a.primaryDisabled.length).toBeGreaterThan(0);
      // "Retry" is only named when the load failed, which is exactly when the Retry button shows.
      if (a.primaryDisabled?.includes('Retry')) expect(c.loadError).toBe(true);
    }
  });

  it('the Invite sheet offers exactly the three paths, link first', () => {
    expect(INVITE_CHOICES.map((c) => c.choice)).toEqual(['link', 'existing', 'email']);
  });
});

describe('issue: every returned refusal maps to one field and one sentence', () => {
  it.each(ISSUE_REFUSALS)('%s', (reason) => {
    const out = parseIssueResult({ ok: false, reason });
    expect(out).toEqual({ ok: false, reason });
    expect(ISSUE_REFUSAL[reason].text).not.toMatch(/something went wrong/i);
  });
  it('fields: email, first name, city', () => {
    expect(ISSUE_REFUSALS.map((r) => ISSUE_REFUSAL[r].field)).toEqual(['email', 'first_name', 'city']);
  });
  it('an ok answer carries the link; an unknown shape throws', () => {
    const out = parseIssueResult({ ok: true, invite_id: 'i1', organiser_id: 'o1', token: 'a'.repeat(64), expires_at: '2026-10-28T10:00:00Z', email_bound: true, revoked_previous: ['x'] });
    expect(out).toEqual({ ok: true, link: { inviteId: 'i1', token: 'a'.repeat(64), expiresAt: '2026-10-28T10:00:00Z', emailBound: true, revokedPrevious: 1 } });
    expect(() => parseIssueResult({ ok: false, reason: 'not_a_reason' })).toThrow('malformed_invite_answer');
    expect(() => parseIssueResult(null)).toThrow('malformed_invite_answer');
  });
  it.each([
    ['', '', null],
    ['ana@example.com', 'Ana', null],
    ['ana@', '', ISSUE_REFUSAL.invalid_email.text],
    ['', 'x'.repeat(101), ISSUE_REFUSAL.invalid_first_name.text],
  ])('link form %j / %j -> %j', (email, first, reason) => {
    expect(linkBlockedReason(email, first)).toBe(reason);
  });
});

describe('request lists', () => {
  it('parse and filter link requests', () => {
    const rows = parseInviteRequests([
      { id: 'r1', organiser_id: 'o1', organiser_name: 'Salsa Norte', invite_id: 'i1', invite_email: 'ana@example.com', requested_at: '2026-10-21T10:00:00Z', handled_at: null },
      { id: 'r2', organiser_id: 'o2', organiser_name: null, invite_id: 'i2', invite_email: null, requested_at: '2026-10-20T10:00:00Z', handled_at: '2026-10-20T12:00:00Z' },
      { id: 7 },
    ]);
    expect(rows.map((r) => [r.id, r.organiserName, r.inviteEmail])).toEqual([['r1', 'Salsa Norte', 'ana@example.com'], ['r2', 'Unnamed organiser', null]]);
    expect(pendingInviteRequests(rows).map((r) => r.id)).toEqual(['r1']);
    expect(parseInviteRequests(null)).toEqual([]);
  });
  it('parse access requests and put waiting ones first', () => {
    const rows = parseAccessRequests([
      { id: 'a1', email: 'x@example.com', note: '', requested_at: '2026-10-21T10:00:00Z', status: 'dismissed' },
      { id: 'a2', email: 'y@example.com', note: 'I run Sunday socials', requested_at: '2026-10-20T10:00:00Z', status: 'pending' },
      { id: 'a3', email: 'z@example.com', note: null, requested_at: null, status: 'weird' },
    ]);
    expect(orderAccessRequests(rows).map((r) => [r.id, r.note])).toEqual([['a2', 'I run Sunday socials'], ['a1', null]]);
  });
  it.each([...RESOLVE_REFUSALS, 'unknown_reason'])('resolve refusal %s has plain copy', (reason) => {
    expect(parseResolveResult({ ok: false, reason })).toEqual({ ok: false, reason });
    expect(resolveRefusalMessage(reason).length).toBeGreaterThan(0);
  });
  it('resolve ok', () => {
    expect(parseResolveResult({ ok: true })).toEqual({ ok: true });
    expect(parseResolveResult(null)).toEqual({ ok: false, reason: '' });
  });
});
