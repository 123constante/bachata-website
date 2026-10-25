import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SHOW_PUBLIC_TIMETABLE } from '@/lib/festivalTimetable';

describe('festival public timetable switch', () => {
  it('is OFF by default (hidden until the festival rebuild)', () => {
    expect(SHOW_PUBLIC_TIMETABLE).toBe(false);
  });

  it('gates the schedule section in FestivalDetail on the switch', () => {
    const src = readFileSync(resolve(__dirname, '../FestivalDetail.tsx'), 'utf8');
    expect(src).toMatch(
      /\{SHOW_PUBLIC_TIMETABLE && days\.length > 0 && hasTimedSession && \(\s*<section className="program">/,
    );
  });
});
