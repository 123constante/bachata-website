/**
 * People arc S2 critique: the two rules every world shares live in facts/, once.
 * D8'' (owner, 2026-10-23): the "Dance bachata too? Get your own card" invite is hidden from a
 * signed-in visitor and shown to every signed-out one (anonymous guest sessions included), on
 * EVERY world. D12: the one "nothing coming up" button is "Find a party" -> /parties.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIND_A_PARTY, showsJoinInvite } from '../facts';

const VIEWERS: [who: string, user: { id: string; is_anonymous?: boolean | null } | null | undefined, shown: boolean][] = [
  ['signed out (no user)', null, true],
  ['no auth context answer yet (undefined)', undefined, true],
  ['anonymous guest session', { id: 'g', is_anonymous: true }, true],
  ['signed in', { id: 'u' }, false],
  ['signed in, is_anonymous false', { id: 'u', is_anonymous: false }, false],
  ['signed in, is_anonymous null', { id: 'u', is_anonymous: null }, false],
];

describe("D8'': the invite rule, per viewer", () => {
  it.each(VIEWERS)('%s -> shown %s', (_who, user, shown) => {
    expect(showsJoinInvite(user)).toBe(shown);
  });
});

describe('D12: the one empty-state action', () => {
  it('is "Find a party" -> /parties', () => {
    expect(FIND_A_PARTY).toEqual({ label: 'Find a party', href: '/parties' });
  });
});

const WORLDS = join(__dirname, '..', 'worlds');
// S6 (owner, 2026-10-24): the dancer world has no "nothing coming up" button any more (its
// lower half is previews or nothing), so only the DJ world carries D12; neither spells it out.
const SOURCES = ['dj/model.ts'];

describe('the worlds import the shared rules (no second copy)', () => {
  it.each(SOURCES)('%s', (file) => {
    const src = readFileSync(join(WORLDS, file), 'utf8');
    expect(src).toMatch(/\bFIND_A_PARTY\b/);
    expect(src).not.toMatch(/'Find a party'/);
  });

  it('the dancer model carries no party button of its own (S6)', () => {
    expect(readFileSync(join(WORLDS, 'dancer/model.ts'), 'utf8')).not.toMatch(/FIND_A_PARTY|'Find a party'|\/parties/);
  });

  it('the dancer model no longer reads the DJ world to get the wording', () => {
    expect(readFileSync(join(WORLDS, 'dancer/model.ts'), 'utf8')).not.toMatch(/djWorldView|from '\.\.\/dj/);
  });

  it('the DJ world decides its invite with the shared rule', () => {
    expect(readFileSync(join(WORLDS, 'dj/model.ts'), 'utf8')).toMatch(/\bshowsJoinInvite\(/);
  });

  it('the dancer page decides its invite with the shared rule', () => {
    const src = readFileSync(join(__dirname, '..', '..', '..', 'pages', 'DancerProfile.tsx'), 'utf8');
    expect(src).toMatch(/\bshowsJoinInvite\(/);
  });
});
