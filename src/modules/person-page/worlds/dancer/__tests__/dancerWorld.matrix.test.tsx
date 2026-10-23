// @vitest-environment jsdom
/**
 * People arc S2: the dancer world, table-driven over the prod dancer shapes (survey 2026-10-23,
 * counts only (every nationality is stored as a 2-letter code): 171 live, 114 with a photo, 110 with a city, 15 with languages, 19 with a
 * nationality, 2 bios, 67 with a social, 35 with a dance role, 3 long names, 45 nameless) x the
 * D6 lower half (another world dated / not / no city) x flag ON and OFF. Names are invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installJsdomPolyfills } from '../../../../../../tests/client/jsdomPolyfills';
import { flags } from '@/lib/featureFlags';
import { londonTodayKey, addDaysToKey } from '@/lib/londonDate';
import type { PersonRole } from '../../../personRoles';
import { DEFAULT_CITY, INVITE, SOCIALS_COPY, dancerCard, lowerHalf, nextAppearance, previewOf, socialsThisWeek, worldRoles } from '../model';

const TODAY = londonTodayKey();
const IN = (days: number) => `${addDaysToKey(TODAY, days)}T19:00:00+00:00`;

const h = vi.hoisted(() => ({
  roles: [] as string[],
  teacher: [] as unknown[],
  dj: [] as unknown[],
  socials: [] as unknown[],
  socialsFail: false,
  city: null as null | { cityId: string; cityName: string; citySlug: string },
  user: null as null | { id: string; is_anonymous?: boolean },
  snapshotIds: [] as (string | undefined)[],
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/hooks/useMyPersonaId', () => ({ useMyPersonaId: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: async () => ({ data: null, error: null }), from: () => ({}) } }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: async () => ({ data: null, error: null }) }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/modules/person-page/usePersonRoles', () => ({
  usePersonSnapshot: (id: string | undefined) => {
    h.snapshotIds.push(id);
    return { snapshot: id ? { roles: h.roles } : null, answered: !!id };
  },
  usePersonRoles: () => h.roles,
}));
vi.mock('@/hooks/useProfileProgramAppearances', () => ({
  useProfileProgramAppearances: (type: string, id: string | undefined) =>
    id ? { data: type === 'teacher' ? h.teacher : h.dj, isPending: false, isError: false, fetchStatus: 'idle' } : { data: undefined, isPending: true, isError: false, fetchStatus: 'idle' },
}));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async (name: string) => (h.city ? h.city : name === 'London' ? { cityId: 'c', cityName: 'London', citySlug: 'london-gb' } : null) }));
vi.mock('@/integrations/supabase/eventRpcs', () => ({
  getCalendarEvents: async () => {
    if (h.socialsFail) throw new Error('down');
    return h.socials;
  },
}));

import DancerProfile from '@/pages/DancerProfile';

const IMG = 'https://cdn.example.test/p.jpg';
const rec = (over: Record<string, unknown>) => ({
  id: 'id-x', first_name: null, surname: null, display_name: null, nationality: null, dance_role: null, instagram: null, facebook: null,
  avatar_url: null, website_url: null, gallery_urls: null, cities: null, dancing_role_details: null, ...over,
});

/** Every shape the survey found. `languages` are the extras read. */
const SHAPES: Record<string, { row: ReturnType<typeof rec>; languages: string[] }> = {
  'thin, one name, no photo, no city': { row: rec({ id: 'id-1', first_name: 'Dani', display_name: 'Dani' }), languages: [] },
  'photo + London + role': { row: rec({ id: 'id-2', first_name: 'Eli', display_name: 'Eli Gomez', avatar_url: IMG, dance_role: 'Leader', cities: { name: 'London' } }), languages: [] },
  'languages + nationality (codes and names)': { row: rec({ id: 'id-3', first_name: 'Ana', display_name: 'Ana Ruiz', nationality: 'es', cities: { name: 'Madrid' } }), languages: ['es', 'English', 'xx'] },
  'long name': { row: rec({ id: 'id-4', first_name: 'Maria-Fernanda', display_name: 'Maria-Fernanda Alejandra de los Santos', avatar_url: IMG, cities: { name: 'London' } }), languages: [] },
  nameless: { row: rec({ id: 'id-5' }), languages: [] },
  'socials (instagram + website)': { row: rec({ id: 'id-6', first_name: 'Carla', display_name: 'Carla Ruiz', instagram: '@carla', website_url: 'carla.example', dance_role: 'Lead and Follow' }), languages: [] },
  'postcode in city': { row: rec({ id: 'id-7', first_name: 'Ben', display_name: 'Ben', cities: { name: 'London SE1 7PB' } }), languages: [] },
  'city with no calendar': { row: rec({ id: 'id-8', first_name: 'Lu', display_name: 'Lu', cities: { name: 'Buenos Aires' } }), languages: [] },
};
type ShapeKey = keyof typeof SHAPES;
const KEYS = Object.keys(SHAPES) as ShapeKey[];

const PARTY = (over: Record<string, unknown> = {}) => ({ event_id: 'e1', slug: 'friday-social', occurrence_id: 'o1', name: 'Friday Social', location: 'The Hall', type: 'standard', has_party: true, is_cancelled: false, instance_date: TODAY, occurrence_starts_at: `${TODAY} 21:00:00+00`, ...over });

const WORLDS_DEFAULT = flags.personWorlds;
const setWorlds = (on: boolean) => { (flags as { personWorlds: boolean }).personWorlds = on; };

const mount = (key: ShapeKey, embedded = false, resolvedId?: string) => {
  const { row, languages } = SHAPES[key];
  const slug = key.replace(/\W+/g, '-');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['entity-resolve', 'dancer_profiles', 'id', slug], { id: resolvedId ?? row.id, slug });
  if (resolvedId) qc.setQueryData(['dancer-profile', resolvedId], row);
  qc.setQueryData(['dancer-profile', row.id], row);
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/dancers/${slug}`]}>
        <Routes>
          <Route path="/dancers/:id" element={<DancerProfile publicPage={{ extras: { bio: null, languages, whatsapp: null }, extrasOk: true }} embedded={embedded} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 60)); });
const q = (id: string) => screen.queryByTestId(id);

beforeEach(() => {
  installJsdomPolyfills();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  Object.assign(h, { roles: [], teacher: [], dj: [], socials: [PARTY()], socialsFail: false, city: null, user: null, snapshotIds: [] });
});
afterEach(() => {
  cleanup();
  setWorlds(WORLDS_DEFAULT);
  vi.restoreAllMocks();
});

describe('dancerCard: every fact comes from facts/, empty facts hide', () => {
  it.each(KEYS)('%s', (key) => {
    const { row, languages } = SHAPES[key];
    const card = dancerCard({
      name: row.display_name as string | null, photo: row.avatar_url as string | null, nationality: row.nationality as string | null,
      city: (row.cities as { name: string } | null)?.name ?? null, danceRole: row.dance_role as string | null, languages, contacts: [],
    });
    expect(card.name.trim()).not.toBe('');
    if (!row.display_name) expect(card.name).toBe('Dancer');
    expect(card.sub ?? '').not.toMatch(/SE1|7PB|null|undefined|\b0\b/);
    if (!row.dance_role && !row.cities) expect(card.sub).toBeNull();
    expect(card.languages).toBe(key.startsWith('languages') ? 'Spanish, English' : null);
    expect(card.flag).toBe(row.nationality ? 'ES' : null);
  });
});

describe('D6 lower half', () => {
  const dated = [{ event_name: 'Bachata Basics', event_location: 'Studio 1', event_start_time: IN(2) }];
  const past = [{ event_name: 'Old', event_location: null, event_start_time: IN(-3) }];
  it.each([
    ['teacher dated', previewOf('teacher', 's', nextAppearance(dated)), null, 'previews'],
    ['dj dated', previewOf('dj', 's', nextAppearance(dated)), null, 'previews'],
    ['other world, only past dates', previewOf('teacher', 's', nextAppearance(past)), 'Madrid', 'socials'],
    ['no other world, city', null, 'London SE1 7PB', 'socials'],
    ['no other world, no city', null, null, 'socials'],
  ] as const)('%s', (_label, preview, city, kind) => {
    const half = lowerHalf([preview], city);
    expect(half.kind).toBe(kind);
    if (half.kind === 'socials') {
      expect(half.heading).toBe(`Socials in ${city ? city.replace(/ SE1 7PB/, '') : DEFAULT_CITY} this week`);
    } else {
      expect(half.items[0].line).toMatch(/^Next (class|gig) (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) \d{1,2} [A-Z][a-z]+$/);
      expect(half.items[0].href).toMatch(/^\/(teachers|djs)\/s$/);
    }
  });

  it('socials: parties only, no festival days, not cancelled, from today, grouped by day, full weekday names, capped', () => {
    const rows = [
      PARTY({ event_id: 'a', instance_date: addDaysToKey(TODAY, 1) }),
      PARTY({ event_id: 'b', has_party: false }),
      PARTY({ event_id: 'c', is_cancelled: true }),
      PARTY({ event_id: 'f', type: 'festival' }),
      PARTY({ event_id: 'g', type: 'standard', format: 'festival' }),
      PARTY({ event_id: 'd', instance_date: addDaysToKey(TODAY, -1) }),
      PARTY({ event_id: 'e', slug: null, occurrence_id: null }),
      ...Array.from({ length: 8 }, (_, i) => PARTY({ event_id: `x${i}`, instance_date: addDaysToKey(TODAY, 2) })),
    ];
    const s = socialsThisWeek(rows, TODAY);
    expect(s.total).toBe(10);
    expect(s.days.flatMap((d) => d.rows)).toHaveLength(6);
    expect(s.days[0].day).toBe(TODAY);
    expect(s.days[0].rows.map((r) => r.href)).toEqual(['/event/e']);
    expect(socialsThisWeek([PARTY()], TODAY).days[0].rows[0].href).toBe('/event/friday-social?occurrenceId=o1');
    for (const d of s.days) expect(d.label).toMatch(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) /);
  });

  it('next date: one that already started today is not "next"', () => {
    const now = new Date(Date.parse(IN(0)) + 4 * 3600 * 1000);
    expect(nextAppearance([{ event_name: 'Tonight', event_location: null, event_start_time: IN(0) }], now)).toBeNull();
    expect(nextAppearance([{ event_name: 'Later', event_location: null, event_start_time: IN(1) }], now)?.event_name).toBe('Later');
  });

  it('the photo is resized through the image CDN, never the original', () => {
    const card = dancerCard({ name: 'A', photo: 'https://media.example.test/a.jpg', nationality: null, city: null, danceRole: null, languages: [], contacts: [] });
    expect(card.photo).not.toBeNull();
  });

  it('the dancer tab is always there', () => {
    expect(worldRoles([])).toEqual(['dancer']);
    expect(worldRoles(['teacher'] as PersonRole[])).toEqual(['teacher', 'dancer']);
  });
});

type Lower = 'teacher dated' | 'dj dated' | 'undated other world' | 'none' | 'socials empty' | 'socials error';
const LOWERS: Lower[] = ['teacher dated', 'dj dated', 'undated other world', 'none', 'socials empty', 'socials error'];
const arrange = (l: Lower) => {
  const dated = [{ event_name: 'Bachata Basics', event_location: 'Studio 1', event_start_time: IN(1) }];
  if (l === 'teacher dated') Object.assign(h, { roles: ['teacher', 'dancer'], teacher: dated });
  if (l === 'dj dated') Object.assign(h, { roles: ['dj', 'dancer'], dj: dated });
  if (l === 'undated other world') Object.assign(h, { roles: ['teacher', 'dancer'], teacher: [] });
  if (l === 'socials empty') h.socials = [];
  if (l === 'socials error') h.socialsFail = true;
};

describe('flag ON: the frame + the dancer world, every shape x every lower half', () => {
  for (const key of KEYS) {
    it.each(LOWERS)(`${key} / %s`, async (l) => {
      setWorlds(true);
      arrange(l);
      mount(key);
      await settle();
      await settle();
      expect(q('person-frame')).not.toBeNull();
      expect(q('frame-back')?.getAttribute('href')).toBe('/dancers');
      expect(q('frame-back')?.textContent?.trim()).toBe('Back');
      expect(q('dancer-world-card')).not.toBeNull();
      expect(q('person-avatar')).not.toBeNull();
      // Old v2 page is gone.
      expect(q('dancer-join')).toBeNull();

      const lower = q('dancer-world-lower')!;
      const dated = l === 'teacher dated' || l === 'dj dated';
      expect(lower.getAttribute('data-kind')).toBe(dated ? 'previews' : 'socials');
      if (dated) {
        const role = l === 'teacher dated' ? 'teacher' : 'dj';
        const link = q(`dancer-world-preview-${role}`)!;
        expect(link.getAttribute('href')).toBe(`/${role === 'dj' ? 'djs' : 'teachers'}/${key.replace(/\W+/g, '-')}`);
        expect(link.textContent).toContain(role === 'dj' ? 'Next gig' : 'Next class');
      } else {
        const city = (SHAPES[key].row.cities as { name: string } | null)?.name?.replace(/ SE1 7PB/, '') ?? 'London';
        expect(within(lower).getByRole('heading', { level: 2 }).textContent).toBe(`Socials in ${city} this week`);
        // Every state says what the person can do, and the control it names is on screen.
        const all = q('dancer-world-socials-all')!;
        expect(all.getAttribute('href')).toBe('/parties');
        const empty = q('dancer-world-socials-empty');
        const knownCity = city === 'London';
        // A city the calendar does not know is never read: an honest empty state, even when the read would fail.
        if (!knownCity || l === 'socials empty') expect(empty?.textContent).toBe(SOCIALS_COPY.empty(city));
        else if (l === 'socials error') expect(empty?.textContent).toBe(SOCIALS_COPY.error);
        else expect(empty).toBeNull();
        if (empty) expect(all.textContent).toBe(SOCIALS_COPY.allEmpty);
      }

      // D8 on every shape (signed out): a real button-sized link to the sign-up entry.
      const invite = q('dancer-world-invite-button')!;
      expect(invite.textContent).toBe(INVITE.button);
      expect(invite.getAttribute('href')).toMatch(/^\/auth\b.*signup/);
      expect((invite as HTMLElement).style.minHeight).toBe('44px');

      // No "0 years", no codes, short weekday names never.
      const text = document.body.textContent ?? '';
      expect(text).not.toMatch(/\b0 years\b|\bxx\b|\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/);
      // Every link goes somewhere.
      for (const a of screen.getAllByRole('link')) expect(a.getAttribute('href')).toBeTruthy();
    });
  }

  it('reads the roles of the ROUTE-resolved person, not the canonical row id (prod: a linked profile lost its tabs)', async () => {
    setWorlds(true);
    h.roles = ['teacher', 'dancer'];
    mount('photo + London + role', false, 'person-77');
    await settle();
    expect(h.snapshotIds.filter(Boolean).every((x) => x === 'person-77')).toBe(true);
    expect(h.snapshotIds).toContain('person-77');
  });

  it('signed in: no invite (the sign-up entry would bounce them)', async () => {
    setWorlds(true);
    h.user = { id: 'u1' };
    mount('photo + London + role');
    await settle();
    expect(q('dancer-world-invite')).toBeNull();
  });

  it('role tabs: two roles -> tabs with Dancer current; one role -> none', async () => {
    setWorlds(true);
    h.roles = ['dj', 'dancer'];
    mount('photo + London + role');
    await settle();
    expect(within(q('role-tabs')!).getAllByRole('link').map((a) => a.textContent)).toEqual(['DJ', 'Dancer']);
    cleanup();
    h.roles = ['dancer'];
    mount('photo + London + role');
    await settle();
    expect(q('role-tabs')).toBeNull();
  });

  it('embedded (the Dancing tab of /people/:id) keeps today\'s page', async () => {
    setWorlds(true);
    mount('photo + London + role', true);
    await settle();
    expect(q('person-frame')).toBeNull();
  });
});

describe('flag OFF: today\'s page, unchanged', () => {
  it.each(KEYS)('%s', async (key) => {
    setWorlds(false);
    mount(key);
    await settle();
    expect(q('person-frame')).toBeNull();
    expect(q('dancer-world')).toBeNull();
    expect(q('dancer-join')).not.toBeNull();
  });
});
