#!/usr/bin/env node
/**
 * CI-honesty guard over the guard scripts themselves.
 *
 * The arc that produced this file kept finding the same defect in different
 * costumes: a check that reports green without having checked anything. It is
 * the worst failure mode a CI suite has, because it is invisible -- a red check
 * gets fixed, a falsely-green one is trusted for months.
 *
 * Surveyed 2026-08-04 across the 81 scripts/check-*.mjs on bbb86e4:
 *   - 17 scripts had at least one path that exits 0 without asserting.
 *   - 1 of 81 (check-plan-hygiene.mjs) proved it can actually fail.
 * The sharpest example was check-sourcemap-debugids.mjs: when the live bundle
 * carried NO Sentry-tagged chunks -- the exact regression it guards -- it hit
 * a zero-sample branch and exited green. The guard inverted under its own
 * failure mode.
 *
 * The repo had already written both remedies down and then applied them almost
 * nowhere. This script promotes them from convention to contract:
 *   - scripts/lib/previewProbe.mjs :: assertMeasured() -- "a check must not
 *     report success without measuring what it promised" (5 consumers).
 *   - scripts/check-plan-hygiene.mjs self-test -- every rule proven in BOTH
 *     directions against tmpdir fixtures (1 consumer).
 *
 * SIX RULE CLASSES (the four queued from admin docs/open-loops.md, plus R5-R6):
 *   R1 silent-skip     a green exit reachable from a missing secret, a walled
 *                      URL, an undeployed RPC, or an empty sample, with no
 *                      escalation env and no assertMeasured floor.
 *   R2 swallowed-error a catch with an empty body, or a .catch that returns a
 *                      default -- an unreadable file then scans clean.
 *   R3 exit-drift      the 0/1/2 contract: 0 pass, 1 contract violated,
 *                      2 infrastructure. Missing creds must be 2, not 1 or 0.
 *   R4 no-canary       a guard with no proof it can fail. Every script without
 *                      one is recorded in the allowlist, so retrofitting stays
 *                      a burn-down -- but a NEW script must carry one to pass.
 *   R5 unproven-exit   a canary that proves the RULES but never drives the
 *                      function whose return value becomes the exit code. The
 *                      rules are then measured and the CODES are asserted.
 *   R6 raw-entry-point import.meta compared against process.argv[1] by hand.
 *                      Node realpaths one side and not the other, so through a
 *                      junction or symlink the script exits 0 having run
 *                      NOTHING -- its canary included. Use isEntryPoint().
 *
 * R6 IS THE ONE RULE NO CANARY COULD HAVE REPLACED, and it is R5's blind spot
 * stated as a rule. Every canary case calls main() directly; the dispatch that
 * decides whether main() is reached at all is the one line no case drives, so a
 * guard could satisfy R1-R5 completely and still be a script that never runs.
 * Measured 2026-08-12: through a junction, this very file printed 0 bytes and
 * exited 0, under both the scan and --self-test.
 *
 * R6 also scans a WIDER corpus than R1-R5 -- every .mjs (and .js) under
 * scripts/ and bin/, recursively, not the flat "check- or lint- prefixed, top
 * level only" guard list -- because the two worst instances were
 * ship-gate.mjs and hooks/review-stamp.mjs, and a rule blind to those two would
 * have been decoration. The live proof that every converted dispatch still runs
 * is scripts/prove-entry-point-dispatch.mjs (local, not CI: it needs to make a
 * junction).
 *
 * WHY R5 IS A RULE AND NOT A NOTE. R3 is the rule that CLAIMS to own the 0/1/2
 * contract, and it has zero allowlist entries -- which reads as universal
 * compliance. Measured on this tree (2026-08-12, 90 check-/lint- scripts) AS IT
 * STOOD BEFORE THIS COMMIT -- stated that way because this commit's own edit to
 * this file moves the last figure: the 13 becomes 12, since this file stopped
 * being one of the violators. The other five are unchanged by it (re-measured
 * after the edit; this file carries no credential guard, so it never joins the
 * 6, and a first draft of this sentence claiming otherwise was wrong):
 *   - 66 scripts carry the literal `if (!url || !key)` shape R3 matches. 62 of
 *     them pair it with process.exit(2) and are genuinely measured compliant.
 *   - The other 4 spell the code as `return 2`. R3 pairs its shape with
 *     process.exit(N) only, so it sees the `if` and then no exit call at all,
 *     and declines to hit. Those 4 are not compliant-and-counted; they are
 *     unlooked-at, and so are 2 more that spell the guard itself differently --
 *     6 scripts in total return their codes rather than exiting them.
 *   - 14 scripts carry a canary; 13 of them never call the function that owns
 *     their exit code, so flipping a `return 2` to `return 0` leaves every one
 *     of their rule cases green.
 * So R3's zero is evidence about 62 scripts, not 90, and nothing distinguishes
 * that from evidence about all of them. R3 checks a SHAPE and can be spelled
 * around. R5 checks that the contract is DRIVEN, which is spelling-independent:
 * it asks whether the canary can observe the code at all. Only
 * check-ci-budget.mjs passed it when it was written -- its own header records
 * what that cost -- and this file was changed in the same commit to pass it
 * too, because a rule its author is exempt from is not a rule.
 *
 * WHAT R5 CANNOT SEE, said plainly. It is a static rule, so it proves the
 * canary CALLS the exit owner -- not that it asserts anything useful about what
 * came back. A canary that calls main() and ignores the result satisfies it.
 * The judgement it cannot make is the one check-ci-budget.mjs documents at
 * length: when four branches all return 2, a case that does not pin WHICH
 * branch fired passes for the wrong reason. R5 buys the seam that makes that
 * judgement possible; it does not make it for you.
 *
 * THE NAMED GAP: R5 PROVES VALUE-OWNERSHIP, NOT REACHABILITY. It asks who
 * PRODUCED the value that lands in process.exitCode, and whether the canary
 * calls them. It never asks whether the assigning statement RUNS. The two come
 * apart the moment the exit statement sits inside any function body, because
 * the owner list then holds only the inner value-producer. Measured against
 * this file on 2026-08-19, canary present in every row:
 *
 *   process.exitCode = await main(argv)      module scope   owners [main]
 *                                            canary calls main        clean
 *                                            canary does not          FIRES
 *   main() { process.exitCode = verdict() }  owners [verdict]         clean
 *   main() { process.exit(verdict()) }       owners [verdict]         clean
 *   class R { run() { ...same... } }         owners [verdict]         clean
 *   (async () => { ...same... })()           owners [verdict]         clean
 *   only literal codes anywhere              owners []                FIRES
 *
 * So the rule asks MORE of the more testable shape. Exposing the assignment at
 * the CLI tail names main as an owner and R5 demands the canary drive it;
 * hiding the same assignment inside main removes main from the owner set and
 * R5 asks the smaller question instead. That is an INVERSION, not merely a
 * blind spot, and it is why check-override-mirror-ghost.mjs passed R5 with its
 * exit code disconnected from its own verdict -- mutating the assignment to
 * `= 0` left all five of its cases green.
 *
 * IT IS DOCUMENTED RATHER THAN FIXED, and that is a decision with evidence
 * behind it. Three attempts to widen ownership to the enclosing function were
 * built and reverted on 2026-08-19 (plans/queued-r5-exit-owner-widening-
 * attempt3-reverted.md). Each walked the syntax tree outward from the exit
 * site; each went blind to a wrapper the walk did not name while over-firing
 * on a callee it did. A SYNTACTIC ANCESTOR IS NOT A DRIVABILITY PROOF. The
 * shape of a fix that would work is dynamic, not static -- a canary case that
 * SPAWNS the script and asserts the real process-level exit code -- and that
 * is a different rule with a different cost, queued rather than smuggled in
 * here. Until it lands, read an R5 pass as "the value-producer is driven",
 * never as "the exit contract is proven".
 *
 * RATCHET. Today violations are frozen in
 * scripts/script-conventions-allowlist.json. The guard fails on a NEW
 * violation, on a COUNT INCREASE, and -- deliberately -- on a STALE entry, so
 * the allowlist can only ever shrink. Same shape as
 * scripts/rpc-typing-allowlist.json, which this mirrors on purpose.
 *
 * A ratchet is not an amnesty: an allowlisted script is still lying to you. The
 * allowlist is the burn-down list, and a re-baseline after a fix locks the win.
 *
 * Local:  node scripts/check-script-conventions.mjs
 *         node scripts/check-script-conventions.mjs --write      (re-baseline)
 *         node scripts/check-script-conventions.mjs --self-test  (prove rules)
 * CI:     .github/workflows/db-contract-check.yml -- no DB, no network, no env.
 *
 * Exit: 0 pass, 1 convention violated, 2 the guard could not run.
 */
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';
// R5 only. R1-R4 stay on regex -- see the note above the R5 block for why this
// one rule earns a parser. Already a direct dependency, and already used this
// way by scripts/check-wallclock-brand.mjs.
import ts from 'typescript';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ALLOWLIST_PATH = 'scripts/script-conventions-allowlist.json';

/*
 * R4 used to be dropped here behind a CANARY_ADVISORY flag. That flag filtered
 * every R4 hit unconditionally, with no new-vs-pre-existing distinction, so the
 * rule could not fail for ANY script and its hits never reached the allowlist
 * either -- while the header claimed new scripts were held to it. R4 now goes
 * through the same ratchet as R1-R3: the ~80 canary-less scripts are recorded
 * as debt and pass, and a NEW script with no canary is an addition, which
 * fails. Retrofitting stays a burn-down; the allowlist is the record of it.
 */

/** Scripts that are themselves fixtures/tools, not guards. */
const NOT_A_GUARD = new Set([
  'check-script-conventions.mjs',
  'resolve-preview-url.mjs',
]);

// ---------------------------------------------------------------------------
// Rule detection
//
// R1-R4 are regex-based, not AST-based. The scripts are formulaic (~55 share a
// copy-pasted skeleton), the patterns are distinctive, and a regex guard that
// ships beats an AST guard that does not. The cost is false positives, which
// the allowlist absorbs -- and every rule is proven in BOTH directions by the
// self-test, so a rule that silently stops matching is itself a failure.
//
// R5 IS THE EXCEPTION and parses. It is the only rule that asks a question
// about SCOPE rather than about a shape, and the note above its block records
// what answering that with text scanning cost: six defects over two review
// rounds, one of them fail-open and live in this tree.
//
// stripNoise below is a hand-rolled character scanner, NOT a regex, for two
// measured reasons. (1) The obvious regex for a quoted literal,
// /' (?: BS . | [^ BS '] )* '/, backtracks catastrophically on an apostrophe
// used in prose: it hung for over 120s on check-og-images.mjs. The scanner is
// linear. (2) This file is authored through a FUSE mount observed to silently
// eat literal backslashes inside heredocs, which corrupts such a pattern into
// one that still parses but means something else -- exactly how that hang was
// introduced. The scanner spells its one backslash as a char code instead.
// ---------------------------------------------------------------------------

/** Words after which a '/' opens a regex literal rather than dividing. */
const REGEX_LEAD_WORDS = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'yield', 'await',
]);

/** Punctuation after which a '/' opens a regex literal. */
const REGEX_LEAD_PUNCT = '(,=:[!&|?{};+-*%^~<>';

function isWordChar(ch) {
  return /[A-Za-z0-9_$]/.test(ch);
}

/**
 * True when the '/' about to be read opens a regex literal rather than being a
 * division operator. Decided from the last significant character before it --
 * the standard heuristic, and sufficient for guard scripts.
 */
function opensRegex(lastSig, lastWord) {
  if (lastSig === '') return true;
  if (REGEX_LEAD_PUNCT.includes(lastSig)) return true;
  return REGEX_LEAD_WORDS.has(lastWord);
}

/**
 * Index just past the closing '/' of the regex literal starting at `start`, or
 * -1 if it does not close on this line (in which case the '/' was not a regex
 * after all). A '/' inside a [...] character class is literal, not the closer.
 */
function endOfRegex(src, start) {
  const BS = String.fromCharCode(92);
  const NL = String.fromCharCode(10);
  let k = start + 1;
  let inClass = false;

  while (k < src.length) {
    const ch = src[k];
    if (ch === NL) return -1;
    if (ch === BS) {
      k += 2;
      continue;
    }
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) return k + 1;
    k += 1;
  }
  return -1;
}

/**
 * Strip block comments, line comments, string literals and regex literals, so
 * that PROSE about a green exit -- or a PATTERN describing one -- is never
 * mistaken for the real thing. Newlines are preserved inside blanked regions so
 * reported line numbers stay accurate.
 */
export function stripNoise(src) {
  const BS = String.fromCharCode(92); // backslash, spelled out -- see note above
  const NL = String.fromCharCode(10);
  const out = [];
  let i = 0;
  let state = 'code'; // code | block | line | tmpl | sq | dq
  let quote = '';
  let lastSig = ''; // last non-space code char -- regex-vs-division
  let lastWord = ''; // and the identifier it ended -- for `return /re/`

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    if (state === 'code') {
      if (c === '/' && next === '*') {
        state = 'block';
        out.push('  ');
        i += 2;
        continue;
      }
      // A // that is not part of a :// URL scheme.
      if (c === '/' && next === '/' && src[i - 1] !== ':') {
        state = 'line';
        out.push('  ');
        i += 2;
        continue;
      }
      // A regex literal is data, exactly like a string, so blank its interior.
      // Without this a character class such as ['"] drops the scanner into
      // string state and silently blanks the rest of that line from every rule.
      if (c === '/' && opensRegex(lastSig, lastWord)) {
        const end = endOfRegex(src, i);
        if (end > 0) {
          out.push('/');
          for (let k = i + 1; k < end - 1; k++) out.push(' ');
          out.push('/');
          lastSig = '/';
          lastWord = '';
          i = end;
          continue;
        }
      }
      if (c === '`' || c === "'" || c === '"') {
        state = c === '`' ? 'tmpl' : c === "'" ? 'sq' : 'dq';
        quote = c;
        out.push(c);
        i += 1;
        continue;
      }
      out.push(c);
      if (c.trim() !== '') {
        lastSig = c;
        lastWord = isWordChar(c) ? lastWord + c : '';
      }
      i += 1;
      continue;
    }

    if (state === 'block') {
      if (c === '*' && next === '/') {
        state = 'code';
        out.push('  ');
        i += 2;
        continue;
      }
      out.push(c === NL ? NL : ' ');
      i += 1;
      continue;
    }

    if (state === 'line') {
      if (c === NL) {
        state = 'code';
        out.push(NL);
        i += 1;
        continue;
      }
      out.push(' ');
      i += 1;
      continue;
    }

    // Inside a string literal. A backslash escapes exactly one character, so an
    // apostrophe in prose can never run away -- this is the linear-time
    // replacement for the regex that caught fire on check-og-images.mjs.
    if (c === BS) {
      out.push(' ');
      if (i + 1 < src.length) out.push(src[i + 1] === NL ? NL : ' ');
      i += 2;
      continue;
    }
    if (c === quote) {
      state = 'code';
      quote = '';
      out.push(c);
      i += 1;
      continue;
    }
    // An unterminated literal must not swallow the rest of the file: a raw
    // newline inside a non-template quote means the author never closed it.
    if (c === NL && state !== 'tmpl') {
      state = 'code';
      quote = '';
      out.push(NL);
      i += 1;
      continue;
    }
    out.push(c === NL ? NL : ' ');
    i += 1;
  }

  return out.join('');
}

/**
 * Conditions meaning "we could not check", as opposed to "we checked and it is
 * fine". Each key is a distinct diagnosis, so the allowlist records WHY a
 * script is exempt rather than merely that it is.
 */
const SKIP_TRIGGERS = [
  { key: 'missing-secret', re: /if\s*\(\s*!\s*(?:token|key|apiKey|secret|creds?|serviceAccount)\b/i },
  // Both spellings, and this is not defensive padding -- it is a bug this rule
  // actually had. When check-og-images.mjs and check-seo.mjs moved from calling
  // previewIsWalled() directly to calling the skipIfWalledPreview() wrapper, the
  // skip construct did not change by one character, but the identifier no longer
  // contained the substring this regex looks for, so R1 went blind and the
  // ratchet reported the debt PAID. A rule keyed on a NAME is only as durable as
  // that name: any future wrapper needs a case here and a self-test beside it.
  { key: 'walled-preview', re: /(?:previewIsWalled|skipIfWalledPreview)\s*\(/ },
  { key: 'undeployed-rpc', re: /42883/ },
  { key: 'empty-sample', re: /(?:probed|compared|checked|sampled|measured|found)\s*===\s*0/ },
  { key: 'empty-sample', re: /\.length\s*===\s*0|!\w+\.length\b/ },
];

/** An escalation hatch makes a skip honest: CI can force it to fail. */
const ESCALATION = /REQUIRE_|_ENFORCE\b|STRICT\b|assertMeasured\s*\(/;

export function findSilentSkips(src) {
  const code = stripNoise(src);
  const hits = [];
  const lines = code.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const greenExit = /process\.exit\(\s*0\s*\)/.test(lines[i]);
    const bareReturn = /^\s*return\s*;/.test(lines[i]);
    if (!greenExit && !bareReturn) continue;

    const window = lines.slice(Math.max(0, i - 12), i + 1).join('\n');
    // The hatch has to guard THIS skip. Tested against the whole file it
    // disarmed the rule wholesale: one REQUIRE_ token on an unrelated branch
    // hid every other silent skip in the same script -- including the zero-
    // sample green exit in check-sourcemap-debugids.mjs that motivated R1.
    if (ESCALATION.test(window)) continue;
    for (const trigger of SKIP_TRIGGERS) {
      if (!trigger.re.test(window)) continue;
      hits.push({ rule: 'R1', kind: trigger.key, line: i + 1 });
      break;
    }
  }
  return hits;
}

export function findSwallowedErrors(src) {
  const code = stripNoise(src);
  const hits = [];
  const lines = code.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    // A catch whose body is empty: the next non-blank line closes the block.
    if (/catch\s*(?:\([^)]*\))?\s*\{\s*$/.test(lines[i])) {
      const next = lines[i + 1] ?? '';
      // When the very next line closes the block the body is already known to
      // be empty, so there is nothing left to "handle". The old 3-line window
      // read PAST that brace, letting unrelated following code -- a throw, an
      // exit -- suppress a real hit in a ratchet meant only ever to tighten.
      if (/^\s*\}/.test(next)) {
        hits.push({ rule: 'R2', kind: 'empty-catch', line: i + 1 });
      }
    }
    // Single-line empty catch.
    if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(lines[i])) {
      hits.push({ rule: 'R2', kind: 'empty-catch', line: i + 1 });
    }
    // A .catch that substitutes a default value for the error.
    if (/\.catch\s*\(\s*\(\s*\w*\s*\)\s*=>\s*(?:\[\s*\]|null|undefined|\{\s*\})\s*\)/.test(lines[i])) {
      hits.push({ rule: 'R2', kind: 'swallowing-catch', line: i + 1 });
    }
  }
  return hits;
}

export function findExitDrift(src) {
  const code = stripNoise(src);
  const hits = [];
  const lines = code.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    // A missing-credential branch is infrastructure: it must exit 2.
    if (/if\s*\(\s*!\s*url\s*\|\|\s*!\s*key\s*\)/.test(lines[i])) {
      const body = lines.slice(i, i + 6).join('\n');
      const isTwo = /process\.exit\(\s*2\s*\)/.test(body);
      const isOther = /process\.exit\(\s*[013-9]\s*\)/.test(body);
      if (!isTwo && isOther) hits.push({ rule: 'R3', kind: 'creds-not-exit-2', line: i + 1 });
    }
  }
  return hits;
}

/** A canary is present. R4 and R5 must agree on this or R5 would fire on the
 *  scripts R4 has already recorded, double-charging the same debt. */
const HAS_CANARY = /selfTest|SELF_?TEST/;

export function findMissingCanary(src) {
  // Identifiers, against STRIPPED source. Tested against the raw text a script
  // that merely mentions "self-test" in a comment or a --help string satisfied
  // the rule without carrying a canary at all.
  if (HAS_CANARY.test(stripNoise(src))) return [];
  return [{ rule: 'R4', kind: 'no-canary', line: 0 }];
}

// ---------------------------------------------------------------------------
// R5 -- the canary drives the exit contract.
//
// The rule is one question: does the canary CALL the function whose return
// value becomes process.exitCode? Three shapes answer no, and they are three
// stages of the same refactor rather than three different defects:
//
//   1. No function owns the code -- the CLI computes it inline from literals
//      (`process.exit(result.ok ? 0 : 2)`), or main() sets process.exitCode as
//      a side effect and returns nothing. Nothing is drivable.
//   2. A function owns it, but the canary never calls it. Every rule case is
//      green; flip the `return 2` to `return 0` and they stay green.
//   3. There is no locatable canary body to look in.
//
// AND ONE SHAPE THAT ANSWERS NO AND IS NOT ASKED: an exit statement inside a
// function body. The owner list then holds only the inner value-producer, so a
// canary driving that alone passes while the wiring stays unproven. That is the
// NAMED GAP in the header -- read it before trusting an R5 pass, and before
// attempting a fourth fix.
//
// ONE ALLOWLIST KIND FOR ALL THREE, DELIBERATELY. The obvious design records
// which shape a script is in. It is wrong here: fixing R5 is a multi-step
// refactor (make main() return the code, give it a seam, then drive it), and a
// kind that changes mid-refactor lands as one STALE entry plus one ADDITION --
// and an addition prints "a NEW guard script can report green without
// checking". A ratchet that reds on progress is a ratchet people route around.
// The diagnosis is printed in the failure block instead, where a blocked human
// is actually reading.
//
// SCRIPTS WITH NO CANARY ARE R4's, NOT R5's. Recording the same script under
// both inflates the burn-down and says nothing new. The consequence is
// deliberate and worth stating: fixing R4 by adding a rules-only canary turns
// that script into an R5 addition. Adding a canary that cannot see the exit
// codes is half the job, and this is where the other half gets asked for.
// ---------------------------------------------------------------------------

/** A declaration whose NAME says it is the canary. */
const CANARY_NAME = /^self_?test/i;
const CANARY_NAME_EXACT = /^self_?test$/i;

/**
 * R5 IS ANSWERED ON AN AST, NOT BY SCANNING TEXT, and the reason is measured
 * rather than stylistic.
 *
 * The first draft answered "does the canary call the exit owner" with a
 * hand-rolled scanner layered on stripNoise. Two review rounds found six
 * defects in it, and the sixth was fail-OPEN and live in this tree: with no
 * keyword denylist, `if (` in the statement after a semicolon-free
 * `process.exitCode = code` was collected as an exit owner -- and since nearly
 * every canary body contains an `if (`, the rule reported CLEAN on a canary
 * that drove nothing. check-sourcemap-debugids.mjs already yields owners
 * ['if', 'main'] today and fires only because `main` happens to land in the
 * same window. That is precisely the "reports green without checking" failure
 * this whole file exists to end, inside the rule added to end it.
 *
 * The other five were the same shape: a brace-less arrow canary borrowing the
 * CLI tail, an unclosed body falling back to the rest of the file, a
 * prettier-wrapped assignment reading as "not drivable", a scope-blind binding
 * table resolving the wrong `const code`, and a `selfTestHelper` declared above
 * the real canary hijacking the scan. Each patch closed an instance and left
 * the class, because text scanning cannot answer a question about SCOPE.
 *
 * R1-R4 stay on regex, and the header's defence of that still holds: they match
 * distinctive SHAPES, and a regex guard that ships beats an AST guard that does
 * not. R5 is the first rule that needs binding resolution, so it is the first
 * that earns a parser. typescript is a direct dependency and is already used
 * this way in scripts/check-wallclock-brand.mjs, so this adds no dependency and
 * no new precedent.
 */
function parse(src) {
  return ts.createSourceFile('guard.mjs', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

/** Names invoked as a bare `name(...)` anywhere inside `node`. A keyword is not
 *  a CallExpression and a method call has a PropertyAccess callee, so both drop
 *  out here for free rather than needing a denylist that can be incomplete. */
function calledNames(node) {
  const names = new Set();
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) names.add(n.expression.text);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return names;
}

/** Every `name` declared directly inside `node` -- a local that SHADOWS an
 *  outer one of the same name. A canary satisfying R5 with a two-line local
 *  stub called `main` is driving a literal, not the CLI's exit owner. */
function declaredNames(node) {
  const names = new Set();
  const visit = (n) => {
    // Do NOT descend into a nested function: a local called `run` inside a
    // helper the canary defines does not shadow the canary's own view of the
    // owner, and treating it as one fired R5 on a canary that does drive it.
    if (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      if (ts.isFunctionDeclaration(n) && n.name) names.add(n.name.text);
      return;
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) names.add(n.name.text);
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(node, visit);
  return names;
}

/** The nearest enclosing initialiser for `name`, walking OUT from `from`.
 *  Real scope resolution: an unrelated `const code = 2` earlier in the file no
 *  longer shadows the CLI's `const code = await main(argv)`. */
function resolveInitializer(from, name) {
  for (let scope = from; scope; scope = scope.parent) {
    const statements = scope.statements ?? scope.body?.statements;
    if (!statements) continue;
    for (const statement of statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const decl of statement.declarationList.declarations) {
        if (!decl.initializer) continue;
        if (ts.isIdentifier(decl.name) && decl.name.text === name) return decl.initializer;
        // `const { code } = await main();` -- the name is bound by a pattern,
        // not an identifier, and reading only the identifier form reported
        // "no function returns the exit code" for a compliant script.
        if (
          ts.isObjectBindingPattern(decl.name) &&
          decl.name.elements.some((el) => ts.isIdentifier(el.name) && el.name.text === name)
        ) {
          return decl.initializer;
        }
      }
    }
  }
  return null;
}

/**
 * `main(argv).then((code) => { process.exitCode = code })` -- the identifier is
 * a PARAMETER, not a declaration, so resolveInitializer cannot see it. Walk out
 * to the callback's own `.then(...)` call and take the receiver of the chain.
 *
 * Without this the shape reports "exit-not-drivable" on a script whose main()
 * plainly returns the code, which is the misleading-diagnosis failure that
 * parks a compliant script in the allowlist and never lets it out.
 */
function promiseChainOwners(identifier) {
  for (let node = identifier; node; node = node.parent) {
    const isCallback = ts.isArrowFunction(node) || ts.isFunctionExpression(node);
    if (!isCallback) continue;
    const names = node.parameters.map((p) => (ts.isIdentifier(p.name) ? p.name.text : null));
    if (!names.includes(identifier.text)) continue;
    const call = node.parent;
    if (
      call &&
      ts.isCallExpression(call) &&
      ts.isPropertyAccessExpression(call.expression) &&
      ['then', 'catch', 'finally'].includes(call.expression.name.text)
    ) {
      return calledNames(call.expression.expression);
    }
  }
  return new Set();
}

/**
 * The functions whose value BECOMES the exit code.
 *
 * Structural, not "every call in the expression", and the difference is a
 * defect a third review round found in the first AST draft: the CLI tail
 * `await main(argv).catch((e) => ... String(e) ...)` collected `String` as an
 * exit owner, and this very file passed R5 only because a canary helper happens
 * to call String(). "Fires only by luck" is what the header criticises the old
 * text scanner for; it had been reproduced here.
 *
 * So the walk visits only value-producing positions and NEVER an argument:
 * `main(parseArgs(argv))` owns `main`, not `parseArgs`.
 */
function valueOwners(expr) {
  if (ts.isAwaitExpression(expr) || ts.isParenthesizedExpression(expr)) {
    return valueOwners(expr.expression);
  }
  if (ts.isConditionalExpression(expr)) {
    return new Set([...valueOwners(expr.whenTrue), ...valueOwners(expr.whenFalse)]);
  }
  // `a ?? b`, `a || b` -- either side can be the value that lands.
  if (ts.isBinaryExpression(expr)) {
    const kind = expr.operatorToken.kind;
    if (
      kind === ts.SyntaxKind.QuestionQuestionToken ||
      kind === ts.SyntaxKind.BarBarToken ||
      kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      return new Set([...valueOwners(expr.left), ...valueOwners(expr.right)]);
    }
    return new Set();
  }
  if (ts.isCallExpression(expr)) {
    if (ts.isIdentifier(expr.expression)) return new Set([expr.expression.text]);
    // `main(argv).then(...)` / `.catch(...)` -- the code still comes from the
    // head of the chain, so follow the receiver and ignore the callback.
    if (
      ts.isPropertyAccessExpression(expr.expression) &&
      ['then', 'catch', 'finally'].includes(expr.expression.name.text)
    ) {
      return valueOwners(expr.expression.expression);
    }
    return new Set();
  }
  if (ts.isIdentifier(expr)) {
    const init = resolveInitializer(expr, expr.text);
    if (init) return valueOwners(init);
    return promiseChainOwners(expr);
  }
  return new Set();
}

/**
 * The functions whose return values become the exit code, by name and line.
 *
 * Read off the CLI's own assignment rather than by looking for a function
 * called `main`. That distinction is the lesson SKIP_TRIGGERS records above --
 * a rule keyed on a NAME is only as durable as the name -- and it is load
 * bearing already: check-mojibake.mjs spells its owner `runScan`, and a
 * main-only rule would have called it compliant without looking.
 *
 * A canary-named function is never an owner: `process.exitCode = selfTest() ? 0
 * : 1` says only that the canary reports itself, which every canary does.
 */
export function exitOwners(code) {
  const source = parse(code);
  const owners = new Map();
  const record = (expr) => {
    const at = source.getLineAndCharacterOfPosition(expr.getStart(source)).line + 1;
    for (const name of valueOwners(expr)) {
      if (CANARY_NAME.test(name)) continue;
      if (!owners.has(name)) owners.set(name, at);
    }
  };

  const visit = (node) => {
    // process.exitCode = <expr>
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      ts.isIdentifier(node.left.expression) &&
      node.left.expression.text === 'process' &&
      node.left.name.text === 'exitCode'
    ) {
      record(node.right);
    }
    // process.exit(<expr>)
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'process' &&
      node.expression.name.text === 'exit' &&
      node.arguments.length > 0
    ) {
      record(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return owners;
}

/**
 * The canary's body node, or null when no declaration whose name says "canary"
 * can be found. An EXACT `selfTest` wins over a merely prefixed one: a helper
 * called selfTestHelper or selfTestCase declared above the real canary used to
 * hijack the scan, and if that helper mentioned the owner the rule passed a
 * canary that drove nothing.
 */
function canaryNode(source) {
  const found = [];
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      found.push([node.name.text, node.body]);
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      found.push([node.name.text, node.initializer.body]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const named = found.filter(([name]) => CANARY_NAME.test(name));
  const exact = named.find(([name]) => CANARY_NAME_EXACT.test(name));
  return (exact ?? named[0])?.[1] ?? null;
}

/** True when `name` is CALLED in `region`. Kept as a string-in API because the
 *  canary drives it directly on fragments. */
export function callsFunction(region, name) {
  return calledNames(parse(region)).has(name);
}

/** The canary's body, as source text, or null. */
function canaryBody(code) {
  const node = canaryNode(parse(code));
  return node ? node.getText() : null;
}

/**
 * Does the canary drive `owner`? Directly, or through ONE module-scope helper.
 *
 * The helper hop is not indulgence: factoring `const runMain = (argv, extra) =>
 * main(argv, {...sealed, ...extra})` out of the canary is the natural next step
 * once several cases share it, and without this the rule would fire on it --
 * pinning a code layout rather than the property it claims to measure. The
 * reference implementation avoids it only by keeping that helper inline.
 */
function canaryDrives(source, body, owner) {
  // A local of the same name shadows the real owner, so calling it proves
  // nothing about the CLI's contract.
  if (declaredNames(body).has(owner)) return false;
  const called = calledNames(body);
  if (called.has(owner)) return true;
  for (const helper of called) {
    const init = resolveInitializer(body, helper);
    if (init && calledNames(init).has(owner)) return true;
    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name?.text === helper && statement.body) {
        if (calledNames(statement.body).has(owner)) return true;
      }
    }
  }
  return false;
}

/** The diagnosis behind an R5 hit -- printed, never keyed. See the block note. */
export function diagnoseExitContract(src) {
  const code = stripNoise(src);
  if (!HAS_CANARY.test(code)) return null;
  const source = parse(src);
  // FAIL CLOSED ON SOURCE THAT DOES NOT PARSE. TypeScript's parser is
  // error-TOLERANT: an unclosed canary body does not throw, it RECOVERS by
  // swallowing the rest of the file into that body -- so callsFunction then
  // finds the CLI's own `main(` inside the "canary" and reports clean. That is
  // the same borrowed-CLI-tail fail-open the text scanner had, arriving by a
  // different road. Measured before trusting it: 0 of the 90 real scripts
  // produce a parse diagnostic, so this cannot fire on healthy source.
  if ((source.parseDiagnostics ?? []).length > 0) {
    const first = source.parseDiagnostics[0];
    return {
      why: 'unparseable',
      detail:
        'the source does not parse (' +
        ts.flattenDiagnosticMessageText(first.messageText, ' ') +
        '), so nothing can be concluded about its exit contract',
      line: 0,
    };
  }
  const owners = exitOwners(src);
  if (owners.size === 0) {
    return {
      why: 'exit-not-drivable',
      detail:
        'no function returns the exit code -- the CLI computes it inline, or ' +
        'sets process.exitCode as a side effect',
      line: 0,
    };
  }
  const body = canaryNode(source);
  if (body === null) {
    return {
      why: 'canary-body-not-found',
      detail: 'no locatable canary function body to look in',
      line: 0,
    };
  }
  const undriven = [...owners.keys()].filter((name) => !canaryDrives(source, body, name));
  if (undriven.length > 0) {
    return {
      why: 'canary-skips-exit',
      detail: 'the canary never calls ' + undriven.map((n) => n + '()').join(', '),
      line: owners.get(undriven[0]) ?? 0,
    };
  }
  return null;
}

export function findUnprovenExitContract(src) {
  const found = diagnoseExitContract(src);
  if (found === null) return [];
  return [
    {
      rule: 'R5',
      kind: 'unproven-exit-contract',
      line: found.line,
      why: found.why,
      detail: found.detail,
    },
  ];
}

// ---------------------------------------------------------------------------
// R6 -- an entry-point guard must compare REALPATHS.
//
// The idiom every CLI in this tree reached for independently was some spelling of
//
//     import.meta.url === pathToFileURL(process.argv[1]).href
//
// and it FAILS OPEN. Node resolves import.meta.url to the file's realpath;
// process.argv[1] is left as typed. Invoke the script through a Windows
// junction, a POSIX symlink or a mapped drive and the two disagree, the guard
// decides it was imported, and the module body ends. Measured 2026-08-12 on
// this very file: through a junction it printed 0 bytes and exited 0 -- and so
// did --self-test, so the canary attested to a run that never happened.
//
// R5 CANNOT SEE THIS, which is why it is a separate rule rather than a case.
// Every canary drives main() directly; the dispatch deciding whether anything
// runs at all is the one line no case reaches. A rule is the only instrument
// left once the canary is structurally blind.
//
// AST, not text, for a reason measured rather than assumed: the census that
// scoped this work grepped for `pathToFileURL(process.argv[1])` and found 9
// files. It missed scripts/_serve-build.mjs, which spells the same defect
// `resolve(process.argv[1]) === fileURLToPath(import.meta.url)` -- reordered,
// different helpers, identical fail-open. A shape rule catches all of them; a
// text rule catches the spellings its author happened to think of.
//
// TWO BLIND SPOTS, both measured rather than reasoned about, and both stated
// here because the first draft of this paragraph got one of them wrong.
//
// (1) BINDING THE ENTRY TO A LOCAL FIRST. `const entry = process.argv[1]` on
// one line and `pathToFileURL(entry)` on another puts the two halves in
// different statements, and R6 -- a single-expression shape rule -- cannot see
// it. This paragraph originally went on to call that "a shape nobody in this
// repo has ever written". A review opened the tree and falsified it in one
// grep: scripts/check-rpc-typing.mjs carried exactly that spelling, and it is
// a gate in `npm run lint`, in pre-ship and in typecheck.yml. Measured through
// a junction it printed 0 bytes and exited 0 -- a lint gate reporting green
// having scanned nothing. It is converted in this same change, by hand, since
// the rule that was meant to find it could not. Closing the class properly
// needs R5's binding resolution; until then this is a known hole, not an
// argument that the hole is empty.
//
// (2) THE endsWith(basename) FAMILY. Six files dispatch on a suffix test
// rather than an equality compare -- check-added-session-room-contract.mjs,
// check-festival-detail-span.mjs, check-image-widths.mjs,
// check-sourcemap-debugids.mjs, check-upcoming-event-cover.mjs and
// hooks/pre-exec-guard.mjs. R6 never mentions them because they never mention
// import.meta. They are junction-SAFE (a suffix survives any path spelling),
// so they are not this arc's defect and are deliberately left alone here --
// but they fail open in the MIRROR direction, running on import whenever the
// importing process's argv[1] ends in the same basename. That is a different
// defect and wants its own change.
//
// So: R6 is a ratchet against the realpath-compare spelling and its obvious
// neighbours. It is not a proof that every dispatch in this repo is correct,
// and the two paragraphs above are the specific ways it is not.
// ---------------------------------------------------------------------------

const EQUALITY_TOKENS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

/** Does any node in `node`'s subtree satisfy `predicate`? */
function subtreeHas(node, predicate) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (predicate(n)) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

/** `import.meta` -- a MetaProperty, so it cannot be confused with a variable
 *  called `importMeta` or with the string "import.meta" in a comment. */
const isImportMeta = (n) =>
  ts.isMetaProperty(n) && n.keywordToken === ts.SyntaxKind.ImportKeyword;

/** `process.argv[1]` exactly. argv[0] is the node binary and argv[2..] are the
 *  script's own flags; neither has anything to do with entry-point identity. */
const isProcessArgv1 = (n) =>
  ts.isElementAccessExpression(n) &&
  ts.isPropertyAccessExpression(n.expression) &&
  ts.isIdentifier(n.expression.expression) &&
  n.expression.expression.text === 'process' &&
  n.expression.name.text === 'argv' &&
  n.argumentExpression !== undefined &&
  ts.isNumericLiteral(n.argumentExpression) &&
  n.argumentExpression.text === '1';

export function findRawEntryPointGuards(src) {
  const source = parse(src);
  // FAIL CLOSED ON SOURCE THAT DOES NOT PARSE -- the same reasoning as R5's.
  // TypeScript's parser recovers rather than throwing, so an unparseable file
  // would otherwise yield an empty hit list indistinguishable from a clean one.
  // Its own allowlist KIND, so a file that cannot be parsed is never recorded
  // as though it carried a raw guard.
  if ((source.parseDiagnostics ?? []).length > 0) {
    const first = source.parseDiagnostics[0];
    return [
      {
        rule: 'R6',
        kind: 'unparseable',
        line: 0,
        why: 'unparseable',
        detail:
          'the source does not parse (' +
          ts.flattenDiagnosticMessageText(first.messageText, ' ') +
          '), so nothing can be concluded about its entry-point guard',
      },
    ];
  }

  const hits = [];
  const visit = (n) => {
    if (ts.isBinaryExpression(n) && EQUALITY_TOKENS.has(n.operatorToken.kind)) {
      const importMetaLeft = subtreeHas(n.left, isImportMeta);
      const importMetaRight = subtreeHas(n.right, isImportMeta);
      const argvLeft = subtreeHas(n.left, isProcessArgv1);
      const argvRight = subtreeHas(n.right, isProcessArgv1);
      if ((importMetaLeft && argvRight) || (importMetaRight && argvLeft)) {
        hits.push({
          rule: 'R6',
          kind: 'raw-entry-point-guard',
          line: source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1,
          why: 'raw-compare',
          detail:
            'import.meta is compared against process.argv[1] directly; that ' +
            'mispredicts through a junction or symlink and the module silently ' +
            'does nothing. Use isEntryPoint() from scripts/lib/entry-point.mjs',
        });
        // One comparison is one violation: do not descend and count the halves
        // of a nested compare twice.
        return;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(source);
  return hits;
}

/**
 * R6's corpus is WIDER than R1-R5's.
 *
 * scanTree's guard list is a flat readdir of scripts/ filtered to
 * check-*.mjs / lint-*.mjs, which is right for rules about guards. But the two
 * worst instances of this defect were not guards: scripts/ship-gate.mjs and
 * scripts/hooks/review-stamp.mjs -- one a subdirectory away, the other not
 * matching the name pattern. If ship-gate's own dispatch mispredicts, the
 * review gate does not run and the push sails through. A rule that could not
 * see those two files would have been theatre.
 */
// bin/ currently holds only .sh and .cjs, so it contributes nothing today. It
// stays in the list deliberately -- an entry point added there later should be
// covered without anyone remembering to widen this -- but the header should not
// be read as saying bin/ is where any of the hits came from. .cjs is excluded
// because CommonJS answers this question with `require.main === module`, an
// identity comparison that no path spelling can fool.
const ENTRY_POINT_DIRS = ['scripts', 'bin'];
const ENTRY_POINT_SKIP_DIRS = new Set(['node_modules', '.git', 'fixtures', '__snapshots__']);

export async function entryPointCorpus(root, readdir = fs.readdir) {
  const out = [];
  const walk = async (relDir) => {
    let entries;
    try {
      entries = await readdir(path.join(root, relDir), { withFileTypes: true });
    } catch (error) {
      // bin/ is not present in every checkout, and a missing optional directory
      // is not a failure. Anything else is -- and must never read as "no files
      // here", which is R2's whole point.
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory()) {
        if (!ENTRY_POINT_SKIP_DIRS.has(entry.name)) await walk(relDir + '/' + entry.name);
      } else if (/\.(mjs|js)$/.test(entry.name)) {
        out.push(relDir + '/' + entry.name);
      }
    }
  };
  for (const dir of ENTRY_POINT_DIRS) await walk(dir);
  return out;
}

export function scanSource(src) {
  return [
    ...findSilentSkips(src),
    ...findSwallowedErrors(src),
    ...findExitDrift(src),
    ...findMissingCanary(src),
    ...findUnprovenExitContract(src),
  ];
}

/**
 * Collapse to { file: { "R1:empty-sample": n } } -- line-independent, so
 * reformatting a script does not churn the allowlist.
 */
export function tally(hits) {
  const out = {};
  for (const h of hits) {
    const k = h.rule + ':' + h.kind;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

async function scanTree(root) {
  const dir = path.join(root, 'scripts');
  const names = (await fs.readdir(dir))
    .filter((n) => /^(check|lint)-.*\.mjs$/.test(n) && !NOT_A_GUARD.has(n))
    .sort();

  const actual = {};
  // R5's diagnosis, kept beside the counts rather than inside the allowlist
  // key, so a script moving between R5 shapes mid-refactor does not land as a
  // stale entry plus an addition. See the note above the rule.
  const diagnosis = new Map();
  // R6's corpus is a strict SUPERSET of the guard list, so a guard read here is
  // a guard that must not be read again below. The first draft ran the two
  // passes independently and re-read + re-parsed all 89 guards -- measured at
  // 17% of the R6 pass, which is precisely the redundant second parse the note
  // above brags about having deleted. Recording what has been covered lets the
  // corpus loop skip it, and keeps the double-counting the old comment worried
  // about impossible by construction rather than by separation.
  const r6Covered = new Set();
  for (const name of names) {
    const rel = 'scripts/' + name;
    const src = await fs.readFile(path.join(dir, name), 'utf8');
    const hits = [...scanSource(src), ...findRawEntryPointGuards(src)];
    r6Covered.add(rel);
    const counts = tally(hits);
    if (Object.keys(counts).length > 0) actual['scripts/' + name] = counts;
    const r6hit = hits.find((h) => h.rule === 'R6');
    if (r6hit) diagnosis.set('R6 ' + rel, r6hit.why + ': ' + r6hit.detail);
    // Read off the HIT rather than calling diagnoseExitContract again. The
    // second call re-parsed every file to recompute an answer scanSource had
    // just thrown away -- measured at ~15% of scan time, and on a green run
    // the result is never even read.
    const r5hit = hits.find((h) => h.rule === 'R5');
    // Keyed by RULE and file, not file alone: a script can carry both an R5 and
    // an R6 hit, and a single-key map made whichever ran second overwrite the
    // other -- printing an entry-point diagnosis beside an exit-contract hit.
    if (r5hit) diagnosis.set('R5 scripts/' + name, r5hit.why + ': ' + r5hit.detail);
  }

  // R6 over the REST of its wider corpus -- see entryPointCorpus. Still not
  // folded into scanSource, which is the R1-R5 bundle and is called on the
  // guard list only; R6 is added alongside it above and finished off here.
  for (const rel of await entryPointCorpus(root)) {
    if (r6Covered.has(rel)) continue;
    const hits = findRawEntryPointGuards(await fs.readFile(path.join(root, rel), 'utf8'));
    if (hits.length === 0) continue;
    actual[rel] = { ...(actual[rel] ?? {}), ...tally(hits) };
    diagnosis.set('R6 ' + rel, hits[0].why + ': ' + hits[0].detail);
  }
  return { actual, diagnosis };
}

export function diffAgainstAllowlist(actual, allow) {
  const additions = [];
  const increases = [];
  const stale = [];

  for (const file of Object.keys(actual)) {
    for (const rule of Object.keys(actual[file])) {
      const a = actual[file][rule];
      const allowed = allow[file]?.[rule] ?? 0;
      if (allowed === 0) additions.push({ file, rule, actual: a, allowed: 0 });
      else if (a > allowed) increases.push({ file, rule, actual: a, allowed });
    }
  }
  for (const file of Object.keys(allow)) {
    for (const rule of Object.keys(allow[file])) {
      const allowed = allow[file][rule];
      const a = actual[file]?.[rule] ?? 0;
      if (a < allowed) stale.push({ file, rule, actual: a, allowed });
    }
  }
  return { additions, increases, stale };
}

// ---------------------------------------------------------------------------
// Self-test -- every rule proven in BOTH directions.
//
// This guard demands a canary of every other script, so it holds itself to it
// first. A rule that cannot fire is not a rule; a rule that always fires is not
// one either. Each case asserts a violating source DOES trip it and a clean
// source does NOT.
// ---------------------------------------------------------------------------
/** The canary could not be RUN. Infrastructure, so exit 2 -- not a failed case,
 *  which is exit 1 and means a convention was actually violated. */
export class CannotSelfTest extends Error {}

// async since the exit-contract cases at the bottom drive main(), which is.
async function selfTest() {
  const cases = [];
  const add = (name, fn, expected) => cases.push({ name, fn, expected });

  // Read UP FRONT, not lazily inside the case that uses it. Read there, a
  // renamed or deleted reference file becomes a THROWN case, which the runner
  // scores as a failure, which exits 1 -- "a convention was violated" -- for
  // what is plainly infrastructure. This file's own R3 puts that at 2, and a
  // guard that misreports its own inability to run is the fail-open shape the
  // whole file is about.
  const REFERENCE_IMPL = 'scripts/check-ci-budget.mjs';
  let referenceSource;
  try {
    referenceSource = readFileSync(path.join(ROOT, REFERENCE_IMPL), 'utf8');
  } catch (error) {
    throw new CannotSelfTest(
      'cannot read ' + REFERENCE_IMPL + ', the reference implementation the R5 ' +
        'shipped case measures against: ' + error.message,
    );
  }
  const src = (...lines) => lines.join('\n');

  // --- R1 silent-skip: positive ---
  add(
    'R1 fires: green exit after an empty-sample check',
    () => findSilentSkips(src('const rows = await q();', 'if (rows.length === 0) {', '  warn();', '  process.exit(0);', '}')).length,
    1,
  );
  add(
    'R1 fires: green exit when a token is missing',
    () => findSilentSkips(src('if (!token) {', '  warn();', '  process.exit(0);', '}')).length,
    1,
  );
  add(
    'R1 fires: bare return after a walled-preview probe',
    () => findSilentSkips(src('if (await previewIsWalled(BASE)) {', '  warn();', '  return;', '}')).length,
    1,
  );
  // The regression that motivated widening the trigger: wrapping the same probe
  // in a helper renamed the identifier out of the rule's sight, the construct
  // untouched, and R1 fell silent on two real call sites. A rule keyed on a name
  // needs a case per name, or the next wrapper repeats it.
  add(
    'R1 fires through the skipIfWalledPreview wrapper too',
    () => findSilentSkips(src('if (await skipIfWalledPreview(BASE)) {', '  return;', '}')).length,
    1,
  );
  // --- R1: negative ---
  add(
    'R1 silent: the same skip carrying a REQUIRE_ escalation',
    () => findSilentSkips(src('if (!token) {', '  if (process.env.REQUIRE_TOKEN) process.exit(1);', '  process.exit(0);', '}')).length,
    0,
  );
  add(
    'R1 silent: a plain success exit',
    () => findSilentSkips(src('report();', 'process.exit(0);')).length,
    0,
  );
  add(
    'R1 silent: a comment describing the old bug',
    () => findSilentSkips(src('// on rows.length === 0 we used to exit green -- fixed', 'assertRows(rows);')).length,
    0,
  );

  // --- R2 swallowed-error: positive ---
  add('R2 fires: single-line empty catch', () => findSwallowedErrors('try { read(); } catch {}').length, 1);
  add(
    'R2 fires: catch block with an empty body',
    () => findSwallowedErrors(src('try {', '  read();', '} catch (e) {', '}')).length,
    1,
  );
  add(
    'R2 fires: a .catch substituting a default',
    () => findSwallowedErrors('const x = await readdir(d).catch(() => []);').length,
    1,
  );
  // --- R2: negative ---
  add(
    'R2 silent: a catch that rethrows',
    () => findSwallowedErrors(src('try {', '  read();', '} catch (e) {', '  throw e;', '}')).length,
    0,
  );
  add(
    'R2 silent: a catch that exits',
    () => findSwallowedErrors(src('try {', '  read();', '} catch (e) {', '  process.exit(2);', '}')).length,
    0,
  );

  // --- R3 exit-drift: both directions ---
  add(
    'R3 fires: missing creds exiting 1 instead of 2',
    () => findExitDrift(src('if (!url || !key) {', '  report();', '  process.exit(1);', '}')).length,
    1,
  );
  add(
    'R3 silent: missing creds exiting 2',
    () => findExitDrift(src('if (!url || !key) {', '  report();', '  process.exit(2);', '}')).length,
    0,
  );

  // --- R4 no-canary: both directions ---
  add('R4 fires: a script with no canary', () => findMissingCanary('const x = 1;').length, 1);
  add('R4 silent: a script carrying one', () => findMissingCanary('function selfTest() {}').length, 0);
  add(
    'R4 fires: prose MENTIONING a self-test is not a canary',
    () => findMissingCanary(src('// remember to run the self-test here', 'const x = 1;')).length,
    1,
  );

  // --- R5 the canary drives the exit contract: both directions ---
  //
  // The shape every case is built against, spelled once. `owner` is what the
  // CLI takes its code from; `drives` is what the canary body does about it.
  const script = (owner, drives) =>
    src(
      'async function main(argv, deps) {',
      '  if (bad) return 2;',
      '  return 0;',
      '}',
      'function selfTest() {',
      '  ' + drives,
      '  return true;',
      '}',
      owner,
    );
  const REFERENCE = 'process.exitCode = await main(process.argv.slice(2));';
  // The DIAGNOSIS, not merely the count. A review found that swapping the three
  // branch bodies of diagnoseExitContract left every case green, because they
  // all asserted `.length` -- and that diagnosis is the only actionable line a
  // blocked author is shown. It is the same "pin WHICH branch spoke" law this
  // file applies to main()'s exit codes, which it was not applying to its own
  // new rule. `clean` rather than a null so a wrong answer prints readably.
  const r5 = (source) => findUnprovenExitContract(source)[0]?.why ?? 'clean';

  add(
    'R5 fires: a canary that proves the rules but never calls the exit owner',
    () => r5(script(REFERENCE, 'check(rules());')),
    'canary-skips-exit',
  );
  add(
    'R5 fires: the CLI computes its code inline, so nothing is drivable at all',
    () => r5(script('process.exit(result.ok ? 0 : result.infra ? 2 : 1);', 'main([]);')),
    'exit-not-drivable',
  );
  add(
    'R5 fires: main() sets process.exitCode as a side effect and returns nothing',
    () =>
      r5(
        src(
          'async function main() { if (bad) process.exitCode = 1; }',
          'function selfTest() { main(); return true; }',
          'main().catch(() => { process.exitCode = 2; });',
        ),
      ),
    'exit-not-drivable',
  );
  add(
    'R5 fires: a canary with no locatable body cannot be driving anything',
    () => r5(src('const SELF_TEST = true;', 'process.exitCode = await main(argv);')),
    'canary-body-not-found',
  );
  // The two near-misses a substring test accepts. Both were real risks in the
  // scanner, not hypotheticals: the first is how every `deps.main` reference
  // would read as a call, the second is how `mainLoop` would satisfy `main`.
  add(
    'R5 fires: naming the owner as a PROPERTY is not calling it',
    () => r5(script(REFERENCE, 'const f = deps.main(); f();')),
    'canary-skips-exit',
  );
  add(
    'R5 fires: calling mainLoop() does not satisfy an owner called main',
    () => r5(script(REFERENCE, 'mainLoop();')),
    'canary-skips-exit',
  );
  // --- The two FALSE NEGATIVES a review found in the first draft ---
  //
  // Both made canaryBody() hand back a region containing the CLI tail, where
  // `main(` always appears -- so R5 passed a canary that drives nothing. A
  // guard's lost-scanner branch has to fail CLOSED.
  add(
    'R5 fires: a brace-less arrow canary does not get to borrow the CLI tail',
    () =>
      r5(
        src(
          'async function main(argv) { return 0; }',
          'const selfTest = () => runCases(CASES);',
          'if (IS_CLI) { process.exitCode = await main(process.argv.slice(2)); }',
        ),
      ),
    'canary-skips-exit',
  );
  add(
    'R5 fires: a destructured parameter does not open the scan on the wrong brace',
    () =>
      r5(
        src(
          'async function main(argv) { return 0; }',
          'function selfTest({ log } = {}) { runCases(CASES); }',
          'process.exitCode = await main(process.argv.slice(2));',
        ),
      ),
    'canary-skips-exit',
  );
  // --- The fail-open a SECOND review found, and the class it belongs to ---
  //
  // The text scanner collected `if` as an exit owner whenever the exit line had
  // no semicolon, and since nearly every canary body contains an `if (`, the
  // rule reported CLEAN on a canary that drove nothing. This fixture is the
  // measured shape: semicolon-free, with a control-flow statement after it.
  add(
    'R5 fires: a semicolon-free CLI tail does not let a KEYWORD stand in for the owner',
    () =>
      r5(
        src(
          'async function main(argv) { return 0 }',
          'function selfTest() { if (bad) return false; return checkRules() }',
          'const code = await main(process.argv.slice(2))',
          'process.exitCode = code',
          'if (VERBOSE) { logSummary() }',
        ),
      ),
    'canary-skips-exit',
  );
  add(
    'R5 fires: a LOCAL stub named like the owner shadows it and proves nothing',
    () =>
      r5(
        src(
          'async function main(argv) { return 0; }',
          'function selfTest() { const main = () => 0; return main() === 0; }',
          'process.exitCode = await main(process.argv.slice(2));',
        ),
      ),
    'canary-skips-exit',
  );
  add(
    'R5 fires: a selfTest-PREFIXED helper does not get to answer for the real canary',
    () =>
      r5(
        src(
          'async function main(argv) { return 0; }',
          'const selfTestCase = (n) => ({ drive: () => main([n]) });',
          'function selfTest() { return checkRules(); }',
          'process.exitCode = await main(process.argv.slice(2));',
        ),
      ),
    'canary-skips-exit',
  );
  add(
    'R5 fires: source that does not PARSE concludes nothing, rather than borrowing the CLI tail',
    () =>
      r5(
        src(
          'async function main(argv) { return 0; }',
          'function selfTest() {',
          '  runCases(CASES);',
          'process.exitCode = await main(process.argv.slice(2));',
        ),
      ),
    'unparseable',
  );
  // --- What a THIRD review round found in the AST draft ---
  //
  // An exit owner is the call whose VALUE becomes the code, not every call in
  // the expression. This file's own CLI tail once made `String` an owner (from
  // String(error) in a .catch formatter) and passed only because a canary
  // helper happened to call String() -- "fires only by luck", which is exactly
  // what the header criticises the old text scanner for.
  add(
    'R5: an argument is not an exit owner, however it is spelled',
    () =>
      [...exitOwners('process.exitCode = await main(parseArgs(argv));').keys()].join(','),
    'main',
  );
  add(
    'R5: a .catch formatter does not donate its helpers to the owner list',
    () =>
      [
        ...exitOwners(
          'process.exitCode = await main(argv).catch((e) => { log(String(e)); return 2; });',
        ).keys(),
      ].join(','),
    'main',
  );
  add(
    'R5 silent: an owner bound by a DESTRUCTURED declaration is still an owner',
    () =>
      r5(
        src(
          'async function main(argv) { return { code: 0 }; }',
          'function selfTest() { return main([]).code === 0; }',
          'const { code } = await main(process.argv.slice(2));',
          'process.exit(code);',
        ),
      ),
    'clean',
  );
  add(
    'R5 silent: a local inside a NESTED helper is not a shadow of the owner',
    () =>
      r5(
        src(
          'async function main(argv) { return 0; }',
          'function selfTest() {',
          '  const build = () => { const main = 1; return main; };',
          '  build();',
          '  return main([]) === 0;',
          '}',
          'process.exitCode = await main(process.argv.slice(2));',
        ),
      ),
    'clean',
  );

  // --- The two FALSE POSITIVES the same review found ---
  add(
    'R5 silent: a canary driving main() through a module-scope helper still drives it',
    () =>
      r5(
        src(
          'async function main(argv, deps) { return 0; }',
          'const runMain = (argv, extra) => main(argv, { ...sealed, ...extra });',
          'function selfTest() { return runMain([], {}) === 0; }',
          'process.exitCode = await main(process.argv.slice(2));',
        ),
      ),
    'clean',
  );
  add(
    'R5 silent: a canary spelled as a function EXPRESSION is still a canary',
    () =>
      r5(
        src(
          'async function main(argv) { return 0; }',
          'const selfTest = async function () { return (await main([])) === 0; };',
          'process.exitCode = await main(process.argv.slice(2));',
        ),
      ),
    'clean',
  );
  add(
    'R5 silent: an owner reached through .then() is still an owner',
    () =>
      r5(
        src(
          'async function main(argv) { return 0; }',
          'function selfTest() { return main([]) === 0; }',
          'main(process.argv.slice(2)).then((c) => { process.exitCode = c; });',
        ),
      ),
    'clean',
  );
  add(
    'R5 silent: a prettier-wrapped assignment still names its owner',
    () =>
      r5(
        src(
          'async function main(argv) { return 0; }',
          'function selfTest() { return main([]) === 0; }',
          'process.exitCode =',
          '  await main(process.argv.slice(2));',
        ),
      ),
    'clean',
  );
  add(
    'R5 silent: an owner reached through a variable is still an owner',
    () =>
      r5(
        src(
          'async function main(argv) { return 0; }',
          'function selfTest() { return main([]) === 0; }',
          'const code = await main(process.argv.slice(2));',
          'process.exit(code);',
        ),
      ),
    'clean',
  );
  // --- R5: negative ---
  add(
    'R5 silent: the reference shape -- the canary drives main() and reads its code',
    () =>
      r5(script(REFERENCE, "const code = await main(['--x'], {});")),
    'clean',
  );
  add(
    'R5 silent: a script with NO canary is R4 debt, not R5 debt, and is never double-charged',
    () => r5(src('const x = 1;', 'process.exit(2);')),
    'clean',
  );
  add(
    'R5 silent: reporting the CANARY exit does not by itself make selfTest an owner',
    () =>
      r5(
        src(
          'async function main(argv) { return 0; }',
          'function selfTest() { return main([]) === 0; }',
          'if (flag) process.exitCode = selfTest() ? 0 : 1;',
          'else process.exitCode = await main(argv);',
        ),
      ),
    'clean',
  );
  // The rule is NOT keyed on the name `main`: check-mojibake.mjs really does
  // call its owner runScan(), and a main-only rule would pass it unlooked-at.
  add(
    'R5 silent: an owner named something other than main, driven by the canary',
    () =>
      r5(
        src(
          'function runScan() { return 1; }',
          'function selfTest() { return runScan() === 1; }',
          "process.exitCode = argv.includes('--self-test') ? selfTest() : runScan();",
        ),
      ),
    'clean',
  );
  // .includes() sits between the CLI and its code in a real script
  // (check-upcoming-event-cover.mjs). Read as an owner it is one no canary can
  // ever call, so the rule would fire on a compliant file forever.
  add(
    'R5 silent: a method call on the way to the code is not an exit owner',
    () =>
      r5(
        src(
          'async function main() { return 0; }',
          'function selfTest() { return main(); }',
          "process.exitCode = process.argv.includes('--self-test') ? (selfTest() ? 0 : 1) : await main();",
        ),
      ),
    'clean',
  );
  add(
    'R5: exitOwners reads the owner off the CLI, whatever it is called',
    () => [...exitOwners('process.exitCode = await sweep(argv);').keys()].join(','),
    'sweep',
  );
  add(
    'R5: callsFunction rejects a property and a longer name, accepts a call',
    () =>
      [
        callsFunction('deps.main();', 'main'),
        callsFunction('mainLoop();', 'main'),
        callsFunction('await main( x );', 'main'),
      ].join(','),
    'false,false,true',
  );
  // The one case that runs against REAL source rather than a 10-line fixture.
  // check-ci-budget.mjs is the shape R5 was generalised from, so if it ever
  // stops satisfying the rule, either it regressed or the detector did --
  // and a rule proven only against its own fixtures is proven against nothing.
  add(
    'R5 shipped: check-ci-budget.mjs -- the reference implementation -- satisfies the rule',
    () => r5(referenceSource),
    'clean',
  );

  // THE NAMED GAP, pinned so it cannot move by accident. This case asserts what
  // the rule DOES today, not what it ought to do: an exit statement inside any
  // function body leaves only the inner value-producer in the owner list, so a
  // canary driving that alone passes with the wiring unproven. It is here
  // because prose rots and an executable claim does not -- if a future change
  // makes this FIRE, that is progress, and the NAMED GAP block in the header
  // must be rewritten in the same commit. Do not "fix" this case on its own.
  // Three attempts to close the gap by widening ownership to the enclosing
  // function were built and reverted on 2026-08-19; see the header for why a
  // fourth static one is not the answer.
  add(
    'R5 GAP (documented, NOT desired): an assignment inside a function is not seen',
    () =>
      r5(
        src(
          'function verdict(d) { return d.ok ? 0 : 1; }',
          'function main() { process.exitCode = verdict(); }',
          'function selfTest() { return verdict({ ok: true }) === 0; }',
          'main();',
        ),
      ),
    'clean',
  );

  // --- R6 raw entry-point guard: positive ---
  //
  // Each fixture below is a spelling that EXISTED in this repo on 2026-08-12,
  // not an invented one. The last two are why the rule is an AST shape rather
  // than a grep: the census that scoped the conversion searched for the first
  // spelling and missed them.
  const r6 = (code) => findRawEntryPointGuards(code).map((h) => h.kind).join(',');

  add(
    'R6 fires: the canonical two-line IS_CLI compare',
    () =>
      r6(
        src(
          'const IS_CLI =',
          '  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;',
          'if (IS_CLI) { main(); }',
        ),
      ),
    'raw-entry-point-guard',
  );
  add(
    'R6 fires: the truthy one-line isMain compare',
    () => r6('const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;'),
    'raw-entry-point-guard',
  );
  add(
    'R6 fires: bare, with no undefined arm at all',
    () => r6('if (import.meta.url === pathToFileURL(process.argv[1]).href) { main(); }'),
    'raw-entry-point-guard',
  );
  add(
    'R6 fires REVERSED -- argv on the left, import.meta on the right (scripts/_serve-build.mjs)',
    () => r6('const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);'),
    'raw-entry-point-guard',
  );
  add(
    'R6 fires on !== too: negating the compare does not make it realpath-aware',
    () => r6('if (import.meta.url !== pathToFileURL(process.argv[1]).href) return;'),
    'raw-entry-point-guard',
  );
  add(
    'R6 fires through an UNSEEN helper: the rule is a shape, not a list of spellings',
    () => r6('if (canonicalise(process.argv[1]) == someFutureHelper(import.meta.url)) { main(); }'),
    'raw-entry-point-guard',
  );
  // Non-vacuity: the count is asserted, not merely "it found something". Two
  // dispatches in one file must read as two violations, or the ratchet cannot
  // tell a partial conversion from a complete one.
  add(
    'R6: two raw compares in one file count as two',
    () =>
      findRawEntryPointGuards(
        src(
          'const a = import.meta.url === pathToFileURL(process.argv[1]).href;',
          'const b = import.meta.url === pathToFileURL(process.argv[1]).href;',
        ),
      ).length,
    2,
  );

  // --- R6: negative ---
  add(
    'R6 silent: the fixed form, isEntryPoint(import.meta.url)',
    () =>
      r6(
        src(
          "import { isEntryPoint } from './lib/entry-point.mjs';",
          'if (isEntryPoint(import.meta.url)) { process.exitCode = await main(process.argv.slice(2)); }',
        ),
      ),
    '',
  );
  add(
    'R6 silent: a COMMENT describing the old idiom is not a call site',
    () =>
      r6(
        src(
          '// import.meta.url === pathToFileURL(process.argv[1]).href used to live here',
          'if (isEntryPoint(import.meta.url)) { main(); }',
        ),
      ),
    '',
  );
  add(
    'R6 silent: the idiom quoted as a STRING (this file quotes it, and its own canary does)',
    () => r6(`const fixture = "import.meta.url === pathToFileURL(process.argv[1]).href";`),
    '',
  );
  add(
    'R6 silent: reading process.argv[1] without comparing it to import.meta',
    () => r6('const entry = process.argv[1]; console.log(entry);'),
    '',
  );
  add(
    'R6 silent: import.meta.url used for a path with no argv compare in sight',
    () => r6("const ROOT = path.dirname(fileURLToPath(import.meta.url));"),
    '',
  );
  add(
    'R6 silent: argv[0] and argv[2] are not entry-point identity',
    () =>
      r6(
        src(
          'if (import.meta.url === pathToFileURL(process.argv[0]).href) {}',
          'if (import.meta.url === pathToFileURL(process.argv[2]).href) {}',
        ),
      ),
    '',
  );
  add(
    'R6 silent: a variable merely NAMED importMeta is not import.meta',
    () => r6('const importMeta = { url: 1 }; if (importMeta.url === process.argv[1]) {}'),
    '',
  );
  add(
    'R6 silent: an ASSIGNMENT is not a comparison',
    () => r6('let x; x = process.argv[1]; const y = import.meta.url;'),
    '',
  );
  // The blind spot, asserted rather than described. If someone later teaches R6
  // binding resolution, this case goes RED and tells them to update the header
  // that currently promises it does not see this shape.
  add(
    'R6 KNOWN BLIND SPOT: the entry bound to a local first is not seen (documented, not fixed)',
    () =>
      r6(
        src(
          'const entry = process.argv[1];',
          'if (import.meta.url === pathToFileURL(entry).href) { main(); }',
        ),
      ),
    '',
  );
  // Fail-closed, same contract as R5's. An unparseable file must not read as
  // clean, and must not be recorded as a raw guard either -- hence its own kind.
  add(
    'R6: source that does not PARSE concludes nothing rather than reporting clean',
    () => r6(src('function broken() {', '  if (a) {', 'const x = 1;')),
    'unparseable',
  );
  // The two cases that run against REAL source. A rule proven only against its
  // own fixtures is proven against nothing -- and these are the two files where
  // a mispredicted dispatch does the most damage.
  add(
    'R6 shipped: ship-gate.mjs carries no raw guard',
    () => r6(readFileSync(path.join(ROOT, 'scripts/ship-gate.mjs'), 'utf8')),
    '',
  );
  add(
    'R6 shipped: hooks/review-stamp.mjs carries no raw guard',
    () => r6(readFileSync(path.join(ROOT, 'scripts/hooks/review-stamp.mjs'), 'utf8')),
    '',
  );
  // The corpus is the other half of the rule: a detector that works over a file
  // list which omits the file is still a green guard on a broken repo. These
  // pin the two paths the flat guard-list walk could never have reached.
  add(
    'R6 corpus: reaches a SUBDIRECTORY (scripts/hooks/) and a non check-* name (ship-gate.mjs)',
    async () => {
      const files = await entryPointCorpus(ROOT);
      return [
        files.includes('scripts/hooks/review-stamp.mjs'),
        files.includes('scripts/ship-gate.mjs'),
        files.includes('scripts/_serve-build.mjs'),
        files.includes('scripts/lib/entry-point.mjs'),
      ].join(',');
    },
    'true,true,true,true',
  );
  add(
    'R6 corpus: a missing optional directory is skipped, a real read error is NOT swallowed',
    async () => {
      const enoent = Object.assign(new Error('nope'), { code: 'ENOENT' });
      const eacces = Object.assign(new Error('denied'), { code: 'EACCES' });
      const skipped = await entryPointCorpus(ROOT, async () => {
        throw enoent;
      });
      let raised = 'no';
      try {
        await entryPointCorpus(ROOT, async () => {
          throw eacces;
        });
      } catch (error) {
        raised = error.code;
      }
      return skipped.length + ',' + raised;
    },
    '0,EACCES',
  );

  // --- Canaries for the three scanner defects found in review ---
  add(
    'stripNoise: a quote inside a regex class does not blank the line',
    () => (stripNoise(`const re = /['"]/; process.exit(0);`).includes('process.exit(0)') ? 1 : 0),
    1,
  );
  // The hatch is judged over R1's own 12-line window, so an escalation sitting
  // NEXT to a skip is still taken to guard it -- deliberate. What must not
  // happen is a token 50 lines away silencing the whole file, which is how
  // check-sourcemap-debugids.mjs hid its zero-sample green exit.
  add(
    'R1 fires: an escalation ELSEWHERE in the file does not disarm the rule',
    () =>
      findSilentSkips(
        src(
          'if (process.env.REQUIRE_TOKEN) enforce();',
          ...Array(14).fill('const filler = 1;'),
          'const checked = probe();',
          'if (checked === 0) process.exit(0);',
        ),
      ).length,
    1,
  );
  add(
    'R2 fires: an empty catch followed by an unrelated exit',
    () =>
      findSwallowedErrors(src('try {', '  read();', '} catch (e) {', '}', 'if (bad) process.exit(1);'))
        .length,
    1,
  );

  // --- Ratchet semantics: the stale case is what keeps it shrinking ---
  add(
    'ratchet: a new violation is an addition',
    () => diffAgainstAllowlist({ 'a.mjs': { 'R1:empty-sample': 1 } }, {}).additions.length,
    1,
  );
  add(
    'ratchet: a count increase fails',
    () => diffAgainstAllowlist({ 'a.mjs': { 'R1:empty-sample': 2 } }, { 'a.mjs': { 'R1:empty-sample': 1 } }).increases.length,
    1,
  );
  add(
    'ratchet: a FIXED violation fails as stale, forcing a re-baseline',
    () => diffAgainstAllowlist({}, { 'a.mjs': { 'R1:empty-sample': 1 } }).stale.length,
    1,
  );
  add(
    'ratchet: an exact match passes',
    () => {
      const d = diffAgainstAllowlist({ 'a.mjs': { 'R1:empty-sample': 1 } }, { 'a.mjs': { 'R1:empty-sample': 1 } });
      return d.additions.length + d.increases.length + d.stale.length;
    },
    0,
  );

  // --- The guard must survive its own rules ---
  add('self: stripNoise blanks a block comment', () => stripNoise('/* x */a').trim(), 'a');
  add('self: stripNoise keeps real code', () => stripNoise('exit(0);'), 'exit(0);');

  // --- THE EXIT-CODE CONTRACT ITSELF (R5), driven through main() ---
  //
  // R5 is the rule this file added, and NOT_A_GUARD exempts this file from the
  // scan that enforces it. The exemption is right -- a scanner that scanned
  // itself would report its own SKIP_TRIGGERS patterns as violations -- but it
  // is an exemption from the SCAN, not from the rule. These cases are the rule
  // applied by hand, and they are what stops "do as I say" from being the
  // literal shape of this file.
  //
  // Two branches return 2 (an unknown flag, and a check that could not run), so
  // a case asserting the integer alone would pass for the wrong reason. Each
  // pins its branch: the flag case by the message it prints, the infra case by
  // being run with a VALID flag so the flag branch cannot be what answered.
  const SILENT = () => {};
  // The base refuses to do real work. Without this, a case that stops reaching
  // its injected collaborator falls through to a real 90-script scan and a real
  // allowlist read -- slow, and green for the wrong reason.
  const sealedDeps = {
    err: SILENT,
    check: () => {
      throw new Error('the canary reached the real tree scan -- inject check');
    },
    canary: () => {
      throw new Error('the canary re-entered itself -- inject canary');
    },
  };
  const runMain = (argv = [], extra = {}) => main(argv, { ...sealedDeps, ...extra });
  /** The code beside the branch that spoke, so 2-vs-2 is never ambiguous. */
  const mainOutcome = async (argv, extra = {}) => {
    const said = [];
    const code = await runMain(argv, { ...extra, err: (line) => said.push(String(line)) });
    return code + '|' + (said.join('\n').includes('Unknown flag(s)') ? 'bad-flag' : 'silent');
  };

  add(
    'exit: a clean tree is 0',
    () => runMain([], { check: async () => ({ ok: true }) }),
    0,
  );
  add(
    'exit: a convention violation is 1, not a warning nobody acts on',
    () => runMain([], { check: async () => ({ ok: false }) }),
    1,
  );
  add(
    'exit: a guard that COULD NOT RUN is 2, and not from the flag branch',
    () => mainOutcome([], { check: async () => ({ ok: false, infra: true }) }),
    '2|silent',
  );
  // The crash path lived in the `if (IS_CLI)` tail until a review pointed out
  // no case could reach it -- and a tail handler that stops returning an
  // integer sets process.exitCode = undefined, so node exits 0 and a crashed
  // guard reports GREEN. It moved into main() so this case can exist.
  add(
    'exit: a check that CRASHES is 2, not 1, and says so rather than swallowing it',
    async () => {
      const said = [];
      const code = await runMain([], {
        check: () => {
          throw new Error('ENOENT: no such file or directory');
        },
        err: (line) => said.push(String(line)),
      });
      return code + '|' + (said.join('\n').includes('COULD NOT RUN') ? 'reported' : 'silent');
    },
    '2|reported',
  );
  add(
    'exit: an unknown flag is 2, proven with a check that would have answered 0',
    () => mainOutcome(['--nope'], { check: async () => ({ ok: true }) }),
    '2|bad-flag',
  );
  // The third sub-assertion is here because of a MUTATION, not a reading:
  // dropping the `await` in main() left this case green while the two canaries
  // it injected were synchronous. The real canary -- selfTest itself -- is
  // async, so unawaited it returns a Promise, which is truthy, which makes a
  // FAILING self-test exit 0. That is the guard reporting green having just
  // proved it was broken, and nothing else in this file would have noticed.
  add(
    'exit: --self-test reports the canary, 0 for pass and 1 for fail -- including an ASYNC one',
    async () => {
      const pass = await runMain(['--self-test'], { canary: () => true });
      const fail = await runMain(['--self-test'], { canary: () => false });
      const asyncFail = await runMain(['--self-test'], { canary: async () => false });
      return pass + ',' + fail + ',' + asyncFail;
    },
    '0,1,1',
  );
  add(
    'exit: a canary that could not RUN is 2, and an ordinary crash is NOT swallowed into one',
    async () => {
      const infra = await runMain(['--self-test'], {
        canary: () => {
          throw new CannotSelfTest('reference implementation missing');
        },
      });
      const crashed = await runMain(['--self-test'], {
        canary: () => {
          throw new TypeError('x is not a function');
        },
      }).then(
        (code) => 'returned ' + code,
        (error) => 'rethrew ' + error.name,
      );
      return infra + '|' + crashed;
    },
    '2|rethrew TypeError',
  );
  add(
    'exit: a canary whose verdict is not a boolean is 2, never a truthy pass',
    async () => {
      // A canary refactored into returning a count, and one that forgot to
      // return at all. Both are truthy-or-falsy by accident; neither is a
      // verdict. (A canary returning a Promise OF a boolean is fine and
      // answers 0/1 -- it is awaited above. The bad case is the unawaited
      // Promise OBJECT, which is what the missing-await mutant produces.)
      const counted = await runMain(['--self-test'], { canary: () => 0 });
      const nothing = await runMain(['--self-test'], { canary: () => undefined });
      return counted + ',' + nothing;
    },
    '2,2',
  );
  add(
    'exit: --write reaches the re-baseline path rather than being swallowed as a flag',
    async () => {
      let saw = null;
      await runMain(['--write'], {
        check: async (opts) => {
          saw = opts.write;
          return { ok: true, written: true };
        },
      });
      return saw;
    },
    true,
  );

  let failed = 0;
  for (const c of cases) {
    let got;
    try {
      // Awaited: a case that returns a Promise would otherwise be compared as
      // an object and fail with an unreadable diff -- or, worse, be compared
      // against a truthy expectation and pass without ever resolving.
      got = await c.fn();
    } catch (error) {
      got = 'threw: ' + error.message;
    }
    const ok = got === c.expected;
    if (!ok) failed++;
    const detail = ok ? '' : '  (expected ' + JSON.stringify(c.expected) + ', got ' + JSON.stringify(got) + ')';
    console.log((ok ? 'ok  ' : 'FAIL') + '  ' + c.name + detail);
  }

  if (failed > 0) {
    console.error('\nFAIL self-test -- ' + failed + ' of ' + cases.length + ' case(s).');
    return false;
  }
  console.log('\nPASS self-test -- ' + cases.length + ' cases, every rule proven in both directions.');
  return true;
}

// ---------------------------------------------------------------------------

export async function run({ write = false, root = ROOT } = {}) {
  const { actual, diagnosis } = await scanTree(root);
  const allowlistAbs = path.join(root, ALLOWLIST_PATH);

  if (write) {
    const sorted = {};
    for (const f of Object.keys(actual).sort()) {
      sorted[f] = {};
      for (const r of Object.keys(actual[f]).sort()) sorted[f][r] = actual[f][r];
    }
    await fs.writeFile(allowlistAbs, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
    const total = Object.values(sorted).reduce(
      (s, rs) => s + Object.values(rs).reduce((a, b) => a + b, 0),
      0,
    );
    console.log('Wrote ' + ALLOWLIST_PATH + ' (' + total + ' violation(s) across ' + Object.keys(sorted).length + ' script(s)).');
    return { ok: true, written: true };
  }

  let allow = {};
  try {
    allow = JSON.parse(await fs.readFile(allowlistAbs, 'utf8'));
  } catch (error) {
    console.error('Script-conventions guard: cannot read ' + ALLOWLIST_PATH + ' (' + error.message + ').');
    console.error('Generate it with: node scripts/check-script-conventions.mjs --write');
    return { ok: false, infra: true };
  }

  const { additions, increases, stale } = diffAgainstAllowlist(actual, allow);

  if (additions.length === 0 && increases.length === 0 && stale.length === 0) {
    const owed = Object.values(allow).reduce((s, rs) => s + Object.values(rs).reduce((a, b) => a + b, 0), 0);
    console.log('Script-conventions guard passed (' + owed + ' known violation(s) still owed in ' + ALLOWLIST_PATH + ').');
    return { ok: true };
  }

  // A script that just gained its first canary lands as an R5 ADDITION plus an
  // R4 STALE, and the additions banner then accuses its author of adding a new
  // dishonest guard for having paid down debt. Naming the promotion is the
  // difference between a ratchet people work with and one they route around.
  const promoted = additions
    .filter((a) => a.rule.startsWith('R5:'))
    .map((a) => a.file)
    .filter((file) => stale.some((s) => s.file === file && s.rule.startsWith('R4:')));
  if (promoted.length > 0) {
    console.error('\nR4 -> R5 PROMOTION (progress, not a new defect):\n');
    for (const file of promoted) {
      console.error('  ~ ' + file + '  gained a canary (R4 paid) that does not yet drive its');
      console.error('    exit owner (R5 owed). Finish the job, or record the step with --write.');
    }
  }
  if (additions.length > 0) {
    console.error('\nScript-conventions guard FAILED: a NEW guard script can report green without checking.\n');
    console.error('  R1 silent-skip     add an escalation env (REQUIRE_*/*_ENFORCE) or assertMeasured(),');
    console.error('                     or fail instead of skipping. See scripts/lib/previewProbe.mjs.');
    console.error('  R2 swallowed-error rethrow, exit 2, or record the failure. A file that could not');
    console.error('                     be read has not been checked.');
    console.error('  R3 exit-drift      0 pass / 1 contract violated / 2 infrastructure.');
    console.error('  R4 no-canary       prove it fails: see check-plan-hygiene.mjs.');
    console.error('  R5 unproven-exit   the canary must CALL the function whose return value');
    console.error('                     becomes process.exitCode. See check-ci-budget.mjs:');
    console.error('                     main(argv, deps) returns the code, the CLI assigns it,');
    console.error('                     and the canary drives it with injected collaborators.');
    console.error('                     R5 proves the VALUE is drivable, NOT that the assignment');
    console.error('                     runs: moving it inside main() hides it from the rule, so');
    console.error('                     a pass is not proof. See the NAMED GAP block in the');
    console.error('                     header before treating one as such.');
    console.error('  R6 raw-entry-point never compare import.meta against process.argv[1] yourself --');
    console.error('                     it mispredicts through a junction/symlink and the script');
    console.error('                     exits 0 having run NOTHING, canary included. Use');
    console.error('                     isEntryPoint(import.meta.url) from scripts/lib/entry-point.mjs.\n');
    for (const v of additions) {
      // R5 and R6 each keep one allowlist kind on purpose, so the diagnosis is
      // printed here rather than encoded in the key -- see the notes above the
      // rules. The map is keyed by rule AND file; see scanTree.
      const why = /^R[56]:/.test(v.rule)
        ? (diagnosis.get(v.rule.slice(0, 2) + ' ' + v.file) ?? '')
        : '';
      console.error('  + ' + v.file + '  ' + v.rule + '  (x' + v.actual + ')' + (why ? '  -- ' + why : ''));
    }
  }
  if (increases.length > 0) {
    console.error('\nScript-conventions guard FAILED: more violations than the allowlist permits.\n');
    for (const v of increases) {
      console.error('  ^ ' + v.file + '  ' + v.rule + '  (' + v.actual + ' > allowed ' + v.allowed + ')');
    }
  }
  if (stale.length > 0) {
    console.error('\nScript-conventions guard FAILED: stale allowlist entries (a violation was fixed -- good!).');
    console.error('Shrink the allowlist to lock in the win:  node scripts/check-script-conventions.mjs --write\n');
    for (const v of stale) {
      console.error('  - ' + v.file + '  ' + v.rule + '  (' + v.actual + ' < allowed ' + v.allowed + ')');
    }
  }
  console.error('');
  return { ok: false };
}

/**
 * The CLI, and the 0/1/2 exit contract it owns: 0 pass, 1 a convention was
 * violated, 2 the guard could not run.
 *
 * THIS FUNCTION EXISTS BECAUSE OF R5, WHICH THIS FILE ADDED. Before it, the
 * mapping from a result to a code lived inline in the `if (IS_CLI)` block --
 * unreachable from the canary, so a guard that demands every other script prove
 * its exit codes could not prove its own. NOT_A_GUARD exempts this file from
 * its own SCAN, which is right (it is the scanner), but that exemption was
 * quietly covering the rule as well. Two branches below return 2, so each
 * carries a case that pins WHICH one spoke; asserting only "it returned 2" is
 * the inert subset-relation assert the ratchet cases 400 lines up warn about.
 *
 * The collaborators are injected for one reason: without them a canary case
 * would have to scan all 90 scripts and read the real allowlist off disk to
 * reach a single return statement.
 */
export async function main(argv = [], deps = {}) {
  const {
    root = ROOT,
    err = console.error,
    check = run,
    canary = selfTest,
  } = deps ?? {};
  const KNOWN_FLAGS = ['--write', '--self-test'];
  const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a));
  if (unknown.length > 0) {
    err('Unknown flag(s): ' + unknown.join(', ') + '. Known: ' + KNOWN_FLAGS.join(', '));
    return 2;
  }

  if (argv.includes('--self-test')) {
    let passed;
    try {
      passed = await canary();
    } catch (error) {
      // Only THIS class becomes a code. A blanket catch here would turn a
      // genuine crash in the canary into a tidy exit 2, which is the swallowed
      // error rule R2 forbids everywhere else in this tree.
      if (!(error instanceof CannotSelfTest)) throw error;
      err('The canary could not RUN: ' + error.message);
      err('Exit 2, not 1: nothing was measured, so nothing was proven violated.');
      return 2;
    }
    // A BOOLEAN, not a truthy value. Found by mutation: drop the `await` above
    // and canary() answers a Promise, which is truthy, which exits 0 -- so the
    // canary printed "FAIL self-test -- 1 of 46" and the CI step went GREEN.
    // A guard reporting success from a run that had just proved it was broken
    // is the exact failure this whole file exists to catch, and it was one
    // keyword away in the file that catches it. Truthiness is not a verdict.
    if (typeof passed !== 'boolean') {
      err(
        'The canary returned ' + Object.prototype.toString.call(passed) + ' rather than a ' +
          'boolean, so its verdict cannot be read. This is exit 2: the self-test may ' +
          'well have failed, and a truthy non-boolean would have been reported as a pass.',
      );
      return 2;
    }
    return passed ? 0 : 1;
  }

  // INSIDE main(), not in the CLI tail, so a canary case can drive it. Left in
  // the tail it was unreachable from every case -- and a handler that stops
  // returning an integer sets process.exitCode = undefined, so node exits 0 and
  // a crashed guard reports GREEN. That is the rules-measured/codes-asserted
  // gap R5 exists to close, in R5's own file.
  //
  // Not a swallowed error (R2): the stack is printed in full. What changes is
  // only the CODE -- scanTree's fs reads are unguarded, so an unreadable
  // scripts/ dir used to land as an unhandled rejection and exit 1, "a
  // convention was violated", for a guard that measured nothing at all.
  let result;
  try {
    result = await check({ write: argv.includes('--write'), root });
  } catch (error) {
    err('The guard COULD NOT RUN: ' + (error?.stack ?? String(error)));
    err('Exit 2, not 1: nothing was measured, so nothing was proven violated.');
    return 2;
  }
  return result.ok ? 0 : result.infra ? 2 : 1;
}

// Only act as a CLI when actually invoked as one. Unguarded, the top-level
// scan plus process.exit ran on mere `import`, so a spec that pulled in one of
// the exports above scanned all 83 guards and then killed the test runner.
// The comparison is realpath-to-realpath (see scripts/lib/entry-point.mjs);
// the argv[1]-vs-import.meta.url string compare this used to do reported 0
// bytes and exit 0 through a junction -- including for --self-test, so the
// canary attested to a run that never happened. R6 keeps it that way.
if (isEntryPoint(import.meta.url)) {
  // process.exitCode, never process.exit(): a bare exit discards whatever is
  // still buffered on stdout, and the block this guard prints when it fails is
  // the longest thing it ever says. Measured on a sibling guard in Linux CI:
  // 904 lines became 194.
  //
  // Nothing else lives here. main() owns every code including the crash path,
  // precisely so the canary can drive all of them; a mapping that sits in this
  // block is one no case can reach.
  process.exitCode = await main(process.argv.slice(2));
}
