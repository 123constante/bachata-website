// @vitest-environment jsdom
/**
 * S3 Add a date (plan 4.5 Flows + Consistency, boards C7 -> C8 -> C9 -> Done,
 * no Undo) and the no dates left fix (C15, D6/R3-3): the path sends exactly
 * ONE series.add_date with the series' expected_version; the day list leaves
 * out every day that already holds a date and disables capped days with the
 * reason on screen; the one-event organiser skips "which event"; a past day
 * is refused with eventState.ts:75 verbatim; version_conflict shows R3-7.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Route } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import AddFlow from '../index';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { VERSION_CONFLICT } from '@/modules/organiser/shared/copy';
import { CAP_NOTE } from '@/modules/organiser/events/dateCap';
import { homeJobs } from '@/modules/organiser/jobs/homeJobs';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import {
  A, EMPTY, FROZEN, NEW_OCC, PAUSED, answer, commandsOf, day, defaultWorld, DoneProbe, flush, home, line75, mount,
  series, today, tooSmall, type World,
} from './fixtures';

const read = (p: string) => readFileSync(resolve(__dirname, '../../../../../..', p), 'utf8');

let world: World;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);
  rpc.mockReset();
  world = defaultWorld();
  answer(rpc, () => world);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const routes = (
  <>
    <Route path="/account/o/add" element={<AddFlow step="event" />} />
    <Route path="/account/o/add/:seriesId" element={<AddFlow step="day" />} />
    <Route path="/account/o/add/:seriesId/:date" element={<AddFlow step="time" />} />
    <Route path="/account/o/done" element={<DoneProbe />} />
  </>
);
const where = () => screen.getByTestId('where').textContent;

describe('C7 which event', () => {
  it('lists the live and draft events (the Home Add row\'s own rule), never a paused one; tap advances', async () => {
    mount(ORG_PATHS.add, routes);
    const list = await screen.findByTestId('add-which-event');
    const names = within(list).getAllByTestId('add-event-row').map((r) => r.textContent);
    expect(names.some((n) => n?.includes('Friday Social'))).toBe(true);
    expect(names.some((n) => n?.includes('Sunday Class'))).toBe(true);
    expect(names.some((n) => n?.includes('Old Draft'))).toBe(true);
    expect(names.some((n) => n?.includes('Paused Night'))).toBe(false);
    fireEvent.click(within(list).getAllByTestId('add-event-row')[0]);
    await waitFor(() => expect(where()).toBe(ORG_PATHS.addEvent(A)));
  });

  it('the one-event organiser skips straight to the days (D34)', async () => {
    world.series = [world.series[0], world.series[3]]; // Friday Social + a paused one
    mount(ORG_PATHS.add, routes);
    await waitFor(() => expect(where()).toBe(ORG_PATHS.addEvent(A)));
  });
});

describe('C8 which day', () => {
  it('is titled with the event, shows 30 days minus every day holding a date (scheduled, cancelled, past-listed)', async () => {
    mount(ORG_PATHS.addEvent(A), routes);
    const list = await screen.findByTestId('add-which-day');
    expect(screen.getByRole('heading', { name: 'Friday Social' })).toBeTruthy();
    const rows = within(list).getAllByTestId('add-day-row');
    expect(rows).toHaveLength(30 - 3); // 23 Oct, 30 Oct, 6 Nov (cancelled) are held
    const text = rows.map((r) => r.textContent ?? '');
    expect(text.some((t) => t.includes('Friday 23 October'))).toBe(false);
    expect(text.some((t) => t.includes('Friday 30 October'))).toBe(false);
    expect(text.some((t) => t.includes('Friday 6 November'))).toBe(false);
    expect(text.some((t) => t.includes('Tuesday 27 October'))).toBe(true);
    expect(text[0]).toContain('Tuesday 20 October');
    fireEvent.click(rows.find((r) => r.textContent?.includes('Tuesday 27 October')) as HTMLElement);
    await waitFor(() => expect(where()).toBe(ORG_PATHS.addDate(A, day(7))));
    expect(commandsOf(rpc)).toHaveLength(0);
  });

  it('at the 30-date cap every day is aria-disabled with the reason as a visible sub-line, and a tap goes nowhere', async () => {
    world.occs[A] = Array.from({ length: 30 }, (_, i) => ({ id: `cap${i}`, date: day(40 + i), status: 'scheduled', version: 1 }));
    mount(ORG_PATHS.addEvent(A), routes);
    const list = await screen.findByTestId('add-which-day');
    const rows = within(list).getAllByTestId('add-day-row');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.getAttribute('aria-disabled')).toBe('true');
      expect(r.textContent).toContain(CAP_NOTE);
    }
    fireEvent.click(rows[0]);
    await flush();
    expect(where()).toBe(ORG_PATHS.addEvent(A));
  });

  it('a paused event reached by URL is refused, with one way Home', async () => {
    mount(ORG_PATHS.addEvent(PAUSED), routes);
    expect(await screen.findByTestId('add-refusal')).toBeTruthy();
    expect(screen.queryByTestId('add-which-day')).toBeNull();
  });

  it('every control is at least 44px', async () => {
    const { container } = mount(ORG_PATHS.addEvent(A), routes);
    await screen.findByTestId('add-which-day');
    expect(tooSmall(container)).toEqual([]);
  });
});

describe('C9 time, then ONE command', () => {
  it('prefills the usual time; Save sends exactly ONE series.add_date (target the series, its version); Done reads the D29 line', async () => {
    const { container } = mount(ORG_PATHS.addDate(A, day(7)), routes);
    const input = (await screen.findByTestId('add-time-input')) as HTMLInputElement;
    expect(input.value).toBe('20:00');
    expect(tooSmall(container)).toEqual([]);
    fireEvent.click(screen.getByTestId('add-save'));
    await waitFor(() => expect(screen.getByTestId('done-probe').textContent).toBe('Added|Added - Tuesday 27 October, 20:00|'));
    const sent = commandsOf(rpc);
    expect(sent).toHaveLength(1);
    expect(sent[0].fn).toBe('series_command_p5');
    expect(sent[0].env.target_id).toBe(A);
    expect(sent[0].env.expected_version).toBe(9);
    expect(sent[0].env.command).toEqual({ kind: 'series.add_date', payload: { date: day(7) } });
    expect(sent[0].env.idempotency_key).toMatch(/[0-9a-f-]{36}/);
  });

  it('a different time rides on the new date (occurrence.set_time on the date the add returned, its own version)', async () => {
    const base = world.command;
    // The server makes the date on add_date; set_time then finds it (version 1).
    world.command = (fn, env) => {
      if ((env as { command: { kind: string } }).command.kind === 'series.add_date') world.occs[A].push({ id: NEW_OCC, date: day(7), status: 'scheduled', version: 1 });
      return base(fn, env);
    };
    mount(ORG_PATHS.addDate(A, day(7)), routes);
    fireEvent.change(await screen.findByTestId('add-time-input'), { target: { value: '19:30' } });
    fireEvent.click(screen.getByTestId('add-save'));
    await waitFor(() => expect(screen.getByTestId('done-probe').textContent).toBe('Added|Added - Tuesday 27 October, 19:30|'));
    const sent = commandsOf(rpc);
    expect(sent.map((s) => s.env.command.kind)).toEqual(['series.add_date', 'occurrence.set_time']);
    expect(sent[1].fn).toBe('occurrence_command_p5');
    expect(sent[1].env.target_id).toBe(NEW_OCC);
    expect(sent[1].env.expected_version).toBe(1);
    expect(sent[1].env.command.payload).toMatchObject({ new_local_start: '19:30' });
  });

  it('a past day is refused with eventState.ts:75 verbatim and sends nothing', async () => {
    mount(ORG_PATHS.addDate(A, day(-2)), routes);
    const refusal = await screen.findByTestId('add-refusal');
    expect(refusal.textContent).toContain(line75(read));
    expect(screen.queryByTestId('add-save')).toBeNull();
    expect(commandsOf(rpc)).toHaveLength(0);
  });

  it('a day that already holds a date is refused, not added twice', async () => {
    mount(ORG_PATHS.addDate(A, day(3)), routes);
    expect(await screen.findByTestId('add-refusal')).toBeTruthy();
    expect(screen.queryByTestId('add-save')).toBeNull();
  });

  it('version_conflict shows the R3-7 line with one way to the event, and no Done', async () => {
    world.command = () => ({ data: null, error: { message: 'version_conflict: expected 9 got 10' } });
    mount(ORG_PATHS.addDate(A, day(7)), routes);
    fireEvent.click(await screen.findByTestId('add-save'));
    const box = await screen.findByTestId('add-conflict');
    expect(box.textContent).toContain(VERSION_CONFLICT);
    expect(within(box).getAllByRole('button')).toHaveLength(1);
    fireEvent.click(within(box).getByRole('button'));
    await waitFor(() => expect(where()).toBe(ORG_PATHS.event(A)));
  });

  it('a retry after a lost reply reuses the idempotency key', async () => {
    let n = 0;
    world.command = () => (n++ === 0 ? { data: null, error: { message: 'Failed to fetch' } } : { data: { ok: true, new_version: 10 }, error: null });
    mount(ORG_PATHS.addDate(A, day(7)), routes);
    fireEvent.click(await screen.findByTestId('add-save'));
    await screen.findByTestId('add-error-message');
    fireEvent.click(screen.getByTestId('add-save'));
    await screen.findByTestId('done-probe');
    const sent = commandsOf(rpc);
    expect(sent).toHaveLength(2);
    expect(sent[1].env.idempotency_key).toBe(sent[0].env.idempotency_key);
  });
});

describe('C15 no dates left (D6, R3-3): the Home row is the add flow with the event pre-chosen', () => {
  it('Home row -> that event\'s days -> ONE add -> Done; the next Home has no row', async () => {
    world.series.push(series(EMPTY, 'Empty Night', [
      { id: 'ox', date: day(2), status: 'cancelled', version: 4 }, // every coming date cancelled: still no dates left
    ]));
    const before = homeJobs(home(world).organisers[0] as unknown as HomeOrganiser, [], today());
    const row = before.find((j) => j.kind === 'no_dates_left');
    expect(row?.to).toBe(ORG_PATHS.addEvent(EMPTY));

    mount(row?.to as string, routes);
    expect(await screen.findByRole('heading', { name: 'Empty Night' })).toBeTruthy();
    const rows = within(await screen.findByTestId('add-which-day')).getAllByTestId('add-day-row');
    fireEvent.click(rows.find((r) => r.textContent?.includes('Tuesday 27 October')) as HTMLElement);
    fireEvent.click(await screen.findByTestId('add-save'));
    await screen.findByTestId('done-probe');
    expect(commandsOf(rpc).map((c) => [c.env.target_id, c.env.command.kind])).toEqual([[EMPTY, 'series.add_date']]);

    // The server now holds the added date: the next Home read carries it.
    world.occs[EMPTY] = [{ id: NEW_OCC, date: day(7), status: 'scheduled', version: 1 }];
    world.series[world.series.length - 1] = series(EMPTY, 'Empty Night', world.occs[EMPTY]);
    const after = homeJobs(home(world).organisers[0] as unknown as HomeOrganiser, [], today());
    expect(after.some((j) => j.kind === 'no_dates_left')).toBe(false);
  });

});
