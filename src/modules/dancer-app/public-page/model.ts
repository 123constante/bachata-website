import type { DancerPublicViewModel } from '@/modules/profile/dancerPublicProfile';
import { buildSignInHref } from '@/lib/authRouting';

/**
 * Public dancer page v2 (W2f / B1b S2): everything the page SHOWS, as plain data,
 * so the table-driven tests can check every shape without rendering, and so the
 * component holds no rule of its own.
 *
 * The page mode is decided ONCE, in the route loader (app/routes/dancers.tsx),
 * from dancer_area_gate_v1's `open` (anon may call it; signed out it answers the
 * global flag). The loader hands `PublicPageV2Data` to the page, so the server
 * HTML and the first paint agree. `null` = today's page, byte-for-byte: the flag
 * is closed, or the flag read failed.
 */
export type PublicPageExtras = { bio: string | null; languages: string[]; whatsapp: string | null };
/** `extrasOk` false = the extras read failed: the page then claims nothing about contacts it could not read. */
export type PublicPageV2Data = { extras: PublicPageExtras; extrasOk: boolean };

export const NO_EXTRAS: PublicPageExtras = { bio: null, languages: [], whatsapp: null };

/**
 * wa.me wants digits only, country code first. The save RPC accepts local
 * numbers too, and this is a UK site, so a number with no "+" that starts "00"
 * drops the 00, and one that starts with a single "0" is read as UK (0 -> 44).
 * The UK habit "+44 (0)7700..." drops the "(0)", and "+44 07700..." its stray 0.
 * Anything it cannot normalise gets NO button rather than a wrong link: letters
 * or other symbols ("ext 5"), no "+" / "00" / "0" prefix (country unknown), or
 * fewer than 7 / more than 15 digits (E.164).
 */
export const whatsappHref = (raw: string | null): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^[+\d\s().\-/]+$/.test(trimmed)) return null;
  const international = trimmed.startsWith('+') || trimmed.startsWith('00');
  let digits = (international ? trimmed.replace(/\(\s*0\s*\)/g, '') : trimmed).replace(/\D/g, '');
  if (trimmed.startsWith('+')) {
    // nothing to strip
  } else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `44${digits.slice(1)}`;
  else return null;
  if (digits.startsWith('440')) digits = `44${digits.slice(3)}`;
  return digits.length >= 7 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
};

/** Built lazily: Intl.DisplayNames is missing on very old browsers (then only FALLBACK_LANGUAGE_NAMES apply). */
let displayNames: Intl.DisplayNames | null | undefined;
let knownNames: Map<string, string> | undefined;

/** The codes prod stores today (survey 2026-10-17) plus the commonest, for a browser without Intl.DisplayNames. */
const FALLBACK_LANGUAGE_NAMES: Record<string, string> = {
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
export const languageNames = (raw: readonly unknown[]): string[] => {
  const out: string[] = [];
  for (const value of raw) {
    const name = languageName(value);
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
};

/**
 * The share-sheet title for a profile with no public name (2 live on prod,
 * 2026-10-17). Owner decision (F18): keep this neutral wording, never an id or a
 * guessed name; one constant so the page and the tests cannot drift.
 */
export const NAMELESS_SHARE_TITLE = 'Dancer on Bachata Calendar';

/** The same five bands today's Experience tile uses (DancerProfileGrid). */
export const experienceLevel = (years: number): string => {
  if (years >= 8) return 'Veteran';
  if (years >= 4) return 'Experienced';
  if (years >= 2) return 'Intermediate';
  if (years >= 1) return 'Rising';
  return 'Newcomer';
};

const lastPathSegment = (url: string): string | null => {
  try {
    const u = new URL(url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`);
    return u.pathname.split('/').filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
};

/** Today's Instagram card label: "@handle", or "@instagram" when the link has no handle. */
export const instagramLabel = (url: string | null): string | null => {
  if (!url?.trim()) return null;
  const seg = lastPathSegment(url.trim());
  return seg ? `@${seg}` : '@instagram';
};

/** Today's Facebook card label: "facebook.com/name", or a plain "View Facebook profile". */
export const facebookLabel = (url: string | null): string | null => {
  if (!url?.trim()) return null;
  const seg = lastPathSegment(url.trim());
  return seg && seg !== 'profile.php' ? `facebook.com/${seg}` : 'View Facebook profile';
};

/** `label` is what the row shows (the handle or address); `copyText` is the FULL text the Copy button copies. */
export type ContactLink = { kind: 'instagram' | 'facebook' | 'website' | 'email' | 'whatsapp'; href: string; label: string; copyText: string };

/** One "Going next" card. Built from the dancer's own opt-in list; see GoingNextInput. */
export type GoingNextEvent = { id: string; date: string; name: string; venue: string | null };
export type GoingNextInput = { optIn: boolean; events: readonly GoingNextEvent[] };
/** 1 event = one full-width card, 2 = side by side, more = the first two plus "See all N events". */
export type GoingNextModel = { shown: GoingNextEvent[]; total: number; seeAll: boolean };

/**
 * F13 teal card facts. A column exists only when its value does; none = no row.
 * Level is the same five bands as experienceLevel (one mapping, every screen).
 */
export type CardFacts = { dancing: string | null; level: string | null; style: string | null };

const UK_POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi;
const OUTWARD_CODE = /\b[A-Z]{1,2}\d[A-Z\d]?\b$/i;
/** City name only: a postcode (or its outward half) that leaked into the city field is cut off. */
export const cityOnly = (raw: string | null): string | null => {
  if (!raw) return null;
  const name = raw.replace(UK_POSTCODE, '').replace(OUTWARD_CODE, '').replace(/[,\s]+$/, '').trim();
  return name || null;
};

/** partner_practice_goals -> "Goal: ..." text: first two, joined in plain words; null = hide the line. */
export const practiceGoalText = (goals: readonly string[]): string | null => {
  const picked = goals.slice(0, 2).map((g) => g.trim().toLowerCase()).filter(Boolean);
  return picked.length ? picked.join(' and ') : null;
};

export const goingNextModel = (input: GoingNextInput | undefined): GoingNextModel | null => {
  // Going is private and beta-only today: OFF unless the dancer opted in.
  if (!input?.optIn || input.events.length === 0) return null;
  return { shown: input.events.slice(0, 2), total: input.events.length, seeAll: input.events.length > 2 };
};

export type PublicDancerPageModel = {
  /** The heading. "Dancer" only when no real name resolves (the head is still noindexed by the loader). */
  name: string;
  /** What the share sheet is titled: "<name> on Bachata Calendar", or NAMELESS_SHARE_TITLE. */
  shareTitle: string;
  avatarUrl: string | null;
  nationalityCode: string | null;
  /** "London, middle dot, Spain", or null. */
  place: string | null;
  role: string | null;
  bio: string | null;
  languages: string[];
  whatsappHref: string | null;
  experience: { years: number; level: string } | null;
  contacts: ContactLink[];
  /** The F13 card: city name only, facts row, languages. */
  city: string | null;
  facts: CardFacts;
  /** The gold stamp: only when looking_for_partner is true. goal = null hides the Goal line. */
  stamp: { goal: string | null } | null;
  goingNext: GoingNextModel | null;
  practice: {
    status: string;
    lookingFor: string | null;
    levels: string[];
    goals: string[];
    details: string | null;
  } | null;
  songs: string[];
  styles: string[];
  highlights: string[];
  gallery: string[];
};

export const GALLERY_MAX = 12;

// Postgres text[] may hold NULL elements: keep strings only, trimmed, non-empty.
const clean = (xs: readonly unknown[]): string[] =>
  xs.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean);

export const buildPublicDancerPage = (
  view: DancerPublicViewModel,
  extras: PublicPageExtras,
  galleryUrls: readonly unknown[] = [],
  goingNext?: GoingNextInput,
): PublicDancerPageModel => {
  const name = view.displayName ?? 'Dancer';
  const years = view.yearsDancing !== null ? Number(view.yearsDancing) : NaN;
  const wa = whatsappHref(extras.whatsapp);
  const links = view.connectLinks;
  const contacts: ContactLink[] = [];
  if (wa) contacts.push({ kind: 'whatsapp', href: wa, label: extras.whatsapp!.trim(), copyText: extras.whatsapp!.trim() });
  const ig = instagramLabel(links.instagram);
  if (links.instagram && ig) contacts.push({ kind: 'instagram', href: links.instagram, label: ig, copyText: ig });
  const fb = facebookLabel(links.facebook);
  if (links.facebook && fb) contacts.push({ kind: 'facebook', href: links.facebook, label: fb, copyText: links.facebook });
  if (links.website) contacts.push({ kind: 'website', href: links.website, label: links.website.replace(/^https?:\/\//, '').replace(/\/$/, ''), copyText: links.website });
  if (links.email) contacts.push({ kind: 'email', href: `mailto:${links.email}`, label: links.email, copyText: links.email });

  const hasPractice =
    view.lookingForPartner ||
    Boolean(view.partnerSearchRole) ||
    view.partnerPracticeGoals.length > 0 ||
    view.partnerSearchLevel.length > 0 ||
    Boolean(view.partnerDetailsText);

  return {
    name,
    shareTitle: view.displayName ? `${view.displayName} on Bachata Calendar` : NAMELESS_SHARE_TITLE,
    avatarUrl: view.avatarUrl,
    nationalityCode: view.nationalityCode,
    // Today prints the nationality only next to a city; v2 shows whichever exists.
    place: [view.city, view.nationality].filter(Boolean).join(' \u00b7 ') || null,
    role: view.partnerRole,
    bio: extras.bio?.trim() || null,
    languages: languageNames(extras.languages),
    whatsappHref: wa,
    experience: Number.isFinite(years) && years >= 0 ? { years, level: experienceLevel(years) } : null,
    contacts,
    city: cityOnly(view.city),
    facts: {
      dancing: Number.isFinite(years) && years >= 0 ? `${years} ${years === 1 ? 'year' : 'years'}` : null,
      level: Number.isFinite(years) && years >= 0 ? experienceLevel(years) : null,
      style: clean(view.favoriteStyles).join(', ') || null,
    },
    stamp: view.lookingForPartner ? { goal: practiceGoalText(clean(view.partnerPracticeGoals)) } : null,
    goingNext: goingNextModel(goingNext),
    practice: hasPractice
      ? {
          status: view.lookingForPartner ? 'Up for practice' : 'Not right now',
          lookingFor: view.partnerSearchRole,
          levels: view.partnerSearchLevel,
          goals: view.partnerPracticeGoals,
          details: view.partnerDetailsText || null,
        }
      : null,
    songs: view.favoriteSongs,
    styles: view.favoriteStyles,
    highlights: view.achievements,
    gallery: clean(galleryUrls).slice(0, GALLERY_MAX),
  };
};

/** Where Join sends a signed-out visitor: create an account (the site's one href rule), then straight back here. */
export const joinHref = (pathname: string): string => buildSignInHref(pathname, 'signup');

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'manual';

type ShareEnv = {
  share?: (data: { title?: string; url?: string }) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
};

/**
 * Web Share first (the phone's own share sheet); else copy the link; else
 * 'manual' (the page then shows the link to copy by hand). A person closing the
 * share sheet ('AbortError') is 'cancelled': no message, nothing copied.
 */
export const shareDancerPage = async (env: ShareEnv, title: string, url: string): Promise<ShareOutcome> => {
  if (env.share) {
    try {
      await env.share({ title, url });
      return 'shared';
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
    }
  }
  if (env.writeText) {
    try {
      await env.writeText(url);
      return 'copied';
    } catch {
      /* fall through */
    }
  }
  return 'manual';
};

export const SHARE_MESSAGES: Record<ShareOutcome, string | null> = {
  shared: null,
  cancelled: null,
  copied: 'Link copied. Paste it anywhere to share this page.',
  manual: 'Copy this link to share the page:',
};
