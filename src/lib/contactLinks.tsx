import { Link } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';

// Outbound community/contact links shared by the site chrome (GlobalHeader,
// BottomNav, GlobalFooter). One copy, so a rotated invite link is a one-line
// change rather than a hunt across components.
//
// The FooterLinks component lives in THIS module, not in its own file, and that
// is a measured request-count decision, not tidiness to undo. root (via
// GlobalFooter) and the home feed (HomeMapShell) both import it, and as its own
// module rollup gave it a chunk of its own: +1 first-load request on EVERY route
// (2026-10-02, #494; check:bundle-budget + check:first-load-requests both red).
// Inside this module it rides the shared chunk every page already loads, at no
// extra bytes. components/layout/FooterLinks.tsx is a re-export, which rollup
// resolves away. Move it back out and those two ratchets go red again.

export const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/DdbNEnPvRLDGTBMbzcuDcz?mode=gi_t';

export const INSTAGRAM_URL = 'https://www.instagram.com/bachata.calendar/';

const WHATSAPP_LISTING_NUMBER = '447577576006';
const WHATSAPP_LISTING_MESSAGE = "Hi! I'd like to list my events on Bachata Calendar.";

// Direct chat with a prefilled "list my events" message.
export const WHATSAPP_GET_LISTED_URL =
  `https://wa.me/${WHATSAPP_LISTING_NUMBER}?text=${encodeURIComponent(WHATSAPP_LISTING_MESSAGE)}`;

/**
 * The site's footer link block: Fatsoma-style headed columns + copyright line.
 * Rendered by GlobalFooter on every page, and by the Festival Map home (which
 * suppresses GlobalFooter) at the tail of its scrolling feed, so the two never
 * drift apart. Also the homepage's crawlable internal-link cluster into the
 * weekday + guide pages -- keep every link here unless that page is retired.
 */

const WEEKDAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

type FooterLink = { label: string; to: string } | { label: string; href: string };

type FooterSection = { heading: string; links: FooterLink[] };

const SECTIONS: FooterSection[] = [
  {
    heading: 'Find events',
    links: [
      { label: 'Parties', to: '/parties' },
      { label: 'Classes', to: '/classes' },
      { label: 'Festivals', to: '/festivals' },
      { label: 'Tonight', to: '/tonight' },
      { label: 'Venues', to: '/venues' },
      { label: 'London Bachata Guide', to: '/london-bachata-guide' },
      { label: 'Beginners', to: '/learn-bachata-london' },
      { label: 'FAQ', to: '/faq' },
    ],
  },
  {
    heading: 'By day',
    links: WEEKDAYS.map((d) => ({ label: d, to: `/bachata-london-${d.toLowerCase()}` })),
  },
  {
    heading: 'Organisers',
    links: [
      { label: 'Get listed', href: WHATSAPP_GET_LISTED_URL },
      // Both routes are flag-gated (coming-soon gate / redirect home while
      // off) -- never link a page that is not live.
      ...(flags.organisersDirectory ? [{ label: 'Organisers', to: '/organisers' }] : []),
      ...(flags.rafflesPage ? [{ label: 'Raffles', to: '/raffles' }] : []),
    ],
  },
  {
    heading: 'Connect',
    links: [
      { label: 'WhatsApp', href: WHATSAPP_GROUP_URL },
      { label: 'Instagram', href: INSTAGRAM_URL },
    ],
  },
];

// Sits on the brand-gold panel (bg-primary) in both hosts, so text is
// primary-foreground (black) at reduced opacity: 85% links (8.5:1) / 75%
// copyright (7:1) on the gold, both above WCAG AA 4.5:1 (measured in the
// browser 2026-10-02). Gold-on-gold hover would vanish, so hover
// darkens + underlines, and keyboard focus gets a black outline.
const LINK_CLASS =
  'rounded-sm text-primary-foreground/85 underline-offset-2 transition-colors hover:text-primary-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground';

const FooterItem = ({ link }: { link: FooterLink }) =>
  'to' in link ? (
    <Link to={link.to} className={LINK_CLASS}>
      {link.label}
    </Link>
  ) : (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {link.label}
      {/* leading-none: the arrow comes from a fallback font with a taller
          ascent, which otherwise makes external-link rows ~2px taller. */}
      <span aria-hidden="true" className="ml-0.5 text-[10px] leading-none opacity-60">&#8599;</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );

/**
 * `label`: the nav's accessible name. GlobalFooter's default sits inside the
 * page's contentinfo landmark; the home page renders this inside its feed tab
 * panel (no <footer> there), so it names the nav for what it is instead.
 */
export function FooterLinks({ label = 'Footer' }: { label?: string }) {
  return (
    <>
      {/* Fatsoma-style: the block of columns is centred, text left-aligned
          within each column. Columns size to content on mobile, equal widths
          up to 190px from md up. minmax(0, ...) lets columns shrink (labels
          wrap) instead of overflowing on a 320px phone, large text, or a
          768-863px tablet where 4 x 190px does not fit. lg+ opens up the
          gaps (desktop is roomy by request; phones keep the compact rhythm). */}
      <nav
        aria-label={label}
        className="grid grid-cols-[repeat(2,minmax(0,max-content))] justify-center gap-x-10 gap-y-8 md:grid-cols-[repeat(4,minmax(0,190px))] md:gap-x-6 lg:grid-cols-[repeat(4,minmax(0,200px))] lg:gap-x-12 xl:gap-x-24"
      >
        {SECTIONS.map((section) => (
          <div key={section.heading}>
            <h2 className="text-sm font-semibold text-primary-foreground">{section.heading}</h2>
            <ul className="mt-3 space-y-2.5 text-sm lg:mt-4 lg:space-y-3">
              {section.links.map((link) => (
                <li key={link.label}>
                  <FooterItem link={link} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Max widths = the grid's full width at each breakpoint, so the rule
          lines up with the columns: md 4x190 + 3x24 = 832, lg 4x200 + 3x48 =
          944, xl 4x200 + 3x96 = 1088. */}
      <div className="mx-auto mt-8 max-w-[832px] border-t border-primary-foreground/15 pt-5 text-center lg:mt-12 lg:max-w-[944px] lg:pt-6 xl:max-w-[1088px]">
        {/* div, not <p>: the base layer caps <p> width, which pulls this
            off-centre once the footer is wider than the cap (desktop).
            suppressHydrationWarning: a page rendered last year (prerendered or
            edge-cached) disagrees with the browser on the year. This does NOT
            correct the text -- React keeps the server's year until the next
            deploy re-renders it -- it only stops that cosmetic mismatch from
            downgrading the whole page to client render. */}
        <div className="text-xs text-primary-foreground/75" suppressHydrationWarning>
          &copy; {new Date().getFullYear()} Bachata Calendar
        </div>
      </div>
    </>
  );
}
