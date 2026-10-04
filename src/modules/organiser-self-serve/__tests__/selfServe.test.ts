import { describe, expect, it } from 'vitest';
import { KNOWN_SELF_SERVE_CODES, selfServeErrorCode, selfServeErrorCopy } from '../selfServeErrors';
import { isMailboxProvenToken } from '../sessionProof';
import { claimHint } from '../claimHint';

// Every refusal the D4 RPCs (admin repo 20261108200000-260000) and their shared
// helper can raise to a signed-in caller. A code missing here would reach the
// user as "Something went wrong".
const SERVER_CODES = [
  'authentication_required', 'mailbox_unproven', 'auth_user_email_missing',
  'organiser_id_required', 'organiser_not_found', 'not_live', 'organiser_already_claimed',
  'no_contact_email', 'email_mismatch', 'already_member', 'message_too_long', 'message_invalid',
  'request_already_open', 'request_limit_reached', 'name_required', 'name_too_long', 'name_invalid',
  'city_required', 'city_not_found', 'contact_email_not_own', 'invalid_instagram', 'invalid_website',
  'organiser_name_taken', 'draft_limit_reached',
];

const token = (payload: unknown) =>
  `x.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.y`;

describe('selfServeErrors', () => {
  it('has copy for every code the server raises', () => {
    expect(SERVER_CODES.filter((c) => !KNOWN_SELF_SERVE_CODES.includes(c))).toEqual([]);
  });

  it('reads the code from a PostgREST error message', () => {
    expect(selfServeErrorCode({ message: 'email_mismatch', code: 'P0001' })).toBe('email_mismatch');
  });

  it('never surfaces raw server text', () => {
    const raw = { message: 'permission denied for table organiser_profiles' };
    expect(selfServeErrorCode(raw)).toBeNull();
    expect(selfServeErrorCopy(raw).message).toBe('Something went wrong. Please try again.');
    expect(selfServeErrorCopy({ message: 'some_future_code' }).message).toBe('Something went wrong. Please try again.');
  });

  it('routes a claim refusal to "request access" and an unproven mailbox to re-auth', () => {
    expect(selfServeErrorCopy({ message: 'email_mismatch' }).next).toBe('request_access');
    expect(selfServeErrorCopy({ message: 'organiser_already_claimed' }).next).toBe('request_access');
    expect(selfServeErrorCopy({ message: 'mailbox_unproven' }).next).toBe('reauth');
    expect(selfServeErrorCopy({ message: 'request_already_open' }).next).toBeNull();
  });
});

describe('isMailboxProvenToken', () => {
  it('accepts an email-code or magic-link session', () => {
    expect(isMailboxProvenToken(token({ amr: [{ method: 'otp', timestamp: 1 }] }))).toBe(true);
    expect(isMailboxProvenToken(token({ amr: [{ method: 'magiclink', timestamp: 1 }] }))).toBe(true);
  });

  it('refuses a password session, a missing amr and garbage', () => {
    expect(isMailboxProvenToken(token({ amr: [{ method: 'password', timestamp: 1 }] }))).toBe(false);
    expect(isMailboxProvenToken(token({ sub: 'u' }))).toBe(false);
    expect(isMailboxProvenToken('not-a-jwt')).toBe(false);
    expect(isMailboxProvenToken(null)).toBe(false);
  });
});

describe('claimHint', () => {
  const me = { id: 'me', email: ' Diego@Example.com ' };
  const none = new Set<string>();

  it('says "yours" for an organiser the user already manages', () => {
    expect(claimHint({ id: 'o1', claimed_by: null, contact_email: null }, me, new Set(['o1']))).toBe('yours');
    expect(claimHint({ id: 'o1', claimed_by: 'me', contact_email: null }, me, none)).toBe('yours');
  });

  it('says "managed" when someone else holds it, whatever the email', () => {
    expect(claimHint({ id: 'o1', claimed_by: 'other', contact_email: 'diego@example.com' }, me, none)).toBe('managed');
  });

  it('compares emails case- and whitespace-insensitively', () => {
    expect(claimHint({ id: 'o1', claimed_by: null, contact_email: 'DIEGO@example.com' }, me, none)).toBe('email_matches');
    expect(claimHint({ id: 'o1', claimed_by: null, contact_email: 'ana@example.com' }, me, none)).toBe('email_differs');
    expect(claimHint({ id: 'o1', claimed_by: null, contact_email: '  ' }, me, none)).toBe('no_email');
  });
});
