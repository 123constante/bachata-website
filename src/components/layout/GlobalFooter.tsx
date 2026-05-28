import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

// Auth / onboarding render their own chrome -- skip the global footer there
// so they keep their bespoke layout. Matches the same pattern used by
// GlobalLayout's showSubheader opt-out.
const HIDDEN_RE = /^\/(auth|onboarding)(\/|$)/i;

// "Get Listed" opens WhatsApp with a pre-filled DM. Matches the current
// manual-onboarding workflow -- direct chat lets us qualify the lead and
// run the free-vs-paid pitch on first reply. Swap target once self-serve
// ships.
const WHATSAPP_NUMBER = '447577576006';
const WHATSAPP_MESSAGE = "Hi! I'd like to list my events on Bachata Calendar.";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

export const GlobalFooter = () => {
  const { pathname } = useLocation();
  const prefersReducedMotion = useReducedMotion();
  if (HIDDEN_RE.test(pathname)) return null;

  return (
    <footer
      role="contentinfo"
      className="relative border-t border-primary/10 bg-background px-4 py-5"
    >
      {/* Decorative orange line -- matches the GlobalHeader top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/55 to-transparent" />

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
