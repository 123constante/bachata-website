import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCity } from '@/contexts/CityContext';
import { buildCityPath } from '@/lib/cityPath';

const BASE_NAV_LINKS = [
  { segment: '', label: 'Home', emoji: '🏠' },
  { segment: 'parties', label: 'Parties', emoji: '🎉' },
  { segment: 'classes', label: 'Classes', emoji: '🎓' },
  { segment: 'venues', label: 'Venues', emoji: '🏛️' },
];

const emojiAnimations = {
  '🏠': {
    animate: { y: [0, -4, 0] },
    transition: { repeat: Infinity, duration: 2.8, ease: 'easeInOut' as const },
  },
  '🎉': {
    animate: { y: [0, -8, 0], scale: [1, 1.1, 1] },
    transition: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' as const },
  },
  '🎓': {
    animate: { y: [0, -6, 0] },
    transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' as const },
  },
  '🏛️': {
    animate: { scale: [1, 1.08, 1] },
    transition: { repeat: Infinity, duration: 2.5, ease: 'easeInOut' as const },
  },
  '💫': {
    animate: { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] },
    transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' as const },
  },
  '✂️': {
    animate: { x: [-2, 2, -2] },
    transition: { repeat: Infinity, duration: 0.4, ease: 'easeInOut' as const },
  },
};

export const BottomNav = () => {
  const location = useLocation();
  const { citySlug } = useCity();

  const navLinks = BASE_NAV_LINKS.map((link) => ({
    ...link,
    path: buildCityPath(citySlug, link.segment || undefined),
  }));

  const isActive = (path: string) => location.pathname === path || location.pathname === `/${path.split('/').pop()}`;

  return (
    <nav
      aria-label="Main sections"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-primary/10 pb-[env(safe-area-inset-bottom)]"
      style={{
        backgroundColor: 'hsl(var(--background) / 0.85)',
        backdropFilter: 'blur(8px) saturate(100%)',
        WebkitBackdropFilter: 'blur(8px) saturate(100%)',
      }}
    >
      {/* Decorative orange line — top edge on BottomNav (faces content) */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

      <div className="flex items-center justify-around h-[58px] px-2">
        {navLinks.map((link) => {
          const animation = emojiAnimations[link.emoji as keyof typeof emojiAnimations];
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`relative flex flex-col items-center px-2 py-2 text-xs font-medium transition-all no-underline group rounded-md min-h-[44px] justify-center ${isActive(link.path) ? 'bg-primary/15' : ''}`}
            >
              <motion.span
                className="text-base mb-0.5 cursor-pointer"
                animate={animation.animate}
                transition={animation.transition}
                whileHover={{ scale: 1.3 }}
              >
                {link.emoji}
              </motion.span>

              {/* Label - always visible */}
              <span
                className={
                  isActive(link.path)
                    ? 'text-primary font-bold'
                    : 'text-muted-foreground/50 group-hover:text-foreground'
                }
              >
                {link.label}
              </span>

              {isActive(link.path) && (
                <motion.div
                  className="absolute top-0 left-1.5 right-1.5 h-0.5 bg-primary rounded-full"
                  layoutId="bottomNavActive"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
