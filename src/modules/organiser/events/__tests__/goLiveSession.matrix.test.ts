// Go live needs at least one session (owner 2026-10-20, prod "zz test"). D90: on
// the event page card the server owns the rule (series_go_live_check_v1 returns the
// `session` code), so the card shows the server's list and nothing beside it; the
// New event last step has no server check and keeps hasUpcomingSession.
// Table-driven over the draft shapes seen on prod.
import { describe, expect, it } from 'vitest';
import { parseEventWorkspace } from '../eventModel';
import * as life from '../lifecycleModel';
import { NO_SESSION_REASON, goLiveList, goLiveState, lifecycleRows } from '../lifecycleModel';
import { NO_SESSION_NEW_REASON, finishReason } from '../../flows/new/model';
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

describe('Go live needs a session: the New event last step (hasUpcomingSession)', () => {
  it.each(SHAPES)('$name', (s) => {
    const ws = parseWorkspace(ev(s));
    const reason = finishReason(!!s.series.default_cover_image_url, ws, TODAY, true);
    if (!s.series.default_cover_image_url) expect(reason).toBe('Choose a photo to go live.');
    else if (!s.session) expect(reason).toBe(NO_SESSION_NEW_REASON);
    else expect(reason).toBeNull();
  });
  it('the reason says what the person can do', () => {
    expect(NO_SESSION_NEW_REASON).toContain(NO_SESSION_REASON);
    expect(NO_SESSION_NEW_REASON).toContain('Save as draft, then add a session from the event.');
  });
  it('while the event loads the button is off with a reason', () => {
    expect(finishReason(true, null, TODAY, true)).toBeTruthy();
  });
});
