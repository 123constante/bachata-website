import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The P3 tokens file (theme/p3.css) is the ONE source of P3 colour and size.
 * Every text-on-ground pair a P3 screen paints is COMPUTED here from the file,
 * light and dark, and anything under 4.5:1 fails. Sizes are px only (the public
 * site shrinks rem on phones), and tap targets are at least 44px.
 */
const css = readFileSync(join(__dirname, '..', 'theme', 'p3.css'), 'utf8').replace(/\r\n/g, '\n');

function block(selector: string): Record<string, string> {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const light = block('.p3-theme');
const darkMedia = block('.p3-theme:not([data-theme="light"])');
const darkForced = block('.p3-theme[data-theme="dark"]');

type Rgba = [number, number, number, number];
function parse(T: Record<string, string>, token: string): Rgba {
  const v = T[token];
  expect(v, token).toBeDefined();
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1) as Rgba;
  const m = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/.exec(v);
  expect(m, `${token} = ${v}`).not.toBeNull();
  return [Number(m![1]), Number(m![2]), Number(m![3]), Number(m![4])];
}
/** Paint the stack top-first over an opaque bottom. */
function composite(T: Record<string, string>, stack: string[]): [number, number, number] {
  const [bottom, ...rest] = [...stack].reverse().map((t) => parse(T, t));
  expect(bottom[3], `${stack[stack.length - 1]} opaque`).toBe(1);
  let c: [number, number, number] = [bottom[0], bottom[1], bottom[2]];
  for (const [r, g, b, a] of rest) c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)];
  return c;
}
const lum = ([r, g, b]: [number, number, number]) => {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [text token, ground stack top-first]
const PAIRS: Array<[string, string[]]> = [
  ['--fg', ['--bg']], ['--fg', ['--card']], ['--fg', ['--card2']], ['--fg', ['--sheet']], ['--fg', ['--tab']],
  ['--mut', ['--bg']], ['--mut', ['--card']], ['--mut', ['--card2']], ['--mut', ['--tab']],
  ['--gold-fg', ['--card']], ['--gold-fg', ['--bg']], ['--gold-fg', ['--tab']],
  ['--btnfg', ['--btn']], ['--danger-fg', ['--danger']],
  ['--cancel-fg', ['--cancel-bg', '--card']], ['--ok-fg', ['--ok-bg', '--card']], ['--warn-fg', ['--warn-bg', '--card']],
  // W2a: the Status sheet (greyed rows, refusals, warnings), the cancelled-date tag and the toast
  ['--mut', ['--sheet']], ['--gold-fg', ['--sheet']], ['--cancel-fg', ['--cancel-bg', '--sheet']], ['--warn-fg', ['--warn-bg', '--sheet']],
  ['--bg', ['--fg']],
  // W2b: a danger action's title (.p3-danger-t) on the date sheet and a card; the typed value in .p3-in (fg on its sheet ground, above)
  ['--danger', ['--sheet']], ['--danger', ['--card']],
  // W3b-1 History: the day heading and row title (fg), who/time/date and Changed lines (mut) on a card; the intro note on the page
  ['--fg', ['--card']], ['--mut', ['--card']], ['--mut', ['--bg']], ['--gold-fg', ['--bg']],
  // W3b-2: a date's own photos (the remove x, fg on its sheet-colour chip), the leave / undo ask card (fg on card, danger button), the held-save reason (warn)
  ['--fg', ['--sheet']], ['--fg', ['--card']], ['--danger-fg', ['--danger']], ['--warn-fg', ['--warn-bg', '--sheet']], ['--mut', ['--sheet']],
];

// Non-text edges, WCAG 1.4.11 (3:1): the .p3-in box edge against the sheet it sits on.
const EDGES: Array<[string, string[]]> = [['--line-strong', ['--sheet']]];

describe.each([['light', light], ['dark (phone setting)', darkMedia], ['dark (forced)', darkForced]] as const)('%s', (_n, T0) => {
  const T = { ...light, ...T0 };
  it.each(PAIRS)('%s on %j >= 4.5', (fg, ground) => {
    const r = ratio(composite(T, [fg]), composite(T, ground));
    expect(r, `${fg} on ${ground.join(' over ')} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  });
  it.each(EDGES)('edge %s on %j >= 3', (edge, ground) => {
    const r = ratio(composite(T, [edge, ...ground]), composite(T, ground));
    expect(r, `${edge} on ${ground.join(' over ')} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(3);
  });
});

describe('one dark set', () => {
  it('the phone-setting dark and the forced dark are the same tokens', () => {
    expect(darkMedia).toEqual(darkForced);
  });
  it('dark overrides only colours a light token also defines', () => {
    for (const k of Object.keys(darkForced)) expect(light[k], k).toBeDefined();
  });
});

describe('sizes', () => {
  it('no rem or em anywhere in the tokens file', () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\d(rem|em)\b/);
  });
  it('the tap size is 44px and every tab uses it', () => {
    expect(light['--tap']).toBe('44px');
    expect(css).toMatch(/\.p3-tab \{[^}]*min-height: var\(--tap\)/);
    expect(parseInt(light['--tabbar-h'], 10)).toBeGreaterThanOrEqual(44);
  });
  it('no colour seam: the frame, top bar and page all paint --bg', () => {
    for (const sel of ['.p3-theme.p3-frame', '.p3-theme .p3-top', '.p3-theme .p3-main']) {
      expect(css).toMatch(new RegExp(`${sel.replace(/\./g, '\\.')} \\{[^}]*background: var\\(--bg\\)`));
    }
  });
  it('every colour a rule uses is a token (no literal colour outside the token blocks)', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*--/.test(l) && !/^\s*\.p3-theme(\[|:not| \{)/.test(l));
    for (const l of rules) expect(l, l).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(/i);
  });
});
