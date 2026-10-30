import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Review r1 D1 to D5: layout facts that live in the CSS cascade, which jsdom does not resolve.
 * A small resolver over theme/p3.css: descendant selectors of tag.class compounds, the winner
 * by specificity then source order (rules with pseudo-classes or attributes are left out).
 * D1 was exactly this: a three-class `display: inline` beat the two-class `.p3-block`.
 *
 * What it CANNOT see (review r2 R8): `!important`, a longhand against a shorthand (a later
 * `padding-top` against `padding`), and any rule with `:`, `[`, `>`, `+`, `~` or `*`. The two
 * raw-text checks at the end close the first two for the rules this file pins.
 */
const css = readFileSync(join(__dirname, '..', '..', 'theme', 'p3.css'), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

interface Node { tag: string; cls: string[] }
type Rule = { parts: Node[]; spec: [number, number]; order: number; decl: Record<string, string> };

const parseCompound = (s: string): Node | null => {
  if (/[:[>+~*]/.test(s)) return null;
  const [tag, ...cls] = s.split('.');
  return { tag, cls };
};
const rules: Rule[] = [];
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const decl: Record<string, string> = {};
  for (const d of m[2].matchAll(/([\w-]+)\s*:\s*([^;]+);?/g)) decl[d[1]] = d[2].trim();
  for (const sel of m[1].split(',')) {
    const parts = sel.trim().split(/\s+/).map(parseCompound);
    if (parts.some((p) => !p)) continue;
    const ps = parts as Node[];
    rules.push({ parts: ps, order: rules.length, decl, spec: [ps.reduce((n, p) => n + p.cls.length, 0), ps.filter((p) => p.tag).length] });
  }
}
const hits = (sel: Node, el: Node) => (!sel.tag || sel.tag === el.tag) && sel.cls.every((c) => el.cls.includes(c));
const matches = (parts: Node[], path: Node[]) => {
  if (!hits(parts[parts.length - 1], path[path.length - 1])) return false;
  let i = parts.length - 2;
  for (let j = path.length - 2; j >= 0 && i >= 0; j--) if (hits(parts[i], path[j])) i--;
  return i < 0;
};
/** The value `prop` resolves to on the last node of `path` (outermost first). */
const resolve = (path: string[], prop: string) => {
  const nodes = path.map((p) => parseCompound(p) as Node);
  const win = rules
    .filter((r) => prop in r.decl && matches(r.parts, nodes))
    .sort((a, b) => a.spec[0] - b.spec[0] || a.spec[1] - b.spec[1] || a.order - b.order)
    .pop();
  return win?.decl[prop];
};
const src = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');

const THEME = 'div.p3-theme';
const TALL = [THEME, 'div.p3-scrim', 'div.p3-sheet.p3-sheet-full'];

describe('P3 ticketing layout in the cascade (review r1 D1 to D5)', () => {
  it('D1: You > Get paid stacks its title over its subtitle', () => {
    expect(src('GetPaid.tsx')).toContain('<span className="p3-row-t p3-block">Get paid</span>');
    expect(resolve([THEME, 'a.p3-card.p3-status-row', 'span.p3-grow', 'span.p3-row-t.p3-block'], 'display')).toBe('block');
    // The Tickets row's spans stay inline (its subtitle carries its own separator).
    expect(resolve([THEME, 'button.p3-card.p3-status-row', 'span.p3-grow', 'span.p3-row-t'], 'display')).toBe('inline');
  });

  it('D2: a ticket type row pads once (the edit button inside it adds none)', () => {
    expect(src('TicketsEntry.tsx')).toMatch(/<div className="p3-type">\s*<button type="button" className="p3-date-btn p3-grow"/);
    expect(resolve([THEME, 'li.p3-row.p3-row-col', 'div.p3-type', 'button.p3-date-btn.p3-grow'], 'padding')).toBe('0');
    expect(resolve([THEME, 'li.p3-row.p3-row-col'], 'padding')).toBe('12px 0');
  });

  it('D5 and D3: the stacked sheet head is sticky and its Close is at least 44px wide', () => {
    expect(src('StackSheet.tsx')).toContain('<div className="p3-sheet-head p3-stack-head">');
    const head = [...TALL, 'div.p3-sheet-head.p3-stack-head'];
    expect(resolve(head, 'position')).toBe('sticky');
    expect(resolve(head, 'background')).toBe('var(--sheet)');
    expect(resolve([...head, 'button.p3-link'], 'min-width')).toBe('var(--tap)');
    expect(css).toMatch(/--tap:\s*44px;/);
    // The footer stays reachable: a shrinking body let a long list overflow past it (found on the 390px walk).
    expect(resolve([...TALL, 'div.p3-sheet-body'], 'flex')).toBe('1 0 auto');
    // W2's sheets (screens/Sheet.tsx) keep their head as it was.
    expect(resolve([THEME, 'div.p3-scrim', 'div.p3-sheet', 'div.p3-sheet-head'], 'position')).toBeUndefined();
  });

  it('D4: money figures are 22px and may wrap, so "12,345.00" fits a 173px tile', () => {
    expect(src('GetPaid.tsx')).toContain('<span className="p3-stat-n p3-money">{formatPence(t.grossPence)}</span>');
    const money = [THEME, 'div.p3-pair', 'div.p3-card.p3-stat', 'span.p3-stat-n.p3-money'];
    expect([resolve(money, 'font-size'), resolve(money, 'overflow-wrap')]).toEqual(['22px', 'anywhere']);
  });

  it('R1: toasts stack in one fixed column above the sheets, each toast in the flow', () => {
    expect([resolve([THEME, 'div.p3-toast-stack'], 'position'), resolve([THEME, 'div.p3-toast-stack'], 'z-index')]).toEqual(['fixed', '90']);
    expect(resolve([THEME, 'div.p3-toast-stack', 'div.p3-toast'], 'position')).toBe('static');
  });

  it('r3 S1: the toast column is anchored at the top, under the top bar, never over a sheet footer', () => {
    const stack = [THEME, 'div.p3-toast-stack'];
    expect(resolve(stack, 'bottom')).toBe('auto');
    expect(resolve(stack, 'top')).toBe('calc(var(--top-h) + 12px + env(safe-area-inset-top, 0px))');
    // The geometry itself (1, 3 and 6 toasts against the Refund and add sheets) is tests/e2e/p3-toast-geometry.spec.ts.
  });

  it('R8: what the resolver cannot see is not there: no !important, no longhand re-pad of a date button', () => {
    expect(css).not.toContain('!important');
    const datePad = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].includes('.p3-date-btn') && /padding-(top|bottom)/.test(m[2]));
    expect(datePad.map((m) => m[1].trim())).toEqual([]);
  });
});
