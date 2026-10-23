/**
 * The dancer theme as data (D115: the Ember graphite ground, ember accent; the old plum / coral set is retired). theme/dancer.css holds
 * the SAME values as CSS custom properties scoped to [data-profile="dancer"];
 * tests/client/dancerAppTheme.test.ts fails if the two drift, if any selector in
 * the sheet escapes that scope, or if a TEXT_PAIRS entry drops below WCAG AA.
 *
 * Screens use the CSS variables (var(--da-text) ...), never these hex values;
 * this module exists for the tests and for canvas/SVG code that cannot read CSS.
 */
export const DANCER_TOKENS = {
  '--da-bg': '#202226',
  '--da-surface': '#2A2D32',
  '--da-surface-2': '#33373D',
  '--da-text': '#FFFFFF',
  '--da-text-muted': '#A3A9B3',
  '--da-accent': '#F5865A',
  '--da-on-accent': '#1D0A03',
  '--da-plum': '#C9ADFF',
  '--da-border': '#3D4148',
  '--da-danger': '#FF7A6B',
  /** The sunset gradient with its dark scrim already applied (prototype --sun + --sun-scrim): white text on both ends >= 4.5. */
  '--da-gradient-from': '#97462F',
  '--da-gradient-mid': '#922E58',
  '--da-gradient-to': '#5A31A5',
  '--da-on-gradient': '#FFFFFF',
  '--da-focus': '#FFC2B8',
  /** The no-photo avatar disc (audit H4): >= 3:1 on --da-bg and --da-surface, --da-text on it is AA. */
  '--da-avatar': '#717684',
  /**
   * Decorative accents for the line-art pictures (screens/art.tsx) and the confetti (shell/confetti.ts), review N5.
   * Never text: not in TEXT_PAIRS.
   */
  '--da-pop-ember': '#F0703A',
  '--da-pop-pink': '#E8487F',
  '--da-pop-violet': '#8A4DFF',
  '--da-pop-teal': '#4FE0CF',
  '--da-pop-gold': '#FFCF66',
  '--da-pop-rose': '#FF9CC0',
  /** The photo crop and preview well (screens/photo), review N5. A surface, never text. */
  '--da-photo-well': '#000000',
} as const;

export type DancerToken = keyof typeof DANCER_TOKENS;

/**
 * Foreground / background pairs a screen may put text on, with the minimum
 * contrast each must meet: 4.5 (WCAG AA body text) for all of them, so any pair
 * is safe at any size. The border is decorative and not listed; the focus ring
 * needs 3.0 (non-text contrast).
 */
export const TEXT_PAIRS: ReadonlyArray<{ fg: DancerToken; bg: DancerToken; min: number }> = [
  { fg: '--da-text', bg: '--da-bg', min: 4.5 },
  { fg: '--da-text', bg: '--da-surface', min: 4.5 },
  { fg: '--da-text', bg: '--da-surface-2', min: 4.5 },
  { fg: '--da-text-muted', bg: '--da-bg', min: 4.5 },
  { fg: '--da-text-muted', bg: '--da-surface', min: 4.5 },
  { fg: '--da-text-muted', bg: '--da-surface-2', min: 4.5 },
  { fg: '--da-accent', bg: '--da-bg', min: 4.5 },
  { fg: '--da-accent', bg: '--da-surface', min: 4.5 },
  { fg: '--da-on-accent', bg: '--da-accent', min: 4.5 },
  { fg: '--da-plum', bg: '--da-bg', min: 4.5 },
  { fg: '--da-plum', bg: '--da-surface', min: 4.5 },
  { fg: '--da-danger', bg: '--da-bg', min: 4.5 },
  { fg: '--da-danger', bg: '--da-surface', min: 4.5 },
  { fg: '--da-on-gradient', bg: '--da-gradient-from', min: 4.5 },
  { fg: '--da-on-gradient', bg: '--da-gradient-to', min: 4.5 },
  { fg: '--da-focus', bg: '--da-bg', min: 3 },
  // The avatar letter, and the disc itself as a non-text shape on the header and the switcher sheet (H4).
  { fg: '--da-text', bg: '--da-avatar', min: 4.5 },
  { fg: '--da-avatar', bg: '--da-bg', min: 3 },
  { fg: '--da-avatar', bg: '--da-surface', min: 3 },
];

const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** WCAG 2.x relative luminance of a #RRGGBB colour. */
export const luminance = (hex: string): number => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG 2.x contrast ratio between two #RRGGBB colours (1 to 21). */
export const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
