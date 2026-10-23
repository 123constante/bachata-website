import type { CSSProperties, SVGProps } from 'react';

/**
 * Line-art empty-state pictures (D121), drawn in the dancer accents. Decorative: aria-hidden.
 * Colours are the --da-* tokens (theme/dancer.css), set as a style so var() resolves (review N5: no hex here).
 */
const base: SVGProps<SVGSVGElement> = { viewBox: '0 0 72 72', fill: 'none', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, className: 'da-art' };

const ink = (token: '--da-plum' | '--da-pop-rose' | '--da-pop-teal' | '--da-pop-gold'): CSSProperties => ({ stroke: `var(${token})` });
const PLUM = ink('--da-plum');
const ROSE = ink('--da-pop-rose');
const TEAL = ink('--da-pop-teal');
const GOLD = ink('--da-pop-gold');

/** Moon and notes: no nights yet. */
export const MoonArt = () => (
  <svg {...base}>
    <path d="M44 14a22 22 0 1 0 14 34A18 18 0 0 1 44 14Z" style={PLUM} />
    <path d="M50 30v14M50 30l8-2v14" style={ROSE} />
    <circle cx="47" cy="45" r="3" style={ROSE} />
    <circle cx="55" cy="43" r="3" style={ROSE} />
  </svg>
);

/** Headphones and a star: teachers and DJs. */
export const HeadphonesArt = () => (
  <svg {...base}>
    <path d="M16 42V36a20 20 0 0 1 40 0v6" style={TEAL} />
    <rect x="12" y="40" width="9" height="16" rx="4" style={PLUM} />
    <rect x="51" y="40" width="9" height="16" rx="4" style={PLUM} />
    <path d="M36 26l2.4 5 5.4.7-4 3.7 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.7 5.4-.7Z" style={GOLD} />
  </svg>
);

/** Dancing couple: no dancer profile found. */
export const CoupleArt = () => (
  <svg {...base}>
    <circle cx="26" cy="16" r="6" style={ROSE} />
    <circle cx="46" cy="18" r="6" style={PLUM} />
    <path d="M26 24c-6 8-6 16-4 26M26 24c8 4 14 2 20-2M46 26c4 8 4 16 2 24M22 50l-4 10M26 50l6 10M48 50l-4 10M48 50l6 8" style={GOLD} />
  </svg>
);
