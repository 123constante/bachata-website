#!/usr/bin/env node
/**
 * Every e2e spec we wrote either RUNS in CI or says, in writing, why not.
 *
 * `test:e2e` and `test:e2e:p3` in package.json are hand-typed spec lists
 * (e2e-smoke.yml runs them by name), not globs. A spec added to tests/e2e/
 * without being added to one of them is collected by nothing in CI, and the
 * e2e tick stays green over a test that never ran. Measured on main 8e0b932
 * (2026-11-12): 42 of 87 specs under tests/e2e/ were in neither list (3 of
 * them under live/, which has its own config and workflow), with no
 * record of which absences were deliberate. The count is not pinned here --
 * re-measure with `node scripts/check-e2e-spec-coverage.mjs`.
 *
 * THE RULE. Every `*.spec.ts` under tests/e2e/ (recursive, minus any live/ dir)
 * must be EXACTLY ONE of:
 *   - named in a CI list (CI_LISTS: an npm script a workflow runs), or
 *   - in MANUAL below, with a one-line reason and the command that runs it.
 * Also red: a MANUAL entry for a file that no longer exists (a stale
 * exemption is how a deleted spec's replacement inherits it silently), a
 * MANUAL entry that is ALSO listed (pick one), a MANUAL entry missing its
 * reason or command, a CI list naming a file that does not exist, and a CI
 * list that the named workflow no longer runs (the list would then be
 * decoration and every "listed" spec as unrun as an unlisted one).
 *
 * KNOWN LIMIT: "runs it" means a single-line `run: npm run <list>` exists in
 * the workflow text. A step gated off by `if:` still satisfies it, and a
 * multi-line `run: |` block reads as absent (red, the safe direction).
 *
 * WHERE IT RUNS IN CI. tests/e2eSpecCoverage.test.ts drives main() against
 * the live tree, so the `unit` job (unit-tests.yml, every pull_request) goes
 * red. That job is used because adding a step to a workflow was out of scope
 * for the change that introduced this guard. It is also a link in
 * `npm run lint` (scripts/run-lint-chain.mjs), which pre-ship runs.
 *
 * Exit codes: 0 every spec accounted for; 1 contract violated (the message
 * names each file); 2 could not measure (package.json unreadable, a CI list
 * missing, or ZERO specs found -- an empty sample never reads as a pass).
 *
 * Usage:
 *   node scripts/check-e2e-spec-coverage.mjs
 *   node scripts/check-e2e-spec-coverage.mjs --self-test
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SPEC_ROOT = 'tests/e2e';

/** npm script -> the workflow file that must run it (`npm run <script>`). */
export const CI_LISTS = {
  'test:e2e': '.github/workflows/e2e-smoke.yml',
  'test:e2e:p3': '.github/workflows/e2e-smoke.yml',
  // Read-only SSR page loads against PRODUCTION (need a real-data build): live-qa.yml, daily.
  'test:e2e:prod-ssr': '.github/workflows/live-qa.yml',
};

/** Directories under tests/e2e/ whose specs are not this guard's business. */
export const IGNORED_DIRS = {
  live: 'own config (playwright.live.config.ts) hitting prod; run by live-qa.yml via npm run test:e2e:live. Ignored at ANY depth, mirroring the chromium project testIgnore **/live/**',
};
// helpers/ and harness/ are NOT ignored: they hold no specs today, and a
// *.spec.ts dropped there would still be collected by playwright, so it must
// be accounted for like any other.

const PW = (rel, env = '', extra = '') => `${env ? env + ' ' : ''}npx playwright test ${rel} --project=chromium${extra ? ' ' + extra : ''}`;
/** Walks against a served PRODUCTION build: the build + serve step comes first (the spec header has the full recipe). */
const BUILT = (rel, env = '') => `VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build && (node scripts/_serve-build.mjs --port 4173 &) && ${PW(rel, env)}`;
const P3 = 'VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true';
const P3T = `${P3} VITE_ENABLE_ORGANISER_TICKETING=true`;
const DETAIL = 'VITE_ENABLE_ORGANISER_DETAIL=true VITE_ENABLE_ORGANISER_SELF_SERVE=true';
const WALK = 'screenshot walk for a person to judge (report only); not a pass/fail gate';
const PROD_BUILD = 'screenshot walk run against a local PRODUCTION build with a flag flipped locally; never a gate';

/**
 * Specs that deliberately do NOT run in CI. One line of reason, and the
 * command that does run them. Adding to this list is a decision -- the PR
 * diff shows it -- which is the whole point: an absence is now on record.
 */
export const MANUAL = {
  'tests/e2e/arc1-claim-walk.spec.ts': { reason: WALK, run: PW('tests/e2e/arc1-claim-walk.spec.ts') },
  'tests/e2e/arc1-invite-redeem-walk.spec.ts': { reason: WALK, run: PW('tests/e2e/arc1-invite-redeem-walk.spec.ts') },
  'tests/e2e/console-clean-smoke.spec.ts': { reason: 'console-error smoke never wired into a CI list; audit item 2 decides', run: PW('tests/e2e/console-clean-smoke.spec.ts') },
  'tests/e2e/dancer-app/ember-walk.spec.ts': { reason: WALK, run: PW('tests/e2e/dancer-app/ember-walk.spec.ts') },
  'tests/e2e/dancer-app/review-pack.spec.ts': { reason: 'review pack; skips itself unless REVIEW_PACK_DIR is set', run: PW('tests/e2e/dancer-app/review-pack.spec.ts', 'REVIEW_PACK_DIR=<dir>') },
  'tests/e2e/organiser-edit-save-bar.real-supabase.spec.ts': { reason: 'needs a real Supabase anon key (SSR loader) and the organiser detail flags; skips without the key', run: PW('tests/e2e/organiser-edit-save-bar.real-supabase.spec.ts', DETAIL) },
  'tests/e2e/organiser-launch-walk.spec.ts': { reason: 'needs E2E credentials and writes to the E2E database', run: 'npm run test:e2e:organiser-launch-walk' },
  'tests/e2e/organiser-public-claim.real-supabase.spec.ts': { reason: 'needs a real Supabase anon key (SSR loader) and the organiser detail flags; skips without the key', run: PW('tests/e2e/organiser-public-claim.real-supabase.spec.ts', DETAIL) },
  'tests/e2e/organiser-real-rpc.spec.ts': { reason: 'needs E2E credentials and writes to the E2E database', run: 'npm run test:e2e:organiser-real-rpc' },
  'tests/e2e/restyle-a-walk.spec.ts': { reason: WALK, run: PW('tests/e2e/restyle-a-walk.spec.ts') },
  'tests/e2e/walk-p3-organiser-events.spec.ts': { reason: WALK, run: PW('tests/e2e/walk-p3-organiser-events.spec.ts', 'VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_DASH=true') },
  'tests/e2e/ticket-door-code.spec.ts': { reason: 'mounts only with P3 + ticketing + door-code flags on; skips otherwise', run: PW('tests/e2e/ticket-door-code.spec.ts', `${P3T} VITE_ENABLE_TICKET_DOOR_CODE=true`) },
  'tests/e2e/ticket-thanks.spec.ts': { reason: 'needs VITE_ENABLE_PUBLIC_TICKETING at dev-server start; 404 by design in the gate', run: PW('tests/e2e/ticket-thanks.spec.ts', 'VITE_ENABLE_PUBLIC_TICKETING=true') },
  'tests/e2e/vendor-city-real-supabase.spec.ts': { reason: 'real Supabase; skips without its env vars', run: 'npm run test:e2e:vendor:real' },
  'tests/e2e/walk-event-tickets-page.spec.ts': { reason: `${WALK}; needs the local mock Supabase and a flag`, run: `(MOCK_PORT=54321 npx tsx tests/e2e/helpers/mockSupabaseServer.ts &) && ${PW('tests/e2e/walk-event-tickets-page.spec.ts', 'VITE_ENABLE_PUBLIC_TICKETING=true')}` },
  'tests/e2e/walk-fix-gate-lost-edit.spec.ts': { reason: WALK, run: PW('tests/e2e/walk-fix-gate-lost-edit.spec.ts', P3) },
  'tests/e2e/walk-fix-sw1.spec.ts': { reason: PROD_BUILD, run: BUILT('tests/e2e/walk-fix-sw1.spec.ts') },
  'tests/e2e/walk-flip.spec.ts': { reason: PROD_BUILD, run: BUILT('tests/e2e/walk-flip.spec.ts') },
  'tests/e2e/walk-getpaid-start.spec.ts': { reason: `${WALK}; mounts only with P3 + ticketing flags`, run: PW('tests/e2e/walk-getpaid-start.spec.ts', P3T) },
  'tests/e2e/walk-int3.spec.ts': { reason: PROD_BUILD, run: BUILT('tests/e2e/walk-int3.spec.ts') },
  'tests/e2e/walk-int4.spec.ts': { reason: PROD_BUILD, run: BUILT('tests/e2e/walk-int4.spec.ts') },
  'tests/e2e/walk-join-gaps-2.spec.ts': { reason: WALK, run: PW('tests/e2e/walk-join-gaps-2.spec.ts', P3) },
  'tests/e2e/walk-p-series.spec.ts': { reason: PROD_BUILD, run: BUILT('tests/e2e/walk-p-series.spec.ts') },
  'tests/e2e/walk-p3-batch-1-dates.spec.ts': { reason: WALK, run: PW('tests/e2e/walk-p3-batch-1-dates.spec.ts', `WALK_OUT=<dir> ${P3}`, '--workers=1') },
  'tests/e2e/walk-p3-batch-1-door.spec.ts': { reason: WALK, run: PW('tests/e2e/walk-p3-batch-1-door.spec.ts', `WALK_OUT=<dir> ${P3T}`, '--workers=1') },
  'tests/e2e/walk-p3-batch-1-status.spec.ts': { reason: WALK, run: PW('tests/e2e/walk-p3-batch-1-status.spec.ts', `WALK_OUT=<dir> ${P3}`, '--workers=1') },
  'tests/e2e/walk-p3-gate-guard-1.spec.ts': { reason: WALK, run: PW('tests/e2e/walk-p3-gate-guard-1.spec.ts', P3) },
  'tests/e2e/walk-p3-promo-codes.spec.ts': { reason: WALK, run: PW('tests/e2e/walk-p3-promo-codes.spec.ts', P3T) },
  'tests/e2e/walk-p3-w0.spec.ts': { reason: WALK, run: PW('tests/e2e/walk-p3-w0.spec.ts', P3) },
  'tests/e2e/walk-p3-w3b1.spec.ts': { reason: WALK, run: PW('tests/e2e/walk-p3-w3b1.spec.ts', P3) },
  'tests/e2e/walk-p3-w4a-fix3-r2.spec.ts': { reason: WALK, run: PW('tests/e2e/walk-p3-w4a-fix3-r2.spec.ts', P3) },
  'tests/e2e/walk-p3-walklist.spec.ts': { reason: 'local-walk-only by its own header: minutes of fixed waits, writes docs/walk/', run: PW('tests/e2e/walk-p3-walklist.spec.ts', P3, '--workers=1') },
  'tests/e2e/walk-sfeedback.spec.ts': { reason: PROD_BUILD, run: BUILT('tests/e2e/walk-sfeedback.spec.ts') },
  'tests/e2e/walk-smerge.spec.ts': { reason: PROD_BUILD, run: BUILT('tests/e2e/walk-smerge.spec.ts', 'SMERGE_SUPPORT=on') },
  'tests/e2e/walk-sperf.spec.ts': { reason: PROD_BUILD, run: BUILT('tests/e2e/walk-sperf.spec.ts') },
  'tests/e2e/walk-spolish.spec.ts': { reason: PROD_BUILD, run: BUILT('tests/e2e/walk-spolish.spec.ts', 'SPOLISH_SUPPORT=on') },
  'tests/e2e/walk-ssort.spec.ts': { reason: PROD_BUILD, run: BUILT('tests/e2e/walk-ssort.spec.ts') },
  'tests/e2e/walk-sw1.spec.ts': { reason: PROD_BUILD, run: BUILT('tests/e2e/walk-sw1.spec.ts') },
  'tests/e2e/walk-ticket-s1-pause-add.spec.ts': { reason: `${WALK}; mounts only with P3 + ticketing flags`, run: PW('tests/e2e/walk-ticket-s1-pause-add.spec.ts', P3T) },
  'tests/e2e/walk-ticket-sales-report.spec.ts': { reason: `${WALK}; mounts only with P3 + ticketing flags`, run: PW('tests/e2e/walk-ticket-sales-report.spec.ts', P3T) },
};

/** The `tests/e2e/...spec.ts` tokens a playwright command line names. */
export function listedSpecs(command) {
  return String(command ?? '')
    .split(/\s+/)
    .filter((t) => t.startsWith(`${SPEC_ROOT}/`) && t.endsWith('.spec.ts'));
}

/** Every spec path (posix, repo-relative) under SPEC_ROOT, minus IGNORED_DIRS. */
export function findSpecs(root, deps = {}) {
  const readdir = deps.readdir ?? ((p) => readdirSync(p, { withFileTypes: true }));
  const out = [];
  const walk = (rel) => {
    for (const e of readdir(join(root, rel))) {
      const childRel = `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (Object.hasOwn(IGNORED_DIRS, e.name)) continue;
        walk(childRel);
      } else if (e.name.endsWith('.spec.ts')) {
        out.push(childRel);
      }
    }
  };
  walk(SPEC_ROOT);
  return out.sort();
}

/**
 * Pure verdict. `scripts` is package.json's scripts; `workflows` maps a
 * workflow path to its text; `specs` is findSpecs' output; `manual` is MANUAL.
 * Returns { code, lines, counts }.
 */
export function runCheck({ scripts, workflows, specs, manual = MANUAL, ciLists = CI_LISTS }) {
  const lines = [];
  const problems = [];
  const listed = new Map(); // spec -> list name
  for (const [name, wf] of Object.entries(ciLists)) {
    const cmd = scripts?.[name];
    if (typeof cmd !== 'string') {
      return { code: 2, lines: [`CANNOT MEASURE: package.json has no "${name}" script (a CI list this guard reads).`], counts: null };
    }
    const runsIt = new RegExp(`^\\s*(?:-\\s*)?run:\\s*npm run ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
    if (!runsIt.test(workflows?.[wf] ?? '')) {
      problems.push(`${wf} no longer runs \`npm run ${name}\`: the specs it lists are not running in CI. Fix the workflow or CI_LISTS.`);
    }
    for (const s of listedSpecs(cmd)) listed.set(s, name);
  }
  if (!specs.length) {
    return { code: 2, lines: [`CANNOT MEASURE: found ZERO *.spec.ts under ${SPEC_ROOT}/ -- an empty sample is not a pass.`], counts: null };
  }
  if (!listed.size) {
    return { code: 2, lines: ['CANNOT MEASURE: the CI lists name ZERO specs -- nothing to compare against.'], counts: null };
  }
  const specSet = new Set(specs);
  for (const s of specs) {
    const inList = listed.has(s);
    const inManual = Object.hasOwn(manual, s);
    if (inList && inManual) problems.push(`${s} is in ${listed.get(s)} AND in MANUAL: remove the MANUAL entry.`);
    if (!inList && !inManual) {
      problems.push(`${s} runs in NO CI e2e list. Add it to ${Object.keys(ciLists).map((n) => `"${n}"`).join(' or ')} in package.json, or allow-list it in MANUAL in scripts/check-e2e-spec-coverage.mjs with a reason and the command that runs it.`);
    }
  }
  for (const [s, entry] of Object.entries(manual)) {
    if (!specSet.has(s)) problems.push(`MANUAL entry ${s} names a file that does not exist (stale): delete the entry.`);
    if (!entry || !String(entry.reason ?? '').trim() || !String(entry.run ?? '').trim()) {
      problems.push(`MANUAL entry ${s} needs both a reason and a run command.`);
    }
  }
  for (const [s, name] of listed) {
    if (!specSet.has(s)) problems.push(`"${name}" names ${s}, which does not exist: playwright would fail or the list is stale.`);
  }
  const manualHere = specs.filter((s) => Object.hasOwn(manual, s) && !listed.has(s)).length;
  const counts = { specs: specs.length, listed: specs.filter((s) => listed.has(s)).length, manual: manualHere };
  if (problems.length) {
    lines.push(`e2e spec coverage FAILED -- ${problems.length} problem(s):`);
    for (const p of problems) lines.push(`  - ${p}`);
    return { code: 1, lines, counts };
  }
  lines.push(`e2e spec coverage OK -- ${counts.specs} specs: ${counts.listed} in a CI list, ${counts.manual} allow-listed manual.`);
  return { code: 0, lines, counts };
}

function readInputs(root, deps) {
  const read = deps.readFile ?? ((p) => readFileSync(join(root, p), 'utf8'));
  const scripts = JSON.parse(read('package.json')).scripts;
  const workflows = {};
  for (const wf of new Set(Object.values(CI_LISTS))) {
    workflows[wf] = (deps.exists ?? ((p) => existsSync(join(root, p))))(wf) ? read(wf) : '';
  }
  const specs = deps.specs ?? findSpecs(root, deps);
  return { scripts, workflows, specs };
}

// ---------------------------------------------------------------- canary ---

const OK_SCRIPTS = {
  'test:e2e': 'playwright test tests/e2e/a.spec.ts tests/e2e/sub/b.spec.ts --project=chromium',
  'test:e2e:p3': 'playwright test tests/e2e/c.spec.ts --project=chromium',
};
const OK_WF = { '.github/workflows/e2e-smoke.yml': '      - name: smoke\n        run: npm run test:e2e\n      - name: p3\n        run: npm run test:e2e:p3\n' };
const OK_MANUAL = { 'tests/e2e/m.spec.ts': { reason: 'walk', run: 'npx playwright test tests/e2e/m.spec.ts' } };
const OK_SPECS = ['tests/e2e/a.spec.ts', 'tests/e2e/c.spec.ts', 'tests/e2e/m.spec.ts', 'tests/e2e/sub/b.spec.ts'];

/** Fake directory tree for findSpecs: { 'tests/e2e': ['a.spec.ts', 'helpers/'] , ... }. */
function fakeReaddir(tree) {
  return (abs) => {
    const key = Object.keys(tree).find((k) => abs.endsWith(k));
    if (!key) throw new Error(`no fake dir for ${abs}`);
    return tree[key].map((n) => ({ name: n.replace(/\/$/, ''), isDirectory: () => n.endsWith('/') }));
  };
}

/** Drive main() -- the exit owner -- with injected inputs. */
async function drive(over = {}) {
  const pkg = JSON.stringify({ scripts: over.scripts ?? OK_SCRIPTS });
  const wfs = over.workflows ?? OK_WF;
  const out = [];
  const code = await main([], {
    readFile: (p) => (p === 'package.json' ? pkg : wfs[p] ?? ''),
    exists: (p) => Object.hasOwn(wfs, p),
    specs: over.specs === null ? undefined : (over.specs ?? OK_SPECS),
    readdir: over.readdir,
    manual: over.manual ?? OK_MANUAL,
    log: (l) => out.push(l),
  });
  return { code, text: out.join('\n') };
}

async function selfTest() {
  const cases = [
    ['every spec listed or manual -> 0', {}, 0, 'OK'],
    ['unlisted spec -> 1, named, with both remedies', { specs: [...OK_SPECS, 'tests/e2e/foo.spec.ts'] }, 1, 'tests/e2e/foo.spec.ts runs in NO CI e2e list'],
    ['remedy names MANUAL', { specs: [...OK_SPECS, 'tests/e2e/foo.spec.ts'] }, 1, 'allow-list it in MANUAL'],
    ['stale MANUAL entry -> 1', { specs: OK_SPECS.filter((s) => !s.endsWith('/m.spec.ts')) }, 1, 'tests/e2e/m.spec.ts names a file that does not exist'],
    ['listed AND manual -> 1', { manual: { ...OK_MANUAL, 'tests/e2e/a.spec.ts': { reason: 'x', run: 'y' } } }, 1, 'AND in MANUAL'],
    ['manual entry without run -> 1', { manual: { 'tests/e2e/m.spec.ts': { reason: 'walk', run: '' } } }, 1, 'needs both a reason and a run command'],
    ['CI list names a missing file -> 1', { specs: OK_SPECS.filter((s) => !s.endsWith('/c.spec.ts')) }, 1, 'names tests/e2e/c.spec.ts, which does not exist'],
    ['workflow stopped running a list -> 1', { workflows: { '.github/workflows/e2e-smoke.yml': '        run: npm run test:e2e\n' } }, 1, 'no longer runs `npm run test:e2e:p3`'],
    ['test:e2e:p3 line does not satisfy test:e2e -> 1', { workflows: { '.github/workflows/e2e-smoke.yml': '        run: npm run test:e2e:p3\n' } }, 1, 'no longer runs `npm run test:e2e`:'],
    ['CI list script missing -> 2', { scripts: { 'test:e2e': OK_SCRIPTS['test:e2e'] } }, 2, 'no "test:e2e:p3" script'],
    ['zero specs -> 2, never green', { specs: [] }, 2, 'ZERO *.spec.ts'],
    ['lists name zero specs -> 2', { scripts: { 'test:e2e': 'playwright test', 'test:e2e:p3': 'playwright test' } }, 2, 'name ZERO specs'],
    [
      'findSpecs: subfolder spec counted, live/ ignored at any depth',
      {
        specs: null,
        readdir: fakeReaddir({
          'tests/e2e': ['a.spec.ts', 'c.spec.ts', 'm.spec.ts', 'sub/', 'live/', 'util.ts'],
          'tests/e2e/sub': ['b.spec.ts', 'live/'],
          'tests/e2e/sub/live': ['x.spec.ts'],
          'tests/e2e/live': ['pages.spec.ts'],
        }),
      },
      0,
      '4 specs: 3 in a CI list, 1 allow-listed',
    ],
    [
      'findSpecs: unlisted subfolder spec -> 1',
      {
        specs: null,
        readdir: fakeReaddir({
          'tests/e2e': ['a.spec.ts', 'c.spec.ts', 'm.spec.ts', 'sub/'],
          'tests/e2e/sub': ['b.spec.ts', 'new.spec.ts'],
        }),
      },
      1,
      'tests/e2e/sub/new.spec.ts runs in NO CI e2e list',
    ],
    [
      'findSpecs: a spec dropped in helpers/ is NOT ignored -> 1',
      {
        specs: null,
        readdir: fakeReaddir({
          'tests/e2e': ['a.spec.ts', 'c.spec.ts', 'm.spec.ts', 'sub/', 'helpers/'],
          'tests/e2e/sub': ['b.spec.ts'],
          'tests/e2e/helpers': ['h.spec.ts', 'mock.ts'],
        }),
      },
      1,
      'tests/e2e/helpers/h.spec.ts runs in NO CI e2e list',
    ],
  ];
  let failed = 0;
  for (const [name, over, wantCode, wantText] of cases) {
    const { code, text } = await drive(over);
    const ok = code === wantCode && text.includes(wantText);
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${code}: ${text.split('\n')[0]}...)`}`);
  }
  console.log(failed ? `\nself-test FAILED: ${failed} of ${cases.length} cases.` : `\nself-test passed: ${cases.length} cases.`);
  return failed === 0;
}

// ------------------------------------------------------------------ main ---

export async function main(argv = [], deps = {}) {
  if (argv.includes('--self-test')) return (await selfTest()) ? 0 : 1;
  const log = deps.log ?? ((l) => console.log(l));
  let inputs;
  try {
    inputs = readInputs(deps.root ?? ROOT, deps);
  } catch (err) {
    log(`CANNOT MEASURE: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
  const { code, lines } = runCheck({ ...inputs, manual: deps.manual ?? MANUAL });
  for (const l of lines) log(l);
  return code;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
