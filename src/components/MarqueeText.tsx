import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface MarqueeTextProps {
  children: ReactNode;
  speed?: number;
  direction?: 'left' | 'right';
  className?: string;
  pauseOnHover?: boolean;
}

export const MarqueeText = ({ 
  children, 
  speed = 30, 
  direction = 'left',
  className = '',
  pauseOnHover = true
}: MarqueeTextProps) => {
  const baseVelocity = direction === 'left' ? -speed : speed;

  return (
    <div className={`overflow-hidden whitespace-nowrap ${className}`}>
      <motion.div
        className={`inline-flex ${pauseOnHover ? 'hover:[animation-play-state:paused]' : ''}`}
        animate={{ x: direction === 'left' ? ['0%', '-50%'] : ['-50%', '0%'] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: 'loop',
            duration: 100 / Math.abs(baseVelocity),
            ease: 'linear',
          },
        }}
      >
        <span className="inline-flex">{children}</span>
        <span className="inline-flex">{children}</span>
      </motion.div>
    </div>
  );
};

// Vertical Marquee
interface VerticalMarqueeProps {
  items: string[];
  speed?: number;
  className?: string;
}

export const VerticalMarquee = ({ 
  items, 
  speed = 20,
  className = '' 
}: VerticalMarqueeProps) => {
  return (
    <div className={`overflow-hidden h-[200px] ${className}`}>
      <motion.div
        animate={{ y: ['0%', '-50%'] }}
        transition={{
          y: {
            repeat: Infinity,
            repeatType: 'loop',
            duration: items.length * (10 / speed),
            ease: 'linear',
          },
        }}
      >
        {[...items, ...items].map((item, i) => (
          <div
            key={i}
            className="py-2 text-center text-muted-foreground hover:text-primary transition-colors"
          >
            {item}
          </div>
        ))}
      </motion.div>
    </div>
  );
};
