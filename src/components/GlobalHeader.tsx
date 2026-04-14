import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCity } from '@/contexts/CityContext';

const BASE_NAV_LINKS = [
  { segment: 'parties', label: 'Parties', emoji: '🎉' },
  { segment: 'classes', label: 'Classes', emoji: '🎓' },
];

const emojiAnimations = {
  '🎉': {
    animate: { y: [0, -8, 0], scale: [1, 1.1, 1] },
    transition: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' as const },
  },
  '🎓': {
    animate: { y: [0, -6, 0] },
    transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' as const },
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

export const GlobalHeader = () => {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { citySlug } = useCity();

  const navLinks = BASE_NAV_LINKS.map((link) => ({
    ...link,
    path: citySlug ? `/${citySlug}/${link.segment}` : `/${link.segment}`,
  }));

  const isActive = (path: string) => location.pathname === path || location.pathname === `/${path.split('/').pop()}`;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header 
      className="fixed top-0 left-0 right-0 z-[60] border-b border-primary/10"
      animate={{
        backgroundColor: scrolled ? 'hsl(var(--background) / 0.98)' : 'hsl(var(--background) / 0.85)',
        backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'blur(8px) saturate(100%)',
      }}
      transition={{ duration: 0.3 }}
    >
      {/* Navigation Tabs - The Global Header */}
      <motion.nav 
        className="flex items-center justify-center gap-1 py-2"
        animate={{ paddingTop: scrolled ? 4 : 6, paddingBottom: scrolled ? 4 : 6 }}
        transition={{ duration: 0.2 }}
      >
        {navLinks.map((link) => {
          const animation = emojiAnimations[link.emoji as keyof typeof emojiAnimations];
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`relative flex flex-col items-center px-4 py-0.5 text-xs font-medium transition-all no-underline group rounded-md min-w-[60px] ${isActive(link.path) ? 'bg-primary/15' : ''}`}
            >
              {/* Emoji - fades on scroll */}
              <motion.span
                className="text-base mb-0.5 cursor-pointer"
                animate={{
                  ...animation.animate,
                  opacity: scrolled ? 0 : 1,
                  height: scrolled ? 0 : 'auto',
                  marginBottom: scrolled ? 0 : 2,
                }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
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
                  className="absolute bottom-0 left-1.5 right-1.5 h-0.5 bg-primary rounded-full"
                  layoutId="activeTab"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </motion.nav>

      {/* Decorative orange line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
    </motion.header>
  );
};

