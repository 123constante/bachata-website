import { motion, useScroll, useSpring } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import PageHero from '@/components/PageHero';
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
  floatingCount = 20,
  showProgressBar = true,
  showGradientBg = true,
  largeTitle = true,
  floatingIcons,
  children,
}: PageLayoutProps) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  const breadcrumbItems = [
    { label: breadcrumbEmoji ? `${breadcrumbEmoji} ${breadcrumbLabel}` : breadcrumbLabel },
  ];

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden pb-20">
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
        hideBackground={true}
        breadcrumbItems={breadcrumbItems}
        floatingIcons={floatingIcons}
        topPadding="pt-20"
      />

      {children}
    </div>
  );
};

export default PageLayout;
