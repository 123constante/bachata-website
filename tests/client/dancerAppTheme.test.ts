/**
 * The dancer theme cannot leak into the main site, its values are the tokens,
 * and every text pair meets WCAG AA. Also: the sheet is imported by the shell
 * and by nothing else (never globally).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { DANCER_TOKENS, TEXT_PAIRS, contrastRatio } from '@/modules/dancer-app/theme/tokens';

const ROOT = path.resolve(__dirname, '../..');
const css = readFileSync(path.join(ROOT, 'src/modules/dancer-app/theme/dancer.css'), 'utf8');
const SCOPE = '[data-profile="dancer"]';

/** Selector lists of every rule in the sheet (comments stripped; no at-rules are allowed). */
const selectors = (sheet: string): string[] => {
  const body = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...body.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap((m) => m[1].split(',').map((s) => s.trim()));
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe('dancer.css', () => {
  it('has no at-rules and no nesting (everything is a plain scoped rule)', () => {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body).not.toMatch(/@/);
    expect(selectors(css).length).toBeGreaterThan(5);
  });

  it.each(selectors(css))('selector "%s" is scoped to [data-profile="dancer"]', (sel) => {
    expect(sel.startsWith(SCOPE)).toBe(true);
  });

  it('declares every token with exactly the tokens.ts value', () => {
    for (const [name, value] of Object.entries(DANCER_TOKENS)) {
      const m = css.match(new RegExp(`${name.replace(/[-]/g, '\\-')}:\\s*([^;]+);`));
      expect(m?.[1]?.trim().toUpperCase(), name).toBe(value.toUpperCase());
    }
  });

  it('uses no raw colour outside the token declarations', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--da-[a-z0-9-]+:\s*#[0-9a-f]{6};/gi, '');
    expect(rules).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe('contrast (WCAG 2.x)', () => {
  it.each(TEXT_PAIRS.map((p) => [p.fg, p.bg, p.min] as const))('%s on %s >= %s', (fg, bg, min) => {
    expect(contrastRatio(DANCER_TOKENS[fg], DANCER_TOKENS[bg])).toBeGreaterThanOrEqual(min);
  });

  it('the formula is the standard one (black on white = 21, same colour = 1)', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });
});

describe('the sheet is imported by the shell only', () => {
  it('exactly one importer, shell/DancerAppShell.tsx; nothing outside the module imports it', () => {
    const importers = walk(path.join(ROOT, 'src'))
      .filter((f) => /\.(tsx?|css)$/.test(f))
      .filter((f) => /dancer\.css['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
    expect(importers).toEqual(['src/modules/dancer-app/shell/DancerAppShell.tsx']);
  });
});
