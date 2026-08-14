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
 * goes through GetFinalPathNameByHandle). The JS implementation resolves the
 * links too -- measured below -- but leaves the case exactly as spelled.
 *
 * An earlier draft called `.native` with no fallback at all, arguing that a
 * missing `.native` "should be a TypeError somebody sees, not a quiet
 * downgrade". The argument was right and the code did the opposite: the catch
 * beneath it was bare, so it swallowed precisely that TypeError, fell through to
 * the literal compare, and reinstated the fail-open this module exists to remove
 * -- silently, and behind a warning that blamed argv[1] for a path that resolves
 * perfectly well. Measured 2026-08-14, junction spelling, `.native` deleted:
 * false, one warning, wrong culprit. An EACCES from `.native` was byte-identical.
 *
 * The first fix for that separated the errors into two classes and retried only
 * one of them: a `code`-bearing error meant "this PATH is unresolvable, and the
 * JS implementation fails on it identically, so there is nothing to retry". The
 * second half of that sentence is false, and a review caught it before it
 * shipped. The two implementations do not share a code path -- `.native` is one
 * CreateFileW handle plus GetFinalPathNameByHandle, the JS one walks the
 * components with lstat/readlink -- and GetFinalPathNameByHandle is not
 * supported on every filesystem. A network redirector or a FUSE-backed mount can
 * answer it with ERROR_INVALID_FUNCTION / ERROR_NOT_SUPPORTED, which libuv hands
 * back as an ordinary code-bearing fs error. This repo runs on Cowork -> FUSE ->
 * virtio-fs -> NTFS. Classifying that as "the path is gone" skips the fallback
 * that would have resolved it; both sides then come back unresolved, the compare
 * degrades to the raw string, and a junction invocation returns FALSE. The
 * fail-open again, reached through the fix for it.
 *
 * So there is no classification. ALWAYS try the JS implementation; report a
 * failure only when BOTH refuse. The price is one extra component walk on a path
 * that is genuinely gone, at most once per side per process.
 *
 *   - Either implementation resolves it -> that answer, and if `.native` was the
 *     one that failed, say so. Measured on a real junction 2026-08-14: the JS
 *     one returns the canonical C:\dev\Website\... spelling, i.e. it does
 *     resolve the link. So the JUNCTION verdict stays RIGHT -- which is more
 *     than a TypeError escaping out of a session hook would have achieved.
 *
 *     It is NOT a full replacement, and a draft of this paragraph said its "one
 *     shortfall is the case, which samePath already folds". Case is one
 *     shortfall. Measured 2026-08-14 on this box:
 *
 *       .native('...\lib\ENTRY-~1.MJS') -> ...\lib\entry-point.mjs
 *       JS     ('...\lib\ENTRY-~1.MJS') -> ...\lib\ENTRY-~1.MJS   (unexpanded)
 *
 *     An 8.3 short name and a subst/mapped drive letter are both spellings this
 *     module's own header names as targets, and neither survives the downgrade:
 *     under a broken facility they read as imported. That is not a regression --
 *     before the fallback existed they compared literally and failed the same
 *     way -- but it is a real limit, and the downgrade warning states it rather
 *     than reassuring the reader that the verdict is sound. Expanding them is
 *     re-implementing GetFinalPathNameByHandle in userland, which is the wrong
 *     trade; naming the gap is not.
 *   - Both refuse -> report the failure and let the caller name it. The
 *     `.native` error rides along ONLY when it carried no errno, i.e. when the
 *     facility is broken as well as the path being gone. An ENOENT from both is
 *     a missing file, not a broken runtime, and must not accuse one.
 *
 * `.native` has existed since Node 9.2 and every workflow here pins Node 22, so
 * the downgrade should never fire. It is proven anyway -- selfTest deletes
 * `.native`, stubs it to throw with and without an errno, and injects a
 * `realpath` seam so the both-refuse branch can be driven without inventing a
 * filesystem -- because "unreachable" is the reason the bare catch sat
 * unexamined underneath the paragraph disowning it.
 */

/**
 * Name a thrown value without trusting it to be an Error.
 *
 * resolveReal guards its own read with `?.`; the three warnings below did not,
 * and reached straight for `.code ?? .message`. A patched or mocked fs throwing
 * a string -- or null -- therefore made isEntryPoint ITSELF throw, out of an
 * ESM import resolved before any caller's try/catch exists (see the header),
 * i.e. a hook whose contract is to print nothing exiting 1 with a stack trace.
 * That is the outcome the both-refuse branch was added to prevent, defeated one
 * line further down.
 */
const describe = (error) => error?.code ?? error?.message ?? String(error);

/**
 * Resolve `p`, or say why not. Never a bare null: a caller that cannot name the
 * failure writes the misattributed warning above.
 *
 * `realpath` is a seam, not a configuration point. Nothing in the repo passes
 * it; the canary does, because "both implementations refuse" cannot be reached
 * from a real filesystem on demand -- stubbing the `.native` PROPERTY leaves the
 * JS implementation underneath live, which is precisely the asymmetry the
 * paragraph above is about.
 *
 * EVERY FLAG HERE IS A BOOLEAN, and the callers gate on the boolean rather than
 * on the thrown value. The first version stored the error in `failure` and in
 * `downgraded` and let the call sites test those for truthiness, which works
 * only as long as nothing throws something falsy. describe() exists two lines up
 * because a mocked fs may throw a non-Error; `throw null` -- or `''`, or `0` --
 * then made both gates read as "did not happen". Measured on that version: both
 * implementations throwing an EACCES Error warned twice, throwing null warned
 * ONCE (the module-side degraded branch silent again), and a `.native` throwing
 * '' with the JS walker succeeding warned ZERO times -- a downgrade that speaks
 * only when it also changes the answer, which is the thing this module's own
 * case name calls "a downgrade nobody finds".
 *
 * @param {string} p
 * @param {typeof realpathSync} realpath
 * @returns {{path?: string, failed?: boolean, downgraded?: boolean,
 *            failure?: unknown, nativeError?: unknown}}
 */
const resolveReal = (p, realpath) => {
  try {
    return { path: realpath.native(p) };
  } catch (error) {
    try {
      return { path: realpath(p), downgraded: true, nativeError: error };
    } catch (fallbackError) {
      // Both refused, so the PATH is the fault. Announce the facility as well
      // only when the `.native` error had no errno: that is the facility broken
      // AS WELL as the path being gone. An ENOENT from both must not be
      // reported as a broken runtime.
      return {
        failed: true,
        failure: fallbackError,
        downgraded: typeof error?.code !== 'string',
        nativeError: error,
      };
    }
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
 * @param {{argv?: string[], warn?: (message: string) => void,
 *          realpath?: typeof realpathSync}} [deps]
 *        seams so the canary can drive every branch without spawning a process
 * @returns {boolean}
 */
export function isEntryPoint(importMetaUrl, deps = {}) {
  const { argv = process.argv, warn = defaultWarn, realpath = realpathSync } = deps;

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
  // original bug.
  const entryAbs = path.resolve(entry);
  const moduleRes = resolveReal(modulePath, realpath);
  const entryRes = resolveReal(entryAbs, realpath);

  // One warning per CONDITION, not per call site. A facility that is down fails
  // both resolutions, and a module that says the same thing twice teaches the
  // reader to skim the line that mattered.
  // Gate on the BOOLEAN and carry the whole result, so a falsy thrown value
  // cannot turn either warning off. `downgradedRes` is an object or undefined.
  const downgradedRes = moduleRes.downgraded
    ? { res: moduleRes, on: modulePath }
    : entryRes.downgraded
      ? { res: entryRes, on: entryAbs }
      : undefined;
  if (downgradedRes !== undefined) {
    warn(
      `[entry-point] realpathSync.native could not resolve ${downgradedRes.on} ` +
        `(${describe(downgradedRes.res.nativeError)}); fell back to the JS realpathSync. That ` +
        'resolves symlinks and junctions, so the usual non-canonical spellings still compare ' +
        'correctly; it does NOT canonicalise case, which is immaterial because the compare folds ' +
        'case on Windows. What it also does not do is expand an 8.3 short name (ENTRY-~1.MJS) or ' +
        'a subst/mapped drive letter -- measured, not assumed -- so a run spelled either of those ' +
        'ways will read as imported and do nothing while this is the only line printed. If a ' +
        'further [entry-point] line follows, a path did not resolve at all and that line governs. ' +
        'The named path is why this says nothing about the runtime: `.native` goes through one ' +
        'CreateFileW handle, so a single file held FILE_SHARE_NONE by an editor or a scanner ' +
        'fails it while the lstat walker resolves it. Read the errno and the path before ' +
        'suspecting the Node install -- `.native` has existed since 9.2.',
    );
  }

  // The module's own path did not resolve (deleted mid-run, an exotic VFS, a
  // directory this account cannot traverse). Fall back to it as given: it came
  // from the loader, so it is the more trustworthy of the two. But the compare
  // below is now realpath-against-raw, and that asymmetry used to happen in
  // COMPLETE SILENCE -- measured 2026-08-14 at true with zero warnings. The
  // ordinary branches above are silent on purpose (a plain import, node --eval);
  // this was the only DEGRADED one, reached because something failed to resolve,
  // that said nothing about it.
  if (moduleRes.failed === true) {
    warn(
      `[entry-point] could not resolve this module's own path (${modulePath}): ` +
        `${describe(moduleRes.failure)}. Falling back to the path the ` +
        'loader gave, so a non-canonical spelling of THIS file will read as imported rather ' +
        'than run.',
    );
  }
  const moduleReal = moduleRes.path ?? modulePath;

  if (entryRes.path !== undefined) return trace(samePath(entryRes.path, moduleReal), moduleReal);

  // argv[1] names something that does not resolve on disk. Node normally
  // guarantees it does -- it just loaded it -- so this is either an exotic
  // invocation or a file that vanished mid-run. Compare literally as a last
  // resort and say so either way, naming the errno: a silent false here is
  // indistinguishable from the fail-open this module exists to remove, and a
  // silent TRUE is that same raw string compare having guessed correctly.
  const literalMatch = samePath(entryAbs, moduleReal);
  const why = describe(entryRes.failure);
  warn(
    literalMatch
      ? `[entry-point] could not resolve process.argv[1] (${entry}): ${why}; it matched ` +
          `${path.basename(modulePath)} on a raw string compare -- the comparison this module ` +
          'exists to replace -- so this verdict is a guess that happened to land.'
      : `[entry-point] could not resolve process.argv[1] (${entry}): ${why}; treating ` +
          `${path.basename(modulePath)} as imported rather than run. If this was a direct ` +
          'invocation, it has just done nothing.',
  );
  return trace(literalMatch, moduleReal);
}

export default isEntryPoint;
