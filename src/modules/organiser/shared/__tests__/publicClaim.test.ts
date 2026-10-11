import { describe, expect, it } from 'vitest';
import { claimIntentStep, hasClaimIntent, signInHref, signInToClaimHref, withClaimIntent, withoutClaimIntent } from '../publicClaim';

// What the public page offers about ownership is decided by ownershipFacts and
// pinned over every shape in ownership.matrix.test.ts; only the sign-in return
// path and the claim-intent marker live here.
describe('signInHref', () => {
  it('sends the visitor to sign in and back to the public page', () => {
    expect(signInHref('/organisers/ritmo-bachata-london')).toBe('/auth?mode=signin&returnTo=%2Forganisers%2Fritmo-bachata-london');
  });
});

describe('claim intent marker', () => {
  it('"Sign in to claim" returns to the page with ?claim=1', () => {
    expect(signInToClaimHref('/organisers/ritmo')).toBe('/auth?mode=signin&returnTo=%2Forganisers%2Fritmo%3Fclaim%3D1');
  });

  it.each([
    ['/organisers/ritmo', '/organisers/ritmo?claim=1'],
    ['/organisers/ritmo?tab=past', '/organisers/ritmo?tab=past&claim=1'],
    ['/organisers/ritmo?claim=1', '/organisers/ritmo?claim=1'],
    ['/organisers/ritmo#events', '/organisers/ritmo?claim=1#events'],
    ['/organisers/ritmo?claim=0', '/organisers/ritmo?claim=1'],
    ['/organisers/ritmo?q=a%20b&flag', '/organisers/ritmo?q=a%20b&flag&claim=1'],
  ])('adds the marker to %s once', (path, marked) => {
    expect(withClaimIntent(path)).toBe(marked);
    const href = signInToClaimHref(path);
    expect(decodeURIComponent(href.split('returnTo=')[1])).toBe(marked);
  });

  it.each([
    ['?claim=1', true],
    ['?tab=past&claim=1', true],
    ['', false],
    ['?claim=0', false],
    ['?claim=', false],
    ['?claimed=1', false],
    ['?claim=0&claim=1', true],
    ['?cl%61im=1', false],
  ])('reads %s as intent=%s', (search, intent) => {
    expect(hasClaimIntent(search)).toBe(intent);
  });

  it.each([
    ['/organisers/ritmo?claim=1', '/organisers/ritmo'],
    ['/organisers/ritmo?tab=past&claim=1', '/organisers/ritmo?tab=past'],
    ['/organisers/ritmo?claim=1#events', '/organisers/ritmo#events'],
    ['/organisers/ritmo', '/organisers/ritmo'],
    ['/organisers/ritmo?q=a%20b&flag&claim=1', '/organisers/ritmo?q=a%20b&flag'],
  ])('removes the marker from %s', (url, clean) => {
    expect(withoutClaimIntent(url)).toBe(clean);
  });
});

describe('claimIntentStep', () => {
  const base = { armed: true, signedIn: true, kind: 'claim' as const, hintKnown: true, mailboxProven: true };
  it.each([
    [{ ...base, armed: false }, 'none'],
    [{ ...base, signedIn: false, kind: 'sign_in' as const, hintKnown: false }, 'wait'],
    [{ ...base, kind: 'hidden' as const }, 'wait'],
    // A failed hint lookup reads as 'request' with no hint: unknown, so the marker waits.
    [{ ...base, kind: 'request' as const, hintKnown: false }, 'wait'],
    [{ ...base, kind: 'request' as const }, 'drop'],
    [{ ...base, kind: 'member' as const }, 'drop'],
    [{ ...base, kind: 'managed' as const }, 'drop'],
    [base, 'claim'],
    [{ ...base, mailboxProven: false }, 'prove'],
  ])('%o -> %s', (input, step) => {
    expect(claimIntentStep(input)).toBe(step);
  });
});
