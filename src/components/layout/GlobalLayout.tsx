import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import PageHero, { type HeroWidget } from '@/components/PageHero';
import PageBreadcrumb, { type BreadcrumbItemType } from '@/components/PageBreadcrumb';
import { FloatingElements } from '@/components/FloatingElements';

interface HeroProps {
  // ReactNode so detail pages can render a profile avatar in place of an
  // emoji. Strings still work for the 36+ existing consumers.
  emoji?: ReactNode;
  titleWhite: string;
  titleOrange: string;
  // ReactNode so the subtitle can host a clickable element (e.g. a city
  // <Link>) instead of plain text. Strings still work.
  subtitle?: ReactNode;
  widgets?: HeroWidget[];
  floatingIcons?: LucideIcon[];
  highlightColor?: string;
  largeTitle?: boolean;
}

export interface GlobalLayoutProps {
  breadcrumbs?: BreadcrumbItemType[];
  hero?: HeroProps;
  headerActions?: ReactNode;
  backHref?: string;
  stickySubheader?: ReactNode;
  // When false, the entire sub-header row (breadcrumb + backHref + headerActions)
  // is not rendered. Used by auth/onboarding flows that preserve their own
  // theming and don't want a breadcrumb trail.
  showSubheader?: boolean;
  showProgressBar?: boolean;
  showGradientBg?: boolean; subheaderTone?: 'default' | 'onDark';
  // Palette for the full-page gradient wash + progress-bar/floating-icon
  // companions (gated by showGradientBg). 'default' renders the orange /
  // festival-purple / festival-pink wash that 36+ public pages depend on;
  // 'bento' swaps to brass / plum / velvet for the event page's
  // themed-surface treatment. 'velvet' is the venues directory's static
  // "Velvet Grain" wash (plum fade + top-light + vignette + film grain).
  // 'brass' is the venues directory's warm raffle-surface wash (matching
  // /raffles backdrop exactly); floating icons are suppressed so the
  // clean cabinet look is preserved. 'organiser' mirrors the organiser
  // profile surface: warm purple-brown base with amber/orange radial
  // accents. Always defaults to 'default' so existing consumers are unaffected.
  gradientPalette?: 'default' | 'bento' | 'velvet' | 'brass' | 'organiser';
  floatingCount?: number;
  heroAfter?: ReactNode;
  children: ReactNode;
}

// PageBreadcrumb auto-prepends the Home icon -- this list is the trail AFTER
// Home. Empty default = just the Home icon, no "Home" text duplicated.
const DEFAULT_BREADCRUMBS: BreadcrumbItemType[] = [];

// "Velvet Grain" page wash (venues directory, approved 2026-06-12): plum
// linear base, faint purple top-light, viewport-bottom vignette, and an SVG
// film-grain layer whose opacity is baked into the rect so the whole
// treatment is a single static background value (no animation, no overlay
// element).
const VELVET_BG: CSSProperties = {
  backgroundColor: '#0d080b',
  background:
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' opacity='0.05' filter='url(%23n)'/%3E%3C/svg%3E") repeat, ` +
    'radial-gradient(115% 70% at 50% 0%, rgba(168,85,247,0.10), transparent 58%), ' +
    'radial-gradient(150% 90% at 50% 115%, rgba(0,0,0,0.85), transparent 55%), ' +
    'linear-gradient(180deg, #180d15, #0d080b)',
};

// Brass page wash (venues directory, raffle palette): warm gold radial glow
// at top fading to near-black -- mirrors the /raffles backdrop exactly.
// No animation, no film grain, no floating icons (clean cabinet look).
const BRASS_BG: CSSProperties = {
  backgroundColor: '#0a0a0b',
  background: 'radial-gradient(120% 60% at 50% 0%, #241a06 0%, #0a0a0b 58%), #0a0a0b',
};

// Organiser directory wash: mirrors the organiser profile hero exactly --
// warm purple-brown base (#2a1622 -> #0c0a0d) with three amber/orange
// radial accents. No film grain, no floating icons.
const ORGANISER_BG: CSSProperties = {
  backgroundColor: '#0c0a0d',
  background:
    'radial-gradient(circle at 24% 22%, rgba(255,140,60,0.42), transparent 38%), ' +
    'radial-gradient(circle at 80% 30%, rgba(231,190,110,0.40), transparent 44%), ' +
    'radial-gradient(circle at 62% 88%, rgba(255,106,44,0.30), transparent 52%), ' +
    'linear-gradient(155deg, #2a1622, #0c0a0d 72%)',
};

// Sub-header row positioning differs by mode:
//
// - With hero: absolute top-0 relative to the page root, which sits just
//   under the fixed 60px GlobalHeader (App.tsx renders a 60px spacer above
//   <main>). On mobile the row sits tight under the global header (pt-3)
//   to minimise the empty zone before content; desktop keeps the original
//   pt-20 cushion that lines up with /parties' historical breadcrumb Y.
//   The matching pt-3 md:pt-9 shim and pt-10 md:pt-20 PageHero topPadding
//   below pull the emoji up in lockstep on mobile so we don't trade one
//   empty zone for another.
//
// - Without hero: sticky at viewport-top+60px so the row pins under the
//   global header on scroll. Takes its natural height.
//
const GlobalLayout = ({
  breadcrumbs = DEFAULT_BREADCRUMBS,
  hero,
  headerActions,
  backHref,
  stickySubheader,
  showSubheader = true,
  showProgressBar = true,
  showGradientBg = true, subheaderTone = 'default',
  gradientPalette = 'default',
  floatingCount = 20,
  heroAfter,
  children,
}: GlobalLayoutProps) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const location = useLocation();

  // Dev-mode safeguard: warn when a page renders the sub-header (which holds
  // the breadcrumb) but doesn't pass any breadcrumbs. This catches the
  // "added a new page but forgot to wire breadcrumbs" class of bug. Skipped
  // in production so a missing breadcrumb never crashes the page; the user
  // just sees [Home] alone, which is the legacy behaviour.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!showSubheader) return;
    if (breadcrumbs && breadcrumbs.length > 0) return;
    // eslint-disable-next-line no-console
    console.warn(
      `[GlobalLayout] Page "${location.pathname}" renders showSubheader but passes no breadcrumbs. ` +
        'Pass breadcrumbs={buildBreadcrumbs("routeId", ctx)} from @/lib/breadcrumbs, ' +
        'or set showSubheader={false} to opt out.',
    );
  }, [showSubheader, breadcrumbs, location.pathname]);

  // With hero: pt-3 on mobile / pt-20 on desktop. Mobile keeps the breadcrumb
  // tight under the 60px global header; desktop preserves the historical
  // alignment (breadcrumb text at y~152, matching the position the old
  // in-hero PageBreadcrumb sits at on /parties today). pointer-events-none
  // on the outer wrapper so the transparent zone (and any sub-header area
  // outside the breadcrumb/actions) lets clicks pass through to the hero
  // underneath. Inner interactive wrappers re-enable pointer events.
  //
  // Without hero: tight sticky bar, no top padding -- the row takes its
  // natural height under the header.
  const subHeaderClasses = hero
    ? 'absolute top-0 left-0 right-0 z-10 px-4 pt-3 md:pt-20 flex items-center justify-between pointer-events-none'
    : `sticky top-[60px] z-10 min-h-9 px-4 ${subheaderTone === 'onDark' ? 'bg-background' : 'bg-background/80 backdrop-blur-sm'} flex items-center justify-between`;

  const subHeader = (
    <div className={subHeaderClasses}>
      <div className="flex items-center gap-1.5 min-w-0 pointer-events-auto">
        {backHref && (
          <Link
            to={backHref}
            aria-label="Back"
            className={`flex items-center justify-center w-7 h-7 -ml-1 rounded-md ${subheaderTone === 'onDark' ? 'text-[#f5c518] hover:text-white hover:bg-white/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'} transition-colors shrink-0`}
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
        )}
        <PageBreadcrumb items={breadcrumbs} tone={subheaderTone} />
      </div>
      {headerActions && (
        <div className="flex items-center gap-2 shrink-0 pointer-events-auto">{headerActions}</div>
      )}
    </div>
  );

  const suppressFloatingIcons =
    gradientPalette === 'velvet' ||
    gradientPalette === 'brass' ||
    gradientPalette === 'organiser';

  return (
    <div className="min-h-screen text-foreground overflow-x-clip relative">
      {showProgressBar && (
        <motion.div
          className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-40 origin-left"
          style={{ scaleX }}
        />
      )}

      {showGradientBg && (
        <>
          {gradientPalette === 'velvet' ? (
            <div className="fixed inset-0 -z-10 pointer-events-none" style={VELVET_BG} />
          ) : gradientPalette === 'brass' ? (
            <div className="fixed inset-0 -z-10 pointer-events-none" style={BRASS_BG} />
          ) : gradientPalette === 'organiser' ? (
            <div className="fixed inset-0 -z-10 pointer-events-none" style={ORGANISER_BG} />
          ) : (
            <motion.div
              className={
                gradientPalette === 'bento'
                  ? "fixed inset-0 bg-gradient-to-br from-bento-accent/20 via-bento-plum/15 to-bento-surface/30 -z-10 pointer-events-none"
                  : "fixed inset-0 bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 -z-10 pointer-events-none"
              }
              animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
              transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }}
              style={{ backgroundSize: '200% 200%' }}
            />
          )}
          {!suppressFloatingIcons && (
            <div
              className={`fixed inset-x-0 bottom-0 ${hero ? 'top-[181px]' : 'top-[101px]'} z-0 pointer-events-none overflow-hidden`}
            >
              <FloatingElements count={floatingCount} />
            </div>
          )}
        </>
      )}

      {showSubheader && subHeader}

      {hero && (
        // pt-3 md:pt-9 shim reserves space under the absolute-positioned
        // subheader so the emoji clears the breadcrumb row. Mobile uses pt-3
        // (matches the tighter mobile subheader pt-3) so we don't introduce
        // a new empty zone between breadcrumb and emoji on phones; desktop
        // keeps pt-9 to match the historical 36px reservation. When
        // showSubheader=false there is no breadcrumb to clear, so we drop the
        // shim AND shrink the hero's own top padding (pt-20 -> pt-16) since
        // that 80px also exists to push the title below the breadcrumb.
        <div className={showSubheader ? 'pt-3 md:pt-9' : ''}>
          <PageHero
            // ReactNode passes through unchanged. Empty / null / undefined
            // emoji is collapsed to '' so PageHero's truthiness check skips
            // the bouncing slot entirely (BentoPage etc.).
            emoji={hero.emoji ?? ''}
            titleWhite={hero.titleWhite}
            titleOrange={hero.titleOrange}
            subtitle={hero.subtitle ?? ''}
            largeTitle={hero.largeTitle ?? true}
            hideBackground
            floatingIcons={hero.floatingIcons}
            widgets={hero.widgets}
            highlightColor={hero.highlightColor}
            topPadding={showSubheader ? 'pt-10 md:pt-20' : 'pt-8 md:pt-16'}
          />
        </div>
      )}

      {stickySubheader && (
        // Renders AFTER the hero so its natural position is below the fold at
        // scroll=0 -- invisible until the user scrolls past the hero, then
        // pins at top-[60px] (with hero) / top-[101px] (without hero, clears
        // the breadcrumb row). Previously rendered before the hero, which
        // pinned it immediately since natural y=60 matched the sticky
        // threshold.
        <div className={`sticky ${hero ? 'top-[60px]' : 'top-[101px]'} z-20`}>
          {stickySubheader}
        </div>
      )}

      {heroAfter}

      {children}
    </div>
  );
};

export default GlobalLayout;