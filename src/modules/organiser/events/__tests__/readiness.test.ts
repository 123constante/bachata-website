import { describe, expect, it } from 'vitest';
import { readinessOf, readinessSummary } from '../readiness';

const base = { name: 'Friday Social', upcoming_count: 3, next_dates: [], default_venue_name: 'The Hall', default_cover_image_url: 'https://x/y.jpg' };
const sum = (o: Partial<typeof base>) => readinessSummary(readinessOf({ ...base, ...o } as never));

describe('readinessOf', () => {
  it('all filled', () => expect(sum({}).ready).toBe(3));
  it('no venue', () => expect(sum({ default_venue_name: null }).missing).toEqual(['Venue']));
  it('blank venue/cover count as missing', () => expect(sum({ default_venue_name: '  ', default_cover_image_url: '' }).ready).toBe(1));
  it('no dates', () => expect(sum({ upcoming_count: 0 }).missing).toEqual(['Name and date']));
  it('past-only series with no upcoming and no next dates is missing a date', () => expect(sum({ upcoming_count: 0, next_dates: [] }).ready).toBe(2));
  it('empty name', () => expect(sum({ name: ' ' }).missing).toContain('Name and date'));
  it('text', () => expect(sum({ default_venue_name: null, default_cover_image_url: null }).text).toBe('1 of 3 ready \u2014 Venue missing, Poster missing'));
});
