import { describe, expect, it } from 'vitest';
import { buildEventPageModel } from '@/modules/event-page/buildEventPageModel';
import {
  cancelledLine,
  organiserByline,
  paymentLine,
  publicFactLines,
  timetableSoon,
} from '@/modules/event-page/publicFacts';

const FORMATS = ['recurring', 'one_off', 'course', 'festival'] as const;
const PAY = [null, '', 'passes', 'ticket_link', 'door,cash', 'ticket_link,bogus'] as const;

describe('paymentLine', () => {
  it.each([
    [null, null],
    ['', null],
    ['passes', null], // legacy value: no line, never a guess
    ['ticket_link', 'Pay: Ticket link'],
    ['door,cash', 'Pay: Pay at the door, Cash'],
    ['ticket_link,bogus', 'Pay: Ticket link'],
    ['free', 'Pay: Free'],
  ])('%s -> %s', (stored, line) => expect(paymentLine(stored)).toBe(line));
});

describe('organiserByline', () => {
  it('owner then accepted co-organisers only', () => {
    expect(
      organiserByline([
        { name: 'Ana', role: 'owner', status: 'accepted' },
        { name: 'Ben', role: 'co', status: 'accepted' },
        { name: 'Cy', role: 'co', status: 'invited' },
      ]),
    ).toBe('By Ana, Ben');
  });
  it('no role data: first organiser only', () => {
    expect(organiserByline([{ name: 'Ana' }, { name: 'Ben' }])).toBe('By Ana');
  });
  it('nobody named: no line', () => expect(organiserByline([{ name: ' ' }])).toBeNull());
});

describe('cancelledLine / timetableSoon', () => {
  it('keeps the reason', () => expect(cancelledLine(true, 'Bank holiday')).toBe('Cancelled: Bank holiday'));
  it('no reason', () => expect(cancelledLine(true, null)).toBe('Cancelled'));
  it('not cancelled', () => expect(cancelledLine(false, 'x')).toBeNull());
  it.each(FORMATS)('%s with no workshops / with / unknown', (f) => {
    expect(timetableSoon(f, 0)).toBe(f === 'festival' ? 'Timetable coming soon' : null);
    expect(timetableSoon(f, 3)).toBeNull();
    expect(timetableSoon(f, null)).toBeNull();
  });
});

describe('publicFactLines: every format x payment x workshops', () => {
  for (const format of FORMATS) {
    for (const pay of PAY) {
      for (const workshops of [0, 4]) {
        it(`${format} / ${pay ?? 'null'} / ${workshops} workshops`, () => {
          const lines = publicFactLines({
            paymentMethods: pay,
            organisers: [{ name: 'Ana', role: 'owner' }],
            format,
            workshopCount: workshops,
          });
          expect(lines[0]).toBe('By Ana');
          expect(lines.some((l) => l.startsWith('Pay:'))).toBe(paymentLine(pay) !== null);
          expect(lines.includes('Timetable coming soon')).toBe(format === 'festival' && workshops === 0);
        });
      }
    }
  }
});

describe('buildEventPageModel carries the lines', () => {
  it('empty while loading', () => {
    expect(buildEventPageModel({ snapshot: null, canEdit: false, isLoading: true, hasError: false }).factLines).toEqual([]);
  });
});
