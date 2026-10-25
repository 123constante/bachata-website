// The nationality step's country list. It reads the same world-countries data
// as src/constants/countries.ts (UN members plus Palestine and Vatican City,
// stored as the upper-case two-letter code) WITHOUT importing that module: a
// static import made it a chunk of its own, one more first-load request on
// every /app/* view (the dancer-app chunk ratchet, check:bundle-budget).
import { safeDynamicImport } from '@/lib/lazyWithRetry';

/** `demonym`: the English word for its people ("British"), so a search for the nationality finds the country (W2 walk fix 9). */
export interface WizardCountry { code: string; name: string; demonym?: string }

let cached: WizardCountry[] | null = null;

export async function wizardCountries(): Promise<WizardCountry[]> {
  if (cached) return cached;
  const { default: world } = await safeDynamicImport(() => import('world-countries'));
  const byCode = new Map<string, WizardCountry>();
  for (const c of world) {
    const code = c.cca2?.toUpperCase();
    const name = c.name?.common?.trim();
    const demonym = c.demonyms?.eng?.m?.trim() || undefined;
    if (c.unMember && code && code.length === 2 && name) byCode.set(code, { code, name, demonym });
  }
  byCode.set('PS', { code: 'PS', name: 'Palestine', demonym: 'Palestinian' });
  byCode.set('VA', { code: 'VA', name: 'Vatican City', demonym: 'Vatican' });
  cached = [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
  return cached;
}

/** Words people type for a country that neither its name nor its demonym holds. */
const ALSO: Readonly<Record<string, readonly string[]>> = {
  GB: ['UK', 'English', 'Scottish', 'Welsh', 'Northern Irish', 'Great Britain', 'England', 'Scotland', 'Wales'],
  US: ['USA', 'America'],
  AE: ['UAE', 'Emirati'],
  NL: ['Holland'],
};

/** The countries a search finds: by name, by nationality ("Brit"), or by a common other word ("UK"). */
export function matchCountries(list: readonly WizardCountry[], q: string): WizardCountry[] {
  const term = q.trim().toLowerCase();
  if (!term) return [...list];
  return list.filter((c) => [c.name, c.demonym ?? '', ...(ALSO[c.code] ?? [])].some((w) => w.toLowerCase().includes(term)));
}

/** The name for a stored code, once the list has loaded (else the code itself). */
export const countryNameFor = (code: string): string => cached?.find((c) => c.code === code.toUpperCase())?.name ?? code;
