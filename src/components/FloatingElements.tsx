import { motion } from 'framer-motion';
import { Sparkles, Star, Heart, Music, Zap, PartyPopper } from 'lucide-react';

const EMOJI_OPTIONS = ['', '', '', '', '', '', '', ''];

const icons = [Sparkles, Star, Heart, Music, Zap, PartyPopper];

// SSR-safety: these decorative blobs previously used Math.random() at render,
// which produces different values on the server vs the client and breaks
// hydration (React discards the SSR subtree). Seed a deterministic pseudo-random
// by (index, salt) so both renders agree. Purely decorative — only determinism
// matters, not true randomness.
//
// INTEGER hash only (no Math.sin): transcendental functions are NOT required to
// be bit-identical across JS engines, so a Math.sin-based seed still diverges by
// a sub-pixel ULP between Node (server) and V8 (browser) and re-breaks hydration.
// +,-,*,^,>>> are IEEE-754-exact everywhere. (spike/rr7-framework-mode)
const seeded = (i: number, salt: number): number => {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = (Math.imul(h ^ (h >>> 13), 1274126177)) | 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
};

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
        const size = seeded(i, 1) * 50 + 30;
        const delay = seeded(i, 2) * 5;
        const duration = 4 + seeded(i, 3) * 8;
        const startX = seeded(i, 4) * 100;
        const startY = seeded(i, 5) * 100;

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
            width: seeded(i, 6) * 80 + 40,
            height: seeded(i, 7) * 80 + 40,
            left: `${seeded(i, 8) * 100}%`,
            top: `${seeded(i, 9) * 100}%`,
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
            duration: 8 + seeded(i, 10) * 4,
            delay: seeded(i, 11) * 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};




