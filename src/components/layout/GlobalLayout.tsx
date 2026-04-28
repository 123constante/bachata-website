import type { ReactNode } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHero, { type HeroWidget } from '@/components/PageHero';
import PageBreadcrumb, { type BreadcrumbItemType } from '@/components/PageBreadcrumb';
import { FloatingElements } from '@/components/FloatingElements';

interface HeroProps {
  // emoji is typed as optional for future BentoPage consumption (title-only hero).
  // Current runtime still delegates to PageHero which requires emoji — an empty
  // string renders an invisible but layout-occupying motion div. Full omission
  // will be wired when BentoPage migrates in Phase 2c.
  emoji?: string;
  titleWhite: string;
  titleOrange: string;
  subtitle?: string;
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
  showGradientBg?: boolean;
  // Palette for the full-page gradient wash + progress-bar/floating-icon
  // companions (gated by showGradientBg). 'default' renders the orange /
  // festival-purple / festival-pink wash that 36+ public pages depend on;
  // 'bento' swaps to brass / plum / velvet for the event page's
  // themed-surface treatment. Always defaults to 'default' so existing
  // consumers are unaffected.
  gradientPalette?: 'default' | 'bento';
  floatingCount?: number;
  heroAfter?: ReactNode;
  children: ReactNode;
}

// PageBreadcrumb auto-prepends the Home icon — this list is the trail AFTER
// Home. Empty default = just the Home icon, no "Home" text duplicated.
const DEFAULT_BREADCRUMBS: BreadcrumbItemType[] = [];

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
  showGradientBg = true,
  gradientPalette = 'default',
  floatingCount = 20,
  heroAfter,
  children,
}: GlobalLayoutProps) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  // With hero: pt-3 on mobile / pt-20 on desktop. Mobile keeps the breadcrumb
  // tight under the 60px global header; desktop preserves the historical
  // alignment (breadcrumb text at y≈152, matching the position the old
  // in-hero PageBreadcrumb sits at on /parties today). pointer-events-none
  // on the outer wrapper so the transparent zone (and any sub-header area
  // outside the breadcrumb/actions) lets clicks pass through to the hero
  // underneath. Inner interactive wrappers re-enable pointer events.
  //
  // Without hero: tight sticky bar, no top padding — the row takes its
  // natural height under the header.
  const subHeaderClasses = hero
    ? 'absolute top-0 left-0 right-0 z-10 px-4 pt-3 md:pt-20 flex items-center justify-between pointer-events-none'
    : 'sticky top-[60px] z-10 min-h-9 px-4 bg-background/80 backdrop-blur-sm flex items-center justify-between';

  const subHeader = (
    <div className={subHeaderClasses}>
      <div className="flex items-center gap-1.5 min-w-0 pointer-events-auto">
        {backHref && (
          <Link
            to={backHref}
            aria-label="Back"
            className="flex items-center justify-center w-7 h-7 -ml-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
        )}
        <PageBreadcrumb items={breadcrumbs} />
      </div>
      {headerActions && (
        <div className="flex items-center gap-2 shrink-0 pointer-events-auto">{headerActions}</div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden relative">
      {showProgressBar && (
        <motion.div
          className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-40 origin-left"
          style={{ scaleX }}
        />
      )}

      {showGradientBg && (
        <>
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
          <div
            className={`fixed inset-x-0 bottom-0 ${hero ? 'top-[181px]' : 'top-[101px]'} z-0 pointer-events-none overflow-hidden`}
          >
            <FloatingElements count={floatingCount} />
          </div>
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
        // shim AND shrink the hero's own top padding (pt-20 → pt-16) since
        // that 80px also exists to push the title below the breadcrumb.
        <div className={showSubheader ? 'pt-3 md:pt-9' : ''}>
          <PageHero
            // emoji is typed as optional on GlobalLayout's HeroProps for future
            // BentoPage consumption (title-only hero). PageHero still requires
            // a string, so absent emojis pass through as ''. This renders an
            // invisible motion div that still occupies the mb-4 spacing slot.
            // Full omission (no motion div at all) will be wired when BentoPage
            // migrates in Phase 2c — it's the first consumer that actually
            // needs a title-only hero.
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
        // scroll=0 — invisible until the user scrolls past the hero, then pins
        // at top-[60px] (with hero) / top-[101px] (without hero, clears the
        // breadcrumb row). Previously rendered before the hero, which pinned
        // it immediately since natural y=60 matched the sticky threshold.
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
