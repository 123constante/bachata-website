// @vitest-environment jsdom
/**
 * People arc S2: the dancer world, table-driven over the prod dancer shapes (survey 2026-10-23,
 * counts only (every nationality is stored as a 2-letter code): 171 live, 114 with a photo, 110 with a city, 15 with languages, 19 with a
 * nationality, 2 bios, 67 with a social, 35 with a dance role, 3 long names, 45 nameless) x the
 * D6 lower half (another world dated / not / no city) x flag ON and OFF. Names are invented.
 * S6 (owner, phone test 2026-10-24): the "Socials in <city> this week" filler is gone. The lower half
 * is previews of the dancer's OWN dated worlds or nothing, then the invite. Survey 2026-10-24 (174 live):
 * dancer only 36; teacher 98 (35 dated, 16 past only, 47 none); DJ 14 (5 / 2 / 7); both 26 (14 with a
 * dated world).
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
import { INVITE, dancerCard, lowerHalf, nextAppearance, previewOf, worldRoles } from '../model';
import { WORLD_PAGE } from '../../../frame';

const TODAY = londonTodayKey();
const IN = (days: number) => `${addDaysToKey(TODAY, days)}T19:00:00+00:00`;

const h = vi.hoisted(() => ({
  roles: [] as string[],
  teacher: [] as unknown[],
  dj: [] as unknown[],
  rolesPending: false,
  /** The teacher / DJ timeline reads: answered, still in flight, or failed. */
  dates: 'ok' as 'ok' | 'pending' | 'paused' | 'fail',
  calendarCalls: 0,
  user: null as null | { id: string; is_anonymous?: boolean },
  authStatus: 'ready' as string,
  snapshotIds: [] as (string | undefined)[],
  /** supabase.from(); the default has no query methods, so the dancer read fails (= not found). */
  from: (() => ({})) as () => unknown,
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: h.authStatus === 'resolving', authStatus: h.authStatus }),
}));
vi.mock('@/hooks/useMyPersonaId', () => ({ useMyPersonaId: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: async () => ({ data: null, error: null }), from: () => h.from() } }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: async () => ({ data: null, error: null }) }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/modules/person-page/usePersonRoles', () => ({
  usePersonSnapshot: (id: string | undefined) => {
    h.snapshotIds.push(id);
    return h.rolesPending ? { snapshot: null, answered: false } : { snapshot: id ? { roles: h.roles } : null, answered: !!id };
  },
  usePersonRoles: () => h.roles,
}));
vi.mock('@/hooks/useProfileProgramAppearances', () => ({
  useProfileProgramAppearances: (type: string, id: string | undefined) =>
    !id
      ? { data: undefined, isPending: true, isError: false, fetchStatus: 'idle' }
      : h.dates === 'pending' || h.dates === 'paused'
        ? { data: undefined, isPending: true, isError: false, fetchStatus: h.dates === 'paused' ? 'paused' : 'fetching' }
        : h.dates === 'fail'
          ? { data: undefined, isPending: false, isError: true, fetchStatus: 'idle' }
          : { data: type === 'teacher' ? h.teacher : h.dj, isPending: false, isError: false, fetchStatus: 'idle' },
}));
// S6: a dancer page never reads the calendar. Counted, and it answers a party in case it is called.
vi.mock('@/integrations/supabase/eventRpcs', () => ({
  getCalendarEvents: async () => {
    h.calendarCalls += 1;
    return [{ event_id: 'e1', slug: 'friday-social', occurrence_id: 'o1', name: 'Friday Social', location: 'The Hall', type: 'standard', has_party: true, is_cancelled: false, instance_date: londonTodayKey(), occurrence_starts_at: '21:00' }];
  },
}));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c', cityName: 'London', citySlug: 'london-gb' }) }));

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
  'contacts (instagram + website)': { row: rec({ id: 'id-6', first_name: 'Carla', display_name: 'Carla Ruiz', instagram: '@carla', website_url: 'carla.example', dance_role: 'Lead and Follow' }), languages: [] },
  'postcode in city': { row: rec({ id: 'id-7', first_name: 'Ben', display_name: 'Ben', cities: { name: 'London SE1 7PB' } }), languages: [] },
  'city with no calendar': { row: rec({ id: 'id-8', first_name: 'Lu', display_name: 'Lu', cities: { name: 'Buenos Aires' } }), languages: [] },
};
type ShapeKey = keyof typeof SHAPES;
const KEYS = Object.keys(SHAPES) as ShapeKey[];

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
  Object.assign(h, { roles: [], teacher: [], dj: [], rolesPending: false, dates: 'ok', calendarCalls: 0, user: null, authStatus: 'ready', snapshotIds: [] });
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
      city: (row.cities as { name: string } | null)?.name ?? null, danceRole: row.dance_role as string | null, languages, yearsDancing: null, contacts: [],
    });
    expect(card.name.trim()).not.toBe('');
    if (!row.display_name) expect(card.name).toBe('Dancer');
    expect(card.sub ?? '').not.toMatch(/SE1|7PB|null|undefined|\b0\b/);
    if (!row.dance_role && !row.cities) expect(card.sub).toBeNull();
    expect(card.languages).toBe(key.startsWith('languages') ? 'Spanish, English' : null);
    expect(card.flag).toBe(row.nationality ? 'ES' : null);
  });
});

describe('D6 lower half (S6: previews or nothing)', () => {
  const dated = [{ event_name: 'Bachata Basics', event_location: 'Studio 1', event_start_time: IN(2) }];
  const past = [{ event_name: 'Old', event_location: null, event_start_time: IN(-3) }];
  it.each([
    ['teacher dated', [previewOf('teacher', 's', nextAppearance(dated))], true],
    ['dj dated', [previewOf('dj', 's', nextAppearance(dated))], true],
    ['both dated', [previewOf('teacher', 's', nextAppearance(dated)), previewOf('dj', 's', nextAppearance(dated))], true],
    ['other world, only past dates', [previewOf('teacher', 's', nextAppearance(past))], false],
    ['other world, no dates', [previewOf('dj', 's', nextAppearance([]))], false],
    ['no other world', [], false],
  ] as const)('%s', (_label, previews, shown) => {
    const half = lowerHalf(previews);
    if (!shown) {
      // No "Coming up" heading without an item under it, and no filler in its place.
      expect(half).toBeNull();
      return;
    }
    expect(half?.heading).toBe('Coming up');
    expect(half?.items.length).toBe(previews.length);
    for (const item of half?.items ?? []) {
      expect(item.line).toMatch(/^Next (class|gig) (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) \d{1,2} [A-Z][a-z]+$/);
      expect(item.href).toMatch(/^\/(teachers|djs)\/s$/);
    }
  });

  it('next date: one that already started today is not "next"', () => {
    const now = new Date(Date.parse(IN(0)) + 4 * 3600 * 1000);
    expect(nextAppearance([{ event_name: 'Tonight', event_location: null, event_start_time: IN(0) }], now)).toBeNull();
    expect(nextAppearance([{ event_name: 'Later', event_location: null, event_start_time: IN(1) }], now)?.event_name).toBe('Later');
  });

  // S2b: get_profile_event_timeline_v2 stamps are London WALL CLOCK stored as +00 ("23:30+00" is
  // 23:30 in London), so the day is the one written and "not started yet" is London's clock.
  describe('next gig: the stored wall-clock day, never a converted one', () => {
    const gig = (at: string) => [{ event_name: 'Gig', event_location: 'Club', event_start_time: at }];
    it.each([
      // [shape, rows, now, expected line (null = no preview)]
      ['a 23:30 summer gig stays on its own day', gig('2027-07-10 23:30:00+00'), '2027-07-10T12:00:00Z', 'Next gig Saturday 10 July'],
      ['a winter gig', gig('2027-01-15 21:00:00+00'), '2027-01-10T12:00:00Z', 'Next gig Friday 15 January'],
      ['a summer gig that started an hour ago (22:30 London = 21:30 UTC) is past', gig('2027-07-10 22:30:00+00'), '2027-07-10T21:45:00Z', null],
      ['a past gig', gig('2027-07-01 21:00:00+00'), '2027-07-10T12:00:00Z', null],
      ['none', [], '2027-07-10T12:00:00Z', null],
    ] as const)('%s', (_s, rows, now, line) => {
      expect(previewOf('dj', 's', nextAppearance(rows, new Date(now)))?.line ?? null).toBe(line);
    });
  });

  it('the photo is resized through the image CDN, never the original', () => {
    const card = dancerCard({ name: 'A', photo: 'https://media.example.test/a.jpg', nationality: null, city: null, danceRole: null, languages: [], yearsDancing: null, contacts: [] });
    expect(card.photo).not.toBeNull();
  });

  it('the dancer tab is always there', () => {
    expect(worldRoles([])).toEqual(['dancer']);
    expect(worldRoles(['teacher'] as PersonRole[])).toEqual(['teacher', 'dancer']);
  });
});

/** S6 lower halves: the other worlds the dancer holds x whether one is dated x the date read failing. */
type Lower = 'dancer only' | 'teacher dated' | 'dj dated' | 'both dated' | 'teacher past only' | 'dj undated' | 'both undated' | 'dates read failed';
const LOWERS: Lower[] = ['dancer only', 'teacher dated', 'dj dated', 'both dated', 'teacher past only', 'dj undated', 'both undated', 'dates read failed'];
const DATED: Lower[] = ['teacher dated', 'dj dated', 'both dated'];
const arrange = (l: Lower) => {
  const dated = [{ event_name: 'Bachata Basics', event_location: 'Studio 1', event_start_time: IN(1) }];
  const past = [{ event_name: 'Old', event_location: null, event_start_time: IN(-3) }];
  if (l === 'teacher dated') Object.assign(h, { roles: ['teacher', 'dancer'], teacher: dated });
  if (l === 'dj dated') Object.assign(h, { roles: ['dj', 'dancer'], dj: dated });
  if (l === 'both dated') Object.assign(h, { roles: ['teacher', 'dj', 'dancer'], teacher: dated, dj: dated });
  if (l === 'teacher past only') Object.assign(h, { roles: ['teacher', 'dancer'], teacher: past });
  if (l === 'dj undated') Object.assign(h, { roles: ['dj', 'dancer'], dj: [] });
  if (l === 'both undated') Object.assign(h, { roles: ['teacher', 'dj', 'dancer'] });
  if (l === 'dates read failed') Object.assign(h, { roles: ['teacher', 'dj', 'dancer'], dates: 'fail' });
};

/** The filler the owner removed (phone test 2026-10-24): none of it on any dancer shape. */
const NO_FILLER = /Socials in|this week|All socials|Find a party|See all parties/i;

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

      const lower = q('dancer-world-lower');
      if (DATED.includes(l)) {
        expect(lower?.getAttribute('data-kind')).toBe('previews');
        expect(within(lower!).getByRole('heading', { level: 2 }).textContent).toBe('Coming up');
        const roles = l === 'both dated' ? ['teacher', 'dj'] : [l === 'teacher dated' ? 'teacher' : 'dj'];
        for (const role of roles) {
          const link = q(`dancer-world-preview-${role}`)!;
          expect(link.getAttribute('href')).toBe(`/${role === 'dj' ? 'djs' : 'teachers'}/${key.replace(/\W+/g, '-')}`);
          expect(link.textContent).toContain(role === 'dj' ? 'Next gig' : 'Next class');
        }
      } else {
        // No dated world (or the read failed): no lower half at all, never a stuck box.
        expect(lower).toBeNull();
        expect(screen.queryByText('Coming up')).toBeNull();
      }
      expect(q('dancer-world-socials')).toBeNull();
      expect(q('dancer-world-preview-reserve')).toBeNull();

      // D8 on every shape (signed out): a real button-sized link to the sign-up entry, and the
      // last thing the dancer world shows (nothing under it before the footer).
      const invite = q('dancer-world-invite-button')!;
      expect(invite.textContent).toBe(INVITE.button);
      expect(invite.getAttribute('href')).toMatch(/^\/auth\b.*signup/);
      expect((invite as HTMLElement).style.minHeight).toBe('44px');
      expect(q('dancer-world')!.lastElementChild).toBe(q('dancer-world-invite'));

      // S6: the socials filler is gone, and the page never reads the calendar.
      const text = document.body.textContent ?? '';
      expect(text).not.toMatch(NO_FILLER);
      expect(h.calendarCalls).toBe(0);
      // No "0 years", no codes, short weekday names never.
      expect(text).not.toMatch(/\b0 years\b|\bxx\b|\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/);
      // Every link goes somewhere.
      for (const a of screen.getAllByRole('link')) expect(a.getAttribute('href')).toBeTruthy();
    });
  }

  it.each(LOWERS)('signed in / %s: no invite, still no filler, no calendar read', async (l) => {
    setWorlds(true);
    h.user = { id: 'u1' };
    arrange(l);
    mount('photo + London + role');
    await settle();
    await settle();
    expect(q('dancer-world-invite')).toBeNull();
    expect(!!q('dancer-world-lower')).toBe(DATED.includes(l));
    expect(document.body.textContent ?? '').not.toMatch(NO_FILLER);
    expect(h.calendarCalls).toBe(0);
  });

  it('reads the roles of the ROUTE-resolved person, not the canonical row id (prod: a linked profile lost its tabs)', async () => {
    setWorlds(true);
    h.roles = ['teacher', 'dancer'];
    mount('photo + London + role', false, 'person-77');
    await settle();
    expect(h.snapshotIds.filter(Boolean).every((x) => x === 'person-77')).toBe(true);
    expect(h.snapshotIds).toContain('person-77');
  });

  // Owner D8'' (2026-10-23): hidden from a signed-in visitor, shown to every signed-out one, on every
  // world (facts.showsJoinInvite, the DJ world's rule too). Shown from the first paint: it never
  // waits for auth, so a signed-out visitor never sees it arrive late.
  it.each([
    ['signed out', null, 'ready', true],
    ['auth still resolving, no user yet', null, 'resolving', true],
    ['anonymous guest session', { id: 'g', is_anonymous: true }, 'ready', true],
    ['signed in', { id: 'u1' }, 'ready', false],
    ['signed in, auth not yet ready', { id: 'u1' }, 'resolving', false],
  ] as const)("D8'' invite: %s -> %s", async (_who, user, status, shown) => {
    setWorlds(true);
    h.user = user ? { ...user } : null;
    h.authStatus = status;
    mount('photo + London + role');
    await settle();
    expect(!!q('dancer-world-invite')).toBe(shown);
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

/**
 * S2b: the dancer world sits in the SAME shell as the DJ world (frame/WorldPage), every flag-ON
 * state. The owner measured Back L10 T113 (DJ) vs L14 T116 (dancer) when each world padded the
 * frame itself. Same assertion as DJProfileWorlds.test.tsx's expectInShell.
 */
const expectInShell = (inner: HTMLElement) => {
  const page = screen.getByTestId('world-page');
  const slot = screen.getByTestId('world-page-slot');
  expect(page.getAttribute('data-world')).toBe('dancer');
  expect(page.className).toBe(WORLD_PAGE.page);
  expect(slot.className).toBe(WORLD_PAGE.slot);
  expect(inner.parentElement).toBe(slot);
  expect(slot.parentElement).toBe(page);
  for (let el: HTMLElement | null = inner; el; el = el.parentElement) {
    expect(el.className).not.toMatch(/min-h-screen|min-h-\[/);
    expect(el.style.minHeight).toBe('');
  }
};

/**
 * Owner 2026-10-25: the dancer world shows "N years dancing" and nothing else about experience
 * (no Level, no Veteran / Experienced). Survey 2026-10-25 (173 live): no years 154; this year (0) 2;
 * exactly 1 year 3; 2-7 years 3; 8+ years 11; future 0. Junk / empty strings can only reach the model.
 */
const NO_LEVEL = /\bLevel\b|Veteran|Experienced|Beginner|Intermediate|Advanced/i;
const YEARS: { raw: string | null | undefined; line: string | null }[] = [
  { raw: undefined, line: null },
  { raw: null, line: null },
  { raw: '', line: null },
  { raw: '0', line: null },
  { raw: '-2', line: null },
  { raw: 'abc', line: null },
  { raw: '1', line: '1 year dancing' },
  { raw: '4', line: '4 years dancing' },
  { raw: '11', line: '11 years dancing' },
];
const SUBS = [{ danceRole: 'Leader', city: 'London' }, { danceRole: null, city: null }];
const LANGS = [[], ['es', 'English']];

describe('dancerCard: years dancing (owner 2026-10-25)', () => {
  for (const s of SUBS) for (const langs of LANGS) {
    it.each(YEARS)(`sub ${s.danceRole ? 'on' : 'off'} / languages ${langs.length ? 'on' : 'off'} / years %o`, ({ raw, line }) => {
      const card = dancerCard({ name: 'Eli', photo: null, nationality: null, ...s, languages: langs, contacts: [], yearsDancing: raw });
      expect(card.years).toBe(line);
      expect(card.sub).toBe(s.danceRole ? 'Leader ' + String.fromCharCode(0xb7) + ' London' : null);
    });
  }
});

/** The DOM rows: years come from dancing_role_details.dance_started_year (the joined row, as prod stores it). */
const NOW_YEAR = new Date().getFullYear();
const DOM_YEARS: { label: string; started: number | null; line: string | null }[] = [
  { label: 'no years', started: null, line: null },
  { label: 'this year (0)', started: NOW_YEAR, line: null },
  { label: 'future year', started: NOW_YEAR + 1, line: null },
  { label: '1 year', started: NOW_YEAR - 1, line: '1 year dancing' },
  { label: '4 years', started: NOW_YEAR - 4, line: '4 years dancing' },
  { label: '11 years', started: NOW_YEAR - 11, line: '11 years dancing' },
];

describe('flag ON: the years line on the card, every years shape x sub x languages', () => {
  const base: Record<'sub' | 'nosub', Record<string, unknown>> = {
    sub: { dance_role: 'Leader', cities: { name: 'London' } },
    nosub: {},
  };
  for (const sub of ['sub', 'nosub'] as const) for (const langs of LANGS) {
    it.each(DOM_YEARS)(`${sub} / languages ${langs.length ? 'on' : 'off'} / %o`, async ({ started, line }) => {
      setWorlds(true);
      const key = 'thin, one name, no photo, no city';
      const saved = SHAPES[key];
      SHAPES[key] = { row: rec({ id: 'id-y', first_name: 'Yo', display_name: 'Yo', dancing_role_details: started === null ? null : [{ dance_started_year: started }], ...base[sub] }), languages: langs };
      try {
        mount(key);
        await settle();
        await settle();
      } finally {
        SHAPES[key] = saved;
      }
      const card = q('dancer-world-card')!;
      const years = q('dancer-world-years');
      if (line) {
        expect(years?.textContent).toBe(line);
        expect(card.contains(years)).toBe(true);
        expect((years as HTMLElement).style.fontSize).toBe('15px');
        // Directly under the sub line (or the name when there is no sub line).
        const above = sub === 'sub' ? q('dancer-world-sub') : q('dancer-world-name');
        expect(years?.previousElementSibling).toBe(above);
      } else {
        // Absent: nothing rendered, so no empty gap.
        expect(years).toBeNull();
      }
      const text = card.textContent ?? '';
      expect(text).not.toMatch(/\b0 years?\b|-\d+ years?|NaN|undefined|null/);
      expect(text).not.toMatch(NO_LEVEL);
      if (line === '1 year dancing') expect(text).not.toMatch(/1 years/);
    });
  }
});

describe('flag ON: one shell for every state (the DJ world\'s)', () => {
  it.each(KEYS)('full page: %s', async (key) => {
    setWorlds(true);
    mount(key);
    await settle();
    expectInShell(screen.getByTestId('person-frame'));
  });

  it('loading', async () => {
    setWorlds(true);
    const hang = { select: () => hang, eq: () => hang, not: () => hang, maybeSingle: () => new Promise(() => undefined) };
    h.from = () => hang;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['entity-resolve', 'dancer_profiles', 'id', 'slow'], { id: 'id-slow', slug: 'slow' });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/dancers/slow']}>
          <Routes><Route path="/dancers/:id" element={<DancerProfile publicPage={null} />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expectInShell(await screen.findByTestId('dancer-world-loading'));
    h.from = () => ({});
  });

  it('not found', async () => {
    setWorlds(true);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['entity-resolve', 'dancer_profiles', 'id', 'gone'], { id: 'id-gone', slug: 'gone' });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/dancers/gone']}>
          <Routes><Route path="/dancers/:id" element={<DancerProfile publicPage={null} />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const box = await screen.findByTestId('dancer-world-missing');
    expectInShell(box);
    const back = within(box).getByRole('link', { name: /Back to Dancers/ });
    expect(back.getAttribute('href')).toBe('/dancers');
    expect((back as HTMLElement).style.minHeight).toBe('44px');
  });

// S2 critique: the page moved 0.09-0.29 (layout shift) as a week of socials arrived. S6 (owner): with
// the socials gone, a dancer-only person reserves NOTHING (the invite is already in place); a person
// who holds teacher and/or DJ roles reserves ONE preview row (64 px) while their dates load, which
// becomes the real rows or nothing when the read settles.
describe('flag ON: waiting states (S6 owner decision)', () => {
  const reserve = () => q('dancer-world-preview-reserve');

  it('roles still being read: nothing reserved, no skeleton week, the invite already in place', async () => {
    setWorlds(true);
    h.rolesPending = true;
    mount('photo + London + role');
    await settle();
    expect(q('dancer-world-lower')).toBeNull();
    expect(screen.queryAllByTestId('dancer-world-skeleton-row')).toHaveLength(0);
    expect(q('dancer-world-invite')).not.toBeNull();
    expect(h.calendarCalls).toBe(0);
  });

  it('dancer only: nothing reserved, ever', async () => {
    setWorlds(true);
    h.roles = ['dancer'];
    h.dates = 'pending';
    mount('photo + London + role');
    await settle();
    expect(q('dancer-world-lower')).toBeNull();
    expect(reserve()).toBeNull();
  });

  it.each([
    ['teacher', ['teacher', 'dancer']],
    ['DJ', ['dj', 'dancer']],
    ['teacher + DJ', ['teacher', 'dj', 'dancer']],
  ] as const)('%s, dates still being read: ONE 64px preview-row reserve, no heading', async (_who, roles) => {
    setWorlds(true);
    h.roles = [...roles];
    h.dates = 'pending';
    mount('photo + London + role');
    await settle();
    const lower = q('dancer-world-lower')!;
    expect(lower.getAttribute('data-kind')).toBe('loading');
    expect(lower.getAttribute('aria-busy')).toBe('true');
    expect(within(lower).getAllByTestId('dancer-world-preview-reserve')).toHaveLength(1);
    expect((reserve() as HTMLElement).style.height).toBe('64px');
    expect(within(lower).queryByRole('heading')).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(NO_FILLER);
  });

  it('teacher + DJ, date reads paused offline: no reserve left pulsing, just the invite', async () => {
    setWorlds(true);
    h.roles = ['teacher', 'dj', 'dancer'];
    h.dates = 'paused';
    mount('photo + London + role');
    await settle();
    expect(q('dancer-world-lower')).toBeNull();
    expect(q('dancer-world-invite')).not.toBeNull();
  });

  it.each([
    ['signed out', null, true],
    ['signed in', { id: 'u1' }, false],
  ] as const)('the dancer read in flight (%s): bar, card, no lower-half room, and the invite room only when it will show', async (_who, user, invite) => {
    setWorlds(true);
    h.user = user ? { ...user } : null;
    const hang = { select: () => hang, eq: () => hang, not: () => hang, maybeSingle: () => new Promise(() => undefined) };
    h.from = () => hang;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['entity-resolve', 'dancer_profiles', 'id', 'slow'], { id: 'id-slow', slug: 'slow' });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/dancers/slow']}>
          <Routes><Route path="/dancers/:id" element={<DancerProfile publicPage={null} />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const box = await screen.findByTestId('dancer-world-loading');
    expect(within(box).queryAllByTestId('dancer-world-skeleton-row')).toHaveLength(0);
    expect(within(box).getByTestId('dancer-world-skeleton-card')).toBeTruthy();
    expect(!!within(box).queryByTestId('dancer-world-skeleton-invite')).toBe(invite);
    h.from = () => ({});
  });
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
