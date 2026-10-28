import { safeDynamicImport } from '@/lib/lazyWithRetry';

export type Country = {
  code: string;
  name: string;
  flag: string;
  flagUrl: string;
};

const FLAG_CDN_BASE = 'https://flagcdn.com';

/** ISO 3166-2 home nations, stored as the 5-char code and listed beside United Kingdom (GB). */
export const HOME_NATIONS: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'GB-ENG', name: 'England' },
  { code: 'GB-NIR', name: 'Northern Ireland' },
  { code: 'GB-SCT', name: 'Scotland' },
  { code: 'GB-WLS', name: 'Wales' },
];

const toFlagEmoji = (code: string): string => {
  if (!code) return '';
  const upper = code.toUpperCase();
  // Subdivision flags are an emoji tag sequence (black flag + tag letters + cancel tag).
  if (/^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(upper)) {
    const tags = upper.replace('-', '').toLowerCase().split('').map((c) => String.fromCodePoint(c.charCodeAt(0) + 0xe0000));
    return `\u{1F3F4}${tags.join('')}\u{E007F}`;
  }
  const alphabeticCode = upper.replace(/[^A-Z]/g, '');
  if (alphabeticCode.length !== 2) return '';
  return alphabeticCode
    .split('')
    .map((char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
    .join('');
};

const buildCountry = (code: string, name: string): Country => {
  const normalizedCode = code.toUpperCase();
  return {
    code: normalizedCode,
    name,
    flag: toFlagEmoji(normalizedCode),
    flagUrl: `${FLAG_CDN_BASE}/w40/${normalizedCode.toLowerCase()}.png`,
  };
};

let cachedCountries: Country[] | null = null;

export async function loadCountries(): Promise<Country[]> {
  if (cachedCountries) return cachedCountries;

  const { default: worldCountries } = await safeDynamicImport(() => import('world-countries'));

  type WC = (typeof worldCountries)[number];
  const mapWorldCountry = (country: WC): Country | null => {
    const code = country.cca2?.toUpperCase();
    const name = country.name?.common?.trim();
    if (!code || code.length !== 2 || !name) return null;
    return buildCountry(code, name);
  };

  const isoCountries: Country[] = worldCountries
    .map(mapWorldCountry)
    .filter((country): country is Country => Boolean(country));

  const homeNations = HOME_NATIONS.map((n) => buildCountry(n.code, n.name));

  const countriesByCode = new Map<string, Country>();
  [...isoCountries, ...homeNations].forEach((country) => {
    countriesByCode.set(country.code, country);
  });

  cachedCountries = Array.from(countriesByCode.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return cachedCountries;
}

export const TOTAL_SOVEREIGN_COUNTRIES = 195;

// Synchronous accessor — returns the cached list if loaded, empty array otherwise.
// Components that need the full list should call loadCountries() first.
export function getLoadedCountries(): Country[] {
  return cachedCountries ?? [];
}
