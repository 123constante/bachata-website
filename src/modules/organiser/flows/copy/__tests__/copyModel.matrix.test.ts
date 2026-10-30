import { describe, expect, it } from 'vitest';
import {
  COPY_TEXT, MAX_FESTIVAL_DAYS, PICK_DATE_WORDS, copyEdition, copyEvent, copyView, durationToMinutes, prefillCommands, readCopy,
  startProblem, type CopyRole, type CopySource, type Keep,
} from '../copyModel';

const TODAY = '2026-10-25';
const days = (start: string, n: number, step = 1) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${start}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i * step);
    return d.toISOString().slice(0, 10);
  });

const src = (over: Partial<CopySource> = {}): CopySource => ({
  kind: 'event', name: 'Friday Social', status: 'live', venueId: 'v1', cityId: 'c1', startTime: '20:00:00', durationMinutes: 180,
  ticketUrl: 'https://t.example/x', coverImageUrl: 'https://img.example/c.jpg', description: 'Dance.', programmeText: 'Workshop 8pm',
  dates: ['2026-10-30'], rsvpCount: 12, goingCount: 9, adminNotes: 'secret', unpublishHistory: [{ at: 'x' }], ...over,
});

const KEEPS: Keep[] = [
  { ticket: true, cover: true }, { ticket: false, cover: true }, { ticket: true, cover: false }, { ticket: false, cover: false },
];
const DATE_SHAPES: Record<string, string[]> = {
  past: ['2026-09-01'], future: ['2026-11-06'], today: [TODAY], none: [],
  d1: days('2026-11-06', 1), d3: days('2026-11-06', 3), d10: days('2026-11-06', 10), d11: days('2026-11-06', 11),
};
const STATUSES = ['draft', 'live', 'archived'];
const ROLES: CopyRole[] = ['organiser', 'admin'];
const PRIVATE = ['rsvpCount', 'goingCount', 'adminNotes', 'unpublishHistory', 'status', 'dates'];

describe('copyEvent: the table', () => {
  for (const [shape, dates] of Object.entries(DATE_SHAPES)) {
    for (const status of STATUSES) {
      for (const keep of KEEPS) {
        for (const rsvps of [0, 40]) {
          it(`${shape} / ${status} / ticket ${keep.ticket} cover ${keep.cover} / rsvps ${rsvps}`, () => {
            const out = copyEvent(src({ dates, status, rsvpCount: rsvps, goingCount: rsvps }), keep);
            expect(out.date).toBe('');
            expect(out.dateHint).toBe(PICK_DATE_WORDS);
            expect(out.status).toBe('draft');
            expect(JSON.stringify(out)).not.toMatch(/2026-\d\d-\d\d/); // no date of any kind, past or future
            for (const k of PRIVATE) if (k !== 'status') expect(out).not.toHaveProperty(k);
            expect(JSON.stringify(out)).not.toContain('secret');
            expect(out.ticketUrl).toBe(keep.ticket ? 'https://t.example/x' : '');
            expect(out.coverImageUrl).toBe(keep.cover ? 'https://img.example/c.jpg' : '');
            expect(out.name).toBe('Friday Social');
            expect(out.startTime).toBe('20:00');
            // the saved command carries no date, no status and no private field
            const cmds = JSON.stringify(prefillCommands(out));
            expect(cmds).not.toMatch(/start_date|lifecycle|status|rsvp|going|notes|2026-\d\d-\d\d/);
          });
        }
      }
    }
  }
});

describe('copyEdition: offsets', () => {
  const fest = (dates: string[]) => src({ kind: 'festival', dates });
  const cases: Array<[string, string[], string, string[]]> = [
    ['across a month end', ['2026-10-29', '2026-10-30', '2026-11-02'], '2026-12-30', ['2026-12-30', '2026-12-31', '2027-01-03']],
    ['across the 25 Oct clock change', ['2026-10-24', '2026-10-25', '2026-10-26'], '2026-11-01', ['2026-11-01', '2026-11-02', '2026-11-03']],
    ['onto the 28 Mar 2027 clock change', ['2026-10-24', '2026-10-25', '2026-10-27'], '2027-03-27', ['2027-03-27', '2027-03-28', '2027-03-30']],
    ['over a leap day', ['2027-02-27', '2027-03-01'], '2028-02-27', ['2028-02-27', '2028-02-29']],
  ];
  for (const [name, from, start, want] of cases) {
    it(name, () => {
      const out = copyEdition(fest(from), start, TODAY);
      expect(out.days).toEqual(want);
      for (let i = 1; i < from.length; i++) {
        const gap = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
        expect(gap(out.days[0], out.days[i])).toBe(gap(from[0], from[i]));
      }
    });
  }
  for (const n of [1, 3, 10, 11]) {
    it(`${n} days: never more than ${MAX_FESTIVAL_DAYS}`, () => {
      expect(copyEdition(fest(days('2026-03-01', n)), '2026-11-06', TODAY).days.length).toBeLessThanOrEqual(MAX_FESTIVAL_DAYS);
    });
  }
  it('no date picked yet: no days', () => expect(copyEdition(fest(days('2026-03-01', 3)), null, TODAY).days).toEqual([]));
  it('a start in the past drops the past days', () => {
    expect(copyEdition(fest(days('2026-03-01', 3)), '2026-10-24', TODAY).days).toEqual(['2026-10-25', '2026-10-26']);
  });
  it('no source dates: no days; never a status or line-up', () => {
    const out = copyEdition(fest([]), '2026-11-06', TODAY);
    expect(out.days).toEqual([]);
    expect(out.status).toBe('draft');
    expect(out).not.toHaveProperty('lineup');
  });
  for (const keep of KEEPS) {
    it(`keep ticket ${keep.ticket} cover ${keep.cover}`, () => {
      const out = copyEdition(fest(days('2026-03-01', 2)), '2026-11-06', TODAY, keep);
      expect(out.ticketUrl !== '').toBe(keep.ticket);
      expect(out.coverImageUrl !== '').toBe(keep.cover);
    });
  }
  it('startProblem', () => {
    expect(startProblem('2026-10-24', TODAY)).toBe('Pick a date from today on.');
    expect(startProblem(TODAY, TODAY)).toBeNull();
    expect(startProblem('', TODAY)).toBe('Pick the new start date.');
  });
});

describe('copyView: every state, role and double tap', () => {
  for (const role of ROLES) {
    for (const status of STATUSES) {
      for (const [shape, dates] of Object.entries(DATE_SHAPES)) {
        for (const kind of ['event', 'festival'] as const) {
          it(`${role} / ${status} / ${kind} / ${shape}`, () => {
            const v = copyView({ found: true, role, source: src({ kind, status, dates }) });
            const tooMany = kind === 'festival' && dates.length > MAX_FESTIVAL_DAYS;
            expect(v.enabled).toBe(!tooMany);
            expect(v.reason === null).toBe(!tooMany);
            expect(v.label).toBe(kind === 'festival' ? 'Copy as a new edition' : 'Copy as a new event');
            if (tooMany) expect(v.reason).toBe(COPY_TEXT.tooManyDays(dates.length));
          });
        }
      }
    }
  }
  it('not found', () => {
    const v = copyView({ found: false, role: 'organiser', source: null });
    expect(v).toMatchObject({ enabled: false, block: 'not_found', reason: COPY_TEXT.notFound });
  });
  it('nothing copyable (no name)', () => {
    expect(copyView({ found: true, role: 'admin', source: src({ name: '  ' }) })).toMatchObject({ enabled: false, block: 'nothing_copyable' });
  });
  it('double tap: the second view is disabled with a reason', () => {
    const v = copyView({ found: true, role: 'organiser', source: src(), opening: true });
    expect(v).toMatchObject({ enabled: false, block: 'busy', reason: COPY_TEXT.opening });
  });
  it('plain words, no jargon', () => {
    expect(COPY_TEXT.noEvents).toBe('You have no events to copy yet. Add your first event.');
  });
});

describe('helpers', () => {
  it('durationToMinutes', () => {
    expect(durationToMinutes('02:00:00')).toBe(120);
    expect(durationToMinutes('1 day 01:30:00')).toBe(1530);
    expect(durationToMinutes(null)).toBeNull();
    expect(durationToMinutes('00:00:00')).toBeNull();
  });
  it('readCopy only accepts a draft with a blank date', () => {
    const ok = copyEvent(src());
    expect(readCopy({ copy: ok })).toEqual(ok);
    expect(readCopy({ copy: { ...ok, status: 'live' } })).toBeNull();
    expect(readCopy({ copy: { ...ok, date: '2026-11-06' } })).toBeNull();
    expect(readCopy(null)).toBeNull();
  });
});
