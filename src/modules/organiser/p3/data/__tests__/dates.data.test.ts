import { describe, expect, it, vi } from 'vitest';
import { commandErrorMessage } from '../../../shared/selfServeErrors';
import { OWNER_COMMAND_KINDS, OWNER_OVERRIDE_KEYS } from '../../../shared/seriesCommands';
import { parseDateDetail } from '../../../shared/seriesModel';
import { parseEventWorkspace } from '../../../events/eventModel';
import { L } from '../../model';
import { eventPageOf } from '../eventPage';
import {
  DATE_COPY, KeyRing, PLAN, PlanStepError, allDatesOf, emptyDatesCopy, dateEntries, planCommands, resetNormalPlan, sendPlan, seriesFactsOf, takenDays, undoFor,
  type DatePlan, type DateRunner,
} from '../dates';
import { TODAY, occ, weekly, ws, wsRaw } from '../../screens/__tests__/wsFixtures';

/*
 * W2b data: what every date action SENDS (the existing builders, exact JSON), the
 * composite "Put this date back to normal", the kept idempotency keys, the date-version
 * chain, the plain refusal copy, and the All dates lists (filters, breaks, "100 of N").
 */

const D = { id: 'o-2026-10-30', version: 3, occurrence_date: '2026-10-30' };

describe('every action sends ONE existing builder, an owner-admitted kind (prod allowlist 2026-10-27)', () => {
  const cases: Array<[string, DatePlan, unknown]> = [
    ['cancel', PLAN.cancel(D, 'Illness'), { to: 'date', occurrenceId: D.id, version: 3, commands: [{ kind: 'occurrence.cancel', payload: { cancelled: true, reason: 'Illness' } }] }],
    ['bringBack', PLAN.bringBack(D), { to: 'date', occurrenceId: D.id, version: 3, commands: [{ kind: 'occurrence.cancel', payload: { cancelled: false } }] }],
    ['move', PLAN.move(D, '2026-10-31'), { to: 'date', occurrenceId: D.id, version: 3, commands: [{ kind: 'occurrence.move_date', payload: { to_date: '2026-10-31' } }] }],
    ['time', PLAN.time(D, '21:00'), { to: 'date', occurrenceId: D.id, version: 3, commands: [{ kind: 'occurrence.set_time', payload: { new_local_start: '21:00', new_local_end: null } }] }],
    ['resetTime', PLAN.resetTime(D), { to: 'date', occurrenceId: D.id, version: 3, commands: [{ kind: 'occurrence.set_time', payload: { reset: true } }] }],
    ['details', PLAN.details(D, { ticket_url: ' https://t.example.test/x ' }), { to: 'date', occurrenceId: D.id, version: 3, commands: [{ kind: 'occurrence.set_override', payload: { ticket_url: 'https://t.example.test/x' } }] }],
    ['skip', PLAN.skip(D), { to: 'series', command: { kind: 'series.skip_date', payload: { occurrence_id: D.id } } }],
    ['unskip', PLAN.unskip('2026-11-13'), { to: 'series', command: { kind: 'series.unskip_date', payload: { date: '2026-11-13' } } }],
    ['add', PLAN.add('2026-12-04'), { to: 'series', command: { kind: 'series.add_date', payload: { date: '2026-12-04' } } }],
  ];
  it.each(cases)('%s', (_n, plan, json) => {
    expect(plan).toEqual(json);
    for (const c of planCommands(plan)) expect(OWNER_COMMAND_KINDS as readonly string[]).toContain(c.kind);
  });
  it('no plan deletes a date (owner answer 20): there is no remove plan', () => {
    expect(Object.keys(PLAN)).not.toContain('remove');
  });
  it('a details patch only carries owner override keys', () => {
    const p = PLAN.details(D, { venue_id: 'v2', city_id: 'c2', description: 'x', cover_image_url: 'https://x.test/a.webp' });
    for (const k of Object.keys(planCommands(p)[0].payload)) expect(OWNER_OVERRIDE_KEYS as readonly string[]).toContain(k);
  });
});

const detailRaw = (event: Record<string, unknown>, status = 'scheduled') =>
  parseDateDetail({ event, occurrence: { id: D.id, date: D.occurrence_date, version: 3, lifecycle_status: status }, schedule: {} });

describe('Put this date back to normal: the composite (CONTRACT 2), only what the date has', () => {
  it.each([
    ['venue only', { venue_id_override: 'v2' }, false, [{ kind: 'occurrence.set_override', payload: { venue_id: null, city_id: null } }]],
    ['every detail', { venue_id_override: 'v2', description_override: 'd', ticket_url_override: 't', cover_image_url_override: 'c' }, false,
      [{ kind: 'occurrence.set_override', payload: { venue_id: null, city_id: null, description: null, ticket_url: null, cover_image_url: null } }]],
    ['time only', {}, true, [{ kind: 'occurrence.set_time', payload: { reset: true } }]],
    ['details and time', { description_override: 'd' }, true, [{ kind: 'occurrence.set_override', payload: { description: null } }, { kind: 'occurrence.set_time', payload: { reset: true } }]],
  ] as Array<[string, Record<string, unknown>, boolean, unknown[]]>)('%s', (_n, ev, ownTime, commands) => {
    const plan = resetNormalPlan(D, detailRaw(ev), ownTime)!;
    expect(planCommands(plan)).toEqual(commands);
  });
  it('nothing of its own: nothing is sent (a cancellation reason is not a detail)', () => {
    expect(resetNormalPlan(D, detailRaw({ cancellation_reason_label: 'Illness' }, 'cancelled'), false)).toBeNull();
    expect(resetNormalPlan(D, null, false)).toBeNull();
  });
});

describe('sending: keys kept per plan, the date version chained', () => {
  it('the same plan reuses its keys (a retry is the same write); another plan is a new request; forget after success', () => {
    const ring = new KeyRing();
    const a = ring.for(PLAN.cancel(D, 'Illness'));
    expect(ring.for(PLAN.cancel(D, 'Illness'))).toEqual(a);
    expect(ring.for(PLAN.cancel(D, 'Weather'))).not.toEqual(a);
    ring.forget(PLAN.cancel(D, 'Illness'));
    expect(ring.for(PLAN.cancel(D, 'Illness'))).not.toEqual(a);
  });
  it('a retry after a dropped-but-committed response replays: the version moved, the keys did not (r1 finding 7)', async () => {
    const ring = new KeyRing();
    const sent: string[] = [];
    let attempt = 0;
    const run: DateRunner = {
      date: vi.fn(async (_id, _v, _c, k) => { sent.push(k); attempt += 1; if (attempt === 1) throw new TypeError('Failed to fetch'); return { ok: true, replayed: true }; }),
      series: vi.fn(),
    };
    const first = PLAN.cancel(D, 'Illness');
    await expect(sendPlan(first, ring.for(first), 7, run)).rejects.toThrow('Failed to fetch');
    // the workspace reload after the committed write bumps the date's version
    const retry = PLAN.cancel({ ...D, version: 4 }, 'Illness');
    await sendPlan(retry, ring.for(retry), 7, run);
    expect(sent[1]).toBe(sent[0]);
    expect(ring.for(PLAN.cancel({ ...D, id: 'o-other' }, 'Illness'))).not.toEqual(ring.for(first));
  });
  it('the composite: a refused SECOND call says the details went back and the time did not (r1 finding 8)', async () => {
    const plan = resetNormalPlan(D, detailRaw({ description_override: 'd' }), true)!;
    const refusal = Object.assign(new Error('invalid_payload: date_time_session_has_people: reset would drop a session with people'), { code: 'P0001' });
    const run: DateRunner = {
      date: vi.fn(async (_id, v, c) => { if (c.kind === 'occurrence.set_time') throw refusal; return { ok: true, new_version: (v ?? 0) + 1 }; }),
      series: vi.fn(),
    };
    const err = await sendPlan(plan, new KeyRing().for(plan), 7, run).catch((e) => e);
    expect(err).toBeInstanceOf(PlanStepError);
    expect(err.step).toBe(1);
    expect(err.message).toBe(`${DATE_COPY.halfReset} ${commandErrorMessage(refusal)}`);
    expect(commandErrorMessage(refusal)).not.toBe(commandErrorMessage(new Error('zz_unknown')));
    // a refused FIRST call is the plain refusal (nothing changed)
    const run1: DateRunner = { date: vi.fn(async () => { throw refusal; }), series: vi.fn() };
    const err1 = await sendPlan(plan, ['a', 'b'], 7, run1).catch((e) => e);
    expect(err1).toBe(refusal);
  });
  it('a composite: one key per command; the second goes against the version the first returned', async () => {
    const plan = resetNormalPlan(D, detailRaw({ description_override: 'd' }), true)!;
    const keys = new KeyRing().for(plan);
    expect(new Set(keys).size).toBe(2);
    const calls: unknown[] = [];
    const run: DateRunner = {
      date: vi.fn(async (id, v, c, k) => { calls.push([id, v, c.kind, k]); return { ok: true, new_version: (v ?? 0) + 1 }; }),
      series: vi.fn(),
    };
    await sendPlan(plan, keys, 7, run);
    expect(calls).toEqual([[D.id, 3, 'occurrence.set_override', keys[0]], [D.id, 4, 'occurrence.set_time', keys[1]]]);
    expect(run.series).not.toHaveBeenCalled();
  });
  it('a series command goes against the series version the page holds', async () => {
    const run: DateRunner = { date: vi.fn(), series: vi.fn(async () => ({ ok: true, new_version: 8 })) };
    await sendPlan(PLAN.skip(D), ['k1'], 7, run);
    expect(run.series).toHaveBeenCalledWith(7, { kind: 'series.skip_date', payload: { occurrence_id: D.id } }, 'k1');
  });
  it('undo: a cancel comes back with Bring it back on the date; a skip with Put this week back', () => {
    expect(undoFor('cancel', D, D.occurrence_date)).toEqual({ undo: { kind: 'occurrence.cancel', payload: { cancelled: false }, occurrence: { id: D.id, version: 0 } }, undoLabel: L.bringItBack });
    expect(undoFor('skip', D, D.occurrence_date)).toEqual({ undo: { kind: 'series.unskip_date', payload: { date: D.occurrence_date } } });
    expect(undoFor('move', D, D.occurrence_date)).toEqual({ undo: null });
  });
});

describe('every date refusal reads as plain copy (handlers read on prod 2026-10-27), never server text', () => {
  const GENERIC = commandErrorMessage(new Error('zz_unknown'));
  it.each([
    'version_conflict: expected 3, found 4',
    'invalid_transition: date_taken: this event already has a date on 2026-10-31',
    'invalid_transition: move_date needs a scheduled date (this one is cancelled)',
    'invalid_payload: move_date is not supported for festivals',
    'invalid_payload: per-date time is not supported for festivals',
    'invalid_payload: new_local_start required',
    'no_sessions_for_time_override: this date has no sessions; add one in the date editor first (occurrence_id=x)',
    'permission_denied: occurrence.cancel on a past date is admin-only',
    'past_date: occurrence x on 2026-10-01 is already past and cannot be made a break',
    'has_bookings: occurrence x on 2026-10-30 has attendance or guest-list entries and cannot be made a break (cancel it instead)',
    'has_bookings: occurrence x on 2026-10-30 has attendance or guest-list entries and cannot be deleted (cancel it instead)',
    'invalid_payload: date_time_session_has_people: this date\'s own time session has people on it',
    'invalid_transition: 2026-11-13 is not a break on series x (nothing to restore)',
    'invalid_transition: 2026-11-14 is not a date the recurrence rule of series x generates -- the rule changed',
    'invalid_payload: cancellation reason must be one of: Illness, Weather',
    'permission_denied: date_cap: this series already has 30 upcoming dates (cap 30); remove or cancel one before adding another',
    'invalid_transition: festival_extra_date: this festival already runs on 2026-11-20, and a festival holds ONE date',
    'invalid_payload: date required',
    'permission_denied: occurrence.set_time on an ended series is admin-only',
    'not_found: occurrence x does not exist',
  ])('%s', (message) => {
    const copy = commandErrorMessage(Object.assign(new Error(message), { code: 'P0001' }));
    expect(copy).not.toBe(GENERIC);
    expect(copy).not.toContain(message.slice(0, 20));
    expect(copy).not.toMatch(/[a-z]+_[a-z]+/);
  });
});

describe('All dates: filters, breaks, the honest cap', () => {
  it('weekly: counts per filter; a cancelled and an own-changes date; the same tags as the Coming rows', () => {
    const w = ws('weekly');
    const v = allDatesOf(w, TODAY, 'coming');
    expect(v.counts).toEqual({ coming: 10, past: 2, cancelled: 1, breaks: 0, own: 1 });
    const page = eventPageOf(w, TODAY);
    for (const c of page.coming) expect(v.rows.find((r) => r.id === c.id)!.tags).toEqual(c.tags);
    expect(allDatesOf(w, TODAY, 'past').rows.map((r) => [r.date, r.tags])).toEqual([['2026-10-23', [L.done]], ['2026-10-16', [L.done]]]);
  });
  it('every break is listed (p3-prefix-c), an off-cadence tombstone too: its Put this week back says why it cannot', () => {
    const w = parseEventWorkspace(wsRaw({ removed_dates: ['2026-11-20', '2026-11-18'] }, [], weekly('2026-10-30', 3).map((d) => occ(d))));
    const breaks = allDatesOf(w, TODAY, 'breaks').rows;
    expect(breaks.map((b) => [b.id, b.date, b.facts.state, b.tags])).toEqual([[null, '2026-11-18', 'skip', [L.skipped]], [null, '2026-11-20', 'skip', [L.skipped]]]);
    expect(breaks.map((b) => b.facts.ruleDate)).toEqual([false, true]);
  });
  it('over 100: the newest 100 of 131, said honestly; nothing paged from a second read', () => {
    const w = ws('over100');
    const all = dateEntries(w, TODAY);
    expect(all).toHaveLength(100);
    expect(eventPageOf(w, TODAY).partial).toBe('This page lists the newest 100 of 131 dates.');
  });
  it.each([0, 2, 12, 40] as const)('list size %s: every stored date is one row, soonest first', (n) => {
    const w = parseEventWorkspace(wsRaw({}, [], weekly('2026-10-30', n).map((d) => occ(d))));
    const rows = allDatesOf(w, TODAY, 'coming').rows;
    expect(rows).toHaveLength(n);
    expect(rows.map((r) => r.date)).toEqual([...rows.map((r) => r.date)].sort());
    expect(seriesFactsOf(w, TODAY).upcoming).toBe(n);
  });
  it('a stored day (cancelled too) is taken for Move and Add', () => {
    expect(takenDays(ws('weekly')).has('2026-11-06')).toBe(true);
  });
  it('has_bookings on a skip says skipped, on a delete says removed (r1 finding 9)', () => {
    const msg = (m: string) => commandErrorMessage(Object.assign(new Error(m), { code: 'P0001' }));
    expect(msg('has_bookings: occurrence x on 2026-10-30 has attendance or guest-list entries and cannot be made a break (cancel it instead)')).toContain('cannot be skipped');
    expect(msg('has_bookings: occurrence x on 2026-10-30 has attendance or guest-list entries and cannot be deleted (cancel it instead)')).toContain('cannot be removed');
  });
  it('recurring with recurrence_rule null and weekly dates: no date is tagged Not the usual day, each is on the dates pattern (r1 finding 5, p3-prefix-c)', () => {
    const w = parseEventWorkspace(wsRaw({ recurrence_rule: null }, [], weekly('2026-10-30', 3).map((d) => occ(d))));
    const rows = allDatesOf(w, TODAY, 'coming').rows;
    expect(rows).toHaveLength(3);
    for (const r of rows) { expect(r.tags).toEqual([]); expect(r.facts.ruleDate).toBe(true); }
  });
  it('empty states never point at a greyed control (r1 finding 6)', () => {
    const oneoff = parseEventWorkspace(wsRaw({ format: 'one_off', recurrence_rule: null }, [], [occ('2026-10-16')]));
    expect(emptyDatesCopy(oneoff, TODAY, 'coming')).not.toMatch(/Add a date so/);
    expect(emptyDatesCopy(oneoff, TODAY, 'coming')).toContain('A one-off has one date');
    expect(emptyDatesCopy(ws('weekly'), TODAY, 'coming')).toMatch(/Add a date so/);
    expect(emptyDatesCopy(ws('weekly'), TODAY, 'breaks')).toMatch(/Skip a week/);
    for (const series of [{ format: 'one_off', recurrence_rule: null }, { format: 'festival', recurrence_rule: null },
      { recurrence_rule: { mode: 'monthly' } }, { recurrence_rule: { mode: 'custom' } }, { recurrence_rule: null }]) {
      const w = parseEventWorkspace(wsRaw(series, [], [occ('2026-10-30')]));
      expect(emptyDatesCopy(w, TODAY, 'breaks')).not.toMatch(/skip a week/i);
      expect(emptyDatesCopy(w, TODAY, 'breaks')).toMatch(/^No break weeks\./);
    }
  });
  it('the cancelled body names the reason dancers see', () => {
    expect(DATE_COPY.cancelledBody('Illness')).toContain('Cancelled: Illness');
    expect(DATE_COPY.cancelledBody(null)).not.toContain(':');
  });
});
