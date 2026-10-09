// @vitest-environment jsdom
/**
 * "Dates taken off" on the event editor, over the removed_dates shapes found
 * in a read-only prod survey (2026-10-08, counts only): series with 0, 1 and
 * many removed dates; past-only vs future; a future date the weekly rule still
 * makes vs one it does not (hand-added, or a series with no rule); live within
 * and over the 30-date cap (every live series with future dates taken off was
 * over it: 40 to 49 listed); ended with future dates taken off; paused,
 * archived and draft with none. Names and ids are made up.
 *
 * Rules checked per shape: the section shows exactly the future dates taken
 * off (hidden when none); Put back sends the right existing command through
 * series_command_p5; a Put back that cannot work is disabled WITH a reason on
 * screen; the break sheet and remove confirm name this section by its label.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { addDaysToKey } from '@/lib/londonDate';
import { TODAY, VENUES, homeOf, programmeOf, shapeByKey, upcomingOf, workspaceOf, type SeriesShape } from '../../__tests__/shapes/shapes';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c1' }) }));

import EventEditorPage from '../EventEditorPage';
import { PUT_BACK_WHERE, TAKEN_OFF_LABEL, confirmCopy } from '@/modules/organiser/shared/editorGuards';
import { capBlock, takenOffView } from '../takenOff';
import { parseEventWorkspace } from '../eventModel';
import { eventLock } from '@/modules/organiser/shared/eventState';

type Env = { p_envelope: { command: { kind: string; payload: Record<string, unknown> } } };
const commands = () => rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5').map(([, a]) => (a as Env).p_envelope.command);

interface Case {
  key: string;
  about: string;
  shape: SeriesShape;
  removed: string[];
  /** Future dates taken off, soonest first, with the command Put back sends. */
  rows: { date: string; kind: 'series.unskip_date' | 'series.add_date' }[];
  /** null: Put back works. Otherwise a pattern the on-screen reason matches. */
  blocked: RegExp | null;
}

/** A base shape with `removed` taken off: those dates leave the listed dates. */
function takeOff(base: string, removed: string[], over: Partial<SeriesShape> = {}): SeriesShape {
  const s = shapeByKey(base);
  return { ...s, ...over, key: `${s.key}-off`, dates: s.dates.filter((d) => !removed.includes(d.date)) };
}

const SAT = (weeks: number) => addDaysToKey('2026-10-10', 7 * weeks);
const WED = '2026-10-21';

const CASES: Case[] = [
  { key: 'zero', about: 'live / weekly until / 0 removed', shape: shapeByKey('live-weekly-until'), removed: [], rows: [], blocked: null },
  { key: 'past-only', about: 'live / weekly / 1 removed, in the past', shape: shapeByKey('live-weekly-until'), removed: ['2026-09-26'], rows: [], blocked: null },
  {
    key: 'owner-draft', about: 'in review / weekly, end none / 1 future rule date taken off / 39 listed (over the cap)',
    shape: takeOff('pending-weekly', [SAT(1)]), removed: [SAT(1)],
    rows: [{ date: SAT(1), kind: 'series.unskip_date' }], blocked: /39 upcoming dates are listed and the most is 30.*earlier end/,
  },
  {
    key: 'live-over-cap-many', about: 'live / weekly, end none / many removed (2 past, 2 future) / 50 listed',
    shape: takeOff('live-weekly-open', [SAT(3), SAT(4)]), removed: ['2026-09-05', '2026-09-12', SAT(4), SAT(3)],
    rows: [{ date: SAT(3), kind: 'series.unskip_date' }, { date: SAT(4), kind: 'series.unskip_date' }], blocked: /most is 30/,
  },
  {
    key: 'live-within-cap', about: 'live / weekly until / a future rule date and a hand-added Wednesday taken off / 5 listed',
    shape: takeOff('live-weekly-until', [SAT(1)]), removed: [SAT(1), WED, '2026-09-19'],
    rows: [{ date: SAT(1), kind: 'series.unskip_date' }, { date: WED, kind: 'series.add_date' }], blocked: null,
  },
  {
    key: 'live-rule-ended-before', about: 'live / weekly until / a Saturday taken off AFTER the rule end (no longer a rule date)',
    shape: shapeByKey('live-weekly-until'), removed: [SAT(10)],
    rows: [{ date: SAT(10), kind: 'series.add_date' }], blocked: null,
  },
  {
    key: 'live-norule', about: 'live / recurring, no rule / 0 listed / 2 future taken off',
    shape: shapeByKey('live-norule-lapsed'), removed: [SAT(1), SAT(2)],
    rows: [{ date: SAT(1), kind: 'series.add_date' }, { date: SAT(2), kind: 'series.add_date' }], blocked: null,
  },
  {
    key: 'paused-within-cap', about: 'paused / weekly until / 1 future rule date taken off',
    shape: takeOff('live-weekly-until', [SAT(2)], { lifecycle: 'paused' }), removed: [SAT(2)],
    rows: [{ date: SAT(2), kind: 'series.unskip_date' }], blocked: null,
  },
  {
    key: 'paused-over-cap', about: 'paused / weekly, end none / 1 future taken off / 39 listed',
    shape: takeOff('paused-weekly', [SAT(1)]), removed: [SAT(1)],
    rows: [{ date: SAT(1), kind: 'series.unskip_date' }], blocked: /most is 30/,
  },
  {
    key: 'ended-future', about: 'ended / no rule / many removed (1 past, 2 future)',
    shape: shapeByKey('ended-picnic'), removed: ['2026-08-01', SAT(2), SAT(1)],
    rows: [{ date: SAT(1), kind: 'series.add_date' }, { date: SAT(2), kind: 'series.add_date' }], blocked: /has ended.*Bachata Calendar team/,
  },
  { key: 'archived', about: 'archived / no rule / 0 removed', shape: shapeByKey('archived-norule-past'), removed: [], rows: [], blocked: null },
  { key: 'draft', about: 'draft / weekly / 0 removed', shape: shapeByKey('draft-weekly-nointerval'), removed: [], rows: [], blocked: null },
];

const raw = (c: Case) => {
  const w = workspaceOf(c.shape);
  w.series.series.removed_dates = c.removed as never[];
  return w;
};

let current: Case;
let commandError: { message: string } | null = null;
beforeEach(() => {
  rpc.mockReset();
  commandError = null;
  rpc.mockImplementation(async (fn: string) => {
    const s = current.shape;
    const next = upcomingOf(s).find((d) => d.status !== 'cancelled') ?? upcomingOf(s)[0];
    if (fn === 'series_command_p5' && commandError) return { data: null, error: commandError };
    const answers: Record<string, unknown> = {
      organiser_home_v1: homeOf([s]),
      admin_event_workspace_p5: raw(current),
      organiser_get_occurrence_programme_v1: next ? programmeOf(s, next) : null,
      get_organiser_venue_options_v1: VENUES,
      series_command_p5: { ok: true, new_version: 6 },
    };
    return fn in answers ? { data: answers[fn], error: null } : { data: null, error: { message: `unexpected ${fn}` } };
  });
});
afterEach(cleanup);

async function openEditor(c: Case) {
  current = c;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/account/o/events/${c.shape.id}`]}>
        <Routes>
          <Route path="/account/o/events/:seriesId" element={<EventEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return screen.findByTestId('org-event-editor');
}
const text = (el: Element) => el.textContent ?? '';

describe.each(CASES.map((c) => [c.key, c] as const))('shape %s', (_key, c) => {
  it(`shows exactly the future dates taken off (${c.about})`, async () => {
    const editor = await openEditor(c);
    const section = screen.queryByTestId('org-taken-off');
    if (!c.rows.length) {
      expect(section).toBeNull();
      expect(text(editor)).not.toMatch(/Dates taken off/);
      return;
    }
    expect(section).not.toBeNull();
    expect(text(section!)).toContain(`Dates taken off (${c.rows.length})`);
    const rows = within(section!).getAllByTestId('org-taken-off-row');
    expect(rows.map((r) => r.getAttribute('data-date'))).toEqual(c.rows.map((r) => r.date));
    // Never a past date, never a date that is listed already.
    rows.forEach((r) => expect(r.getAttribute('data-date')! >= TODAY).toBe(true));
  });

  it('Put back sends the existing command, or is disabled WITH a reason on screen', async () => {
    await openEditor(c);
    if (!c.rows.length) return;
    const buttons = screen.getAllByTestId('org-taken-off-put-back') as HTMLButtonElement[];
    if (c.blocked) {
      buttons.forEach((b) => expect(b.disabled).toBe(true));
      const reason = screen.getByTestId('org-taken-off-reason');
      expect(text(reason)).toMatch(c.blocked);
      buttons.forEach((b) => expect(b.getAttribute('aria-label')).toContain(text(reason)));
      fireEvent.click(buttons[0]);
      await new Promise((r) => setTimeout(r, 20));
      expect(commands()).toEqual([]);
      return;
    }
    expect(screen.queryByTestId('org-taken-off-reason')).toBeNull();
    buttons.forEach((b) => expect(b.disabled).toBe(false));
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0]).toEqual({ kind: c.rows[0].kind, payload: { date: c.rows[0].date } });
  });

  it('the pure view agrees with the screen (one mapping)', () => {
    const ws = parseEventWorkspace(raw(c));
    const lock = eventLock(ws.series.lifecycle_status);
    const view = takenOffView({ series: ws.series, dates: ws.dates, today: TODAY, lock, dirty: false, canChooseEnd: true });
    expect(view.rows.map((r) => ({ date: r.date, kind: r.command.kind }))).toEqual(c.rows);
    if (c.rows.length) expect(view.blocked === null).toBe(c.blocked === null);
  });
});

describe('Put back edge cases', () => {
  const within30 = CASES.find((c) => c.key === 'live-within-cap')!;

  it('is off while the editor holds unsaved edits, and says to save first', async () => {
    await openEditor(within30);
    fireEvent.change(screen.getByTestId('org-event-name'), { target: { value: 'Renamed' } });
    (screen.getAllByTestId('org-taken-off-put-back') as HTMLButtonElement[]).forEach((b) => expect(b.disabled).toBe(true));
    expect(text(screen.getByTestId('org-taken-off-reason'))).toMatch(/Save your changes first/);
  });

  it('a refused put back shows the server reason in plain words, on that row', async () => {
    await openEditor(within30);
    commandError = { message: 'date 2026-10-17 is not a date the recurrence rule produces' };
    fireEvent.click(screen.getAllByTestId('org-taken-off-put-back')[0]);
    const err = await screen.findByTestId('org-taken-off-error');
    expect(text(err)).toMatch(/weekly pattern changed.*Add it as a date instead/);
  });

  it('the cap: 29 listed leaves room for one, 30 does not; the reason says what to do', () => {
    expect(capBlock(29, true)).toBeNull();
    expect(capBlock(30, true)).toMatch(/^30 upcoming dates are listed and the most is 30.*earlier end in the Date card/);
    expect(capBlock(31, false)).toMatch(/Take another date off first/);
  });

  it('a series with no rule and every listed date cancelled still has room (cancelled dates are not listed)', () => {
    const base = shapeByKey('live-norule-cancelled-only');
    const ws = parseEventWorkspace({ ...workspaceOf(base), series: { ...workspaceOf(base).series, series: { ...workspaceOf(base).series.series, removed_dates: [SAT(5)] } } });
    expect(takenOffView({ series: ws.series, dates: ws.dates, today: TODAY, lock: null, dirty: false, canChooseEnd: false }).blocked).toBeNull();
  });
});

describe('copy that points at this section names it exactly', () => {
  it('the section is called "Dates taken off"', () => {
    expect(TAKEN_OFF_LABEL).toBe('Dates taken off');
  });
  it('the break sheet and the remove confirm point at it by that name, on the event page', () => {
    expect(PUT_BACK_WHERE).toContain(`"${TAKEN_OFF_LABEL}"`);
    expect(PUT_BACK_WHERE).toMatch(/event page/);
    expect(confirmCopy('remove_date', { subject: 'Sat 17 Oct' }).undo).toContain(`"${TAKEN_OFF_LABEL}" on the event page`);
  });
});
