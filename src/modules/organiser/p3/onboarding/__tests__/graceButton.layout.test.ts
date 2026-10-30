import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Home's grace banner "Continue" is an <a class="p3-btn">. jsdom does not lay out, so this pins the CSS facts
 * that make the label sit in the middle of a 44px target: a flex box (min-height ignores an inline <a>), centred
 * both ways, explicit px (never rem: html is about 13.5px on phones), and no vertical padding to tip the label.
 */
const css = readFileSync(join(__dirname, '..', '..', 'theme', 'p3.css'), 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
const block = css.match(/\.p3-theme \.p3-grace-acts \.p3-btn\s*\{([^}]*)\}/)?.[1] ?? '';
const decl = Object.fromEntries([...block.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

describe('grace banner Continue button layout', () => {
  it('has its own rule', () => expect(block).not.toBe(''));
  it('is a flex box centred both ways', () => {
    expect(decl.display).toBe('inline-flex');
    expect(decl['align-items']).toBe('center');
    expect(decl['justify-content']).toBe('center');
  });
  it('tap target is at least 44px, in px', () => {
    expect(decl['min-height']).toMatch(/^\d+px$/);
    expect(parseInt(decl['min-height'], 10)).toBeGreaterThanOrEqual(44);
  });
  it('label is centred within 1px: no vertical padding, px line-height', () => {
    expect(decl.padding).toMatch(/^0 \d+px$/);
    expect(decl['line-height']).toMatch(/^\d+px$/);
    expect(parseInt(decl['min-height'], 10) - parseInt(decl['line-height'], 10)).toBeGreaterThanOrEqual(0);
  });
});
