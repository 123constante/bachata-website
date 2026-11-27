import { describe, expect, it } from 'vitest';
import { isBeginnerSlot, programOf } from '../classNight';

const row = (name: string, titles: string[]) => ({
  name,
  meta_data: { program: titles.map((title, i) => ({ start: `${19 + i}:00`, end: '', title, type: 'class' })) },
});

// Real London titles, week of 27 November 2026 (prod shape survey).
describe('isBeginnerSlot', () => {
  it.each([
    ['La Fabrica Mondays', ['FREE Absolute Beginners', 'Beginners Class', 'La Fábrica Social'], true],
    ['Bachata Playground', ['Beginners (FREE‼️)', '3 classes SOLO / CONCEPT / BEGINNER'], true],
    ['FREE 2H BACHATA SENSUAL BEGINNERS CLASS', ['FREE Bachata Class'], true],
    ['Unidos Flow', ['Bachata Class', 'Bachata Party'], false],
    ['Todo Latino', ['Free Class', 'Salsa'], false],
    ['Sway Wednesday', ['Cuban Salsa'], false],
    ['Bachata Partnerwork', ['Partnerwork Classes'], false],
  ])('%s -> %s', (name, titles, want) => {
    expect(isBeginnerSlot(row(name, titles))).toBe(want);
  });

  it('no programme, null meta_data: only the name counts', () => {
    expect(isBeginnerSlot({ name: 'Beginner Night', meta_data: null })).toBe(true);
    expect(isBeginnerSlot({ name: 'Night', meta_data: null })).toBe(false);
  });
});

describe('programOf', () => {
  it('sorts by start, pads hours, drops untitled slots', () => {
    const md = { program: [{ start: '21:30', title: 'Social' }, { start: '9:05', title: 'Early' }, { start: '19:00', title: '' }, null] };
    expect(programOf({ meta_data: md })).toEqual([
      { start: '09:05', title: 'Early' },
      { start: '21:30', title: 'Social' },
    ]);
  });
});
