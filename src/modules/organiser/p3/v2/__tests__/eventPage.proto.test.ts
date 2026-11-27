import { describe, expect, it } from 'vitest';
import { V2, repeatParts, sessionLine } from '../copy';

const person = (name: string) => ({ profileId: name, name, profileType: 'teacher', role: 'teaching', level: null });

// Prod shapes (2026-11-20): 241 sessions have no title, 231 no end time, up to 11 people on one session.
describe('event page prototype lines', () => {
  it.each([
    ['class with people and level', { type: 'class', people: [person('Ana'), person('Ben')], levels: ['beginner'] }, 'Class · Ana, Ben · Beginner'],
    ['party with no people', { type: 'party', people: [], levels: [] }, 'Party'],
    ['no type stored', { type: null, people: [], levels: [] }, 'Session'],
    ['blank name skipped', { type: 'party', people: [person('  '), person('DJ Rafa')], levels: [] }, 'Party · DJ Rafa'],
  ])('sessionLine: %s', (_n, s, want) => {
    expect(sessionLine(s)).toBe(want);
  });

  it.each([
    ['rule with last date', 'Every Friday, last date Friday 25 December.', { head: 'Every Friday', rest: 'Last date Friday 25 December' }],
    ['no end', 'Every Thursday, no end date', { head: 'Every Thursday', rest: 'No end date' }],
    ['no pattern', 'No pattern is saved, so each date is set on its own.', { head: 'No pattern is saved', rest: 'So each date is set on its own' }],
    ['one sentence', 'Doesn’t repeat', { head: 'Doesn’t repeat', rest: '' }],
  ])('repeatParts: %s', (_n, words, want) => {
    expect(repeatParts(words)).toMatchObject(want);
    expect(repeatParts(words).full).not.toMatch(/\.$/);
  });

  it('copy keeps punctuation as escapes (no mojibake) and counts', () => {
    expect(V2.loading).toBe('Loading…');
    expect(V2.photos(1)).toBe('1 photo');
    expect(V2.videoCount(0)).toBe('0 videos');
    expect(V2.to('21:00')).toBe('to 21:00');
  });
});

// Night screen (prototype renderNight); prod: 43 of 155 cancelled dates carry a reason label, the rest none.
describe('night screen prototype lines', () => {
  it.each([
    ['with a reason', 'Venue issue', 'Dancers see Cancelled and your reason: Venue issue'],
    ['no reason stored', null, 'Dancers see Cancelled.'],
    ['empty reason', '', 'Dancers see Cancelled.'],
  ])('cancelled box: %s', (_n, reason, want) => {
    expect(V2.nightCancelledSee(reason)).toBe(want);
  });

  it('header, info box, guest list and session lines', () => {
    expect(V2.dayOnly('Thursday 19 November')).toBe('Thursday 19 November only');
    expect(V2.nightOnly('Thursday 19 November')).toBe('Changes here are for Thursday 19 November only.');
    expect(V2.nightGuestLine('Thursday 19 November')).toBe('Link for Thursday 19 November only');
    expect(V2.sessionCancel).toBe('Cancel');
    expect(V2.cancelSession('Beginners')).toBe('Cancel Beginners for this night');
    expect(V2.sessionBringBack).toBe('Bring back');
  });

  it('night copy has no mojibake', () => {
    const all = Object.values(V2 as Record<string, unknown>).filter((v): v is string => typeof v === 'string').join('\n');
    expect(all).not.toMatch(/\u00e2\u20ac|\u00c3/);
  });
});
