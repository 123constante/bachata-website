// ER-FIX2-S2: audit findings F-C4-1/2/3/6/9 on the model, table-tested over the
// stored prod shapes (owner decision 3: untimed is VALID; block only a half-filled
// time or an end before the start, next-day pairs are fine).
import { describe, expect, it } from 'vitest';
import rules from '../../shared/event-rules.json';
import {
  LAST_SESSION_REASON,
  NO_SET_TIME,
  PICK_END,
  capReason,
  endOptions,
  fromStored,
  kindLabel,
  newSession,
  sessionIssues,
  setStart,
  startOptions,
  toStored,
  type SessionDraft,
  type StoredSessionRow,
} from '../sessionsModel';

const row = (patch: Partial<StoredSessionRow>): StoredSessionRow => ({
  id: 'r1', type: 'party', title: null, start_time: '21:00:00', end_time: '02:00:00', room: null, level_keys: null, ...patch,
});

const TIMES = rules.blockers.sessionTimes;

// stored start / end -> the reasons the card shows
const SHAPES: { name: string; start: string | null; end: string | null; issues: string[] }[] = [
  { name: 'untimed (223 prod rows): valid, no reason', start: null, end: null, issues: [] },
  { name: 'timed same night', start: '20:00:00', end: '23:00:00', issues: [] },
  { name: 'next-day pair', start: '22:00:00', end: '03:00:00', issues: [] },
  { name: 'start only (half-filled)', start: '20:00:00', end: null, issues: [TIMES] },
  { name: 'end only (half-filled)', start: null, end: '23:00:00', issues: ['Pick a start time'] },
  { name: 'end equal to the start', start: '20:00:00', end: '20:00:00', issues: [TIMES] },
  { name: 'over the 12 h cap: kept, not a bad pair', start: '19:00:00', end: '08:00:00', issues: ['Over 12 hours'] },
];

describe('F-C4-1: untimed is a state, not an issue', () => {
  it.each(SHAPES)('$name', ({ start, end, issues }) => {
    for (const type of ['party', 'class'] as const) {
      const d = fromStored(row({ type, start_time: start, end_time: end }));
      expect(sessionIssues(d).map((i) => i.reason)).toEqual(issues);
    }
  });
  it('a new session with no set time has no issue either', () => {
    expect(sessionIssues(newSession('party', '', 'n'))).toEqual([]);
  });
});

describe('F-C4-2: a way back to "No set time"', () => {
  it('Start always offers "No set time" first, timed or not', () => {
    expect(startOptions('20:00')[0]).toEqual({ value: '', label: NO_SET_TIME, nextDay: false });
    expect(startOptions('')[0]).toEqual({ value: '', label: NO_SET_TIME, nextDay: false });
    expect(NO_SET_TIME).toBe('No set time');
  });
  it('picking it clears start and end; it saves as an untimed row', () => {
    const d = setStart(fromStored(row({})), '');
    expect(d).toMatchObject({ start: '', end: '' });
    expect(toStored(d)).toMatchObject({ start_time: null, end_time: null });
  });
});

describe('F-C4-3: start set, end null', () => {
  const d = fromStored(row({ start_time: '20:00:00', end_time: null }));
  it('loads with the start kept and no end (nothing invented)', () => {
    expect(d).toMatchObject({ start: '20:00', end: '' });
    expect(toStored(d)).toMatchObject({ start_time: '20:00', end_time: null });
  });
  it('the end list opens on a "Pick an end" placeholder, not a false first time', () => {
    const o = endOptions(d.start, d.end);
    expect(o[0]).toEqual({ value: '', label: PICK_END, nextDay: false });
    expect(o.slice(1).some((x) => x.value === '')).toBe(false);
    expect(endOptions('20:00', '23:00').some((x) => x.value === '')).toBe(false);
  });
});

describe('F-C4-6: reasons for the cap and the last session', () => {
  it('words', () => {
    expect(capReason(14)).toBe('14 is the most');
    expect(LAST_SESSION_REASON).toBe('One session needed');
  });
});

describe('F-C4-9: legacy kind "show" (1 prod row)', () => {
  it('reads as a word, keeps its stored type', () => {
    const d = fromStored(row({ type: 'show', title: null }));
    expect(kindLabel(d.kind)).toBe('Show');
    expect(d.name).toBe('Show');
    expect(toStored(d)).toMatchObject({ type: 'show', title: null });
    expect(kindLabel('performance_night' as SessionDraft['kind'])).toBe('Performance night');
  });
});
