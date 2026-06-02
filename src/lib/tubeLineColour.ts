/**
 * Official TfL line palette + abbreviations, plus a fuzzy resolver that
 * matches the line_names strings we get back from the venue
 * transport_json (organisers type these freely - "Northern", "northern",
 * "Northern Line", "n" etc all need to map to the same line).
 *
 * Hex values from TfL's brand guidelines (2024 refresh).
 *
 * Decided 2026-04-30 (Ricky): underground line names render as solid
 * pills in the line's own colour, so the colour is visually inseparable
 * from the line name. No floating colour swatches.
 */

export type TubeLine = {
  /** Canonical full name (e.g. "Northern"). */
  name: string;
  /** Short tag for tight chip space (e.g. "Nrn"). 2-4 chars. */
  abbr: string;
  /** Hex line colour for the pill background. */
  bg: string;
  /** Hex text colour with adequate contrast against bg. */
  fg: string;
};

const LINES: TubeLine[] = [
  { name: 'Bakerloo',          abbr: 'Bak', bg: '#B36305', fg: '#FFFFFF' },
  { name: 'Central',           abbr: 'Cen', bg: '#E32017', fg: '#FFFFFF' },
  { name: 'Circle',            abbr: 'Cir', bg: '#FFD300', fg: '#101010' },
  { name: 'District',          abbr: 'Dis', bg: '#00782A', fg: '#FFFFFF' },
  { name: 'Hammersmith & City',abbr: 'H&C', bg: '#F3A9BB', fg: '#101010' },
  { name: 'Jubilee',           abbr: 'Jub', bg: '#A0A5A9', fg: '#101010' },
  { name: 'Metropolitan',      abbr: 'Met', bg: '#9B0056', fg: '#FFFFFF' },
  { name: 'Northern',          abbr: 'Nrn', bg: '#000000', fg: '#FFFFFF' },
  { name: 'Piccadilly',        abbr: 'Pic', bg: '#003688', fg: '#FFFFFF' },
  { name: 'Victoria',          abbr: 'Vic', bg: '#0098D4', fg: '#FFFFFF' },
  { name: 'Waterloo & City',   abbr: 'W&C', bg: '#95CDBA', fg: '#101010' },
  { name: 'Elizabeth',         abbr: 'Liz', bg: '#6950A1', fg: '#FFFFFF' },
  { name: 'DLR',               abbr: 'DLR', bg: '#00A4A7', fg: '#FFFFFF' },
  { name: 'Overground',        abbr: 'Ovg', bg: '#EE7C0E', fg: '#FFFFFF' },
  { name: 'Tramlink',          abbr: 'Tra', bg: '#84B817', fg: '#101010' },
  { name: 'Thameslink',        abbr: 'TLk', bg: '#E10082', fg: '#FFFFFF' },
  { name: 'National Rail',     abbr: 'NR',  bg: '#C00000', fg: '#FFFFFF' },
];

// Fallback for a line name we don't recognise - render as brass pill so
// the layout stays consistent and the chip is still legible.
const FALLBACK: TubeLine = {
  name: '',
  abbr: '?',
  bg: '#C28F4A',
  fg: '#101010',
};

const norm = (s: string): string =>
  s.toLowerCase().replace(/[\s_&-]+/g, '').replace(/line$/, '').trim();

const ALIASES: Record<string, string> = {
  'h&c': 'hammersmithcity',
  'hc': 'hammersmithcity',
  'hammersmithandcity': 'hammersmithcity',
  'w&c': 'waterloocity',
  'wc': 'waterloocity',
  'waterlooandcity': 'waterloocity',
  'liz': 'elizabeth',
  'lizzy': 'elizabeth',
  'crossrail': 'elizabeth',
  'lu': 'underground',
  'tube': 'underground',
  'piccadily': 'piccadilly',  // common typo
  'tramink': 'tramlink',
  'natlrail': 'nationalrail',
  'natrail': 'nationalrail',
  'nr': 'nationalrail',
};

export const matchKnownLine = (raw: string | null | undefined): TubeLine | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const key = ALIASES[norm(trimmed)] ?? norm(trimmed);
  for (const line of LINES) {
    if (norm(line.name) === key || norm(line.abbr) === key) {
      return { ...line, name: line.name };
    }
  }
  return null;
};

export const resolveTubeLine = (raw: string | null | undefined): TubeLine => {
  const matched = matchKnownLine(raw);
  if (matched) return matched;
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return FALLBACK;
  // Unrecognised: keep the original string as the displayed name.
  return { ...FALLBACK, name: trimmed, abbr: trimmed.length <= 4 ? trimmed : trimmed.slice(0, 3) };
};

/**
 * Split a freeform line_names value into discrete line names. Organisers
 * sometimes type the lot as one string ("Jubilee and Northern line",
 * "Circle and District lines"); we split on commas and the space-bounded
 * word "and" so each renders as its own coloured chip. A value that already
 * resolves to a known line (e.g. "Hammersmith & City", "National Rail") is
 * returned untouched so its internal connector is never split.
 */
export const splitLineNames = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (matchKnownLine(trimmed)) return [trimmed];
  const body = trimmed.replace(/\s+lines?$/i, '');
  const parts = body
    .split(/\s*,\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts : [trimmed];
};
