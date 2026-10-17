// @vitest-environment jsdom
/**
 * S8 consistency matrix (R1-PLAN 4.5): the facts every R1 screen must agree on, as one table.
 * Part 1 is source-level (copy, imports, the one-owner warnings); part 2 renders the write
 * screens. Each row was run against the merged tree before any fix (handover S8.md, "Red first").
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
/** The R1 screens (D22's list plus jobs/, which Home renders). */
const R1_DIRS = ['flows', 'home', 'events', 'team', 'page', 'more', 'switch', 'jobs'];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : walk(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
const rel = (p: string) => relative(ROOT, p).split('\\').join('/');
const ALL = walk(ROOT).map((p) => ({ file: rel(p), src: readFileSync(p, 'utf8') }));
const inDirs = (dirs: string[]) => ALL.filter((f) => dirs.some((d) => f.file.startsWith(`${d}/`)));
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/** Visible copy: string literals and JSX text, comments removed; class lists and test ids skipped. */
const copyOf = (src: string): string[] => {
  const code = stripComments(src);
  const literals = [...code.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');
  const jsxText = [...code.matchAll(/>([^<>{}=;]*[A-Za-z][^<>{}=;]*)</g)].map((m) => m[1]);
  return [...literals, ...jsxText].filter((s) => /\s/.test(s.trim()) || /^[A-Z]/.test(s.trim())).filter((s) => !/\[var\(|^[a-z-]+(\s+[a-z0-9:[\]().%/-]+)+$/.test(s.trim()));
};

describe('copy names no control that is not on screen (no tab bar, no swipe, no menu, no Undo)', () => {
  const hits = inDirs(R1_DIRS).flatMap(({ file, src }) =>
    copyOf(src).filter((s) => /\b(tab|tabs|swipe|menu|undo)\b/i.test(s)).map((s) => `${file}: ${s.trim()}`),
  );
  it('no R1 screen copy says tab, swipe, menu or Undo', () => {
    expect(hits).toEqual([]);
  });
});

describe('the past-date refusal is one sentence everywhere (eventState.ts:75)', () => {
  const eventState = readFileSync(join(ROOT, 'shared/eventState.ts'), 'utf8');
  const canonical = /if \(past\) return '([^']+)'/.exec(eventState)?.[1];
  it('eventState.ts still owns the sentence', () => {
    expect(canonical).toMatch(/already happened/);
  });
  const variants = ALL.flatMap(({ file, src }) =>
    copyOf(src).filter((s) => /already happened, so it can no longer be changed/.test(s)).map((s) => ({ file, s })),
  );
  it.each(variants)('$file says it verbatim', ({ s }) => {
    expect(s).toBe(canonical);
  });
});

describe('each warning has exactly one owner screen (D14 copy, imported once)', () => {
  const ROWS = [
    { name: 'WARN_DATE', owner: 'flows/cancel/Confirm.tsx' },
    { name: 'handOverWarning', owner: 'flows/handover/Confirm.tsx' },
    { name: 'WARN_END', owner: 'flows/event/EndStep.tsx' },
  ];
  it.each(ROWS)('$name is imported only by $owner', ({ name, owner }) => {
    const importers = ALL.filter(({ file, src }) => file !== 'shared/copy.ts' && new RegExp(`import[^;]*\\b${name}\\b[^;]*from`).test(src)).map((f) => f.file);
    expect(importers).toEqual([owner]);
  });
});

describe('D22: no section labels or status tags on R1 screens', () => {
  // D22 keeps ONE status mark: the Live chip. The page screen draws it with StatusTag.
  const EXEMPT: Record<string, string> = { 'page/index.tsx': 'D22 (a Live chip stays)' };
  const hits = inDirs(['flows', 'home', 'events', 'team', 'page', 'more', 'switch'])
    .filter(({ file, src }) => !EXEMPT[file] && /import[^;]*\b(SectionLabel|StatusTag)\b[^;]*from/.test(src))
    .map((f) => f.file);
  it('no SectionLabel / StatusTag import under flows, home, events, team, page, more, switch', () => {
    expect(hits).toEqual([]);
  });
  it('the exempt Live chip says Live and nothing else', () => {
    const tags = [...readFileSync(join(ROOT, 'page/index.tsx'), 'utf8').matchAll(/<StatusTag[^>]*>([^<]*)<\/StatusTag>/g)].map((m) => m[1]);
    expect(tags).toEqual(['Live']);
  });
});

describe('everything is live (D4): no review machinery in the module', () => {
  it('no useSendForReview / ReviewCard / reviewModel import', () => {
    expect(ALL.filter(({ src }) => /import[^;]*\b(useSendForReview|ReviewCard|reviewModel)\b/.test(src)).map((f) => f.file)).toEqual([]);
  });
  it('no "Send for review" anywhere in the module source, comments included', () => {
    expect(ALL.filter(({ src }) => /send for review/i.test(src)).map((f) => f.file)).toEqual([]);
  });
});

describe('the add-a-page screen is "Add a page" everywhere (orchestrator naming decision)', () => {
  it('no screen says "Add an organiser" or "Add another organiser"', () => {
    expect(ALL.filter(({ src }) => /Add (an|another) organiser/.test(src)).map((f) => f.file)).toEqual([]);
  });
  it.each(['home/index.tsx', 'more/index.tsx', 'switch/index.tsx'])('%s names it "Add a page"', (file) => {
    expect(readFileSync(join(ROOT, file), 'utf8')).toContain('Add a page');
  });
});
