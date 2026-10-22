// @vitest-environment jsdom
/**
 * The person hub (flags.personHub), W2-D option C. The cross-surface matrix (tile, redirect, chips, hero,
 * Also) is destinationMatrix.test.tsx; this file covers the flag, the face, the name, the gig line, the
 * no-swap rule, About and the model helpers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { flags } from '@/lib/featureFlags';
import type { PersonRole } from '@/lib/searchEntities';
import type { PersonBadge } from '@/modules/person-page/badges';
import type { PersonSnapshot } from '../../reads';
import { cardOrder, factsOf, hubModel, nextGigOf, personPageRedirect } from '../model';
import { goBackTarget } from '../PersonHub';

const h = vi.hoisted(() => ({ data: undefined as unknown[] | undefined, isError: false }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/useProfileProgramAppearances', () => ({
  useProfileProgramAppearances: (_t: string, id: string | undefined) => ({ data: id ? h.data : undefined, isError: h.isError }),
}));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: vi.fn() }));
vi.mock('@/pages/TeacherProfile', () => ({ default: () => <div data-testid="body-teacher" /> }));
vi.mock('@/pages/DJProfile', () => ({ default: () => <div data-testid="body-dj" /> }));
vi.mock('@/pages/DancerProfile', () => ({ default: () => <div data-testid="body-dancer" /> }));

import PersonPage from '../../PersonPage';

const TODAY = '2026-10-22';
const GIG = [{ event_id: 'e1', event_start_time: '2099-10-23T21:00:00Z' }, { event_id: 'e2', event_start_time: '2099-10-30T21:00:00Z' }];

type Opt = { name?: string | null; avatar?: string | null; city?: string | null; nationality?: string | null; djName?: string | null; badge?: Partial<PersonBadge> | null; held?: PersonRole[] };
const snap = (roles: PersonRole[], o: Opt = {}): PersonSnapshot => ({
  id: 'p1', name: o.name === undefined ? 'Ana Garcia' : o.name, avatarUrl: o.avatar === undefined ? null : o.avatar,
  city: o.city === undefined ? 'London' : o.city, instagramUrl: null, roles, heldRoles: o.held ?? roles, djPhoto: null,
});
const mount = (roles: PersonRole[], o: Opt = {}) => {
  const qc = new QueryClient();
  qc.setQueryData(['dancer-profile', 'p1'], { id: 'p1', first_name: 'Ana', nationality: o.nationality ?? null, dancing_role_details: { dance_started_year: new Date().getFullYear() - 6 } });
  qc.setQueryData(['dj-profile', 'p1'], roles.includes('dj') ? { dj_name: o.djName === undefined ? 'DJ Rugido' : o.djName, languages: ['English', 'Spanish'] } : null);
  if (o.badge !== null) qc.setQueryData(['people-badges', ['p1']], new Map([['p1', { id: 'p1', roles: o.held ?? roles, djName: null, djHasUpcoming: false, nextGigDate: null, ...o.badge }]]));
  const r = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><PersonPage person={snap(roles, o)} slugOrId="ana-garcia" /></MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...r, qc };
};
const setHub = (on: boolean) => { (flags as { personHub: boolean }).personHub = on; };
const setTeacher = (on: boolean) => { (flags as { teacherDetail: boolean }).teacherDetail = on; };

beforeEach(() => { setHub(true); setTeacher(false); h.data = []; h.isError = false; });
afterEach(() => { cleanup(); setHub(false); setTeacher(false); });

describe('flags.personHub', () => {
  it('defaults OFF (env unset)', async () => {
    vi.resetModules();
    const fresh = await import('@/lib/featureFlags');
    expect(fresh.flags.personHub).toBe(false);
  });
  it('OFF: the tabbed page (tabs, no hub)', () => {
    setHub(false);
    mount(['dj', 'dancer']);
    expect(screen.queryByTestId('person-hub')).toBeNull();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['DJ', 'Dancing']);
  });
  it('ON: the hub, no tabs, one h1', () => {
    mount(['dj', 'dancer']);
    expect(screen.getByTestId('person-hub')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('hero name, face, gig line', () => {
  it('DJ leads (gig): stage name heads, real name under it, gig line with the count', () => {
    h.data = GIG;
    mount(['dj', 'dancer'], { badge: { djHasUpcoming: true, nextGigDate: '2099-10-23' } });
    expect(screen.getByTestId('hub-name').textContent).toBe('DJ Rugido');
    expect(screen.getByTestId('hub-subname').textContent).toBe('Ana Garcia');
    expect(screen.getByTestId('hub-line').textContent).toBe('Next gig Fri 23 · 2 coming up');
  });
  it('dancer leads: real name heads, "DJ <stage>" under it, years and languages', () => {
    mount(['dj', 'dancer']);
    expect(screen.getByTestId('hub-name').textContent).toBe('Ana Garcia');
    expect(screen.getByTestId('hub-subname').textContent).toBe('DJ Rugido');
    expect(screen.getByTestId('hub-line').textContent).toBe('6 years dancing · English, Spanish');
  });
  it('a DJ in Also with no gig says so (never a gig the page cannot show)', () => {
    mount(['dj', 'dancer']);
    expect(screen.getAllByTestId('hub-also-card')[0].textContent).toMatch(/No gigs listed right now/);
  });
  it('no photo: initials tile, no <img>', () => {
    mount(['dj', 'dancer']);
    expect(screen.getByTestId('hub-face').getAttribute('data-face')).toBe('initials');
    expect(document.querySelector('img')).toBeNull();
  });
  it('broken photo URL: falls back to initials, never a broken image', () => {
    mount(['dj', 'dancer'], { avatar: 'https://x.test/gone.jpg' });
    const img = document.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    act(() => { fireEvent.error(img); });
    expect(screen.getByTestId('hub-face').getAttribute('data-face')).toBe('initials');
    expect(document.querySelector('img')).toBeNull();
  });
  it('no name at all: the placeholder heads, "?" on the face', () => {
    mount(['dj', 'dancer'], { name: null, djName: null });
    expect(screen.getByTestId('hub-name').textContent).toBe('Bachata Calendar profile');
    expect(screen.getByTestId('hub-face').textContent).toBe('?');
  });
  it('flag sticker: only with a nationality, at most a quarter of the face', () => {
    mount(['dj', 'dancer'], { nationality: 'VE' });
    const flag = document.querySelector('[data-nationality-flag]') as HTMLElement;
    expect(flag).toBeTruthy();
    expect(parseFloat((flag.closest('[style*="width"]') as HTMLElement).style.width)).toBeLessThanOrEqual(32);
  });
});

describe('no swap after first paint (gig list arrives late)', () => {
  it('badge says gig: DJ leads on first paint with the badge date, the line keeps its place', () => {
    h.data = undefined;
    const r = mount(['dj', 'dancer'], { badge: { djHasUpcoming: true, nextGigDate: '2099-10-23' } });
    expect(screen.getByTestId('hub-hero').getAttribute('data-role')).toBe('dj');
    expect(screen.getByTestId('hub-line').textContent).toBe('Next gig Fri 23');
    h.data = GIG;
    r.rerender(<QueryClientProvider client={r.qc}><MemoryRouter><PersonPage person={snap(['dj', 'dancer'])} slugOrId="x" /></MemoryRouter></QueryClientProvider>);
    expect(screen.getByTestId('hub-hero').getAttribute('data-role')).toBe('dj');
  });
  it('no badge row (read failed): the lead painted first stays, the DJ line says it is checking, then answers', () => {
    h.data = undefined;
    const r = mount(['dj', 'dancer'], { badge: null });
    expect(screen.getByTestId('hub-hero').getAttribute('data-role')).toBe('dancer');
    expect(screen.getAllByTestId('hub-also-card')[0].textContent).toMatch(/Checking for gigs/);
    h.data = GIG;
    r.rerender(<QueryClientProvider client={r.qc}><MemoryRouter><PersonPage person={snap(['dj', 'dancer'], { badge: null })} slugOrId="x" /></MemoryRouter></QueryClientProvider>);
    expect(screen.getByTestId('hub-hero').getAttribute('data-role')).toBe('dancer');
    expect(screen.getAllByTestId('hub-also-card')[0].textContent).toMatch(/Next gig Fri 23/);
  });
  it('the gig list read fails: the line never stays on "Checking"', () => {
    h.data = undefined; h.isError = true;
    mount(['dj', 'dancer'], { badge: null });
    expect(document.body.textContent).not.toMatch(/Checking/);
  });
  it('the hero line always reserves its height', () => {
    mount(['dj', 'dancer']);
    expect(screen.getByTestId('hub-line').style.minHeight).toBe('22px');
  });
});

describe('About, ground, fade', () => {
  it('About: city and facts that exist; nothing at all = no About', () => {
    mount(['dj', 'dancer']);
    expect(screen.getByTestId('hub-about').textContent).toMatch(/London · 6 years dancing · English, Spanish/);
    cleanup();
    const m = hubModel({ person: snap(['dancer', 'teacher'], { city: null }), dancerRow: null, dj: null, appearances: [], opts: { teacherPagesOpen: false }, today: TODAY });
    expect(m.about).toEqual([]);
  });
  it('the warm ground reaches the end of the first screen and ends in the footer fade marker', () => {
    mount(['dj', 'dancer']);
    expect(screen.getByTestId('person-hub').style.minHeight).toMatch(/svh/);
    expect(document.querySelector('[data-hub-footer-join]')).toBeTruthy();
  });
});

describe('model helpers', () => {
  const badge = (roles: PersonRole[], gig = false): PersonBadge => ({ id: 'p1', roles, djName: null, djHasUpcoming: gig, nextGigDate: null });
  it('cardOrder is leadRole applied repeatedly (gig DJ, dancer, DJ, teacher)', () => {
    expect(cardOrder(badge(['teacher', 'dj', 'dancer'], true))).toEqual(['dj', 'dancer', 'teacher']);
    expect(cardOrder(badge(['teacher', 'dj', 'dancer']))).toEqual(['dancer', 'dj', 'teacher']);
    expect(cardOrder(badge([]))).toEqual([]);
  });
  it('nextGigOf: soonest from today, past ignored, none = null', () => {
    expect(nextGigOf([{ event_id: 'old', event_start_time: '2020-01-01T20:00:00Z' }, ...GIG], TODAY)).toEqual({ eventId: 'e1', dateLabel: 'Fri 23', count: 2 });
    expect(nextGigOf([], TODAY)).toBeNull();
    expect(nextGigOf(undefined, TODAY)).toBeNull();
  });
  it('factsOf: only facts that exist', () => {
    expect(factsOf(null, null)).toEqual([]);
    expect(factsOf('1', ['English'])).toEqual(['1 year dancing', 'English']);
  });
  it('personPageRedirect uses the slug and the held roles (older loader data: the visible roles)', () => {
    const p = { ...snap(['dancer']), heldRoles: undefined };
    expect(personPageRedirect(p, { teacherPagesOpen: false }, 'ana-garcia')).toBe('/dancers/ana-garcia');
    expect(personPageRedirect(snap(['dancer'], { held: ['teacher', 'dancer'] }), { teacherPagesOpen: false })).toBeNull();
  });
  it('back: history only for a same-origin referrer, else /dancers', () => {
    expect(goBackTarget('https://site.test/dancers', 'https://site.test', 3)).toBe('history');
    expect(goBackTarget('https://google.com/', 'https://site.test', 3)).toBe('/dancers');
    expect(goBackTarget('', 'https://site.test', 3)).toBe('/dancers');
    expect(goBackTarget('https://site.test/x', 'https://site.test', 1)).toBe('/dancers');
  });
});
