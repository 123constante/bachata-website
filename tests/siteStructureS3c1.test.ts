import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('S3c-1: /festivals has no Hub tiles', () => {
  const src = readFileSync(resolve(__dirname, '../src/pages/FestivalHub.tsx'), 'utf8');
  for (const needle of ['Roommates', 'Taxi buddies', 'Pre-plan dances', 'Share costs', 'heroWidgets']) {
    it(`does not contain "${needle}"`, () => {
      expect(src).not.toContain(needle);
    });
  }
});
