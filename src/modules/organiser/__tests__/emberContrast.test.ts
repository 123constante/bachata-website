import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * WCAG text contrast of the Ember world (ER-FIX C2-1/2/4). Every text token a
 * component paints on a background token is listed here, the ratio is COMPUTED
 * from ember.css, and anything under 4.5:1 fails. Each row also checks that the
 * component still uses that pair, so the table cannot drift from the code.
 */

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const emberCss = read('ui/ember.css');

/** Tokens of the ember override rule (the one whose selector list holds `.org-theme.ember-world`). */
function emberTokens(): Record<string, string> {
  const at = emberCss.indexOf('.org-theme.ember-world');
  expect(at, 'ember override rule').toBeGreaterThanOrEqual(0);
  const body = emberCss.slice(emberCss.indexOf('{', at) + 1, emberCss.indexOf('\n}', at));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) out[m[1]] = m[2].trim();
  return out;
}
const T = emberTokens();

type Rgba = [number, number, number, number];
function parse(token: string): Rgba {
  const v = T[token];
  expect(v, token).toBeDefined();
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1) as Rgba;
  const rgba = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/.exec(v);
  expect(rgba, `${token} = ${v}`).not.toBeNull();
  return [Number(rgba![1]), Number(rgba![2]), Number(rgba![3]), Number(rgba![4])];
}
/** Paint `top` over the stack, last element first; the bottom must be opaque. */
function composite(stack: string[]): [number, number, number] {
  const [bottom, ...rest] = [...stack].reverse().map(parse);
  expect(bottom[3], `${stack[stack.length - 1]} opaque`).toBe(1);
  let c: [number, number, number] = [bottom[0], bottom[1], bottom[2]];
  for (const [r, g, b, a] of rest) c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)];
  return c;
}
const lum = (rgb: [number, number, number]) => {
  const [r, g, b] = rgb.map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrast(fg: [number, number, number], bg: [number, number, number]): number {
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const SURFACES = ['--bg', '--card', '--card2', '--sheet'];

interface Pair {
  what: string;
  fg: string;
  /** Background stack, top first; the last one is an opaque surface. */
  bg: string[];
  file: string;
  /** Class text the file must contain for this pair. */
  uses: string[];
}

const PAIRS: Pair[] = [
  { what: 'Chip selected text', fg: '--gold-fg', bg: ['--card2'], file: 'ui/Chip.tsx', uses: ['bg-[var(--card2)]', "'border-[var(--gold)] font-semibold text-[var(--gold-fg,"] },
  { what: 'Chip text', fg: '--fg', bg: ['--card2'], file: 'ui/Chip.tsx', uses: ['text-[var(--fg)]'] },
  { what: 'Field placeholder', fg: '--ph', bg: ['--card2'], file: 'ui/Field.tsx', uses: ['bg-[var(--card2)]', 'placeholder:text-[var(--ph)]'] },
  { what: 'Field text', fg: '--fg', bg: ['--card2'], file: 'ui/Field.tsx', uses: ['text-[var(--fg)]'] },
  { what: 'StatusTag neutral', fg: '--mut', bg: ['--card2'], file: 'ui/StatusTag.tsx', uses: ['bg-[var(--card2)] text-[var(--mut)]'] },
  ...SURFACES.flatMap((s): Pair[] => [
    { what: `StatusTag draft/party on ${s}`, fg: '--warn-fg', bg: ['--warn-bg', s], file: 'ui/StatusTag.tsx', uses: ['bg-[var(--warn-bg)] text-[var(--warn-fg)]'] },
    { what: `StatusTag live on ${s}`, fg: '--ok-fg', bg: ['--ok-bg', s], file: 'ui/StatusTag.tsx', uses: ['bg-[var(--ok-bg)] text-[var(--ok-fg)]'] },
    { what: `Home problem tag on ${s}`, fg: '--warn-fg', bg: ['--warn-bg', s], file: 'home/index.tsx', uses: ["'bg-[var(--warn-bg)] text-[var(--warn-fg)]'"] },
    { what: `Cancelled note on ${s}`, fg: '--warn-fg', bg: ['--warn-bg', s], file: 'dates/index.tsx', uses: ['bg-[var(--warn-bg)] px-[16px] py-[12px] text-[14px] text-[var(--warn-fg)]'] },
  ]),
  { what: 'Home job sub line on card', fg: '--warn-fg', bg: ['--card'], file: 'home/index.tsx', uses: ['text-[13px] text-[var(--warn-fg)]'] },
  { what: 'Accent text button on sheet', fg: '--gold', bg: ['--sheet'], file: 'ui/SheetView.tsx', uses: ['font-semibold text-[var(--gold)]'] },
  { what: 'Accent text button on card', fg: '--gold', bg: ['--card'], file: 'ui/PersonRow.tsx', uses: ['font-semibold text-[var(--gold)]'] },
  { what: 'Button label on accent', fg: '--btnfg', bg: ['--btn'], file: 'ui/Buttons.tsx', uses: ['var(--btnfg)'] },
  // ER-FIX2-S5 (S4 Not verified): the danger words on the event page (actions on the ground, End in the
  // No coming dates card, the failed-update line in the dock sheet) and the danger-filled confirm buttons.
  ...(['--bg', '--card', '--card2', '--sheet'] as const).map((s): Pair => (
    { what: `Danger text on ${s}`, fg: '--danger', bg: [s], file: 'events/EventPage.tsx', uses: ["'text-[var(--danger)]'"] })),
  { what: 'Button label on danger', fg: '--btnfg', bg: ['--danger'], file: 'events/EventPage.tsx', uses: ['bg-[var(--danger)] text-[var(--btnfg)]'] },
];

describe('Ember text contrast is at least 4.5:1', () => {
  it.each(PAIRS)('$what', ({ fg, bg, file, uses }) => {
    const src = read(file);
    for (const u of uses) expect(src, `${file} uses ${u}`).toContain(u);
    const ratio = contrast(composite([fg]), composite(bg));
    expect(ratio, `${fg} on ${bg.join(' over ')} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  });

  it('the formula matches the WCAG reference values', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 2);
  });

  it('the accent stays #f0703a for fills and borders', () => {
    expect(T['--gold']).toBe('#f0703a');
    expect(T['--btn']).toBe('#f0703a');
  });
});
