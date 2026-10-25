// @vitest-environment jsdom
/**
 * Design Gate stage 5 (critique, docs/design/w2b-hub-critique.md): one row per fixed finding,
 * run red against the unfixed hub first. Same mocks as hub.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { flags } from '@/lib/featureFlags';
import type { PersonRole } from '@/lib/searchEntities';
import type { PersonBadge } from '@/modules/person-page/badges';
import type { PersonSnapshot } from '../../reads';
import { hubModel, type HubAppearance } from '../model';

const h = vi.hoisted(() => ({ appearances: undefined as unknown[] | undefined, isError: false }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/useProfileProgramAppearances', () => ({
  useProfileProgramAppearances: (_t: string, id: string | undefined) => ({ data: id ? h.appearances : undefined, isError: !!id && h.isError }),
}));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: vi.fn() }));

import PersonHub from '../PersonHub';

const TODAY = '2026-10-22';
const GIG_DAY = '2099-10-23'; // a Friday
const OPEN = { teacherPagesOpen: true };

const person = (roles: PersonRole[], name: string | null = 'Ana Garcia'): PersonSnapshot => ({
  id: 'p1', name, avatarUrl: null, city: 'London', instagramUrl: null, roles, djPhoto: null,
});
const badge = (roles: PersonRole[], gig: boolean): PersonBadge => ({
  id: 'p1', roles, djName: 'Rugido', djHasUpcoming: gig, nextGigDate: gig ? GIG_DAY : null,
});
const timeline = (gig: boolean): HubAppearance[] => (gig ? [{ event_id: 'e1', event_start_time: `${GIG_DAY}T21:00:00Z` }] : []);

/** Renders the hub; `wall` = the visitor came from the wall, so the wall's badges answer is cached. */
const mount = (roles: PersonRole[], o: { wall?: PersonBadge; appearances?: unknown[]; name?: string | null; nationality?: string }) => {
  h.appearances = o.appearances;
  const qc = new QueryClient();
  qc.setQueryData(['dancer-profile', 'p1'], { id: 'p1', first_name: 'Ana', nationality: o.nationality ?? null, avatar_url: null, cities: { name: 'London' } });
  qc.setQueryData(['dj-profile', 'p1'], roles.includes('dj') ? { dj_name: 'Rugido' } : null);
  if (o.wall) qc.setQueryData(['people-badges', ['p0', 'p1']], new Map([['p1', o.wall]]));
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><PersonHub person={person(roles, o.name === undefined ? 'Ana Garcia' : o.name)} /></MemoryRouter>
    </QueryClientProvider>,
  );
};
const order = () => screen.getAllByTestId('hub-role-card').map((c) => c.getAttribute('data-role'));

beforeEach(() => { (flags as { teacherDetail: boolean }).teacherDetail = true; });
afterEach(() => { cleanup(); h.isError = false; (flags as { teacherDetail: boolean }).teacherDetail = false; });

describe('#1 no card swap after first paint when the wall already knows the gig', () => {
  // Timeline still loading (undefined) = first paint. The final order is what it becomes once it arrives.
  const ROWS: Array<{ name: string; roles: PersonRole[]; gig: boolean; final: PersonRole[] }> = [
    { name: 'DJ+dancer with gig', roles: ['dj', 'dancer'], gig: true, final: ['dj', 'dancer'] },
    { name: '3-role with gig', roles: ['teacher', 'dj', 'dancer'], gig: true, final: ['dj', 'dancer', 'teacher'] },
    { name: 'DJ+dancer, no gig', roles: ['dj', 'dancer'], gig: false, final: ['dancer', 'dj'] },
    { name: 'DJ only with gig', roles: ['dj'], gig: true, final: ['dj'] },
  ];
  it.each(ROWS)('$name: first paint = final order, button place kept', ({ roles, gig, final }) => {
    mount(roles, { wall: badge(roles, gig), appearances: undefined });
    expect(order()).toEqual(final);
    const slot = screen.queryByTestId('hub-next-event');
    expect(!!slot).toBe(gig);
    // While the event id is unknown the slot is not a link (never a dead target), and says the same words.
    if (slot) {
      expect(slot.getAttribute('href')).toBeNull();
      expect(slot.getAttribute('aria-busy')).toBe('true');
      expect(slot.textContent).toBe('Go to their next event · Friday 23 October');
    }
    cleanup();
    mount(roles, { wall: badge(roles, gig), appearances: timeline(gig) });
    expect(order()).toEqual(final);
    const btn = screen.queryByTestId('hub-next-event');
    expect(!!btn).toBe(gig);
    if (btn) expect(btn.getAttribute('href')).toBe('/event/e1');
  });

  it('a wall hint whose gig date is past is ignored (no slot, dancer first)', () => {
    mount(['dj', 'dancer'], { wall: { ...badge(['dj', 'dancer'], true), nextGigDate: '2020-01-01' }, appearances: undefined });
    expect(order()).toEqual(['dancer', 'dj']);
    expect(screen.queryByTestId('hub-next-event')).toBeNull();
  });

  it('the gig list read fails: the not-yet-a-link box goes away (never a box that cannot work)', () => {
    h.isError = true;
    mount(['dj', 'dancer'], { wall: badge(['dj', 'dancer'], true), appearances: undefined });
    expect(screen.queryByTestId('hub-next-event')).toBeNull();
    expect(order()).toEqual(['dancer', 'dj']);
  });

  it('no wall hint (direct load): today\'s behaviour, nothing invented', () => {
    mount(['dj', 'dancer'], { appearances: undefined });
    expect(order()).toEqual(['dancer', 'dj']);
    expect(screen.queryByTestId('hub-next-event')).toBeNull();
  });

  it('the timeline wins over the hint once it arrives', () => {
    const m = hubModel({
      person: person(['dj', 'dancer']), dancerRow: null, dj: { dj_name: 'Rugido' }, appearances: [], opts: OPEN, today: TODAY,
      wallBadge: badge(['dj', 'dancer'], true),
    });
    expect(m.cards.map((c) => c.role)).toEqual(['dancer', 'dj']);
    expect(m.nextGig).toBeNull();
  });
});

describe('#2 cards heading never splits the placeholder name', () => {
  const ROWS: Array<{ name: string | null; roles: PersonRole[]; heading: string }> = [
    { name: null, roles: ['dj', 'dancer'], heading: 'What they do' },
    { name: 'Roger Cracco', roles: ['dj', 'dancer'], heading: 'What Roger does' },
    { name: null, roles: ['dj'], heading: 'Their page' },
    { name: 'Roger Cracco', roles: ['dancer'], heading: 'Their page' },
  ];
  it.each(ROWS)('name $name, roles $roles -> $heading', ({ name, roles, heading }) => {
    const m = hubModel({ person: person(roles, name), dancerRow: null, dj: { dj_name: 'DJ Nova' }, appearances: [], opts: OPEN, today: TODAY });
    expect(m.cardsHeading).toBe(heading);
    expect(m.cardsHeading).not.toMatch(/bachata/i);
  });
});

describe('#3 the flag sticker is sized like the S12 mock (half the face), so it does not cover the initials', () => {
  it('sticker width is at most a quarter of the face', () => {
    mount(['dancer'], { nationality: 'VE', appearances: [] });
    const flag = document.querySelector('[data-nationality-flag]') as HTMLElement;
    expect(flag).toBeTruthy();
    const box = flag.closest('[style*="width"]') as HTMLElement;
    expect(parseFloat(box.style.width)).toBeLessThanOrEqual(28);
  });
});

describe('#4 a thin hub keeps the warm base to the end of the first screen', () => {
  it('the hub ground has a viewport-based min height', () => {
    mount(['dancer'], { appearances: [] });
    expect(screen.getByTestId('person-hub').style.minHeight).toMatch(/svh/);
  });
});
