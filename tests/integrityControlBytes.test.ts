/**
 * integrityControlBytes.test.ts -- CI home for the control-byte scan, which has
 * TWO entry points: scripts/integrity-guard.py (the lint chain and CI) and
 * scripts/check-source-integrity.cjs (the scanner .githooks/pre-commit runs, so
 * the one a corrupt byte meets FIRST). They share a rule, not an implementation.
 * The commit-side scanner is therefore the real floor: if its corpus is the
 * narrower of the two, the guard's extra reach is advisory. Both are asserted
 * here, in both directions.
 *
 * Origin: scripts/check-image-widths.mjs shipped to main carrying a raw 0x08
 * at byte 9117. The mount had eaten the backslash out of a word-boundary
 * escape, leaving an actual backspace character in committed source. Every
 * layer waved it through -- node --check parses it, eslint parses it, and the
 * integrity guard only ever looked for null bytes and truncation. Injecting a
 * 0x08 into a copy and running the scanner reported "897 files checked, 0
 * issues".
 *
 * The guard is a static scanner, so rule R4 of check-script-conventions wants
 * proof it can fail. These specs drive the real script over real fixtures and
 * assert BOTH directions -- a clean file stays green, a poisoned one goes red
 * -- because a scanner that cannot fail is indistinguishable from one that
 * found nothing.
 *
 * NOTE: every control byte below is built with String.fromCharCode. Writing
 * them as escapes would put the exact corruption target into this spec, and
 * the mount that eats backslashes could rewrite one into a literal that
 * silently still passes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const GUARD = join(REPO_ROOT, 'scripts', 'integrity-guard.py');

const ALLOWED = new Set([0x09, 0x0a, 0x0d]);

const ESC = String.fromCharCode(0x1b);
const BACKSPACE = String.fromCharCode(0x08);
const VTAB = String.fromCharCode(0x0b);
const DEL = String.fromCharCode(0x7f);

const CANARY_DIR = '.integrity-canary';
mkdirSync(join(REPO_ROOT, CANARY_DIR), { recursive: true });
afterAll(() => rmSync(join(REPO_ROOT, CANARY_DIR), { recursive: true, force: true }));

type GuardIssue = { path: string; line: number; code: string; reason: string };
type GuardResult = { checked: number; issues: GuardIssue[]; ok: boolean };

function runPython(args: string[]): string {
  try {
    return execFileSync('python3', [GUARD, ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, PYTHONUTF8: '1' },
    });
  } catch (err) {
    // Exit 1 is the guard's "corruption detected" signal, not a harness failure.
    const e = err as { status?: number; stdout?: string };
    if (e.status !== 1 || !e.stdout) throw err;
    return e.stdout;
  }
}

/**
 * Drive the real guard over a fixture. Fixtures must live under the repo root:
 * --files filters to paths resolving inside it, so a tmpdir path would be
 * silently dropped and every assertion would pass against zero files checked.
 */
function runGuard(name: string, body: Buffer): GuardResult {
  const rel = `${CANARY_DIR}/${name}`;
  writeFileSync(join(REPO_ROOT, rel), body);
  const parsed = JSON.parse(runPython(['--files', rel, '--json', '--no-self-check'])) as GuardResult;
  expect(parsed.checked, `guard checked no files for ${rel}`).toBe(1);
  return parsed;
}

const ctrlIssues = (r: GuardResult) => r.issues.filter((i) => i.code === 'CTRL');

/** The files the guard itself says it scans -- not a second extension list. */
function guardCorpus(): string[] {
  return runPython(['--list-corpus', '--no-self-check'])
    .split(/\r?\n/)
    .filter(Boolean);
}

describe('integrity guard: raw control bytes', () => {
  it('fires on the 0x08 that actually shipped to main', () => {
    const result = runGuard('incident.mjs', Buffer.from(`const re = /a${BACKSPACE}b/;\n`, 'binary'));
    expect(ctrlIssues(result)).toHaveLength(1);
    expect(result.ok).toBe(false);
    expect(ctrlIssues(result)[0].reason).toContain('0x08');
  });

  it('fires on a raw ESC left behind by an eaten x1b escape', () => {
    const result = runGuard('ansi.mjs', Buffer.from(`const RED = '${ESC}[31m';\n`, 'binary'));
    expect(ctrlIssues(result)).toHaveLength(1);
    expect(ctrlIssues(result)[0].reason).toContain('0x1b');
  });

  it('fires on vertical tab and DEL, the bytes no parser objects to', () => {
    expect(ctrlIssues(runGuard('vtab.mjs', Buffer.from(`const a = 1;${VTAB}\n`, 'binary')))).toHaveLength(1);
    expect(ctrlIssues(runGuard('del.mjs', Buffer.from(`const a = 1;${DEL}\n`, 'binary')))).toHaveLength(1);
  });

  it('reports the line the byte sits on, not just its offset', () => {
    const body = Buffer.from(`line one\nline two\nthree${BACKSPACE}\n`, 'binary');
    expect(ctrlIssues(runGuard('lineno.md', body))[0].line).toBe(3);
  });

  it('stays silent on tab, LF and CRLF -- the legitimate control bytes', () => {
    const result = runGuard('legit.mjs', Buffer.from('const a = {\r\n\tb: 1,\r\n};\r\n', 'binary'));
    expect(ctrlIssues(result)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('stays silent on multi-byte UTF-8, whose bytes are not control bytes', () => {
    // Built from raw bytes rather than a literal: this repo keeps source ASCII,
    // so a pasted non-ASCII character here would itself be the mojibake class
    // the sibling scan exists for. 0xc3 0xa9 is U+00E9. An earlier version of
    // this spec passed an ASCII-only body, so it asserted nothing about
    // continuation bytes and merely duplicated the tab/LF/CRLF spec above.
    const body = Buffer.concat([
      Buffer.from('const s = "caf', 'binary'),
      Buffer.from([0xc3, 0xa9]),
      Buffer.from('";\n', 'binary'),
    ]);
    expect(ctrlIssues(runGuard('utf8.mjs', body))).toEqual([]);
  });
});

describe('integrity guard: the live tree', () => {
  // The guard sweeps the whole tree in the `lint` chain already, and repeating
  // its parser phases here cost ~34s of node --check subprocesses. So this spec
  // does the byte scan in-process -- but it asks the GUARD which files are in
  // scope rather than keeping a second extension list. An earlier draft mirrored
  // SOURCE_EXTS here and claimed a scanned>500 floor would catch drift; with a
  // ~900-file corpus that floor had 400 files of slack, and deleting `mjs` (119
  // files, the incident's own extension) from the mirror left all 7 specs green.
  // A guard corpus that can silently shrink is the failure this file exists for.
  it('scans every tracked file of every extension it claims to cover', () => {
    const guardFiles = new Set(guardCorpus());
    const tracked = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter((p) => p && existsSync(join(REPO_ROOT, p)));

    // Derive the claimed extensions from the corpus itself, then assert the
    // corpus is CLOSED over them: if the guard scans one .json it must scan
    // every tracked .json. A shrink that drops an extension wholesale is caught
    // by the floor below; this catches a partial or filtered shrink.
    const claimed = new Set(
      [...guardFiles].map((p) => p.slice(p.lastIndexOf('.')).toLowerCase()).filter((e) => e.startsWith('.')),
    );
    // Mirrors SKIP_PATTERNS in the guard: deliberate exclusions, not drift.
    // These are gitignored-but-tracked artefacts and build output.
    const DELIBERATELY_SKIPPED =
      /^(test-results|node_modules|dist|build|playwright-report)\/|^\.claude\/worktrees\/|^supabase\/\.temp\//;
    const missing = tracked.filter(
      (p) =>
        claimed.has(p.slice(p.lastIndexOf('.')).toLowerCase()) &&
        !guardFiles.has(p) &&
        !DELIBERATELY_SKIPPED.test(p),
    );
    expect(missing).toEqual([]);

    // Every extension the incident classes touch must actually be represented.
    // Dropping one from SOURCE_EXTS removes it from `claimed` too, so the
    // closure check above goes quiet -- this is what notices instead.
    for (const ext of ['.ts', '.tsx', '.mjs', '.cjs', '.js', '.json', '.py', '.sh', '.yml', '.md', '.sql']) {
      expect(claimed, `guard no longer scans any ${ext} file`).toContain(ext);
    }

    // EXTENSIONLESS_SOURCE contributes no extension to `claimed`, so deleting it
    // drops those files from the corpus AND from the closure check above, and
    // both go quiet together. Proven by mutation: emptying the list left every
    // spec green while the guard silently stopped scanning the very hook that
    // ENFORCES it. Name the files instead.
    for (const rel of ['.githooks/pre-commit', '.githooks/pre-push', '.gitattributes']) {
      expect(guardFiles, `guard no longer scans ${rel}`).toContain(rel);
    }
  });

  it('the COMMIT floor is never weaker than the CI guard', () => {
    // .githooks/pre-commit runs check-source-integrity.cjs, so THAT scanner --
    // not this guard -- is what a corrupt byte meets first. If its corpus is the
    // narrower of the two, it defines the real floor and the guard's rule is
    // advisory for anything outside it. It was: the guard was widened to .py and
    // to extensionless files while the commit scanner still skipped both, so an
    // eaten escape in scripts/safe-write.py -- the write path every other guard
    // depends on -- committed clean and was caught only later, by CI.
    const commitCorpus = new Set(
      execFileSync('node', ['scripts/check-source-integrity.cjs', '--list-corpus'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      })
        .split(/\r?\n/)
        .filter(Boolean),
    );
    const uncovered = guardCorpus().filter((p) => !commitCorpus.has(p));
    expect(uncovered, 'files the CI guard scans but the commit hook does not').toEqual([]);
  });

  it('the commit scanner itself rejects a poisoned .py, naming every offender', () => {
    // The corpus spec above proves the commit gate LOOKS at these files; this
    // proves it ACTS on them. The two scanners share a rule, not an
    // implementation, so the cjs predicate needs its own both-directions proof.
    //
    // Driven through a THROWAWAY index (GIT_INDEX_FILE), so the real staged set
    // is untouched: against a fresh index every other tracked file reads as
    // deleted, and --diff-filter=ACM drops deletions, leaving just the fixture.
    const rel = `${CANARY_DIR}/poison.py`;
    writeFileSync(join(REPO_ROOT, rel), Buffer.from(`# one\nx = 1${BACKSPACE}\ny = 2${ESC}\n`, 'binary'));
    const env = { ...process.env, GIT_INDEX_FILE: join(REPO_ROOT, CANARY_DIR, 'tmpidx') };
    execFileSync('git', ['add', '-f', rel], { cwd: REPO_ROOT, env });

    let status = 0;
    let out = '';
    try {
      out = execFileSync('node', ['scripts/check-source-integrity.cjs', '--staged'], {
        cwd: REPO_ROOT,
        env,
        encoding: 'utf8',
      });
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      status = e.status ?? 0;
      out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }

    expect(status, 'the commit gate accepted a poisoned .py').toBe(1);
    expect(out).toContain('0x08');
    expect(out).toContain('0x1b');
    // One line per offender: reporting only the first offender's line beside a
    // list of byte offsets leaves the rest to be found by hand.
    expect(out).toContain('(line 2)');
    expect(out).toContain('(line 3)');
  });

  it('carries no raw control bytes in tracked source', () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const rel of guardCorpus()) {
      const abs = join(REPO_ROOT, rel);
      if (!existsSync(abs) || !statSync(abs).isFile()) continue;
      scanned += 1;
      const bytes = readFileSync(abs);
      for (let i = 0; i < bytes.length; i += 1) {
        const b = bytes[i];
        if ((b < 0x20 && !ALLOWED.has(b)) || b === 0x7f) {
          offenders.push(`${rel} byte ${i} = 0x${b.toString(16).padStart(2, '0')}`);
          break;
        }
      }
    }
    // A scan that measured nothing reports the same empty array as a clean one.
    expect(scanned).toBeGreaterThan(500);
    expect(offenders).toEqual([]);
  });
});
