// Gold-invert CSS-var theme tokens for the venue detail page.
// Surfaces (cards, tiles, sheets) render in warm gold with dark ink on a
// black page background. Top/bottom nav are unaffected -- this only applies
// inside the page wrapper.
//
// Reuses the brass/gold palette from Venues.tsx (itself lifted from
// Raffles.css rp-* tokens) so the list -> detail navigation stays one
// design system instead of two. Do not reintroduce a separate gold hex or
// a page-scoped font pair here; if the detail page ever earns a deliberate
// visual departure from the list page, that decision belongs in DESIGN.md,
// not a quiet token drift.
const RP_GOLD = '#f5d563';
const RP_GOLD_LT = '#f7e08a';
const RP_GOLD_DK = '#b38a4e';
const RP_INK_ON_GOLD = '#1a1206'; // matches the TONIGHT badge / Chip text on Venues.tsx

export const venueGoldInvertTheme: Record<string, string> = {
  '--va-display': 'inherit',
  '--va-body': 'inherit',

  '--va-ink-gold': RP_GOLD_LT,

  '--va-ink-text': '#ffffff',
  '--va-title-accent': RP_GOLD_LT,
  '--va-rule': '#000000',

  '--va-bg': '#0E0F13',
  '--va-surface': RP_GOLD_LT,
  '--va-surface2': RP_GOLD_DK,
  '--va-line': 'rgba(0,0,0,0.16)',
  '--va-accent-soft': 'rgba(0,0,0,0.10)',
  '--va-accent-line': 'rgba(0,0,0,0.22)',

  '--va-text': RP_INK_ON_GOLD,
  '--va-text2': `color-mix(in srgb, ${RP_INK_ON_GOLD} 68%, transparent)`,
  '--va-text3': `color-mix(in srgb, ${RP_INK_ON_GOLD} 48%, transparent)`,
  '--va-accent': RP_INK_ON_GOLD,

  '--va-btn-bg': '#0E0F13',
  '--va-btn-text': RP_GOLD_LT,
  '--va-btn-border': `color-mix(in srgb, ${RP_GOLD} 55%, transparent)`,
  '--va-btn-glow': 'rgba(0,0,0,0.45)',

  '--va-halo': RP_GOLD_LT,
};
