// @vitest-environment jsdom
/**
 * S8 consistency matrix, part 2 (R1-PLAN 4.5): the write screens, rendered. A control that
 * cannot work is off WITH a visible reason; an untouched Save sends nothing; version_conflict
 * on every write ends on the R3-7 view: VERSION_CONFLICT and ONE button, to the event.
 * Rows that are red against the tree are findings, not typos (handover S8.md, "Red first").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc, auth: {}, storage: { from: vi.fn() },
    from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) }),
  },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, signOut: vi.fn() }) }));
// The Move row (C5c) as it runs once admin A1 is applied (P-DATES pins the hidden side).
vi.mock('@/modules/organiser/shared/a1Gate', () => ({ A1_APPLIED: true }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: null }) }));
vi.mock('@/modules/organiser/events/media', async (orig) => ({ ...(await orig<object>()), uploadEventPicture: upload }));
vi.mock('@/modules/profile/organiserPublicProfile', async (orig) => ({
  ...(await orig<object>()),
  fetchOwnOrganiserEntity: async () => ({
    id: 'org1', name: 'Bachata Nights', avatar_url: null, bio: null, socials: null, city_id: null, instagram: null, website: null,
    organisation_category: null, founded_year: null, cities: null,
  }),
}));

import ChangeFlow from '@/modules/organiser/flows/change';
import AddFlow from '@/modules/organiser/flows/add';
import CancelFlow from '@/modules/organiser/flows/cancel';
import NewFlow from '@/modules/organiser/flows/new/NewFlow';
import CoverFlow from '@/modules/organiser/flows/fix';
import Done from '@/modules/organiser/flows/Done';
import OneEvent from '@/modules/organiser/events/OneEvent';
import Details from '@/modules/organiser/events/Details';
import TeamPage from '@/modules/organiser/team';
import TeamFlow from '@/modules/organiser/team/TeamFlow';
import MorePage, { HAND_OVER_FIRST } from '@/modules/organiser/more';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { VERSION_CONFLICT } from '@/modules/organiser/shared/copy';
import { CAP_NOTE } from '@/modules/organiser/events/dateCap';
import { RESTORE_CAP_NOTE } from '@/modules/organiser/flows/cancel/cancelModel';
import { COURSE_STOP_REASON, detailEditPath, eventStepPath } from '@/modules/organiser/flows/event/eventSteps';
import { TEAM_CAP, TEAM_FULL_REASON } from '@/modules/organiser/shared/teamModel';
import {
  A, BEFORE, DRAFT, GONE, answer, comingRun, commandsOf, day, defaultWorld, flush, mount, series, type World,
} from '@/modules/organiser/flows/add/__tests__/fixtures';
import { row as member } from '@/modules/organiser/team/__tests__/fixtures';

/** The one clock of this file: Tuesday 20 October 2026, five days before the clocks go back. */
const FROZEN = new Date('2026-10-20T12:00:00Z');
const WEEKLY_FRIDAY = { mode: 'weekly', weekdays: [5], interval: 1, end: { kind: 'none' } };
const VENUES = [
  { id: 'v1', name: 'Salsa Bar', neighbourhood: null, city_name: null, address: null, postcode: null },
  { id: 'v2', name: 'Dance Hub', neighbourhood: null, city_name: null, address: null, postcode: null },
];
const WRITES = new Set([
  'series_command_p5', 'occurrence_command_p5', 'remove_organiser_member_v1', 'organiser_team_set_member_v1',
  'organiser_team_add_member_by_profile_v1', 'organiser_transfer_ownership_v1', 'organiser_profile_update_p5_v1',
]);
const writes = () => rpc.mock.calls.filter(([fn]) => WRITES.has(fn as string));
const CONFLICT = { data: null, error: { message: 'version_conflict: expected 9, found 10', code: 'P0001' } };

let world: World;
let team: { ok: boolean; members: ReturnType<typeof member>[] };
let removal: () => { data: unknown; error: unknown };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);
  rpc.mockReset();
  upload.mockReset().mockResolvedValue('https://cdn.example/c.jpg');
  world = defaultWorld();
  team = { ok: true, members: [member('u1', 'owner', { is_self: true }), member('u2', 'manager')] };
  removal = () => ({ data: { user_id: 'u1', member_role: 'owner', self_removed: true, removed_rows: 1 }, error: null });
  answer(rpc, () => world);
  const base = rpc.getMockImplementation() as (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'admin_event_workspace_p5') {
      const id = String(args.p_series_id);
      const s = world.series.find((x) => x.id === id);
      return {
        data: {
          series: {
            series: {
              id, name: s?.name ?? '', format: s?.format ?? 'recurring', lifecycle_status: s?.lifecycle_status ?? 'live', version: world.seriesVersion,
              default_local_start_time: '20:00:00', default_start_date: day(-60), default_venue_id: 'v1', default_ticket_url: null,
              default_description: 'Open social', default_level: null, instagram_url: null, default_music_styles: ['Bachata'],
              default_cover_image_url: null, recurrence_rule: WEEKLY_FRIDAY, removed_dates: [],
            },
            program: [],
          },
          occurrences: (world.occs[id] ?? []).map((o) => ({ id: o.id, occurrence_date: o.date, lifecycle_status: o.status, version: o.version, materialised_start_utc: `${o.date}T20:00:00Z` })),
          meta: { has_more: false },
        },
        error: null,
      };
    }
    if (fn === 'event_view_p5') {
      const res = (await base(fn, args)) as { data: Record<string, unknown> };
      return { ...res, data: { ...res.data, event: { venue_id: 'v1' }, schedule: { local_start_time: '20:00:00', local_end_time: '23:30:00' } } };
    }
    if (fn === 'get_organiser_venue_options_v1') return { data: VENUES, error: null };
    if (fn === 'organiser_team_v1') return team.ok ? { data: { my_role: 'owner', members: team.members }, error: null } : { data: null, error: { message: 'boom' } };
    if (fn === 'list_organiser_access_requests_v1' || fn === 'organiser_team_browse_people_v1' || fn === 'organiser_team_search_people_v1') return { data: [], error: null };
    if (fn === 'get_organiser_contact_settings_v1') {
      return { data: { contact_email: null, contact_phone: null, show_phone_publicly: false, show_email_publicly: false, claim_email: null }, error: null };
    }
    if (fn === 'remove_organiser_member_v1') return removal();
    return base(fn, args);
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ROUTES = (
  <>
    <Route path="/account/o/change/:seriesId/:occurrenceId/time" element={<ChangeFlow step="time" />} />
    <Route path="/account/o/change/:seriesId/:occurrenceId/venue" element={<ChangeFlow step="venue" />} />
    <Route path="/account/o/change/:seriesId/:occurrenceId/day" element={<ChangeFlow step="day" />} />
    <Route path="/account/o/add" element={<AddFlow step="event" />} />
    <Route path="/account/o/add/:seriesId" element={<AddFlow step="day" />} />
    <Route path="/account/o/add/:seriesId/:date" element={<AddFlow step="time" />} />
    <Route path="/account/o/cancel/:seriesId/:occurrenceId" element={<CancelFlow step="confirm" />} />
    <Route path="/account/o/new/:seriesId/venue" element={<NewFlow />} />
    <Route path="/account/o/cover/:seriesId" element={<CoverFlow />} />
    <Route path="/account/o/events/:seriesId" element={<OneEvent />} />
    <Route path="/account/o/events/:seriesId/details" element={<Details />} />
    <Route path="/account/o/team" element={<TeamPage />} />
    <Route path="/account/o/team/add" element={<TeamFlow step="add" />} />
    <Route path="/account/o/more" element={<MorePage />} />
    <Route path="/account/o/done" element={<Done />} />
  </>
);
const open = (path: string) => mount(path, ROUTES);
const where = () => screen.getByTestId('where').textContent;

/** Coming dates that fill the 30-date cap, and a cancelled one after them (prod: 27 of 67 live series sit at 30+). */
const atCap = () => {
  world.occs[A] = [...comingRun(30), { id: GONE, date: day(40), status: 'cancelled', version: 7 }];
  world.series[0] = series(A, 'Friday Social', world.occs[A]);
};

interface OffRow {
  row: string;
  path: () => string;
  setup?: () => void;
  control: () => Promise<HTMLElement>;
  reason: (control: HTMLElement) => HTMLElement | null;
  says: () => string | RegExp;
}

const OFF_ROWS: OffRow[] = [
  {
    row: 'More: the sole owner cannot leave',
    path: () => ORG_PATHS.more,
    setup: () => { team.members = [member('u1', 'owner', { is_self: true })]; },
    control: async () => {
      const el = await screen.findByTestId('more-leave');
      await waitFor(() => expect(rpc.mock.calls.some(([fn]) => fn === 'organiser_team_v1')).toBe(true));
      return el;
    },
    reason: () => screen.queryByTestId('more-leave-reason'),
    says: () => HAND_OVER_FIRST,
  },
  {
    row: 'event: a course cannot stop repeating',
    path: () => ORG_PATHS.event(A),
    setup: () => { world.series[0] = series(A, 'Salsa Course', world.occs[A], { format: 'course' }); },
    control: () => screen.findByTestId('org-event-stop'),
    reason: () => screen.queryByTestId('org-event-stop-reason'),
    says: () => COURSE_STOP_REASON,
  },
  {
    row: 'add, which event: an event at the date cap',
    path: () => ORG_PATHS.add,
    setup: () => { world.occs[A] = comingRun(47); world.series[0] = series(A, 'Friday Social', world.occs[A]); },
    control: async () => within(await screen.findByTestId('add-which-event')).getAllByTestId('add-event-row')[0],
    reason: (el) => within(el).queryByText(CAP_NOTE),
    says: () => CAP_NOTE,
  },
  {
    row: 'add, which day: every day at the date cap',
    path: () => ORG_PATHS.addEvent(A),
    setup: () => { world.occs[A] = Array.from({ length: 30 }, (_, i) => ({ id: `cap${i}`, date: day(40 + i), status: 'scheduled', version: 1 })); },
    control: async () => within(await screen.findByTestId('add-which-day')).getAllByTestId('add-day-row')[0],
    reason: (el) => within(el).queryByText(CAP_NOTE),
    says: () => CAP_NOTE,
  },
  {
    row: 'event: Put it back at the date cap',
    path: () => ORG_PATHS.event(A),
    setup: atCap,
    control: async () => within(await screen.findByTestId('org-cancelled-date')).getByTestId('org-put-back'),
    reason: () => screen.queryByTestId('org-put-back-reason'),
    says: () => RESTORE_CAP_NOTE,
  },
  {
    row: 'cancel: Put it back at the date cap',
    path: () => ORG_PATHS.cancelDate(A, GONE),
    setup: atCap,
    control: () => screen.findByTestId('cancel-put-back'),
    reason: () => screen.queryByTestId('cancel-put-back-reason'),
    says: () => RESTORE_CAP_NOTE,
  },
  {
    row: 'team: Add someone on a full team',
    path: () => ORG_PATHS.team,
    setup: () => { team.members = Array.from({ length: TEAM_CAP }, (_, i) => member(i ? `m${i}` : 'u1', i ? 'manager' : 'owner', i ? {} : { is_self: true })); },
    control: () => screen.findByTestId('team-add'),
    reason: () => screen.queryByTestId('team-full'),
    says: () => TEAM_FULL_REASON,
  },
  {
    row: 'team, add someone: Invite on a full team',
    path: () => ORG_PATHS.teamAdd,
    setup: () => { team.members = Array.from({ length: TEAM_CAP }, (_, i) => member(i ? `m${i}` : 'u1', i ? 'manager' : 'owner', i ? {} : { is_self: true })); },
    control: () => screen.findByTestId('add-invite'),
    reason: () => screen.queryByTestId('add-full'),
    says: () => TEAM_FULL_REASON,
  },
  {
    row: 'change the time: an untouched Save',
    path: () => ORG_PATHS.changeTime(A, BEFORE),
    control: async () => {
      const input = (await screen.findByTestId('change-time-input')) as HTMLInputElement;
      await waitFor(() => expect(input.value).not.toBe(''));
      return screen.getByTestId('change-save');
    },
    reason: () => screen.queryByTestId('change-save-reason'),
    says: () => /\S/,
  },
  {
    row: 'change the venue: an untouched Save',
    path: () => ORG_PATHS.changeVenue(A, BEFORE),
    control: async () => {
      await screen.findByText('Dance Hub');
      return screen.getByTestId('change-save');
    },
    reason: () => screen.queryByTestId('change-save-reason'),
    says: () => /\S/,
  },
  {
    row: 'change the name: an untouched Save',
    path: () => detailEditPath(A, 'name'),
    control: () => screen.findByTestId('org-detail-save'),
    reason: () => screen.queryByTestId('event-step-reason'),
    says: () => /\S/,
  },
  {
    row: 'change the event time: an untouched Save',
    path: () => detailEditPath(A, 'time'),
    control: () => screen.findByTestId('org-detail-save'),
    reason: () => screen.queryByTestId('event-step-reason'),
    says: () => /\S/,
  },
];

const isOff = (el: HTMLElement) => el.getAttribute('aria-disabled') === 'true' || (el as HTMLButtonElement).disabled === true;

describe('a control that cannot work is off, with a visible reason, and a tap does nothing', () => {
  it.each(OFF_ROWS)('$row', async ({ path, setup, control, reason, says }) => {
    setup?.();
    open(path());
    const el = await control();
    await waitFor(() => expect(isOff(el)).toBe(true));
    const line = reason(el);
    expect(line, 'no reason line on screen').not.toBeNull();
    expect(line!.className).not.toMatch(/(^|\s)(sr-only|hidden)(\s|$)/);
    const expected = says();
    if (typeof expected === 'string') expect(line!.textContent).toBe(expected);
    else expect(line!.textContent).toMatch(expected);
    fireEvent.click(el);
    await flush();
    expect(writes()).toHaveLength(0);
    expect(where()).toBe(path());
  });

  it('the sole owner\'s server refusal (last_owner) names only controls that exist', async () => {
    team.ok = false;
    removal = () => ({ data: null, error: { message: 'last_owner', code: 'P0001' } });
    open(ORG_PATHS.more);
    const leave = await screen.findByTestId('more-leave');
    await waitFor(() => expect(leave.getAttribute('aria-disabled')).toBeNull());
    fireEvent.click(leave);
    fireEvent.click(await screen.findByTestId('more-leave-yes'));
    const copy = (await screen.findByTestId('more-leave-error')).textContent ?? '';
    // The Team and Person screens offer "Hand the page over"; there is no "Make owner" control.
    expect(copy).not.toMatch(/Make owner/);
  });
});

interface UntouchedRow {
  screen: string;
  path: () => string;
  save: string;
  ready: () => Promise<void>;
  touch: () => void;
  untouch: () => void;
}

/** A typed field: its loaded value is the current one; `other` differs from it. */
function typed(testId: string, other: string) {
  let was = '';
  return {
    ready: async () => {
      const input = (await screen.findByTestId(testId)) as HTMLInputElement;
      await waitFor(() => expect(input.value).not.toBe(''));
      was = input.value;
    },
    touch: () => fireEvent.change(screen.getByTestId(testId), { target: { value: other } }),
    untouch: () => fireEvent.change(screen.getByTestId(testId), { target: { value: was } }),
  };
}

const UNTOUCHED: UntouchedRow[] = [
  { screen: 'change the time', path: () => ORG_PATHS.changeTime(A, BEFORE), save: 'change-save', ...typed('change-time-input', '21:30') },
  {
    screen: 'change the venue',
    path: () => ORG_PATHS.changeVenue(A, BEFORE),
    save: 'change-save',
    ready: async () => { await screen.findByText('Dance Hub'); },
    touch: () => fireEvent.click(screen.getByText('Dance Hub')),
    untouch: () => fireEvent.click(screen.getByText('Salsa Bar')),
  },
  { screen: 'change the name', path: () => detailEditPath(A, 'name'), save: 'org-detail-save', ...typed('org-detail-input', 'Friday Social Club') },
  { screen: 'change the event time', path: () => detailEditPath(A, 'time'), save: 'org-detail-save', ...typed('org-detail-input', '21:30') },
];

describe('Save is off until the value differs, and an untouched Save sends NO command', () => {
  it.each(UNTOUCHED)('$screen: untouched, a tap sends nothing', async ({ path, save, ready }) => {
    open(path());
    await ready();
    const btn = screen.getByTestId(save);
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(btn);
    await flush();
    expect(writes()).toHaveLength(0);
    expect(where()).toBe(path());
  });

  it.each(UNTOUCHED)('$screen: a different value turns Save on; the current value back turns it off and sends nothing', async ({ path, save, ready, touch, untouch }) => {
    open(path());
    await ready();
    touch();
    expect(screen.getByTestId(save).getAttribute('aria-disabled')).toBeNull();
    untouch();
    const btn = screen.getByTestId(save);
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(btn);
    await flush();
    expect(writes()).toHaveLength(0);
  });
});

interface ConflictRow {
  screen: string;
  seriesId: string;
  path: () => string;
  act: () => Promise<void>;
  /** Where the screen puts the conflict: its own R3-7 view, the shared Done screen, or an error line's step body. */
  view: string | (() => Promise<HTMLElement>);
}

const press = async (testId: string) => {
  const btn = await screen.findByTestId(testId);
  await waitFor(() => expect(btn.hasAttribute('disabled')).toBe(false));
  fireEvent.click(btn);
};

const CONFLICTS: ConflictRow[] = [
  {
    screen: 'change the time', seriesId: A, path: () => ORG_PATHS.changeTime(A, BEFORE), view: 'change-conflict',
    act: async () => {
      const input = (await screen.findByTestId('change-time-input')) as HTMLInputElement;
      await waitFor(() => expect(input.value).not.toBe(''));
      fireEvent.change(input, { target: { value: '21:30' } });
      fireEvent.click(screen.getByTestId('change-save'));
    },
  },
  {
    screen: 'change the venue', seriesId: A, path: () => ORG_PATHS.changeVenue(A, BEFORE), view: 'change-conflict',
    act: async () => {
      fireEvent.click(await screen.findByText('Dance Hub'));
      fireEvent.click(screen.getByTestId('change-save'));
    },
  },
  {
    screen: 'move to another day', seriesId: A, path: () => ORG_PATHS.changeDay(A, BEFORE), view: 'change-conflict',
    act: async () => { fireEvent.click(within(await screen.findByTestId('change-day-list')).getAllByRole('button')[0]); },
  },
  {
    screen: 'change the name', seriesId: A, path: () => detailEditPath(A, 'name'), view: 'event-conflict',
    act: async () => {
      fireEvent.change(await screen.findByTestId('org-detail-input'), { target: { value: 'Friday Social Club' } });
      await press('org-detail-save');
    },
  },
  { screen: 'add a date', seriesId: A, path: () => ORG_PATHS.addDate(A, day(7)), view: 'add-conflict', act: () => press('add-save') },
  { screen: 'cancel a date', seriesId: A, path: () => ORG_PATHS.cancelDate(A, BEFORE), view: 'cancel-conflict', act: () => press('cancel-send') },
  { screen: 'put a cancelled date back', seriesId: A, path: () => ORG_PATHS.cancelDate(A, GONE), view: 'cancel-conflict', act: () => press('cancel-put-back') },
  { screen: 'pause the event', seriesId: A, path: () => eventStepPath(A, 'pause'), view: 'event-conflict', act: () => press('event-step-send') },
  { screen: 'end the event', seriesId: A, path: () => eventStepPath(A, 'end'), view: 'event-conflict', act: () => press('event-step-send') },
  {
    screen: 'change the day of the week', seriesId: A, path: () => eventStepPath(A, 'day'), view: 'event-conflict',
    act: async () => { fireEvent.click(await screen.findByTestId('event-day-6')); await press('event-step-send'); },
  },
  { screen: 'stop repeating', seriesId: A, path: () => eventStepPath(A, 'stop'), view: 'event-conflict', act: () => press('event-step-send') },
  {
    screen: 'new event (venue step)', seriesId: DRAFT, path: () => ORG_PATHS.newVenue(DRAFT), view: 'event-conflict',
    act: async () => { fireEvent.click((await screen.findAllByTestId('org-new-venue-row'))[0]); },
  },
  {
    screen: 'cover photo', seriesId: A, path: () => ORG_PATHS.cover(A), view: 'event-conflict',
    act: async () => { fireEvent.change(await screen.findByTestId('cover-input'), { target: { files: [new File(['x'], 'c.png', { type: 'image/png' })] } }); },
  },
];

describe('version_conflict on every write ends on the R3-7 view: VERSION_CONFLICT, ONE button, to the event', () => {
  it.each(CONFLICTS)('$screen', async ({ seriesId, path, act, view }) => {
    world.command = () => CONFLICT;
    open(path());
    await act();
    await waitFor(() => expect(writes().length).toBeGreaterThan(0));
    await flush();
    const box = typeof view === 'string' ? await screen.findByTestId(view) : await view();
    expect(box.textContent).toContain(VERSION_CONFLICT);
    const buttons = within(box).queryAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toHaveLength(1);
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(where()).toBe(ORG_PATHS.event(seriesId)));
    expect(commandsOf(rpc)).toHaveLength(1);
  });

  // Team writes (add, remove, role, leave, hand over) send no expected_version: organiser_team_*_v1,
  // remove_organiser_member_v1 and organiser_transfer_ownership_v1 take no version, so no version_conflict.
  it.skip('team writes: skipped, the team RPCs carry no expected_version, so they cannot return version_conflict', () => {});
  // The date line-up editor (dates/useDateEditor.ts) is main's editor kept as is (plan 4.2); its
  // conflict is PROGRAMME_VERSION_CONFLICT with an in-place reload (selfServeErrors.ts:272-280), not R3-7.
  it.skip('date line-up: skipped, main\'s editor kept as is (4.2) reloads in place on a conflict, outside R3-7', () => {});
});

// ---- G2 (F-INT-fix): A-B2 access refusal, A-S1 Put back on One event ----------------------

/** Wraps the current rpc answers: `fn` gets `over` instead (args passed for a per-call answer). */
const overRpc = (fn: string, over: (args: Record<string, unknown>) => unknown) => {
  const prev = rpc.getMockImplementation() as (f: string, a: Record<string, unknown>) => Promise<unknown>;
  rpc.mockImplementation(async (f: string, a: Record<string, unknown>) => (f === fn ? over(a) : prev(f, a)));
};
/** What _assert_can_edit_series_p5 raises for a login that is not an owner/manager of the series. */
const REFUSED = { data: null, error: { message: 'permission_denied: caller cannot edit this series', code: '42501' } };

interface NoAccessRow { screen: string; path: () => string; routes?: Parameters<typeof mount>[1] }

const NO_ACCESS_ROWS: NoAccessRow[] = [
  { screen: 'One event', path: () => ORG_PATHS.event(A) },
  { screen: 'Event details', path: () => ORG_PATHS.eventDetails(A) },
  { screen: 'Cover photo', path: () => ORG_PATHS.cover(A) },
  { screen: 'Cancel a date (confirm)', path: () => ORG_PATHS.cancelDate(A, BEFORE) },
  { screen: 'Cancel a date (which date)', path: () => ORG_PATHS.cancelEvent(A), routes: <Route path="/account/o/cancel/:seriesId" element={<CancelFlow step="date" />} /> },
  { screen: 'Add a date (which day)', path: () => ORG_PATHS.addEvent(A) },
  { screen: 'Add a date (time)', path: () => ORG_PATHS.addDate(A, day(7)) },
  { screen: 'Change a date (time)', path: () => ORG_PATHS.changeTime(A, BEFORE) },
  { screen: 'New event (first date)', path: () => ORG_PATHS.newDate(DRAFT), routes: <Route path="/account/o/new/:seriesId/date" element={<NewFlow />} /> },
];

describe('A-B2: a login the event workspace refuses sees the no-access copy, with NO retry', () => {
  it.each(NO_ACCESS_ROWS)('$screen', async ({ path, routes }) => {
    const { NO_ACCESS_BODY, NO_ACCESS_TESTID, NO_ACCESS_TITLE } = await import('@/modules/organiser/shared/components/NoAccess');
    overRpc('admin_event_workspace_p5', () => REFUSED);
    mount(path(), <>{ROUTES}{routes}</>);
    const box = await screen.findByTestId(NO_ACCESS_TESTID, {}, { timeout: 3000 });
    expect(box.textContent).toContain(NO_ACCESS_TITLE);
    expect(box.textContent).toContain(NO_ACCESS_BODY);
    expect(box.textContent).not.toMatch(/connection|Try again/);
    expect(within(box).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('a signed-out caller is not "no access" (signing in may fix it): the retry stays', async () => {
    const { NO_ACCESS_TESTID } = await import('@/modules/organiser/shared/components/NoAccess');
    overRpc('admin_event_workspace_p5', () => ({ data: null, error: { message: 'permission_denied: authentication_required', code: '42501' } }));
    open(ORG_PATHS.event(A));
    expect(await screen.findByTestId('org-event-error-retry')).toBeTruthy();
    expect(screen.queryByTestId(NO_ACCESS_TESTID)).toBeNull();
  });
});

describe('A-S1: Put back on One event is a CONFLICTS row (R3-7 view, one button) and reuses its key on a retry', () => {
  const TAKEN = day(10); // Friday 30 October 2026: a weekly-Friday rule date, taken off.
  const takeOff = () => {
    const prev = rpc.getMockImplementation() as (f: string, a: Record<string, unknown>) => Promise<{ data: { series: { series: Record<string, unknown> } } }>;
    rpc.mockImplementation(async (f: string, a: Record<string, unknown>) => {
      const res = await prev(f, a);
      if (f === 'admin_event_workspace_p5') res.data.series.series.removed_dates = [TAKEN];
      return res;
    });
  };

  it('put a taken-off date back: version_conflict ends on the R3-7 view, ONE button, to the event', async () => {
    world.command = () => CONFLICT;
    takeOff();
    open(ORG_PATHS.event(A));
    await press('org-taken-off-put-back');
    await waitFor(() => expect(writes().length).toBeGreaterThan(0));
    await flush();
    const box = await screen.findByTestId('event-conflict');
    expect(box.textContent).toContain(VERSION_CONFLICT);
    const buttons = within(box).queryAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(screen.queryByTestId('org-taken-off-error')).toBeNull();
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(where()).toBe(ORG_PATHS.event(A)));
    // Back on the event, looking again: the conflict view is gone and Put back is offered afresh.
    await waitFor(() => expect(screen.queryByTestId('event-conflict')).toBeNull());
    expect(await screen.findByTestId('org-taken-off-put-back')).toBeTruthy();
    expect(commandsOf(rpc)).toHaveLength(1);
  });

  it('a lost reply then a retry sends the SAME idempotency key (the server replays, no second write)', async () => {
    let n = 0;
    world.command = () => (++n === 1 ? { data: null, error: { message: 'Failed to fetch' } } : { data: { ok: true, new_version: 10 }, error: null });
    takeOff();
    open(ORG_PATHS.event(A));
    await press('org-taken-off-put-back');
    await screen.findByTestId('org-taken-off-error');
    await press('org-taken-off-put-back');
    await waitFor(() => expect(commandsOf(rpc)).toHaveLength(2));
    const [first, second] = commandsOf(rpc);
    expect(first.env.command.payload).toEqual({ date: TAKEN });
    expect(second.env.command).toEqual(first.env.command);
    expect(first.env.idempotency_key).toMatch(/\S/);
    expect(second.env.idempotency_key).toBe(first.env.idempotency_key);
  });
});

describe('B-S6: One event month grid has a Monday-first weekday header and says each marked date\'s state', () => {
  it('October 2026: M T W T F S S over the days, 1 October under Thursday, "on" / "cancelled" for screen readers', async () => {
    world.occs[A] = [...world.occs[A], { id: 'oc25', date: day(5), status: 'cancelled', version: 1 }]; // Sunday 25 October
    open(ORG_PATHS.event(A));
    const month = await screen.findByTestId('org-month');
    const head = within(month).getByTestId('org-month-weekdays');
    const cells = Array.from(head.children) as HTMLElement[];
    expect(cells.map((c) => c.querySelector('[aria-hidden="true"]')?.textContent).join('')).toBe('MTWTFSS');
    expect(cells.map((c) => c.querySelector('.sr-only')?.textContent)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    // Day cells sit in the same 7 columns as the header: 1 October 2026 is a Thursday (column 4).
    const grid = within(month).getByTestId('org-month-days');
    expect(Array.from(grid.children).findIndex((c) => c.getAttribute('data-date') === '2026-10-01') % 7).toBe(3);
    const state = (date: string) => month.querySelector(`[data-date="${date}"] .sr-only`)?.textContent?.trim() ?? null;
    expect(state(day(3))).toBe('on'); // Friday 23 October, scheduled
    expect(state(day(10))).toBe('on');
    expect(state(day(5))).toBe('cancelled');
    expect(state(day(1))).toBeNull(); // no date that day: nothing extra to hear
    expect(within(month).getAllByTestId('org-month-dot')).toHaveLength(4);
  });
});

// ---- G1 (F-INT-fix): status chips rendered, no events at all, ?o= on New event ---------------

/** Two pages for this login: the fixture page first, then an empty second page. */
const g1TwoPages = () => {
  const prev = rpc.getMockImplementation() as (f: string, a: Record<string, unknown>) => Promise<unknown>;
  rpc.mockImplementation(async (f: string, a: Record<string, unknown>) => {
    const res = (await prev(f, a)) as { data: { organisers: Array<Record<string, unknown>> } };
    if (f !== 'organiser_home_v1') return res;
    const first = res.data.organisers[0];
    return { data: { ...res.data, organisers: [first, { ...first, id: 'org2', name: 'Second Page', series: [] }] }, error: null };
  });
};
const g1Pages = async () => ({
  HomePage: (await import('@/modules/organiser/home')).default,
  EventsPage: (await import('@/modules/organiser/events')).default,
});

describe('G1: the status chip on My events and One event is the shared word for every lifecycle_status (B-B1)', () => {
  const STATUSES = ['live', 'draft', 'paused', 'ended', 'archived', 'pending_review', 'rejected'];
  it.each(STATUSES)('%s', async (status) => {
    const { lifecycleTag } = await import('@/modules/organiser/shared/eventState');
    const { EventsPage } = await g1Pages();
    world.occs[A] = comingRun(3);
    world.series = [series(A, 'Friday Social', world.occs[A], { lifecycle_status: status, created_at: `${day(0)}T09:00:00Z` })];
    const routes = (
      <>
        <Route path="/account/o/events" element={<EventsPage />} />
        <Route path="/account/o/events/:seriesId" element={<OneEvent />} />
      </>
    );
    mount(ORG_PATHS.events, routes);
    if (status === 'archived') {
      // R3-4: an archived series is never a row or a chip.
      expect(await screen.findByTestId('org-events-empty')).toBeTruthy();
    } else {
      const row = await screen.findByTestId('org-event-row');
      expect(within(row).getByTestId('org-event-chip').textContent).toBe(lifecycleTag(status).label);
    }
    cleanup();
    mount(ORG_PATHS.event(A), routes);
    const title = await screen.findByTestId('org-event-title');
    const chip = within(title).queryByTestId('org-event-chip');
    expect(chip?.textContent ?? null).toBe(status === 'archived' ? null : lifecycleTag(status).label);
  });
});

describe('G1: a login with no events at all: Change, Cancel and Add say "No events yet" with New event (B-S4)', () => {
  const FLOWS = [
    { flow: 'change', path: ORG_PATHS.change, el: () => <ChangeFlow step="event" /> },
    { flow: 'cancel', path: ORG_PATHS.cancel, el: () => <CancelFlow step="event" /> },
    { flow: 'add', path: ORG_PATHS.add, el: () => <AddFlow step="event" /> },
  ];
  it.each(FLOWS)('$flow', async ({ flow, path, el }) => {
    world.series = [];
    mount(path, <Route path={path} element={el()} />);
    const box = await screen.findByTestId(`${flow}-which-event`);
    expect(box.textContent).toContain('No events yet');
    fireEvent.click(within(box).getByTestId(`${flow}-empty-new`));
    await waitFor(() => expect(where()).toBe(ORG_PATHS.newWhat));
  });
  it('the three flows draw ONE shared empty state', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');
    for (const f of ['flows/change/WhichEvent.tsx', 'flows/cancel/WhichEvent.tsx', 'flows/add/WhichEvent.tsx']) {
      expect(src(f)).toMatch(/import[^;]*\bNoEventsYet\b[^;]*from/);
      expect(src(f)).not.toContain("'No events yet'");
    }
  });
  it('events with no coming dates still say "No coming dates" on Change', async () => {
    world.occs[A] = [{ id: 'p1', date: day(-3), status: 'scheduled', version: 1 }];
    world.series = [series(A, 'Friday Social', world.occs[A])];
    mount(ORG_PATHS.change, <Route path={ORG_PATHS.change} element={<ChangeFlow step="event" />} />);
    const box = await screen.findByTestId('change-which-event');
    expect(box.textContent).toContain('No coming dates');
    expect(box.textContent).not.toContain('No events yet');
  });
});

describe('G1: New event carries the page in ?o= when the login has two pages; an unknown ?o= falls back to the first (A-N8)', () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch { /* no storage */ }
    g1TwoPages();
  });
  it('Home: the gold New event opens New event for the page on screen', async () => {
    const { HomePage } = await g1Pages();
    mount(`${ORG_PATHS.home}?o=org2`, <Route path={ORG_PATHS.home} element={<HomePage />} />);
    expect((await screen.findByTestId('home-page-name')).textContent).toBe('Second Page');
    fireEvent.click(await screen.findByTestId('home-new-event'));
    await waitFor(() => expect(where()).toBe(`${ORG_PATHS.newWhat}?o=org2`));
  });
  it('My events (no events): New event opens New event for the chosen page', async () => {
    const { EventsPage } = await g1Pages();
    world.series = [];
    mount(`${ORG_PATHS.events}?o=org2`, <Route path={ORG_PATHS.events} element={<EventsPage />} />);
    fireEvent.click(await screen.findByTestId('org-events-new'));
    await waitFor(() => expect(where()).toBe(`${ORG_PATHS.newWhat}?o=org2`));
  });
  it('an unknown ?o= falls back to the first page, and New event names that page', async () => {
    const { HomePage } = await g1Pages();
    mount(`${ORG_PATHS.home}?o=not-a-page`, <Route path={ORG_PATHS.home} element={<HomePage />} />);
    expect((await screen.findByTestId('home-page-name')).textContent).toBe('Bachata Nights');
    fireEvent.click(await screen.findByTestId('home-new-event'));
    await waitFor(() => expect(where()).toBe(`${ORG_PATHS.newWhat}?o=org1`));
  });
});
