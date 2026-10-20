#!/usr/bin/env node
// Docs-only PR classifier. Prints `docs_only=true|false` (stdout, and
// $GITHUB_OUTPUT when set). Used by the required-check workflows to skip their
// heavy STEPS on a PR that changes only documentation; the jobs themselves
// still run, so the required check names still report success.
//
// Docs-only = EVERY changed path is under docs/, .claude/ or plans/, or is a
// markdown file outside the directories that can ship or drive code (RULES).
// Fail safe: anything we cannot compute or recognise is NOT docs-only.
//
//   node scripts/ci/docs-only.mjs                      paths on stdin, one per line
//   node scripts/ci/docs-only.mjs --merge <sha>        diff <sha>^1..<sha> (the PR merge commit)
//   node scripts/ci/docs-only.mjs --base <a> --head <b>  diff two shas
//   node scripts/ci/docs-only.mjs --self-test          table + per-rule mutation proof
// Only EVENT_NAME=pull_request may skip (unset = treated as a PR for local use).
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { isEntryPoint } from '../lib/entry-point.mjs';

// Markdown under these can ship, or is read by code/tests, so is NOT docs.
const MD_EXCLUDED = ['src/', 'public/', '.github/', 'scripts/', 'tests/', 'app/'];

// One entry per arm; the self-test removes each in turn and demands a failure.
export const RULES = [
  { name: 'docs/', allow: (p) => p.startsWith('docs/') },
  { name: '.claude/', allow: (p) => p.startsWith('.claude/') },
  { name: 'plans/', allow: (p) => p.startsWith('plans/') },
  ...MD_EXCLUDED.map((dir) => ({ name: `md-excluded:${dir}`, veto: (p) => p.startsWith(dir) })),
  { name: '**/*.md', allow: (p) => /\.md$/i.test(p) },
  {
    name: 'sane-path',
    veto: (p) => p === '' || p.startsWith('/') || p.startsWith('"') || p.split('/').includes('..'),
    vetoAll: true,
  },
];

// A veto applies to the markdown arm only, except `vetoAll` (path sanity).
function classify(p, rules) {
  if (rules.some((r) => r.vetoAll && r.veto(p))) return false;
  for (const r of rules) {
    if (!r.allow) continue;
    if (r.name === '**/*.md') {
      if (r.allow(p) && !rules.some((v) => v.veto && !v.vetoAll && v.veto(p))) return true;
    } else if (r.allow(p)) return true;
  }
  return false;
}

export function isDocsOnly(paths, rules = RULES) {
  if (!Array.isArray(paths) || paths.length === 0) return false;
  return paths.every((p) => typeof p === 'string' && classify(p, rules));
}

const CASES = [
  ['empty list', [], false],
  ['one md', ['README.md'], true],
  ['md in src', ['src/components/README.md'], false],
  ['md in public', ['public/llms.md'], false],
  ['md in .github', ['.github/PULL_REQUEST_TEMPLATE.md'], false],
  ['md in scripts', ['scripts/NOTES.md'], false],
  ['md in tests', ['tests/fixtures/a.md'], false],
  ['md in app', ['app/routes/a.md'], false],
  ['docs image', ['docs/img/shot.png'], true],
  ['docs nested', ['docs/handover/x.yml'], true],
  ['package.json', ['package.json'], false],
  ['lockfile', ['package-lock.json'], false],
  ['workflow file', ['.github/workflows/unit-tests.yml'], false],
  ['mixed docs + code', ['docs/a.md', 'src/a.ts'], false],
  ['.claude', ['.claude/rules/x.md', '.claude/settings.json'], true],
  ['plans', ['plans/p1.txt'], true],
  ['uppercase .MD', ['NOTES.MD'], true],
  ['path with spaces', ['docs/my notes/a b.md'], true],
  ['deleted code file', ['src/old.ts'], false],
  ['deleted doc file', ['docs/old.md'], true],
  ['rename code -> docs', ['src/a.ts', 'docs/a.ts'], false],
  ['rename doc -> doc', ['docs/a.md', 'docs/b.md'], true],
  ['traversal', ['docs/../src/a.ts'], false],
  ['absolute path', ['/docs/a.md'], false],
  ['quoted path', ['"docs/caf\\303\\251.md"'], false],
  ['empty path string', [''], false],
  ['docs prefix lookalike', ['docsx/a.md.ts'], false],
];

export function runCases(rules = RULES) {
  return CASES.filter(([, paths, want]) => isDocsOnly(paths, rules) !== want).map(([n]) => n);
}

function selfTest() {
  let bad = 0;
  const fails = runCases();
  for (const n of fails) { console.error(`FAIL case: ${n}`); bad++; }
  for (const r of RULES) {
    const mutant = RULES.filter((x) => x !== r);
    if (runCases(mutant).length === 0) { console.error(`FAIL mutant survived: rule "${r.name}" removed, table still green`); bad++; }
  }
  console.log(`docs-only self-test: ${CASES.length} cases, ${RULES.length} mutants, ${bad ? bad + ' FAILURES' : 'ok'}`);
  return bad === 0;
}

function git(args) {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function changedPaths(argv) {
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  let range;
  if (opt('--merge')) {
    const sha = opt('--merge');
    git(['fetch', '--no-tags', '--depth=2', 'origin', sha]);
    range = [`${sha}^1`, sha];
  } else if (opt('--base') && opt('--head')) {
    git(['fetch', '--no-tags', '--depth=1', 'origin', opt('--base'), opt('--head')]);
    range = [opt('--base'), opt('--head')];
  } else {
    return readFileSync(0, 'utf8').split('\n').filter((l) => l !== '');
  }
  // --no-renames: a rename lists BOTH paths, so src/a.ts -> docs/a.ts is not docs-only.
  return git(['diff', '--name-only', '--no-renames', ...range]).split('\n').filter((l) => l !== '');
}

function emit(v) {
  const line = `docs_only=${v}`;
  console.log(line);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line + '\n');
}

if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
  let result = false;
  try {
    const ev = process.env.EVENT_NAME;
    if (ev === undefined || ev === 'pull_request') result = isDocsOnly(changedPaths(argv));
  } catch (e) {
    console.error(`docs-only: could not compute changed files (${e.message}); running everything`);
  }
  emit(result);
}
