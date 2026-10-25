import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  L,
  cast,
  classCount,
  daySessions,
  endsNextDay,
  kindOf,
  kindWordFromSessions,
  kindWordStored,
  liveDates,
  peopleText,
  roleNoun,
  sessionTitle,
  span,
  spanText,
  startPhrase,
  timeWord,
  type P3Date,
  type P3Event,
  type P3Session,
} from '..';

/*
 * The C3 logic probes that concern the model (startPhrase / M1 / M3 / W1, classCount / #15,
 * role nouns / #2, cast / #17, "No name yet", "ends the next day"), ported to a table across
 * every shape of CONTRACT.md section 1: weekly series, monthly, course, dates I pick,
 * festival, one-off; empty and no-name sessions; sessions past midnight; cancelled dates
 * and breaks. TODAY is C3's (Fri 23 Oct 2026).
 */
const TODAY = '2026-10-23';

const S = (id: string, kind: P3Session['kind'], title: string | null, start: string, end: string, extra: Partial<P3Session> = {}): P3Session =>
  ({ id, kind, title, start, end, people: [], ...extra });
const D = (date: string, status: P3Date['status'] = 'scheduled', more: Partial<P3Date> = {}): P3Date => ({ date, status, ...more });

// Weekly series (C3 Sensual Fridays): class 8pm, party 9pm to 1am, a forward time change from Fri 20 Nov.
const friClass = S('c', 'class', 'Class', '20:00', '21:00', {
  levels: ['All levels'],
  people: [{ name: 'Marco & Elena', role: 'teach' }],
  forward: [{ from: '2026-11-20', patch: { start: '20:30' } }],
});
const friParty = S('p', 'party', 'Party', '21:00', '01:00', { people: [{ name: 'DJ Kizzy', role: 'dj' }] });
const weekly: P3Event = {
  kind: 'weekly',
  sessions: [friParty, friClass],
  dates: [
    D('2026-10-16', 'scheduled', { extra: [S('x0', 'workshop', 'Old masterclass', '19:00', '20:00', { people: [{ name: 'Past Person', role: 'teach' }] })] }),
    D('2026-10-23'),
    D('2026-10-30', 'scheduled', { extra: [S('x1', 'workshop', 'Masterclass with Lena Ortiz', '19:00', '20:00', { people: [{ name: 'Lena Ortiz', role: 'teach' }] })] }),
    D('2026-11-06', 'scheduled', { changes: { c: { notRunning: true } } }),
    D('2026-11-13', 'cancelled', { extra: [S('x2', 'show', 'Show', '23:00', '23:30', { people: [{ name: 'Pao Pao Army', role: 'perform' }] })] }),
    D('2026-11-20', 'scheduled', { changes: { p: { start: '21:30', people: [{ name: 'DJ Tropical', role: 'dj' }] } } }),
    D('2026-11-27'),
  ],
};

const monthly: P3Event = {
  kind: 'monthly',
  sessions: [S('m', 'party', 'Mambo night', '21:00', '02:00')],
  dates: [D('2026-11-07'), D('2026-12-05', 'cancelled'), D('2027-01-02')],
};

// Course: 8 rule dates, one cancelled, one break -> 6 classes (course_total_sessions is never read).
const course: P3Event = {
  kind: 'course',
  sessions: [S('k', 'class', 'Bachata beginners', '19:00', '20:00')],
  dates: ['2026-11-04', '2026-11-11', '2026-11-18', '2026-11-25', '2026-12-02', '2026-12-09', '2026-12-16', '2027-01-06']
    .map((d, i) => D(d, i === 2 ? 'cancelled' : i === 5 ? 'skip' : 'scheduled')),
};

const custom: P3Event = {
  kind: 'custom',
  sessions: [S('a', 'class', null, '19:30', '20:30'), S('b', 'party', '', '20:30', '23:30')],
  dates: [D('2026-10-01'), D('2026-11-01'), D('2026-12-01')],
};

const festival: P3Event = {
  kind: 'festival',
  sessions: [S('w', 'workshop', 'Welcome workshop', '19:00', '20:00'), S('o', 'party', 'Opening party', '20:00', '03:00')],
  dates: [D('2027-02-05')],
};

// One-off: a stray forward change must never be read (C3 skips forward rules for one-offs).
const oneoff: P3Event = {
  kind: 'oneoff',
  sessions: [S('h', 'party', 'Halloween party', '22:00', '03:00', { forward: [{ from: '2026-10-01', patch: { start: '23:00' } }] })],
  dates: [D('2026-10-31')],
};

const empty: P3Event = { kind: 'weekly', sessions: [], dates: [D('2026-10-30')] };

// Past midnight: a party, then an after-party that starts at 00:30 (belongs to the night before).
const lateNight: P3Event = {
  kind: 'weekly',
  sessions: [S('l2', 'party', 'After party', '00:30', '04:00'), S('l1', 'party', 'Party', '22:00', '00:30')],
  dates: [D('2026-10-24')],
};

describe('startPhrase: one phrase from the sessions, every shape', () => {
  it.each<[string, P3Event, boolean, boolean, string]>([
    // name, event, long, read as next live date, expected
    ['weekly short', weekly, false, false, '8pm'],
    ['weekly long (M3)', weekly, true, false, 'Party 9pm, class from 8pm'],
    ['weekly long names the later forward change (W1)', weekly, true, true, 'Party 9pm, class from 8pm (8:30pm from Friday 20 November)'],
    ['weekly short with the event: no later note', weekly, false, true, '8pm'],
    ['monthly: party is first, one time', monthly, true, true, '9pm'],
    ['course: class only', course, true, true, '7pm'],
    ['dates I pick, no-name sessions', custom, true, true, 'Party 8:30pm, class from 7:30pm'],
    ['festival: workshop then party', festival, true, true, 'Party 8pm, workshop from 7pm'],
    ['one-off: forward ignored', oneoff, true, true, '10pm'],
    ['one-off without the event: base', oneoff, true, false, '10pm'],
    ['no sessions', empty, true, true, L.noSessions],
    ['past midnight: 00:30 sorts after 22:00', lateNight, true, true, '10pm'],
  ])('%s', (_n, e, long, withEvent, want) => {
    expect(startPhrase(e.sessions, withEvent ? { long, event: e, today: TODAY } : { long })).toBe(want);
  });

  it('reads the sessions as they apply to the next live date (forward change already started)', () => {
    expect(startPhrase(weekly.sessions, { long: true, event: weekly, today: '2026-11-21' })).toBe('Party 9pm, class from 8:30pm');
  });
  it('a cancelled next date is skipped when finding the next live date', () => {
    expect(liveDates(weekly, '2026-11-07')[0].date).toBe('2026-11-20');
  });
  it('fallback when nothing runs', () => {
    expect(startPhrase([], { fallback: '9pm' })).toBe('9pm');
    expect(startPhrase([{ kind: 'party', start: '21:00', notRunning: true }])).toBe(L.noSessions);
  });
  it('one date: the class not running leaves the party', () => {
    expect(startPhrase(daySessions(weekly, weekly.dates[3]), { long: true })).toBe('9pm');
  });
});

describe('daySessions (C3 dsess): base, then forward, then this date', () => {
  it('no date = base sessions by start', () => {
    expect(daySessions(weekly).map((m) => `${m.id}@${m.start}`)).toEqual(['c@20:00', 'p@21:00']);
  });
  it('an extra session is added and marked', () => {
    const d = daySessions(weekly, weekly.dates[2]);
    expect(d.map((m) => [m.id, m.extra])).toEqual([['x1', true], ['c', false], ['p', false]]);
  });
  it('not running is kept, struck, not a change', () => {
    const c = daySessions(weekly, weekly.dates[3]).find((m) => m.id === 'c')!;
    expect([c.notRunning, c.changed]).toEqual([true, false]);
  });
  it('forward applies on and after its date, this date\'s change on top', () => {
    const d = daySessions(weekly, weekly.dates[5]);
    expect(d.map((m) => `${m.id}@${m.start}`)).toEqual(['c@20:30', 'p@21:30']);
    expect(d.find((m) => m.id === 'p')!.changed).toBe(true);
    expect(daySessions(weekly, weekly.dates[4]).find((m) => m.id === 'c')!.start).toBe('20:00');
  });
});

describe('span / ends the next day', () => {
  it.each<[string, P3Event, P3Date | null, string]>([
    ['weekly', weekly, null, '8pm to 1am (ends the next day)'],
    ['class not running', weekly, weekly.dates[3], '9pm to 1am (ends the next day)'],
    ['course', course, null, '7pm to 8pm'],
    ['festival', festival, null, '7pm to 3am (ends the next day)'],
    ['past midnight: last end is the after party', lateNight, null, '10pm to 4am (ends the next day)'],
    ['no sessions', empty, null, L.noSessions],
  ])('%s', (_n, e, x, want) => {
    expect(spanText(daySessions(e, x))).toBe(want);
  });
  it('nothing running = no span', () => {
    expect(span([{ start: '20:00', end: '21:00', notRunning: true }])).toBeNull();
  });
  it.each<[string, string, boolean]>([
    ['20:00', '23:30', false],
    ['23:00', '01:00', true],
    ['00:30', '02:00', true],
    ['21:00', '21:00', true],
  ])('%s to %s ends the next day: %s', (start, end, want) => {
    expect(endsNextDay({ start, end })).toBe(want);
  });
  it.each([['20:00', '8pm'], ['20:30', '8:30pm'], ['00:15', '12:15am'], ['12:00', '12pm']])('timeWord %s', (t, w) => {
    expect(timeWord(t)).toBe(w);
  });
  it('24:00 is midnight, not noon', () => {
    expect(timeWord('24:00:00')).toBe('12am');
    expect(spanText([{ start: '20:00', end: '24:00' }])).toBe('8pm to 12am');
  });
  it('day rollover is the shared ROLLOVER_HOUR (8am): a 7am session belongs to the night before', () => {
    expect(spanText([{ start: '22:00', end: '06:00' }, { start: '07:00', end: '09:00' }])).toBe('10pm to 9am (ends the next day)');
    expect(startPhrase([{ kind: 'party', start: '22:00' }, { kind: 'class', start: '07:00' }])).toBe('10pm');
  });
  it('a stored ends_next_day wins over the times', () => {
    expect(endsNextDay({ start: '21:00', end: '21:00', endsNextDay: false })).toBe(false);
    expect(endsNextDay({ start: '20:00', end: '23:00', endsNextDay: true })).toBe(true);
  });
});

describe('classCount: ONE count, no cancelled, no breaks (C3 #15)', () => {
  it.each<[string, P3Event, number]>([
    ['weekly (1 cancelled of 7)', weekly, 6],
    ['monthly (1 cancelled of 3)', monthly, 2],
    ['course (8 dates, 1 cancelled, 1 break)', course, 6],
    ['dates I pick', custom, 3],
    ['festival', festival, 1],
    ['one-off', oneoff, 1],
    ['no dates', { kind: 'course', sessions: [], dates: [] }, 0],
  ])('%s', (_n, e, want) => {
    expect(classCount(e)).toBe(want);
  });
});

describe('cast (C3 #17): every-date people plus people on dates still to come', () => {
  it('weekly: base, then upcoming extras and per-date line-ups; never a past or cancelled date', () => {
    expect(cast(weekly, TODAY).map((p) => p.name)).toEqual(['DJ Kizzy', 'Marco & Elena', 'Lena Ortiz', 'DJ Tropical']);
  });
  it('a session not running on a date adds nobody from that date', () => {
    const e: P3Event = { kind: 'weekly', sessions: [], dates: [D('2026-10-30', 'scheduled', { extra: [] })] };
    expect(cast(e, TODAY)).toEqual([]);
  });
  it('empty line-up = empty cast (Needs you checks !cast.length)', () => {
    expect(cast(empty, TODAY)).toEqual([]);
    expect(cast(custom, TODAY)).toEqual([]);
  });
});

describe('role nouns (C3 #2): pairs and groups take the plural', () => {
  it.each<[string, 'teach' | 'dj' | 'perform', string]>([
    ['Marco & Elena', 'teach', 'teachers'],
    ['Daniel y Tom', 'teach', 'teachers'],
    ['Lena Ortiz', 'teach', 'teacher'],
    ['DJ Kizzy', 'dj', 'DJ'],
    ['Sam and Alex', 'dj', 'DJs'],
    ['Pao Pao Army', 'perform', 'performers'],
    ['Rosa', 'perform', 'performer'],
  ])('%s, %s -> %s', (name, role, want) => {
    expect(roleNoun(name, role)).toBe(want);
  });
  it('peopleText joins with a middle dot', () => {
    expect(peopleText([{ name: 'Marco & Elena', role: 'teach' }, { name: 'DJ Kizzy', role: 'dj' }])).toBe('Marco & Elena, teachers \u00b7 DJ Kizzy, DJ');
  });
});

describe('no name yet', () => {
  it.each<[string | null, string]>([[null, L.noName], ['', L.noName], ['   ', L.noName], ['Party', 'Party']])('%j', (t, want) => {
    expect(sessionTitle({ title: t })).toBe(want);
  });
});

describe('kind: shape from CONTRACT section 1, word from eventCategory (no new mapping)', () => {
  it.each<[string | null, string | null, string]>([
    ['festival', 'monthly', 'festival'],
    ['course', null, 'course'],
    ['recurring', 'monthly', 'monthly'],
    ['recurring', 'custom', 'custom'],
    ['recurring', 'weekly', 'weekly'],
    ['one_off', null, 'oneoff'],
    [null, null, 'oneoff'],
  ])('kindOf(%s, %s) = %s', (f, m, want) => {
    expect(kindOf(f, m)).toBe(want);
  });
  it.each<[string | null, string | null, string]>([
    ['festival', null, 'Festival'],
    ['course', 'class', 'Course'],
    ['recurring', 'party', 'Night'],
    ['recurring', 'workshop', 'Class'],
    ['recurring', 'masterclass', 'Masterclass'],
    [null, null, 'Not set'],
  ])('kindWordStored(%s, %s) = %s', (f, c, want) => {
    expect(kindWordStored(f, c)).toBe(want);
  });
  it.each<[string, P3Event, string | null, string]>([
    ['weekly', weekly, 'recurring', 'Night'],
    ['course', course, 'course', 'Course'],
    ['festival', festival, 'festival', 'Festival'],
    ['class only', { ...course, kind: 'weekly' }, 'recurring', 'Class'],
    ['show only', { kind: 'oneoff', sessions: [S('s', 'show', 'Show', '20:00', '21:00')], dates: [] }, 'one_off', 'Not set'],
    ['no sessions', empty, 'recurring', 'Not set'],
  ])('kindWordFromSessions %s', (_n, e, format, want) => {
    expect(kindWordFromSessions(format, e.sessions)).toBe(want);
  });
  it('kind.ts holds no word of its own', () => {
    const src = readFileSync(join(__dirname, '..', 'kind.ts'), 'utf8');
    for (const w of ["'Night'", "'Class'", "'Course'", "'Festival'", "'Masterclass'", "'Not set'"]) expect(src.includes(w), w).toBe(false);
  });
});

describe('the label list L (C3.md "Shared labels")', () => {
  it('session kinds, roles, levels', () => {
    expect(L.sessKind.map((x) => x[1])).toEqual(['Class', 'Workshop', 'Party', 'Show']);
    expect(L.roles.map((x) => x[1])).toEqual(['Teaches', 'DJs', 'Performs']);
    expect(L.lvls).toEqual(['Beginners', 'Improvers', 'Intermediate', 'Advanced', 'All levels']);
    expect(Object.values(L.tabs)).toEqual(['Home', 'Events', 'Stats', 'You']);
  });
  it.each<[keyof typeof L, string]>([
    ['onlyThis', 'Only this date'],
    ['extra', 'Extra, this date only'],
    ['notRunning', 'Not running this date'],
    ['removeOne', 'Remove (only this date)'],
    ['removeAll', 'Remove from every date'],
    ['addSessOne', 'Add a session to this date only'],
    ['addNext', 'Add the next session'],
    ['thisOnly', 'This date only'],
    ['thisLater', 'This and later ones'],
    ['skip', 'Skip this week (break)'],
    ['skipped', 'Break'],
    ['unskip', 'Put this week back'],
    ['cancelWhy', 'Why? (dancers see this)'],
    ['draft', 'Draft (only you see it)'],
    ['endIt', 'This has finished (end it)'],
    ['backDraft', 'Take it off the calendar (back to draft)'],
    ['stopRepeat', 'Stop repeating, I will add dates myself'],
    ['allDone', 'All classes done'],
    ['saveOne', 'Save for this date'],
    ['saveAll', 'Save for all dates'],
    ['notSaved', 'Not saved yet'],
    ['undoMine', 'Undo my changes'],
    ['sameUsual', 'Same as usual'],
    ['resetDate', 'Put this date back to normal'],
    ['makeCopy', 'Make a copy'],
    ['history', 'History'],
    ['share', 'Share'],
    ['whosGoing', 'Who\u2019s going'],
    ['moreOpts', 'More options'],
    ['askCity', 'Ask us to change the city'],
    ['checkedSoon', 'We check new venues within a day.'],
    ['noName', 'No name yet'],
  ])('L.%s', (k, want) => {
    expect(L[k]).toBe(want);
  });
  it('scope consequence line', () => {
    expect(L.scopeFrom('Fri 20 Nov', 'time')).toBe('Changes from Fri 20 Nov onwards. Earlier dates keep the old time.');
  });
  it('every model source file is ASCII (no pasted Unicode punctuation)', () => {
    const dir = join(__dirname, '..');
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      expect([...readFileSync(join(dir, f), 'utf8')].every((c) => c.charCodeAt(0) < 128), f).toBe(true);
    }
  });
});

describe('review fixes (red first on the first cut)', () => {
  const base = S('c', 'class', 'Class', '20:00', '21:00');
  const ev = (forward: P3Session['forward'], dates: P3Date[], kind: P3Event['kind'] = 'weekly'): P3Event => ({ kind, sessions: [{ ...base, forward }], dates });
  it('forward changes apply oldest from first, whatever their order', () => {
    const e = ev([{ from: '2026-11-20', patch: { start: '21:00' } }, { from: '2026-11-06', patch: { start: '20:30' } }], [D('2026-11-27')]);
    expect(daySessions(e, e.dates[0])[0].start).toBe('21:00');
  });
  it('one-off: daySessions and startPhrase agree (no forward)', () => {
    const d = daySessions(oneoff, oneoff.dates[0]);
    expect(spanText(d)).toBe('10pm to 3am (ends the next day)');
    expect(startPhrase(oneoff.sessions, { event: oneoff, today: TODAY })).toBe('10pm');
  });
  it('startPhrase reads the next live date with its own changes', () => {
    const e: P3Event = { kind: 'weekly', sessions: [friParty, { ...friClass, forward: [] }], dates: [D('2026-10-30', 'scheduled', { changes: { c: { notRunning: true } } })] };
    expect(startPhrase(e.sessions, { long: true, event: e, today: TODAY })).toBe('9pm');
    const f: P3Event = { ...e, dates: [D('2026-10-30', 'scheduled', { changes: { c: { start: '20:30' } } })] };
    expect(startPhrase(f.sessions, { long: true, event: f, today: TODAY })).toBe('Party 9pm, class from 8:30pm');
  });
  it('a later change back to the usual time is named; a no-op one is not', () => {
    const e = ev([{ from: '2026-10-01', patch: { start: '20:30' } }, { from: '2026-12-04', patch: { start: '20:00' } }], [D('2026-10-30')]);
    expect(startPhrase(e.sessions, { long: true, event: e, today: TODAY })).toBe('8:30pm (8pm from Friday 4 December)');
    const g = ev([{ from: '2026-10-01', patch: { start: '20:30' } }, { from: '2026-12-04', patch: { start: '20:30' } }], [D('2026-10-30')]);
    expect(startPhrase(g.sessions, { long: true, event: g, today: TODAY })).toBe('8:30pm');
  });
  it('dates out of order: the next live date is the earliest', () => {
    const e = ev([{ from: '2026-11-20', patch: { start: '21:00' } }], [D('2026-12-04'), D('2026-10-30')]);
    expect(liveDates(e, TODAY).map((x) => x.date)).toEqual(['2026-10-30', '2026-12-04']);
    expect(startPhrase(e.sessions, { long: true, event: e, today: TODAY })).toBe('8pm (9pm from Friday 20 November)');
  });
  it('cast keeps a person once per role', () => {
    const e: P3Event = { kind: 'weekly', sessions: [
      S('a', 'class', 'Class', '20:00', '21:00', { people: [{ name: 'Marco', role: 'teach' }] }),
      S('b', 'party', 'Party', '21:00', '01:00', { people: [{ name: 'Marco', role: 'dj' }, { name: 'Marco', role: 'dj' }] }),
    ], dates: [] };
    expect(cast(e, TODAY)).toEqual([{ name: 'Marco', role: 'teach' }, { name: 'Marco', role: 'dj' }]);
  });
});
