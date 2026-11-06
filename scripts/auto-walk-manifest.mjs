#!/usr/bin/env node
/**
 * Auto-walk pictures (brief auto-walk-pictures-1): from a PR's changed files, the
 * existing driven walks that show those screens at 390x844, and the pictures they
 * took, as test-results/auto-walk/auto-walk-manifest.json -- for the review pack.
 *
 * UI files are the ones scripts/check-pr-phone-qa.mjs requires a "## Phone QA"
 * section for: UI_PATH_RE is IMPORTED from there, never retyped.
 *
 * FAIL-CLOSED. Every changed UI file ends in the manifest either as pictures or
 * as a line "NOT covered: <file>" (with a reason when a mapped walk ran and left
 * no picture, or failed). The manifest is never silently empty: with no UI file
 * changed it says so in `reason`.
 *
 * No spec is edited to take these pictures. Each walk already writes screenshots
 * to a directory named by an env var (SHOTS, P3_WALK_DIR, DOOR_SHOTS) or to fixed
 * paths; --run points that env var at test-results/auto-walk/<walk>/ and copies
 * the fixed-path ones (written during this run only) in. New specs can call
 * autoWalkShot() from tests/e2e-phone/helpers.ts, which honours AUTO_WALK_DIR.
 *
 * Usage (CI, phone-qa job; no secret, fake Supabase / route-mocked fakes only):
 *   PR_FILES="$(git diff --name-only origin/main...HEAD)" node scripts/auto-walk-manifest.mjs --run
 *   PR_FILES=... node scripts/auto-walk-manifest.mjs           # plan + collect what exists, no run
 *   node scripts/auto-walk-manifest.mjs --summary              # print the manifest as markdown
 *   node scripts/auto-walk-manifest.mjs --self-test
 *
 * Exit: 0 manifest written (NOT covered lines are reported, not gated),
 *       1 self-test failed, 2 PR_FILES missing/empty or the manifest unreadable.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { UI_PATH_RE } from './check-pr-phone-qa.mjs';
import { isEntryPoint } from './lib/entry-point.mjs';

export const OUT_ROOT = 'test-results/auto-walk';
export const MANIFEST = `${OUT_ROOT}/auto-walk-manifest.json`;
export const SIZE = '390x844';

const P3 = { VITE_ENABLE_ORGANISER_SELF_SERVE: 'true', VITE_ENABLE_ORGANISER_P3: 'true' };
const smoke = (spec, extra) => ({ spec: `tests/e2e/${spec}.spec.ts`, config: 'playwright.config.ts', project: 'chromium', env: P3, ...extra });
const phone = (spec) => ({ spec: `tests/e2e-phone/${spec}.phone.spec.ts`, config: 'playwright.phone.config.ts', project: 'phone-390x844', env: {}, shotsEnv: 'SHOTS' });

/**
 * The walks: an existing spec that drives the screen and saves pictures.
 * shotsEnv: the env var naming its picture dir. fixed: [dir, prefix] of pictures
 * it writes to a fixed place (only files written during the run are taken).
 */
export const WALKS = {
  'p3-door': smoke('ticket-door-scanner', { env: { ...P3, VITE_ENABLE_ORGANISER_TICKETING: 'true' }, shotsEnv: 'DOOR_SHOTS' }),
  'p3-onboarding': smoke('walk-p3-w4b-onboarding', { shotsEnv: 'P3_WALK_DIR' }),
  'p3-golive': smoke('walk-p3-golive', { fixed: ['docs/handovers/p3-golive-wiring', ''] }),
  'p3-gate-sheet': smoke('p3-gate-sheet', { fixed: ['test-results', 'p3-gate-sheet-'] }),
  'p3-repeat': smoke('walk-w3c-1-repeat', { fixed: ['test-results', 'walk-w3c-1-repeat-'] }),
  'p3-history': smoke('walk-p3-w3b1', { shotsEnv: 'P3_WALK_DIR' }),
  'p3-shell': smoke('walk-p3-w0', { shotsEnv: 'P3_WALK_DIR' }),
  'front-door': phone('front-door'),
  'invite-join': phone('invite-join'),
  'invite-w2-golive': phone('invite-w2-golive'),
  'invite-w2-walk': phone('invite-w2-walk'),
  'organiser-contact-sheet': phone('organiser-contact-sheet'),
  'organiser-team-picker': phone('organiser-team-picker'),
};

/** UI file -> walks. FIRST match wins, so a narrow row sits above a broad one. */
export const MAP = [
  [/^src\/modules\/organiser\/p3\/door\//, ['p3-door']],
  [/^src\/modules\/organiser\/p3\/onboarding\/Gate(?:Host|Sheet)\.tsx$/, ['p3-gate-sheet']],
  [/^src\/modules\/organiser\/p3\/onboarding\//, ['p3-onboarding', 'p3-golive']],
  [/^src\/modules\/organiser\/p3\/screens\/RepeatSheet\.tsx$/, ['p3-repeat']],
  [/^src\/modules\/organiser\/p3\/screens\/HistoryScreen\.tsx$/, ['p3-history']],
  [/^src\/modules\/organiser\/p3\/(?:shell\/|theme\/|screens\/(?:HomeScreen|EventsScreen)\.tsx$)/, ['p3-shell']],
  [/^src\/modules\/admin-organisers\/(?:FrontDoor\w*|NeedsYou|AddOrganiser|AdminOrganisersPage)\.tsx$/, ['front-door']],
  [/^src\/modules\/admin-organisers\/(?:join\/|InviteRedeemPage\.tsx$)/, ['invite-join']],
  [/^src\/modules\/organiser\/home\/onboarding\/golive\//, ['invite-w2-golive']],
  [/^src\/modules\/organiser\/(?:wizard|events)\//, ['invite-w2-walk']],
  [/^src\/modules\/organiser\/edit-in-place\/Contact\w*\.tsx$/, ['organiser-contact-sheet']],
  [/^src\/modules\/organiser\/edit-in-place\/Team\w*\.tsx$/, ['organiser-team-picker']],
];

export const notCoveredLine = (file, why) => `NOT covered: ${file}${why ? ` (${why})` : ''}`;
export const walkDir = (key) => `${OUT_ROOT}/${key}`;

/**
 * A picture taken at another size is not this pack's size: a WxH token other than
 * 390x844, or a bare phone-width token (3xx/4xx) other than 390, drops it.
 */
export function isPackSize(name) {
  const n = basename(name);
  for (const m of n.matchAll(/(?:^|-)(\d{3,4})x(\d{3,4})(?=[-.]|$)/g)) if (`${m[1]}x${m[2]}` !== SIZE) return false;
  for (const m of n.matchAll(/(?:^|-)([34]\d\d)(?=[-.]|$)/g)) if (m[1] !== '390') return false;
  return true;
}

/** @param {string[]} files */
export function plan(files) {
  const ui = files.filter((f) => UI_PATH_RE.test(f));
  const entries = [];
  const notCovered = [];
  for (const file of ui) {
    const row = MAP.find(([re]) => re.test(file));
    if (row) entries.push({ file, walks: row[1] });
    else notCovered.push(file);
  }
  return { ui, entries, notCovered };
}

/**
 * @param {ReturnType<typeof plan>} p
 * @param {(dir: string) => string[]} listPngs  picture paths in a walk dir
 * @param {Record<string, number>} exits  walk key -> non-zero exit code of its run
 */
export function collect(p, listPngs, exits) {
  const covered = [];
  const notCovered = p.notCovered.map((f) => notCoveredLine(f));
  for (const { file, walks } of p.entries) {
    for (const key of walks) {
      const pics = listPngs(walkDir(key)).filter(isPackSize).sort();
      if (exits[key]) notCovered.push(notCoveredLine(file, `${key} failed (exit ${exits[key]})`));
      else if (pics.length === 0) notCovered.push(notCoveredLine(file, `${key} produced no picture`));
      for (const picture of pics) covered.push({ file, state: `${key}/${basename(picture, '.png')}`, picture, sizes: [SIZE] });
    }
  }
  const reason = p.ui.length === 0
    ? 'no UI path changed (UI_PATH_RE from scripts/check-pr-phone-qa.mjs)'
    : `${p.ui.length} UI file(s): ${covered.length} picture(s), ${notCovered.length} NOT covered line(s)`;
  return { size: SIZE, ui: p.ui, reason, covered, notCovered };
}

export function toMarkdown(m) {
  const out = ['## Auto-walk pictures (390x844)', '', m.reason, ''];
  if (m.covered.length) {
    out.push('| File | State | Picture |', '| --- | --- | --- |');
    for (const e of m.covered) out.push(`| \`${e.file}\` | ${e.state} | \`${e.picture}\` |`);
    out.push('');
  }
  for (const l of m.notCovered) out.push(`- ${l}`);
  out.push('', 'Pictures: the `auto-walk` artifact of this run.');
  return out.join('\n');
}

function listDirPngs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith('.png')).map((n) => join(dir, n));
}

/** Runs each needed walk once, pictures into its own dir; returns key -> non-zero exit code. */
function runWalks(keys, env, log) {
  const exits = {};
  for (const key of keys) {
    const w = WALKS[key];
    const dir = walkDir(key);
    mkdirSync(dir, { recursive: true });
    const since = Date.now() - 1000;
    const runEnv = { ...env, ...w.env, AUTO_WALK_DIR: dir, ...(w.shotsEnv ? { [w.shotsEnv]: dir } : {}) };
    log.log(`auto-walk: ${key}: npx playwright test ${w.spec} --config ${w.config} --project=${w.project}`);
    const r = spawnSync('npx', ['playwright', 'test', w.spec, '--config', w.config, `--project=${w.project}`], { env: runEnv, stdio: 'inherit' });
    if (r.status !== 0) exits[key] = r.status ?? 2;
    if (w.fixed) {
      const [src, prefix] = w.fixed;
      for (const n of existsSync(src) ? readdirSync(src) : []) {
        const from = join(src, n);
        if (n.startsWith(prefix) && n.endsWith('.png') && statSync(from).mtimeMs >= since) copyFileSync(from, join(dir, n));
      }
    }
  }
  return exits;
}

export function main(argv, env = process.env, log = console, out = { write: (s) => { mkdirSync(dirname(MANIFEST), { recursive: true }); writeFileSync(MANIFEST, s); } }) {
  if (argv.includes('--self-test')) return selfTest(log) ? 0 : 1;
  if (argv.includes('--summary')) {
    let m;
    try { m = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch (e) {
      log.error(`auto-walk: cannot read ${MANIFEST}: ${e.message}`);
      return 2;
    }
    log.log(toMarkdown(m));
    return 0;
  }
  if (typeof env.PR_FILES !== 'string') {
    log.error('auto-walk: PR_FILES is not set: pass the changed paths (git diff --name-only origin/main...HEAD).');
    return 2;
  }
  const files = env.PR_FILES.split('\n').map((f) => f.trim()).filter(Boolean);
  if (files.length === 0) {
    log.error('auto-walk: PR_FILES is empty: a PR always changes at least one file, so the list did not arrive.');
    return 2;
  }
  const p = plan(files);
  const keys = [...new Set(p.entries.flatMap((e) => e.walks))];
  const exits = argv.includes('--run') ? runWalks(keys, env, log) : {};
  const m = collect(p, listDirPngs, exits);
  out.write(JSON.stringify(m, null, 2) + '\n');
  log.log(`auto-walk: ${m.reason}`);
  for (const l of m.notCovered) log.log(`  ${l}`);
  return 0;
}

function selfTest(log) {
  const door = 'src/modules/organiser/p3/door/DoorScreen.tsx';
  const none = () => [];
  const one = (dir) => (dir === walkDir('p3-door') ? [`${dir}/1-ready.png`, `${dir}/x-360x640.png`] : []);
  const quiet = { log: () => undefined, error: () => undefined };
  const sink = { write: () => undefined };
  const cases = [
    ['mapped file with a picture is covered', () => collect(plan([door]), one, {}).covered.length === 1],
    ['mapped file with no picture is NOT covered', () => collect(plan([door]), none, {}).notCovered[0] === notCoveredLine(door, 'p3-door produced no picture')],
    ['unmapped UI file is NOT covered', () => collect(plan(['src/pages/Parties.tsx']), none, {}).notCovered[0] === 'NOT covered: src/pages/Parties.tsx'],
    ['failed walk is NOT covered', () => collect(plan([door]), one, { 'p3-door': 1 }).notCovered.length === 1],
    ['non-UI file is not in the plan', () => plan(['scripts/x.mjs']).ui.length === 0],
    ['other-size picture is dropped', () => !isPackSize('list-360-light.png') && !isPackSize('card-412x915.png') && !isPackSize('r-320x568-dark.png') && isPackSize('card-390x844.png') && isPackSize('list-390-light.png') && isPackSize('1-ready.png')],
    ['every MAP key is a walk', () => MAP.every(([, ks]) => ks.every((k) => WALKS[k]))],
    ['main: no PR_FILES exits 2', () => main([], {}, quiet, sink) === 2],
    ['main: empty PR_FILES exits 2', () => main([], { PR_FILES: ' \n' }, quiet, sink) === 2],
    ['main: a PR_FILES list exits 0', () => main([], { PR_FILES: 'src/pages/Parties.tsx' }, quiet, sink) === 0],
  ];
  let failed = 0;
  for (const [name, fn] of cases) {
    if (!fn()) { failed++; log.error(`FAIL ${name}`); }
  }
  if (failed) { log.error(`auto-walk self-test: ${failed} of ${cases.length} failed`); return false; }
  log.log(`auto-walk self-test: OK (${cases.length} cases)`);
  return true;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
