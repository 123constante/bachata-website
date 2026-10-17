#!/usr/bin/env node
/**
 * Dancer-area isolation check (Dancer Rebuild R0).
 *
 * The rebuild lives in ONE folder, src/modules/dancer-app/, and touches the old
 * site only through a short, named list of seam files. This guard proves that:
 *
 *   (a) every PROTECTED file is byte-identical to the base branch, and every
 *       CHANGED file outside src/modules/dancer-app/** and tests/** is a SEAM;
 *   (b) nothing under src/modules/dancer-app/** imports a dead or legacy
 *       dancer screen (FORBIDDEN_IMPORTS) -- matched on import SPECIFIERS, not on
 *       words, so a comment or a string that names one is not a violation;
 *   (c) nothing outside the seam files imports from the dancer-app module
 *       (tests are exempt: they exist to import it).
 *
 * (a) and (b) run only on a DANCER-AREA PR, one that changes at least one file
 * under src/modules/dancer-app/; any other PR runs (c) only. The first output
 * line after the base note names the mode that ran.
 *
 * The seam and protected lists live in ONE file, scripts/dancer-area-isolation-allowlist.json,
 * exposed here as RULES. THE SOURCE OF TRUTH IS briefs/dancer-rebuild-INTERFACE.md
 * section 5 (+ Round-3) on branch arc/briefs-dancer-rebuild; the orchestrator mirrors
 * the JSON there. Adding a seam is an orchestrator decision, never a code edit here.
 *
 * "Base" is the merge-base of the base ref (default origin/main, override with
 * DANCER_ISOLATION_BASE) and HEAD, so a branch that has fallen behind main is
 * not blamed for main's own changes. The diff includes uncommitted and
 * untracked files, so the check also runs honestly in a working tree.
 *
 * Exit codes: 0 clean, 1 an isolation rule is violated, 2 the check could not
 * measure (no git, base ref missing, a listed file unreadable). Never 0 when it
 * could not look.
 *
 *   node scripts/check-dancer-area-isolation.mjs
 *   node scripts/check-dancer-area-isolation.mjs --self-test
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** The ONE copy of the allow-list. Unreadable or malformed = the check cannot measure (exit 2). */
const ALLOWLIST_FILE = 'dancer-area-isolation-allowlist.json';
const loadAllowlist = () => {
  try {
    const raw = JSON.parse(readFileSync(path.join(REPO_ROOT, 'scripts', ALLOWLIST_FILE), 'utf8'));
    for (const k of ['docPrefixes', 'seams', 'protected']) {
      if (!Array.isArray(raw[k]) || !raw[k].every((x) => typeof x === 'string' && x !== '')) throw new Error(`${k} is not a list of paths`);
    }
    return raw;
  } catch (err) {
    console.error(`dancer-area isolation: could not read scripts/${ALLOWLIST_FILE}: ${err.message}`);
    process.exit(2);
  }
};
const ALLOWLIST = loadAllowlist();

/**
 * The lists. Mirrors briefs/dancer-rebuild-INTERFACE.md section 5.
 * A trailing `*` in a segment (e.g. RsvpBlock*.tsx) matches any characters in that segment.
 */
export const RULES = {
  /** The rebuild's own folder: free to change. */
  DANCER_APP_DIR: 'src/modules/dancer-app',
  /** Test code is free to change and free to import the module. */
  TEST_PREFIXES: ['tests/'],
  /**
   * The allow-list (doc prefixes, SEAMS, PROTECTED) lives in ONE place, the JSON file
   * below (review S10): this script names no allowed path in code, and
   * tests/client/dancerAppReviewFixes.test.ts fails if it starts to.
   */
  DOC_PREFIXES: ALLOWLIST.docPrefixes,
  SEAMS: ALLOWLIST.seams,
  PROTECTED: ALLOWLIST.protected,
  /** Rule (b): import specifiers (last path segment) the dancer-app folder must never use. */
  FORBIDDEN_IMPORTS: [
    'DancerDashboard',
    'EditProfile',
    'Onboarding',
    'Profile',
    'FinishProfile',
    'DancerHome',
    'DancerProfileGate',
    'EventAttendanceButtons',
  ],
  /** Rule (c): where to look for importers of the module. */
  SCAN_ROOTS: ['src', 'app', 'api'],
  SCAN_FILES: ['middleware.ts'],
};

const SOURCE_EXT = /\.(?:[cm]?[jt]sx?)$/;
const norm = (p) => p.split(path.sep).join('/');

const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

/** `RsvpBlock*.tsx` -> RegExp over a whole repo-relative path. */
const globToRegExp = (glob) => new RegExp('^' + glob.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');

/** Import specifiers in a source text: static, re-export, dynamic and require. Comments are stripped first. */
export const importSpecifiers = (source) => {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[\s;{}])\/\/.*$/gm, '$1');
  const specs = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\s+from\s+)?['"]([^'"\n]+)['"]/g,
    /\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\brequire\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  ];
  for (const re of patterns) for (const m of text.matchAll(re)) specs.push(m[1]);
  return specs;
};

/** A specifier -> the repo-relative path it points at (no extension resolution), or null for a package. */
const resolveSpecifier = (spec, fromFile) => {
  if (spec.startsWith('@/')) return 'src/' + spec.slice(2);
  if (spec.startsWith('.')) return norm(path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec)));
  return null;
};

const lastSegment = (spec) => {
  const parts = spec.replace(/\.(?:[cm]?[jt]sx?)$/, '').split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  return last === 'index' && parts.length > 1 ? parts[parts.length - 2] : last;
};

const walk = (root, rel) => {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name === '.git') continue;
    const childRel = norm(path.join(rel, name));
    const st = statSync(path.join(root, childRel));
    if (st.isDirectory()) out.push(...walk(root, childRel));
    else if (SOURCE_EXT.test(name)) out.push(childRel);
  }
  return out;
};

const isTestPath = (rel, rules) => rules.TEST_PREFIXES.some((p) => rel.startsWith(p)) || /(^|\/)__tests__\//.test(rel) || /\.test\.[cm]?[jt]sx?$/.test(rel);

/** The changed paths (committed since the merge-base, staged, unstaged, untracked), repo-relative. */
const changedFiles = (root, mergeBase) => {
  const tracked = git(root, ['diff', '--name-only', '--no-renames', mergeBase]).split('\n');
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard']).split('\n');
  return [...new Set([...tracked, ...untracked].map((s) => s.trim()).filter(Boolean))].sort();
};

/** Expand the PROTECTED list against the base tree. A glob that matches nothing is a configuration error (infra). */
const expandProtected = (root, mergeBase, rules) => {
  const baseTree = git(root, ['ls-tree', '-r', '--name-only', mergeBase]).split('\n').filter(Boolean);
  const expanded = [];
  const missing = [];
  for (const entry of rules.PROTECTED) {
    const re = globToRegExp(entry);
    const hits = baseTree.filter((p) => re.test(p));
    if (hits.length === 0) missing.push(entry);
    expanded.push(...hits);
  }
  return { expanded: [...new Set(expanded)], missing };
};

/** Pure core: returns { code, violations[], notes[] }. */
export const runCheck = ({ root = REPO_ROOT, base = process.env.DANCER_ISOLATION_BASE || 'origin/main', rules = RULES } = {}) => {
  const violations = [];
  const notes = [];
  let mergeBase;
  try {
    mergeBase = git(root, ['merge-base', base, 'HEAD']).trim();
  } catch (error) {
    return { code: 2, violations, notes: [`COULD NOT MEASURE: no merge-base between ${base} and HEAD (${String(error.stderr || error.message).trim()}). In CI, fetch the base first: git fetch origin main.`] };
  }
  if (!mergeBase) return { code: 2, violations, notes: [`COULD NOT MEASURE: empty merge-base for ${base}.`] };

  let changed;
  let protectedFiles;
  try {
    changed = changedFiles(root, mergeBase);
    const p = expandProtected(root, mergeBase, rules);
    if (p.missing.length > 0) return { code: 2, violations, notes: [`COULD NOT MEASURE: protected entries match no file on ${base}: ${p.missing.join(', ')}. INTERFACE section 5 and RULES have drifted.`] };
    protectedFiles = p.expanded;
  } catch (error) {
    return { code: 2, violations, notes: [`COULD NOT MEASURE: git failed (${String(error.stderr || error.message).trim()}).`] };
  }
  // Rules (a) and (b) police a DANCER-AREA PR (one that changes a file under the folder):
  // they stop dancer work leaking into the public site. An ordinary site PR (legal pages,
  // nav) runs rule (c) only, which guards the boundary from both sides (brief
  // isolation-scope-fix, 2026-10-15). (b) is lossless to skip: it reads only folder files,
  // and a PR that changes none of them leaves them as the base already passed them.
  const appDir = rules.DANCER_APP_DIR + '/';
  const dancerAreaPr = changed.some((f) => f.startsWith(appDir));
  notes.push(`base ${base} @ ${mergeBase.slice(0, 10)}; ${changed.length} changed file(s); ${dancerAreaPr ? `${protectedFiles.length} protected file(s) checked` : 'protected files not checked'}.`);
  notes.push(dancerAreaPr ? 'dancer-area PR: rules a+b+c' : 'not a dancer-area PR: rule c only');
  const seams = new Set(rules.SEAMS);

  if (dancerAreaPr) {
    // (a) protected files byte-identical; changed files outside the folder / tests / docs must be seams.
    const changedSet = new Set(changed);
    for (const file of protectedFiles) {
      if (changedSet.has(file)) violations.push(`(a) PROTECTED file changed: ${file}`);
    }
    const protectedSet = new Set(protectedFiles);
    for (const file of changed) {
      if (file.startsWith(rules.DANCER_APP_DIR + '/')) continue;
      if (rules.TEST_PREFIXES.some((p) => file.startsWith(p))) continue;
      if (rules.DOC_PREFIXES.some((p) => file.startsWith(p))) continue;
      if (seams.has(file)) continue;
      if (protectedSet.has(file)) continue; // already reported as protected
      violations.push(`(a) changed file is neither inside ${rules.DANCER_APP_DIR}/, nor a test, nor a seam: ${file}`);
    }

    // (b) the folder imports no legacy dancer screen.
    const forbidden = new Set(rules.FORBIDDEN_IMPORTS);
    for (const file of walk(root, rules.DANCER_APP_DIR)) {
      for (const spec of importSpecifiers(readFileSync(path.join(root, file), 'utf8'))) {
        const target = resolveSpecifier(spec, file);
        if (target !== null && (target + '/').startsWith(appDir)) continue; // inside the folder
        const name = lastSegment(spec);
        if (forbidden.has(name)) violations.push(`(b) ${file} imports "${spec}" (${name} is off limits to the dancer app)`);
      }
    }
  }

  // (c) nothing outside the seams imports the module.
  const scanned = new Set();
  for (const r of rules.SCAN_ROOTS) for (const f of walk(root, r)) scanned.add(f);
  for (const f of rules.SCAN_FILES) if (existsSync(path.join(root, f))) scanned.add(f);
  for (const file of [...scanned].sort()) {
    if (file.startsWith(appDir) || isTestPath(file, rules) || seams.has(file)) continue;
    for (const spec of importSpecifiers(readFileSync(path.join(root, file), 'utf8'))) {
      const target = resolveSpecifier(spec, file);
      if (target !== null && (target === rules.DANCER_APP_DIR || (target + '/').startsWith(appDir))) {
        violations.push(`(c) ${file} imports "${spec}" from the dancer-app module and is not a seam file`);
      }
    }
  }

  return { code: violations.length > 0 ? 1 : 0, violations, notes };
};

// ---------------------------------------------------------------------------
// --self-test: a throwaway git repo where every rule is broken on purpose.
// ---------------------------------------------------------------------------

const gitIn = (dir, ...args) => git(dir, ['-c', 'user.name=selftest', '-c', 'user.email=selftest', '-c', 'commit.gpgsign=false', ...args]);

const write = (dir, rel, body = '// x\n') => {
  mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  writeFileSync(path.join(dir, rel), body);
};

/**
 * No real PROTECTED entry is a glob since #789 (its RsvpBlock*.tsx files became seams, orchestrator
 * decision 2026-10-16), so the self-test adds this fixture-only one to keep proving trailing-`*` matching.
 */
const SELF_TEST_GLOB = 'src/fixture/Guarded*.tsx';

const concretePath = (entry) => entry.replace('*', entry.includes('RsvpBlock') ? '' : 'x');

const buildFixture = (rules) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'dancer-isolation-'));
  gitIn(dir, 'init', '-q', '-b', 'main');
  for (const entry of rules.PROTECTED) write(dir, concretePath(entry), `// ${entry}\n`);
  write(dir, 'src/components/profile/RsvpBlockExtra.txt', 'unrelated\n');
  write(dir, 'src/fixture/GuardedSibling.tsx', '// sibling\n');
  for (const entry of rules.SEAMS) if (!entry.startsWith('tests/')) write(dir, entry, `// ${entry}\n`);
  write(dir, 'src/pages/Other.tsx', 'export const Other = 1;\n');
  write(dir, 'src/pages/Home.tsx', "import { Other } from './Other';\nexport const Home = Other;\n");
  write(dir, 'src/pages/DancerHome.tsx', 'export const DancerHome = 1;\n');
  write(dir, 'src/pages/Privacy.tsx', 'export const Privacy = 1;\n');
  write(dir, `${rules.DANCER_APP_DIR}/seed.tsx`, 'export const seed = 1;\n');
  gitIn(dir, 'add', '-A');
  gitIn(dir, 'commit', '-q', '-m', 'base');
  gitIn(dir, 'branch', 'base');
  gitIn(dir, 'checkout', '-q', '-b', 'topic');
  return dir;
};

const reset = (dir) => {
  gitIn(dir, 'reset', '-q', '--hard', 'base');
  gitIn(dir, 'clean', '-q', '-fd');
};

/** Drives main() end to end (not just runCheck) so the EXIT CODES are what is proven. */
const selfTest = async () => {
  const rules = { ...RULES, PROTECTED: [...RULES.PROTECTED, SELF_TEST_GLOB] };
  const dir = buildFixture(rules);
  let failed = 0;
  const cases = [];
  const expectExit = (name, expected, setup, mustMention) => cases.push({ name, expected, setup, mustMention });

  expectExit('clean branch with a new file inside the folder', 0, (d) => write(d, `${rules.DANCER_APP_DIR}/shell/App.tsx`, "import { x } from './helper';\nexport const a = x;\n"));
  expectExit('a seam may change', 0, (d) => write(d, 'src/components/AnimatedRoutes.tsx', '// changed seam\n'));
  expectExit('a test may change and import the module', 0, (d) => write(d, 'tests/dancerApp.test.ts', "import '@/modules/dancer-app/shell/App';\n"));
  expectExit('a handover doc may be added', 0, (d) => write(d, 'docs/handover/x.md', '# x\n'));
  expectExit('a seam may import the module (lazy route)', 0, (d) => write(d, 'src/components/AnimatedRoutes.tsx', "const A = () => import('@/modules/dancer-app/shell/App');\n"));
  expectExit('a forbidden NAME in a comment or string is not an import', 0, (d) =>
    write(d, `${rules.DANCER_APP_DIR}/shell/App.tsx`, '// do not import DancerHome from "@/components/account/DancerHome"\nexport const s = "import x from \'./FinishProfile\'";\n'),
  );
  expectExit('a local file named like a forbidden screen, inside the folder, is fine', 0, (d) =>
    write(d, `${rules.DANCER_APP_DIR}/screens/me/App.tsx`, "import { P } from './Profile';\n") ,
  );

  // Rules (a)+(b) only run when the PR changes a folder file; `inArea` makes a case one.
  const inArea = (d) => write(d, `${rules.DANCER_APP_DIR}/x.tsx`, 'export const x = 1;\n');
  expectExit('not a dancer-area PR: only src/pages/Privacy.tsx changes', 0, (d) => write(d, 'src/pages/Privacy.tsx', 'export const Privacy = 2;\n'), 'not a dancer-area PR: rule c only');
  expectExit('not a dancer-area PR: a protected file may change', 0, (d) => write(d, 'src/pages/Account.tsx', '// ordinary site edit\n'), 'not a dancer-area PR: rule c only');
  expectExit('dancer-area PR: the mode line says so', 0, inArea, 'dancer-area PR: rules a+b+c');
  expectExit('(a) dancer-area PR: src/modules/dancer-app/x.tsx + src/pages/Other.tsx', 1, (d) => {
    inArea(d);
    write(d, 'src/pages/Other.tsx', 'export const Other = 2;\n');
  }, 'src/pages/Other.tsx');
  expectExit('(a) dancer-area PR: deleting a folder file still counts', 1, (d) => {
    write(d, 'src/pages/Other.tsx', 'export const Other = 2;\n');
    rmSync(path.join(d, `${rules.DANCER_APP_DIR}/seed.tsx`));
  }, 'src/pages/Other.tsx');

  for (const entry of rules.PROTECTED) {
    const file = concretePath(entry);
    expectExit(`(a) protected file edited: ${file}`, 1, (d) => {
      inArea(d);
      write(d, file, '// tampered\n');
    }, file);
  }
  expectExit('(a) protected file deleted', 1, (d) => {
    inArea(d);
    rmSync(path.join(d, 'src/pages/Account.tsx'));
  }, 'src/pages/Account.tsx');
  expectExit('(a) protected glob: a sibling Guarded*.tsx edited', 1, (d) => {
    inArea(d);
    write(d, 'src/fixture/GuardedSibling.tsx', '// tampered\n');
  }, 'GuardedSibling.tsx');
  expectExit('(a) non-seam file added', 1, (d) => {
    inArea(d);
    write(d, 'src/lib/newThing.ts', 'export {};\n');
  }, 'src/lib/newThing.ts');
  expectExit('(a) staged-then-committed change is still seen', 1, (d) => {
    inArea(d);
    write(d, 'src/pages/Other.tsx', 'export const Other = 3;\n');
    gitIn(d, 'add', '-A');
    gitIn(d, 'commit', '-q', '-m', 'sneaky');
  }, 'src/pages/Other.tsx');

  for (const name of rules.FORBIDDEN_IMPORTS) {
    expectExit(`(b) dancer-app imports ${name} (alias)`, 1, (d) => write(d, `${rules.DANCER_APP_DIR}/shell/App.tsx`, `import { X } from '@/pages/${name}';\n`), name);
  }
  expectExit('(b) relative import of a legacy screen', 1, (d) => write(d, `${rules.DANCER_APP_DIR}/shell/App.tsx`, "import X from '../../../components/account/DancerHome';\n"), 'DancerHome');
  expectExit('(b) dynamic import of a legacy screen', 1, (d) => write(d, `${rules.DANCER_APP_DIR}/shell/App.tsx`, "const X = () => import('@/pages/FinishProfile');\n"), 'FinishProfile');
  expectExit('(b) multi-line named import', 1, (d) => write(d, `${rules.DANCER_APP_DIR}/shell/App.tsx`, "import {\n  a,\n  b,\n} from '@/components/profile/DancerDashboard';\n"), 'DancerDashboard');
  expectExit('(b) re-export', 1, (d) => write(d, `${rules.DANCER_APP_DIR}/shell/App.tsx`, "export { default } from '@/pages/EditProfile';\n"), 'EditProfile');
  expectExit('(b) index barrel of a legacy screen', 1, (d) => write(d, `${rules.DANCER_APP_DIR}/shell/App.tsx`, "import X from '@/components/account/DancerHome/index';\n"), 'DancerHome');

  expectExit('(c) not a dancer-area PR: src/pages/Other.tsx imports src/modules/dancer-app/x', 1, (d) => write(d, 'src/pages/Other.tsx', "import { x } from '@/modules/dancer-app/x';\n"), 'src/pages/Other.tsx');
  expectExit('(c) a page imports the module (alias)', 1, (d) => write(d, 'src/pages/Home.tsx', "import { A } from '@/modules/dancer-app/shell/App';\n"), 'src/pages/Home.tsx');
  expectExit('(c) a page imports the module (relative)', 1, (d) => write(d, 'src/pages/Home.tsx', "import { A } from '../modules/dancer-app/shell/App';\n"), 'src/pages/Home.tsx');
  expectExit('(c) a page imports the module (dynamic)', 1, (d) => write(d, 'src/pages/Home.tsx', "const A = () => import('@/modules/dancer-app');\n"), 'src/pages/Home.tsx');
  expectExit('(c) app/ route imports the module', 1, (d) => write(d, 'app/routes/x.tsx', "import { A } from '@/modules/dancer-app/shell/App';\n"), 'app/routes/x.tsx');

  // Infrastructure: a base that does not exist must be 2, never 0.
  const infra = { name: 'infra: base ref does not exist', expected: 2, base: 'no-such-ref' };

  const run = async (base, d) => {
    const lines = [];
    const code = await main([], { root: d, base, rules, out: (l) => lines.push(l), err: (l) => lines.push(l) });
    return { code, text: lines.join('\n') };
  };

  try {
    for (const c of cases) {
      reset(dir);
      c.setup(dir);
      const { code, text } = await run('base', dir);
      const ok = code === c.expected && (c.mustMention === undefined || text.includes(c.mustMention));
      if (!ok) {
        failed += 1;
        console.error(`  FAIL ${c.name}: expected exit ${c.expected}${c.mustMention ? ` naming ${c.mustMention}` : ''}, got ${code}\n${text.split('\n').map((l) => '       ' + l).join('\n')}`);
      } else {
        console.log(`  ok   ${c.name} (exit ${code})`);
      }
    }
    reset(dir);
    const { code } = await run(infra.base, dir);
    if (code !== infra.expected) {
      failed += 1;
      console.error(`  FAIL ${infra.name}: expected exit ${infra.expected}, got ${code}`);
    } else {
      console.log(`  ok   ${infra.name} (exit ${code})`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(failed === 0 ? `self-test: ${cases.length + 1} cases, all behave` : `self-test: ${failed} case(s) FAILED`);
  return failed === 0;
};

/** The exit-code owner. `deps` lets the canary drive it with a throwaway repo and captured output. */
export async function main(argv = [], deps = {}) {
  const { root = REPO_ROOT, base = process.env.DANCER_ISOLATION_BASE || 'origin/main', rules = RULES, out = console.log, err = console.error } = deps ?? {};
  const known = ['--self-test'];
  const unknown = argv.filter((a) => !known.includes(a));
  if (unknown.length > 0) {
    err(`Unknown flag(s): ${unknown.join(', ')}. Known: ${known.join(', ')}`);
    return 2;
  }
  if (argv.includes('--self-test')) return (await selfTest()) ? 0 : 1;

  const result = runCheck({ root, base, rules });
  for (const note of result.notes) (result.code === 2 ? err : out)(note);
  if (result.code === 1) {
    err(`dancer-area isolation: ${result.violations.length} violation(s)`);
    for (const v of result.violations) err('  ' + v);
    err('See briefs/dancer-rebuild-INTERFACE.md section 5; the lists are RULES at the top of scripts/check-dancer-area-isolation.mjs.');
  } else if (result.code === 0) {
    out('dancer-area isolation: OK');
  }
  return result.code;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
