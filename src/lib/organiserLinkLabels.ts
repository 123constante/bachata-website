import { withNormalizedProtocol } from '@/lib/organiserProfileUpdate';

// The ONE copy of how an organiser's stored link is labelled: the public page's
// social pills (aria-label) and the owner's edit-in-place link rows both read
// these, so the label a visitor hears and the one the owner sees cannot drift.
// Moved verbatim from src/pages/OrganiserProfile.tsx; 'share' (and Facebook's
// other non-page paths) added so a facebook.com/share/... link -- what
// Facebook's own Share button hands out -- is not announced as "@share".

const IG_NON_HANDLE_PATHS = ['p', 'reel', 'reels', 'tv', 'explore', 'stories'];

const FB_NON_HANDLE_PATHS = new Set([
  'profile.php', 'people', 'pages', 'groups', 'pg', 'sharer', 'login',
  'home.php', 'events', 'share', 'sharer.php', 'login.php', 'watch',
  'photo.php', 'story.php', 'permalink.php', 'p',
]);

/** '@handle' for a profile link or a handle, else 'Instagram'. */
export const extractIgHandle = (raw: string | null): string => {
  if (!raw) return 'Instagram';
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return 'Instagram';
  if (trimmed.startsWith('@')) return trimmed;
  const m = trimmed.match(/instagram\.com\/([^/?#]+)/i);
  if (m && m[1]) {
    const seg = m[1].toLowerCase();
    if (IG_NON_HANDLE_PATHS.includes(seg)) return 'Instagram';
    return '@' + m[1];
  }
  if (/^[A-Za-z0-9._]+$/.test(trimmed)) return '@' + trimmed;
  return 'Instagram';
};

/** '@name' when the path segment is a real page name, else 'Facebook'. */
export const extractFbHandle = (raw: string | null): string => {
  if (!raw) return 'Facebook';
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return 'Facebook';
  if (trimmed.startsWith('@')) return trimmed;
  const m = trimmed.match(/facebook\.com\/([^/?#]+)/i);
  if (m && m[1]) {
    const seg = m[1];
    if (FB_NON_HANDLE_PATHS.has(seg.toLowerCase())) return 'Facebook';
    return '@' + seg;
  }
  if (/^[A-Za-z0-9.\-_]+$/.test(trimmed)) return '@' + trimmed;
  return 'Facebook';
};

/** The bare host ('example.com'), else 'Website'. */
export const extractDomain = (raw: string | null): string => {
  if (!raw) return 'Website';
  const trimmed = raw.trim();
  if (!trimmed) return 'Website';
  try {
    const url = new URL(withNormalizedProtocol(trimmed));
    return url.hostname.replace(/^www\./i, '') || 'Website';
  } catch {
    return 'Website';
  }
};

/** The owner's link-row label: '@name' for a real page name, else 'Facebook page'. */
export const facebookDisplayLabel = (raw: string | null): string => {
  const h = extractFbHandle(raw);
  return h === 'Facebook' ? 'Facebook page' : h;
};

/** Every public organiser link: no opener, no ranking credit, user-generated. */
export const PUBLIC_LINK_REL = 'noopener nofollow ugc';
