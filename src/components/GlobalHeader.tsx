import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useCity } from '@/contexts/CityContext';
import { buildCityPath } from '@/lib/cityPath';
import { ChevronLeft } from 'lucide-react';
import bachataCalendarLogo from '@/assets/brand/bachata-calendar-logo.png';
import { HeaderSearch } from '@/components/search/HeaderSearch';
import { cn } from '@/lib/utils';
import { flags } from '@/lib/featureFlags';

const EVENT_DETAIL_RE = /^\/event\/[^/]+/i;
const WHATSAPP_URL = 'https://chat.whatsapp.com/DdbNEnPvRLDGTBMbzcuDcz?mode=gi_t';

const WhatsAppGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

const NAV_ITEMS: {
  label: string;
  emoji: string | null;
  segment?: string;
  fixedPath?: string;
  external: boolean;
  duration: number;
}[] = [
  { label: 'Tonight',    emoji: '\u{1F319}',         segment: 'tonight',       external: false, duration: 1.4 },
  { label: 'Organisers', emoji: '\u{1F3AA}',         fixedPath: '/organisers', external: false, duration: 1.6 },
  { label: 'Venues',     emoji: '\u{1F3DB}\u{FE0F}', segment: 'venues',       external: false, duration: 1.8 },
  // /raffles is NOT city-scoped (no /city/:slug/raffles route), so fixedPath
  // is required. Flag-gated alongside the route: hidden while rafflesPage is false.
  ...(flags.rafflesPage
    ? [{ label: 'Raffles', emoji: '\u{1F3B0}', fixedPath: '/raffles', external: false, duration: 1.7 }]
    : []),
  { label: 'Community',  emoji: null,                 fixedPath: WHATSAPP_URL,  external: true,  duration: 2.0 },
];

export const GlobalHeader = () => {
  const [scrolled, setScrolled] = useState(false);
  const [searching, setSearching] = useState(false);
  const { citySlug } = useCity();
  const homePath = buildCityPath(citySlug);
  const { pathname } = useLocation();
  const isEventDetail = EVENT_DETAIL_RE.test(pathname);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setSearching(false);
  }, [pathname]);

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-[60] border-b border-primary/10 h-[60px]"
      animate={{
        backgroundColor: scrolled ? 'hsl(var(--background) / 0.98)' : 'hsl(var(--background) / 0.85)',
        backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'blur(8px) saturate(100%)',
      }}
      transition={{ duration: 0.3 }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:font-medium focus:outline-none focus:ring-2 focus:ring-primary-foreground focus:ring-offset-2"
      >
        Skip to content
      </a>

      <nav className="flex items-center gap-2 h-[58px] px-4">
        {/* Logo / back button */}
        {!searching && (isEventDetail ? (
          <Link
            to="/"
            className="flex items-center gap-1 text-foreground no-underline -ml-1 pl-1 pr-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
            aria-label="Back to all events"
          >
            <ChevronLeft className="h-5 w-5 text-primary" strokeWidth={2.4} />
            <span className="text-sm font-semibold">All events</span>
          </Link>
        ) : (
          <Link to={homePath} className="flex items-center shrink-0 no-underline" aria-label="Bachata Calendar home">
            <img src={bachataCalendarLogo} alt="Bachata Calendar" className="h-5 w-auto" loading="eager" fetchpriority="high" />
          </Link>
        ))}

        {/* Desktop nav links with animated emojis */}
        {!searching && (
          <div className="hidden md:flex items-center gap-0.5 ml-4">
            {NAV_ITEMS.map((item) => {
              const href = item.fixedPath ?? buildCityPath(citySlug, item.segment);
              const isActive = !item.external && (pathname === href || pathname.startsWith(href + '/'));

              const icon = item.emoji ? (
                <motion.span
                  className="text-sm leading-none"
                  animate={prefersReducedMotion ? undefined : { y: [0, -5, 0] }}
                  transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: item.duration, ease: 'easeInOut' }}
                >
                  {item.emoji}
                </motion.span>
              ) : (
                <motion.span
                  className="leading-none"
                  animate={prefersReducedMotion ? undefined : { y: [0, -5, 0] }}
                  transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: item.duration, ease: 'easeInOut' }}
                >
                  <WhatsAppGlyph className="w-[14px] h-[14px] text-[#25D366]" />
                </motion.span>
              );

              const linkClass = cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors no-underline',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-primary/5',
              );

              if (item.external) {
                return (
                  <a key={item.label} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {icon}
                    <span>{item.label}</span>
                  </a>
                );
              }
              return (
                <Link key={item.label} to={href} className={linkClass}>
                  {icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        <div className="hidden md:block flex-1" />

        <HeaderSearch expanded={searching} onExpandedChange={setSearching} />
      </nav>

      {/* Decorative orange line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
    </motion.header>
  );
};
