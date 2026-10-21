import { describe, expect, it } from 'vitest';
import {
  MAX_SESSIONS,
  addAnother,
  addRoom,
  chooseOtherLength,
  defaultName,
  endOptions,
  isValidEnd,
  kindOptions,
  levelAllowed,
  lengthLabel,
  newSession,
  nightSpan,
  pushRecent,
  quickLengthOptions,
  quickLengthSelected,
  recentFor,
  removeRoom,
  roomVisible,
  searchRole,
  sessionIssues,
  setEnd,
  setKind,
  setLength,
  setStart,
  showQuickLengths,
  sortSessions,
  startOptions,
  toggleLevel,
  type SessionDraft,
} from '../sessionsModel';
import type { SessionKind } from '../../shared/eventRules';

// The owner's rules written out, not derived from the code under test.
const KINDS: { kind: SessionKind; label: string; level: boolean; lengths: number[] | null; who: string }[] = [
  { kind: 'class', label: 'Class', level: true, lengths: [45, 60, 90, 120], who: 'Teacher' },
  { kind: 'workshop', label: 'Workshop', level: false, lengths: [45, 60, 90, 120], who: 'Teacher' },
  { kind: 'masterclass', label: 'Masterclass', level: true, lengths: [45, 60, 90, 120], who: 'Teacher' },
  { kind: 'party', label: 'Party', level: false, lengths: null, who: 'DJ' },
  { kind: 'showcase', label: 'Showcase', level: false, lengths: null, who: 'Performer' },
  { kind: 'competition', label: 'Competition', level: false, lengths: null, who: 'Judge' },
];
const LENGTH_LABELS: Record<number, string> = { 45: '45 min', 60: '1 h', 90: '1 h 30', 120: '2 h' };
const STARTS = ['08:00', '19:00', '21:45', '23:30', '00:30'];

describe('kinds x lengths x start (midnight wrap)', () => {
  for (const k of KINDS) {
    describe(k.kind, () => {
      it('is named after the kind, level only where allowed, quick lengths only on lessons', () => {
        const s = newSession(k.kind, '19:00', 'a');
        expect(s.name).toBe(k.label);
        expect(defaultName(k.kind)).toBe(k.label);
        expect(levelAllowed(k.kind)).toBe(k.level);
        expect(quickLengthOptions(k.kind).map((q) => q.minutes)).toEqual(k.lengths ?? []);
        expect(showQuickLengths(s)).toBe(k.lengths !== null);
        if (k.lengths) expect(quickLengthSelected(s, 60)).toBe(true); // default 1 h
      });
      for (const start of STARTS) {
        for (const minutes of k.lengths ?? []) {
          it(`${start} + ${minutes} min ends as a real time, next day only past midnight`, () => {
            const s = setLength(newSession(k.kind, start, 'a'), minutes);
            const startMin = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
            const wraps = startMin + minutes >= 1440;
            const label = endOptions(start, s.end).find((o) => o.value === s.end);
            expect(label?.nextDay).toBe(wraps);
            expect(label?.label.endsWith('(next day)')).toBe(wraps);
            expect(isValidEnd(s.start, s.end)).toBe(true);
            expect(quickLengthSelected(s, minutes)).toBe(true);
          });
        }
      }
      it('the end list holds only later times', () => {
        for (const start of STARTS) {
          const opts = endOptions(start);
          expect(opts.length).toBeGreaterThan(0);
          expect(opts.some((o) => o.value === start)).toBe(false);
          expect(opts.every((o) => isValidEnd(start, o.value))).toBe(true);
          expect(opts[0].value).not.toBe(start);
        }
      });
      it('search role and line-up label follow the kind', () => {
        expect(searchRole(k.kind)).toBe(k.kind === 'party' ? 'djing' : 'teaching');
      });
    });
  }
  it('lists the six kinds in order', () => {
    expect(kindOptions().map((x) => x.kind)).toEqual(KINDS.map((k) => k.kind));
  });
  it('quick length labels', () => {
    for (const [m, l] of Object.entries(LENGTH_LABELS)) expect(lengthLabel(Number(m))).toBe(l);
  });
});

describe('impossible ends cannot be chosen', () => {
  const s = newSession('party', '22:00', 'a');
  it.each(['22:00', '21:45', '', 'nope', '25:00'])('setEnd ignores %s', (bad) => {
    // 21:45 is 23h45 after 22:00: past the 10 h cap, so also impossible
    expect(setEnd(s, bad)).toBe(s);
  });
  it('a valid later end after midnight is taken', () => {
    expect(setEnd(s, '03:00').end).toBe('03:00');
  });
  it('moving the start keeps the length', () => {
    const moved = setStart(setLength(newSession('class', '19:00', 'a'), 90), '20:00');
    expect(moved.end).toBe('21:30');
  });
  it('a stored off-grid time stays selectable', () => {
    expect(startOptions('19:40').some((o) => o.value === '19:40')).toBe(true);
    expect(endOptions('19:00', '20:40').some((o) => o.value === '20:40')).toBe(true);
  });
});

describe('Other length', () => {
  it('shows the end list and keeps the end', () => {
    const s = chooseOtherLength(newSession('class', '19:00', 'a'));
    expect(showQuickLengths(s)).toBe(false);
    expect(s.end).toBe('20:00');
    expect(quickLengthSelected(s, 60)).toBe(false);
  });
  it('is a no-op on a party', () => {
    const s = newSession('party', '22:00', 'a');
    expect(chooseOtherLength(s)).toBe(s);
  });
});

describe('levels', () => {
  const rows: [SessionKind, boolean][] = KINDS.map((k) => [k.kind, k.level]);
  it.each(rows)('%s: toggling levels works only where allowed', (kind, allowed) => {
    const s = toggleLevel(toggleLevel(newSession(kind, '19:00', 'a'), 'beginner'), 'advanced');
    expect(s.levels).toEqual(allowed ? ['beginner', 'advanced'] : []);
  });
  it.each(rows)('%s: needs one level only where allowed', (kind, allowed) => {
    const bare = sessionIssues(newSession(kind, '19:00', 'a')).map((i) => i.code);
    expect(bare.includes('level')).toBe(allowed);
    if (allowed) expect(sessionIssues(toggleLevel(newSession(kind, '19:00', 'a'), 'improver'))).toEqual([]);
  });
  it('switching to a kind without level drops them; name follows the kind only while default', () => {
    const c = toggleLevel(newSession('class', '19:00', 'a'), 'beginner');
    const p = setKind(c, 'party');
    expect(p.levels).toEqual([]);
    expect(p.name).toBe('Party');
    expect(setKind({ ...c, name: 'Beginners bootcamp' }, 'party').name).toBe('Beginners bootcamp');
  });
  it('party to class gets the 1 h default; class to workshop keeps the length', () => {
    expect(setKind(newSession('party', '22:00', 'a'), 'class').end).toBe('23:00');
    const c = setLength(newSession('class', '19:00', 'a'), 90);
    expect(setKind(c, 'workshop').end).toBe('20:30');
  });
  it('an empty name is refused with a reason', () => {
    expect(sessionIssues({ ...newSession('party', '22:00', 'a'), name: ' ' })).toEqual([{ code: 'name', reason: 'Name needed' }]);
  });
});

describe('room is hidden until needed, then on every session', () => {
  const mk = (patch: Partial<SessionDraft>[]) => patch.map((p, i) => ({ ...newSession('class', '19:00', `s${i}`), ...p }));
  const cases: [string, Partial<SessionDraft>[], boolean][] = [
    ['none', [{}, {}], false],
    ['one pressed Add a room', [{ showRoom: true }, {}], true],
    ['one has a room', [{}, { room: 'Main room' }], true],
    ['a blank room is not a room', [{ room: '  ' }, {}], false],
  ];
  it.each(cases)('%s', (_n, list, visible) => {
    expect(roomVisible(mk(list))).toBe(visible);
  });
  it('Add a room opens it for all; Remove closes it for all and clears the text', () => {
    const opened = addRoom(mk([{}, {}]));
    expect(opened.every((s) => s.showRoom)).toBe(true);
    const closed = removeRoom(mk([{ room: 'Main room', showRoom: true }, { showRoom: true }]));
    expect(roomVisible(closed)).toBe(false);
    expect(closed.every((s) => s.room === '')).toBe(true);
  });
});

describe('list: add another, time order, recent, span', () => {
  it('Add another starts where the previous ends, same kind', () => {
    const list = [setLength(newSession('class', '19:00', 'a'), 90)];
    const next = addAnother(list, undefined, 'b');
    expect(next.map((s) => s.id)).toEqual(['a', 'b']);
    expect(next[1].start).toBe('20:30');
    expect(next[1].kind).toBe('class');
  });
  it('starts a new one at the end that wrapped past midnight', () => {
    const next = addAnother([setEnd(newSession('party', '22:00', 'a'), '01:00')], undefined, 'b');
    expect(next[1].start).toBe('01:00');
  });
  it('the new session shows the room box when the list does', () => {
    const next = addAnother(addRoom([newSession('class', '19:00', 'a')]), undefined, 'b');
    expect(roomVisible(next)).toBe(true);
    expect(next[1].showRoom).toBe(true);
  });
  it('stops at the cap', () => {
    let list = [newSession('class', '08:00', 'a')];
    for (let i = 0; i < 20; i++) list = addAnother(list);
    expect(list).toHaveLength(MAX_SESSIONS);
  });
  it('sorts by time; an after-midnight start belongs to the night before', () => {
    const l = [newSession('party', '01:00', 'late'), newSession('class', '20:00', 'eve'), newSession('class', '09:00', 'morn')];
    expect(sortSessions(l).map((s) => s.id)).toEqual(['morn', 'eve', 'late']);
  });
  it('Recent keeps the last three, newest first, and hides who is already added', () => {
    let r = pushRecent([], { id: '1', name: 'A' });
    for (const id of ['2', '3', '4', '2']) r = pushRecent(r, { id, name: id });
    expect(r.map((p) => p.id)).toEqual(['2', '4', '3']);
    const s = { ...newSession('class', '19:00', 'a'), people: [{ id: '4', name: '4' }] };
    expect(recentFor(r, s).map((p) => p.id)).toEqual(['2', '3']);
  });
  it('The night runs span, with next day', () => {
    expect(nightSpan([setEnd(newSession('party', '22:00', 'a'), '04:00')])).toBe('22:00 to 04:00 (next day)');
    expect(nightSpan([newSession('class', '19:00', 'a')])).toBe('19:00 to 20:00');
    expect(nightSpan([])).toBeNull();
  });
});
