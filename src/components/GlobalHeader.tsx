import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCity } from '@/contexts/CityContext';
import bachataCalendarLogo from '@/assets/brand/bachata-calendar-logo.png';

export const GlobalHeader = () => {
  const [scrolled, setScrolled] = useState(false);
  const { citySlug } = useCity();
  const homePath = citySlug ? `/${citySlug}` : '/';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-[60] border-b border-primary/10 h-[60px]"
      animate={{
        backgroundColor: scrolled ? 'hsl(var(--background) / 0.98)' : 'hsl(var(--background) / 0.85)',
        backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'blur(8px) saturate(100%)',
      }}
      transition={{ duration: 0.3 }}
    >
      <nav className="flex items-center justify-center h-[58px] px-4">
        <Link to={homePath} className="flex items-center shrink-0" aria-label="Bachata Calendar home">
          <img src={bachataCalendarLogo} alt="Bachata Calendar" className="h-8 w-auto" />
        </Link>
      </nav>

      {/* Decorative orange line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
    </motion.header>
  );
};
