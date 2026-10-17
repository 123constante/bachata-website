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
 * Fewer than 7 digits is not a phone number: no button.
 */
export const whatsappHref = (raw: string | null): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!trimmed.startsWith('+')) {
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = `44${digits.slice(1)}`;
  }
  return digits.length >= 7 ? `https://wa.me/${digits}` : null;
};

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

export type ContactLink = { kind: 'instagram' | 'facebook' | 'website' | 'email' | 'whatsapp'; href: string; label: string };

export type PublicDancerPageModel = {
  /** The heading. "Dancer" only when no real name resolves (the head is still noindexed by the loader). */
  name: string;
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
): PublicDancerPageModel => {
  const name = view.displayName ?? 'Dancer';
  const years = view.yearsDancing !== null ? Number(view.yearsDancing) : NaN;
  const wa = whatsappHref(extras.whatsapp);
  const links = view.connectLinks;
  const contacts: ContactLink[] = [];
  if (wa) contacts.push({ kind: 'whatsapp', href: wa, label: 'Message on WhatsApp' });
  const ig = instagramLabel(links.instagram);
  if (links.instagram && ig) contacts.push({ kind: 'instagram', href: links.instagram, label: ig });
  const fb = facebookLabel(links.facebook);
  if (links.facebook && fb) contacts.push({ kind: 'facebook', href: links.facebook, label: fb });
  if (links.website) contacts.push({ kind: 'website', href: links.website, label: 'Website' });
  if (links.email) contacts.push({ kind: 'email', href: `mailto:${links.email}`, label: 'Email' });

  const hasPractice =
    view.lookingForPartner ||
    Boolean(view.partnerSearchRole) ||
    view.partnerPracticeGoals.length > 0 ||
    view.partnerSearchLevel.length > 0 ||
    Boolean(view.partnerDetailsText);

  return {
    name,
    avatarUrl: view.avatarUrl,
    nationalityCode: view.nationalityCode,
    // Today prints the nationality only next to a city; v2 shows whichever exists.
    place: [view.city, view.nationality].filter(Boolean).join(' \u00b7 ') || null,
    role: view.partnerRole,
    bio: extras.bio?.trim() || null,
    languages: clean(extras.languages),
    whatsappHref: wa,
    experience: Number.isFinite(years) && years >= 0 ? { years, level: experienceLevel(years) } : null,
    contacts,
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
