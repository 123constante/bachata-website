// Gold-invert CSS-var theme tokens for the venue detail page.
// Surfaces (cards, tiles, sheets) render in warm gold with dark ink on a
// black page background. Top/bottom nav are unaffected â€” this only applies
// inside the page wrapper.

export const venueGoldInvertTheme: Record<string, string> = {
  '--va-display': "'Bricolage Grotesque', system-ui, sans-serif",
  '--va-body': "'Manrope', system-ui, sans-serif",

  '--va-ink-gold': '#F2A93B',

  '--va-ink-text': '#ffffff',
  '--va-title-accent': '#F2A93B',
  '--va-rule': '#000000',

  '--va-bg': '#0E0F13',
  '--va-surface': '#F2A93B',
  '--va-surface2': '#E9A033',
  '--va-line': 'rgba(0,0,0,0.16)',
  '--va-accent-soft': 'rgba(0,0,0,0.10)',
  '--va-accent-line': 'rgba(0,0,0,0.22)',

  '--va-text': '#1A1305',
  '--va-text2': 'color-mix(in srgb, #1A1305 68%, transparent)',
  '--va-text3': 'color-mix(in srgb, #1A1305 48%, transparent)',
  '--va-accent': '#1A1305',

  '--va-btn-bg': '#0E0F13',
  '--va-btn-text': '#F2A93B',
  '--va-btn-border': 'color-mix(in srgb, #F2A93B 55%, transparent)',
  '--va-btn-glow': 'rgba(0,0,0,0.45)',

  '--va-halo': '#F2A93B',
};
