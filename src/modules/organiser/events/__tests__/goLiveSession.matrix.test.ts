// Go live needs at least one session (owner 2026-10-20, prod "zz test"). D90: on
// the event page card the server owns the rule (series_go_live_check_v1 returns the
// `session` code), so the card shows the server's list and nothing beside it. D91:
// the New event last step reads the same server answer (no client session rule).
// Table-driven over the draft shapes seen on prod.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEventWorkspace } from '../eventModel';
import * as life from '../lifecycleModel';
import { NO_SESSION_REASON, goLiveList, goLiveState, lifecycleRows } from '../lifecycleModel';
import { CHECKING_REASON, NOT_READY_REASON, NO_SESSION_NEW_REASON, finishReason, serverCheckOf } from '../../flows/new/model';
import { GO_LIVE_LABEL, type GoLiveCheck } from '../../shared/goLiveCheck';
import { parseWorkspace } from '../../shared/seriesModel';
import { ORG_PATHS } from '../../shell/paths';
import { rawWorkspace } from './fixtures';

const TODAY = '2026-10-20';
const COVER = 'https://x/c.jpg';
const PROGRAM = [{ day: { id: 'd' }, sections: [{ section: { id: 's' }, items: [{ item: { id: 'i', start_time: '20:00:00' }, people: [] }] }] }];
const occ = (id: string, date: string, extra: Record<string, unknown> = {}) =>
  ({ id, occurrence_date: date, lifecycle_status: 'scheduled', version: 1, has_override: false, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null, ...extra });

interface Shape { name: string; series: Record<string, unknown>; program: unknown[]; dates: unknown[]; session: boolean }
const base = { lifecycle_status: 'draft', default_venue_id: 'v1', default_cover_image_url: COVER, default_start_date: '2026-11-17' };
const SHAPES: Shape[] = [
  { name: 'zz test: one_off, date, flyer, venue, NO session', series: { ...base, format: 'one_off', recurrence_rule: null }, program: [], dates: [occ('o1', '2026-11-17')], session: false },
  { name: 'weekly series with a programme session', series: base, program: PROGRAM, dates: [occ('o1', '2026-11-17')], session: true },
  { name: 'session added to a future date only', series: base, program: [], dates: [occ('o1', '2026-11-17', { added_sessions_count: 1 })], session: true },
  { name: 'session added only on a PAST date', series: base, program: [], dates: [occ('o0', '2026-10-01', { added_sessions_count: 1 }), occ('o1', '2026-11-17')], session: false },
  { name: 'session added only on a CANCELLED date', series: base, program: [], dates: [occ('o1', '2026-11-17', { added_sessions_count: 1, lifecycle_status: 'cancelled' })], session: false },
  { name: 'programme session but every date cancelled', series: base, program: PROGRAM, dates: [occ('o1', '2026-11-17', { lifecycle_status: 'cancelled' })], session: false },
  { name: 'session + no cover', series: { ...base, default_cover_image_url: null }, program: PROGRAM, dates: [occ('o1', '2026-11-17')], session: true },
  { name: 'session + no date', series: { ...base, default_start_date: '2026-01-01' }, program: PROGRAM, dates: [], session: false },
];

const ev = (s: Shape) => {
  const raw = rawWorkspace(s.series, s.dates);
  raw.series.program = s.program as never[];
  return raw;
};

const OPEN = { locked: false, reason: null };
const answer = (codes: [string, string][]): GoLiveCheck => ({
  ready: codes.length === 0,
  eventMissing: codes.map(([code, section]) => ({ code, section })),
  recommended: [],
  profileRuleApplies: false,
  profileMissing: [],
});
const SESSION: [string, string] = ['session', 'programme'];

describe('Go live needs a session: the event page card reads the server list (D90)', () => {
  it('the card has no client session rule beside the server list', () => {
    const exported = life as Record<string, unknown>;
    for (const gone of ['goLiveMissing', 'goLiveReason', 'MISSING_SESSION']) expect(exported[gone]).toBeUndefined();
  });

  it.each(SHAPES)('$name: the draft row carries no client reason; the server decides', (s) => {
    expect(lifecycleRows(parseEventWorkspace(ev(s)), TODAY).goLive).toEqual({ reason: null });
  });

  it('server says session missing: Go live is off, and the one session row opens the programme', () => {
    const check = answer([SESSION]);
    expect(goLiveState(check, 's1', OPEN, true)).toEqual({ kind: 'fix', left: 1 });
    const { missing } = goLiveList(check, 's1');
    expect(missing).toHaveLength(1);
    expect(missing[0].label).toBe(GO_LIVE_LABEL.session);
    expect(missing[0].href?.startsWith(ORG_PATHS.eventProgramme('s1'))).toBe(true);
  });

  it('session sits in the server order with the rest, counted once', () => {
    const check = answer([['venue', 'venue'], SESSION, ['cover', 'cover']]);
    expect(goLiveList(check, 's1').missing.map((l) => l.code)).toEqual(['venue', 'session', 'cover']);
    expect(goLiveState(check, 's1', OPEN, true)).toEqual({ kind: 'fix', left: 3 });
  });

  it('server says ready: Go live sends', () => {
    expect(goLiveState(answer([]), 's1', OPEN, true)).toEqual({ kind: 'send' });
  });
});

describe('Go live needs a session: the New event last step reads the server answer (D91)', () => {
  it.each(SHAPES)('$name', (s) => {
    // The server lists `session` exactly when there is none (the event card's own fixture rule above).
    const check = answer(s.session ? [] : [SESSION]);
    const reason = finishReason(!!s.series.default_cover_image_url, { status: 'ready', check }, true);
    if (!s.series.default_cover_image_url) expect(reason).toBe('Choose a photo to go live.');
    else if (!s.session) expect(reason).toBe(NO_SESSION_NEW_REASON);
    else expect(reason).toBeNull();
  });
  it('the session reason wins over the rest of the server list', () => {
    expect(finishReason(true, { status: 'ready', check: answer([['venue', 'venue'], SESSION]) }, true)).toBe(NO_SESSION_NEW_REASON);
  });
  it('another blocker reads its one label; an empty not-ready list still says what to do', () => {
    expect(finishReason(true, { status: 'ready', check: answer([['venue', 'venue']]) }, true)).toBe(`${GO_LIVE_LABEL.venue} first.`);
    expect(finishReason(true, { status: 'ready', check: { ...answer([]), ready: false } }, true)).toBe(NOT_READY_REASON);
  });
  it('a check that could not be read never blocks (the server still refuses)', () => {
    expect(finishReason(true, { status: 'error' }, true)).toBeNull();
  });
  it('the step has no client session rule of its own', () => {
    const src = readFileSync(join(__dirname, '../../flows/new/model.ts'), 'utf8');
    expect(src).not.toMatch(/hasUpcomingSession/);
  });
  it('the reason says what the person can do', () => {
    expect(NO_SESSION_NEW_REASON).toContain(NO_SESSION_REASON);
    expect(NO_SESSION_NEW_REASON).toContain('Save as draft, then add a session from the event.');
  });
  it('while the check loads the button is off with a reason', () => {
    expect(finishReason(true, { status: 'pending' }, true)).toBe(CHECKING_REASON);
  });
  // N1 (review of Release B): after an upload the cached answer still lists `cover` until the refetch lands.
  it('a flyer is on the step: an answer that still lists cover never names the flyer', () => {
    const flyer = `${GO_LIVE_LABEL.cover} first.`;
    expect(finishReason(true, { status: 'ready', check: answer([['cover', 'cover']]) }, true)).not.toBe(flyer);
    expect(finishReason(true, { status: 'ready', check: answer([['cover', 'cover'], ['venue', 'venue']]) }, true)).toBe(`${GO_LIVE_LABEL.venue} first.`);
    // No flyer yet: the step's own photo reason, as before.
    expect(finishReason(false, { status: 'ready', check: answer([['cover', 'cover']]) }, true)).toBe('Choose a photo to go live.');
  });
  it('the check refetching after the upload reads as checking, never as the old answer', () => {
    const stale = answer([['cover', 'cover']]);
    expect(serverCheckOf({ isError: false, isFetching: true, data: stale })).toEqual({ status: 'pending' });
    expect(finishReason(true, serverCheckOf({ isError: false, isFetching: true, data: stale }), true)).toBe(CHECKING_REASON);
    expect(serverCheckOf({ isError: false, isFetching: false, data: stale })).toEqual({ status: 'ready', check: stale });
    expect(serverCheckOf({ isError: true, isFetching: false, data: undefined })).toEqual({ status: 'error' });
    expect(serverCheckOf({ isError: false, isFetching: false, data: undefined })).toEqual({ status: 'pending' });
  });
});
