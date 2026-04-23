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
//   <main>). The pt-9 shim on the hero reserves the 36px underneath so the
//   emoji lands at the same Y position as pre-migration PageLayout pages.
//   Note: the Phase 2a brief specified `top-[60px]`, but inside the current
//   App.tsx layout the positioning context already begins below the header,
//   so top-0 is the correct literal value to achieve "flush under global
//   header". Revisit if App.tsx's spacer is ever removed.
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
  floatingCount = 20,
  heroAfter,
  children,
}: GlobalLayoutProps) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  // With hero: pt-20 puts the breadcrumb text at y=60+80+12=152, matching
  // the position the old in-hero PageBreadcrumb sits at on /parties today.
  // pointer-events-none on the outer wrapper so the pt-20 transparent zone
  // (and any sub-header area outside the breadcrumb/actions) lets clicks
  // pass through to the hero underneath (emoji's top ~5px sliver overlaps
  // this wrapper). Inner interactive wrappers re-enable pointer events.
  //
  // Without hero: tight sticky bar, no top padding — the row takes its
  // natural height under the header.
  const subHeaderClasses = hero
    ? 'absolute top-0 left-0 right-0 z-10 px-4 pt-20 flex items-center justify-between pointer-events-none'
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
            className="fixed inset-0 bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 -z-10 pointer-events-none"
            animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
            transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }}
            style={{ backgroundSize: '200% 200%' }}
          />
          <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            <FloatingElements count={floatingCount} />
          </div>
        </>
      )}

      {stickySubheader && (
        // With hero, the breadcrumb row is absolute (zero flow impact), so the
        // stickySubheader pins flush under the global header at top-[60px].
        // Without hero, the breadcrumb row is itself sticky at top-[60px]
        // with natural height ~41px, so the stickySubheader must pin below it
        // at top-[101px] (60 global + 41 breadcrumb row) to avoid overlap.
        <div className={`sticky ${hero ? 'top-[60px]' : 'top-[101px]'} z-20`}>
          {stickySubheader}
        </div>
      )}

      {showSubheader && subHeader}

      {hero && (
        <div className="pt-9">
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
            topPadding="pt-20"
          />
        </div>
      )}

      {heroAfter}

      {children}
    </div>
  );
};

export default GlobalLayout;
