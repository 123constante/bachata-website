/**
 * Group-chat link helper for the festival page.
 *
 * Festivals store a single "join the group chat" invite URL. It can point at any
 * platform (WhatsApp / Telegram / Discord / Facebook / …), so the public page
 * detects the platform from the URL itself and renders the matching glyph, label
 * and brand accent — with a neutral "group chat" fallback for anything else.
 *
 * Detection is HOSTNAME-based (not substring), so a query param like
 * `?ref=t.me/x` can't trip a false positive and `evil-whatsapp.com` can't spoof
 * a brand. Unparseable input falls back to the neutral "group chat" look.
 */

export type ChatPlatform = 'whatsapp' | 'telegram' | 'discord' | 'facebook' | 'generic';

export interface GroupChatMeta {
  platform: ChatPlatform;
  /** Short platform name for the eyebrow ("WhatsApp", "Telegram", "Group"). */
  label: string;
  /** Brand accent for the glyph ring + eyebrow dot. */
  accent: string;
  /** aria-label fragment, e.g. " on WhatsApp" (leading space) or "". */
  ariaPlatform: string;
}

type PlatformDef = GroupChatMeta & { domains: string[] };

const PLATFORMS: PlatformDef[] = [
  { platform: 'whatsapp', label: 'WhatsApp', accent: '#25D366', ariaPlatform: ' on WhatsApp', domains: ['whatsapp.com', 'wa.me'] },
  { platform: 'telegram', label: 'Telegram', accent: '#229ED9', ariaPlatform: ' on Telegram', domains: ['t.me', 'telegram.me', 'telegram.org'] },
  { platform: 'discord', label: 'Discord', accent: '#5865F2', ariaPlatform: ' on Discord', domains: ['discord.gg', 'discord.com', 'discordapp.com'] },
  { platform: 'facebook', label: 'Facebook', accent: '#1877F2', ariaPlatform: ' on Facebook', domains: ['facebook.com', 'fb.com', 'm.me', 'messenger.com'] },
];

const GENERIC: GroupChatMeta = {
  platform: 'generic',
  label: 'Group',
  accent: '#fb923c',
  ariaPlatform: '',
};

// host === base, or host is a subdomain of base (".base"). Never a substring,
// so "evil-whatsapp.com" does not match "whatsapp.com".
const hostMatches = (host: string, base: string): boolean =>
  host === base || host.endsWith(`.${base}`);

export function detectChatPlatform(url: string | null | undefined): GroupChatMeta {
  if (!url) return GENERIC;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return GENERIC;
  }
  for (const p of PLATFORMS) {
    if (p.domains.some((d) => hostMatches(host, d))) {
      return { platform: p.platform, label: p.label, accent: p.accent, ariaPlatform: p.ariaPlatform };
    }
  }
  return GENERIC;
}
