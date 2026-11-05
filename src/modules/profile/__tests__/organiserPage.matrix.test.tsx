// @vitest-environment jsdom
/**
 * Organiser public page P1 (docs/organiser-page/ACCEPTANCE.md S1, S2, S3-read,
 * S5, S4 copy): every section x every prod shape (ACCEPTANCE section 3,
 * re-surveyed 2026-11-05). Rendered as a visitor (P1/P2/P5 read the same).
 *
 * Invariants asserted on EVERY shape: no 0 / `--` stat, no "Not added", no
 * "Just getting started", no "elsewhere in London", no dead Verified badge, no
 * "Online" pills, no Facebook row, section order hero > stats > Get in touch >
 * Team > About > Next nights > Past nights.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Feed = 'ok' | 'error';
interface Shape {
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
  feeds: { events: Feed; future: Feed; past: Feed; team: Feed; contact: Feed };
}

const s = vi.hoisted(() => ({ shape: null as unknown as Shape }));

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
    if (s.shape.feeds.events === 'error') throw new Error('events boom');
    return s.shape.upcoming + s.shape.past > 0 ? [EVENT] : [];
  },
  fetchOrganiserFutureOccEvents: async () => {
    if (s.shape.feeds.future === 'error') throw new Error('future boom');
    return Array.from({ length: s.shape.upcoming }, (_, i) => occ(fridayFrom('2026-11-06', i, 1), false));
  },
  fetchOrganiserPastOccEvents: async () => {
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
        if (s.shape.feeds.team === 'error') return res({ data: null, error: { message: 'team boom' } });
        return res({ data: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, sort_order: i, member_profile_id: `d${i}`, is_active: true })), error: null });
      }
      if (table === 'dancer_profiles') return res({ data: Array.from({ length: n }, (_, i) => ({ id: `d${i}`, first_name: ['Ana', 'Ben', 'Cleo'][i] ?? `P${i}`, avatar_url: null })), error: null });
      return res({ data: [], error: null });
    };
    return chain;
  };
  return { supabase: { from: chainFor, rpc: async (fn: string) => {
    if (fn === 'organiser_ownership_v1') return { data: { is_managed: false, i_own_it: false, my_role: null }, error: null };
    if (fn === 'get_organiser_public_contact_v1') {
      if (s.shape.feeds.contact === 'error') return { data: null, error: { message: 'contact boom' } };
      return { data: { contact_phone: s.shape.phone ? '+44 7700 900123' : null, contact_email: s.shape.email ? 'hello@example.com' : null }, error: null };
    }
    return { data: null, error: null };
  } } };
});
vi.mock('@/hooks/useAuth', async () => ({
  useAuth: () => ({ user: null, session: null }),
  ProfileGateContext: (await import('react')).createContext(null),
}));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-11-05' }));
const noindex = vi.hoisted(() => ({ last: null as boolean | null }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: (on: boolean) => { noindex.last = on; } }));
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
afterEach(() => { cleanup(); noindex.last = null; });

const OK = { events: 'ok', future: 'ok', past: 'ok', team: 'ok', contact: 'ok' } as const;
const base: Shape = { entity: 'ok', upcoming: 0, past: 0, team: 1, bio: false, foundedYear: null, phone: true, email: false, instagram: true, website: false, facebook: false, feeds: { ...OK } };
const shape = (o: Partial<Shape>): Shape => ({ ...base, ...o, feeds: { ...OK, ...(o.feeds ?? {}) } });

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
const ORDER = ['Get in touch', 'Team', 'About', 'Next nights', 'Recently hosted', 'Past nights'];

function visitorInvariants() {
  const t = text();
  expect(t).not.toMatch(/Not added/);
  expect(t).not.toMatch(/Just getting started/);
  expect(t).not.toMatch(/elsewhere in London/);
  expect(t).not.toMatch(/Verified/);
  expect(h2s()).not.toContain('Online');
  expect(h2s()).not.toContain('Teachers & DJs');
  expect(contactKeys()).not.toContain('facebook' as never);
  for (const v of statValues()) { expect(v).not.toBe('0'); expect(v).not.toBe('--'); expect((v ?? '').trim()).not.toBe(''); }
  expect(statKeys().length).toBeLessThanOrEqual(3);
  // Section order.
  const seen = h2s().filter((h) => ORDER.includes(h)).map((h) => ORDER.indexOf(h));
  expect([...seen].sort((a, b) => a - b)).toEqual(seen);
}

interface Row { name: string; shape: Shape; stats: string[]; upcomingHeading: boolean; pastHeading: 'Past nights' | 'Recently hosted' | null; noDates: boolean; team: string[]; errors: string[] }
const ROWS: Row[] = [
  { name: 'large ticketed, 120 weekly upcoming + 30 past', shape: shape({ upcoming: 120, past: 30, team: 3, bio: true, website: true, email: true }), stats: ['next_night', 'nights_hosted', 'weekly_rhythm'], upcomingHeading: true, pastHeading: 'Past nights', noDates: false, team: ['Ana', 'Ben', 'Cleo'], errors: [] },
  { name: 'weekly class, 4 upcoming + 10 past', shape: shape({ upcoming: 4, past: 10, team: 2 }), stats: ['next_night', 'nights_hosted', 'weekly_rhythm'], upcomingHeading: true, pastHeading: 'Past nights', noDates: false, team: ['Ana', 'Ben'], errors: [] },
  { name: 'brand new, 1 upcoming, nothing else', shape: shape({ upcoming: 1, past: 0 }), stats: ['next_night'], upcomingHeading: true, pastHeading: null, noDates: false, team: ['Ana'], errors: [] },
  { name: 'past-only, 6 past', shape: shape({ upcoming: 0, past: 6 }), stats: ['last_night', 'nights_hosted', 'weekly_rhythm'], upcomingHeading: false, pastHeading: 'Recently hosted', noDates: true, team: ['Ana'], errors: [] },
  { name: 'past-only, 2 past (under the hosted threshold)', shape: shape({ upcoming: 0, past: 2, foundedYear: 2019 }), stats: ['last_night', 'running_since'], upcomingHeading: false, pastHeading: 'Recently hosted', noDates: true, team: ['Ana'], errors: [] },
  { name: 'no nights, no founded year: no strip at all', shape: shape({ upcoming: 0, past: 0 }), stats: [], upcomingHeading: false, pastHeading: null, noDates: true, team: ['Ana'], errors: [] },
  { name: 'no nights, founded year set', shape: shape({ upcoming: 0, past: 0, foundedYear: 2019 }), stats: ['running_since'], upcomingHeading: false, pastHeading: null, noDates: true, team: ['Ana'], errors: [] },
  { name: 'no team', shape: shape({ upcoming: 4, past: 10, team: 0 }), stats: ['next_night', 'nights_hosted', 'weekly_rhythm'], upcomingHeading: true, pastHeading: 'Past nights', noDates: false, team: [], errors: [] },
  { name: 'past feed fails', shape: shape({ upcoming: 4, past: 10, feeds: { past: 'error' } }), stats: [], upcomingHeading: true, pastHeading: null, noDates: false, team: ['Ana'], errors: ['past'] },
  { name: 'upcoming feed fails', shape: shape({ upcoming: 4, past: 10, foundedYear: 2019, feeds: { future: 'error' } }), stats: ['running_since'], upcomingHeading: false, pastHeading: 'Past nights', noDates: false, team: ['Ana'], errors: ['upcoming'] },
  { name: 'team read fails', shape: shape({ upcoming: 4, past: 10, feeds: { team: 'error' } }), stats: ['next_night', 'nights_hosted', 'weekly_rhythm'], upcomingHeading: true, pastHeading: 'Past nights', noDates: false, team: [], errors: ['team'] },
  { name: 'every feed fails', shape: shape({ upcoming: 4, past: 10, feeds: { events: 'error', future: 'error', past: 'error', team: 'error', contact: 'error' } }), stats: [], upcomingHeading: false, pastHeading: null, noDates: false, team: [], errors: ['upcoming', 'past', 'team'] },
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

    // S3 Team: names only, each links to its own page, no role labels.
    const teamLinks = Array.from(document.querySelectorAll('[data-team-person] a')).map((a) => [a.querySelector('[data-team-name]')?.textContent, a.getAttribute('href')]);
    expect(teamLinks).toEqual(row.team.map((n, i) => [n, `/dancers/d${i}`]));
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
    expect(screen.getByTestId('org-contact-error').textContent).toMatch(/Couldn’t load WhatsApp and email/);
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

  it('entity read error (E8): "Couldn’t load this organiser" + Try again, NOT not-found, no noindex', async () => {
    s.shape = shape({ entity: 'error' });
    await renderPage();
    await waitFor(() => expect(screen.getByTestId('org-entity-error')).toBeTruthy());
    expect(text()).toMatch(/Couldn’t load this organiser/);
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
