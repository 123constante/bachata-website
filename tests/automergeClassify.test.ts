import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs script, no types
import { classify, pathClass, lastLabelActor, prFromApi, pushAnchorFrom, readReviewRecord, readTestSources, testSourceRefusal, BOT_LOGIN, OWNER_LOGIN, LABEL_OK, RUN } from '../scripts/automerge-classify.mjs';
// @ts-expect-error -- plain .mjs script, no types
import { REVIEW_LABEL } from '../scripts/lib/autopilot-merge.mjs';
// @ts-expect-error -- plain .mjs script, no types
import { parse as parseRealData, MARKER, HEADING as RD_HEADING, LABELS as RD_LABELS } from '../scripts/check-pr-real-data-verified.mjs';
// @ts-expect-error -- plain .mjs script, no types
import { parse as parsePhoneQa, HEADING as PQ_HEADING, LABELS as PQ_LABELS } from '../scripts/check-pr-phone-qa.mjs';
// Slice 2 foundations: the ONE shared helper injecting the money check (tests/autopilotTable.ts).
import { FOUNDATIONS_OK } from './autopilotTable';

type F = { filename: string; status?: string; previous_filename?: string; additions?: number; deletions?: number };
const file = (filename: string, extra: Partial<F> = {}): F => ({ filename, status: 'modified', additions: 3, deletions: 1, ...extra });

// Class C also needs each test file's HEAD content (testSources, read by main()): a clean vitest
// suite by default, so the rows below judge what they name and nothing else.
const CLEAN_TEST = "import { describe, expect, it } from 'vitest';\nimport { x } from '../src/lib/x';\ndescribe('x', () => { it('works', () => { expect(x()).toBe(1); }); });\n";
const sources = (files: F[]) => Object.fromEntries(files.map((f) => [f.filename, CLEAN_TEST]));

// Class C (tests) needs an independent review record at the head sha: a bot comment
// `review-pack: <https url> head <40-hex>` and the review-passed label, both after the push.
const HEAD = 'ab12cd34'.repeat(5);
const PUSH_MS = Date.parse('2026-11-01T10:00:00Z');
const packComment = (over: Record<string, unknown> = {}) => ({
  user: { login: BOT_LOGIN }, created_at: '2026-11-01T11:00:00Z',
  body: `Independent review done.\nreview-pack: https://claude.ai/artifact/abc head ${HEAD}`, ...over,
});
const reviewLabelEvent = (over: Record<string, unknown> = {}) => ({
  event: 'labeled', label: { name: REVIEW_LABEL }, actor: { login: BOT_LOGIN }, created_at: '2026-11-01T11:05:00Z', ...over,
});
const RECORD = { pushAnchorMs: PUSH_MS, comments: [packComment()], labelEvents: [reviewLabelEvent()] };

const basePr = {
  state: 'open', draft: false, user: BOT_LOGIN, headRef: 'docs/fix-typo', headRepo: 'o/r', baseRepo: 'o/r',
  baseRef: 'main', labels: [LABEL_OK, REVIEW_LABEL], body: 'x', headSha: HEAD,
};

/** A PR whose counts AGREE with its file list unless the case overrides them. */
function run(files: F[], prOver: Record<string, unknown> = {}, opts: Record<string, unknown> = {}) {
  const additions = files.reduce((n, f) => n + (f.additions ?? 0), 0);
  const deletions = files.reduce((n, f) => n + (f.deletions ?? 0), 0);
  const pr = { ...basePr, additions, deletions, changedFiles: files.length, ...prOver };
  return classify({ pr, files, labelActor: BOT_LOGIN, importedByShipped: () => false, reviewRecord: RECORD, testSources: sources(files), ...FOUNDATIONS_OK.classify, ...opts });
}

describe('automerge classifier -- table', () => {
  const cases: Array<[string, F[], Record<string, unknown>, Record<string, unknown>, boolean]> = [
    // positives
    ['docs-only merges', [file('docs/automerge.md'), file('docs/design/notes.md')], {}, {}, true],
    ['root README merges', [file('README.md')], {}, {}, true],
    ['test-only merges', [file('tests/homeLoaderDegrade.test.ts')], {}, {}, true],
    ['e2e spec merges', [file('tests/e2e/organiser-home.spec.ts')], {}, {}, true],
    ['docs + tests merges', [file('docs/a.md'), file('tests/a.test.ts')], {}, {}, true],
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
    // the import scan is gone: class C is spec files only, so any tests/ helper is off the allowlist
    ['a tests/ helper does NOT (class C is specs only)', [file('tests/helpers/x.ts')], {}, {}, false],
    // negatives: PR state / identity
    ['human author does NOT', [file('docs/a.md')], { user: 'someone-else' }, {}, false],
    ['owner on a non-worker branch does NOT', [file('docs/a.md')], { user: OWNER_LOGIN, headRef: 'docs/x' }, {}, false],
    ['owner-authored claude/ branch does NOT (bot-only author)', [file('docs/a.md')], { user: OWNER_LOGIN, headRef: 'claude/x' }, {}, false],
    ['owner-authored ccr- branch does NOT (bot-only author)', [file('docs/a.md')], { user: OWNER_LOGIN, headRef: 'ccr-x' }, {}, false],
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
    expect(run([file('docs/a.md')]).classes).toEqual(['A/B']);
    expect(run([file('tests/a.test.ts')]).classes).toEqual(['C']);
    // a mixed PR is judged as class C (its cap, its review record)
    expect(run([file('docs/a.md'), file('tests/a.test.ts')]).classes).toEqual(['C']);
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
    // Slice 2 PART 3 (A30): both switches are arming.json on main (read by a first step that gates
    // every later step), never the repo variables (tests/automationArming.test.ts has the full check).
    expect(wf).toContain('node scripts/automation-arming.mjs --gate automerge_enabled,bot_automerge_enabled');
    expect(wf).not.toContain("vars.AUTOMERGE_ENABLED == 'true'");
    expect(wf).not.toContain("vars.BOT_AUTOMERGE_ENABLED == 'true'");
    expect(wf).toContain('--match-head-commit');
  });
});

describe('automerge classifier -- a TO FILL stub never merges (F1, PR #1323 review)', () => {
  // The marker is read from the checker, never typed here.
  const RD = [RD_HEADING, '- Shapes surveyed: docs only, no production data shape is read by this change', '- Checks run: npm run lint and the vitest files this PR touches', '- NOT verified: nothing at runtime, docs and tests only'];
  const RD_PENDING = [RD_HEADING, ...RD_LABELS.map((l: string) => `- ${l}: ${MARKER}`)];
  const QA = [PQ_HEADING, '- Sizes checked: 390x844', '- Walked: no UI path changed, nothing to walk at phone size', '- Not verified: no UI path changed in this PR'];
  const QA_PENDING = [PQ_HEADING, ...PQ_LABELS.map((l: string) => `- ${l}: ${MARKER}`)];
  const body = (...parts: string[][]) => ['Intro: replace each ' + MARKER + ' below in place.', '', ...parts.flatMap((p) => [...p, ''])].join('\n');
  const docs = [file('docs/a.md')];
  const docsTests = [file('docs/a.md'), file('tests/a.test.ts')];

  const cells: Array<[string, F[], string, boolean]> = [
    ['filled real-data + filled Phone QA', docsTests, body(RD, QA), true],
    ['filled real-data, no Phone QA section', docs, body(RD), true],
    ['filled real-data, bare empty Phone QA heading (docs-only may delete it)', docs, body(RD, [PQ_HEADING]), true],
    ['marker only above the sections (intro line)', docs, body(RD, QA), true],
    ['real-data pending', docsTests, body(RD_PENDING, QA), false],
    ['Phone QA pending', docsTests, body(RD, QA_PENDING), false],
    ['both pending', docsTests, body(RD_PENDING, QA_PENDING), false],
    ['docs-only with Phone QA pending', docs, body(RD, QA_PENDING), false],
    ['one Phone QA line still pending', docs, body(RD, [PQ_HEADING, '- Sizes checked: 390x844', `- Walked: ${MARKER}`, '- Not verified: no UI path changed in this PR']), false],
  ];

  // Both parser states: the real checker parse(), and NO parser on main -- the
  // pending refusal must not depend on the parser being loaded.
  for (const [parserName, realData] of [['real parser', parseRealData], ['no parser', null]] as const) {
    it.each(cells)(`${parserName}: %s`, (_name, files, prBody, want) => {
      const v = run(files, { body: prBody }, { realData });
      expect(v.qualifies).toBe(want);
      if (want) expect(v.reasons).toEqual([]);
      else expect(v.reasons.some((r: string) => r.includes(MARKER))).toBe(true);
    });
  }

  it('names the section that is pending', () => {
    const qa = run(docs, { body: body(RD, QA_PENDING) }, { realData: parseRealData });
    expect(qa.reasons.some((r: string) => r.includes(PQ_HEADING))).toBe(true);
    const rd = run(docs, { body: body(RD_PENDING, QA) }, { realData: null });
    expect(rd.reasons.some((r: string) => r.includes(RD_HEADING))).toBe(true);
  });

  it('a marker inside an HTML comment or a code fence is not the PR\'s own section', () => {
    const commented = body(RD, [PQ_HEADING, `<!-- - Walked: ${MARKER} -->`]);
    expect(run(docs, { body: commented }, { realData: parseRealData }).qualifies).toBe(true);
    const fenced = body(RD, ['```', ...QA_PENDING, '```']);
    expect(run(docs, { body: fenced }, { realData: parseRealData }).qualifies).toBe(true);
  });

  it('the filled bodies really pass both checkers (the table is not vacuous)', () => {
    expect(parseRealData(body(RD, QA)).ok).toBe(true);
    expect(parsePhoneQa(body(RD, QA)).ok).toBe(true);
    expect(parseRealData(body(RD_PENDING, QA)).pending).toBe(true);
  });
});

/* -- Brief automerge-web-classes-abc: exactly classes A, B, C ------------------------------------
 * These rows drive the REAL guard-path check (guardCheck NOT injected): only the money check is
 * stubbed. Each hard-tier path is judged alone AND as ONE extra file inside an otherwise valid
 * docs PR and an otherwise valid test PR. */
describe('automerge classifier -- classes A, B, C only', () => {
  const realGuard = { moneyCheck: FOUNDATIONS_OK.classify.moneyCheck };
  function judge(files: F[], prOver: Record<string, unknown> = {}, opts: Record<string, unknown> = {}) {
    const additions = files.reduce((n, f) => n + (f.additions ?? 0), 0);
    const deletions = files.reduce((n, f) => n + (f.deletions ?? 0), 0);
    const pr = { ...basePr, additions, deletions, changedFiles: files.length, ...prOver };
    return classify({ pr, files, labelActor: BOT_LOGIN, importedByShipped: () => false, reviewRecord: RECORD, testSources: sources(files), ...realGuard, ...opts });
  }
  const DOCS_PR = [file('docs/notes/a.md'), file('docs/img/b.png')];
  const TEST_PR = [file('tests/a.test.ts'), file('tests/e2e/b.spec.ts')];

  const HARD_TIER = [
    'scripts/x.mjs', 'bin/x', '.githooks/x', '.github/workflows/x.yml', '.claude/x',
    'scripts/lib/guard-paths.mjs', '.github/automation/arming.json',
    // GOVERNANCE prose under docs/: the allowlist alone would take it, only the guard refuses it
    'docs/automerge.md', 'docs/testing-doctrine.md',
  ];
  const hard: Array<[string, F[]]> = HARD_TIER.flatMap((p) => [
    [`hard-tier ${p} alone`, [file(p)]],
    [`hard-tier ${p} in a docs PR`, [...DOCS_PR, file(p)]],
    [`hard-tier ${p} in a test PR`, [...TEST_PR, file(p)]],
  ] as Array<[string, F[]]>);
  it.each(hard)('%s does NOT', (_n, files) => {
    const v = judge(files);
    expect(v.qualifies).toBe(false);
    expect(v.reasons.length).toBeGreaterThan(0);
  });

  const lines = (n: number) => ({ additions: n, deletions: 0 });
  const many = (n: number) => Array.from({ length: n }, (_, i) => file(`docs/many/f${i}.md`, lines(1)));
  type Row = [string, F[], Record<string, unknown>, Record<string, unknown>, boolean];
  const rows: Row[] = [
    // positives: the three classes as the brief writes them
    ['A/B docs .md + images merge', [file('docs/a.md'), file('docs/x/b.png'), file('docs/c.jpg'), file('docs/d.jpeg'), file('docs/e.webp'), file('docs/f.gif')], {}, {}, true],
    ['A/B root README.md merges', [file('README.md')], {}, {}, true],
    ['A/B docs PR needs no review record', [file('docs/a.md')], { labels: [LABEL_OK] }, { reviewRecord: null }, true],
    ['A/B 60 files merge (cap is at most 60)', many(60), {}, {}, true],
    ['C tests/**/*.test.ts with record merges', [file('tests/deep/a.test.ts')], {}, {}, true],
    ['C tests/**/*.test.tsx with record merges', [file('tests/client/a.test.tsx')], {}, {}, true],
    ['C tests/e2e/**/*.spec.ts with record merges', [file('tests/e2e/x/a.spec.ts')], {}, {}, true],
    ['C 199 lines merges (cap is under 200)', [file('tests/a.test.ts', lines(199))], {}, {}, true],
    ['mixed docs + tests with record merges', [file('docs/a.md'), file('tests/a.test.ts')], {}, {}, true],
    // negatives: paths not on the A/B/C allowlist
    ['docs/x.mjs does NOT', [file('docs/x.mjs')], {}, {}, false],
    ['docs/x.json does NOT', [file('docs/x.json')], {}, {}, false],
    ['docs/x.sql does NOT', [file('docs/x.sql')], {}, {}, false],
    ['docs/x.MD (upper-case ext) does NOT', [file('docs/x.MD')], {}, {}, false],
    ['README.MD does NOT', [file('README.MD')], {}, {}, false],
    ['a nested README.md outside docs/ does NOT', [file('tools/README.md')], {}, {}, false],
    ['tests/setup-env.ts does NOT', [file('tests/setup-env.ts')], {}, {}, false],
    ['a tests/ fixture does NOT', [file('tests/fixtures/x.json')], {}, {}, false],
    ['a tests/ helper .ts does NOT', [file('tests/autopilotTable.ts')], {}, {}, false],
    ['a spec outside tests/e2e/ does NOT', [file('tests/e2e-phone/a.spec.ts')], {}, {}, false],
    ['a root e2e/ spec does NOT', [file('e2e/a.spec.ts')], {}, {}, false],
    ['a src __tests__ file does NOT', [file('src/__tests__/a.test.ts')], {}, {}, false],
    ['a .test.js under tests/ does NOT', [file('tests/a.test.js')], {}, {}, false],
    ['a test file outside tests/ does NOT', [file('lib/a.test.ts')], {}, {}, false],
    ['a docs PR plus tests/setup-env.ts does NOT', [file('docs/a.md'), file('tests/setup-env.ts')], {}, {}, false],
    // negatives: caps
    ['61 files do NOT', many(61), {}, {}, false],
    ['a 200-line test PR does NOT', [file('tests/a.test.ts', lines(200))], {}, {}, false],
    ['a 250-line mixed docs + tests PR does NOT (judged as C)', [file('docs/a.md', lines(200)), file('tests/a.test.ts', lines(50))], {}, {}, false],
    ['a 250-line docs PR merges (A/B cap is 400)', [file('docs/a.md', lines(250))], {}, {}, true],
    // negatives: removed / renamed tests
    ['a removed test does NOT', [file('tests/a.test.ts', { status: 'removed' })], {}, {}, false],
    ['a renamed test does NOT', [file('tests/b.test.ts', { status: 'renamed', previous_filename: 'tests/a.test.ts' })], {}, {}, false],
    // negatives: the class-C review record, fail closed
    ['C with no record does NOT', [file('tests/a.test.ts')], {}, { reviewRecord: null }, false],
    ['C record read failed (API error) does NOT', [file('tests/a.test.ts')], {}, { reviewRecord: { error: 'GET /issues/1/comments -> 502' } }, false],
    ['C wrong-sha record does NOT', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, comments: [packComment({ body: `review-pack: https://claude.ai/artifact/abc head ${'f'.repeat(40)}` })] } }, false],
    ['C short-sha record does NOT', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, comments: [packComment({ body: `review-pack: https://claude.ai/artifact/abc head ${HEAD.slice(0, 12)}` })] } }, false],
    ['C upper-case sha record does NOT (exact match)', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, comments: [packComment({ body: `review-pack: https://claude.ai/artifact/abc head ${HEAD.toUpperCase()}` })] } }, false],
    ['C http (not https) pack url does NOT', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, comments: [packComment({ body: `review-pack: http://claude.ai/artifact/abc head ${HEAD}` })] } }, false],
    ['C marker quoted mid-comment does NOT (last line only)', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, comments: [packComment({ body: `review-pack: https://claude.ai/artifact/abc head ${HEAD}\nquoted above, not a pack` })] } }, false],
    ['C marker in a code span does NOT (whole line only)', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, comments: [packComment({ body: `\`review-pack: https://claude.ai/artifact/abc head ${HEAD}\`` })] } }, false],
    ['C marker with trailing text does NOT', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, comments: [packComment({ body: `review-pack: https://claude.ai/artifact/abc head ${HEAD} (r1)` })] } }, false],
    ['C marker on the last line after CRLF text merges', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, comments: [packComment({ body: `Review done.\r\n\r\nreview-pack: https://claude.ai/artifact/abc head ${HEAD}\r\n` })] } }, true],
    ['C record older than the push does NOT', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, comments: [packComment({ created_at: '2026-11-01T09:59:00Z' })] } }, false],
    ['C record with no created_at does NOT', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, comments: [packComment({ created_at: undefined })] } }, false],
    ['C record posted by the owner does NOT', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, comments: [packComment({ user: { login: OWNER_LOGIN } })] } }, false],
    ['C push time unknown does NOT', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, pushAnchorMs: null } }, false],
    ['C head sha unknown does NOT', [file('tests/a.test.ts')], { headSha: undefined }, {}, false],
    ['C review-passed applied by the owner does NOT', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, labelEvents: [reviewLabelEvent({ actor: { login: OWNER_LOGIN } })] } }, false],
    ['C review-passed applied before the push does NOT', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, labelEvents: [reviewLabelEvent({ created_at: '2026-11-01T09:00:00Z' })] } }, false],
    ['C review-passed label not on the PR does NOT', [file('tests/a.test.ts')], { labels: [LABEL_OK] }, {}, false],
    ['C label events not read does NOT', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, labelEvents: null } }, false],
    ['C comments not read does NOT', [file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, comments: null } }, false],
    ['mixed docs + tests with no record does NOT (judged as C)', [file('docs/a.md'), file('tests/a.test.ts')], {}, { reviewRecord: null }, false],
  ];

  it.each(rows)('%s', (_n, files, prOver, opts, want) => {
    const v = judge(files, prOver, opts);
    expect(v.qualifies).toBe(want);
    if (want) expect(v.reasons).toEqual([]);
    else expect(v.reasons.length).toBeGreaterThan(0);
  });

  it('names the review-record problem it refused on', () => {
    const v = judge([file('tests/a.test.ts')], {}, { reviewRecord: { ...RECORD, comments: [packComment({ body: `review-pack: https://x.example/p head ${'f'.repeat(40)}` })] } });
    expect(v.reasons.some((r: string) => /review-pack/.test(r))).toBe(true);
  });

  it('table holds both verdicts (non-vacuous)', () => {
    expect(rows.some((r) => r[4])).toBe(true);
    expect(rows.filter((r) => !r[4]).length).toBeGreaterThan(rows.filter((r) => r[4]).length);
  });
});

describe('automerge classifier -- class C record reader (main), fail closed', () => {
  const commit = { commit: { committer: { date: '2026-11-01T09:58:00Z' } } };
  const runs = { workflow_runs: [{ created_at: '2026-11-01T10:00:00Z' }, { created_at: '2026-11-01T10:03:00Z' }] };

  it('push anchor = the later of committer date and the first run at the head', () => {
    expect(pushAnchorFrom(commit, runs)).toBe(Date.parse('2026-11-01T10:00:00Z'));
    // a committer date set in the future only makes the anchor later (stricter)
    expect(pushAnchorFrom({ commit: { committer: { date: '2026-11-02T00:00:00Z' } } }, runs)).toBe(Date.parse('2026-11-02T00:00:00Z'));
  });

  it.each([
    ['no runs at the head', commit, { workflow_runs: [] }],
    ['runs not read', commit, null],
    ['no committer date', { commit: {} }, runs],
    ['a run with no created_at', commit, { workflow_runs: [{}] }],
  ])('push anchor is null when %s', (_n, c, r) => {
    expect(pushAnchorFrom(c, r)).toBe(null);
  });

  it('any API failure is { error }, never a throw, and classify() refuses it', async () => {
    const boom = async () => { throw new Error('GET /repos/o/r/commits/x -> 502'); };
    const rec = await readReviewRecord('o/r', '1', HEAD, [], boom, async () => []);
    expect(rec.error).toMatch(/502/);
    const files = [file('tests/a.test.ts')];
    const pr = { ...basePr, additions: 3, deletions: 1, changedFiles: 1 };
    expect(classify({ pr, files, labelActor: BOT_LOGIN, reviewRecord: rec, testSources: sources(files), ...FOUNDATIONS_OK.classify }).qualifies).toBe(false);
  });

  it('a short head sha is refused before any request', async () => {
    let called = 0;
    const get = async () => { called++; return {}; };
    const rec = await readReviewRecord('o/r', '1', HEAD.slice(0, 7), [], get, get);
    expect(rec.error).toBeTruthy();
    expect(called).toBe(0);
  });

  it('a good read yields a record classify() accepts', async () => {
    const get = async (p: string) => (p.includes('/commits/') ? commit : runs);
    const rec = await readReviewRecord('o/r', '1', HEAD, [reviewLabelEvent()], get, async () => [packComment()]);
    expect(rec).toMatchObject({ pushAnchorMs: PUSH_MS, labelEvents: [reviewLabelEvent()] });
    const files = [file('tests/a.test.ts')];
    const pr = { ...basePr, additions: 3, deletions: 1, changedFiles: 1 };
    expect(classify({ pr, files, labelActor: BOT_LOGIN, reviewRecord: rec, testSources: sources(files), ...FOUNDATIONS_OK.classify }).qualifies).toBe(true);
  });
});

/* -- Brief automerge-web-test-source-refusal: a class-C file's HEAD content is read and refused
 * when it is not a plain vitest suite of the site (node:test, scripts/ imports, Supabase, or
 * content that cannot be read). Ported from the admin classifier; unknown content is a NO. */
describe('automerge classifier -- testSourceRefusal (class C content)', () => {
  const P = 'tests/a.test.ts';
  const refusals: Array<[string, unknown, RegExp | null]> = [
    ['a clean vitest suite passes', CLEAN_TEST, null],
    ['a suite naming "scripted" or "transcripts/" in prose passes', "import { it } from 'vitest';\nit('reads transcripts/ and scripted text', () => {});\n", null],
    ['node:test import is refused', "import { test } from 'node:test';\ntest('x', () => {});\n", /node:test/],
    ['node:test require is refused', "const { test } = require('node:test');\n", /node:test/],
    ['a relative scripts/ import is refused', "import { x } from '../scripts/check-x.mjs';\n", /imports scripts\//],
    ['a dynamic scripts/ import is refused', "const m = await import('../../scripts/lib/a.mjs');\n", /imports scripts\//],
    ['a vi.mock of scripts/ is refused', "vi.mock('../scripts/lib/a.mjs');\n", /imports scripts\//],
    ['a path.join to scripts is refused', "const p = path.join(ROOT, 'scripts', 'x.mjs');\n", /imports scripts\//],
    ['a Supabase client import is refused', "import { createClient } from '@supabase/supabase-js';\n", /Supabase/],
    ['a Supabase reference in any case is refused', "const url = process.env.VITE_SUPABASE_URL;\n", /Supabase/],
    ['missing content (null) is refused', null, /unreadable/],
    ['missing content (undefined) is refused', undefined, /unreadable/],
    ['empty content is refused', '   \n', /unknown content/],
    ['binary (NUL) content is refused', 'abc\u0000def', /unknown content/],
    ['undecodable (U+FFFD) content is refused', 'it(�)', /unknown content/],
  ];

  it.each(refusals)('%s', (_n, text, want) => {
    const r = testSourceRefusal(P, text);
    if (want === null) expect(r).toBe(null);
    else {
      expect(r).toMatch(want);
      expect(r.startsWith(`${P}: `)).toBe(true);
    }
  });

  it('each refused shape gives its own reason', () => {
    const reasons = refusals.filter((r) => r[2]).map((r) => testSourceRefusal(P, r[1]).replace(/ \(.*$/, ''));
    expect(new Set(reasons).size).toBeGreaterThanOrEqual(5);
  });

  const TEST_PR = [file(P)];
  const judgeWith = (testSources: unknown, files: F[] = TEST_PR) => run(files, {}, { testSources });
  const rows: Array<[string, unknown, boolean, RegExp | null]> = [
    ['clean test with clean source merges', { [P]: CLEAN_TEST }, true, null],
    ['clean test via a Map merges', new Map([[P, CLEAN_TEST]]), true, null],
    ['test importing scripts/ does NOT', { [P]: "import { x } from '../scripts/x.mjs';\n" }, false, /imports scripts\//],
    ['node:test suite does NOT', { [P]: "import test from 'node:test';\n" }, false, /node:test/],
    ['test touching Supabase does NOT', { [P]: "import { supabase } from '../src/integrations/supabase/client';\n" }, false, /Supabase/],
    ['content unreadable for the file does NOT', { [P]: null }, false, /unreadable/],
    ['file missing from the sources does NOT', {}, false, /unreadable/],
    ['sources not read at all does NOT', null, false, /test sources not read/],
  ];

  it.each(rows)('classify: %s', (_n, testSources, want, reason) => {
    const v = judgeWith(testSources);
    expect(v.qualifies).toBe(want);
    if (want) expect(v.reasons).toEqual([]);
    else expect(v.reasons.some((r: string) => reason!.test(r))).toBe(true);
  });

  it('a docs-only PR needs no test sources (classes A/B)', () => {
    expect(judgeWith(null, [file('docs/a.md')]).qualifies).toBe(true);
  });

  it('a mixed PR refuses a bad test even when the docs are fine', () => {
    const files = [file('docs/a.md'), file(P)];
    expect(judgeWith({ [P]: "import 'node:test';\n" }, files).qualifies).toBe(false);
  });

  it('copied test is refused as class C', () => {
    const v = run([file('tests/b.test.ts', { status: 'copied', previous_filename: P })]);
    expect(v.qualifies).toBe(false);
    expect(v.classes).toEqual(['C']);
    expect(v.reasons.some((r: string) => /copies a test/.test(r))).toBe(true);
  });
});

describe('automerge classifier -- readReviewRecord query params', () => {
  it('asks for commits/<sha>, runs at head_sha with per_page=100, and pages issue comments', async () => {
    const got: string[] = [];
    const listed: Array<[string, number]> = [];
    const get = async (p: string) => { got.push(p); return p.includes('/commits/') ? { commit: { committer: { date: '2026-11-01T09:58:00Z' } } } : { workflow_runs: [{ created_at: '2026-11-01T10:00:00Z' }] }; };
    const list = async (p: string, max: number) => { listed.push([p, max]); return []; };
    await readReviewRecord('o/r', '7', HEAD, [], get, list);
    expect(got.sort()).toEqual([`/repos/o/r/actions/runs?head_sha=${HEAD}&per_page=100`, `/repos/o/r/commits/${HEAD}`]);
    expect(listed).toHaveLength(1);
    expect(listed[0][0]).toBe('/repos/o/r/issues/7/comments');
    expect(listed[0][1]).toBeGreaterThan(1); // paged, not one page
  });
});

describe('automerge classifier -- readTestSources (main), fail closed', () => {
  const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
  it('reads each class-C file at the head sha and decodes it', async () => {
    const got: string[] = [];
    const get = async (p: string) => { got.push(p); return { type: 'file', encoding: 'base64', content: b64(CLEAN_TEST) }; };
    const files = [file('tests/a b.test.ts'), file('docs/a.md'), file('tests/old.test.ts', { status: 'removed' })];
    const src = await readTestSources('o/r', HEAD, files, get);
    expect(got).toEqual([`/repos/o/r/contents/tests/a%20b.test.ts?ref=${HEAD}`]);
    expect(src).toEqual({ 'tests/a b.test.ts': CLEAN_TEST });
  });

  it.each([
    ['an API failure', async () => { throw new Error('GET -> 404'); }],
    ['a directory answer', async () => [] as unknown],
    ['an empty (too large) body', async () => ({ type: 'file', encoding: 'none', content: '' })],
  ])('%s leaves the file null, which classify refuses', async (_n, get) => {
    const files = [file('tests/a.test.ts')];
    const src = await readTestSources('o/r', HEAD, files, get);
    expect(src).toEqual({ 'tests/a.test.ts': null });
    expect(run(files, {}, { testSources: src }).qualifies).toBe(false);
  });

  it('a short head sha reads nothing', async () => {
    let called = 0;
    const src = await readTestSources('o/r', HEAD.slice(0, 7), [file('tests/a.test.ts')], async () => { called++; return {}; });
    expect(called).toBe(0);
    expect(src).toEqual({ 'tests/a.test.ts': null });
  });
});
