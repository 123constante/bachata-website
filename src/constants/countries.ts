export type Country = {
  code: string;
  name: string;
  flag: string;
  flagUrl: string;
};

const FLAG_CDN_BASE = 'https://flagcdn.com';

const toFlagEmoji = (code: string): string => {
  if (!code) return '';
  const alphabeticCode = code.toUpperCase().replace(/[^A-Z]/g, '');
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

  const { default: worldCountries } = await import('world-countries');

  type WC = (typeof worldCountries)[number];
  const mapWorldCountry = (country: WC): Country | null => {
    const code = country.cca2?.toUpperCase();
    const name = country.name?.common?.trim();
    if (!code || code.length !== 2 || !name) return null;
    return buildCountry(code, name);
  };

  const unitedNationsMembers: Country[] = worldCountries
    .filter((country) => country.unMember)
    .map(mapWorldCountry)
    .filter((country): country is Country => Boolean(country));

  const observerStates: Country[] = [
    buildCountry('PS', 'Palestine'),
    buildCountry('VA', 'Vatican City'),
  ];

  const countriesByCode = new Map<string, Country>();
  [...unitedNationsMembers, ...observerStates].forEach((country) => {
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
