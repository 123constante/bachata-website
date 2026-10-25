/**
 * D56 (release A): redeem_organiser_invite_v1 answers {ok:false, reason:'email_unproven'} when the RIGHT
 * email opens a bound invite in a session that is not a proven mailbox (checked before email_mismatch,
 * never with a hint). The mapping keeps the link and leads to sign-out-and-continue; the screens are
 * exercised in join/__tests__/joinJourney.test.tsx (W1, Option B).
 */
import { describe, expect, it } from 'vitest';
import { interpretRedeem, reasonScreen } from '../inviteModel';

// Approved mockup wording (invite-flows-mockups.html 2d / 2e).
const UNPROVEN = 'This link is for your email, but you signed in another way.';
const MISMATCH_GENERIC = 'It was sent to another email address.';

const ROWS: Array<[name: string, answer: Record<string, unknown>, body: string, button: string]> = [
  ['email_unproven', { ok: false, reason: 'email_unproven' }, UNPROVEN, 'Email me a sign-in link'],
  // D56: no hint on email_unproven, even if one rides along.
  ['email_unproven with a stray hint', { ok: false, reason: 'email_unproven', invite_email_hint: 'a***@e***.com' }, UNPROVEN, 'Email me a sign-in link'],
  ['email_mismatch with no hint', { ok: false, reason: 'email_mismatch' }, MISMATCH_GENERIC, 'Sign in with that email'],
  ['email_mismatch with a masked hint', { ok: false, reason: 'email_mismatch', invite_email_hint: 'j***@gmail.com' }, 'It was sent to j***@gmail.com.', 'Sign in with that email'],
];

describe('sign-in-again refusals: the words, and the one control that leads there', () => {
  it.each(ROWS)('%s: interpreted as a refusal that keeps the link', (_n, answer, body) => {
    const out = interpretRedeem(answer, null);
    expect(out.kind).toBe('refused');
    if (out.kind !== 'refused') return;
    expect(out.reason).toBe(answer.reason);
    const shown = reasonScreen(out.reason, { emailHint: out.emailHint });
    expect(shown.body).toBe(body);
    expect(shown.title).not.toBe('Something went wrong');
    expect(shown.terminal).toBe(false);
    expect(shown.action).toBe('switch_account');
    expect(`${shown.title} ${shown.body}`).not.toMatch(/a\*\*\*@/);
    expect(`${shown.title} ${shown.body}`).toMatch(/^[\x20-\x7e]*$/);
  });
});
