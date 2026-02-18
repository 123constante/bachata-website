import { motion } from 'framer-motion';
import { Sparkles, Star, Heart, Music, Zap, PartyPopper } from 'lucide-react';

const EMOJI_OPTIONS = ['', '', '', '', '', '', '', ''];

const icons = [Sparkles, Star, Heart, Music, Zap, PartyPopper];

interface FloatingElementsProps {
  emoji?: string | boolean | null;
  count?: number;
  className?: string;
}

export const FloatingElements = ({ count = 10, className = '', emoji = null }: FloatingElementsProps) => {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none z-0 ${className}`}>
      {[...Array(count)].map((_, i) => {
        const Icon = icons[i % icons.length];
        const isEmojiMode = emoji !== null && emoji !== undefined && emoji !== false;
        const emojiChar = typeof emoji === 'string' ? emoji : EMOJI_OPTIONS[i % EMOJI_OPTIONS.length];
        const size = Math.random() * 50 + 30;
        const delay = Math.random() * 5;
        const duration = 4 + Math.random() * 8;
        const startX = Math.random() * 100;
        const startY = Math.random() * 100;

        return (
          <motion.div
            key={i}
            className="absolute text-primary/30"
            style={{
              left: `${startX}%`,
              top: `${startY}%`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, 20, 0],
              rotate: [0, 360],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration,
              delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {isEmojiMode ? (
              <span style={{ fontSize: size }}>{emojiChar}</span>
            ) : (
              <Icon size={size} />
            )}
          </motion.div>
        );
      })}

      {/* Subtle glowing orbs */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={`orb-${i}`}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 80 + 40,
            height: Math.random() * 80 + 40,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: `radial-gradient(circle, ${
              i % 3 === 0 ? 'hsl(var(--primary) / 0.08)' : 
              i % 3 === 1 ? 'hsl(var(--festival-pink) / 0.06)' : 
              'hsl(var(--festival-purple) / 0.06)'
            }, transparent)`,
            filter: 'blur(30px)',
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 8 + Math.random() * 4,
            delay: Math.random() * 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};




