import { useEffect } from 'react';

// ============================================================
// DJ detail page theme + fonts
// Dark bento surface (near-black) with warm gold + orange accents,
// DM Serif Display headings over an Archivo body. Mirrors the venue
// page's approach (CSS-var tokens spread on the page wrapper + a
// client-only Google Fonts <link> injector), but the DJ page keeps
// DARK translucent tiles rather than the venue gold-invert surfaces.
// ============================================================

export const djInkTheme: Record<string, string> = {
  '--dj-display': "'DM Serif Display', Georgia, serif",
  '--dj-body': "'Archivo', system-ui, sans-serif",
  '--dj-script': "'Caveat', cursive",

  '--dj-bg': '#0A080B',
  '--dj-cream': '#F6F1EA',
  '--dj-gold': '#E7BE6E',
  '--dj-gold-light': '#FBEFC4',
  '--dj-gold-deep': '#D2A350',
  '--dj-orange': '#FF6A2C',
  '--dj-orange-soft': '#FF9A6C',

  // translucent tile surface + hairlines, over the near-black bg
  '--dj-tile': 'linear-gradient(160deg,rgba(246,241,234,0.05),rgba(246,241,234,0.015))',
  '--dj-tile-border': 'rgba(246,241,234,0.09)',
  '--dj-tile-inset': 'inset 0 1px 0 rgba(246,241,234,0.05)',
};

const FONT_LINK_ID = 'dj-page-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Archivo:wght@400;500;600;700;800;900&family=Caveat:wght@500;600;700&display=swap';

// Client-only: inject the Google Fonts stylesheet once, clean up on unmount.
export function useDjPageFonts() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
    return () => {
      document.getElementById(FONT_LINK_ID)?.remove();
    };
  }, []);
}
