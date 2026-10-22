/**
 * D72: wizard/wizardCountries.ts is a COPY of the country rule in
 * src/constants/countries.ts (kept apart so the dancer-app chunk count holds).
 * This pin makes the copy unable to drift: same codes, same names, same order.
 */
import { describe, expect, it } from 'vitest';
import { loadCountries } from '@/constants/countries';
import { wizardCountries } from '../wizardCountries';

describe('wizardCountries equals loadCountries (D72)', () => {
  it('same codes and names in the same order', async () => {
    const [copy, source] = await Promise.all([wizardCountries(), loadCountries()]);
    expect(copy.length).toBeGreaterThan(190);
    expect(copy.map((c) => c.code)).toEqual(source.map((c) => c.code));
    expect(copy.map((c) => c.name)).toEqual(source.map((c) => c.name));
  });
});
