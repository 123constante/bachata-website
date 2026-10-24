// @vitest-environment jsdom
/**
 * People arc S4: the teacher world, table-driven over the prod teacher shapes (survey 2026-10-24,
 * read-only, counts only: 132 active teaching roles, 59 render through get_public_teacher_detail_v1
 * (all with a photo and a city -- the RPC requires both), 15 with a nationality code, 12 with
 * languages (11 stored as codes), 46 with a website, 1 Instagram only, 12 with no link, 0 with years
 * teaching, 28 with no class at all, 6 past-only, 18 with 1 upcoming, 7 with 2+ (max 3), longest name
 * 23, teacher-only / +dancer / +DJ) x flag ON and OFF. Names are invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installJsdomPolyfills } from '../../../../../../tests/client/jsdomPolyfills';
import { flags } from '@/lib/featureFlags';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';
import { PAGE_GROUNDS } from '@/components/layout/pageGrounds';
import { TEACHER_PAPER, WORLD } from '../../tokens';
import { WORLD_PAGE, WorldPage } from '../../../frame';
import { TEACHER_GRID } from '../../../frame/WorldPage';
import type { PersonRole } from '../../../personRoles';
import { CLASSES_LABEL, INVITE_LABEL, teacherWorldView, type TeacherClass, type TeacherWorldInput } from '../model';

const TODAY = londonTodayKey();
/** An RPC stamp: the London wall clock written +00 (the timeline's shape). */
const AT = (days: number, hm = '19:30') => `${addDaysToKey(TODAY, days)}T${hm}:00+00:00`;
const cls = (days: number, over: Partial<TeacherClass> = {}, hm?: string): TeacherClass => ({
  event_id: `ev-${days}-${hm ?? ''}`, event_name: 'Bachata Sensual Improvers', event_start_time: AT(days, hm), event_location: 'Studio 68', ...over,
});

const h = vi.hoisted(() => ({
  row: null as null | Record<string, unknown>,
  rpcError: null as null | { message: string },
  rpcNames: [] as string[],
  classes: [] as unknown[],
  classesFail: false,
  roles: [] as string[],
  user: null as null | { id: string; is_anonymous?: boolean },
  palettes: [] as unknown[],
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async (fn: string) => {
      h.rpcNames.push(fn);
      return h.rpcError ? { data: null, error: h.rpcError } : { data: h.row ? [h.row] : [], error: null };
    },
  },
}));
vi.mock('@/lib/seo', async (orig) => ({
  ...(await orig<typeof import('@/lib/seo')>()),
  useEntitySlugOrId: () => ({ id: 't1', slug: 'ana-ruiz', arrivedViaUuid: false, notFound: false }),
  useCanonicalReplaceState: () => undefined,
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/hooks/useProfileProgramAppearances', () => ({
  useProfileProgramAppearances: (_t: string, id: string | undefined) =>
    id
      ? { data: h.classesFail ? undefined : h.classes, isFetched: true, isError: h.classesFail, refetch: vi.fn() }
      : { data: undefined, isFetched: false, isError: false, refetch: vi.fn() },
}));
vi.mock('@/modules/person-page/usePersonRoles', () => ({
  usePersonSnapshot: (id: string | undefined) => ({ snapshot: id ? { roles: h.roles } : null, answered: !!id }),
  usePersonRoles: () => h.roles,
}));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb' }) }));
vi.mock('@/modules/person-page/AlsoRoles', () => ({ AlsoRoles: () => <div data-testid="also-roles" /> }));
vi.mock('@/components/layout/GlobalLayout', () => ({
  default: ({ children, gradientPalette, hero }: { children: ReactNode; gradientPalette?: unknown; hero?: { subtitle?: string } }) => {
    h.palettes.push(gradientPalette);
    return <div data-testid="layout" data-palette={String(gradientPalette)} data-subtitle={hero?.subtitle ?? ''}>{children}</div>;
  },
}));

import TeacherProfile from '@/pages/TeacherProfile';

/** A get_public_teacher_detail_v1 row. */
const ROW = (over: Record<string, unknown> = {}) => ({
  entity_id: 't1', first_name: 'Ana', surname: 'Ruiz', photo_url: 'https://cdn.example.test/a.jpg', gallery_urls: [], city_id: 'c1', city: 'Madrid',
  nationality: 'Bolivia', nationality_code: 'bo', years_teaching: null, teaching_styles: [], languages: ['es', 'en'], achievements: null, faq: null,
  journey: null, offers_private: false, availability: null, private_lesson_types: [], private_lesson_locations: [], private_travel_distance: null,
  website: 'www.anaruiz.dance/', instagram: '@ana_baila', facebook: null, email: null, phone: null, ...over,
});

const WORLDS_DEFAULT = flags.personWorlds;
const setWorlds = (on: boolean) => { (flags as { personWorlds: boolean }).personWorlds = on; };
const mount = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/teachers/ana-ruiz']}>
        <Routes>
          <Route path="/teachers/:id" element={<TeacherProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
const q = (id: string) => screen.queryByTestId(id);

beforeEach(() => {
  installJsdomPolyfills();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  Object.assign(h, { row: ROW(), rpcError: null, rpcNames: [], classes: [], classesFail: false, roles: ['teacher'], user: null, palettes: [] });
});
afterEach(() => {
  cleanup();
  setWorlds(WORLDS_DEFAULT);
  vi.restoreAllMocks();
});

const view = (row: TeacherWorldInput['row'], classes: TeacherClass[] = [], viewer: TeacherWorldInput['viewer'] = null) =>
  teacherWorldView({ row, classes, today: TODAY, classesHref: '/london-gb/classes', pathname: '/teachers/ana-ruiz', viewer });

describe('teacherWorldView: every prod shape', () => {
  const base = ROW() as TeacherWorldInput['row'];
  it.each([
    ['photo, city, flag, languages (the full card)', base, ['Teaches in Madrid', 'Speaks Spanish, English'], 'BO'],
    ['no city -> London (owner rule)', { ...base, city: null }, ['Teaches in London', 'Speaks Spanish, English'], 'BO'],
    ['a postcode in the city field is cut', { ...base, city: 'London SE1 7PB' }, ['Teaches in London', 'Speaks Spanish, English'], 'BO'],
    ['no nationality, no languages', { ...base, nationality_code: null, languages: [] }, ['Teaches in Madrid'], null],
    ['unknown language codes are dropped', { ...base, languages: ['zz', 'es', 'es'] }, ['Teaches in Madrid', 'Speaks Spanish'], 'BO'],
  ] as const)('%s', (_n, row, lines, flag) => {
    const v = view(row);
    expect(v.lines).toEqual(lines);
    expect(v.flag).toBe(flag);
    // Never the raw codes as text (the audit's "London · BO" and "es").
    for (const l of v.lines) expect(l).not.toMatch(/\b(BO|bo|es|en)\b/);
  });

  it('long name (23 chars) is the big name, whole', () => {
    expect(view({ ...base, first_name: 'Malva Marina', surname: 'Montenegro' }).big).toBe('Malva Marina Montenegro');
  });

  it.each([
    ['no class at all', [], 'No classes on the calendar yet.'],
    ['past classes only', [cls(-3), cls(-40)], 'No classes coming up yet.'],
  ] as const)('%s: a muted line, then one "Classes this week" button to the classes calendar', (_n, classes, note) => {
    const v = view(base, [...classes]);
    expect(v.upcoming).toEqual([]);
    expect(v.emptyAction).toEqual({ note, label: CLASSES_LABEL, href: '/london-gb/classes' });
  });

  it('1 upcoming: "Next class", the time leads, the date under it (full weekday)', () => {
    const v = view(base, [cls(-2), cls(3)]);
    expect(v.heading).toBe('Next class');
    expect(v.emptyAction).toBeNull();
    expect(v.upcoming).toHaveLength(1);
    expect(v.upcoming[0].time).toBe('19:30');
    expect(v.upcoming[0].date).toMatch(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) \d{1,2} [A-Z][a-z]+$/);
    expect(v.upcoming[0].venue).toBe('Studio 68');
  });

  it('2+ upcoming (prod max 3): "Next classes", soonest first; today counts as upcoming', () => {
    const v = view(base, [cls(9), cls(0, {}, '20:00'), cls(2)]);
    expect(v.heading).toBe('Next classes');
    expect(v.upcoming.map((c) => c.eventId)).toEqual(['ev-0-20:00', 'ev-2-', 'ev-9-']);
  });

  it('a 23:30 class stays on its own (wall-clock) day; midnight on the dot has no time', () => {
    const late = view(base, [cls(1, {}, '23:30')]).upcoming[0];
    const sameDay = view(base, [cls(1)]).upcoming[0];
    expect(late.time).toBe('23:30');
    expect(late.date).toBe(sameDay.date);
    expect(view(base, [cls(1, {}, '00:00')]).upcoming[0].time).toBeNull();
  });

  it('a congress class abroad (no venue, no name) still lists, with fallbacks', () => {
    const v = view(base, [cls(30, { event_name: '  ', event_location: null })]);
    expect(v.upcoming[0]).toMatchObject({ name: 'Class', venue: null });
  });

  it.each([
    ['website first (shown ONCE)', base, { label: 'Learn with Ana', value: 'anaruiz.dance', href: 'https://www.anaruiz.dance/' }],
    ['Instagram only', { ...base, website: null }, { label: 'Learn with Ana', value: 'instagram.com/ana_baila', href: 'https://instagram.com/ana_baila' }],
    ['Facebook only', { ...base, website: ' ', instagram: null, facebook: 'facebook.com/ana' }, { label: 'Learn with Ana', value: 'facebook.com/ana', href: 'https://facebook.com/ana' }],
    ['no link (12 on prod): no row', { ...base, website: null, instagram: null }, null],
  ] as const)('contact: %s', (_n, row, contact) => {
    expect(view(row).contact).toEqual(contact);
  });

  it('D8\'\': the invite for a signed-out (or anonymous) visitor only', () => {
    expect(view(base).invite).toEqual({ label: INVITE_LABEL, href: expect.stringMatching(/teachers(%2F|\/)ana-ruiz/) });
    expect(view(base, [], { is_anonymous: true }).invite).not.toBeNull();
    expect(view(base, [], { is_anonymous: false }).invite).toBeNull();
  });
});

describe('/teachers/:id, flag ON: the teacher world on the shared frame', () => {
  beforeEach(() => setWorlds(true));

  it.each([
    ['teacher-only, no class', ['teacher'], [], 0],
    ['teacher + dancer, 1 upcoming', ['dancer', 'teacher'], [cls(2)], 1],
    ['teacher + dancer + DJ, 3 upcoming, past too', ['dancer', 'dj', 'teacher'], [cls(1), cls(4), cls(6), cls(-5)], 3],
  ] as const)('%s', async (_n, roles, classes, rows) => {
    Object.assign(h, { roles: [...roles], classes: [...classes] });
    mount();
    await settle();
    expect(q('world-page')?.getAttribute('data-world')).toBe('teacher');
    expect(q('layout')?.getAttribute('data-palette')).toBe('teacher');
    expect(q('also-roles')).toBeNull();
    expect(screen.getByTestId('teacher-name').textContent).toBe('Ana Ruiz');
    expect(q('teacher-flag')).not.toBeNull();
    expect(screen.getAllByTestId('teacher-line').map((e) => e.textContent)).toEqual(['Teaches in Madrid', 'Speaks Spanish, English']);
    expect(screen.queryAllByTestId('teacher-class')).toHaveLength(rows);
    if (rows) {
      expect(within(screen.getByTestId('teacher-classes')).getByRole('heading').textContent).toBe(rows >= 2 ? 'Next classes' : 'Next class');
      const first = screen.getAllByTestId('teacher-class')[0];
      expect(first.firstElementChild?.getAttribute('data-testid')).toBe('teacher-class-time');
    } else {
      expect(screen.getByTestId('teacher-empty-action').getAttribute('href')).toMatch(/classes$/);
    }
    // ONE contact row (the old page showed the website twice).
    expect(screen.getAllByTestId('teacher-contact')).toHaveLength(1);
    expect(screen.getByTestId('teacher-contact').textContent).toContain('Learn with Ana');
    // Tabs only with 2+ roles.
    expect(!!q('role-tabs')).toBe(roles.length >= 2);
    // The card text never prints the raw codes.
    expect(screen.getByTestId('teacher-card').textContent).not.toMatch(/\bBO\b|\bes\b/);
  });

  it('every tap target is at least 44px, in explicit px', async () => {
    h.classes = [];
    mount();
    await settle();
    for (const id of ['teacher-empty-action', 'teacher-contact', 'teacher-invite', 'frame-back', 'frame-share']) {
      expect(parseFloat((screen.getByTestId(id) as HTMLElement).style.minHeight), id).toBeGreaterThanOrEqual(44);
    }
  });

  it('the class read failed: says so and offers a retry (actionable)', async () => {
    h.classesFail = true;
    mount();
    await settle();
    expect(screen.getByTestId('teacher-classes-failed').textContent).toContain('Try again');
    fireEvent.click(within(screen.getByTestId('teacher-classes-failed')).getByRole('button'));
  });

  it('404 regression: no row from the RPC (teacher-only person without a photo or city, 62 on prod) -> an actionable not-found in the shell', async () => {
    h.row = null;
    mount();
    await settle();
    expect(q('teacher-world-missing')).not.toBeNull();
    expect(within(screen.getByTestId('teacher-world-missing')).getByRole('link').getAttribute('href')).toBe('/teachers');
    expect(q('world-page')?.getAttribute('data-world')).toBe('teacher');
  });

  it('the untouched page sends nothing: reads only', async () => {
    mount();
    await settle();
    expect(h.rpcNames.length).toBeGreaterThan(0);
    for (const fn of h.rpcNames) expect(fn).toMatch(/^get_/);
  });

  it('no copy points at a control that is not on screen', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('teacher-world').textContent).not.toMatch(/\b(tap|press|click|below|above|button)\b/i);
  });

  it('signed in: no invite', async () => {
    h.user = { id: 'u1', is_anonymous: false };
    mount();
    await settle();
    expect(q('teacher-invite')).toBeNull();
  });
});

describe('/teachers/:id, flag OFF: exactly today\'s page', () => {
  beforeEach(() => setWorlds(false));

  it('the old page: AlsoRoles, the old hero subtitle, no world, no frame', async () => {
    mount();
    await settle();
    expect(q('also-roles')).not.toBeNull();
    expect(q('world-page')).toBeNull();
    expect(q('person-frame')).toBeNull();
    expect(q('teacher-world')).toBeNull();
    expect(q('layout')?.getAttribute('data-subtitle')).toBe('Madrid · Bolivia');
    expect(h.palettes).not.toContain('teacher');
  });
});

describe('the one world shell: DJ, dancer and teacher', () => {
  it('the same page box on every world; the teacher ground is the violet grid', () => {
    const shapes: string[] = [];
    for (const world of ['dj', 'dancer', 'teacher'] as PersonRole[]) {
      const { unmount } = render(
        <MemoryRouter>
          <WorldPage world={world} breadcrumbs={[]} backHref="/x"><p>frame</p></WorldPage>
        </MemoryRouter>,
      );
      const page = screen.getByTestId('world-page');
      expect(screen.getByTestId('layout').getAttribute('data-palette')).toBe(world);
      shapes.push(`${page.className}|${screen.getByTestId('world-page-slot').className}`);
      expect(page.style.backgroundImage.includes('repeating-linear-gradient')).toBe(world === 'teacher');
      unmount();
    }
    expect(new Set(shapes).size).toBe(1);
    expect(shapes[0]).toBe(`${WORLD_PAGE.page}|${WORLD_PAGE.slot}`);
    expect(PAGE_GROUNDS.teacher.base).toBe(WORLD.teacher.ground);
    expect(TEACHER_GRID.backgroundImage).toContain(TEACHER_PAPER.grid);
  });
});
