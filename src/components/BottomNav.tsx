import { type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCity } from '@/contexts/CityContext';
import { buildCityPath } from '@/lib/cityPath';
import { cn } from '@/lib/utils';
import { flags } from '@/lib/featureFlags';

// NO framer-motion here (perf, Pillar A): BottomNav mounts on every page, so a
// `motion.*` import would drag the whole library into the first-load bundle.
// Emoji bob = .chrome-bob (index.css, reduced-motion gated); hover pop = a CSS
// transform on a wrapper span (separate element so the two transforms compose);
// the active-tab bar is a plain div — the framer layoutId slide between tabs
// was the one visual this intentionally gives up.

const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/DdbNEnPvRLDGTBMbzcuDcz?mode=gi_t';

const WhatsAppGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

const BASE_NAV_LINKS: Array<{
  segment: string;
  label: string;
  emoji: string;
  fixedPath?: string;
}> = [
  { segment: 'organisers', label: 'Organisers', emoji: '\u{1F3AA}', fixedPath: '/organisers' },
  { segment: 'venues',     label: 'Venues',     emoji: '\u{1F3DB}\u{FE0F}' },
  // /raffles is NOT city-scoped (no /city/:slug/raffles route), so fixedPath
  // is required. Flag-gated: the route redirects home when rafflesPage is
  // off, so the nav entry must disappear with it (prod flag is false for now).
  ...(flags.rafflesPage
    ? [{ segment: 'raffles', label: 'Raffles', emoji: '\u{1F381}', fixedPath: '/raffles' }]
    : []),
];

// Per-emoji bob duration (was the framer transition duration), fed to
// .chrome-bob via the --bob-dur custom property.
const EMOJI_BOB_DURATION: Record<string, string> = {
  '\u{1F3AA}': '1.6s',
  '\u{1F3DB}\u{FE0F}': '1.8s',
  '\u{1F381}': '1.7s',
};

export const BottomNav = ({ className }: { className?: string }) => {
  const location = useLocation();
  const { citySlug } = useCity();

  const navLinks = BASE_NAV_LINKS.map((link) => ({
    ...link,
    path: link.fixedPath ?? buildCityPath(citySlug, link.segment || undefined),
  }));

  const isActive = (path: string) => location.pathname === path || location.pathname === `/${path.split('/').pop()}`;

  return (
    <nav
      id="app-nav"
      aria-label="Main sections"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t border-primary/10 pb-[env(safe-area-inset-bottom)]",
        className,
      )}
      style={{
        backgroundColor: 'hsl(var(--background) / 0.85)',
        backdropFilter: 'blur(8px) saturate(100%)',
        WebkitBackdropFilter: 'blur(8px) saturate(100%)',
      }}
    >
      {/* Decorative orange line -- top edge on BottomNav (faces content) */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

      <div className="flex items-center justify-around h-[58px] px-2">
        {navLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`relative flex flex-col items-center px-2 py-2 text-xs font-medium transition-all no-underline group rounded-md min-h-[44px] justify-center ${isActive(link.path) ? 'bg-primary/15' : ''}`}
          >
            <span className="inline-block mb-0.5 cursor-pointer transition-transform duration-150 group-hover:scale-125">
              <span
                className="chrome-bob text-base"
                style={{ '--bob-dur': EMOJI_BOB_DURATION[link.emoji] ?? '1.6s' } as CSSProperties}
              >
                {link.emoji}
              </span>
            </span>

            {/* Label - always visible */}
            <span
              className={
                isActive(link.path)
                  ? 'text-white font-bold'
                  : 'text-white group-hover:text-white'
              }
            >
              {link.label}
            </span>

            {isActive(link.path) && (
              <div className="absolute top-0 left-1.5 right-1.5 h-0.5 bg-primary rounded-full" />
            )}
          </Link>
        ))}

        {/* WhatsApp community -- external link */}
        <a
          href={WHATSAPP_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Join our WhatsApp community"
          className="relative flex flex-col items-center px-2 py-2 text-xs font-medium transition-all no-underline group rounded-md min-h-[44px] justify-center"
        >
          <span className="inline-block mb-0.5 cursor-pointer transition-transform duration-150 group-hover:scale-125">
            <span
              className="chrome-bob relative flex items-center justify-center"
              style={{ '--bob-dur': '2s' } as CSSProperties}
            >
              <WhatsAppGlyph className="w-[18px] h-[18px] text-[#25D366]" />
              {/* motion-reduce:hidden replaces the old useReducedMotion() JSX gate */}
              <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2 motion-reduce:hidden">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5cf08a] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5cf08a]" />
              </span>
            </span>
          </span>
          <span className="text-white font-bold group-hover:text-white">Community</span>
        </a>
      </div>
    </nav>
  );
};
