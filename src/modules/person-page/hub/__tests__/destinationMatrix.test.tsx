// @vitest-environment jsdom
/**
 * W2-D: ONE destination rule for a person (badges.ts personDestination), read by the wall tile, the
 * /people/:id redirect and the hub (chips, hero, Also cards). Table-driven over every prod shape
 * (survey 2026-10-22, teacher pages CLOSED): the four surfaces must agree, no text may point at a
 * control that is not on screen, the closed Teacher card is never a link.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { flags } from '@/lib/featureFlags';
import { visibleRoles, type PersonRole } from '@/lib/searchEntities';
import * as badges from '@/modules/person-page/badges';
import { dancerWallPerson, djWallPerson } from '@/modules/person-page/wall/model';
import type { PersonSnapshot } from '../../reads';
import * as hubModelModule from '../model';

vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/useProfileProgramAppearances', () => ({
  useProfileProgramAppearances: (_t: string, id: string | undefined) => ({ data: id ? [] : undefined }),
}));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: vi.fn() }));

import PersonHub from '../PersonHub';

const CLOSED = { teacherPagesOpen: false };
const ID = 'p1';
const ROLE_PAGE: Record<PersonRole, string> = { dj: '/djs/p1', dancer: '/dancers/p1', teacher: '/teachers/p1' };

type Row = { shape: string; count: number; held: PersonRole[]; gig?: boolean; to: string; lead?: PersonRole; also?: PersonRole[] };
// to = where the tile, the redirect and the hub CTA all agree the person goes ('hub' = /people/p1).
const ROWS: Row[] = [
  { shape: 'teacher only (pages closed)', count: 62, held: ['teacher'], to: '/dancers/p1' },
  { shape: 'dancer + teacher', count: 36, held: ['teacher', 'dancer'], to: 'hub', lead: 'dancer', also: ['teacher'] },
  { shape: 'dancer + DJ + teacher, gig', count: 25, held: ['teacher', 'dj', 'dancer'], gig: true, to: 'hub', lead: 'dj', also: ['dancer', 'teacher'] },
  { shape: 'dancer + DJ + teacher, no gig', count: 25, held: ['teacher', 'dj', 'dancer'], to: 'hub', lead: 'dancer', also: ['dj', 'teacher'] },
  { shape: 'dancer only', count: 23, held: ['dancer'], to: '/dancers/p1' },
  { shape: 'dancer + DJ, gig', count: 10, held: ['dj', 'dancer'], gig: true, to: 'hub', lead: 'dj', also: ['dancer'] },
  { shape: 'dancer + DJ, no gig', count: 10, held: ['dj', 'dancer'], to: 'hub', lead: 'dancer', also: ['dj'] },
  { shape: 'DJ only', count: 4, held: ['dj'], to: '/djs/p1' },
  { shape: 'DJ + teacher', count: 1, held: ['teacher', 'dj'], to: 'hub', lead: 'dj', also: ['teacher'] },
  { shape: 'no role', count: 5, held: [], to: '/dancers/p1' },
];

const badgeOf = (r: Row): badges.PersonBadge => ({
  id: ID, roles: r.held, djName: r.held.includes('dj') ? 'DJ Rugido' : null,
  djHasUpcoming: !!r.gig, nextGigDate: r.gig ? '2099-10-23' : null,
});
const snapOf = (r: Row): PersonSnapshot => ({
  id: ID, name: 'Ana Garcia', avatarUrl: null, city: 'London', instagramUrl: null,
  roles: visibleRoles(r.held, false), heldRoles: r.held, djPhoto: null,
});
const hrefOf = (to: string) => (to === 'hub' ? '/people/p1' : to);

let saved: boolean;
beforeEach(() => { saved = flags.personHub; (flags as { personHub: boolean }).personHub = true; });
afterEach(() => { (flags as { personHub: boolean }).personHub = saved; cleanup(); });

function mountHub(r: Row) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['dancer-profile', ID], { id: ID, first_name: 'Ana', dancing_role_details: { dance_started_year: new Date().getFullYear() - 6 } });
  qc.setQueryData(['dj-profile', ID], r.held.includes('dj') ? { dj_name: 'DJ Rugido', languages: ['English'] } : null);
  qc.setQueryData(['people-badges', [ID]], new Map([[ID, badgeOf(r)]]));
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><PersonHub person={snapOf(r)} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe.each(ROWS)('$shape ($count on prod)', (r) => {
  it('wall tile (both walls) and the /people redirect agree on ONE destination', () => {
    const want = hrefOf(r.to);
    const dancerTile = dancerWallPerson({ id: ID, avatar_url: null }, 'Ana Garcia', null, badgeOf(r), false);
    expect(dancerTile.href).toBe(want);
    if (r.held.includes('dj')) {
      const djTile = djWallPerson({ id: ID, dj_name: 'DJ Rugido', has_upcoming_gig: !!r.gig, next_gig_date: r.gig ? '2099-10-23' : null } as never, 'DJ Rugido', badgeOf(r), false);
      expect(djTile.href).toBe(want);
    }
    const redirect = (hubModelModule as Record<string, unknown>).personPageRedirect as (p: PersonSnapshot, o: badges.BadgeOpts) => string | null;
    expect(typeof redirect).toBe('function');
    expect(redirect(snapOf(r), CLOSED)).toBe(r.to === 'hub' ? null : want);
  });

  it('chips read the same on the tile and on the hub (held roles; a closed Teacher is plain text)', () => {
    const tile = dancerWallPerson({ id: ID, avatar_url: null }, 'Ana Garcia', null, badgeOf(r), false);
    if (r.to !== 'hub') return;
    mountHub(r);
    const chips = screen.getByTestId('hub-chips');
    expect(Array.from(chips.children).map((c) => (c.textContent ?? '').replace(/^, /, ''))).toEqual(tile.tags.map((t) => t.label));
    expect(chips.querySelector('a')).toBeNull();
  });

  it('hub: hero = the main role with ONE big link; Also = every other HELD role; closed Teacher is not a link', () => {
    if (r.to !== 'hub') return;
    mountHub(r);
    const hero = screen.getByTestId('hub-hero');
    expect(hero.getAttribute('data-role')).toBe(r.lead);
    const cta = within(hero).getByTestId('hub-cta');
    expect(cta.tagName).toBe('A');
    expect(cta.getAttribute('href')).toBe(ROLE_PAGE[r.lead as PersonRole]);
    const cards = screen.getAllByTestId('hub-also-card');
    expect(cards.map((c) => c.getAttribute('data-role'))).toEqual(r.also);
    for (const c of cards) {
      const role = c.getAttribute('data-role') as PersonRole;
      if (role === 'teacher') {
        expect(c.tagName).not.toBe('A');
        expect(c.querySelector('a')).toBeNull();
        expect(c.getAttribute('aria-disabled')).toBe('true');
        expect(c.textContent).toMatch(/Teacher pages open soon/);
        expect(c.textContent).not.toMatch(/Open/);
      } else {
        expect(c.tagName).toBe('A');
        expect(c.getAttribute('href')).toBe(ROLE_PAGE[role]);
      }
    }
  });

  it('no text points at a control that is not on screen', () => {
    if (r.to !== 'hub') return;
    const { container } = mountHub(r);
    // Every "Open ..." call to action is itself a link; the hint under the CTA names the page the CTA opens.
    for (const el of Array.from(container.querySelectorAll('*'))) {
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
      if (/\bOpen\b/.test(own)) expect(el.closest('a')).not.toBeNull();
    }
    const hint = screen.getByTestId('hub-hint').textContent ?? '';
    const name = { dj: 'DJ', dancer: 'dancer', teacher: 'teacher' }[r.lead as PersonRole];
    expect(hint).toContain(`their ${name} page`);
    expect(screen.getByTestId('hub-cta').textContent).toMatch(new RegExp(`Open ${name} page`, 'i'));
  });
});

it('the shapes cover the whole active survey (166 people)', () => {
  const seen = new Set<string>();
  const total = ROWS.filter((r) => !seen.has(r.held.join()) && seen.add(r.held.join())).reduce((n, r) => n + r.count, 0);
  expect(total).toBe(166);
});

it('no role reached directly: a sane empty state that says what the visitor can do', () => {
  mountHub({ shape: 'none', count: 0, held: [], to: 'hub' });
  const empty = screen.getByTestId('hub-empty');
  expect(empty.textContent).toMatch(/no public page/i);
  const link = within(empty).getByRole('link');
  expect(link.getAttribute('href')).toBe('/dancers');
  expect(screen.queryByTestId('hub-cta')).toBeNull();
});
