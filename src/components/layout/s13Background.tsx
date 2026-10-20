// PROTOTYPE (search v7, S13): site-wide background options A / B / C.
// Active ONLY when (DEV || VITE_MOCKS=true) AND the URL has ?s13=A|B|C. Otherwise
// every helper returns null and GlobalLayout renders exactly what it did before.
import { useEffect, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';

export type S13Option = 'A' | 'B' | 'C';

const ENABLED = import.meta.env.DEV || import.meta.env.VITE_MOCKS === 'true';

export function useS13Option(): S13Option | null {
  const { search } = useLocation();
  if (!ENABLED) return null;
  const v = new URLSearchParams(search).get('s13');
  return v === 'A' || v === 'B' || v === 'C' ? v : null;
}

// Page ground under everything (also fills the strip above the footer).
export const S13_BASE: Record<S13Option, string> = {
  A: '#0a0610', // purple kept, a touch deeper than black so the footer margin matches
  B: '#0e1215', // calm graphite, cool, between role teal #06191F and near-black #0A080B
  C: '#0b0614', // night-club indigo
};

export const S13_WASH: Record<S13Option, CSSProperties> = {
  A: {
    background:
      'radial-gradient(120% 60% at 50% 0%, rgba(124,58,237,0.22), transparent 62%), ' +
      'radial-gradient(90% 50% at 100% 100%, rgba(236,72,153,0.10), transparent 60%)',
  },
  B: {
    background:
      'radial-gradient(130% 55% at 50% 0%, rgba(120,170,190,0.10), transparent 62%), ' +
      'linear-gradient(180deg, #11181c, #0e1215 60%)',
  },
  C: {
    background:
      'radial-gradient(90% 45% at 12% 0%, rgba(255,140,60,0.30), transparent 62%), ' +
      'radial-gradient(90% 45% at 100% 8%, rgba(236,72,153,0.26), transparent 62%), ' +
      'radial-gradient(120% 60% at 50% 110%, rgba(99,60,220,0.30), transparent 60%)',
  },
};

/** Options B and C turn the icons off; A keeps a few, dimmed, and only in the gutters. */
export const S13_ICONS: Record<S13Option, number> = { A: 4, B: 0, C: 0 };

/** Paint <html>/<body> so the strip above the footer is not a black band. */
export function useS13Body(option: S13Option | null) {
  useEffect(() => {
    if (!option) return;
    const prevB = document.body.style.background;
    const prevH = document.documentElement.style.background;
    document.body.style.background = S13_BASE[option];
    document.documentElement.style.background = S13_BASE[option];
    return () => {
      document.body.style.background = prevB;
      document.documentElement.style.background = prevH;
    };
  }, [option]);
}
