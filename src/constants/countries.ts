import { safeDynamicImport } from '@/lib/lazyWithRetry';

export type Country = {
  code: string;
  name: string;
  flag: string;
  flagUrl: string;
};

const FLAG_CDN_BASE = 'https://flagcdn.com';

/** ISO 3166-2 home nations, stored as the 5-char code and listed beside United Kingdom (GB). */
const HOME_NATIONS: Record<string, string> = { ENG: 'England', NIR: 'Northern Ireland', SCT: 'Scotland', WLS: 'Wales' };

const toFlagEmoji = (code: string): string => {
  const cc = [...code.replace(/[^A-Z]/g, '')].map((c) => c.charCodeAt(0));
  // GB-ENG style: black flag + tag letters + cancel tag; otherwise two regional indicators.
  if (code.includes('-')) return String.fromCodePoint(0x1f3f4, ...cc.map((c) => c + 0xe0020), 0xe007f);
  return cc.length === 2 ? String.fromCodePoint(...cc.map((c) => c + 127397)) : '';
};

const buildCountry = (code: string, name: string): Country => ({
  code,
  name,
  flag: toFlagEmoji(code),
  flagUrl: `${FLAG_CDN_BASE}/w40/${code.toLowerCase()}.png`,
});

let cachedCountries: Country[] | null = null;

export async function loadCountries(): Promise<Country[]> {
  if (cachedCountries) return cachedCountries;

  const { default: worldCountries } = await safeDynamicImport(() => import('world-countries'));

  const isoCountries = worldCountries.map((c) => buildCountry(c.cca2.toUpperCase(), c.name.common));

  // ISO 3166-1 codes are unique and the home nations are GB-xxx, so no de-duplication is needed.
  cachedCountries = [...isoCountries, ...Object.entries(HOME_NATIONS).map(([c, n]) => buildCountry(`GB-${c}`, n))].sort((a, b) => a.name.localeCompare(b.name));

  return cachedCountries;
}

export const TOTAL_SOVEREIGN_COUNTRIES = 195;

// Synchronous accessor — returns the cached list if loaded, empty array otherwise.
// Components that need the full list should call loadCountries() first.
export function getLoadedCountries(): Country[] {
  return cachedCountries ?? [];
}
