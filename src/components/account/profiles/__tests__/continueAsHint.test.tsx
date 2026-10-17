// @vitest-environment jsdom
/**
 * L18: "Continue as..." promises a way to switch later. The promise must be
 * true where each button lands: the dancer app (/app/...) and the organiser
 * area (/account/o...) carry the switcher picture top right; the dancer setup
 * (focus mode) and today's dancer
 * home (/account/dancer, gate closed) does not, so no line points at it.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { profileSides, type SidesFacts } from '@/lib/accountRouting';

const sides = vi.hoisted(() => ({ facts: null as unknown as SidesFacts }));
vi.mock('../useProfileSides', () => ({
  useProfileSides: () => ({ facts: sides.facts, state: profileSides(sides.facts), openRequestCount: 0 }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, signOut: async () => 'signed-out' }) }));

import { ContinueAsScreen, SWITCH_HINT, switchHint } from '../ContinueAsPage';

afterEach(cleanup);

const ORG = { id: 'org-a', name: 'Bachata Nights', avatar_url: null };
const FACE = { firstName: 'Ana', avatarUrl: null };

const ROWS: Array<[string, SidesFacts, string | null]> = [
  ['organiser + dancer in the app', { organisers: [ORG], dancer: 'complete', areaAllowed: true, dancerFace: FACE }, SWITCH_HINT],
  ['organiser + unfinished dancer (setup: focus mode hides the picture)', { organisers: [ORG], dancer: 'incomplete', areaAllowed: true, dancerFace: FACE }, null],
  ['organiser + dancer, app gate closed (/account/dancer has no switcher)', { organisers: [ORG], dancer: 'complete', areaAllowed: false, dancerFace: FACE }, null],
];

describe('Continue as... switch hint', () => {
  it.each(ROWS)('%s', (_n, facts, hint) => {
    sides.facts = facts;
    const state = profileSides(facts);
    if (state.status !== 'ready') throw new Error('fixture');
    expect(switchHint(state.sides)).toBe(hint);
    render(<MemoryRouter><ContinueAsScreen /></MemoryRouter>);
    const line = screen.queryByTestId('continue-as-hint');
    expect(line?.textContent ?? null).toBe(hint);
    expect(screen.getByTestId('continue-as').textContent).not.toMatch(/picture at the top right\./);
  });
});
