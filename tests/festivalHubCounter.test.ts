import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { festivalCountLabel } from '@/pages/festivalCountLabel';

describe('festivalCountLabel', () => {
  it.each([
    [0, null],
    [1, '1 upcoming festival'],
    [7, '7 upcoming festivals'],
  ])('n=%i -> %s', (n, expected) => {
    expect(festivalCountLabel(n)).toBe(expected);
  });
});

// Layout guard (class-list form: the e2e fake has no festival data to measure).
// A negative top margin on the stats row pulled the counter over the intro
// paragraph at 390px (prod, 2026-10-18).
describe('FestivalHub stats row', () => {
  const src = readFileSync('src/pages/FestivalHub.tsx', 'utf8');
  const row = src.match(/\{\/\* Stats \*\/\}[\s\S]*?className="([^"]*)"/);

  it('has no negative top margin and uses the helper', () => {
    expect(row).not.toBeNull();
    expect(row![1]).not.toMatch(/(^|\s)-mt-/);
    expect(src).toContain('festivalCountLabel(festivals.length)');
    expect(src).not.toMatch(/\{festivals\.length\} upcoming festivals/);
  });
});
