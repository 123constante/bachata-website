import { motion, useScroll, useSpring } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import PageHero, { type HeroWidget, type BreadcrumbItem } from '@/components/PageHero';
import { FloatingElements } from '@/components/FloatingElements';

interface PageLayoutProps {
  /** Hero emoji shown above the title */
  emoji: string;
  /** White portion of the two-tone hero title */
  titleWhite: string;
  /** Gold/accent portion of the two-tone hero title */
  titleOrange: string;
  /** Optional subtitle shown below the title */
  subtitle?: string;
  /** Current page label used in the breadcrumb trail (e.g. "Parties") */
  breadcrumbLabel: string;
  /** Optional emoji prefixed onto the breadcrumb label */
  breadcrumbEmoji?: string;
  /** Full breadcrumb trail. If provided, overrides breadcrumbLabel and breadcrumbEmoji. Pass when the page needs a multi-level trail like [{label: 'Parties', path: '/parties'}, {label: 'DJs'}]. */
  breadcrumbItems?: BreadcrumbItem[];
  /** Number of decorative floating elements behind the page (default 20) */
  floatingCount?: number;
  /** Show the top scroll-progress bar (default true) */
  showProgressBar?: boolean;
  /** Show the animated gradient wash background (default true) */
  showGradientBg?: boolean;
  /** Use the oversized title treatment (default true) */
  largeTitle?: boolean;
  /** Decorative icons passed through to PageHero */
  floatingIcons?: LucideIcon[];
  /** Optional widgets rendered in the hero section below the title */
  widgets?: HeroWidget[];
  /** Hero gradient starting color (default "primary") */
  gradientFrom?: string;
  /** Hide PageHero's internal gradient background (default true — PageLayout owns the wash) */
  hideBackground?: boolean;
  /** Tailwind class for the titleOrange span accent colour
   *  (e.g. "text-orange-500"). Defaults to PageHero's default
   *  ("text-primary") when not passed. */
  highlightColor?: string;
  /** Optional content rendered between the hero and {children}.
   *  Use for tab strips, secondary nav, or other controls that should
   *  sit visually attached to the hero section. */
  heroAfter?: React.ReactNode;
  /** Page-specific content rendered below the hero */
  children: React.ReactNode;
}

const PageLayout = ({
  emoji,
  titleWhite,
  titleOrange,
  subtitle = '',
  breadcrumbLabel,
  breadcrumbEmoji,
  breadcrumbItems: breadcrumbItemsProp,
  floatingCount = 20,
  showProgressBar = true,
  showGradientBg = true,
  largeTitle = true,
  floatingIcons,
  widgets,
  gradientFrom,
  hideBackground = true,
  highlightColor,
  heroAfter,
  children,
}: PageLayoutProps) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  const breadcrumbItems = breadcrumbItemsProp && breadcrumbItemsProp.length > 0
    ? breadcrumbItemsProp
    : [{ label: breadcrumbEmoji ? `${breadcrumbEmoji} ${breadcrumbLabel}` : breadcrumbLabel }];

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden">
      {/* Progress Bar */}
      {showProgressBar && (
        <motion.div
          className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-40 origin-left"
          style={{ scaleX }}
        />
      )}

      {/* Fixed gradient background wash */}
      {showGradientBg && (
        <motion.div
          className="fixed inset-0 bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 -z-10 pointer-events-none"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }}
          style={{ backgroundSize: '200% 200%' }}
        />
      )}

      {/* Floating decorative elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <FloatingElements count={floatingCount} />
      </div>

      {/* Hero */}
      <PageHero
        emoji={emoji}
        titleWhite={titleWhite}
        titleOrange={titleOrange}
        subtitle={subtitle}
        largeTitle={largeTitle}
        hideBackground={hideBackground}
        breadcrumbItems={breadcrumbItems}
        floatingIcons={floatingIcons}
        widgets={widgets}
        gradientFrom={gradientFrom}
        highlightColor={highlightColor}
        topPadding="pt-20"
      />

      {heroAfter}

      {children}
    </div>
  );
};

export default PageLayout;
