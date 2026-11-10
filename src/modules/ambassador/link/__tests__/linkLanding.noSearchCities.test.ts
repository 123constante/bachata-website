/** The landing must work for an INACTIVE city: search_cities filters is_active, so nothing here may use it. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(__dirname, '..');
const sources = readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f));

describe('ambassador link landing never uses the city picker', () => {
  it('has sources to check', () => expect(sources.length).toBeGreaterThanOrEqual(3));
  for (const f of sources) {
    it(`${f} neither imports nor calls search_cities / citySearch`, () => {
      const src = readFileSync(join(DIR, f), 'utf8');
      expect(src).not.toMatch(/['"]search_cities['"]/);
      expect(src).not.toMatch(/onboarding\/citySearch|CitySheetBody|searchCities\s*\(/);
    });
  }
});
