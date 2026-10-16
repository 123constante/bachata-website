import { buildCityPath } from '@/lib/cityPath';
import { WHATSAPP_GET_LISTED_URL } from '@/lib/contactLinks';
import { hrefFor } from '@/lib/searchEntities';
import { SITE_ORIGIN } from '@/lib/seo';
import type { MyDancerEdit } from '../../api/types';
import { ACCOUNT_SETTINGS_LABEL, HIDDEN_STATE_LINE, SHOW_AGAIN_LABEL } from '../../copy/sharedCopy';

/**
 * Everything the Options screen decides, as plain data: which rows exist, which
 * are enabled, and WHY a disabled one is disabled. The screen only renders it,
 * and the table-driven test reads the same model (one mapping per fact).
 */

export type OptionsRowId =
  | 'switch-organiser'
  | 'share'
  | 'feedback'
  | 'install'
  | 'help'
  | 'terms'
  | 'privacy'
  | 'sign-out';

/** A row is a link, a button (opens a sheet or acts), or disabled WITH its reason. */
export type OptionsRow = {
  id: OptionsRowId;
  label: string;
  /** Route or external URL; set for rows that navigate. */
  href?: string;
  /** Present exactly when the row is disabled. */
  disabledReason?: string;
};

export const ORGANISER_AREA_PATH = '/account/o';
export const ACCOUNT_SETTINGS_PATH = '/account/settings';
/** The site home (the events feed). The ONE way back to the site from Options (audit L9). */
export const SITE_HOME_PATH = buildCityPath(null);

/** The profile types of the person, as the Switch profile group lists them. */
export type ProfileTypes = { organising: boolean; teaching: boolean; djing: boolean };

export const profileTypesOf = (otherRoles: readonly string[]): ProfileTypes => ({
  organising: otherRoles.includes('organising'),
  teaching: otherRoles.includes('teaching'),
  djing: otherRoles.includes('djing'),
});

/**
 * The public page of a dancer, in the site's one URL form (searchEntities.hrefFor;
 * /dancers/:id redirects to the slug form). Never built by hand elsewhere.
 */
export const shareUrlFor = (profileId: string): string => `${SITE_ORIGIN}${hrefFor('dancer', profileId)}`;

/**
 * The site's existing direct WhatsApp chat (the number in WHATSAPP_GET_LISTED_URL),
 * with a message for this screen. The number is read from the one constant, never copied.
 * ORCHESTRATOR: export the number (or a message-us builder) from src/lib/contactLinks.tsx and
 * replace this parse; W2e must not edit that file.
 */
export const messageUsUrl = (text: string): string => {
  const base = new URL(WHATSAPP_GET_LISTED_URL);
  return `${base.origin}${base.pathname}?text=${encodeURIComponent(text)}`;
};
export const FEEDBACK_MESSAGE = "Hi! Feedback on the Bachata Calendar dancer area: what's missing is ";
export const HELP_MESSAGE = 'Hi! I need help with my Bachata Calendar dancer profile.';

/**
 * Why Share is off for a hidden profile (audit M16): the shared hidden line, then the
 * fix, naming the control by its shared label and the page by its shared name. The
 * screen links that page right below the rows, so the line never points at nothing.
 */
export const HIDDEN_SHARE_REASON = `${HIDDEN_STATE_LINE} To share it, tap ${SHOW_AGAIN_LABEL} in ${ACCOUNT_SETTINGS_LABEL}.`;
/** A dancer who runs no events: a quiet way into today's organiser request flow (owner workflow 2026-10-15). */
export const BECOME_ORGANISER_LABEL = 'Run events? Become an organiser';
export const TERMS_PATH = '/terms';
export const PRIVACY_PATH = '/privacy';

/**
 * Row order (audit L9): what a dancer does here first (share, feedback, install, help),
 * then the organiser way in, then the legal pages, then sign out. The teacher and DJ
 * rows are not shown until those areas exist (audit L12): no "coming soon" rows.
 */
export const optionsRows = (profile: Pick<MyDancerEdit, 'other_roles' | 'is_active'>): OptionsRow[] => {
  const types = profileTypesOf(profile.other_roles);
  const rows: OptionsRow[] = [];

  rows.push(
    profile.is_active
      ? { id: 'share', label: 'Share my page' }
      : { id: 'share', label: 'Share my page', disabledReason: HIDDEN_SHARE_REASON },
  );
  rows.push({ id: 'feedback', label: "Send feedback: what's missing?", href: messageUsUrl(FEEDBACK_MESSAGE) });
  rows.push({ id: 'install', label: "Add to my phone's home screen" });
  rows.push({ id: 'help', label: 'Help and message us', href: messageUsUrl(HELP_MESSAGE) });
  rows.push(
    types.organising
      ? { id: 'switch-organiser', label: 'I run events', href: ORGANISER_AREA_PATH }
      : { id: 'switch-organiser', label: BECOME_ORGANISER_LABEL, href: ORGANISER_AREA_PATH },
  );
  rows.push({ id: 'terms', label: 'Terms', href: TERMS_PATH });
  rows.push({ id: 'privacy', label: 'Privacy policy', href: PRIVACY_PATH });
  rows.push({ id: 'sign-out', label: 'Sign out' });
  return rows;
};

/** In-app destinations a row or link can use; the test checks each against catchallClientPaths. */
export const optionsInAppHrefs = (profile: Pick<MyDancerEdit, 'other_roles' | 'is_active'>): string[] => [
  ...optionsRows(profile).flatMap((r) => (r.href && r.href.startsWith('/') ? [r.href] : [])),
  SITE_HOME_PATH,
  ACCOUNT_SETTINGS_PATH,
];

export type Platform = 'ios' | 'android' | 'desktop';

export const detectPlatform = (userAgent: string, maxTouchPoints = 0): Platform => {
  if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios';
  // iPadOS 13+ reports as a Mac with touch.
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'desktop';
};

export const INSTALL_STEPS: Record<'ios' | 'android', { title: string; steps: string[] }> = {
  ios: {
    title: 'iPhone or iPad (Safari)',
    steps: [
      'Open this page in Safari.',
      'Tap the Share button (the square with an arrow).',
      'Scroll down and tap Add to Home Screen.',
      'Tap Add.',
    ],
  },
  android: {
    title: 'Android (Chrome)',
    steps: [
      'Open this page in Chrome.',
      'Tap the menu (three dots) at the top right.',
      'Tap Add to Home screen (or Install app).',
      'Tap Add.',
    ],
  },
};

/** The sheet shows the person's platform first; desktop sees iPhone then Android. */
export const installOrder = (p: Platform): Array<'ios' | 'android'> => (p === 'android' ? ['android', 'ios'] : ['ios', 'android']);

export type CopyOutcome = 'copied' | 'manual';
export type ShareOutcome = CopyOutcome | 'shared' | 'cancelled';

/** Clipboard API, or 'manual' (the screen then shows a selectable field). */
export const copyText = async (text: string, nav: Pick<Navigator, 'clipboard'> | undefined = typeof navigator === 'undefined' ? undefined : navigator): Promise<CopyOutcome> => {
  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    /* denied or unavailable: fall through to the manual field */
  }
  return 'manual';
};

type ShareNav = Partial<Pick<Navigator, 'share' | 'clipboard'>>;

/**
 * Share my page (audit L15): the phone's own share sheet when there is one; the person
 * closing it is 'cancelled' (no fallback, no message). Any other failure, or no share
 * sheet, falls back to copying, and then to the manual field.
 */
export const shareOrCopy = async (
  url: string,
  title: string,
  nav: ShareNav | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): Promise<ShareOutcome> => {
  if (typeof nav?.share === 'function') {
    try {
      await nav.share({ url, title });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      /* not allowed here: copy instead */
    }
  }
  return copyText(url, nav as Pick<Navigator, 'clipboard'> | undefined);
};
