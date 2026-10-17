// @vitest-environment jsdom
/**
 * S4 New event (plan 4.5): one question per screen, ONE command per step of the
 * pinned kind with expected_version + idempotency key, a weekly night sets its
 * recurrence once, a one night never does, a step button that cannot work is off
 * WITH a reason, and the draft carries only the D44 facts.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { home, rawWorkspace, venues } from '../../../events/__tests__/fixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c-london' }) }));

import NewFlow from '../NewFlow';
import { NEW_FORMATS, dateCommands, draftCommand, firstDateChoices, liveMessage, parseFormat, timeBlock, venueCommands } from '../model';
import { ORG_PATHS } from '../../../shell/paths';
import { createSeriesCommand } from '../../../shared/selfServeApi';

// The organiser key is a legacy column name the architecture lint bans, so the
// tests read it from the one builder that attaches it (createSeriesCommand).
const organiserPart = (organiserId: string) => createSeriesCommand({}, organiserId).payload;
const DRAFT_KEYS = ['format', 'name', 'timezone', ...Object.keys(organiserPart('x'))].sort();

type Envelope = { target_id: string | null; expected_version: number | null; idempotency_key: string; command: { kind: string; payload: Record<string, unknown> } };
const sent = (): Envelope[] => rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5').map(([, a]) => (a as { p_envelope: Envelope }).p_envelope);

let format = 'recurring';
let conflict = false;
let nextVersion = 4;

beforeEach(() => {
  format = 'recurring';
  conflict = false;
  nextVersion = 4;
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') return { data: home(), error: null };
    if (fn === 'get_organiser_venue_options_v1') return { data: venues, error: null };
    if (fn === 'admin_event_workspace_p5') return { data: rawWorkspace({ format, version: 3, default_cover_image_url: null }), error: null };
    if (fn === 'series_command_p5') {
      if (conflict) return { data: null, error: { code: 'P0001', message: 'version_conflict: stale' } };
      const v = nextVersion;
      nextVersion += 1;
      return { data: { ok: true, new_version: v }, error: null };
    }
    return { data: null, error: { message: 'unexpected ' + fn } };
  });
});
afterEach(cleanup);

function Where() {
  return <span data-testid="where">{useLocation().pathname + useLocation().search}</span>;
}

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/o/new/what" element={<NewFlow />} />
          <Route path="/account/o/new/name" element={<NewFlow />} />
          <Route path="/account/o/new/:seriesId/venue" element={<NewFlow />} />
          <Route path="/account/o/new/:seriesId/date" element={<NewFlow />} />
          <Route path="/account/o/new/:seriesId/time" element={<NewFlow />} />
          <Route path="/account/o/new/:seriesId/cover" element={<NewFlow />} />
          <Route path="/account/o/done" element={<span data-testid="done-route" />} />
          <Route path="*" element={<span data-testid="elsewhere" />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const where = () => screen.getByTestId('where').textContent;

describe('model: the pinned command per step', () => {
  it('offers exactly two creatable formats (R3-1) and rejects course and festival', () => {
    expect(NEW_FORMATS.map((f) => f.label)).toEqual(['Weekly night', 'One night']);
    expect(parseFormat('recurring')).toBe('recurring');
    expect(parseFormat('one_off')).toBe('one_off');
    for (const bad of ['course', 'festival', '', null, undefined]) expect(parseFormat(bad as string | null)).toBeNull();
  });

  it('the draft carries only name, format, timezone and the organiser (D44)', () => {
    const cmd = draftCommand('  Friday Night  ', 'recurring', 'org1');
    expect(cmd.kind).toBe('series.upsert');
    expect(Object.keys(cmd.payload).sort()).toEqual(DRAFT_KEYS);
    expect(cmd.payload.name).toBe('Friday Night');
    expect(cmd.payload).toMatchObject(organiserPart('org1'));
  });

  it.each([
    ['recurring', ['series.upsert', 'series.set_recurrence']],
    ['one_off', ['series.upsert']],
  ] as const)('the first date of a %s sends %j (D55)', (fmt, kinds) => {
    const cmds = dateCommands(fmt, '2026-10-23');
    expect(cmds.map((c) => c.kind)).toEqual(kinds);
    expect(cmds[0].payload).toEqual({ default_start_date: '2026-10-23' });
    if (fmt === 'recurring') expect(cmds[1].payload).toMatchObject({ mode: 'weekly', weekdays: [5] });
  });

  it('the venue step is ONE upsert, with the city only when known', () => {
    expect(venueCommands('v1', 'c1')).toHaveLength(1);
    expect(venueCommands('v1', null)[0].payload).toEqual({ default_venue_id: 'v1' });
    expect(venueCommands('v1', 'c1')[0].payload).toEqual({ default_venue_id: 'v1', default_city_id: 'c1' });
  });

  it('lists 30 days from today and words the Live line with a full weekday', () => {
    const days = firstDateChoices('2026-10-08');
    expect(days).toHaveLength(30);
    expect(days[0]).toEqual({ date: '2026-10-08', label: 'Thursday 8 October' });
    expect(liveMessage('2026-10-23', '20:00:00')).toBe('Live - Friday 23 October, 20:00');
    expect(liveMessage(null, null)).toBe('Live');
    expect(timeBlock('')).toMatch(/start time/);
    expect(timeBlock('20:00')).toBeNull();
  });
});

describe('screens: one question each', () => {
  it('C19 shows exactly two rows and a tap goes on with the format in the URL', async () => {
    mount('/account/o/new/what');
    expect(await screen.findByTestId('org-new-format-recurring')).toBeTruthy();
    expect(screen.getByTestId('org-new-format-one_off')).toBeTruthy();
    expect(screen.queryByTestId('org-new-format-course')).toBeNull();
    expect(screen.getByTestId('org-new-leave').textContent).toBe('Leave');
    fireEvent.click(screen.getByTestId('org-new-format-one_off'));
    await waitFor(() => expect(where()).toBe('/account/o/new/name?format=one_off'));
    expect(sent()).toHaveLength(0);
  });

  it('C20 name: Next is off with a reason until a name is typed, then sends ONE create and replaces the entry', async () => {
    mount('/account/o/new/name?format=recurring');
    const next = (await screen.findByTestId('org-new-next')) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(screen.getByTestId('org-new-next-reason').textContent).toMatch(/name/);
    expect(next.getAttribute('aria-describedby')).toBe(screen.getByTestId('org-new-next-reason').id);
    fireEvent.click(next);
    expect(sent()).toHaveLength(0);
    fireEvent.change(screen.getByTestId('org-new-name'), { target: { value: 'Friday Night' } });
    await waitFor(() => expect((screen.getByTestId('org-new-next') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('org-new-next'));
    await waitFor(() => expect(where()).toContain('/venue'));
    const calls = sent();
    expect(calls).toHaveLength(1);
    expect(calls[0].command.kind).toBe('series.upsert');
    expect(calls[0].expected_version).toBeUndefined();
    expect(calls[0].idempotency_key).toBeTruthy();
    expect(Object.keys(calls[0].command.payload).sort()).toEqual(DRAFT_KEYS);
  });

  it('C20 without a valid format goes back to the first question and sends nothing', async () => {
    mount('/account/o/new/name?format=course');
    await waitFor(() => expect(where()).toBe('/account/o/new/what'));
    expect(sent()).toHaveLength(0);
  });
});

describe('screens: venue, date, time', () => {
  it('C21 venue: a tap sends ONE upsert on a fresh version and goes to the date', async () => {
    mount('/account/o/new/s1/venue');
    const rows = await screen.findAllByTestId('org-new-venue-row');
    expect(rows).toHaveLength(2);
    fireEvent.click(rows[0]);
    await waitFor(() => expect(where()).toBe('/account/o/new/s1/date'));
    const calls = sent();
    expect(calls).toHaveLength(1);
    expect(calls[0].command.kind).toBe('series.upsert');
    expect(calls[0].command.payload).toMatchObject({ default_venue_id: 'v1' });
    expect(calls[0].expected_version).toBe(3);
    expect(calls[0].target_id).toBe('s1');
  });

  it('C21 venue: a search with no match says what to do', async () => {
    mount('/account/o/new/s1/venue');
    await screen.findAllByTestId('org-new-venue-row');
    fireEvent.change(screen.getByTestId('org-new-venue-search'), { target: { value: 'zzzz' } });
    expect((await screen.findByTestId('org-new-venue-empty')).textContent).toMatch(/Try another word/);
  });

  it('C22 a weekly night sends the date, then ONE recurrence on that weekday, each on the version the last one returned', async () => {
    format = 'recurring';
    mount('/account/o/new/s1/date');
    const rows = await screen.findAllByTestId('org-new-date-row');
    expect(rows).toHaveLength(30);
    fireEvent.click(rows.find((r) => r.textContent === 'Friday 9 October') as HTMLElement);
    await waitFor(() => expect(where()).toBe('/account/o/new/s1/time'));
    const calls = sent();
    expect(calls.map((c) => c.command.kind)).toEqual(['series.upsert', 'series.set_recurrence']);
    expect(calls.map((c) => c.expected_version)).toEqual([3, 4]);
    expect(calls[0].command.payload).toEqual({ default_start_date: '2026-10-09' });
    expect(calls[1].command.payload).toMatchObject({ mode: 'weekly', weekdays: [5] });
  });

  it('C22 a one night sends the date and NO recurrence', async () => {
    format = 'one_off';
    mount('/account/o/new/s1/date');
    const rows = await screen.findAllByTestId('org-new-date-row');
    fireEvent.click(rows[1]);
    await waitFor(() => expect(where()).toBe('/account/o/new/s1/time'));
    expect(sent().map((c) => c.command.kind)).toEqual(['series.upsert']);
  });

  it('C22b time: off with a reason until a time is typed, then ONE upsert', async () => {
    mount('/account/o/new/s1/time');
    const next = (await screen.findByTestId('org-new-next')) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(screen.getByTestId('org-new-next-reason').textContent).toMatch(/start time/);
    fireEvent.change(screen.getByTestId('org-new-time'), { target: { value: '20:30' } });
    await waitFor(() => expect((screen.getByTestId('org-new-next') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('org-new-next'));
    await waitFor(() => expect(where()).toBe('/account/o/new/s1/cover'));
    expect(sent().map((c) => c.command.payload)).toEqual([{ default_local_start_time: '20:30' }]);
  });
});

describe('screens: cover, leaving, conflicts', () => {
  it('C23 cover: Go live is off with a reason until a photo exists, and nothing is sent', async () => {
    mount('/account/o/new/s1/cover');
    const live = (await screen.findByTestId('org-new-live')) as HTMLButtonElement;
    expect(live.disabled).toBe(true);
    expect(screen.getByTestId('org-new-live-reason').textContent).toMatch(/photo/);
    fireEvent.click(live);
    expect(sent()).toHaveLength(0);
  });

  it('every step after the name offers Save as draft and leave, which sends nothing and goes Home', async () => {
    mount('/account/o/new/s1/time');
    const leave = await screen.findByTestId('org-new-leave');
    expect(leave.textContent).toBe('Save as draft and leave');
    fireEvent.click(leave);
    await waitFor(() => expect(screen.getByTestId('elsewhere')).toBeTruthy());
    expect(where()).toBe(ORG_PATHS.home);
    expect(sent()).toHaveLength(0);
  });

  it('a version conflict ends on the shared Done screen (R3-7), not a raw error', async () => {
    conflict = true;
    mount('/account/o/new/s1/venue');
    fireEvent.click((await screen.findAllByTestId('org-new-venue-row'))[0]);
    await waitFor(() => expect(where()).toBe('/account/o/done'));
  });
});

describe('source rules', () => {
  const dir = join(__dirname, '..');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
  it('imports no SectionLabel and no StatusTag (D22)', () => {
    for (const f of files) expect(readFileSync(join(dir, f), 'utf8')).not.toMatch(/SectionLabel|StatusTag/);
  });
  it('every tap row is at least 44px tall', () => {
    const src = readFileSync(join(dir, 'NewFlow.tsx'), 'utf8');
    for (const m of src.matchAll(/min-h-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(44);
  });
});
