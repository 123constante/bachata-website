import worldCountries from 'world-countries';

export type Country = {
  code: string;
  name: string;
  flag: string; // Emoji fallback
  flagUrl: string;
};

const FLAG_CDN_BASE = 'https://flagcdn.com';

const toFlagEmoji = (code: string): string => {
  if (!code) return '';
  const alphabeticCode = code
    .toUpperCase()
    .replace(/[^A-Z]/g, '');

  if (alphabeticCode.length !== 2) {
    return '';
  }

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

const mapWorldCountry = (country: (typeof worldCountries)[number]): Country | null => {
  const code = country.cca2?.toUpperCase();
  const name = country.name?.common?.trim();

  if (!code || code.length !== 2 || !name) {
    return null;
  }

  return buildCountry(code, name);
};

const unitedNationsMembers: Country[] = worldCountries
  .filter((country) => country.unMember)
  .map(mapWorldCountry)
  .filter((country): country is Country => Boolean(country));

// Observer states bring the list to the full 195 sovereign countries.
const observerStates: Country[] = [
  buildCountry('PS', 'Palestine'),
  buildCountry('VA', 'Vatican City'),
];

const countriesByCode = new Map<string, Country>();

[...unitedNationsMembers, ...observerStates].forEach((country) => {
  countriesByCode.set(country.code, country);
});

export const ALL_COUNTRIES: Country[] = Array.from(countriesByCode.values()).sort((a, b) =>
  a.name.localeCompare(b.name)
);

export const TOTAL_SOVEREIGN_COUNTRIES = ALL_COUNTRIES.length; // Should be 195
