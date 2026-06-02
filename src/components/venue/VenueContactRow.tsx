import type { ReactNode } from 'react';
import {
  Phone as PhoneIcon,
  Mail as MailIcon,
  Globe as GlobeIcon,
  Instagram as InstagramIcon,
  Facebook as FacebookIcon,
  ExternalLink as ExternalLinkIcon,
} from 'lucide-react';

interface VenueContactRowProps {
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
}

function ensureHttp(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function stripUrl(url: string): string {
  try {
    const u = new URL(ensureHttp(url));
    return u.host.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname);
  } catch {
    return url.replace(/^https?:\/\//i, '').replace(/^www\./, '');
  }
}

function igHandle(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '');
}

interface ContactItem {
  key: string;
  label: string;
  value: string;
  href: string;
  external: boolean;
  icon: ReactNode;
}

export default function VenueContactRow({
  phone,
  email,
  website,
  instagram,
  facebook,
}: VenueContactRowProps) {
  const items: ContactItem[] = [];
  const size = 'h-[18px] w-[18px]';

  if (phone) {
    items.push({
      key: 'phone',
      label: 'Call',
      value: phone,
      href: `tel:${phone}`,
      external: false,
      icon: <PhoneIcon className={size} />,
    });
  }
  if (email) {
    items.push({
      key: 'email',
      label: 'Email',
      value: email,
      href: `mailto:${email}`,
      external: false,
      icon: <MailIcon className={size} />,
    });
  }
  if (website) {
    items.push({
      key: 'website',
      label: 'Website',
      value: stripUrl(website),
      href: ensureHttp(website),
      external: true,
      icon: <GlobeIcon className={size} />,
    });
  }
  if (instagram) {
    const handle = igHandle(instagram);
    items.push({
      key: 'instagram',
      label: 'Instagram',
      value: `@${handle}`,
      href: `https://instagram.com/${handle}`,
      external: true,
      icon: <InstagramIcon className={size} />,
    });
  }
  if (facebook) {
    const isUrl = /^https?:\/\//i.test(facebook);
    items.push({
      key: 'facebook',
      label: 'Facebook',
      value: isUrl ? stripUrl(facebook) : facebook,
      href: isUrl
        ? facebook
        : `https://www.facebook.com/search/top?q=${encodeURIComponent(facebook)}`,
      external: true,
      icon: <FacebookIcon className={size} />,
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="vc-grid">
      {items.map((it) => (
        <a
          key={it.key}
          href={it.href}
          target={it.external ? '_blank' : undefined}
          rel={it.external ? 'noopener noreferrer' : undefined}
          className="vc-cell"
        >
          <span className="vc-lead">{it.icon}</span>
          <span className="vc-body">
            <span className="vc-lbl">{it.label}</span>
            <span className="vc-val">{it.value}</span>
          </span>
          <ExternalLinkIcon className="vc-trail h-[15px] w-[15px]" />
        </a>
      ))}
      <style>{`
        .vc-grid { display: flex; flex-wrap: wrap; gap: 10px; }
        .vc-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1 1 calc(50% - 5px);
          min-width: 150px;
          border-radius: 14px;
          padding: 11px 12px;
          text-decoration: none;
          border: 1px solid color-mix(in srgb, var(--va-ink-gold) 50%, transparent);
          background: linear-gradient(180deg,
            color-mix(in srgb, var(--va-ink-gold) 11%, transparent),
            color-mix(in srgb, var(--va-ink-gold) 2%, transparent));
          box-shadow: 0 5px 16px -9px rgba(0,0,0,0.8),
            inset 0 1px 0 color-mix(in srgb, var(--va-ink-gold) 16%, transparent);
          transition: transform .14s ease, border-color .16s ease, box-shadow .16s ease;
        }
        .vc-cell:hover {
          transform: translateY(-2px);
          border-color: var(--va-ink-gold);
          box-shadow: 0 12px 24px -10px rgba(0,0,0,0.85),
            inset 0 1px 0 color-mix(in srgb, var(--va-ink-gold) 25%, transparent);
        }
        .vc-cell:active { transform: scale(0.98); }
        .vc-lead { flex-shrink: 0; display: flex; color: var(--va-ink-gold); }
        .vc-body { min-width: 0; flex: 1; }
        .vc-lbl {
          display: block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--va-ink-gold);
        }
        .vc-val {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: var(--va-ink-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .vc-trail { flex-shrink: 0; color: var(--va-ink-gold); opacity: 0.65; }
      `}</style>
    </div>
  );
}
