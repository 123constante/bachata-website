// The nationality step's country list. It reads the same world-countries data
// as src/constants/countries.ts (UN members plus Palestine and Vatican City,
// stored as the upper-case two-letter code) WITHOUT importing that module: a
// static import made it a chunk of its own, one more first-load request on
// every /app/* view (the dancer-app chunk ratchet, check:bundle-budget).
import { safeDynamicImport } from '@/lib/lazyWithRetry';

export interface WizardCountry { code: string; name: string }

let cached: WizardCountry[] | null = null;

export async function wizardCountries(): Promise<WizardCountry[]> {
  if (cached) return cached;
  const { default: world } = await safeDynamicImport(() => import('world-countries'));
  const byCode = new Map<string, WizardCountry>();
  for (const c of world) {
    const code = c.cca2?.toUpperCase();
    const name = c.name?.common?.trim();
    if (c.unMember && code && code.length === 2 && name) byCode.set(code, { code, name });
  }
  byCode.set('PS', { code: 'PS', name: 'Palestine' });
  byCode.set('VA', { code: 'VA', name: 'Vatican City' });
  cached = [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
  return cached;
}

/** The name for a stored code, once the list has loaded (else the code itself). */
export const countryNameFor = (code: string): string => cached?.find((c) => c.code === code.toUpperCase())?.name ?? code;
