/**
 * The ONE rule for "does this person show a nationality flag, and what does it say".
 *
 * Every public read that carries a person (list_public_djs_v1, get_public_dj_v1,
 * get_public_teachers_list_v1, get_public_teacher_detail_v1, get_all_profiles_v1,
 * get_event_program_v1, get_occurrence_program_v1, event_view_p5 legacy_compat (each
 * programme person, admin #799), get_public_festival_detail_v2,
 * search_public_v4/v5/v6, get_public_vendor_detail_v1) emits `nationality_code`: an
 * upper-case ISO 3166-1 alpha-2 code, or null when the nationality is unknown or could
 * not be mapped with certainty (admin #774). Direct table reads (dancer_profiles,
 * videographers) carry the stored `nationality`, which a trigger now keeps as the same
 * alpha-2 code (or the typed value when it cannot be mapped) -- this function turns
 * either into a code or null, so the two paths read the same.
 *
 * Null, empty, a non-code string, a private-use code and a code Intl does not know
 * all mean NO flag: no placeholder, no gap.
 */

/**
 * Codes that pass /^[A-Z]{2}$/ and that Intl may even name, but are not a nationality we
 * show. XK (Kosovo) mirrors the backend, which deliberately emits null for it.
 */
const NOT_A_NATIONALITY = new Set(['AA', 'EU', 'EZ', 'UN', 'UK', 'XK', 'ZZ']);

const isPrivateUse = (c: string) => (c >= 'QM' && c <= 'QZ') || (c >= 'XA' && c <= 'XZ');

let names: Intl.DisplayNames | null | undefined;
function regionNames(): Intl.DisplayNames | null {
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames(['en-GB'], { type: 'region', fallback: 'none' });
    } catch {
      names = null;
    }
  }
  return names;
}

/** The alpha-2 code to show a flag for, or null for no flag. Accepts any input shape. */
export function normaliseNationalityCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  if (NOT_A_NATIONALITY.has(code) || isPrivateUse(code)) return null;
  return nationalityCountryName(code) ? code : null;
}

/** The country's English name ("Spain"), or null when Intl does not know the code. */
export function nationalityCountryName(code: string): string | null {
  const dn = regionNames();
  if (!dn) return null;
  try {
    const name = dn.of(code);
    if (!name || name === code || name === 'Unknown Region') return null;
    return name;
  } catch {
    return null;
  }
}

/** What the badge says to a screen reader and in its tooltip. One wording everywhere. */
export function nationalityLabel(raw: unknown): { code: string; name: string; ariaLabel: string } | null {
  const code = normaliseNationalityCode(raw);
  if (!code) return null;
  const name = nationalityCountryName(code) as string;
  return { code, name, ariaLabel: `Nationality: ${name}` };
}

/**
 * Photos smaller than this (CSS px) get NO sticker (owner decision 2026-10-13): a 20px
 * sticker on a 17-20px circle covers almost all of it. The country stays on the photo
 * as its aria-label and title instead (smallPhotoNationalityProps).
 */
export const MIN_FLAG_PHOTO_PX = 28;

/**
 * For a photo under MIN_FLAG_PHOTO_PX: the props that put the country on the photo
 * itself (role img, "Nationality: <country>", title). Empty for a bigger photo (the
 * sticker carries them) or no code.
 */
export function smallPhotoNationalityProps(raw: unknown, size: number): { role?: 'img'; 'aria-label'?: string; title?: string; 'data-nationality-photo'?: string } {
  const label = size < MIN_FLAG_PHOTO_PX ? nationalityLabel(raw) : null;
  return label ? { role: 'img', 'aria-label': label.ariaLabel, title: label.name, 'data-nationality-photo': label.code } : {};
}

/**
 * Reads `nationality_code` off any payload object. Only a row WITHOUT that key (a direct
 * table read) falls back to the stored `nationality`: when a read emits the key, its null
 * is a decision (hidden person, unmapped value) and must not be overridden.
 */
export function pickNationalityCode(row: unknown): string | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  return 'nationality_code' in r ? normaliseNationalityCode(r.nationality_code) : normaliseNationalityCode(r.nationality);
}
