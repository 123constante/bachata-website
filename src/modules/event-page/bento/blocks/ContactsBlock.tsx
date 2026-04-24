import { Globe, Facebook, Instagram } from 'lucide-react';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';

type ContactsBlockProps = {
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
};

const stripProtocol = (url: string) =>
  url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');

// Path segments that signal a URL is NOT a profile (posts, reels, events, …).
// When the first path segment matches one of these we can't recover a handle
// from the URL and fall back to the platform label.
// TODO: admin UX — validate instagram_url / facebook_url are profile URLs,
// not post URLs, at the form level so the parser's fallback rarely runs.
const INSTAGRAM_RESERVED = new Set(['p', 'reel', 'reels', 'explore', 'tv', 'stories']);
const FACEBOOK_RESERVED = new Set(['p', 'posts', 'events', 'pages', 'watch', 'groups', 'stories']);

// Pulls the first path segment after the domain (e.g. instagram.com/bosdance
// → "bosdance"). Query strings and hashes are stripped first so that URLs
// like `/bosdance/?hl=en` don't surface `?hl=en` as a fake handle. Returns
// null when the first segment is reserved (post/reel/etc.) so the caller
// can render a neutral fallback instead of garbage.
const handleFromSocial = (url: string, reserved: ReadonlySet<string>): string | null => {
  const withoutQueryHash = url.split(/[?#]/)[0] ?? '';
  const cleaned = withoutQueryHash
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  // parts[0] is the domain; the first candidate handle is parts[1].
  const first = parts[1];
  if (!first) return null;
  if (reserved.has(first.toLowerCase())) return null;
  return first.replace(/^@+/, '');
};

type Row = {
  key: 'website' | 'facebook' | 'instagram';
  label: string;
  href: string;
  display: string;
  Icon: typeof Globe;
};

export const ContactsBlock = ({ websiteUrl, facebookUrl, instagramUrl }: ContactsBlockProps) => {
  const rows: Row[] = [];
  if (websiteUrl) {
    rows.push({
      key: 'website',
      label: 'Website',
      href: websiteUrl,
      display: stripProtocol(websiteUrl),
      Icon: Globe,
    });
  }
  if (facebookUrl) {
    const handle = handleFromSocial(facebookUrl, FACEBOOK_RESERVED);
    rows.push({
      key: 'facebook',
      label: 'Facebook',
      href: facebookUrl,
      display: handle ? `@${handle}` : 'facebook.com',
      Icon: Facebook,
    });
  }
  if (instagramUrl) {
    const handle = handleFromSocial(instagramUrl, INSTAGRAM_RESERVED);
    rows.push({
      key: 'instagram',
      label: 'Instagram',
      href: instagramUrl,
      display: handle ? `@${handle}` : 'instagram.com',
      Icon: Instagram,
    });
  }

  if (rows.length === 0) return null;

  // Multi-target: outer tile has strong-button visual; each contact row is
  // its own tap target (opens the external URL in a new tab).
  return (
    <BentoTile title={BLOCK_TITLES.contacts} color={BLOCK_COLORS.contacts} mode="multi-target">
      <div className="flex flex-1 flex-col gap-[6px]">
        {rows.map(({ key, label, href, display, Icon }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-2 rounded-[12px] px-2 py-[8px] transition-transform duration-150 active:scale-[0.97]"
            style={{
              background: 'hsl(var(--bento-surface))',
              border: '1px solid var(--bento-hairline)',
              color: 'hsl(var(--bento-fg))',
            }}
          >
            <Icon className="h-[14px] w-[14px] shrink-0" />
            <div className="min-w-0 flex-1">
              <div
                className="text-[9px] uppercase tracking-[0.1em]"
                style={{ color: 'hsl(var(--bento-fg-muted))' }}
              >
                {label}
              </div>
              <div className="truncate text-[11px] font-semibold">{display}</div>
            </div>
          </a>
        ))}
      </div>
    </BentoTile>
  );
};
