import type React from 'react';
import { PUBLIC_LINK_REL } from '@/lib/organiserLinkLabels';

/**
 * Get in touch (ACCEPTANCE S2): four stacked rows in a fixed order --
 * WhatsApp, Instagram, Website, Email. Each row is tappable and has its own
 * Copy button. A row with no value is not rendered; no row at all means no
 * section. Facebook is deliberately not a row (E2, closed by owner decision).
 *
 * The WhatsApp and Email values come from get_organiser_public_contact_v1.
 * When that read FAILS the rows from stored links still show and one line
 * says so with a retry (E9) -- a failure is never shown as "no number".
 */
export type ContactRowKey = 'whatsapp' | 'instagram' | 'website' | 'email';

export interface ContactRow {
  key: ContactRowKey;
  label: string;
  /** What the row shows. */
  display: string;
  /** What Copy puts on the clipboard. */
  copyValue: string;
  /** Toast noun: "<Noun> copied" / "Couldn't copy the <noun>". */
  copyNoun: string;
  href: string;
  external: boolean;
}

export interface ContactInput {
  phone: string | null | undefined;
  whatsappHref: string | null | undefined;
  email: string | null | undefined;
  mailtoHref: string | null | undefined;
  instagramUrl: string | null | undefined;
  instagramHandle: string | null | undefined;
  websiteUrl: string | null | undefined;
  websiteDomain: string | null | undefined;
}

const clean = (v: string | null | undefined): string | null => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t === '' ? null : t;
};

/** The ONE mapping from what the page read to the rows a visitor sees. */
export function buildContactRows(c: ContactInput): ContactRow[] {
  const rows: ContactRow[] = [];
  const phone = clean(c.phone);
  const wa = clean(c.whatsappHref);
  if (phone && wa) rows.push({ key: 'whatsapp', label: 'WhatsApp', display: phone, copyValue: phone, copyNoun: 'WhatsApp number', href: wa, external: true });
  const ig = clean(c.instagramUrl);
  if (ig) {
    const handle = clean(c.instagramHandle);
    const display = handle && handle !== 'Instagram' ? handle : ig.replace(/^https?:\/\/(www\.)?/i, '');
    rows.push({ key: 'instagram', label: 'Instagram', display, copyValue: ig, copyNoun: 'Instagram link', href: ig, external: true });
  }
  const site = clean(c.websiteUrl);
  if (site) {
    const domain = clean(c.websiteDomain);
    const display = domain && domain !== 'Website' ? domain : site.replace(/^https?:\/\/(www\.)?/i, '');
    rows.push({ key: 'website', label: 'Website', display, copyValue: site, copyNoun: 'website link', href: site, external: true });
  }
  const email = clean(c.email);
  const mailto = clean(c.mailtoHref);
  if (email && mailto) rows.push({ key: 'email', label: 'Email', display: email, copyValue: email, copyNoun: 'email address', href: mailto, external: false });
  return rows;
}

const CREAM = '#F6F1EA';
const GOLD = '#E7BE6E';

const ICONS: Record<ContactRowKey, React.ReactNode> = {
  whatsapp: <path d="M3 21l1.7-5A8 8 0 1 1 8 19.3z" />,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" /></>,
  website: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" /></>,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
};

const iconTile: React.CSSProperties = { width: 44, height: 44, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(246,241,234,0.06)', color: CREAM, flexShrink: 0 };
const btn44: React.CSSProperties = { minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: GOLD, cursor: 'pointer', flexShrink: 0 };

export function OrganiserGetInTouch({ rows, contactFailed, onRetry, onCopy }: {
  rows: ContactRow[];
  /** get_organiser_public_contact_v1 failed: WhatsApp/Email are unknown, not absent. */
  contactFailed: boolean;
  onRetry: () => void;
  onCopy: (value: string, noun: string) => void;
}) {
  if (rows.length === 0 && !contactFailed) return null;
  return (
    <section data-testid="org-get-in-touch" className="px-5 md:px-12 py-3" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: 16, lineHeight: 1.3, margin: '0 0 8px', color: CREAM }}>Get in touch</h2>
      <ul className="flex flex-col gap-2" style={{ listStyle: 'none', margin: 0, padding: 0, maxWidth: 480 }}>
        {rows.map((r) => (
          <li key={r.key} data-contact-row={r.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a
              href={r.href}
              {...(r.external ? { target: '_blank', rel: PUBLIC_LINK_REL } : {})}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
              style={{ minHeight: 44, color: CREAM }}
            >
              <span style={r.key === 'whatsapp' ? { ...iconTile, color: '#25D366', background: 'rgba(37,211,102,0.12)' } : iconTile}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">{ICONS[r.key]}</svg>
              </span>
              <span className="min-w-0">
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(246,241,234,0.7)' }}>{r.label}</span>
                <span style={{ display: 'block', fontSize: 14, color: CREAM, overflowWrap: 'anywhere' }}>{r.display}</span>
              </span>
            </a>
            <button type="button" onClick={() => onCopy(r.copyValue, r.copyNoun)} aria-label={`Copy ${r.copyNoun}`} className="rounded-lg hover:bg-white/5 active:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400" style={{ ...btn44, width: 44, height: 44 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>
            </button>
          </li>
        ))}
      </ul>
      {contactFailed && (
        <p data-testid="org-contact-error" role="status" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, margin: rows.length ? '8px 0 0' : 0, fontSize: 14, color: 'rgba(246,241,234,0.75)' }}>
          Couldn&rsquo;t load WhatsApp and email.
          <button type="button" onClick={onRetry} style={{ ...btn44, padding: '0 12px', fontSize: 14, fontWeight: 700 }}>Try again</button>
        </p>
      )}
    </section>
  );
}
