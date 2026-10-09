// @vitest-environment jsdom
/**
 * Public organiser page x every events shape prod holds (read-only survey,
 * 2026-10-08, 45 organisers): 9 with no events at all (8 with no bio, most WITH
 * contact links -- /organisers/bachata-connect, /organisers/crouch-end), 8 with
 * only past dates (one live series with no future date, or one ended series),
 * 11 with one live series, 17 with two or more. No series is cancelled or
 * paused today; a cancelled future date is a real occurrence shape, covered.
 *
 * Each case asserts the empty-state rule: a page with nothing upcoming says so
 * AND says what the visitor can do (a link they can follow), whatever else the
 * profile has (bio, contact links, team); copy only points at the contact links
 * when they are on screen; a page with upcoming dates shows no empty state.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const feeds = vi.hoisted(() => ({
  entity: null as Record<string, unknown> | null,
  events: [] as unknown[],
  future: [] as unknown[],
  past: [] as unknown[],
  user: null as { id: string } | null,
}));

vi.mock('@/lib/seo', async (orig) => ({
  ...(await orig<typeof import('@/lib/seo')>()),
  useEntitySlugOrId: () => ({ id: 'org-1', slug: 'org', arrivedViaUuid: false }),
  useCanonicalReplaceState: () => {},
}));
vi.mock('@/modules/profile/organiserPublicProfile', async (orig) => ({
  ...(await orig<typeof import('@/modules/profile/organiserPublicProfile')>()),
  fetchOrganiserEntity: async () => feeds.entity,
  fetchOrganiserEvents: async () => feeds.events,
  fetchOrganiserFutureOccEvents: async () => feeds.future,
  fetchOrganiserPastOccEvents: async () => feeds.past,
}));
vi.mock('@/integrations/supabase/client', () => {
  // Team query: every chained call resolves to no rows.
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'not', 'maybeSingle']) chain[m] = () => chain;
  chain.then = (res: (v: unknown) => void) => res({ data: [], error: null });
  return { supabase: { from: () => chain, rpc: async () => ({ data: null, error: null }) } };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: feeds.user, session: null }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import OrganiserProfile from '../OrganiserProfile';

if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const ENTITY = { id: 'org-1', name: 'Bachata Connect', avatar_url: null, bio: null, claimed_by: null, socials: null, city_id: null, instagram: null, website: null, cities: null };
const EVENT = { id: 'ev-1', name: 'Friday Social', date: null, start_time: null, is_active: true, poster_url: null, location: 'Soho', city: 'London' };
const occ = (date: string, o: { past?: boolean; cancelled?: boolean } = {}) => ({
  event_id: 'ev-1', name: 'Friday Social', occurrence_id: `occ-${date}`, instance_date: date, start_time: `${date}T21:00:00`,
  photo_url: null, cover_image_url: null, location: 'Soho', is_cancelled: o.cancelled ?? false, is_past: o.past ?? false,
});

type Case = {
  name: string;
  entity?: Partial<typeof ENTITY>;
  events?: unknown[]; future?: unknown[]; past?: unknown[];
  owner?: boolean;
  /** Which empty state shows: none, no events at all, or nothing upcoming but past nights. */
  expect: null | 'none' | 'past-only' | 'owner-blank';
};

const CASES: Case[] = [
  { name: 'no events, no bio, contact links (bachata-connect / crouch-end)', entity: { instagram: 'bachataconnect' }, expect: 'none' },
  { name: 'no events, bio, no contact', entity: { bio: 'Socials in north London.' }, expect: 'none' },
  { name: 'no events, nothing at all (visitor)', expect: 'none' },
  { name: 'no events, nothing at all, null-ish empty strings', entity: { bio: '', instagram: '', website: '' }, expect: 'none' },
  { name: 'no events, owner, blank profile', owner: true, expect: 'owner-blank' },
  { name: 'no events, owner, profile has a bio', owner: true, entity: { bio: 'Hi.' }, expect: 'none' },
  { name: 'one live series with a future date', events: [EVENT], future: [occ('2026-10-16')], expect: null },
  { name: 'one live series, future date cancelled, past dates', events: [EVENT], future: [occ('2026-10-16', { cancelled: true })], past: [occ('2026-09-01', { past: true })], expect: 'past-only' },
  { name: 'only past dates (ended series)', events: [EVENT], past: [occ('2026-09-01', { past: true }), occ('2026-08-01', { past: true })], expect: 'past-only' },
  { name: 'only past dates, contact links', entity: { website: 'https://example.com' }, events: [EVENT], past: [occ('2026-09-01', { past: true })], expect: 'past-only' },
  { name: 'legacy event with no date (fallback lists it as upcoming)', events: [EVENT], expect: null },
  { name: 'two series, future dates', events: [EVENT, { ...EVENT, id: 'ev-2', name: 'Sunday Class' }], future: [occ('2026-10-16'), { ...occ('2026-10-18'), event_id: 'ev-2' }], expect: null },
];

afterEach(() => { cleanup(); feeds.user = null; });

async function renderPage(c: Case) {
  feeds.entity = { ...ENTITY, ...c.entity, claimed_by: c.owner ? 'u1' : null };
  feeds.events = c.events ?? [];
  feeds.future = c.future ?? [];
  feeds.past = c.past ?? [];
  feeds.user = c.owner ? { id: 'u1' } : null;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/organisers/org']}>
        <Routes><Route path="/organisers/:id" element={<OrganiserProfile />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: /Bachata Connect/ });
  // Let the four feed queries settle (the empty state waits for all of them).
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe('public organiser page: empty states over every events shape', () => {
  it.each(CASES)('$name', async (c) => {
    await renderPage(c);
    const empty = screen.queryByTestId('org-public-empty');
    if (c.expect === null) {
      expect(empty).toBeNull();
      return;
    }
    expect(empty, 'an empty state is shown').not.toBeNull();
    expect(empty!.getAttribute('data-kind')).toBe(c.expect);
    // Says what the person can do: a real control inside the empty state.
    const action = empty!.querySelector('a[href], button');
    expect(action, 'the empty state offers an action').not.toBeNull();
    // Copy that points at the contact links only when they are on screen.
    const text = empty!.textContent ?? '';
    const hasContact = !!(c.entity?.instagram || c.entity?.website);
    if (/links above/i.test(text)) expect(hasContact).toBe(true);
  });
});
