import { useLocation } from 'react-router-dom';
import { FooterLinks } from '@/components/layout/FooterLinks';

// NO framer-motion here (perf, Pillar A): the footer mounts on every page, so
// a `motion.*` import would drag the whole library into the first-load bundle.

const HIDDEN_RE = /^\/(auth|onboarding)(\/|$)/i;

export const GlobalFooter = () => {
  const { pathname } = useLocation();
  if (HIDDEN_RE.test(pathname)) return null;

  // `site-footer`: index.css raises the bottom padding while a page-level fixed
  // action bar ([data-sticky-action-bar]) is mounted, so the footer's last rows
  // never sit under it. Pure CSS, so SSR and hydration render identically.
  // mt-16 / lg:mt-20: the footer owns its separation from the page, so every
  // page gets the same minimum gap whatever bottom padding it happens to end
  // with (measured 0-32px on several pages before this).
  return (
    <footer
      role="contentinfo"
      // Brand-gold panel: full contrast against the dark pages (the Fatsoma
      // principle -- footer on its own surface -- in our colour).
      className="site-footer relative mt-16 bg-primary px-4 pb-6 pt-10 lg:mt-20 lg:pb-10 lg:pt-14"
    >
      <FooterLinks />
    </footer>
  );
};
