import type { SVGProps } from 'react';

/** Line-art empty-state pictures (D121), drawn in the dancer accents. Decorative: aria-hidden. */
const base: SVGProps<SVGSVGElement> = { viewBox: '0 0 72 72', fill: 'none', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, className: 'da-art' };

/** Moon and notes: no nights yet. */
export const MoonArt = () => (
  <svg {...base}>
    <path d="M44 14a22 22 0 1 0 14 34A18 18 0 0 1 44 14Z" stroke="#c9adff" />
    <path d="M50 30v14M50 30l8-2v14" stroke="#ff9cc0" />
    <circle cx="47" cy="45" r="3" stroke="#ff9cc0" />
    <circle cx="55" cy="43" r="3" stroke="#ff9cc0" />
  </svg>
);

/** Headphones and a star: teachers and DJs. */
export const HeadphonesArt = () => (
  <svg {...base}>
    <path d="M16 42V36a20 20 0 0 1 40 0v6" stroke="#4fe0cf" />
    <rect x="12" y="40" width="9" height="16" rx="4" stroke="#c9adff" />
    <rect x="51" y="40" width="9" height="16" rx="4" stroke="#c9adff" />
    <path d="M36 26l2.4 5 5.4.7-4 3.7 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.7 5.4-.7Z" stroke="#ffcf66" />
  </svg>
);

/** Music notes: nobody has looked at the page yet. */
export const NotesArt = () => (
  <svg {...base}>
    <path d="M28 52V20l26-6v32" stroke="#4fe0cf" />
    <circle cx="22" cy="52" r="6" stroke="#ff9cc0" />
    <circle cx="48" cy="46" r="6" stroke="#ff9cc0" />
  </svg>
);

/** Dancing couple: no dancer profile found. */
export const CoupleArt = () => (
  <svg {...base}>
    <circle cx="26" cy="16" r="6" stroke="#ff9cc0" />
    <circle cx="46" cy="18" r="6" stroke="#c9adff" />
    <path d="M26 24c-6 8-6 16-4 26M26 24c8 4 14 2 20-2M46 26c4 8 4 16 2 24M22 50l-4 10M26 50l6 10M48 50l-4 10M48 50l6 8" stroke="#ffcf66" />
  </svg>
);
