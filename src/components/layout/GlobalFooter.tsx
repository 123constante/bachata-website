import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

const HIDDEN_RE = /^\/(auth|onboarding)(\/|$)/i;

const WHATSAPP_NUMBER = '447577576006';
const WHATSAPP_MESSAGE = "Hi! I'd like to list my events on Bachata Calendar.";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

const WEEKDAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

const GUIDES: ReadonlyArray<readonly [string, string]> = [
  ['London Bachata Guide', '/london-bachata-guide'],
  ['Beginners', '/learn-bachata-london'],
  ['Parties', '/parties'],
  ['Classes', '/classes'],
  ['FAQ', '/faq'],
];

export const GlobalFooter = () => {
  const { pathname } = useLocation();
  const prefersReducedMotion = useReducedMotion();
  if (HIDDEN_RE.test(pathname)) return null;

  return (
    <footer
      role="contentinfo"
      className="relative border-t border-primary/10 bg-background px-4 pb-5 pt-4"
    >
      {/* Decorative orange line -- matches the GlobalHeader top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/55 to-transparent" />

      {/* Sitewide guide + weekday links */}
      <nav aria-label="Guides and weekday pages" className="mb-4 space-y-1.5 text-xs">
        <p className="flex flex-wrap items-baseline gap-x-0.5 gap-y-0.5 leading-relaxed">
          <span className="mr-1 font-bold uppercase tracking-wide text-muted-foreground">Guides:</span>
          {GUIDES.map(([label, to], i) => (
            <span key={to}>
              {i > 0 && (
                <span aria-hidden="true" className="mx-0.5 text-muted-foreground/40">&middot;</span>
              )}
              <Link to={to} className="text-muted-foreground transition-colors hover:text-primary">
                {label}
              </Link>
            </span>
          ))}
        </p>
        <p className="flex flex-wrap items-baseline gap-x-0.5 gap-y-0.5 leading-relaxed">
          <span className="mr-1 font-bold uppercase tracking-wide text-muted-foreground">By day:</span>
          {WEEKDAYS.map((d, i) => (
            <span key={d}>
              {i > 0 && (
                <span aria-hidden="true" className="mx-0.5 text-muted-foreground/40">&middot;</span>
              )}
              <Link
                to={`/bachata-london-${d.toLowerCase()}`}
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                {d}
              </Link>
            </span>
          ))}
        </p>
      </nav>

      <div className="flex justify-center">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Get listed as an organiser via WhatsApp"
          className="relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-primary/40 bg-primary/10 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-primary no-underline transition-colors hover:bg-primary/15"
        >
          {/* Spotlight beam sweeping left-to-right across the pill */}
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-8"
            style={{
              background:
                'radial-gradient(ellipse at center, hsl(25 100% 62% / 0.55) 0%, transparent 70%)',
              filter: 'blur(4px)',
            }}
            animate={prefersReducedMotion ? undefined : { x: ['-30px', '220px'] }}
            transition={
              prefersReducedMotion
                ? undefined
                : { repeat: Infinity, duration: 3.4, ease: 'linear' }
            }
          />
          <motion.span
            className="relative z-10 inline-block text-base leading-none"
            style={{ transformOrigin: '50% 80%' }}
            animate={
              prefersReducedMotion
                ? undefined
                : { rotate: [-8, 0, -8], y: [0, -3, 0] }
            }
            transition={
              prefersReducedMotion
                ? undefined
                : { repeat: Infinity, duration: 1.4, ease: 'easeInOut' }
            }
            aria-hidden="true"
          >
            &#128227;
          </motion.span>
          <span className="relative z-10">Get Listed</span>
        </a>
      </div>
    </footer>
  );
};
