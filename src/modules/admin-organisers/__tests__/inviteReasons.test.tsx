/**
 * Arc 1 PR 2A: every redeem reason x the copy rules. ONE mapping (reasonScreen) feeds the dead-link
 * screen AND the post-Join refusal screen, so the same fact has the same words on both. The screens
 * themselves are exercised in join/__tests__/joinJourney.test.tsx (W1, Option B).
 */
import { describe, expect, it } from 'vitest';
import { reasonScreen } from '../inviteModel';

const ASKABLE = new Set(['used', 'revoked', 'expired', 'email_mismatch']);

describe('the reason mapping itself (every reason x ask button x copy rules)', () => {
  const ALL = ['sign_in_required', 'authentication_required', 'unconfirmed_account', 'rate_limited', 'profile_incomplete', 'invalid', 'used', 'revoked', 'expired', 'email_mismatch', 'email_unproven', 'team_full'];
  it.each(ALL)('%s has a title and body, and never names a control', (reason) => {
    const s = reasonScreen(reason, { inviterFirstName: 'Marta' });
    expect(s.title.length).toBeGreaterThan(3);
    // Mockup 2c (withdrawn) has no body; every other screen has one.
    if (reason === 'revoked') expect(s.body).toBe('');
    else expect(s.body.length).toBeGreaterThan(15);
    expect(s.body).not.toMatch(/\b(tap|click|press|button|menu|tab)\b/i);
    expect(s.offerNewLink).toBe(ASKABLE.has(reason));
  });
  it('an unknown reason is the retryable fallback', () => {
    expect(reasonScreen('nope').action).toBe('retry');
  });
});
