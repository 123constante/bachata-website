// @vitest-environment jsdom
/**
 * W2-B fix: the hub's chips read the HELD roles, like the wall tile (the wall decides). A closed
 * Teacher is a plain-text chip on both; the cards, the lead role, the 404 rule and every link stay
 * on the VISIBLE roles, so a closed teacher page is never offered. Table over prod shapes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { flags } from '@/lib/featureFlags';
import { derivePersonRoles, type PersonRole } from '@/modules/person-page/personRoles';
import type { PersonBadge } from '@/modules/person-page/badges';
import { dancerWallPerson, djWallPerson, tileHref } from '@/modules/person-page/wall/model';
import type { PersonSnapshot } from '../../reads';
import { hubModel, type HubAppearance } from '../model';

vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/useProfileProgramAppearances', () => ({
  useProfileProgramAppearances: (_t: string, id: string | undefined) => ({ data: id ? h.appearances : undefined }),
}));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: vi.fn() }));
vi.mock('@/pages/TeacherProfile', () => ({ default: () => <div data-testid="body-teacher" /> }));
vi.mock('@/pages/DJProfile', () => ({ default: () => <div data-testid="body-dj" /> }));
vi.mock('@/pages/DancerProfile', () => ({ default: () => <div data-testid="body-dancer" /> }));
const h = vi.hoisted(() => ({ appearances: [] as unknown[] }));

import PersonPage from '../../PersonPage';

const TODAY = '2026-10-22';
const FUTURE = '2099-10-23T21:00:00Z';

type Shape = { name: string; held: PersonRole[]; djName?: string | null; gig?: boolean };

// The prod shapes (orchestrator survey, 2026-10-22): dancer+teacher 36, dancer+dj+teacher 25, dj+teacher.
const SHAPES: Shape[] = [
  { name: 'dancer', held: ['dancer'] },
  { name: 'dancer+teacher', held: ['teacher', 'dancer'] },
  { name: 'dancer+dj+teacher, gig', held: ['teacher', 'dj', 'dancer'], djName: 'DJ Rugido', gig: true },
  { name: 'dj+teacher', held: ['teacher', 'dj'], djName: 'Rugido' },
  { name: 'dj only', held: ['dj'], djName: 'DJ El Rugido' },
];

const visible = (s: Shape, open: boolean) => derivePersonRoles({ publicRoles: s.held, teacherPagesOpen: open, isTeacher: false, isDj: false, hasDancerRow: true, hasDancerContent: false });
const snap = (s: Shape, open: boolean): PersonSnapshot => ({
  id: 'p1', name: 'Vicky Franchi', avatarUrl: null, city: 'London', instagramUrl: null,
  roles: visible(s, open), heldRoles: s.held, djPhoto: null,
});
const dancerRow = { id: 'p1', first_name: 'Vicky', nationality: null, avatar_url: null, cities: { name: 'London' }, dancing_role_details: null };
const djRow = (s: Shape) => (s.held.includes('dj') ? { dj_name: s.djName ?? null, languages: null } : null);
const apps = (s: Shape): HubAppearance[] => (s.gig ? [{ event_id: 'e1', event_start_time: FUTURE }] : []);
const badgeOf = (s: Shape): PersonBadge => ({ id: 'p1', roles: s.held, djName: s.djName ?? null, djHasUpcoming: !!s.gig, nextGigDate: s.gig ? '2099-10-23' : null });
const model = (s: Shape, open: boolean) =>
  hubModel({ person: snap(s, open), dancerRow, dj: djRow(s), appearances: apps(s), opts: { teacherPagesOpen: open }, today: TODAY });
// The wall tile for the same person: the badges read carries the HELD roles.
const tile = (s: Shape, open: boolean) =>
  s.held.includes('dj')
    ? djWallPerson({ id: 'p1', display_name: 'Vicky Franchi', dj_name: s.djName ?? null, has_upcoming_gig: !!s.gig, next_gig_date: s.gig ? '2099-10-23' : null, nationality_code: null }, 'Vicky Franchi', badgeOf(s), open)
    : dancerWallPerson({ id: 'p1', avatar_url: null }, 'Vicky Franchi', null, badgeOf(s), open);

const mount = (s: Shape, open: boolean) => {
  h.appearances = apps(s);
  const qc = new QueryClient();
  qc.setQueryData(['dancer-profile', 'p1'], dancerRow);
  qc.setQueryData(['dj-profile', 'p1'], djRow(s));
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><PersonPage person={snap(s, open)} slugOrId="vicky-franchi" /></MemoryRouter>
    </QueryClientProvider>,
  );
};
const setFlags = (hub: boolean, teacher: boolean) => {
  (flags as { personHub: boolean }).personHub = hub;
  (flags as { teacherDetail: boolean }).teacherDetail = teacher;
};
beforeEach(() => setFlags(true, false));
afterEach(() => { cleanup(); setFlags(false, false); });

describe.each([false, true])('teacher pages open=%s: hub chips === wall tile chips', (open) => {
  it.each(SHAPES)('$name', (s) => {
    setFlags(true, open);
    const m = model(s, open);
    const t = tile(s, open);
    // Same labels, same order, same roles.
    expect(m.tags.map((x) => [x.role, x.label])).toEqual(t.tags.map((x) => [x.role, x.label]));
    expect(m.lead).toBe(t.lead);
    const vis = visible(s, open);
    // Cards stay on the visible roles: a closed teacher page is never offered.
    expect(m.cards.map((c) => c.role).sort()).toEqual([...vis].sort());
    expect(m.cardsHeading).toBe(m.cards.length < 2 ? 'Their page' : 'What Vicky does');
    for (const x of [...m.tags, ...m.cards]) if (x.href) expect(open || !x.href.startsWith('/teachers')).toBe(true);

    mount(s, open);
    const chips = Array.from(screen.getByTestId('person-hub').querySelectorAll('[data-testid="role-chip"]')).map((el) => (el.textContent ?? '').replace(/^,\s*/, ''));
    expect(chips).toEqual(t.tags.map((x) => x.label));
    const cards = screen.queryAllByTestId('hub-role-card').map((c) => c.getAttribute('data-role'));
    expect(cards.includes('teacher')).toBe(open && s.held.includes('teacher'));
    const hrefs = Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href') ?? '');
    if (!open) expect(hrefs.filter((x) => x.startsWith('/teachers'))).toEqual([]);
  });
});

it('Vicky Franchi (dancer + teacher, pages closed): the hub reads "Teacher, Dancer" like the wall, one Dancer card', () => {
  const s = SHAPES[1];
  const m = model(s, false);
  expect(m.tags.map((x) => x.label)).toEqual(['Teacher', 'Dancer']);
  expect(m.tags.find((x) => x.role === 'teacher')?.href).toBeNull();
  expect(m.cards.map((c) => c.role)).toEqual(['dancer']);
});

it('teacher-only, pages closed: zero visible roles (the route 404s) and the tile keeps its role page', () => {
  const s: Shape = { name: 'teacher only', held: ['teacher'] };
  expect(visible(s, false)).toEqual([]);
  expect(tileHref('p1', '/dancers/p1', badgeOf(s), { teacherPagesOpen: false })).toBe('/dancers/p1');
});

it('no heldRoles on the snapshot (older loader data): chips fall back to the visible roles', () => {
  const s = SHAPES[1];
  const person = { ...snap(s, false), heldRoles: undefined };
  const m = hubModel({ person, dancerRow, dj: null, appearances: [], opts: { teacherPagesOpen: false }, today: TODAY });
  expect(m.tags.map((x) => x.role)).toEqual(['dancer']);
});
