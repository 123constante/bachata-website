// @vitest-environment jsdom
/**
 * The person hub (flags.personHub). Table-driven over prod shapes; the same fact (name, chips and
 * order, link target, flag, city) must read the same on the hub, the wall tile and the old pages,
 * because all of them come from ONE mapping (badges.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { flags } from '@/lib/featureFlags';
import type { PersonRole } from '@/lib/searchEntities';
import { roleTagsFor, type PersonBadge } from '@/modules/person-page/badges';
import { dancerWallPerson, djWallPerson, tileHref } from '@/modules/person-page/wall/model';
import type { PersonSnapshot } from '../../reads';
import { cardOrder, factsOf, hubModel, nextGigOf, type HubAppearance, type HubDjRow } from '../model';
import { goBackTarget } from '../PersonHub';

const h = vi.hoisted(() => ({ appearances: [] as unknown[] }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/useProfileProgramAppearances', () => ({
  useProfileProgramAppearances: (_t: string, id: string | undefined) => ({ data: id ? h.appearances : undefined }),
}));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: vi.fn() }));
vi.mock('@/pages/TeacherProfile', () => ({ default: () => <div data-testid="body-teacher" /> }));
vi.mock('@/pages/DJProfile', () => ({ default: () => <div data-testid="body-dj" /> }));
vi.mock('@/pages/DancerProfile', () => ({ default: () => <div data-testid="body-dancer" /> }));

import PersonPage from '../../PersonPage';

const TODAY = '2026-10-22';
const FUTURE = '2099-10-23T21:00:00Z'; // a Friday
const OPEN = { teacherPagesOpen: true };
const CLOSED = { teacherPagesOpen: false };

type Shape = {
  name: string;
  roles: PersonRole[];
  realName?: string | null;
  djName?: string | null;
  gig?: boolean;
  avatar?: string | null;
  city?: string | null;
  nationality?: string | null;
  years?: number | null;
  languages?: string[] | null;
};

const snap = (s: Shape): PersonSnapshot => ({
  id: 'p1',
  name: s.realName === undefined ? 'Ana Garcia' : s.realName,
  avatarUrl: s.avatar === undefined ? 'https://x.test/a.jpg' : s.avatar,
  city: s.city === undefined ? 'London' : s.city,
  instagramUrl: null,
  roles: s.roles,
  djPhoto: null,
});
const dancerRow = (s: Shape) => ({
  id: 'p1', first_name: 'Ana', nationality: s.nationality ?? null, avatar_url: s.avatar ?? null,
  cities: s.city ? { name: s.city } : null,
  dancing_role_details: s.years ? { dance_started_year: new Date().getFullYear() - s.years } : null,
});
const djRow = (s: Shape): HubDjRow => (s.roles.includes('dj') ? { dj_name: s.djName ?? null, languages: s.languages ?? null } : null);
const apps = (s: Shape): HubAppearance[] => (s.gig ? [{ event_id: 'e9', event_start_time: FUTURE }, { event_id: 'e1', event_start_time: '2099-10-20T21:00:00Z' }] : [{ event_id: 'old', event_start_time: '2020-01-01T20:00:00Z' }]);
const model = (s: Shape, opts = OPEN) => hubModel({ person: snap(s), dancerRow: dancerRow(s), dj: djRow(s), appearances: apps(s), opts, today: TODAY });

const SHAPES: Array<Shape & { cards: PersonRole[]; heading: string; sub: string | null; button: boolean }> = [
  { name: 'DJ with gig', roles: ['dj'], djName: 'DJ El Rugido', gig: true, cards: ['dj'], heading: 'DJ El Rugido', sub: 'Ana Garcia', button: true },
  { name: 'DJ no gig', roles: ['dj'], djName: 'DJ El Rugido', cards: ['dj'], heading: 'DJ El Rugido', sub: 'Ana Garcia', button: false },
  { name: 'dancer only', roles: ['dancer'], cards: ['dancer'], heading: 'Ana Garcia', sub: null, button: false },
  { name: 'DJ+dancer, gig', roles: ['dj', 'dancer'], djName: 'Rugido', gig: true, cards: ['dj', 'dancer'], heading: 'Rugido', sub: 'Ana Garcia', button: true },
  { name: 'DJ+dancer, no gig', roles: ['dj', 'dancer'], djName: 'Rugido', cards: ['dancer', 'dj'], heading: 'Rugido', sub: 'Ana Garcia', button: false },
  { name: '3-role, gig', roles: ['teacher', 'dj', 'dancer'], djName: 'Rugido', gig: true, cards: ['dj', 'dancer', 'teacher'], heading: 'Rugido', sub: 'Ana Garcia', button: true },
  { name: 'teacher+dancer', roles: ['teacher', 'dancer'], cards: ['dancer', 'teacher'], heading: 'Ana Garcia', sub: null, button: false },
  { name: 'DJ, no stage name', roles: ['dj', 'dancer'], djName: null, cards: ['dancer', 'dj'], heading: 'Ana Garcia', sub: null, button: false },
  { name: 'long name', roles: ['dancer'], realName: 'DJ Carlos De La Cruz Fernandez-Montenegro', cards: ['dancer'], heading: 'DJ Carlos De La Cruz Fernandez-Montenegro', sub: null, button: false },
];

const mount = (s: Shape) => {
  h.appearances = apps(s);
  const qc = new QueryClient();
  qc.setQueryData(['dancer-profile', 'p1'], dancerRow(s));
  qc.setQueryData(['dj-profile', 'p1'], djRow(s));
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><PersonPage person={snap(s)} slugOrId="ana-garcia" /></MemoryRouter>
    </QueryClientProvider>,
  );
};
const setHub = (on: boolean) => { (flags as { personHub: boolean }).personHub = on; };
const setTeacher = (on: boolean) => { (flags as { teacherDetail: boolean }).teacherDetail = on; };

beforeEach(() => { setHub(true); setTeacher(true); });
afterEach(() => { cleanup(); setHub(false); setTeacher(false); });

describe('flags.personHub', () => {
  it('defaults OFF (env unset)', async () => {
    vi.resetModules();
    const fresh = await import('@/lib/featureFlags');
    expect(fresh.flags.personHub).toBe(false);
  });

  it('OFF: the tabbed page (tabs, no hub)', () => {
    setHub(false);
    mount({ name: 'x', roles: ['dj', 'dancer'], djName: 'Rugido' });
    expect(screen.queryByTestId('person-hub')).toBeNull();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['DJ', 'Dancing']);
  });

  it('ON: the hub, no tabs', () => {
    mount({ name: 'x', roles: ['dj', 'dancer'], djName: 'Rugido' });
    expect(screen.getByTestId('person-hub')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});

describe('hub shapes (rendered, flag ON)', () => {
  it.each(SHAPES)('$name: name, cards in lead order, button only with a gig', (s) => {
    mount(s);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId('hub-name').textContent).toBe(s.heading);
    expect(screen.queryByTestId('hub-subname')?.textContent ?? null).toBe(s.sub === null ? null : s.sub);
    const cards = screen.getAllByTestId('hub-role-card');
    expect(cards.map((c) => c.getAttribute('data-role'))).toEqual(s.cards);
    // Every card is a real link to that role's own page.
    for (const c of cards) expect(c.getAttribute('href')).toBe(`/${{ dj: 'djs', dancer: 'dancers', teacher: 'teachers' }[c.getAttribute('data-role') as PersonRole]}/p1`);
    const btn = screen.queryByTestId('hub-next-event');
    expect(!!btn).toBe(s.button);
    if (btn) expect(btn.getAttribute('href')).toBe('/event/e1');
    // No text points at a button that is not there.
    if (!s.button) expect(document.body.textContent).not.toMatch(/next event/i);
  });

  it('teacher pages closed: no teacher card, no teacher chip (never a dead link)', () => {
    setTeacher(false);
    mount({ name: 'x', roles: ['teacher', 'dancer'] });
    expect(screen.getAllByTestId('hub-role-card').map((c) => c.getAttribute('data-role'))).toEqual(['dancer']);
    expect(screen.queryAllByTestId('hub-role-card').every((c) => !!c.getAttribute('href'))).toBe(true);
  });

  it('no photo: initials tile in the lead accent, no <img>', () => {
    mount({ name: 'x', roles: ['dancer'], avatar: null });
    expect(screen.getByTestId('hub-face').getAttribute('data-face')).toBe('initials');
    expect(screen.getByTestId('hub-face').textContent).toBe('AG');
    expect(screen.getByTestId('hub-face').querySelector('img')).toBeNull();
  });

  it('no name at all: the page placeholder as heading, "?" on the face (not its initials)', () => {
    mount({ name: 'x', roles: ['dj'], realName: null, avatar: null });
    expect(screen.getByTestId('hub-name').textContent).toBe('Bachata Calendar profile');
    expect(screen.getByTestId('hub-face').textContent).toBe('?');
  });

  it('broken photo URL: falls back to initials, never a broken image', () => {
    mount({ name: 'x', roles: ['dancer'], avatar: 'https://x.test/broken.jpg' });
    const img = screen.getByTestId('hub-face').querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    act(() => { fireEvent.error(img); });
    expect(screen.getByTestId('hub-face').getAttribute('data-face')).toBe('initials');
    expect(screen.getByTestId('hub-face').querySelector('img')).toBeNull();
  });

  it('no city: no city line; city: one line', () => {
    mount({ name: 'x', roles: ['dancer'], city: null });
    expect(screen.queryByTestId('hub-city')).toBeNull();
    cleanup();
    mount({ name: 'x', roles: ['dancer'] });
    expect(screen.getByTestId('hub-city').textContent).toBe('London');
  });

  it('no facts: the strip is ABSENT (not an empty box)', () => {
    mount({ name: 'x', roles: ['dancer'] });
    expect(screen.queryByTestId('hub-facts')).toBeNull();
  });

  it('facts: only those that exist', () => {
    mount({ name: 'x', roles: ['dj', 'dancer'], years: 4, languages: ['Spanish', 'English'] });
    expect(Array.from(screen.getByTestId('hub-facts').querySelectorAll('li')).map((l) => l.textContent)).toEqual([
      '\u2022 4 years dancing', '\u2022 Spanish, English',
    ]);
  });

  it('flag sticker only when nationality exists', () => {
    mount({ name: 'x', roles: ['dancer'], nationality: null });
    expect(document.querySelector('[data-nationality-flag]')).toBeNull();
    cleanup();
    mount({ name: 'x', roles: ['dancer'], nationality: 'VE' });
    expect(document.querySelector('[data-nationality-flag]')?.getAttribute('data-nationality-flag')).toBe('VE');
  });
});

describe('model rules', () => {
  it('cardOrder is leadRole applied repeatedly (gig DJ, dancer, DJ, teacher)', () => {
    const b = (roles: PersonRole[], gig: boolean): PersonBadge => ({ id: 'p', roles, djName: null, djHasUpcoming: gig, nextGigDate: null });
    expect(cardOrder(b(['teacher', 'dj', 'dancer'], true))).toEqual(['dj', 'dancer', 'teacher']);
    expect(cardOrder(b(['teacher', 'dj', 'dancer'], false))).toEqual(['dancer', 'dj', 'teacher']);
    expect(cardOrder(b(['teacher', 'dj'], false))).toEqual(['dj', 'teacher']);
    expect(cardOrder(b(['teacher'], false))).toEqual(['teacher']);
    expect(cardOrder(b([], false))).toEqual([]);
  });

  it('nextGigOf: soonest from today, past ignored, none = null', () => {
    expect(nextGigOf([{ event_id: 'a', event_start_time: '2026-10-21T20:00:00Z' }], TODAY)).toBeNull();
    expect(nextGigOf([], TODAY)).toBeNull();
    expect(nextGigOf(undefined, TODAY)).toBeNull();
    expect(nextGigOf([{ event_id: 'b', event_start_time: FUTURE }, { event_id: 'a', event_start_time: '2026-10-22T20:00:00Z' }], TODAY))
      .toEqual({ eventId: 'a', dateLabel: 'Thu 22', count: 2 });
  });

  it('factsOf: empty when nothing exists', () => {
    expect(factsOf(null, null)).toEqual([]);
    expect(factsOf('0', [])).toEqual([]);
    expect(factsOf('1', ['English'])).toEqual(['1 year dancing', 'English']);
  });

  it('zero visible roles: no cards (the route 404s before the hub renders)', () => {
    expect(model({ name: 'x', roles: [] }).cards).toEqual([]);
  });

  it('back: history only for a same-origin referrer, else /dancers', () => {
    expect(goBackTarget('https://site.test/djs', 'https://site.test', 3)).toBe('history');
    expect(goBackTarget('https://google.com/', 'https://site.test', 3)).toBe('/dancers');
    expect(goBackTarget('', 'https://site.test', 3)).toBe('/dancers');
    expect(goBackTarget('https://site.test/djs', 'https://site.test', 1)).toBe('/dancers');
    expect(goBackTarget('not a url', 'https://site.test', 3)).toBe('/dancers');
  });
});

describe('same fact, same reading: hub vs wall tile vs role pages (ONE mapping)', () => {
  const CASES: Shape[] = [
    { name: 'DJ+dancer gig', roles: ['dj', 'dancer'], djName: 'DJ Rugido', gig: true, nationality: 'VE' },
    { name: 'dancer only', roles: ['dancer'], nationality: null },
    { name: '3-role', roles: ['teacher', 'dj', 'dancer'], djName: 'Rugido' },
    { name: 'no city', roles: ['dancer'], city: null },
  ];
  it.each(CASES)('$name', (s) => {
    setHub(false);
    const m = model(s);
    const badge: PersonBadge = { id: 'p1', roles: s.roles, djName: s.djName ?? null, djHasUpcoming: !!s.gig, nextGigDate: s.gig ? '2099-10-20' : null };
    // Chips and their order: the same list the wall and the old pages' "Also" row use.
    expect(m.tags).toEqual(roleTagsFor(badge, OPEN));
    const tile = s.roles.includes('dj')
      ? djWallPerson({ id: 'p1', display_name: 'Ana Garcia', dj_name: s.djName ?? null, has_upcoming_gig: !!s.gig, next_gig_date: badge.nextGigDate, nationality_code: m.flagCode }, s.djName ?? 'Ana Garcia', badge, true)
      : dancerWallPerson({ id: 'p1', avatar_url: null }, 'Ana Garcia', m.flagCode, badge, true);
    expect(tile.tags.map((t) => t.label)).toEqual(m.tags.map((t) => t.label));
    expect(tile.lead).toBe(m.lead);
    expect(tile.flagCode).toBe(m.flagCode);
    // Link target: flag OFF the tile opens the lead role page, which is the hub's card for that role.
    expect(tile.href).toBe(m.cards.find((c) => c.role === m.lead)?.href);
    // Name: the tile drops the leading "DJ" (its chip says it); otherwise identical.
    expect(m.heading.replace(/^dj\s+/i, '')).toBe(tile.name.replace(/^dj\s+/i, ''));
    expect(m.city).toBe(s.city === undefined ? 'London' : s.city);
  });

  it('wall tiles: flag ON -> /people/<id> only with a visible role; OFF -> the role page; no page -> no link', () => {
    const b = (roles: PersonRole[]): PersonBadge => ({ id: 'p1', roles, djName: null, djHasUpcoming: false, nextGigDate: null });
    setHub(true);
    expect(tileHref('p1', '/djs/p1', b(['dj']), OPEN)).toBe('/people/p1');
    expect(tileHref('p1', null, b(['dj']), OPEN)).toBeNull();
    // Zero roles (every active dancer row is on /dancers): /people/:id would 404, so keep the role page.
    expect(tileHref('p1', '/dancers/p1', b([]), OPEN)).toBe('/dancers/p1');
    // Only a closed teacher page: same.
    expect(tileHref('p1', '/dancers/p1', b(['teacher']), CLOSED)).toBe('/dancers/p1');
    // Badges read failed / no row: as today.
    expect(tileHref('p1', '/dancers/p1', undefined, OPEN)).toBe('/dancers/p1');
    setHub(false);
    expect(tileHref('p1', '/djs/p1', b(['dj']), OPEN)).toBe('/djs/p1');
    expect(tileHref('p1', null, b(['dj']), OPEN)).toBeNull();
  });

  it('teacher closed: the hub never offers a card the tile could not link to', () => {
    const m = model({ name: 'x', roles: ['teacher', 'dancer'] }, CLOSED);
    expect(m.cards.map((c) => c.role)).toEqual(['dancer']);
    expect(m.tags.find((t) => t.role === 'teacher')?.href ?? null).toBeNull();
  });
});
