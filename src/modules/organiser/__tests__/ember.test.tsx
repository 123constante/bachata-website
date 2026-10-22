// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Chip, EmberWorld, SheetView } from '../ui';

afterEach(cleanup);

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const emberCss = read('ui/ember.css');
const themeCss = read('theme.css');

/** Declarations of the first rule whose selector line equals `selector`. */
function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} block`).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) out[m[1]] = m[2].trim();
  return out;
}

const orgDefaults = { ...block(themeCss, '.org-theme'), ...block(emberCss, '.org-theme') };
const ember = block(emberCss, '.org-theme.ember-world');

// TODAY's values, written out by hand (not read back from the css under test).
const TODAY: Record<string, string> = {
  '--bg': '#0f0d0b', '--card': '#1a1713', '--card2': '#231f19', '--sheet': '#1d1a15', '--tab': '#0c0a08',
  '--line': '#2e2922', '--line-strong': '#776e60', '--fg': '#f6f1e7', '--mut': '#a39a8b', '--ph': '#8f8678',
  '--gold': '#ffa600', '--btn': '#f6f1e7', '--btnfg': '#15120e', '--danger': '#ff8a7a',
  '--ok-bg': '#1f3a2a', '--ok-fg': '#8fe0b0', '--warn-bg': '#3a2d10', '--warn-fg': '#ffd58a',
  '--skel-a': '#1d1a15', '--skel-b': '#2a251d',
  '--r-card': '16px', '--r-ctl': '12px', '--r-chip': '8px', '--r-cover': '20px', '--r-sheet': '24px',
  '--r-date': '8px', '--gold-fg': '#ffa600',
  '--warn-line': '#5a4118', '--warn-from': '#3a2a10', '--warn-to': '#2a1f10',
};
// --r-chip, --r-card, --r-ctl have no default in .org-theme besides the radii below.
const NO_OVERRIDE_NEEDED = new Set<string>(['--tab']);

describe('ember tokens', () => {
  it.each(Object.entries(TODAY))('default %s equals today (%s)', (token, value) => {
    expect(orgDefaults[token]).toBe(value);
  });

  it('font default is the system stack', () => {
    expect(orgDefaults['--font-ui']).toMatch(/^system-ui, -apple-system/);
  });

  it.each(Object.keys(TODAY).filter((t) => !NO_OVERRIDE_NEEDED.has(t)))('.ember-world overrides %s', (token) => {
    expect(ember[token], token).toBeDefined();
  });

  it('.ember-world carries the prototype values and Outfit', () => {
    expect(ember['--gold']).toBe('#f0703a');
    expect(ember['--btn']).toBe('#f0703a');
    expect(ember['--btnfg']).toBe('#1d0a03');
    expect(ember['--bg']).toBe('#202226');
    expect(ember['--font-ui']).toMatch(/^"Outfit"/);
  });

  it('DateChip has its own radius token, never the full-round chip one (C2-5)', () => {
    const src = read('ui/DateChip.tsx');
    expect(src).toContain('rounded-[var(--r-date,8px)]');
    expect(src).not.toContain('--r-chip');
    expect(ember['--r-date']).toBe('12px');
  });

  it('every var(--token, fallback) in ui/*.tsx falls back to today\'s value', () => {
    const files = readdirSync(join(root, 'ui')).filter((f) => f.endsWith('.tsx'));
    let seen = 0;
    for (const f of files) {
      for (const m of read(`ui/${f}`).matchAll(/var\((--[\w-]+),([^)]+)\)/g)) {
        seen += 1;
        expect(TODAY[m[1]], `${f} ${m[1]}`).toBe(m[2]);
      }
    }
    expect(seen).toBeGreaterThan(10);
  });
});

/** Every rule's selector list in a stylesheet, comments removed. */
function selectorLists(css: string): string[][] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...bare.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].split(',').map((s) => s.trim()));
}
/** Class count of a plain class selector (`.a .b` or `.a.b`): enough for this file. */
const classCount = (sel: string) => (sel.match(/\.[\w-]+/g) ?? []).length;

describe('ember.css scope', () => {
  it('every selector starts with .ember-world or .org-theme (never :root, html, body)', () => {
    const lists = selectorLists(emberCss);
    expect(lists.length).toBeGreaterThanOrEqual(2);
    for (const sel of lists.flat()) expect(sel, sel).toMatch(/^\.(ember-world|org-theme)(?![\w-])/);
  });

  it('an .org-theme nested inside .ember-world keeps Ember (C2-6)', () => {
    const override = selectorLists(emberCss).find((l) => l.includes('.org-theme.ember-world'));
    expect(override).toBeDefined();
    expect(override).toContain('.ember-world .org-theme');
    // Every override selector out-ranks the plain .org-theme defaults in theme.css and ember.css.
    for (const sel of override!) if (sel !== '.ember-world') expect(classCount(sel), sel).toBeGreaterThan(1);
  });
});

describe('EmberWorld', () => {
  it('renders a div with the ember-world class and keeps extra classes', () => {
    render(<EmberWorld className="x" data-testid="w">hi</EmberWorld>);
    const w = screen.getByTestId('w');
    expect(w.tagName).toBe('DIV');
    expect(w.className).toBe('ember-world x');
    expect(document.getElementById('ember-font-outfit')).toBeTruthy();
  });

  it('puts its sheets in the ember world too', () => {
    render(
      <EmberWorld>
        <SheetView open onOpenChange={() => {}} title="T" testId="sh">body</SheetView>
      </EmberWorld>,
    );
    expect(screen.getByTestId('sh').className).toContain('ember-world');
  });

  it('a sheet outside it is unchanged', () => {
    render(<SheetView open onOpenChange={() => {}} title="T" testId="sh">body</SheetView>);
    expect(screen.getByTestId('sh').className).not.toContain('ember-world');
  });
});

describe('Chip remove', () => {
  it('has no remove button unless onRemove is passed (default render unchanged)', () => {
    const { container } = render(<Chip selected={false} onToggle={() => {}} testId="c">A</Chip>);
    expect(screen.queryByTestId('c-remove')).toBeNull();
    // Same node as before onRemove existed: the button itself, no wrapper.
    expect(container.childElementCount).toBe(1);
    expect(container.firstElementChild?.tagName).toBe('BUTTON');
    expect(container.firstElementChild?.getAttribute('data-testid')).toBe('c');
  });

  it('remove button has a 44px hit area around a 28px disc', () => {
    const onRemove = vi.fn();
    render(<Chip selected onToggle={() => {}} onRemove={onRemove} removeLabel="Remove Sensual" testId="c">Sensual</Chip>);
    const btn = screen.getByTestId('c-remove');
    expect(btn.getAttribute('aria-label')).toBe('Remove Sensual');
    expect(btn.className).toContain('h-[44px]');
    expect(btn.className).toContain('w-[44px]');
    expect(btn.firstElementChild?.className).toContain('h-[28px]');
    fireEvent.click(btn);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
