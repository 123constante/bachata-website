import { describe, expect, it } from 'vitest';
import { publicClaimKind, signInHref } from '../publicClaim';

// Lever 2 W7: what the public organiser page offers about ownership. Each
// row is a state the page can be in; the two "never" blocks are the mutants
// (a claimed organiser or a flag-off build must never offer a claim).

const org = (over: Partial<{ claimedBy: string | null; contactEmail: string | null }> = {}) => ({
  id: 'o1',
  name: 'Ritmo Bachata London',
  claimedBy: null,
  contactEmail: 'Diego@Ritmo.example',
  ...over,
});
const me = { id: 'me', email: ' diego@ritmo.example ' };

describe('publicClaimKind', () => {
  it.each([
    ['flag off, anyone', false, org(), me, 'hidden'],
    ['no organiser loaded', true, null, me, 'hidden'],
    ['claimed by someone', true, org({ claimedBy: 'other' }), me, 'managed'],
    ['claimed by me', true, org({ claimedBy: 'me' }), me, 'managed'],
    ['unclaimed, signed out', true, org(), null, 'sign_in'],
    ['unclaimed, email matches (case and whitespace differ)', true, org(), me, 'claim'],
    ['unclaimed, email differs', true, org({ contactEmail: 'ana@example.com' }), me, 'request'],
    ['unclaimed, no contact email', true, org({ contactEmail: null }), me, 'request'],
    ['unclaimed, blank contact email', true, org({ contactEmail: '   ' }), me, 'request'],
    ['unclaimed, user has no email', true, org(), { id: 'me', email: null }, 'request'],
  ] as const)('%s -> %s', (_label, flagOn, organiser, user, expected) => {
    expect(publicClaimKind(flagOn, organiser, user)).toBe(expected);
  });

  it('never offers a claim or a request on a claimed organiser', () => {
    for (const user of [me, { id: 'other', email: 'diego@ritmo.example' }, null]) {
      const kind = publicClaimKind(true, org({ claimedBy: 'owner-1' }), user);
      expect(kind).toBe('managed');
    }
  });

  it('never renders anything about claims when the flag is off', () => {
    for (const organiser of [org(), org({ claimedBy: 'owner-1' }), org({ contactEmail: null })]) {
      expect(publicClaimKind(false, organiser, me)).toBe('hidden');
      expect(publicClaimKind(false, organiser, null)).toBe('hidden');
    }
  });
});

describe('signInHref', () => {
  it('sends the visitor to sign in and back to the public page', () => {
    expect(signInHref('/organisers/ritmo-bachata-london')).toBe('/auth?mode=signin&returnTo=%2Forganisers%2Fritmo-bachata-london');
  });
});
