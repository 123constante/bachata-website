/**
 * The dancer theme (plum / coral, mockups v8) as data. theme/dancer.css holds
 * the SAME values as CSS custom properties scoped to [data-profile="dancer"];
 * tests/client/dancerAppTheme.test.ts fails if the two drift, if any selector in
 * the sheet escapes that scope, or if a TEXT_PAIRS entry drops below WCAG AA.
 *
 * Screens use the CSS variables (var(--da-text) ...), never these hex values;
 * this module exists for the tests and for canvas/SVG code that cannot read CSS.
 */
export const DANCER_TOKENS = {
  '--da-bg': '#1C0D22',
  '--da-surface': '#2A1433',
  '--da-surface-2': '#3A1E47',
  '--da-text': '#FFF4F1',
  '--da-text-muted': '#D7C0D4',
  '--da-accent': '#FF7A66',
  '--da-on-accent': '#1C0D22',
  '--da-plum': '#D58BE6',
  '--da-border': '#5A3468',
  '--da-danger': '#FF9A8F',
  '--da-gradient-from': '#6E2380',
  '--da-gradient-to': '#C23B55',
  '--da-on-gradient': '#FFFFFF',
  '--da-focus': '#FFC2B8',
  /** The no-photo avatar disc (audit H4): >= 3:1 on --da-bg and --da-surface, --da-text on it is AA. */
  '--da-avatar': '#8A5A9C',
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
