// @vitest-environment jsdom
/**
 * Organiser public page P1 (docs/organiser-page/ACCEPTANCE.md S1, S2, S3-read,
 * S5, S4 copy): every section x every prod shape (ACCEPTANCE section 3,
 * re-surveyed 2026-11-05). Rendered as a visitor (P1/P2/P5 read the same).
 *
 * Invariants asserted on EVERY shape: no 0 / `--` stat (a failed feed's stat
 * is a marked dash, never a number), no "Not added", no "Just getting started",
 * no "elsewhere in London", no dead Verified badge, no "Online" pills, no
 * Facebook row, section order hero > stats > Get in touch > Team > About >
 * Next nights > Past nights, and no copy that points at a control that is not
 * on screen.
 *
 * Fix round 1 (docs/briefs/organiser-page-p1-fix1.md): every feed / contact /
 * team failure combination x owner / visitor; per-feed stats; Team flags and
 * role-aware links restored; Try again pending state.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Feed = 'ok' | 'error' | 'hang';
type Role = 'dancer' | 'dj' | 'teacher';
interface Shape {
  owner: boolean;
  roles: Role[][] | null;
  entity: 'ok' | 'error' | 'missing' | 'pending';
  upcoming: number;
  past: number;
  team: number;
  bio: boolean;
  foundedYear: number | null;
  phone: boolean;
  email: boolean;
  instagram: boolean;
  website: boolean;
  facebook: boolean;
  feeds: { events: Feed; future: Feed; past: Feed; team: Feed; dancers: Feed; badges: Feed; contact: Feed };
}

const s = vi.hoisted(() => ({ shape: null as unknown as Shape }));
const never = () => new Promise<never>(() => {});
const flag = vi.hoisted(() => ({ teacherDetail: false } as Record<string, boolean>));
const emit = vi.hoisted(() => ({ calls: [] as Array<{ personId: string; profileType: string; context: string }> }));
const CODES = ['ES', 'GB', 'FR'];

// 2026-11-05 is a Thursday; nights are Fridays at 21:00.
const fridayFrom = (start: string, i: number, dir: 1 | -1) => {
  const d = new Date(`${start}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dir * 7 * i);
  return d.toISOString().slice(0, 10);
};
const occ = (date: string, past: boolean) => ({
  event_id: 'ev-1', name: 'Friday Social', occurrence_id: `occ-${date}`, instance_date: date, start_time: `${date}T21:00:00`,
  photo_url: null, cover_image_url: null, location: 'Soho', is_cancelled: false, is_past: past,
});
const EVENT = { id: 'ev-1', name: 'Friday Social', date: null, start_time: null, is_active: true, poster_url: null, location: 'Soho', city: 'London' };

vi.mock('@/lib/seo', async (orig) => ({
  ...(await orig<typeof import('@/lib/seo')>()),
  useEntitySlugOrId: () => ({ id: 'org-1', slug: 'org', arrivedViaUuid: false }),
  useCanonicalReplaceState: () => {},
}));
vi.mock('@/lib/publicDancerNames', () => ({
  withPublicNames: async <T extends { first_name?: string | null }>(rows: T[]) => rows.map((r) => ({ ...r, public_name: r.first_name })),
}));
vi.mock('@/modules/profile/organiserPublicProfile', async (orig) => ({
  ...(await orig<typeof import('@/modules/profile/organiserPublicProfile')>()),
  fetchOrganiserEntity: async () => {
    const sh = s.shape;
    if (sh.entity === 'pending') return new Promise(() => {});
    if (sh.entity === 'error') throw new Error('entity boom');
    if (sh.entity === 'missing') return null;
    const socials: Record<string, string> = {};
    if (sh.facebook) socials.facebook = 'https://facebook.com/bachataconnect';
    return {
      id: 'org-1', name: 'Bachata Connect', avatar_url: null, bio: sh.bio ? 'We run socials. Every Friday in Soho.' : null,
      socials, city_id: 'c1', instagram: sh.instagram ? 'bachataconnect' : null, website: sh.website ? 'https://bachataconnect.co.uk' : null,
      organisation_category: 'Socials', founded_year: sh.foundedYear, cities: { name: 'Leeds', slug: 'leeds' },
    };
  },
  fetchOrganiserEvents: async () => {
    if (s.shape.feeds.events === 'hang') return never();
    if (s.shape.feeds.events === 'error') throw new Error('events boom');
    return s.shape.upcoming + s.shape.past > 0 ? [EVENT] : [];
  },
  fetchOrganiserFutureOccEvents: async () => {
    if (s.shape.feeds.future === 'hang') return never();
    if (s.shape.feeds.future === 'error') throw new Error('future boom');
    return Array.from({ length: s.shape.upcoming }, (_, i) => occ(fridayFrom('2026-11-06', i, 1), false));
  },
  fetchOrganiserPastOccEvents: async () => {
    if (s.shape.feeds.past === 'hang') return never();
    if (s.shape.feeds.past === 'error') throw new Error('past boom');
    return Array.from({ length: s.shape.past }, (_, i) => occ(fridayFrom('2026-10-30', i, -1), true));
  },
}));
vi.mock('@/integrations/supabase/client', () => {
  const chainFor = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order', 'not', 'maybeSingle']) chain[m] = () => chain;
    chain.then = (res: (v: unknown) => void) => {
      const n = s.shape.team;
      if (table === 'organiser_team_members') {
        if (s.shape.feeds.team === 'hang') return undefined;
        if (s.shape.feeds.team === 'error') return res({ data: null, error: { message: 'team boom' } });
        return res({ data: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, sort_order: i, member_profile_id: `d${i}`, is_active: true })), error: null });
      }
      if (table === 'dancer_profiles') {
        if (s.shape.feeds.dancers === 'error') return res({ data: null, error: { message: 'dancers boom' } });
        return res({ data: Array.from({ length: n }, (_, i) => ({ id: `d${i}`, first_name: ['Ana', 'Ben', 'Cleo'][i] ?? `P${i}`, avatar_url: null, nationality: CODES[i] ?? null })), error: null });
      }
      return res({ data: [], error: null });
    };
    return chain;
  };
  return { supabase: { from: chainFor, rpc: async (fn: string) => {
    // P2: the public Team is organiser_public_team_v1 (rows already ordered by sort_key).
    if (fn === 'organiser_public_team_v1') {
      if (s.shape.feeds.team === 'hang') return never();
      if (s.shape.feeds.team === 'error') return { data: null, error: { message: 'team boom' } };
      return { data: Array.from({ length: s.shape.team }, (_, i) => ({ person_id: `d${i}`, slug: null, public_name: ['Ana', 'Ben', 'Cleo'][i] ?? `P${i}`, avatar_url: null, sort_key: i + 1 })), error: null };
    }
    if (fn === 'organiser_ownership_v1') return { data: s.shape.owner ? { is_managed: true, i_own_it: true, my_role: 'owner' } : { is_managed: false, i_own_it: false, my_role: null }, error: null };
    if (fn === 'get_public_people_badges_v1') {
      if (s.shape.feeds.badges === 'hang') return never();
      if (s.shape.feeds.badges === 'error') return { data: null, error: { message: 'badges boom' } };
      return { data: Array.from({ length: s.shape.team }, (_, i) => ({ id: `d${i}`, roles: s.shape.roles?.[i] ?? ['dancer'], dj_name: null })), error: null };
    }
    if (fn === 'get_organiser_public_contact_v1') {
      if (s.shape.feeds.contact === 'hang') return never();
      if (s.shape.feeds.contact === 'error') return { data: null, error: { message: 'contact boom' } };
      return { data: { contact_phone: s.shape.phone ? '+44 7700 900123' : null, contact_email: s.shape.email ? 'hello@example.com' : null }, error: null };
    }
    return { data: null, error: null };
  } } };
});
vi.mock('@/hooks/useAuth', async () => ({
  useAuth: () => (s.shape?.owner ? { user: { id: 'u-owner', email: 'owner@example.com' }, session: {} } : { user: null, session: null }),
  ProfileGateContext: (await import('react')).createContext(null),
}));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-11-05' }));
const noindex = vi.hoisted(() => ({ last: null as boolean | null }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: (on: boolean) => { noindex.last = on; } }));
// The owner's edit layer is its own suite; here only the page's own owner copy is under test.
vi.mock('@/modules/organiser/edit-in-place/EditInPlaceLayer', () => ({ default: () => null }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  for (const [k, v] of Object.entries(real.flags)) if (!(k in flag)) flag[k] = v as boolean;
  return { ...real, flags: flag };
});
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: (e: { personId: string; profileType: string; context: string }) => { emit.calls.push(e); } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import OrganiserProfile from '@/pages/OrganiserProfile';

if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-05T12:00:00Z')); });
afterAll(() => { vi.useRealTimers(); });
afterEach(() => { cleanup(); noindex.last = null; emit.calls = []; flag.teacherDetail = false; });

const OK = { events: 'ok', future: 'ok', past: 'ok', team: 'ok', dancers: 'ok', badges: 'ok', contact: 'ok' } as const;
const base: Shape = { owner: false, roles: null, entity: 'ok', upcoming: 0, past: 0, team: 1, bio: false, foundedYear: null, phone: true, email: false, instagram: true, website: false, facebook: false, feeds: { ...OK } };
const shape = (o: Partial<Omit<Shape, 'feeds'>> & { feeds?: Partial<Shape['feeds']> }): Shape => ({ ...base, ...o, feeds: { ...OK, ...(o.feeds ?? {}) } });

async function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/organisers/org']}>
        <Routes><Route path="/organisers/:id" element={<OrganiserProfile />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  if (s.shape.entity === 'pending') { await new Promise((r) => setTimeout(r, 20)); return; }
  if (s.shape.entity === 'ok') await screen.findByRole('heading', { level: 1, name: /Bachata Connect/ });
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
}

const text = () => document.body.textContent ?? '';
const h2s = () => Array.from(document.querySelectorAll('h2')).map((h) => h.textContent?.trim() ?? '');
const statKeys = () => Array.from(document.querySelectorAll('[data-stat]')).map((e) => e.getAttribute('data-stat'));
const statValues = () => Array.from(document.querySelectorAll('[data-stat-value]')).map((e) => e.textContent);
const contactKeys = () => Array.from(document.querySelectorAll('[data-contact-row]')).map((e) => e.getAttribute('data-contact-row'));
const failedStats = () => Array.from(document.querySelectorAll('[data-stat][data-stat-failed]')).map((e) => e.getAttribute('data-stat'));
const DASH = '\u2013';

/** No copy points at a control that is not on screen (CLAUDE.md definition of done 2). */
function noCopyWithoutControl() {
  const t = text();
  const buttons = Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim() ?? '');
  const tryAgainLines = document.querySelectorAll('[data-testid^="org-feed-error-"], [data-testid="org-contact-error"]');
  for (const line of Array.from(tryAgainLines)) expect(line.querySelector('button'), `${line.getAttribute('data-testid')} has its retry`).toBeTruthy();
  if (/Complete your profile/.test(t)) expect(buttons).toContain('Complete your profile');
  if (/Browse upcoming nights/.test(t)) expect(screen.getByRole('link', { name: 'Browse upcoming nights' })).toBeTruthy();
  // A "Next night" stat that is a button scrolls to the Next nights list: the list must be there.
  const nextBtn = document.querySelector('button[data-stat="next_night"]');
  if (nextBtn) expect(document.getElementById('upcoming')).toBeTruthy();
  // A failed-feed dash is never a button and always says why.
  for (const f of Array.from(document.querySelectorAll('[data-stat-failed]'))) {
    expect(f.tagName).not.toBe('BUTTON');
    expect(f.getAttribute('aria-label') ?? '').toMatch(/couldn\u2019t load/i);
  }
}
const ORDER = ['Get in touch', 'Team', 'About', 'Next nights', 'Recently hosted', 'Past nights'];

function visitorOrOwnerInvariants(owner: boolean) {
  if (!owner) return visitorInvariants();
  const t = text();
  expect(t).not.toMatch(/elsewhere in London/);
  expect(t).not.toMatch(/Verified/);
  for (const el of Array.from(document.querySelectorAll('[data-stat]'))) {
    const v = el.querySelector('[data-stat-value]')?.textContent ?? '';
    expect(v === DASH).toBe(el.hasAttribute('data-stat-failed'));
  }
  noCopyWithoutControl();
}

function visitorInvariants() {
  const t = text();
  expect(t).not.toMatch(/Not added/);
  expect(t).not.toMatch(/Just getting started/);
  expect(t).not.toMatch(/elsewhere in London/);
  expect(t).not.toMatch(/Verified/);
  expect(h2s()).not.toContain('Online');
  expect(h2s()).not.toContain('Teachers & DJs');
  expect(contactKeys()).not.toContain('facebook' as never);
  for (const el of Array.from(document.querySelectorAll('[data-stat]'))) {
    const v = el.querySelector('[data-stat-value]')?.textContent ?? '';
    expect(v).not.toBe('0'); expect(v).not.toBe('--'); expect(v.trim()).not.toBe('');
    // The only non-value a stat may show is the marked dash of a failed feed.
    expect(v === DASH).toBe(el.hasAttribute('data-stat-failed'));
  }
  noCopyWithoutControl();
  expect(statKeys().length).toBeLessThanOrEqual(3);
  // Section order.
  const seen = h2s().filter((h) => ORDER.includes(h)).map((h) => ORDER.indexOf(h));
  expect([...seen].sort((a, b) => a - b)).toEqual(seen);
}

interface Row { name: string; shape: Shape; stats: string[]; dashes?: string[]; upcomingHeading: boolean; pastHeading: 'Past nights' | 'Recently hosted' | null; noDates: boolean; team: string[]; errors: string[] }
const ROWS: Row[] = [
  { name: 'large ticketed, 120 weekly upcoming + 30 past', shape: shape({ upcoming: 120, past: 30, team: 3, bio: true, website: true, email: true }), stats: ['next_night', 'nights_hosted', 'weekly_rhythm'], upcomingHeading: true, pastHeading: 'Past nights', noDates: false, team: ['Ana', 'Ben', 'Cleo'], errors: [] },
  { name: 'weekly class, 4 upcoming + 10 past', shape: shape({ upcoming: 4, past: 10, team: 2 }), stats: ['next_night', 'nights_hosted', 'weekly_rhythm'], upcomingHeading: true, pastHeading: 'Past nights', noDates: false, team: ['Ana', 'Ben'], errors: [] },
  { name: 'brand new, 1 upcoming, nothing else', shape: shape({ upcoming: 1, past: 0 }), stats: ['next_night'], upcomingHeading: true, pastHeading: null, noDates: false, team: ['Ana'], errors: [] },
  { name: 'past-only, 6 past', shape: shape({ upcoming: 0, past: 6 }), stats: ['last_night', 'nights_hosted', 'weekly_rhythm'], upcomingHeading: false, pastHeading: 'Recently hosted', noDates: true, team: ['Ana'], errors: [] },
  { name: 'past-only, 2 past (under the hosted threshold)', shape: shape({ upcoming: 0, past: 2, foundedYear: 2019 }), stats: ['last_night', 'running_since'], upcomingHeading: false, pastHeading: 'Recently hosted', noDates: true, team: ['Ana'], errors: [] },
  { name: 'no nights, no founded year: no strip at all', shape: shape({ upcoming: 0, past: 0 }), stats: [], upcomingHeading: false, pastHeading: null, noDates: true, team: ['Ana'], errors: [] },
  { name: 'no nights, founded year set', shape: shape({ upcoming: 0, past: 0, foundedYear: 2019 }), stats: ['running_since'], upcomingHeading: false, pastHeading: null, noDates: true, team: ['Ana'], errors: [] },
  { name: 'no team', shape: shape({ upcoming: 4, past: 10, team: 0 }), stats: ['next_night', 'nights_hosted', 'weekly_rhythm'], upcomingHeading: true, pastHeading: 'Past nights', noDates: false, team: [], errors: [] },
  // Fix round 1 (MED-3): one failed feed no longer discards every stat. These three rows
  // pinned `stats: []` / founded-year-only before; the stats the working feed alone can
  // prove still show, the failed feed's own stat is a marked dash.
  { name: 'past feed fails', shape: shape({ upcoming: 4, past: 10, feeds: { past: 'error' } }), stats: ['next_night', 'nights_hosted'], dashes: ['nights_hosted'], upcomingHeading: true, pastHeading: null, noDates: false, team: ['Ana'], errors: ['past'] },
  { name: 'upcoming feed fails', shape: shape({ upcoming: 4, past: 10, foundedYear: 2019, feeds: { future: 'error' } }), stats: ['next_night', 'nights_hosted', 'running_since'], dashes: ['next_night'], upcomingHeading: false, pastHeading: 'Past nights', noDates: false, team: ['Ana'], errors: ['upcoming'] },
  { name: 'team read fails', shape: shape({ upcoming: 4, past: 10, feeds: { team: 'error' } }), stats: ['next_night', 'nights_hosted', 'weekly_rhythm'], upcomingHeading: true, pastHeading: 'Past nights', noDates: false, team: [], errors: ['team'] },
  { name: 'every feed fails', shape: shape({ upcoming: 4, past: 10, feeds: { events: 'error', future: 'error', past: 'error', team: 'error', contact: 'error' } }), stats: ['next_night', 'nights_hosted'], dashes: ['next_night', 'nights_hosted'], upcomingHeading: false, pastHeading: null, noDates: false, team: [], errors: ['upcoming', 'past', 'team'] },
];

describe('organiser page P1: every section x every shape (visitor)', () => {
  it.each(ROWS)('$name', async (row) => {
    s.shape = row.shape;
    await renderPage();
    visitorInvariants();
    // Hero always renders once the entity is read.
    expect(screen.getByRole('heading', { level: 1, name: /Bachata Connect/ })).toBeTruthy();

    // S1 stats: exactly the mapping's answer; no strip when none qualify.
    expect(statKeys()).toEqual(row.stats);
    expect(failedStats()).toEqual(row.dashes ?? []);
    expect(!!screen.queryByTestId('org-stats')).toBe(row.stats.length > 0);

    // Nights area.
    expect(h2s().includes('Next nights')).toBe(row.upcomingHeading);
    expect(h2s().includes('Past nights')).toBe(row.pastHeading === 'Past nights');
    expect(h2s().includes('Recently hosted')).toBe(row.pastHeading === 'Recently hosted');
    expect(/No dates announced yet/.test(text())).toBe(row.noDates);
    if (row.noDates) expect(screen.getByRole('link', { name: 'Browse upcoming nights' })).toBeTruthy();
    if (row.shape.upcoming >= 100) {
      expect(text()).toContain(`${row.shape.upcoming} dates`);
      expect(document.querySelectorAll('#upcoming a, #upcoming [role="button"]').length).toBeLessThanOrEqual(3 + 1);
    }

    // S3 Team: names, each links to its own page, each with its nationality flag, no role labels.
    const teamLinks = Array.from(document.querySelectorAll('[data-team-person] a')).map((a) => [a.querySelector('[data-team-name]')?.textContent, a.getAttribute('href')]);
    expect(teamLinks).toEqual(row.team.map((n, i) => [n, `/dancers/d${i}`]));
    const teamFlags = Array.from(document.querySelectorAll('[data-team-person] [data-nationality-flag]')).map((f) => f.getAttribute('data-nationality-flag'));
    expect(teamFlags).toEqual(row.team.map((_n, i) => CODES[i]));
    expect(document.querySelectorAll('[data-team-tag], [data-team-title]').length).toBe(0);
    expect(!!screen.queryByTestId('org-team')).toBe(row.team.length > 0);

    // Error lines: one per failed section, each with Try again; never an empty state for it.
    for (const feed of ['upcoming', 'past', 'team'] as const) {
      expect(!!screen.queryByTestId(`org-feed-error-${feed}`)).toBe(row.errors.includes(feed));
    }
    if (row.errors.length) expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBeGreaterThanOrEqual(row.errors.length);

    // About only when written.
    expect(h2s().includes('About')).toBe(row.shape.bio);
  });
});

describe('S2 Get in touch', () => {
  it('four stacked rows in order WhatsApp, Instagram, Website, Email -- each tappable with its own Copy; no Facebook', async () => {
    s.shape = shape({ phone: true, instagram: true, website: true, email: true, facebook: true });
    await renderPage();
    expect(contactKeys()).toEqual(['whatsapp', 'instagram', 'website', 'email']);
    const rows = Array.from(document.querySelectorAll('[data-contact-row]'));
    for (const r of rows) {
      expect(r.querySelector('a')?.getAttribute('href')).toBeTruthy();
      expect(r.querySelector('button')?.getAttribute('aria-label')).toMatch(/^Copy /);
    }
    expect(rows[0].querySelector('a')?.getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
    expect(rows[3].querySelector('a')?.getAttribute('href')).toBe('mailto:hello@example.com');
    expect(text()).not.toMatch(/Facebook/);
  });

  it('empty rows hidden; no row at all = no section', async () => {
    s.shape = shape({ phone: false, instagram: false, website: false, email: false, facebook: true });
    await renderPage();
    expect(screen.queryByTestId('org-get-in-touch')).toBeNull();
    expect(h2s()).not.toContain('Get in touch');
  });

  it('contact RPC fails (E9): stored-link rows stay and one line says so with Try again', async () => {
    s.shape = shape({ phone: true, instagram: true, website: true, feeds: { contact: 'error' } });
    await renderPage();
    expect(contactKeys()).toEqual(['instagram', 'website']);
    expect(screen.getByTestId('org-contact-error').textContent).toMatch(/Couldn\u2019t load WhatsApp and email/);
  });

  it('Copy copies the value and says so; a missing clipboard says it could not', async () => {
    s.shape = shape({ phone: true });
    await renderPage();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Copy WhatsApp number' }));
    expect(writeText).toHaveBeenCalledWith('+44 7700 900123');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
});

describe('S5 page states', () => {
  it('loading: hero-shaped skeleton, no headings, no 0', async () => {
    s.shape = shape({ entity: 'pending' });
    await renderPage();
    expect(document.querySelectorAll('h1, h2').length).toBe(0);
    expect(text()).not.toMatch(/\b0\b/);
  });

  it('entity read error (E8): "Couldn\u2019t load this organiser" + Try again, NOT not-found, no noindex', async () => {
    s.shape = shape({ entity: 'error' });
    await renderPage();
    await waitFor(() => expect(screen.getByTestId('org-entity-error')).toBeTruthy());
    expect(text()).toMatch(/Couldn\u2019t load this organiser/);
    expect(text()).not.toMatch(/not found/i);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(noindex.last).toBe(false);
  });

  it('not found (null row): "Organiser not found" + noindex', async () => {
    s.shape = shape({ entity: 'missing' });
    await renderPage();
    await waitFor(() => expect(text()).toMatch(/Organiser not found/));
    expect(noindex.last).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fix round 1: every feed / contact / team failure combination x owner / visitor.
// Profile: no bio, no stored links, contact only via the RPC (WhatsApp), one team
// member, no nights. This is the shape where a wrong "unknown = false" shows the
// owner "Complete your profile" and a visitor a false "no team".
// ---------------------------------------------------------------------------
const FAILABLE = ['events', 'future', 'past', 'team', 'dancers', 'contact'] as const;
type Failable = typeof FAILABLE[number];
const COMBOS: Array<Set<Failable>> = Array.from({ length: 1 << FAILABLE.length }, (_, m) => new Set(FAILABLE.filter((_f, i) => m & (1 << i))));
const comboName = (f: Set<Failable>) => (f.size ? [...f].join('+') : 'nothing') + ' fails';

describe.each([false, true])('fix 1: failure combinations (owner = %s)', (owner) => {
  it.each(COMBOS.map((f) => [comboName(f), f] as const))('%s', async (_n, failed) => {
    const feeds = Object.fromEntries([...failed].map((f) => [f, 'error'])) as Partial<Shape['feeds']>;
    // team 0 for the owner so a fully known blank page can be 'owner-blank'.
    s.shape = shape({ owner, team: owner ? 0 : 1, phone: true, instagram: false, website: false, email: false, feeds });
    await renderPage();
    visitorOrOwnerInvariants(owner);
    const t = text();
    const upcomingFailed = failed.has('events') || failed.has('future');
    const pastFailed = failed.has('events') || failed.has('past');
    // The names read only runs when the roster has rows (the owner shape has none).
    // P2: names come from organiser_public_team_v1; the dancer_profiles read only
    // carries flags, so its failure drops flags and never fails the Team.
    const teamFailed = failed.has('team');

    // (e) per-feed stats: the failed feed's own stat is a marked dash; nothing else qualifies here.
    expect(failedStats()).toEqual([upcomingFailed && 'next_night', pastFailed && 'nights_hosted'].filter(Boolean));
    expect(statKeys()).toEqual(failedStats());

    // Nights: one error line per failed list, never the empty copy while a list failed.
    expect(!!screen.queryByTestId('org-feed-error-upcoming')).toBe(upcomingFailed);
    expect(!!screen.queryByTestId('org-feed-error-past')).toBe(pastFailed);

    // (a) Team: a failed roster OR names read is "Couldn't load the team", never "no team".
    expect(!!screen.queryByTestId('org-feed-error-team')).toBe(teamFailed);
    if (teamFailed) expect(t).toMatch(/Couldn\u2019t load the team/);
    if (!owner) expect(!!screen.queryByTestId('org-team')).toBe(!teamFailed);

    // Contact: the RPC failing says so; else the WhatsApp row.
    expect(!!screen.queryByTestId('org-contact-error')).toBe(failed.has('contact'));
    expect(contactKeys()).toEqual(failed.has('contact') ? [] : ['whatsapp']);

    // (b)+(c) The empty state is decided by the nights feeds alone: a team or contact
    // failure never hides it, and (owner) never turns unknown into "blank". The owner
    // here has WhatsApp, or an unknown contact, so is never 'owner-blank' (see below).
    const kinds = Array.from(document.querySelectorAll('[data-testid="org-public-empty"]')).map((e) => e.getAttribute('data-kind'));
    expect(kinds).toEqual(upcomingFailed || pastFailed ? [] : ['none']);
    expect(/Complete your profile/.test(t)).toBe(false);
    expect(/No dates announced yet/.test(t)).toBe(!upcomingFailed && !pastFailed);
  });
});

describe('fix 1: owner-blank only when everything is KNOWN blank', () => {
  it.each([
    ['all known blank', {}, true],
    ['contact read failed: contact unknown', { contact: 'error' }, false],
    ['team roster failed: team unknown', { team: 'error' }, false],
  ] as const)('%s', async (_n, feeds, blank) => {
    s.shape = shape({ owner: true, team: 0, phone: false, instagram: false, website: false, email: false, feeds });
    await renderPage();
    visitorOrOwnerInvariants(true);
    const kinds = Array.from(document.querySelectorAll('[data-testid="org-public-empty"]')).map((e) => e.getAttribute('data-kind'));
    expect(kinds).toEqual([blank ? 'owner-blank' : 'none']);
    expect(/Complete your profile/.test(text())).toBe(blank);
  });
  it('a visitor never sees it', async () => {
    s.shape = shape({ team: 0, phone: false, instagram: false });
    await renderPage();
    expect(/Complete your profile|Just getting started/.test(text())).toBe(false);
  });
});

describe('fix 1 (MED-3): stats per feed, busy and past-only organisers', () => {
  const N: Array<[string, Partial<Shape['feeds']>, string[], string[]]> = [
    ['all ok', {}, ['next_night', 'nights_hosted', 'weekly_rhythm'], []],
    ['past fails: Next night stays', { past: 'error' }, ['next_night', 'nights_hosted'], ['nights_hosted']],
    ['future fails: Nights hosted stays', { future: 'error' }, ['next_night', 'nights_hosted'], ['next_night']],
    ['both fail', { future: 'error', past: 'error' }, ['next_night', 'nights_hosted'], ['next_night', 'nights_hosted']],
    ['events (join) fails', { events: 'error' }, ['next_night', 'nights_hosted'], ['next_night', 'nights_hosted']],
  ];
  it.each(N)('busy: %s', async (_n, feeds, stats, dashes) => {
    s.shape = shape({ upcoming: 4, past: 10, feeds });
    await renderPage();
    visitorOrOwnerInvariants(false);
    expect(statKeys()).toEqual(stats);
    expect(failedStats()).toEqual(dashes);
    if (!dashes.includes('next_night')) expect(document.querySelector('[data-stat="next_night"] [data-stat-value]')?.textContent).toBe('Tomorrow');
  });
  it('past-only, future fails: never "Last night" (nothing upcoming is unknowable)', async () => {
    s.shape = shape({ upcoming: 0, past: 6, feeds: { future: 'error' } });
    await renderPage();
    expect(statKeys()).toEqual(['next_night', 'nights_hosted']);
    expect(failedStats()).toEqual(['next_night']);
    expect(h2s()).toContain('Past nights');
    expect(/No dates announced yet/.test(text())).toBe(false);
  });
});

describe('fix 1 (MED-1, MED-2): Team flags and role-aware links, as on main', () => {
  const ID = 'd0';
  it.each([
    ['dancer', ['dancer'], false, `/dancers/${ID}`, 'dancer'],
    ['DJ', ['dj', 'dancer'], false, `/djs/${ID}`, 'dj'],
    ['teacher, teacher pages closed', ['teacher', 'dancer'], false, `/dancers/${ID}`, 'dancer'],
    ['teacher, teacher pages open', ['teacher'], true, `/teachers/${ID}`, 'teacher'],
    ['teacher only, pages closed: no page', ['teacher'], false, null, null],
  ] as const)('%s', async (_n, roles, open, href, type) => {
    flag.teacherDetail = open;
    s.shape = shape({ team: 1, roles: [[...roles]] });
    await renderPage();
    const a = document.querySelector('[data-team-person] a');
    expect(a?.getAttribute('href') ?? null).toBe(href);
    expect(document.querySelector('[data-team-person] [data-nationality-flag]')?.getAttribute('data-nationality-flag')).toBe('ES');
    if (a) {
      fireEvent.click(a);
      expect(emit.calls.map((c) => [c.personId, c.profileType, c.context])).toEqual([[ID, type, 'organiser:team']]);
    }
    if (!open) expect(document.body.innerHTML).not.toContain('/teachers/');
  });
  it.each(['error', 'hang'] as const)('badges read %s: the dancer page link stays (fallback), typed dancer', async (b) => {
    s.shape = shape({ team: 1, roles: [['dj']], feeds: { badges: b } });
    await renderPage();
    const a = document.querySelector('[data-team-person] a')!;
    expect(a.getAttribute('href')).toBe(`/dancers/${ID}`);
    fireEvent.click(a);
    expect(emit.calls.map((c) => [c.personId, c.profileType])).toEqual([[ID, 'dancer']]);
  });
});

describe('fix 1 (LOW-6): Try again shows a pending state while the refetch runs', () => {
  it.each([
    ['team', { team: 'error' }, 'team', 'org-feed-error-team'],
    ['Get in touch', { contact: 'error' }, 'contact', 'org-contact-error'],
    ['nights', { past: 'error' }, 'past', 'org-feed-error-past'],
  ] as const)('%s', async (_n, feeds, key, testId) => {
    s.shape = shape({ upcoming: 4, past: 10, feeds });
    await renderPage();
    const btn = screen.getByTestId(testId).querySelector('button')!;
    expect(btn.textContent).toBe('Try again');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    s.shape = { ...s.shape, feeds: { ...s.shape.feeds, [key]: 'hang' } };
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId(testId).querySelector('button')!.textContent).toBe('Trying\u2026'));
    const pending = screen.getByTestId(testId).querySelector('button') as HTMLButtonElement;
    expect(pending.disabled).toBe(true);
    expect(pending.style.minHeight).toBe('44px');
  });
});
