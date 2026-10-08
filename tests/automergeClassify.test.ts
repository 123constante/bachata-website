import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs script, no types
import { classify, pathClass, lastLabelActor, prFromApi, BOT_LOGIN, OWNER_LOGIN, LABEL_OK, RUN } from '../scripts/automerge-classify.mjs';

type F = { filename: string; status?: string; previous_filename?: string; additions?: number; deletions?: number };
const file = (filename: string, extra: Partial<F> = {}): F => ({ filename, status: 'modified', additions: 3, deletions: 1, ...extra });

const basePr = {
  state: 'open', draft: false, user: BOT_LOGIN, headRef: 'docs/fix-typo', headRepo: 'o/r', baseRepo: 'o/r',
  baseRef: 'main', labels: [LABEL_OK], body: 'x',
};

/** A PR whose counts AGREE with its file list unless the case overrides them. */
function run(files: F[], prOver: Record<string, unknown> = {}, opts: Record<string, unknown> = {}) {
  const additions = files.reduce((n, f) => n + (f.additions ?? 0), 0);
  const deletions = files.reduce((n, f) => n + (f.deletions ?? 0), 0);
  const pr = { ...basePr, additions, deletions, changedFiles: files.length, ...prOver };
  return classify({ pr, files, labelActor: BOT_LOGIN, importedByShipped: () => false, ...opts });
}

describe('automerge classifier -- table', () => {
  const cases: Array<[string, F[], Record<string, unknown>, Record<string, unknown>, boolean]> = [
    // positives
    ['docs-only merges', [file('docs/automerge.md'), file('docs/design/notes.md')], {}, {}, true],
    ['root README merges', [file('README.md')], {}, {}, true],
    ['test-only merges', [file('tests/homeLoaderDegrade.test.ts')], {}, {}, true],
    ['e2e spec merges', [file('tests/e2e/organiser-home.spec.ts')], {}, {}, true],
    ['docs + tests merges', [file('docs/a.md'), file('tests/a.test.ts')], {}, {}, true],
    ['shared-token worker PR on claude/ merges', [file('docs/a.md')], { user: OWNER_LOGIN, headRef: 'claude/x' }, {}, true],
    ['rename inside docs merges', [file('docs/b.md', { status: 'renamed', previous_filename: 'docs/a.md' })], {}, {}, true],
    ['399 lines merges (cap is strict)', [file('docs/a.md', { additions: 399, deletions: 0 })], {}, {}, true],
    // negatives: paths
    ['a src change does NOT', [file('src/App.tsx')], {}, {}, false],
    ['a src test file does NOT (src/ wins over *.test)', [file('src/lib/x.test.ts')], {}, {}, false],
    ['an app/ change does NOT', [file('app/root.tsx')], {}, {}, false],
    ['vercel.json does NOT', [file('vercel.json')], {}, {}, false],
    ['package.json does NOT', [file('package.json')], {}, {}, false],
    ['a workflow file does NOT', [file('.github/workflows/unit-tests.yml')], {}, {}, false],
    ['a .github markdown file does NOT', [file('.github/pull_request_template.md')], {}, {}, false],
    ['a scripts/ change does NOT', [file('scripts/check-x.mjs')], {}, {}, false],
    ['a .claude rule doc does NOT', [file('.claude/rules/design-density.md')], {}, {}, false],
    ['CLAUDE.md does NOT', [file('CLAUDE.md')], {}, {}, false],
    ['public/ markdown does NOT', [file('public/notes.md')], {}, {}, false],
    ['vite config does NOT', [file('vite.config.ts')], {}, {}, false],
    ['an auth e2e spec does NOT', [file('tests/e2e/auth-stepper-smoke.spec.ts')], {}, {}, false],
    ['mixed docs + src does NOT', [file('docs/a.md'), file('src/a.ts')], {}, {}, false],
    ['substring trap src/docs-helper.ts does NOT', [file('src/docs-helper.ts')], {}, {}, false],
    ['traversal docs/../src/x does NOT', [file('docs/../src/x.ts')], {}, {}, false],
    ['leading ./ path does NOT', [file('./docs/a.md')], {}, {}, false],
    ['rename src -> docs does NOT', [file('docs/x.md', { status: 'renamed', previous_filename: 'src/x.md' })], {}, {}, false],
    ['rename docs -> src does NOT', [file('src/x.md', { status: 'renamed', previous_filename: 'docs/x.md' })], {}, {}, false],
    ['empty file list does NOT', [], {}, {}, false],
    ['unknown file type at root does NOT', [file('vercel-firewall.json')], {}, {}, false],
    ['deleting a test does NOT', [file('tests/a.test.ts', { status: 'removed' })], {}, {}, false],
    ['an unknown status does NOT', [file('docs/a.md', { status: 'weird' })], {}, {}, false],
    ['a helper shipped code imports does NOT', [file('tests/helpers/x.ts')], {}, { importedByShipped: () => true }, false],
    ['a helper with no import scan does NOT (default)', [file('tests/helpers/x.ts')], {}, { importedByShipped: undefined }, false],
    // negatives: PR state / identity
    ['human author does NOT', [file('docs/a.md')], { user: 'someone-else' }, {}, false],
    ['owner on a non-worker branch does NOT', [file('docs/a.md')], { user: OWNER_LOGIN, headRef: 'docs/x' }, {}, false],
    ['dependabot does NOT', [file('docs/a.md')], { user: 'dependabot[bot]' }, {}, false],
    ['draft does NOT', [file('docs/a.md')], { draft: true }, {}, false],
    ['unknown draft state does NOT', [file('docs/a.md')], { draft: undefined }, {}, false],
    ['closed does NOT', [file('docs/a.md')], { state: 'closed' }, {}, false],
    ['base other than main does NOT', [file('docs/a.md')], { baseRef: 'release' }, {}, false],
    ['fork head does NOT', [file('docs/a.md')], { headRepo: 'evil/r' }, {}, false],
    ['over line cap does NOT', [file('docs/a.md', { additions: 300, deletions: 100 })], {}, {}, false],
    ['PR totals over cap do NOT even if files under-report', [file('docs/a.md')], { additions: 500 }, {}, false],
    ['truncated file list does NOT', [file('docs/a.md')], { changedFiles: 2 }, {}, false],
    ['missing automerge-ok label does NOT', [file('docs/a.md')], { labels: [] }, {}, false],
    ['needs-owner label does NOT', [file('docs/a.md')], { labels: [LABEL_OK, 'needs-owner'] }, {}, false],
    ['label added by a human does NOT', [file('docs/a.md')], {}, { labelActor: 'someone-else' }, false],
    ['label actor unknown does NOT', [file('docs/a.md')], {}, { labelActor: null }, false],
    ['failing real-data section does NOT', [file('docs/a.md')], {}, { realData: () => ({ ok: false, problems: ['missing'] }) }, false],
    ['a throwing real-data parser does NOT', [file('docs/a.md')], {}, { realData: () => { throw new Error('boom'); } }, false],
  ];

  it.each(cases)('%s', (_name, files, prOver, opts, want) => {
    const v = run(files, prOver, opts);
    expect(v.qualifies).toBe(want);
    // non-vacuity: a NO always names why, a YES never carries a reason
    if (want) expect(v.reasons).toEqual([]);
    else expect(v.reasons.length).toBeGreaterThan(0);
  });

  it('passes a real-data section the parser accepts', () => {
    expect(run([file('docs/a.md')], {}, { realData: () => ({ ok: true, problems: [] }) }).qualifies).toBe(true);
  });

  it('reports the class it judged', () => {
    expect(run([file('docs/a.md'), file('tests/a.test.ts')]).classes).toEqual(['docs', 'tests']);
  });

  it('table is non-vacuous: it holds both verdicts', () => {
    expect(cases.some((c) => c[4])).toBe(true);
    expect(cases.filter((c) => !c[4]).length).toBeGreaterThan(cases.filter((c) => c[4]).length);
  });
});

describe('automerge classifier -- helpers', () => {
  it.each([
    ['docs/a.md', 'docs'], ['tests/a.test.ts', 'tests'], ['e2e/x.spec.ts', 'tests'], ['README.md', 'docs'],
    ['src/docs/a.md', null], ['docs-src/a.ts', null], ['tests/../src/a.ts', null], ['', null],
  ])('pathClass(%j) = %j', (p, want) => {
    expect(pathClass(p)).toBe(want);
  });

  it('takes the LAST actor that applied the label', () => {
    const ev = (login: string, name = LABEL_OK, event = 'labeled') => ({ event, label: { name }, actor: { login } });
    expect(lastLabelActor([ev(BOT_LOGIN), ev('someone-else')])).toBe('someone-else');
    expect(lastLabelActor([ev('someone-else', 'other')])).toBe(null);
    expect(lastLabelActor([])).toBe(null);
  });

  it('maps the REST PR object', () => {
    const p = prFromApi({
      state: 'open', draft: false, user: { login: BOT_LOGIN }, head: { ref: 'x', sha: 'abc', repo: { full_name: 'o/r' } },
      base: { ref: 'main', repo: { full_name: 'o/r' } }, labels: [{ name: LABEL_OK }], additions: 1, deletions: 2, changed_files: 3, body: 'b',
    });
    expect(p).toMatchObject({ user: BOT_LOGIN, headRepo: 'o/r', baseRepo: 'o/r', labels: [LABEL_OK], changedFiles: 3, headSha: 'abc' });
    // a deleted head repo maps to undefined, which classify() refuses
    expect(prFromApi({ head: { ref: 'x', repo: null }, base: { repo: { full_name: 'o/r' } } }).headRepo).toBe(null);
  });
});

describe('bot-automerge.yml wiring', () => {
  const wf = readFileSync(new URL('../.github/workflows/bot-automerge.yml', import.meta.url), 'utf8');

  it('runs the classifier exactly the way the module documents (RUN)', () => {
    expect(wf).toContain(RUN);
  });

  it('is pull_request_target, checks out main only, and is behind both switches', () => {
    expect(wf).toMatch(/^on:\s*\n\s*pull_request_target:/m);
    expect(wf).toMatch(/ref: main\s*\n\s*persist-credentials: false/);
    expect(wf).not.toMatch(/head\.(sha|ref)\s*}}\s*$/m);
    expect(wf).toContain("vars.AUTOMERGE_ENABLED == 'true' && vars.BOT_AUTOMERGE_ENABLED == 'true'");
    expect(wf).toContain('--match-head-commit');
  });
});
