import { describe, it, expect } from 'vitest';
import { posterDateLine, posterFileName, posterText } from '../sharePoster';

const night = {
  occurrenceId: 'o1', title: 'Sensual Thursdays', startLocal: '2026-11-27T20:30:00',
  venueName: 'The Wardrobe', posterUrl: 'https://x/p.jpg', publicEventId: 'e1',
};
const base = { firstName: 'Maya', night, poolCount: 148, origin: 'https://bachatacalendar.co.uk' };

describe('posterText', () => {
  it('returns the exact strings', () => {
    expect(posterText(base)).toEqual({
      headline: 'Maya', won: 'won a free night', at: 'at', title: 'Sensual Thursdays',
      dateLine: 'Fri 27 Nov · 20:30', venueLine: 'The Wardrobe', pill: '148 dancers in the draw',
      link: 'bachatacalendar.co.uk/event/e1?occurrenceId=o1', flyerUrl: 'https://x/p.jpg',
    });
  });
  it('no poster url -> no-flyer variant data', () => {
    expect(posterText({ ...base, night: { ...night, posterUrl: null } }).flyerUrl).toBeNull();
  });
  it('null first name -> A dancer', () => {
    expect(posterText({ ...base, firstName: null }).headline).toBe('A dancer');
  });
  it('no pool count -> no pill; no venue -> no venue line', () => {
    expect(posterText({ ...base, poolCount: null }).pill).toBeNull();
    expect(posterText({ ...base, night: { ...night, venueName: null } }).venueLine).toBeNull();
  });
  it('date line is wall clock, no zone shift', () => {
    expect(posterDateLine('2026-07-01T23:30:00')).toBe('Wed 1 Jul · 23:30');
    expect(posterDateLine('bad')).toBe('');
  });
  it('file name slug', () => {
    expect(posterFileName('Sensual Thursdays!')).toBe('raffle-win-sensual-thursdays.png');
  });
});
