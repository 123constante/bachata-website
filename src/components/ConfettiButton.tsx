import { ReactNode, useRef } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

interface ConfettiButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export const ConfettiButton = ({ 
  children, 
  className = '', 
  onClick,
  variant = 'primary' 
}: ConfettiButtonProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    // Trigger confetti from button position
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { x, y },
        colors: ['#ff9500', '#ff6b00', '#ffb800', '#ff4500', '#ffd700'],
        ticks: 100,
        gravity: 1.2,
        scalar: 0.9,
        shapes: ['circle', 'square'],
      });
    }

    onClick?.();
  };

  const baseStyles = "relative overflow-hidden font-bold rounded-full transition-all duration-300";
  const variants = {
    primary: "bg-gradient-to-r from-primary to-festival-pink text-primary-foreground px-8 py-4 text-lg shadow-lg hover:shadow-primary/50",
    secondary: "bg-surface border-2 border-primary/50 text-primary px-6 py-3 hover:bg-primary/10",
    ghost: "bg-transparent text-primary hover:bg-primary/10 px-4 py-2"
  };

  return (
    <motion.button
      ref={buttonRef}
      onClick={handleClick}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      whileHover={{ 
        scale: 1.05,
        boxShadow: '0 0 30px hsl(var(--primary) / 0.5)'
      }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {/* Ripple Effect */}
      <motion.span
        className="absolute inset-0 bg-white/20 rounded-full"
        initial={{ scale: 0, opacity: 1 }}
        whileTap={{ scale: 2.5, opacity: 0 }}
        transition={{ duration: 0.5 }}
      />
      
      {/* Shine Effect */}
      <motion.span
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full"
        animate={{ translateX: ['−100%', '200%'] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
      />
      
      <span className="relative z-10 flex items-center gap-2">
        {children}
      </span>
    </motion.button>
  );
};
