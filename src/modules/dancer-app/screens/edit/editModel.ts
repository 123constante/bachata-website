import { getLoadedCountries, type Country } from '@/constants/countries';

/**
 * Review S12: dancer_profiles.nationality holds an ISO 3166 alpha-2 code (prod:
 * every non-empty row, read-only survey 2026-10-15) and the public flag reads it.
 * The shared NationalityPicker shows the country NAME and hands back the name it
 * lists; this turns the pick back into the code before it reaches the draft.
 * "" (cleared) stays "". A pick the list does not know is kept as typed, so the
 * server's own check has the last word.
 */
export const nationalityCodeForPick = (pick: string, countries: readonly Country[] = getLoadedCountries()): string => {
  const v = pick.trim();
  if (v === '') return '';
  const hit = countries.find((c) => c.name.toLowerCase() === v.toLowerCase() || c.code.toLowerCase() === v.toLowerCase());
  return hit ? hit.code.toUpperCase() : v;
};

/** What Edit says once a save lands (never the word "Saved": the copy rule bans it). */
export const SAVE_DONE = 'Your changes are live.';

/**
 * The style chips (review S11): the presets, then each stored or drafted value the
 * presets do not hold, ONCE (compared trimmed and case-insensitively, so a stored
 * "zouk" selects the "Zouk" preset instead of adding a second chip).
 */
export const styleChipOptions = (presets: readonly string[], ...lists: ReadonlyArray<readonly string[]>): string[] => {
  const out = [...presets];
  const seen = new Set(out.map((s) => s.trim().toLowerCase()));
  for (const list of lists) {
    for (const s of list) {
      const k = s.trim().toLowerCase();
      if (k === '' || seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
  }
  return out;
};

/** The chip that stands for a stored value: its own spelling, or the preset it matches case-insensitively. */
export const chipFor = (options: readonly string[], value: string): string =>
  options.find((o) => o.trim().toLowerCase() === value.trim().toLowerCase()) ?? value;
