// @vitest-environment jsdom
/**
 * flags.peopleWall at PAGE level. OFF (the default): /djs and /dancers render the old tiles
 * (the existing w1PeopleListsPage tests run unchanged and stay the byte-for-byte guard).
 * ON: the same reads feed the wall.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';
import { isRoutable } from '@/lib/__tests__/routeTable';

const h = vi.hoisted(() => ({ nav: [] as string[], dancers: [] as unknown[], names: [] as unknown[], badges: [] as unknown[], badgesError: false, djs: [] as unknown[] }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: null, isLoading: false, authStatus: 'ready' }),
}));
// The hero cards navigate imperatively: record the target instead of routing (a real route change
// re-renders the whole page under the test router for no gain).
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => (to: string) => { h.nav.push(to); },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({
  default: ({ children, hero }: { children: ReactNode; hero?: { emoji: string; titleWhite: string; titleOrange: string; subtitle?: string } }) => (
    <div>
      {hero ? <header data-testid="hero">{hero.emoji} {hero.titleWhite} {hero.titleOrange} {hero.subtitle ?? ''}</header> : null}
      {children}
    </div>
  ),
}));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb' }) }));
vi.mock('@/integrations/supabase/client', () => {
  const builder = () => {
    const b: Record<string, unknown> = {
      select: () => b, or: () => b, order: () => b,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: h.dancers, error: null }).then(resolve),
    };
    return b;
  };
  return {
    supabase: {
      from: () => builder(),
      rpc: async (name: string) => {
        if (name === 'get_public_dancer_names_v1') return { data: h.names, error: null };
        if (name === 'get_public_people_badges_v1') return h.badgesError ? { data: null, error: { message: 'x' } } : { data: h.badges, error: null };
        if (name === 'list_public_djs_v1') return { data: h.djs, error: null };
        return { data: null, error: null };
      },
    },
  };
});

import Dancers from '@/pages/Dancers';
import DJs from '@/pages/DJs';
import { flags } from '@/lib/featureFlags';
import { SEAM, WALL, WALL_FADE } from '@/modules/person-page/wall/tokens';

const setWall = (on: boolean) => { (flags as { peopleWall: boolean }).peopleWall = on; };
const mount = (el: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{el}</MemoryRouter>
    </QueryClientProvider>,
  );

const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const D = (id: string, first: string) => ({ id, first_name: first, avatar_url: null, nationality: null, dance_role: null, cities: { name: 'London' }, dancing_role_details: null });
const B = (id: string, roles: string[]) => ({ id, roles, dj_name: null, next_gig_date: null, dj_has_upcoming: false });
const DJ = (id: string, n: string) => ({ id, display_name: n, dj_name: n, first_name: null, surname: null, photo_url: null, nationality_code: null, has_upcoming_gig: false, next_gig_date: null });

beforeEach(() => {
  installJsdomPolyfills();
  h.dancers = [D('d1', 'Ana'), D('d2', 'Fay'), D('d3', 'Tom')];
  h.names = [
    { id: 'd1', surname: null, display_name: 'Ana', public_name: 'Ana' },
    { id: 'd2', surname: null, display_name: 'Fay', public_name: 'Fay' },
    { id: 'd3', surname: null, display_name: 'Tom', public_name: 'Tom' },
  ];
  h.badges = [B('d1', ['teacher', 'dancer']), B('d2', ['dancer']), B('d3', ['teacher']), B('j1', ['dj'])];
  h.badgesError = false;
  h.nav = [];
  h.djs = [DJ('j1', 'DJ El Rugido')];
});
afterEach(() => { cleanup(); setWall(false); });

describe('flags.peopleWall', () => {
  it('defaults OFF', () => { expect((flags as { peopleWall: boolean }).peopleWall).toBe(false); });

  it('OFF: old tiles, no wall', async () => {
    mount(<DJs />); await wait();
    expect(screen.getAllByTestId('dj-tile')).toHaveLength(1);
    expect(screen.queryByTestId('wall-root')).toBeNull();
    cleanup();
    mount(<Dancers />); await wait();
    expect(screen.getAllByTestId('dancer-tile')).toHaveLength(2);
    expect(screen.queryByTestId('wall-root')).toBeNull();
  });

  it('ON /djs: the wall shows the same DJs, linked the same way', async () => {
    setWall(true);
    mount(<DJs />); await wait();
    expect(screen.queryByTestId('dj-tile')).toBeNull();
    const [t] = screen.getAllByTestId('wall-tile');
    expect(t.getAttribute('href')).toBe('/djs/j1');
    expect(screen.getByTestId('tile-name').textContent).toBe('El Rugido');
  });

  it('ON /dancers: only Dancer-role people, same links', async () => {
    setWall(true);
    mount(<Dancers />); await wait();
    expect(screen.queryByTestId('dancer-tile')).toBeNull();
    expect(screen.getAllByTestId('wall-tile').map((t) => t.getAttribute('href'))).toEqual(['/dancers/d1', '/dancers/d2']);
  });

  it('ON /dancers with the badges read failed: everyone shows, never "No dancers yet"', async () => {
    setWall(true); h.badgesError = true;
    mount(<Dancers />); await wait();
    expect(screen.queryByText(/No dancers yet/)).toBeNull();
    expect(screen.getAllByTestId('wall-tile')).toHaveLength(3);
  });

  // Layout pass (owner, 2026-10-21): with the flag ON the page reads hero -> pills -> wall. Today's
  // hero (and on /dancers its own cards) stays; no wall header line, no Join row.
  const HERO = { dancers: /Meet Dancers/, djs: /Bachata DJs Discover the DJs behind the music/ } as const;
  it.each([
    ['dancers', true], ['djs', true], ['dancers', false], ['djs', false],
  ] as const)('/%s flag ON=%s: page order and pieces', async (page, on) => {
    setWall(on);
    mount(page === 'dancers' ? <Dancers /> : <DJs />); await wait();
    const hero = screen.getByTestId('hero');
    expect(hero.textContent).toMatch(HERO[page]);
    expect(screen.queryAllByText(/^Meet$|Meet Dancers|Meet the/).length).toBeLessThanOrEqual(1); // no duplicate "Meet" header
    expect(screen.queryByText(/behind the nights/)).toBeNull();
    expect(screen.queryByTestId('wall-join-row')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Join the wall' })).toBeNull();
    if (!on) {
      expect(screen.queryByTestId('wall-root')).toBeNull();
      expect(screen.getAllByTestId(page === 'dancers' ? 'dancer-tile' : 'dj-tile').length).toBeGreaterThan(0);
      return;
    }
    const pills = screen.getByTestId('wall-pills');
    const grid = screen.getByTestId('wall-grid');
    expect(before(hero, pills) && before(pills, grid)).toBe(true);
    if (page === 'dancers') {
      const card = screen.getByText('Create a Profile');
      expect(before(hero, card) && before(card, pills)).toBe(true);
    }
    expect(screen.getAllByTestId('wall-filter').map((b) => b.textContent)).toEqual(['All', 'Dancers', 'DJs', 'Teachers']);
    const org = screen.getByTestId('wall-organisers');
    expect(org.tagName).toBe('A');
    expect(isRoutable(org.getAttribute('href') ?? '')).toBe(true);
  });

  // The hero cards on /dancers: ON they open REAL routes; OFF they keep today's targets (both unrouted,
  // a separate follow-up, not fixed here).
  it.each([
    ['Create a Profile', true, '/auth?mode=signup&userType=dancer'],
    ['Book a Photoshoot', true, '/videographers'],
    ['Create a Profile', false, '/create-dancers-profile'],
    ['Book a Photoshoot', false, '/photographers'],
  ] as const)('/dancers hero card "%s", flag ON=%s -> %s', async (card, on, target) => {
    setWall(on);
    mount(<Dancers />); await wait();
    // The card is a motion.div: call the onClick React holds for it (a synthetic click through
    // framer-motion's tap gesture never returns under jsdom).
    const el = screen.getByText(card).closest('div') as HTMLElement;
    const key = Object.keys(el).find((k) => k.startsWith('__reactProps$')) as string;
    (el as unknown as Record<string, { onClick: () => void }>)[key].onClick();
    expect(h.nav).toEqual([target]);
    expect(isRoutable(target)).toBe(on);
  });

  // Flag OFF: the whole rendered page equals the snapshot taken from origin/main's pages (written in a
  // main worktree, see docs/handover/w2a-wall.md), so OFF stays byte-for-byte today's page.
  it.each(['dancers', 'djs'] as const)('/%s flag OFF: markup identical to main', async (page) => {
    setWall(false);
    const { container } = mount(page === 'dancers' ? <Dancers /> : <DJs />); await wait();
    expect(container.innerHTML).toMatchSnapshot();
  });

  // Seam fix (owner, 2026-10-22: "soft fade"): with the flag ON the wall's own background fades in
  // from clear over SEAM.height above the pills and back out at the bottom, so neither the hero nor
  // the section below meets the warm base at a hard line. No layout box is added.
  it.each([
    ['dancers', true], ['djs', true], ['dancers', false], ['djs', false],
  ] as const)('/%s flag ON=%s: soft seam between hero and pills, from the tokens', async (page, on) => {
    setWall(on);
    mount(page === 'dancers' ? <Dancers /> : <DJs />); await wait();
    if (!on) { expect(document.querySelectorAll('[data-seam]').length).toBe(0); return; }
    await screen.findByTestId('wall-root');
    const seams = document.querySelectorAll('[data-seam]');
    expect(seams.length).toBe(1);
    const root = screen.getByTestId('wall-root');
    expect(seams[0]).toBe(root);
    expect(root.getAttribute('data-seam')).toBe('soft');
    expect(before(screen.getByTestId('hero'), root)).toBe(true);
    expect(root.firstElementChild).toBe(screen.getByTestId('wall-pills'));
    // jsdom normalises colours, so compare against WALL_FADE applied through the same parser.
    const want = document.createElement('div');
    Object.assign(want.style, WALL_FADE);
    for (const k of ['backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'minHeight'] as const) {
      expect(want.style[k]).not.toBe('');
      expect(root.style[k]).toBe(want.style[k]);
    }
    expect(root.style.backgroundColor).toBe('');
    expect(SEAM.clear).toBe(WALL.page.replace(/^#(..)(..)(..)$/, (_, r, g, b) => `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, 0)`));
    expect(SEAM.base).toBe(WALL.page);
    expect(SEAM.height).toBeGreaterThanOrEqual(48);
    expect(SEAM.height).toBeLessThanOrEqual(72);
  });

  // Kept LAST: under jsdom, mounting /dancers (framer-motion) after a pill click in an earlier test
  // never returns, so the click tests run after every other mount.
  it.each(['dancers', 'djs'] as const)('/%s ON, teacher pages closed: Teachers pill = coming soon, zero tiles', async (page) => {
    setWall(true);
    mount(page === 'dancers' ? <Dancers /> : <DJs />); await wait();
    fireEvent.click(screen.getByRole('button', { name: 'Teachers' }));
    expect(screen.getByTestId('wall-teachers-soon').textContent).toMatch(/Teachers are coming soon\./);
    expect(screen.queryAllByTestId('wall-tile')).toHaveLength(0);
  });
});
