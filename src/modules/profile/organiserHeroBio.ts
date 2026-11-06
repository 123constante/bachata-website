// One shared rule for the organiser bio: shown once, in the page header, 150
// characters. Pure ASCII source: punctuation is written as \u escapes.

export const BIO_LIMIT = 150;
const WORD_BACK = 20;

export type HeroBio = { text: string | null; truncated: boolean; fallback: boolean };

const cps = (s: string): string[] => Array.from(s);

/** Code-point length after trimming (what the counters show). */
export const bioLength = (raw: string): number => cps(raw.trim()).length;

/** Header text for a bio. Never mutates or drops the saved bio. */
export function heroBio(
  bio: string | null | undefined,
  cityName: string | null | undefined,
  category: string | null | undefined,
): HeroBio {
  const chars = cps((bio ?? '').trim());
  if (chars.length === 0) {
    const line = [cityName, category]
      .map((p) => (p ?? '').trim())
      .filter(Boolean)
      .join(' · ');
    return { text: line || null, truncated: false, fallback: line !== '' };
  }
  if (chars.length <= BIO_LIMIT) return { text: chars.join(''), truncated: false, fallback: false };
  let cut = chars.slice(0, BIO_LIMIT);
  for (let i = BIO_LIMIT - 1; i >= BIO_LIMIT - WORD_BACK; i -= 1) {
    if (/\s/.test(chars[i])) {
      cut = chars.slice(0, i);
      break;
    }
  }
  return { text: cut.join('').trimEnd() + '…', truncated: true, fallback: false };
}

/**
 * Editor input rule: typing or pasting that would pass the limit is cut at
 * the limit, UNLESS the value loaded into the editor was already longer
 * (then nothing is blocked; the editor only refuses to save until shortened).
 * Deleting is always allowed.
 */
export function limitBioInput(next: string, loaded: string): string {
  if (bioLength(loaded) > BIO_LIMIT) return next;
  const chars = cps(next);
  return chars.length > BIO_LIMIT ? chars.slice(0, BIO_LIMIT).join('') : next;
}

export const BIO_SHORTEN_REASON = 'Shorten to 150 characters to save';
