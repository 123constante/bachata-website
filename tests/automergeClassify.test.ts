import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs script, no types
import { classify, judgePath, BOT_LOGIN, LINE_CAP } from '../scripts/automerge-classify.mjs';

type F = { filename: string; status?: string; previous_filename?: string; additions?: number; deletions?: number };

const file = (filename: string, extra: Partial<F> = {}): F => ({ filename, status: 'modified', additions: 5, deletions: 1, ...extra });

function pr(files: F[], over: Record<string, unknown> = {}) {
  return {
    number: 1,
    user: { login: BOT_LOGIN },
    draft: false,
    base: { ref: 'main' },
    labels: [],
    body: 'x',
    changed_files: files.length,
    ...over,
  };
}

const run = (files: F[], over: Record<string, unknown> = {}, opts = {}) => classify(pr(files, over), files, opts);

// [name, files, pr overrides, expected qualifies]
const CASES: Array<[string, F[], Record<string, unknown>, boolean]> = [
  ['docs-only', [file('docs/automerge.md'), file('docs/design/x.png', { additions: 0, deletions: 0 })], {}, true],
  ['root README', [file('README.md')], {}, true],
  ['test-only (tests/)', [file('tests/foo.test.ts')], {}, true],
  ['test-only (e2e spec)', [file('tests/e2e/home.spec.ts')], {}, true],
  ['docs + tests', [file('docs/a.md'), file('tests/b.test.tsx')], {}, true],
  ['renamed within docs', [file('docs/new.md', { status: 'renamed', previous_filename: 'docs/old.md' })], {}, true],

  ['src change', [file('src/App.tsx')], {}, false],
  ['src test file (under src/)', [file('src/lib/x.test.ts')], {}, false],
  ['app route', [file('app/routes/home.tsx')], {}, false],
  ['api', [file('api/ics.ts')], {}, false],
  ['public asset', [file('public/robots.txt')], {}, false],
  ['vercel.json', [file('vercel.json')], {}, false],
  ['package.json', [file('package.json')], {}, false],
  ['package-lock.json', [file('package-lock.json')], {}, false],
  ['vite config', [file('vite.config.ts')], {}, false],
  ['react-router config', [file('react-router.config.ts')], {}, false],
  ['middleware.ts', [file('middleware.ts')], {}, false],
  ['workflow file', [file('.github/workflows/bot-automerge.yml')], {}, false],
  ['markdown under .github', [file('.github/pull_request_template.md')], {}, false],
  ['scripts/ guard', [file('scripts/check-seo.mjs')], {}, false],
  ['markdown under scripts/', [file('scripts/README.md')], {}, false],
  ['supabase', [file('supabase/config.toml')], {}, false],
  ['CLAUDE.md', [file('CLAUDE.md')], {}, false],
  ['nested CLAUDE.md', [file('src/modules/event-page/CLAUDE.md')], {}, false],
  ['markdown under src/', [file('src/notes.md')], {}, false],
  ['auth test', [file('tests/authResolution.test.ts')], {}, false],
  ['test helper', [file('tests/helpers/integrityGuard.ts')], {}, false],
  ['test client support', [file('tests/client/jsdomPolyfills.test.ts')], {}, false],
  ['non-test file in tests/', [file('tests/util.ts')], {}, false],
  ['unknown root file', [file('index.html')], {}, false],
  ['mixed docs + src', [file('docs/a.md'), file('src/a.ts')], {}, false],
  ['substring trap src/docs-helper.ts', [file('src/docs-helper.ts')], {}, false],
  ['substring trap docs/../src/x.ts', [file('docs/../src/x.ts')], {}, false],
  ['dot segment docs/./a.md', [file('docs/./a.md')], {}, false],
  ['leading slash', [file('/docs/a.md')], {}, false],
  ['backslash', [file('docs\\..\\src\\x.md')], {}, false],
  ['case trap SRC/x.md', [file('SRC/x.md')], {}, false],
  ['rename src -> docs', [file('docs/x.md', { status: 'renamed', previous_filename: 'src/x.md' })], {}, false],
  ['rename docs -> src', [file('src/x.md', { status: 'renamed', previous_filename: 'docs/x.md' })], {}, false],
  ['deleted test file', [file('tests/foo.test.ts', { status: 'removed', additions: 0, deletions: 30 })], {}, false],
  ['empty list', [], {}, false],
  ['human author', [file('docs/a.md')], { user: { login: '123constante' } }, false],
  ['dependabot author', [file('docs/a.md')], { user: { login: 'dependabot[bot]' } }, false],
  ['draft', [file('docs/a.md')], { draft: true }, false],
  ['draft unknown', [file('docs/a.md')], { draft: undefined }, false],
  ['base not main', [file('docs/a.md')], { base: { ref: 'release' } }, false],
  ['needs-owner label', [file('docs/a.md')], { labels: [{ name: 'needs-owner' }] }, false],
  ['labels missing', [file('docs/a.md')], { labels: undefined }, false],
  ['over line cap', [file('docs/a.md', { additions: LINE_CAP, deletions: 0 })], {}, false],
  ['line cap split across files', [file('docs/a.md', { additions: 200, deletions: 0 }), file('docs/b.md', { additions: 150, deletions: 50 })], {}, false],
  ['line counts missing', [file('docs/a.md', { additions: undefined })], {}, false],
  ['truncated file list', [file('docs/a.md')], { changed_files: 3001 }, false],
];

describe('automerge-classify -- table', () => {
  it.each(CASES)('%s', (_name, files, over, expected) => {
    const v = run(files, over);
    expect(v.qualifies).toBe(expected);
    // Non-vacuity: a refusal always names why; a pass names nothing.
    if (expected) expect(v.reasons).toEqual([]);
    else expect(v.reasons.length).toBeGreaterThan(0);
  });

  it('just under the line cap still qualifies (the cap is not off by one)', () => {
    expect(run([file('docs/a.md', { additions: LINE_CAP - 1, deletions: 0 })]).qualifies).toBe(true);
  });

  it('the table carries both outcomes (no all-pass or all-fail table)', () => {
    expect(CASES.filter((c) => c[3]).length).toBeGreaterThanOrEqual(5);
    expect(CASES.filter((c) => !c[3]).length).toBeGreaterThanOrEqual(30);
  });
});

describe('automerge-classify -- real-data-verified check on base', () => {
  const ok = () => ({ ok: true, problems: [] });
  const bad = () => ({ ok: false, problems: ['Section "## Verified on real data" is missing'] });

  it('qualifies when the base parser accepts the body', () => {
    expect(run([file('docs/a.md')], {}, { realDataParse: ok }).qualifies).toBe(true);
  });
  it('refuses when the base parser rejects the body', () => {
    const v = run([file('docs/a.md')], {}, { realDataParse: bad });
    expect(v.qualifies).toBe(false);
    expect(v.reasons.join(' ')).toContain('Verified on real data');
  });
  it('refuses when the base parser throws', () => {
    const v = run([file('docs/a.md')], {}, { realDataParse: () => { throw new Error('boom'); } });
    expect(v.qualifies).toBe(false);
  });
});

describe('automerge-classify -- judgePath', () => {
  it('names the class of an allowed path', () => {
    expect(judgePath('docs/a.md')).toEqual({ ok: true, cls: 'docs' });
    expect(judgePath('tests/a.test.ts')).toEqual({ ok: true, cls: 'test' });
    expect(judgePath('README.md')).toEqual({ ok: true, cls: 'markdown' });
  });
  it('allows prose ABOUT auth but not an auth test', () => {
    expect(judgePath('docs/qa-auth-vendor-signoff-checklist.md').ok).toBe(true);
    expect(judgePath('tests/AuthOtpDisabled.test.tsx').ok).toBe(false);
  });
});
