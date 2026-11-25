import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLAIM_TOKEN_RE, REFUSAL_SCREENS, isAuthRequired, parseClaimResult } from '../claimLinkModel';

describe('parseClaimResult', () => {
  it('redeemed and already_member are success', () => {
    expect(parseClaimResult({ ok: true, status: 'redeemed', organiser_id: 'o1', member_role: 'owner', about_you_needed: true })).toEqual({ kind: 'success', organiserId: 'o1', aboutYouNeeded: true });
    expect(parseClaimResult({ ok: true, status: 'already_member', organiser_id: 'o1' })).toEqual({ kind: 'success', organiserId: 'o1', aboutYouNeeded: false });
  });
  it.each(['feature_off', 'email_unproven', 'rate_limited', 'invalid', 'used', 'revoked', 'expired', 'already_owned'])('refusal %s', (reason) => {
    expect(parseClaimResult({ ok: false, reason })).toEqual({ kind: 'refused', reason });
    expect(REFUSAL_SCREENS[reason as keyof typeof REFUSAL_SCREENS]).toBeDefined();
  });
  it('garbage is failed, never success', () => {
    for (const raw of [null, 'x', {}, { ok: true }, { ok: false, reason: 'weird' }]) expect(parseClaimResult(raw)).toEqual({ kind: 'failed' });
  });
  it('token shape and auth error', () => {
    expect(CLAIM_TOKEN_RE.test('a'.repeat(64))).toBe(true);
    expect(CLAIM_TOKEN_RE.test('A'.repeat(64))).toBe(false);
    expect(isAuthRequired('authentication_required')).toBe(true);
    expect(isAuthRequired('boom')).toBe(false);
  });
});

describe('keep-list: existing invite and onboarding files stay unchanged by W1a', () => {
  it('invite route and OrganiserSheet are still present and untouched in wiring', () => {
    const routes = readFileSync('src/components/AnimatedRoutes.tsx', 'utf8');
    expect(routes).toContain('path="/invite/:token"');
    expect(routes).toContain('path="/claim/:token"');
    for (const f of ['src/modules/organiser/home/onboarding/OrganiserSheet.tsx', 'src/modules/organiser/home/onboarding/OnboardingView.tsx', 'src/modules/admin-organisers/InviteRedeemPage.tsx']) {
      expect(readFileSync(f, 'utf8')).not.toContain('claim-link');
    }
  });
});
