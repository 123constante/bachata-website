// Stored language value -> the English name the public pages show. The ONE copy
// for src/lib and the people worlds (src/modules/person-page/facts).
//
// Lifted from src/modules/dancer-app/public-page/model.ts (languageName /
// languageNames). That copy stays until S2 of the people arc switches it here:
// changing a file under src/modules/dancer-app/ turns a PR into a dancer-area PR
// for scripts/check-dancer-area-isolation.mjs, which this foundation PR is not.

/** Built lazily: Intl.DisplayNames is missing on very old browsers (then only FALLBACK_LANGUAGE_NAMES apply). */
let displayNames: Intl.DisplayNames | null | undefined;
let knownNames: Map<string, string> | undefined;

/** The codes prod stores today (survey 2026-10-17) plus the commonest, for a browser without Intl.DisplayNames. */
export const FALLBACK_LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  en: 'English', es: 'Spanish', it: 'Italian', de: 'German', fr: 'French', pt: 'Portuguese', pl: 'Polish',
};

const languageNamer = (): Intl.DisplayNames | null => {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });
    } catch {
      displayNames = null;
    }
  }
  return displayNames;
};

const nameOfCode = (code: string): string | null => {
  const lower = code.toLowerCase();
  const namer = languageNamer();
  if (!namer) return FALLBACK_LANGUAGE_NAMES[lower] ?? null;
  try {
    const name = namer.of(lower);
    return name && name.toLowerCase() !== lower ? name : null;
  } catch {
    return null;
  }
};

/** lower-case English name -> its spelling, for every 2-letter code Intl can name (a stored "english" still reads "English"). */
const languageNameIndex = (): Map<string, string> => {
  if (!knownNames) {
    knownNames = new Map();
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    for (const a of letters) {
      for (const b of letters) {
        const name = nameOfCode(a + b);
        if (name) knownNames.set(name.toLowerCase(), name);
      }
    }
    for (const name of Object.values(FALLBACK_LANGUAGE_NAMES)) knownNames.set(name.toLowerCase(), name);
  }
  return knownNames;
};

/**
 * One stored language value -> the name the page shows, or null = hide it.
 * Prod stores ISO codes ("en", "es"; also accepted: "ES", "pt-BR", "pt_BR"); an
 * older save may hold the English name ("English"). A code Intl cannot name
 * ("xx", "zz-QQ") or free text that is not a language name is never shown raw.
 */
export const languageName = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  if (/^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$/.test(value)) {
    const fromCode = nameOfCode(value.replace(/_/g, '-'));
    if (fromCode) return fromCode;
  }
  return languageNameIndex().get(value.toLowerCase()) ?? null;
};

/** Every stored value mapped to a name, unknowns dropped, each name once (first-seen order). */
export const languageNames = (raw: readonly unknown[] | null | undefined): string[] => {
  const out: string[] = [];
  for (const value of raw ?? []) {
    const name = languageName(value);
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
};
