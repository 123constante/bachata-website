// "Am I being RUN, or merely imported?" -- the one predicate, in one place.
//
// Every ESM CLI in this repo has to answer that question. Run means dispatch
// flags and set process.exitCode; imported means hand over the exports and do
// nothing. The idiom they reached for independently was
//
// (No count here on purpose. Four earlier drafts of this paragraph said
// "eleven", "twelve", "fourteen" and "fifteen", none of them right, because the
// number was copied between files rather than measured. The live count is the
// one instrument that cannot drift: R6 in check-script-conventions.mjs, whose
// allowlist holds exactly the files still carrying it.)
//
//     import.meta.url === pathToFileURL(process.argv[1]).href
//
// and it FAILS OPEN. Node resolves `import.meta.url` to the file's REALPATH;
// `process.argv[1]` is left exactly as the operator typed it. Any non-canonical
// spelling of the same file -- a Windows junction, a POSIX symlink, a mapped or
// `subst`ed drive -- makes the two strings disagree. The guard concludes it was
// imported, the module body ends, and node exits 0 having done NOTHING. For a
// check-*.mjs wired into CI that is not "the check failed to run"; it reads as
// "the check passed".
//
// Measured 2026-08-12 against check-script-conventions.mjs at 011e505:
//
//     cmd /c mklink /J C:\tmp\wtlink C:\dev\Website-p4
//     node C:/dev/Website-p4/scripts/check-script-conventions.mjs      -> 114 bytes, exit 0
//     node C:/tmp/wtlink/scripts/check-script-conventions.mjs          ->   0 bytes, exit 0
//     node C:/tmp/wtlink/scripts/check-script-conventions.mjs --self-test -> 0 bytes, exit 0
//
// Both the scan AND its canary reported success having executed nothing -- the
// canary cannot cover this, because every canary case calls main() directly and
// the dispatch deciding whether anything runs at all is the one line no case
// drives. A drive-letter case difference (C: vs c:) does NOT trigger it; node
// normalises that. Junction and symlink do.
//
// The repo had already been bitten once, in check-og-images.mjs, and responded
// by DELETING the guard from that file and from check-seo.mjs in favour of bare
// top-level dispatch. That trades a fail-open for a module no spec can import
// without firing its whole check as a side effect -- the regression recorded in
// check-script-conventions.mjs's own dispatch comment, where importing one
// export scanned 83 guards and then killed the test runner. Neither horn is
// necessary: compare REALPATH TO REALPATH and both problems go away.
//
// WHY FALSE IS THE ONLY SAFE AMBIGUOUS ANSWER. It is tempting to make an
// undecidable case return true, on the reasoning that a guard running twice
// beats a guard not running. It does not: `true` on import re-runs the CLI
// inside whatever imported it and sets that process's exit code -- the exact
// test-runner kill above. So the undecidable case returns false and SAYS SO on
// stderr. The one thing this module refuses to do is decide wrongly in silence.
//
// VENDORED TWIN -- and the admin side is covered far more thinly than this one, so
// the difference is stated rather than glossed. scripts/hooks/arc-checkpoint.mjs and
// scripts/hooks/session-lock.mjs are content-identical across this repo and
// bachata-admin-11april, so this file -- the dependency their dispatch resolves --
// is vendored into both on the same terms: edit both or neither. Both parity suites
// list it (Website tests/arcState.test.ts, admin tests/hookSelfTests.test.ts).
//
// WHAT ACTUALLY COVERS THE ADMIN COPY: the parity comparison, and nothing else. R6,
// the allowlist and prove-entry-point-dispatch.mjs are WEBSITE-SIDE ONLY; the admin
// repo has none of them. A draft of this paragraph also claimed session-lock's
// --self-test covered it. It does not, and cannot: --self-test calls selfTest()
// directly by the canonical path, so it never drives the dispatch line -- which is
// the argument this file makes 30 lines above about canaries in general. Measured
// 2026-08-13: revert the admin dispatch to the raw compare and --self-test still
// prints "session-lock --self-test: OK". Both parity suites also skip when the
// sibling checkout is absent, i.e. always in CI, on both sides. So the admin copies
// rest on a comparison a human runs with two checkouts present. That is thin; it is
// recorded as thin, and it is the argument for keeping the files identical rather
// than letting the admin copy evolve its own way.
//
// CALLED FROM HOOKS, which changes two things worth saying once here rather than
// twice at the call sites. (1) This is an ESM import, resolved BEFORE the caller's
// try/catch exists -- so if it is missing or unparseable, a hook whose contract is to
// print nothing instead exits 1 with a stack trace. That is the standing price of
// sharing the predicate rather than inlining it, and it is why both parity suites'
// temp-tree copy lists must carry this file. (2) warn() and trace() write to stderr,
// so a hook's silence contract yields to this module's refusal to decide wrongly in
// silence -- deliberately, in that order. ENTRY_POINT_TRACE is read from the
// inherited environment, so exporting it globally makes every hook invocation speak;
// it is a debugging switch, not something to leave set.

import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * realpathSync.native resolves junctions AND canonicalises case on Windows (it
 * goes through GetFinalPathNameByHandle); the JS implementation does neither
 * reliably.
 *
 * Called directly, with no `typeof === 'function'` fallback. A review asked for
 * one; it would be worse than nothing. `.native` has existed since Node 9.2 and
 * every workflow here pins Node 22, so the branch is unreachable -- and if it
 * ever did run, it would silently substitute the implementation this module
 * exists to avoid, reinstating the bug through the rescue path. A missing
 * `.native` should be a TypeError somebody sees, not a quiet downgrade.
 */
const realpath = (p) => realpathSync.native(p);

/** null rather than a throw, so callers can branch on "could not resolve". */
const tryRealpath = (p) => {
  try {
    return realpath(p);
  } catch {
    return null;
  }
};

/**
 * OBSERVABILITY, and the reason the proof harness is not a pile of per-target
 * special cases.
 *
 * "Did the dispatch fire?" used to be answerable only by watching for bytes the
 * TARGET chose to print, which meant inventing a probe argument per script --
 * an unknown flag here, `--json` there, `--manual` for the stamp writer, an
 * fs.readFileSync spy for a hook that prints nothing at all -- and then hoping
 * each one stayed true. Worse, it was imprecise in both directions: a module
 * that threw at import scored as "the CLI ran", and this module's own warning
 * on stderr would have scored a PASS for a run where it returned FALSE.
 *
 * With ENTRY_POINT_TRACE set, the predicate reports its own verdict instead. It
 * fires BEFORE the caller's main() does any work, so the harness can observe a
 * whole-program compile or an HTTP server without paying for either, and it
 * states true/false rather than leaving the reader to infer it from noise.
 *
 * Off by default and never changes the return value -- it only speaks.
 */
const trace = (verdict, modulePath) => {
  if (!process.env.ENTRY_POINT_TRACE) return verdict;
  process.stderr.write('[entry-point-trace] ' + verdict + ' ' + modulePath + '\n');
  return verdict;
};

/**
 * Fold case only where the filesystem does. NTFS is case-insensitive, ext4 is
 * not; folding unconditionally would call two genuinely different files on
 * Linux the same one.
 */
const samePath = (a, b) =>
  process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

const defaultWarn = (message) => {
  console.error(message);
};

/**
 * True when the module identified by `importMetaUrl` is the script node was
 * asked to run.
 *
 * Usage, at the bottom of a CLI module:
 *
 *     import { isEntryPoint } from './lib/entry-point.mjs';
 *     if (isEntryPoint(import.meta.url)) {
 *       process.exitCode = await main(process.argv.slice(2));
 *     }
 *
 * @param {string} importMetaUrl  the caller's own `import.meta.url`
 * @param {{argv?: string[], warn?: (message: string) => void}} [deps]
 *        seams so the canary can drive every branch without spawning a process
 * @returns {boolean}
 */
export function isEntryPoint(importMetaUrl, deps = {}) {
  const { argv = process.argv, warn = defaultWarn } = deps;

  if (typeof importMetaUrl !== 'string' || importMetaUrl === '') return false;

  const entry = Array.isArray(argv) ? argv[1] : undefined;

  // No entry script at all: node --eval, node --print, the REPL, a loader
  // worker. Legitimately "not run as a CLI", and silent by design -- this is
  // the ordinary case, not an anomaly, so it must not warn.
  if (typeof entry !== 'string' || entry === '') return false;

  let modulePath;
  try {
    modulePath = fileURLToPath(importMetaUrl);
  } catch {
    // A non-file: URL (data:, node:, http:) is never the entry script, and a
    // malformed one is a caller bug worth naming rather than swallowing.
    warn(
      `[entry-point] ${importMetaUrl} is not a file: URL, so it cannot be the entry script. ` +
        'Nothing ran.',
    );
    return false;
  }

  // Realpath BOTH sides, not just argv[1]. import.meta.url is normally already
  // canonical, but --preserve-symlinks-main / --preserve-symlinks turn that
  // off, and under those flags the MODULE side is the non-canonical one --
  // resolving only the argv side would fail open in the mirror image of the
  // original bug. If the module's own path cannot be resolved (deleted mid-run,
  // an exotic VFS) fall back to it as given: it came from the loader, so it is
  // the more trustworthy of the two.
  const moduleReal = tryRealpath(modulePath) ?? modulePath;

  const entryAbs = path.resolve(entry);
  const entryReal = tryRealpath(entryAbs);
  if (entryReal !== null) return trace(samePath(entryReal, moduleReal), moduleReal);

  // argv[1] names something that does not resolve on disk. Node normally
  // guarantees it does -- it just loaded it -- so this is either an exotic
  // invocation or a file that vanished mid-run. Compare literally as a last
  // resort, and if that also says "not the entry", say so out loud: a silent
  // false here is indistinguishable from the fail-open this module exists to
  // remove.
  const literalMatch = samePath(entryAbs, moduleReal);
  if (!literalMatch) {
    warn(
      `[entry-point] could not resolve process.argv[1] (${entry}); treating ` +
        `${path.basename(modulePath)} as imported rather than run. If this was a direct ` +
        'invocation, it has just done nothing.',
    );
  }
  return trace(literalMatch, moduleReal);
}

export default isEntryPoint;
