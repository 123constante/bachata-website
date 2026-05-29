import { Phone as PhoneIcon, Globe as GlobeIcon } from 'lucide-react';

interface VenueContactRowProps {
  phone: string | null;
  phoneLabel: string | null;
  website: string | null;
  websiteLabel: string | null;
}

function stripUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname);
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '');
  }
}

export default function VenueContactRow({
  phone,
  phoneLabel,
  website,
  websiteLabel,
}: VenueContactRowProps) {
  if (!phone && !website) return null;
  const cellClass =
    'flex flex-1 items-center gap-2.5 rounded-2xl border px-3.5 py-3 no-underline';
  const labelClass =
    'block text-[10px] font-bold uppercase tracking-wide';
  const valueClass =
    'block truncate text-[13.5px] font-bold';

  return (
    <div className="flex gap-2.5">
      {phone ? (
        <a
          href={`tel:${phone}`}
          className={cellClass}
          style={{
            background: 'transparent',
            borderColor: 'color-mix(in srgb, var(--va-ink-gold) 50%, transparent)',
          }}
        >
          <PhoneIcon
            className="h-[18px] w-[18px] flex-shrink-0"
            style={{ color: 'var(--va-ink-gold)' }}
          />
          <span className="min-w-0">
            <span
              className={labelClass}
              style={{ color: 'var(--va-ink-gold)' }}
            >
              Call
            </span>
            <span
              className={valueClass}
              style={{ color: 'var(--va-ink-text)' }}
            >
              {phoneLabel ?? phone}
            </span>
          </span>
        </a>
      ) : null}
      {website ? (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className={cellClass}
          style={{
            background: 'transparent',
            borderColor: 'color-mix(in srgb, var(--va-ink-gold) 50%, transparent)',
          }}
        >
          <GlobeIcon
            className="h-[18px] w-[18px] flex-shrink-0"
            style={{ color: 'var(--va-ink-gold)' }}
          />
          <span className="min-w-0">
            <span
              className={labelClass}
              style={{ color: 'var(--va-ink-gold)' }}
            >
              Website
            </span>
            <span
              className={valueClass}
              style={{ color: 'var(--va-ink-text)' }}
            >
              {websiteLabel ?? stripUrl(website)}
            </span>
          </span>
        </a>
      ) : null}
    </div>
  );
}
