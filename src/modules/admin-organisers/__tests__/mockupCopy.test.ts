/**
 * Review F3 / F4 (arc 1 PR 2): every redeem / request-access / code / callback string a person reads,
 * against the APPROVED wording in invite-flows-mockups.html (admin brief branch). One row per
 * mockup line; the code under test is the ONE mapping each screen reads (reasonScreen, the
 * request-access constants, accessResultCopy, wrongCodeMessage, callbackErrorCopy).
 */
import { describe, expect, it } from 'vitest';
import { ACCESS_FORM_LINE, ACCESS_FORM_TITLE, ACCESS_SENT_TITLE } from '@/components/auth/RequestAccess';
import { wrongCodeMessage } from '@/components/MagicLinkConfirmation';
import { callbackErrorCopy } from '@/lib/auth-otp-routing';
import { accessResultCopy, interpretRedeem, parsePreview, reasonScreen, safeEmailHint } from '../inviteModel';

const marta = { inviterFirstName: 'Marta', organiserName: 'Salsa Norte' };

const ROWS: Array<[screen: string, actual: () => unknown, mockup: unknown]> = [
  ['2a title', () => reasonScreen('expired', marta).title, 'This link has run out'],
  ['2a body', () => reasonScreen('expired', marta).body, 'Links last 7 days.'],
  ['2a ask button', () => reasonScreen('expired', marta).newLinkLabel, 'Ask Marta for a new one'],
  ['2b title', () => reasonScreen('used', marta).title, 'This link was already used'],
  ['2b body', () => reasonScreen('used', marta).body, 'If that was not you, ask for a new one.'],
  ['2c title', () => reasonScreen('revoked', marta).title, 'This link was withdrawn'],
  ['2c body (none)', () => reasonScreen('revoked', marta).body, ''],
  ['2d title', () => reasonScreen('email_mismatch', { ...marta, emailHint: 'j***@gmail.com' }).title, 'This link is for a different email'],
  ['2d body (hint)', () => reasonScreen('email_mismatch', { ...marta, emailHint: 'j***@gmail.com' }).body, 'It was sent to j***@gmail.com.'],
  ['2d button', () => reasonScreen('email_mismatch', marta).switchLabel, 'Sign in with that email'],
  ['2d ask button', () => reasonScreen('email_mismatch', marta).offerNewLink, true],
  ['2e title', () => reasonScreen('email_unproven', marta).title, 'Use the email link to sign in'],
  ['2e body', () => reasonScreen('email_unproven', marta).body, 'This link is for your email, but you signed in another way.'],
  ['2e button', () => reasonScreen('email_unproven', marta).switchLabel, 'Email me a sign-in link'],
  ['2f title', () => reasonScreen('invalid', marta).title, 'This link does not work'],
  ['2f body', () => reasonScreen('invalid', marta).body, 'It may have been copied incompletely.'],
  ['2f no ask button', () => reasonScreen('invalid', marta).offerNewLink, false],
  ['3b title', () => ACCESS_FORM_TITLE, 'Sign-up is invite-only for now'],
  ['3b line', () => ACCESS_FORM_LINE, 'Tell us about your events and we will get back to you.'],
  ['3c title', () => ACCESS_SENT_TITLE, 'Request sent'],
  ['3c line', () => accessResultCopy({ ok: true }, null).text, 'We will email you when you are in.'],
  ['4b wrong code', () => wrongCodeMessage(2), 'That code is not right. Check the latest email. 2 tries left.'],
  ['9b expired sign-in link', () => callbackErrorCopy('expired'), 'That sign-in link has run out. Enter your email and we will send a new one.'],
];

describe('copy = the approved mockup wording (review F3)', () => {
  it.each(ROWS)('%s', (_screen, actual, mockup) => {
    expect(actual()).toBe(mockup);
  });
  it('the 2d / 2e buttons are the sign-out escape, never a plain sign-in link (review F1)', () => {
    expect(reasonScreen('email_mismatch').action).toBe('switch_account');
    expect(reasonScreen('email_unproven').action).toBe('switch_account');
  });
});

// F4: both the preview's email_hint and redeem's invite_email_hint pass the ONE masking guard.
const HINTS: Array<[raw: unknown, shown: string | null]> = [
  ['j***@gmail.com', 'j***@gmail.com'],
  ['r...@ymail.com', 'r...@ymail.com'],
  ['jane@gmail.com', null],
  ['@gmail.com', null],
  [5, null],
  [null, null],
];

describe('the masked hint guard runs on every source (review F4)', () => {
  it.each(HINTS)('%j -> %s', (raw, shown) => {
    expect(safeEmailHint(raw)).toBe(shown);
    const preview = parsePreview({ status: 'open', organiser_name: 'Salsa Norte', inviter_first_name: null, email_hint: raw });
    expect(preview?.emailHint ?? null).toBe(shown);
    const redeem = interpretRedeem({ ok: false, reason: 'email_mismatch', invite_email_hint: raw }, null);
    expect(redeem.kind === 'refused' ? redeem.emailHint : 'x').toBe(shown);
    // A full address that reaches reasonScreen directly is still not printed.
    const body = reasonScreen('email_mismatch', { emailHint: raw as string }).body;
    expect(body).toBe(shown ? `It was sent to ${shown}.` : 'It was sent to another email address.');
  });
});
