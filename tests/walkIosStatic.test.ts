// Slice 10 Part C (contract 11 item 5b): the static iOS-class scanner. It turns
// three iOS Safari bug classes the Chromium walk cannot see into the numbers the
// judge rubric asks for. Table-driven; every class has a good and a bad row.
import { describe, it, expect } from 'vitest';
import { scanIosClasses, splitCssRules, main } from '../scripts/lib/walk-ios-static.mjs';
import { RUBRIC, judgeVerdict } from '../scripts/lib/walk-judge.mjs';

type F = { path: string; text: string };
const css = (text: string, path = 'a.css'): F => ({ path, text });
const tsx = (text: string, path = 'A.tsx'): F => ({ path, text });
const scan = (...files: F[]) => scanIosClasses(files);

describe('walk-ios-static: iosNoRawVh', () => {
  const rows: [string, F, number][] = [
    ['raw 100vh, no fallback', css('.a { height: 100vh; }'), 1],
    ['100vh then dvh fallback in the same rule', css('.a { height: 100vh; height: 100dvh; }'), 0],
    ['100vh then svh fallback in the same rule', css('.a { min-height: 100vh; min-height: 100svh; }'), 0],
    ['calc(100vh - x) without fallback', css('.a { height: calc(100vh - 60px); }'), 1],
    ['dvh in ANOTHER rule does not excuse this one', css('.a { height: 100vh; } .b { height: 100dvh; }'), 1],
    ['inside @media, no fallback', css('@media (max-width: 600px) { .a { height: 100vh; } }'), 1],
    ['50vh is not 100vh', css('.a { height: 50vh; }'), 0],
    ['100vh in a comment is ignored', css('/* height: 100vh */ .a { color: red; }'), 0],
    ['two raw declarations count twice', css('.a { height: 100vh; max-height: 100vh; }'), 2],
    ['tailwind h-[100vh]', tsx('<div className="h-[100vh] p-3" />'), 1],
    ['tailwind h-[100vh] with h-[100dvh] fallback', tsx('<div className="h-[100vh] h-[100dvh]" />'), 0],
    ['tailwind min-h-screen is 100vh', tsx('<main className="min-h-screen" />'), 1],
    ['tailwind min-h-screen with min-h-dvh', tsx('<main className="min-h-screen min-h-dvh" />'), 0],
    ['tailwind h-dvh alone is fine', tsx('<main className="h-dvh" />'), 0],
    ['md:h-screen does not apply at 390', tsx('<main className="md:h-screen" />'), 0],
    ['cn() string literals are read', tsx('<div className={cn("h-[100vh]", x && "p-3")} />'), 1],
    ['inline style 100vh', tsx("<div style={{ height: '100vh' }} />"), 1],
  ];
  it.each(rows)('%s', (_n, f, want) => expect(scan(f).iosNoRawVh).toBe(want));
});

describe('walk-ios-static: iosFixedBarsSafeArea', () => {
  const rows: [string, F, number][] = [
    ['fixed bar, no safe-area', css('.bar { position: fixed; bottom: 0; }'), 1],
    ['fixed bar with env(safe-area-inset-bottom)', css('.bar { position: fixed; bottom: max(16px, env(safe-area-inset-bottom, 0px)); }'), 0],
    ['safe-area in another rule does not excuse it', css('.bar { position: fixed; } .pad { padding-bottom: env(safe-area-inset-bottom); }'), 1],
    ['position: sticky is not fixed', css('.bar { position: sticky; bottom: 0; }'), 0],
    ['tailwind fixed bottom-0', tsx('<nav className="fixed bottom-0 inset-x-0" />'), 1],
    ['tailwind fixed with pb-[env(safe-area-inset-bottom)]', tsx('<nav className="fixed bottom-0 pb-[env(safe-area-inset-bottom)]" />'), 0],
    ['tailwind fixed with inline safe-area style', tsx("<nav className=\"fixed bottom-0\" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />"), 0],
    ['md:fixed does not apply at 390', tsx('<nav className="md:fixed bottom-0" />'), 0],
    ['inline style position fixed', tsx("<div style={{ position: 'fixed', bottom: 0 }} />"), 1],
    ['word "fixed" inside another token is not a class', tsx('<div className="table-fixed" />'), 0],
  ];
  it.each(rows)('%s', (_n, f, want) => expect(scan(f).iosFixedBarsSafeArea).toBe(want));
});

describe('walk-ios-static: iosInputFontSize', () => {
  const rows: [string, F[], number][] = [
    ['css input 14px', [css('input { font-size: 14px; }')], 14],
    ['css input 16px', [css('input { font-size: 16px; }')], 16],
    ['css textarea 15px among 18px', [css('textarea { font-size: 15px; } select { font-size: 18px; }')], 15],
    ['css .x input selector', [css('.form input[type="text"] { font-size: 13px; }')], 13],
    ['non-input selector ignored', [css('.inputish { font-size: 10px; } p { font-size: 9px; }')], 16],
    ['tailwind text-[14px] on input', [tsx('<input className="text-[14px] p-3" />')], 14],
    ['tailwind text-[16px] on textarea', [tsx('<textarea className="text-[16px]" />')], 16],
    ['tailwind text-sm on select (rem at 16px root)', [tsx('<select className="text-sm" />')], 14],
    ['md:text-sm does not apply at 390', [tsx('<input className="text-base md:text-sm" />')], 16],
    ['file:text-sm is the file button, not the field', [tsx('<input className="text-[16px] file:text-sm" />')], 16],
    ['text-[14px] on a div is not an input', [tsx('<div className="text-[14px]" />')], 16],
    ['unmeasurable unit is red, not skipped', [css('input { font-size: var(--f); }')], 0],
    ['em depends on the parent: unmeasurable, red', [css('input { font-size: 1em; }')], 0],
    ['rem at the 16px root', [css('input { font-size: 0.875rem; }')], 14],
    ['input::placeholder is not the field size', [css('input::placeholder { font-size: 12px; } input { font-size: 16px; }')], 16],
    ['placeholder part skipped, field part kept', [css('input::placeholder, textarea { font-size: 13px; }')], 13],
    ['min across files', [css('input { font-size: 18px; }'), tsx('<input className="text-[12px]" />')], 12],
  ];
  it.each(rows)('%s', (_n, files, want) => expect(scanIosClasses(files).iosInputFontSize).toBe(want));

  it('no inputs at all = 16 and a finding saying so', () => {
    const r = scan(css('.a { color: red; }'));
    expect(r.iosInputFontSize).toBe(16);
    expect(r.findings.some((f: { id: string; detail: string }) => f.id === 'iosInputFontSize' && /no input/i.test(f.detail))).toBe(true);
  });
  it('rem conversion is never silent', () => {
    const r = scan(tsx('<input className="text-base" />'));
    expect(r.findings.some((f: { detail: string }) => /root/i.test(f.detail))).toBe(true);
  });
});

describe('walk-ios-static: fail-closed shapes', () => {
  const red = { iosInputFontSize: 0, iosNoRawVh: 1, iosFixedBarsSafeArea: 1 };
  const bad: [string, unknown][] = [
    ['empty file list', []],
    ['not an array', 'src'],
    ['null', null],
    ['entry without text', [{ path: 'a.css' }]],
    ['entry text not a string', [{ path: 'a.css', text: 42 }]],
    ['entry is a string', ['a.css']],
  ];
  it.each(bad)('%s is red-shaped with one finding', (_n, arg) => {
    const r = scanIosClasses(arg as F[]);
    expect({ iosInputFontSize: r.iosInputFontSize, iosNoRawVh: r.iosNoRawVh, iosFixedBarsSafeArea: r.iosFixedBarsSafeArea }).toEqual(red);
    expect(r.findings).toHaveLength(1);
  });
  it('never throws on a hostile getter', () => {
    const evil = [{ path: 'a.css', get text(): string { throw new Error('boom'); } }];
    expect(() => scanIosClasses(evil as F[])).not.toThrow();
    expect(scanIosClasses(evil as F[]).iosNoRawVh).toBe(1);
  });
  it('minified CSS returns a finding', () => {
    const min = '.a{color:red}'.repeat(200) + '.b{height:100vh}';
    const r = scan(css(min, 'dist/assets/index-abc.css'));
    expect(r.findings.some((f: { id: string; detail: string }) => f.id === 'scanner' && /minified/i.test(f.detail))).toBe(true);
    expect(r.iosNoRawVh).toBe(1);
  });
  it('CSS-in-JS returns a finding', () => {
    const r = scan(tsx('const Bar = styled.div`position: fixed;`;'));
    expect(r.findings.some((f: { id: string; detail: string }) => f.id === 'scanner' && /css-in-js/i.test(f.detail))).toBe(true);
  });
  it('a clean scan is all-green numbers', () => {
    const r = scan(css('.a { height: 100dvh; } input { font-size: 16px; }'), tsx('<nav className="fixed bottom-0 pb-[env(safe-area-inset-bottom)]" />'));
    expect([r.iosInputFontSize, r.iosNoRawVh, r.iosFixedBarsSafeArea]).toEqual([16, 0, 0]);
  });
  it('findings carry path and line', () => {
    const r = scan(css('.ok { color: red; }\n.a {\n  height: 100vh;\n}', 'x.css'));
    expect(r.findings.find((f: { id: string }) => f.id === 'iosNoRawVh')).toMatchObject({ path: 'x.css', line: 3 });
  });
});

describe('walk-ios-static: rule splitter', () => {
  it('splits leaf blocks inside @media and keeps the selector', () => {
    const rules = splitCssRules('@media (x) { .a, .b { color: red; } } .c { top: 0 }');
    expect(rules.map((r: { selector: string }) => r.selector)).toEqual(['.a, .b', '.c']);
  });
  it('unbalanced braces never throw', () => {
    expect(() => splitCssRules('.a { color: red; .b { ')).not.toThrow();
  });
});

describe('walk-ios-static: rubric keys', () => {
  it('the three numbers are named exactly as RUBRIC ids and judge as such', () => {
    const r = scanIosClasses([css('.a { height: 100dvh; } input { font-size: 16px; }')]);
    const iosIds = RUBRIC.map((x: { id: string }) => x.id).filter((id: string) => id.startsWith('ios'));
    const keys = Object.keys(r).filter((k) => k !== 'findings');
    expect(keys.sort()).toEqual([...iosIds].sort());
    // Feed the scanner's keys through judgeVerdict: an otherwise-passing report
    // whose iOS numbers come from the scanner must cite every one of them.
    const head = 'a'.repeat(40);
    const m: Record<string, unknown> = {
      viewport: { width: 390, height: 844 },
      tapTargets: 44, noSidewaysScroll: 0, noClipping: 0, contrast: 7, emptyLoadingErrorHaveAction: 0,
    };
    for (const id of iosIds) m[id] = (r as Record<string, unknown>)[id];
    const input = {
      headSha: head, engines: ['chromium', 'webkit'], screens: [{ id: 's', shapes: ['x'] }],
      builderModelId: 'b', judgeModelId: 'j', builderSessionId: 'bs', judgeSessionId: 'js',
    };
    const report = {
      headSha: head,
      measurements: { s: { x: { chromium: m, webkit: m } } },
      pictures: ['s--x--chromium.png', 's--x--webkit.png'].map((name) => ({ name, sha256: 'f'.repeat(64) })),
    };
    const v = judgeVerdict(input, report);
    const cited = new Set(v.cited.map((c: { check: string }) => c.check));
    for (const id of iosIds) expect(cited.has(id)).toBe(true);
    expect(v.reasons.filter((x: string) => /ios/i.test(x))).toEqual([]);
  });
});

describe('walk-ios-static: main()', () => {
  const tree: Record<string, string> = {
    'site/a.css': '.a { height: 100dvh; } input { font-size: 16px; }',
    'site/B.tsx': '<nav className="fixed bottom-0 pb-[env(safe-area-inset-bottom)]" />',
    'site/notes.md': 'height: 100vh',
  };
  const deps = (t: Record<string, string>, out: string[]) => ({
    listFiles: (dir: string) => Object.keys(t).filter((p) => p.startsWith(dir + '/')),
    readFile: (p: string) => t[p],
    log: (s: string) => out.push(s),
    error: (s: string) => out.push(s),
  });
  it('exit 0 when all three meet the rubric, JSON printed, .md not read', () => {
    const out: string[] = [];
    expect(main(['--dir', 'site'], deps(tree, out))).toBe(0);
    expect(JSON.parse(out[0]).iosNoRawVh).toBe(0);
  });
  it('exit 1 when one number misses', () => {
    const out: string[] = [];
    expect(main(['--dir', 'site'], deps({ ...tree, 'site/c.css': 'input { font-size: 15px; }' }, out))).toBe(1);
  });
  it('exit 1 when the directory holds nothing scannable', () => {
    expect(main(['--dir', 'site'], deps({ 'site/x.md': '' }, []))).toBe(1);
  });
  it('exit 1 when listing throws', () => {
    const d = { ...deps(tree, []), listFiles: () => { throw new Error('ENOENT'); } };
    expect(main(['--dir', 'nope'], d)).toBe(1);
  });
  it.each([[[]], [['--dir']], [['--dir', '--x']], [['src']]])('usage %j -> 2', (argv) => {
    expect(main(argv as string[], deps(tree, []))).toBe(2);
  });
});
