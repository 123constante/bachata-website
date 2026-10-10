import { describe, expect, it } from 'vitest';
import { signInHref } from '../publicClaim';

// What the public page offers about ownership is decided by ownershipFacts and
// pinned over every shape in ownership.matrix.test.ts; only the sign-in return
// path lives here.
describe('signInHref', () => {
  it('sends the visitor to sign in and back to the public page', () => {
    expect(signInHref('/organisers/ritmo-bachata-london')).toBe('/auth?mode=signin&returnTo=%2Forganisers%2Fritmo-bachata-london');
  });
});
