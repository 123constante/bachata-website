import { describe, expect, it } from 'vitest';
import { askAgainFrom } from '@/modules/organiser/shared/accessRequestModel';
import { declinedNextLine } from '../onboardingModel';

const NOW = new Date('2026-10-30T12:00:00Z');
const ago = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('askAgainFrom', () => {
  it.each([0, 15, 29])('answered %i days ago is the answered date + 30 days', (d) => {
    const want = new Date(NOW.getTime() - d * 86_400_000 + 30 * 86_400_000).toISOString().slice(0, 10);
    expect(askAgainFrom(ago(d), ago(40))).toBe(want);
  });
  it('null resolvedAt falls back to createdAt', () => {
    expect(askAgainFrom(null, '2026-10-01T10:00:00Z')).toBe('2026-10-31');
  });
  it('counts from the London day (23:30Z on 24 Oct is 25 Oct in London)', () => {
    expect(askAgainFrom('2026-10-24T23:30:00Z', '2026-10-01T00:00:00Z')).toBe('2026-11-24');
  });
  it('unparseable dates give null', () => {
    expect(askAgainFrom('nope', 'nope')).toBeNull();
  });
});

describe('declinedNextLine', () => {
  it('names a full weekday date', () => {
    expect(declinedNextLine('2026-12-12', NOW)).toBe('You can ask again from Saturday 12 December, or ask to join a different page from Find your page.');
  });
  it('on or after the date says today', () => {
    expect(declinedNextLine('2026-10-30', NOW)).toContain('ask again from today');
  });
  it('no date never offers ask again', () => {
    expect(declinedNextLine(null, NOW)).not.toMatch(/ask again/i);
  });
});
