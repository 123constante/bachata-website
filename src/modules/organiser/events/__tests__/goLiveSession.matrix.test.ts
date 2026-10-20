// Go live needs at least one session (owner 2026-10-20, prod "zz test"): ONE rule
// (hasUpcomingSession) behind both Go live buttons, the event page card and the
// New event last step. Table-driven over the draft shapes seen on prod.
import { describe, expect, it } from 'vitest';
import { parseEventWorkspace } from '../eventModel';
import { NO_SESSION_REASON, goLiveMissing, goLiveReason, lifecycleRows } from '../lifecycleModel';
import { NO_SESSION_NEW_REASON, finishReason } from '../../flows/new/model';
import { parseWorkspace } from '../../shared/seriesModel';
import { rawWorkspace } from './fixtures';

const TODAY = '2026-10-20';
const COVER = 'https://x/c.jpg';
const PROGRAM = [{ day: { id: 'd' }, sections: [{ section: { id: 's' }, items: [{ item: { id: 'i', start_time: '20:00:00' }, people: [] }] }] }];
const occ = (id: string, date: string, extra: Record<string, unknown> = {}) =>
  ({ id, occurrence_date: date, lifecycle_status: 'scheduled', version: 1, has_override: false, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null, ...extra });

interface Shape { name: string; series: Record<string, unknown>; program: unknown[]; dates: unknown[]; session: boolean; onlyMissing?: string; dateFirst?: boolean }
const base = { lifecycle_status: 'draft', default_venue_id: 'v1', default_cover_image_url: COVER, default_start_date: '2026-11-17' };
const SHAPES: Shape[] = [
  { name: 'zz test: one_off, date, flyer, venue, NO session', series: { ...base, format: 'one_off', recurrence_rule: null }, program: [], dates: [occ('o1', '2026-11-17')], session: false },
  { name: 'weekly series with a programme session', series: base, program: PROGRAM, dates: [occ('o1', '2026-11-17')], session: true },
  { name: 'session added to a future date only', series: base, program: [], dates: [occ('o1', '2026-11-17', { added_sessions_count: 1 })], session: true },
  { name: 'session added only on a PAST date', series: base, program: [], dates: [occ('o0', '2026-10-01', { added_sessions_count: 1 }), occ('o1', '2026-11-17')], session: false },
  { name: 'session added only on a CANCELLED date', series: base, program: [], dates: [occ('o1', '2026-11-17', { added_sessions_count: 1, lifecycle_status: 'cancelled' })], session: false },
  { name: 'programme session but every date cancelled', series: base, program: PROGRAM, dates: [occ('o1', '2026-11-17', { lifecycle_status: 'cancelled' })], session: false },
  { name: 'session + no cover', series: { ...base, default_cover_image_url: null }, program: PROGRAM, dates: [occ('o1', '2026-11-17')], session: true, onlyMissing: 'a flyer' },
  { name: 'session + no date', series: { ...base, default_start_date: '2026-01-01' }, program: PROGRAM, dates: [], session: false, onlyMissing: 'a date from today on', dateFirst: true },
];

const ev = (s: Shape) => {
  const raw = rawWorkspace(s.series, s.dates);
  raw.series.program = s.program as never[];
  return raw;
};

describe('Go live needs a session: the event page card', () => {
  it.each(SHAPES)('$name', (s) => {
    const ws = parseEventWorkspace(ev(s));
    const missing = goLiveMissing(ws, TODAY);
    expect(missing.includes('at least one session')).toBe(!s.session && !s.dateFirst);
    const reason = goLiveReason(ws, TODAY, true);
    const row = lifecycleRows(ws, TODAY, true).goLive;
    if (s.dateFirst) {
      expect(reason).not.toContain(NO_SESSION_REASON);
    } else if (!s.session) {
      expect(reason).toContain(NO_SESSION_REASON);
      expect(row?.toProgramme).toBe(true);
    } else if (s.onlyMissing) {
      expect(reason).not.toContain(NO_SESSION_REASON);
    } else {
      expect(reason).toBeNull();
    }
  });
  it('session is the last item, after name/venue/flyer; never asked for before a date exists', () => {
    const noSession = parseEventWorkspace(rawWorkspace({ lifecycle_status: 'draft', default_venue_id: null, default_cover_image_url: null }, [occ('o1', '2026-11-17')]));
    expect(goLiveMissing(noSession, TODAY)).toEqual(['a venue', 'a flyer', 'at least one session']);
    const noDate = parseEventWorkspace(rawWorkspace({ lifecycle_status: 'draft', default_start_date: null }, []));
    expect(goLiveMissing(noDate, TODAY)).not.toContain('at least one session');
  });
});

describe('Go live needs a session: the New event last step (same rule)', () => {
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
