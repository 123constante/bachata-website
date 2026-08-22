#!/usr/bin/env node
/**
 * CI integrity check for the "ghost override" drift class on
 * calendar_occurrences: is_override = true left behind after the P5 override
 * row emptied, with no real override content anywhere (no venue/city, empty
 * payload, no session/added-session overrides) -- the "ghost OVR badge" class.
 * Calls public.check_override_mirror_ghost_v1().
 *
 * WHERE THE SYMPTOM ACTUALLY SHOWS, corrected in review: in the ADMIN EDITOR,
 * not on this repo's public pages. The admin migration's own header says
 * "an OVR/deviation badge that never clears in the editor", and a grep of
 * src/ here finds is_override in the generated types and NOWHERE else -- no
 * public surface reads the flag. An earlier draft of this comment claimed a
 * public event page renders its badge off it; that was false, and it was the
 * stated blast radius of a permanent CI gate. This guard lives here because
 * the admin migration wires it here (its header names this workflow and this
 * script), and because the drift is a DATA fault whichever surface reads it.
 *
 * Local:  node scripts/check-override-mirror-ghost.mjs             (reads .env)
 *         node scripts/check-override-mirror-ghost.mjs --self-test (prove it fails)
 * CI:     .github/workflows/db-contract-check.yml step 68, with repo secrets
 *           VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * Exit: 0 pass, 1 ghost rows present, 2 infrastructure -- credentials, an RPC
 * failure, a throw, or a payload this guard cannot read. Anon-callable; no
 * Docker. See admin migration
 * 20260704140000_check_override_mirror_ghost_and_heal_v1.
 *
 * FIFTH ATTEMPT. Four drafts of this guard have been reverted, and the last two
 * died the same way: the INSTRUMENT used to prove the work was scoped by the
 * author's expectations. A hand-picked mutation battery under-reported twice in
 * one day, and a fixture built from imagination pinned a branch production
 * cannot produce. Both lessons are load-bearing below; see
 * ~/.claude/plans/queued-251-ghost-guard-v3-reverted.md for the full account.
 *
 * SHAPE DRIFT IS 2, NEVER 1 IN THIS FILE, and that split is the whole design.
 * Exit 1 in this repo means "prod data violates a contract" and a human goes
 * and fixes rows. A renamed key, a SETOF re-declaration returning an ARRAY, or
 * a numeric field arriving as a string are all the GUARD being unable to read
 * the answer, so every type gate below returns 2.
 *
 * "IN THIS FILE" IS LOAD-BEARING, because this is not house doctrine and
 * writing it as though it were would be false. Check #67
 * (scripts/check-program-day-offsets.mjs), which shipped into this same
 * workflow, returns 1 for a missing function and for both of its sample floors.
 * Neither convention is corrected here; reconciling the two is a call nobody
 * has made. Read the paragraph above as the rule for THIS guard, and do not
 * port it outward on the strength of the word "never".
 *
 * The VALUE gates are not uniformly 1 either. The sample-size floor returns 2,
 * because measuring zero rows is this guard failing to read rather than prod
 * violating anything. Only the two ghost verdicts return 1.
 *
 * WHY main() TAKES ITS COLLABORATORS. The exit contract is what CI reads, and
 * until a canary can drive main() itself, flipping any `return 2` to `return 0`
 * leaves a rules-only canary completely green -- measured on the first draft by
 * mutation: with `process.exitCode = code` changed to `= 0`, the live run
 * printed "RPC failed" and exited 0, and its --self-test still reported 5/5 ok.
 * Shape copied from scripts/check-ci-budget.mjs, this repo's reference seam.
 *
 * WHAT IS INJECTED, AND WHAT IS DELIBERATELY NOT. The client, the .env reader,
 * both output sinks, the retry wait and the TIMER FUNCTIONS are injected. The
 * TIMEOUT VALUE is not, and that is the correction of a named defect: the
 * previous draft injected `rpcTimeoutMs` so the abort case would not cost 20
 * real seconds, and in doing so made the shipped 20_000 unprovable -- a canary
 * could not tell it from 20_000_000. Injecting the timer instead buys the same
 * speed while leaving the constant on the only path there is, so a case can
 * record the milliseconds the guard actually asks for. This repo's
 * seam_proves_one_property_hides_others note is exactly this trap; it was
 * walked into once already, by the person who wrote the note.
 */
/**
 * WHAT THE CANARY CANNOT SEE. The battery behind that claim was GENERATED from
 * this file rather than chosen: every numeric literal, every comparison
 * operator and every `||`/`&&` in it was mutated mechanically, one at a time,
 * and each mutant run through `--self-test`. That construction is stated
 * because it bounds the answer -- it sweeps operators and constants, and it
 * does NOT sweep deleted statements, reordered branches or renamed keys. Judge
 * its reach from the method, not from a survivor count; the previous draft
 * presented a hand-picked sweep as a complete account and the reviewer found
 * three more survivors in the same file the same afternoon.
 *
 * Three classes are known to be outside ANY case here, and each is named at the
 * code concerned rather than left to be re-found. Two of them are the same
 * shape: an exit code is ultimately a literal, and a literal cut to 0 cannot be
 * caught by the process whose exit code it IS. Only a reader outside the
 * process can see those.
 *
 *   THE DISPATCH LINE at the foot of this file. `process.exitCode = await
 *   main(...)` cut to `await main(...)` leaves --self-test printing every ok
 *   line while a live violation exits 0. Four mechanisms have been aimed at
 *   this one line and all four were proven blind -- see
 *   ~/.claude/plans/queued-r7-dispatch-exit-wiring.md. It is a repo-wide gap
 *   shared with every sibling guard, and Ricky's 2026-08-20 decision is that it
 *   is closed repo-wide or not at all. Do NOT invent a fifth per-step
 *   mechanism here; the previous three all looked convincing too.
 *
 *   THE --self-test EXIT CODE, `? 0 : 1` in run() below. Cut to `? 0 : 0` the
 *   canary DETECTS the damage -- it prints "FAIL self-test -- 1 of N" from the
 *   two cases that drive runSelfTest -- and then exits 0 anyway, because the
 *   expression it is trying to prove is the one producing the process's own
 *   code. MEASURED, not theorised: it is the single silent survivor of the
 *   generated battery described above. A step that required the canary's PASS
 *   LINE would catch it, and an earlier draft of the workflow step did exactly
 *   that; it was deleted because it existed on ONE of the four steps built on
 *   this seam and Ricky's 2026-08-20 decision is that this class is closed
 *   repo-wide or not at all. Queued with the census in
 *   ~/.claude/plans/queued-r7-dispatch-exit-wiring.md. Do not re-add it here
 *   alone -- #66, #67 and og-scrape-evidence carry the identical hole.
 *
 *   THE ROOT-THEN-CWD BINDING of the .env reader. Every case injects
 *   readDotEnv, so `readEnvDirs(same ? [ROOT] : [ROOT, cwd])` collapsing to
 *   `[cwd]` -- the exact shape of the mutant that reverted the 2026-08-22
 *   extraction attempt on this seam -- is unproven by any case here.
 *   readEnvDirs itself IS driven, with fixture directories, against the
 *   additive merge rule; only the identifiers that feed it (ROOT, cwd, same)
 *   are not. Verified instead by running the live guard from a foreign cwd
 *   before shipping, not by a unit case.
 *
 * NAMED GAP, not an oversight: the sample-size floor is `> 0`, so a partial
 * read returning 1 row of 357 still passes. A tighter floor would be a number
 * nobody measured, and a floor guessed rather than measured reds ordinary work.
 * The zero edge is the one that is provably wrong; that is the one pinned.
 *
 * RETIREMENT, stated so the successor does not loosen it instead: at single-
 * engine convergence Lever 1E the legacy mirror goes and is_override reaches 0
 * legitimately. This guard then reds permanently and indistinguishably from an
 * outage. The correct response is to DELETE this step with the mirror, never to
 * relax the floor to >= 0 -- which would restore exactly the blind spot the
 * floor exists to close.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RPC_NAME = 'check_override_mirror_ghost_v1';
const KNOWN_FLAGS = ['--self-test'];

/**
 * Named in the exit-1 message, because the operator who reads that message is
 * standing in THIS repo and the repair is not in it. Verified against live
 * pg_proc on 2026-08-20: there is no callable heal. The migration below ships
 * the check as a function and the heal as a one-time `DO $heal$` UPDATE beside
 * it, so "re-run the heal" means authoring a new ADMIN migration carrying that
 * UPDATE again -- not calling something. A message naming a function that does
 * not exist would be worse than naming nothing.
 */
const HEAL_MIGRATION = '20260704140000_check_override_mirror_ghost_and_heal_v1.sql';

/**
 * The bound on ONE attempt, and the wait between the two.
 *
 * Bounds copied from the sibling guard (check-program-day-offsets.mjs), because
 * the two share a 5-minute job and an unbounded call here is not this step's
 * problem alone. This step has `timeout-minutes: 2`; a stalled edge that burns
 * it takes the budget out of check #65, the outbound image sweep that runs LAST
 * and is therefore the one that gets CANCELLED -- reported with no named cause,
 * pointing at the wrong guard entirely.
 *
 * The worst case this file can produce from the inside is
 * 2 * RPC_TIMEOUT_MS + RETRY_DELAY_MS = 42s, comfortably inside the step's two
 * minutes. Measured for scale rather than assumed: the whole workflow ran
 * 1m36s-2m6s across the twelve runs before 2026-08-21, against a 5-minute job
 * budget, so the sum of declared per-step maxima exceeding that budget is a
 * worst case that has never occurred. Raise either constant and that stops
 * being true silently.
 */
const RPC_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 2000;

/**
 * TRANSIENT, AS THE TRANSPORT ACTUALLY DELIVERS IT.
 *
 * Every needle here was read out of node_modules/@supabase/postgrest-js/dist/
 * index.mjs rather than imagined, because the previous draft's classifier
 * carried two that CANNOT match. That module (line 48) defaults
 * shouldThrowOnError to false, so line 152 catches every fetch rejection and
 * RESOLVES it as
 *
 *     { message: `${err.name}: ${err.message}`, details, hint: '', code: '' }
 *
 * with the underlying cause put in DETAILS, never in message. So a socket reset
 * arrives as message `TypeError: fetch failed` and details `... Caused by:
 * Error: read ECONNRESET (ECONNRESET)`. The previous draft matched `econnreset`
 * and `socket hang up` against MESSAGE; neither could ever fire, and dead code
 * that reads as coverage is worse than no coverage. They are gone, and the
 * `fetch failed` arm that does cover that shape is driven by a case built from
 * the reply above.
 *
 * The PG code arrives via JSON.parse of the response body (line 124), so it is
 * a STRING -- `'57014'`, not 57014. It is nonetheless COERCED rather than
 * compared with ===, because a transport that hands it back as a number would
 * otherwise drop the retry silently and turn a routine anon statement_timeout
 * into a red across a 79-step job. Both directions are driven below; the
 * previous draft pinned only the one that does not occur.
 *
 * TWO message needles, not three. An earlier draft carried `statement timeout`
 * AND `canceling statement`, which are two halves of ONE real PostgreSQL
 * message -- so the `||` between them could be flipped to `&&` with every case
 * still passing, because every fixture matched both. One needle per DISTINCT
 * failure shape is what makes each arm individually killable, and each is
 * driven by a case whose message matches it alone.
 *
 * Deliberately narrow: a bare `includes('timeout')` would absorb a genuine
 * contract failure whose message happened to contain the word, which is the
 * failure this whole file is built against.
 *
 * An abort raised by this guard's OWN timer is NOT classified here. It is a
 * fact about our AbortController, read off `signal.aborted` at the call site,
 * never sniffed out of a message.
 */
export function isTransient(err) {
  if (!err) return false;
  if (String(err.code ?? '') === '57014') return true;
  const msg = String(err.message ?? '').toLowerCase();
  return msg.includes('statement timeout') || msg.includes('fetch failed');
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// The verdict, as a pure function of the RPC's reply
// ---------------------------------------------------------------------------

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * What arrived, in the words an operator can act on.
 *
 * NaN and Infinity are typeof 'number', so without their own arms the finite
 * gate below emits "total_is_override is not a finite number (got number)" -- a
 * sentence that denies itself and leaves the reader unable to tell a non-finite
 * value from a type mismatch.
 */
const describe = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'Infinity';
  return typeof value;
};

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * Every branch's message carries a phrase no other branch's does, because the
 * canary pins WHICH branch produced a code. Ten branches return 2 here; from
 * outside they are one integer, and a case asserting only "it returned 2"
 * passes for the wrong reason. Change a message and change its NEEDLE.
 *
 * `timeout` is REQUIRED, with no default. It is `{ timedOut, ms }` where
 * timedOut is read off this guard's own AbortController after the call -- a
 * fact about our timer rather than a guess about somebody's error text. The
 * previous draft had no timeout branch at all and its canary fixture REJECTED
 * on abort, which the transport never does; the case therefore pinned
 * `2|cannot-measure` for a situation production answers `2|rpc-error` on. Same
 * integer, wrong branch, in a file whose thesis is that the integer alone
 * cannot say which branch spoke.
 */
export function verdict(data, error, timeout = { timedOut: false, ms: RPC_TIMEOUT_MS }) {
  if (timeout.timedOut) {
    return {
      code: 2,
      message:
        RPC_NAME + ' did not answer within ' + timeout.ms + 'ms and was aborted by this ' +
        'guard. Nothing was measured, so this is infrastructure and not a data violation. ' +
        'If it persists the RPC got slower than the bound in this file.',
    };
  }
  if (error) return { code: 2, message: 'RPC failed: ' + error.message };

  if (!isPlainObject(data)) {
    return {
      code: 2,
      message:
        RPC_NAME + ' returned a payload that is not a plain object (got ' + describe(data) +
        '). A SETOF or RETURNS TABLE re-declaration lands here as an array; that is the ' +
        'guard being unable to read the answer, not a data violation.',
    };
  }
  if (!isNumber(data.ghost_count)) {
    return {
      code: 2,
      message:
        'ghost_count is not a finite number (got ' + describe(data.ghost_count) +
        '). The payload shape drifted, so nothing was measured.',
    };
  }

  /**
   * THE GHOST VERDICT, AS SOON AS IT IS READABLE, and above every gate it does
   * not depend on.
   *
   * The ladder validated total_is_override and ok FIRST until review drove it:
   * { ok: false, ghost_count: 7, total_is_override: '357' } exited 2 saying
   * "the payload shape drifted" -- seven violating prod rows reported as an
   * infrastructure notice with the repair block never printed, and an earlier
   * canary case pinned that downgrade as CORRECT. Only ghost_count's own type
   * is needed to read a ghost count; the shapes of the other two fields say
   * nothing about whether those rows exist.
   *
   * Rows FOUND is evidence even when the rest of the payload looks broken, and
   * a suspect read cannot un-find them. Downgrading a real violation is the
   * worse of the two errors, so it is designed out here AND at the sample floor
   * below. Code a new branch from what it MEANS, and from what it actually
   * DEPENDS ON -- never from its position in this ladder.
   */
  if (data.ghost_count !== 0) {
    return {
      code: 1,
      message:
        'FAIL: ' + data.ghost_count + ' ghost override row(s) found (is_override=true with ' +
        'no override content anywhere).\n' +
        '      Repair in the ADMIN repo, not here. The heal is the one-time UPDATE beside \n' +
        '      the check in ' + HEAL_MIGRATION + ',\n' +
        '      a DO block rather than a callable function -- so re-running it means a NEW\n' +
        '      admin migration carrying that UPDATE again. Do not relax this check.',
    };
  }

  // Past this point ghost_count is a readable ZERO, so nothing below can hide a
  // violation -- these gates decide only whether the zero can be BELIEVED.
  if (!isNumber(data.total_is_override)) {
    return {
      code: 2,
      message:
        'total_is_override is not a finite number (got ' + describe(data.total_is_override) +
        '). The payload shape drifted, so the zero above cannot be believed.',
    };
  }
  if (typeof data.ok !== 'boolean') {
    return {
      code: 2,
      message:
        'ok is not a boolean (got ' + describe(data.ok) + '). Truthiness would ship the ' +
        'string "false" as a pass, so the type is required, not coerced.',
    };
  }
  if (data.total_is_override <= 0) {
    return {
      code: 2,
      message:
        'Measured ' + data.total_is_override + ' rows with is_override=true. Prod always ' +
        'carries some, so a non-positive count is a broken read and not a clean result.',
    };
  }
  /**
   * Cross-checked deliberately: ok and ghost_count are two views of the same
   * answer, and the first draft read only ok -- so { ok: true, ghost_count: 7 }
   * passed while printing the 7 in the dump directly above the verdict.
   *
   * THIS one stays BELOW the sample floor, and the asymmetry with the ghost
   * verdict above is deliberate rather than an oversight -- review asked. `ok`
   * is the RPC's own opinion, not a count of rows: over a zero-row read it
   * carries no information the floor does not carry better, and "one of them is
   * lying" sends an operator to reconcile two fields when the actual fault is
   * that nothing was read. A positive ghost_count is different in kind -- it is
   * rows, and rows survive a broken denominator.
   */
  if (data.ok !== true) {
    return {
      code: 1,
      message:
        'FAIL: the RPC reported ok=false while counting 0 ghost rows. The two fields ' +
        'disagree, so this payload cannot be read as a pass.\n' +
        '      Deliberately NOT the repair above: no row is known to be wrong here, so\n' +
        '      clearing is_override on anything would be guessing. Read the function body\n' +
        '      in ' + HEAL_MIGRATION + '\n' +
        '      -- ok and ghost_count are computed there and one of them is lying.',
    };
  }
  return {
    code: 0,
    message:
      'OK: no ghost override rows (checked ' + data.total_is_override +
      ' row(s) with is_override=true).',
  };
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/**
 * KEPT IN THIS FILE, not extracted to scripts/lib/.
 *
 * The previous draft moved this pair into scripts/lib/dotenv.mjs with a
 * docstring saying it existed to stop the copy in check-program-day-offsets.mjs
 * diverging -- and then migrated no call site, including that one. Two
 * implementations plus a false claim is worse than two implementations.
 * Unifying them is a change to a SHIPPED guard with its own canary and belongs
 * in its own PR (queued), not smuggled in behind this one.
 *
 * The sibling picked up the SAME credential-resolution fix in this PR
 * (name-major, blank-aware; ROOT-then-cwd) -- driven, not assumed; see its own
 * header. Its PARSER still differs: only double quotes stripped, `export `
 * still not handled, no inline-comment stripping. That gap is PR A's, not
 * this one's, and stays open until then.
 */
const ENV_FILES = ['.env.local', '.env', '.env.development'];

/**
 * Object.create(null), and not for tidiness. Every bug in this parser presents
 * downstream as a confusing missing-credentials exit 2, and a plain `{}` gives
 * a .env line spelled `__proto__=x` or `constructor=x` a silent, invisible
 * effect on the result -- the one failure mode this module can least afford to
 * add. A null-prototype bag makes those ordinary keys.
 */
export function parseDotEnv(text) {
  const vars = Object.create(null);
  for (const raw of String(text).split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice('export '.length).trim();
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    let value = line.slice(idx + 1).trim();
    const quoted = value.length > 1 && ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      // An UNQUOTED trailing comment is a comment, as it is everywhere else
      // that reads these files. Kept out of the value because
      // `VITE_SUPABASE_URL=https://x.supabase.co # prod` otherwise reaches
      // createClient, which throws "Invalid URL" -- and the operator gets
      // COULD NOT MEASURE instead of the branch that names the two secrets.
      // Quoted values are untouched: inside quotes a `#` is data.
      const hash = value.indexOf(' #');
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    vars[key] = value;
  }
  return vars;
}

/**
 * The three files this repo actually keeps keys in, FIRST file wins.
 *
 * Reading only .env gave one machine two answers: a developer keeping
 * credentials in .env.local got a green #67 beside a #68 that exited 2 and
 * blamed the secrets.
 */
export function readEnvFiles(dir) {
  const merged = Object.create(null);
  for (const name of ENV_FILES) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    const parsed = parseDotEnv(fs.readFileSync(file, 'utf8'));
    for (const key of Object.keys(parsed)) {
      // FIRST NON-BLANK wins, not first PRESENT. `VITE_SUPABASE_URL=` left in
      // .env.local shadowed the real value in .env under first-present, and the
      // guard then exited 2 blaming absent secrets that were sitting in the
      // next file down -- byte for byte the failure firstValue() below was
      // written to stop, one layer lower and covered by no case. Found in
      // review, after a docstring here had already claimed the class was
      // closed: naming a blind spot is not closing it.
      if (String(merged[key] ?? '').trim() === '') merged[key] = parsed[key];
    }
  }
  return merged;
}

/**
 * NO DEFAULT PARAMETER on readEnvFiles itself, deliberately. A `dir = ROOT`
 * default is a seam every canary case could override, so the ROOT-vs-cwd
 * resolution below would never once be driven and could be changed to
 * `process.cwd()` with the canary still reporting PASS. readEnvDirs stays
 * equally explicit -- it takes the directory LIST, never defaults it.
 *
 * ROOT, then cwd -- additive, not a replacement. ROOT is resolved from
 * import.meta.url, so it is right regardless of where the process was
 * launched from; cwd is tried SECOND, purely as an addition, so a caller
 * whose working directory holds its own credentials still finds them --
 * without letting a foreign cwd's files beat ROOT's own when both define the
 * same name (first-non-blank-per-name, the same rule readEnvFiles already
 * uses across files). Read twice only when the two directories differ.
 */
export function readEnvDirs(dirs) {
  const merged = Object.create(null);
  for (const dir of dirs) {
    const bag = readEnvFiles(dir);
    for (const key of Object.keys(bag)) {
      if (String(merged[key] ?? '').trim() === '') merged[key] = bag[key];
    }
  }
  return merged;
}

/**
 * `cwd === ROOT` is compared case-insensitively on win32 only -- this repo's
 * own mount hazards (junction/drive-letter-casing) can make process.cwd() and
 * a path resolved from import.meta.url differ only in case for the identical
 * directory, which would otherwise defeat the collapse below and read the
 * same three files twice. Not attempted on POSIX, where case is significant
 * and folding it would wrongly merge two genuinely different directories.
 *
 * RESIDUAL, stated rather than papered over: readEnvDirs above is driven
 * directly with fixture directories, but THIS function's own binding of ROOT
 * and process.cwd() into that list is not -- every canary case injects
 * readDotEnv over it. That is the same accepted gap readEnvFiles(ROOT) always
 * carried; see the header. Verified instead by running the live guard from a
 * foreign cwd before shipping, not by a unit case.
 */
function defaultReadDotEnv() {
  const cwd = process.cwd();
  const same = process.platform === 'win32'
    ? path.resolve(cwd).toLowerCase() === path.resolve(ROOT).toLowerCase()
    : cwd === ROOT;
  return readEnvDirs(same ? [ROOT] : [ROOT, cwd]);
}

/**
 * Imported lazily so `--self-test` -- the one mode needing no environment --
 * does not pay 120-180ms to load a client it never constructs, and stays
 * runnable in a tree with no node_modules.
 */
async function defaultMakeClient(url, key) {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * First non-blank value, NAME-major then SOURCE-major.
 *
 * Source-major (this function's shape until 2026-08-22) fixed the blank-export
 * hole below -- and opened a worse one: a FALLBACK name exported by a running
 * `supabase start` (bare SUPABASE_URL) beat the PRIMARY name (VITE_SUPABASE_URL)
 * sitting correctly in this repo's own files, because source-major checks env
 * against every name before ever looking at the files. That reads the LOCAL
 * stack against prod-correct files and turns a healthy tree into a false
 * CONTRACT violation (exit 1, "apply the ADMIN migration") -- worse than the
 * blank-shadowing bug it replaced, which only ever produced an honest exit 2.
 *
 * Name-major closes both without reopening either: for each name, in order,
 * take the first non-blank value across [env, files]. A blank export still
 * falls through to a real file value FOR THAT NAME (case below), and
 * db-contract-check.yml exports secrets under the PRIMARY names only
 * (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY), so CI already wins on
 * the NAME axis -- source-major bought CI nothing it did not already have.
 */
const firstValue = (sources, ...names) => {
  for (const name of names) {
    for (const source of sources) {
      const value = String(source[name] ?? '').trim();
      if (value) return value;
    }
  }
  return '';
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/**
 * The CLI, and the 0/1/2 exit contract it owns.
 *
 * WHAT REJECTS A TYPO is the unknown-flag filter on run()'s first line. The
 * `argv.includes('--self-test')` below it is Array.prototype.includes -- exact
 * element matching, not a substring test -- and is correct exactly where it
 * stands. A successor told the danger lives THERE deletes a sound line and
 * leaves the real defence untouched. Without the filter, `--selftest` -- or any
 * future workflow typo -- falls straight through to the live check, and the R4
 * proof CI believes it ran never ran at all.
 *
 * EVERY throw inside this function is caught and mapped to 2, not just the one
 * around the RPC. A rejection escaping main() reaches the top-level await at
 * the dispatch and node exits 1 -- and 1 in this guard means "prod carries
 * ghost override rows". A read-only .env, a broken import of the client library
 * and a malformed URL would each have announced a data violation that did not
 * exist.
 */
export async function main(argv = [], deps = {}) {
  const {
    env = process.env,
    readDotEnv = defaultReadDotEnv,
    makeClient = defaultMakeClient,
    out = console.log,
    err = console.error,
    // Injected for the same reason as the sinks: without them the retry case
    // costs a real 2000ms wait and the abort case a real 20 seconds, and a
    // canary nobody wants to run is a canary that stops being run.
    //
    // The TIMER is injected; the DURATION is not. RPC_TIMEOUT_MS is read from
    // the constant on the only path there is, so a case recording what setTimer
    // was handed pins the shipped value rather than one the canary chose.
    sleep = defaultSleep,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    // Injected for ONE reason: without it the code a FAILING canary returns is
    // undrivable from inside a passing canary, and `? 0 : 1` could be mutated
    // to `? 0 : 0` -- a self-test that fails while exiting 0 -- with the suite
    // completely green. Its DEFAULT needs no separate case: --self-test is the
    // only way the suite runs at all, so a default pointing anywhere else
    // prints no verdict line and the mutation harness scores it dead.
    runSelfTest = selfTest,
  } = deps ?? {};

  try {
    return await run({
      argv, env, readDotEnv, makeClient, out, err, sleep, setTimer, clearTimer, runSelfTest,
    });
  } catch (thrown) {
    err('');
    err('COULD NOT MEASURE: ' + (thrown && thrown.message ? thrown.message : String(thrown)));
    err(
      'This is exit 2 on purpose. An unhandled throw out of here exits 1, and 1 is this ' +
        'guard telling an operator that prod carries ghost override rows -- an ' +
        'infrastructure fault wearing a data violation.',
    );
    return 2;
  }
}

async function run({
  argv, env, readDotEnv, makeClient, out, err, sleep, setTimer, clearTimer, runSelfTest,
}) {
  const unknown = argv.filter((arg) => !KNOWN_FLAGS.includes(arg));
  if (unknown.length > 0) {
    err('Unknown flag(s): ' + unknown.join(', ') + '. Known: ' + KNOWN_FLAGS.join(', '));
    return 2;
  }
  if (argv.includes('--self-test')) {
    // The `1` here is a NAMED GAP, measured rather than assumed: cut to 0, the
    // canary still prints "FAIL self-test" and the process still exits 0. Two
    // cases below drive both arms through the injected runSelfTest and catch
    // the damage in the OUTPUT; nothing inside this process can catch it in the
    // CODE. See the header, and queued-r7-dispatch-exit-wiring.md.
    return (await runSelfTest(out, err)) ? 0 : 1;
  }

  const fromFiles = readDotEnv();
  const url = firstValue([env, fromFiles], 'VITE_SUPABASE_URL', 'SUPABASE_URL');
  const key = firstValue(
    [env, fromFiles],
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
  );
  if (!url || !key) {
    err(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. This guard reads the ' +
        'live database and cannot run without credentials -- a read that never happened ' +
        'is not a clean bill of health.',
    );
    return 2;
  }

  // No CATCH here: main()'s single catch owns every throw on this path, so the
  // client library failing to import, the URL being malformed and the RPC
  // rejecting all land on one branch with one message. The try below is a
  // `finally` for the timer only -- it swallows nothing.
  const client = await makeClient(url, key);

  /**
   * ONE attempt, bounded, reporting whether OUR controller ended it.
   *
   * `timedOut` is read off the signal rather than sniffed out of the error,
   * and that is the whole point. With shouldThrowOnError false the transport
   * RESOLVES an aborted request as an ordinary error object carrying
   * `code: ''` and a message of `AbortError: ...` -- indistinguishable by
   * inspection from any other fetch-level failure, and matching none of
   * isTransient's needles. Sniffing would have left a stalled RPC un-retried,
   * which is precisely the noise the retry exists to absorb.
   */
  const callRpc = async () => {
    const ac = new AbortController();
    const timer = setTimer(() => ac.abort(), RPC_TIMEOUT_MS);
    try {
      const reply = await client.rpc(RPC_NAME).abortSignal(ac.signal);
      return { data: reply.data, error: reply.error, timedOut: ac.signal.aborted };
    } finally {
      clearTimer(timer);
    }
  };

  let { data, error, timedOut } = await callRpc();
  if (timedOut || (error && isTransient(error))) {
    err(
      'Transient failure (' +
        (timedOut ? 'aborted after ' + RPC_TIMEOUT_MS + 'ms' : (error.code || '?') + ': ' + error.message) +
        '); retrying once in ' + RETRY_DELAY_MS + 'ms...',
    );
    await sleep(RETRY_DELAY_MS);
    ({ data, error, timedOut } = await callRpc());
  }

  const { code, message } = verdict(data, error, { timedOut, ms: RPC_TIMEOUT_MS });

  // Dumped only when it IS a plain object, and only after the verdict is known.
  // The first draft printed the payload unconditionally, one line above the
  // message "RPC returned no payload -- nothing was measured".
  if (isPlainObject(data)) out(JSON.stringify(data, null, 2));
  if (code === 0) out('\n' + message);
  else err('\n' + message);

  return code;
}

// ---------------------------------------------------------------------------
// Canary (R4/R5) -- every case drives main(), and pins which branch spoke
// ---------------------------------------------------------------------------

/**
 * TEN branches return 2 and TWO return 1, so the integer alone cannot say which
 * one fired. Each case therefore asserts `code|branch`, where the branch is
 * recovered from the message needle below. That is not belt-and-braces: with a
 * code-only assertion, deleting the credentials gate leaves the missing-creds
 * case green, because control then reaches the injected client and a canary
 * that seals nothing scores its 2 from somewhere else entirely.
 *
 * The base is SEALED -- no credentials, no client, no output -- and each case
 * opts in to exactly what it proves. A case that defaulted makeClient would be
 * network-free only for as long as control returned before reading it, which is
 * precisely the line most likely to be deleted by the mutation this canary
 * exists to catch.
 *
 * ORDER MATTERS in this list: the first needle found in stderr names the
 * branch, so no two messages may share a phrase. 'did not answer within' sits
 * ahead of 'RPC failed' and the two texts are disjoint.
 */
const NEEDLES = [
  ['Unknown flag(s)', 'bad-flag'],
  ['Missing VITE_SUPABASE_URL', 'no-creds'],
  ['COULD NOT MEASURE', 'cannot-measure'],
  ['did not answer within', 'rpc-timeout'],
  ['RPC failed', 'rpc-error'],
  ['is not a plain object', 'bad-payload-type'],
  ['total_is_override is not a finite number', 'bad-total-type'],
  ['ghost_count is not a finite number', 'bad-ghost-type'],
  ['ok is not a boolean', 'bad-ok-type'],
  ['Prod always carries some', 'nothing-measured'],
  ['ghost override row(s) found', 'ghost-rows'],
  ['reported ok=false', 'not-ok'],
];

const HEALTHY = { ok: true, sample: [], ghost_count: 0, total_is_override: 357 };
const CREDS = {
  VITE_SUPABASE_URL: 'https://project.supabase.test',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'anon-key',
};

/**
 * A PostgREST error, as index.mjs line 124 builds it: `JSON.parse(body)`. The
 * code is therefore a STRING, which is the direction that actually occurs and
 * the one the previous draft's only coercion fixture did NOT pin.
 */
const pgError = (code, message) => ({ data: null, error: { code, message, details: '', hint: null } });

/**
 * A fetch-level failure, as index.mjs lines 152-178 RESOLVE it -- not reject.
 * message is `${err.name}: ${err.message}` and the underlying cause goes to
 * DETAILS, which is why matching `econnreset` against message can never fire.
 */
const fetchFailure = (name, message, cause) => ({
  data: null,
  error: {
    message: name + ': ' + message,
    details: name + ': ' + message + (cause ? '\n\nCaused by: ' + cause : ''),
    hint: '',
    code: '',
  },
});

/** What an AbortController-cancelled request resolves to. Not a rejection. */
const ABORTED = fetchFailure('AbortError', 'This operation was aborted');

export async function selfTest(out = console.log, err = console.error) {
  const cases = [];
  const add = (name, run, expected) => cases.push({ name, run, expected });

  const SILENT = () => {};
  const sealed = {
    out: SILENT,
    err: SILENT,
    env: {},
    readDotEnv: () => ({}),
    makeClient: () => {
      throw new Error('the canary reached the real Supabase client -- inject makeClient');
    },
    // Sealed like the rest: a case that triggers a retry without meaning to
    // would otherwise stall the suite for a real RETRY_DELAY_MS.
    sleep: SILENT,
    // The DEFAULT timer would make the stalling case cost 20 real seconds.
    // Neutered here and driven deliberately by the three timer cases below,
    // one of which records the milliseconds the guard asks for -- so the
    // shipped constant is pinned even though the function is injected.
    setTimer: () => 0,
    clearTimer: SILENT,
  };
  const runMain = (argv = [], extra = {}) => main(argv, { ...sealed, ...extra });

  /**
   * The builder postgrest-js actually returns: `.rpc(name)` hands back a
   * builder, `.abortSignal(sig)` stores the signal and returns THE BUILDER
   * (dist/index.mjs line 309), and the builder is awaited afterwards. The
   * previous draft's fixture returned the reply straight out of abortSignal,
   * which `await` tolerates but the transport never does.
   *
   * The fixture DEMANDS the signal. A fixture that quietly accepted a missing
   * one would let the timeout be deleted with every case still green -- and an
   * unbounded call here is the failure that cancels check #65 and gets reported
   * against the wrong guard.
   */
  const clientFrom = (replyFor) => async (url, key) => {
    if (url !== CREDS.VITE_SUPABASE_URL || key !== CREDS.VITE_SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('main() passed through the wrong credentials: ' + url + ' / ' + key);
    }
    return {
      rpc: (name) => {
        if (name !== RPC_NAME) throw new Error('main() called the wrong RPC: ' + name);
        return {
          signal: null,
          abortSignal(signal) {
            this.signal = signal;
            return this;
          },
          then(onFulfilled, onRejected) {
            const promise = !this.signal || typeof this.signal.aborted !== 'boolean'
              ? Promise.reject(new Error('main() called the RPC with no abort signal'))
              : Promise.resolve(replyFor(this.signal));
            return promise.then(onFulfilled, onRejected);
          },
        };
      },
    };
  };

  /** One reply, however many attempts -- the shape every non-retry case wants. */
  const clientOf = (data, error = null) => clientFrom(async () => ({ data, error }));

  /**
   * Never answers on its own; resolves TRANSPORT-STYLE the moment the guard's
   * controller aborts. That resolution is the correction of the defect that
   * reverted the previous draft: its fixture REJECTED on abort, so the case
   * asserted 2|cannot-measure for a situation production answers on a
   * different branch entirely.
   */
  const stallingClient = () =>
    clientFrom(
      (signal) =>
        new Promise((resolve) => {
          if (signal.aborted) return resolve(ABORTED);
          signal.addEventListener('abort', () => resolve(ABORTED));
        }),
    );

  /** A credentialled run against a fixture payload. */
  const live = (data, error = null) => ({ env: CREDS, makeClient: clientOf(data, error) });

  /**
   * The exit code beside the name of the branch that spoke.
   *
   * `silent` means stderr was EMPTY, not merely that no needle matched. The
   * looser spelling made the two indistinguishable, and it cost a mutant:
   * routing the passing verdict to stderr still scored 0|silent, so the healthy
   * case's own name -- "says nothing on stderr" -- asserted something no case
   * measured. Unclassified output is now its own answer.
   */
  const mainOutcome = async (argv = [], extra = {}) => {
    const said = [];
    const code = await runMain(argv, { ...extra, err: (line) => said.push(String(line)) });
    const text = said.join('\n');
    const hit = NEEDLES.find(([needle]) => text.includes(needle));
    if (hit) return code + '|' + hit[1];
    return code + '|' + (text.trim() ? 'unclassified: ' + text.trim().slice(0, 60) : 'silent');
  };

  /**
   * The retry notice, which is stderr output but NOT a verdict branch.
   *
   * It is separated from the branch text rather than folded into NEEDLES: put
   * ahead of the real needles it would shadow the verdict in every both-
   * attempts-failed case, and behind them it would never be seen at all. It is
   * reported in its own field so a case can assert that an operator was told
   * WHY a second attempt happened -- silence there reads in the log as one slow
   * call rather than as a retried failure.
   */
  const RETRY_NOTICE = 'Transient failure';

  /** Counts attempts and the retry notice, for the cases where retry is the subject. */
  const attemptOutcome = async (replies, extra = {}) => {
    let attempts = 0;
    const said = [];
    const waits = [];
    const code = await runMain([], {
      env: CREDS,
      makeClient: clientFrom(async () => {
        attempts += 1;
        return replies(attempts);
      }),
      err: (line) => said.push(String(line)),
      sleep: (ms) => waits.push(ms),
      ...extra,
    });
    const notice = said.some((line) => line.includes(RETRY_NOTICE));
    const text = said.filter((line) => !line.includes(RETRY_NOTICE)).join('\n');
    const hit = NEEDLES.find(([needle]) => text.includes(needle));
    return (
      code + '|attempts=' + attempts + '|waited=' + waits.join(',') +
      '|notice=' + (notice ? 'yes' : 'no') +
      '|' + (hit ? hit[1] : text.trim() ? 'unclassified' : 'silent')
    );
  };

  // --- Credentials: infrastructure, never a green "no ghosts" ---
  add('exit: MISSING credentials are 2, never a green pass', () => mainOutcome(), '2|no-creds');
  add(
    'exit: BLANK credentials are 2 from the CREDENTIALS branch -- a secret that exists but is empty',
    () =>
      mainOutcome([], {
        env: { VITE_SUPABASE_URL: '   ', VITE_SUPABASE_PUBLISHABLE_KEY: '  ' },
        makeClient: clientOf(HEALTHY),
      }),
    '2|no-creds',
  );
  /**
   * HALF credentials, both directions. Every case above has BOTH halves absent
   * or blank, which made `if (!url || !key)` and `if (!url && !key)` identical
   * to the suite: a sweep on 2026-08-20 found that mutant SURVIVING 24/24. It
   * was never a fail-open -- with one half present the real client constructor
   * throws and main()'s catch still returns 2 -- but the answer then comes from
   * the WRONG BRANCH, carrying "supabaseKey is required" instead of naming the
   * two secrets an operator has to go and set.
   */
  add(
    'exit: url present but key ABSENT is 2 from the CREDENTIALS branch, not from the client',
    () =>
      mainOutcome([], {
        env: { VITE_SUPABASE_URL: CREDS.VITE_SUPABASE_URL },
        makeClient: clientOf(HEALTHY),
      }),
    '2|no-creds',
  );
  add(
    'exit: key present but url ABSENT is 2 from that same branch -- the gate is OR, never AND',
    () =>
      mainOutcome([], {
        env: { VITE_SUPABASE_PUBLISHABLE_KEY: CREDS.VITE_SUPABASE_PUBLISHABLE_KEY },
        makeClient: clientOf(HEALTHY),
      }),
    '2|no-creds',
  );
  add(
    'exit: credentials from .env ALONE are enough -- the file reader is wired, not decorative',
    () => mainOutcome([], { readDotEnv: () => CREDS, makeClient: clientOf(HEALTHY) }),
    '0|silent',
  );
  add(
    'exit: process.env WINS over .env -- the fixture client rejects the .env spelling',
    () =>
      mainOutcome([], {
        env: CREDS,
        readDotEnv: () => ({
          VITE_SUPABASE_URL: 'https://stale.test',
          VITE_SUPABASE_PUBLISHABLE_KEY: 'stale',
        }),
        makeClient: clientOf(HEALTHY),
      }),
    '0|silent',
  );
  /**
   * A BLANK export must not shadow a good file value. The previous draft merged
   * the two bags as `{ ...dotEnv, ...env }`, so `VITE_SUPABASE_URL=` in a shell
   * profile beat a correct .env and the guard exited 2 blaming absent secrets
   * that were present. The fallback crossed NAMES but never SOURCES.
   */
  add(
    'exit: a BLANK exported variable falls through to .env instead of shadowing it',
    () =>
      mainOutcome([], {
        env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '   ' },
        readDotEnv: () => CREDS,
        makeClient: clientOf(HEALTHY),
      }),
    '0|silent',
  );
  /**
   * The un-prefixed spellings. Both were reachable in the previous draft and
   * driven by no case at all -- deletable with the suite still green, which is
   * the definition of coverage that is not there.
   */
  add(
    'exit: SUPABASE_URL and SUPABASE_ANON_KEY are honoured -- the un-prefixed fallbacks are live',
    () =>
      mainOutcome([], {
        env: {
          SUPABASE_URL: CREDS.VITE_SUPABASE_URL,
          SUPABASE_ANON_KEY: CREDS.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        makeClient: clientOf(HEALTHY),
      }),
    '0|silent',
  );
  add(
    'exit: SUPABASE_PUBLISHABLE_KEY is honoured too -- the middle name in the key list',
    () =>
      mainOutcome([], {
        env: {
          VITE_SUPABASE_URL: CREDS.VITE_SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY: CREDS.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        makeClient: clientOf(HEALTHY),
      }),
    '0|silent',
  );

  /**
   * NAME-MAJOR, driven against the exact failure that made source-major
   * dangerous: a FALLBACK name exported by a running `supabase start` (bare
   * SUPABASE_URL) must not beat the PRIMARY name sitting correctly in this
   * repo's own files. clientOf(HEALTHY) enforces the exact CREDS pair --
   * under source-major this case would pass the LOCAL url through instead and
   * fail with "main() passed through the wrong credentials".
   */
  add(
    'exit: a PRIMARY name in files beats a FALLBACK name exported in the shell -- name-major',
    () =>
      mainOutcome([], {
        env: { SUPABASE_URL: 'http://127.0.0.1:54321' },
        readDotEnv: () => CREDS,
        makeClient: clientOf(HEALTHY),
      }),
    '0|silent',
  );
  add(
    'exit: a PRIMARY key name in files beats the FALLBACK SUPABASE_ANON_KEY exported in the shell',
    () =>
      mainOutcome([], {
        env: { SUPABASE_ANON_KEY: 'local-anon-key' },
        readDotEnv: () => CREDS,
        makeClient: clientOf(HEALTHY),
      }),
    '0|silent',
  );
  add(
    'exit: a PRIMARY key name in files beats the middle fallback SUPABASE_PUBLISHABLE_KEY exported in the shell',
    () =>
      mainOutcome([], {
        env: { SUPABASE_PUBLISHABLE_KEY: 'local-middle-key' },
        readDotEnv: () => CREDS,
        makeClient: clientOf(HEALTHY),
      }),
    '0|silent',
  );
  /**
   * A name blank in BOTH sources must cascade to the NEXT NAME, still checked
   * source-by-source -- not just "blank in one source falls to the other for
   * the same name" (covered above already).
   */
  add(
    'exit: a name blank in BOTH sources cascades to the next name, still checked source-by-source',
    () =>
      mainOutcome([], {
        env: { VITE_SUPABASE_URL: '   ' },
        readDotEnv: () => ({
          VITE_SUPABASE_URL: '',
          SUPABASE_URL: CREDS.VITE_SUPABASE_URL,
          VITE_SUPABASE_PUBLISHABLE_KEY: CREDS.VITE_SUPABASE_PUBLISHABLE_KEY,
        }),
        makeClient: clientOf(HEALTHY),
      }),
    '0|silent',
  );

  /**
   * WHAT --self-test ITSELF EXITS. Both arms, because only one of them can be
   * observed by running the suite: a passing canary can never demonstrate what
   * a FAILING one returns, and `? 0 : 1` cut to `? 0 : 0` is a self-test that
   * reports failures and exits 0 -- the exact shape of the R5 defect this file
   * is built against, one level up.
   */
  add(
    'exit: --self-test returns 0 when the suite passes',
    () => mainOutcome(['--self-test'], { runSelfTest: async () => true }),
    '0|silent',
  );
  add(
    'exit: --self-test returns 1 when the suite FAILS -- never 0, never 2',
    () => mainOutcome(['--self-test'], { runSelfTest: async () => false }),
    '1|silent',
  );

  // --- Flags: proven with VALID credentials and a healthy DB, so nothing but
  // --- the flag branch can produce the 2.
  add(
    'exit: an unknown flag is 2, and the live check does not run behind it',
    () => mainOutcome(['--nope'], live(HEALTHY)),
    '2|bad-flag',
  );
  add(
    'exit: --selftest is NOT --self-test -- a substring match ran the live check on a typo',
    () => mainOutcome(['--selftest'], live(HEALTHY)),
    '2|bad-flag',
  );

  // --- Infrastructure: a throw is 2, never 1 ---
  add(
    'exit: a THROWN client is 2 -- an infrastructure fault is not a data violation',
    () => mainOutcome([], { env: CREDS }),
    '2|cannot-measure',
  );
  /**
   * A thrown STRING, not an Error. `thrown && thrown.message` cut to `||` then
   * reads `.message` off the string, prints "COULD NOT MEASURE: undefined", and
   * every Error-shaped case stays green -- the operator loses the only sentence
   * naming what broke.
   */
  add(
    'exit: a thrown NON-Error is 2 and its text still reaches the message',
    async () => {
      const said = [];
      const code = await runMain([], {
        env: CREDS,
        makeClient: () => {
          throw 'a bare string, thrown';
        },
        err: (line) => said.push(String(line)),
      });
      return code + '|' + (said.join('\n').includes('a bare string, thrown') ? 'named' : 'lost');
    },
    '2|named',
  );
  add(
    'exit: a throw from OUTSIDE the RPC is 2 as well -- the catch is around all of main()',
    () =>
      mainOutcome([], {
        env: CREDS,
        readDotEnv: () => {
          throw new Error('EACCES: permission denied, open .env');
        },
        makeClient: clientOf(HEALTHY),
      }),
    '2|cannot-measure',
  );

  // --- The RPC reply, the bound and the single retry. Every fixture below is
  // --- the literal shape node_modules/@supabase/postgrest-js/dist/index.mjs
  // --- produces, because the previous draft's round was half one wrong
  // --- assumption about that module.
  add(
    'exit: an RPC error is 2, names the RPC failure rather than the throw path, and is NOT retried',
    () => attemptOutcome(() => pgError('42501', 'permission denied for function')),
    '2|attempts=1|waited=|notice=no|rpc-error',
  );
  /**
   * The code as a STRING, which is what JSON.parse of the response body yields
   * and therefore the only direction production can produce. The previous draft
   * pinned the numeric direction alone -- the one that does not occur -- so the
   * arm that fires in CI was covered by nothing.
   */
  add(
    'a transient PG code arrives as a STRING and is retried once, after the stated wait',
    () =>
      attemptOutcome((n) =>
        n === 1 ? pgError('57014', 'query aborted by the server') : { data: HEALTHY, error: null },
      ),
    '0|attempts=2|waited=2000|notice=yes|silent',
  );
  /**
   * And the NUMERIC direction, which is why the compare is coerced rather than
   * strict. The message deliberately matches none of the needles, so the code
   * compare is the only thing that can classify it -- the first version of this
   * fixture said 'canceling statement due to statement timeout', which the
   * message arm matched, leaving a strict `===` mutant green.
   */
  add(
    'a transient PG code arriving as a NUMBER is retried too -- the compare is coerced',
    () =>
      attemptOutcome((n) =>
        n === 1
          ? { data: null, error: { code: 57014, message: 'query aborted by the server' } }
          : { data: HEALTHY, error: null },
      ),
    '0|attempts=2|waited=2000|notice=yes|silent',
  );
  add(
    'a transient error on BOTH attempts exhausts the retry and is 2 -- once, not a loop',
    () => attemptOutcome(() => pgError('57014', 'query aborted by the server')),
    '2|attempts=2|waited=2000|notice=yes|rpc-error',
  );
  /**
   * A socket reset as the transport delivers it: message `TypeError: fetch
   * failed`, the real cause in DETAILS, code ''. The previous draft's
   * classifier matched `econnreset` and `socket hang up` against MESSAGE, where
   * they can never appear; those two needles are deleted and this case is what
   * proves the arm that does cover the shape.
   */
  add(
    'a fetch-level ECONNRESET is transient via the fetch-failed arm, with its cause in DETAILS',
    () =>
      attemptOutcome((n) =>
        n === 1
          ? fetchFailure('TypeError', 'fetch failed', 'Error: read ECONNRESET (ECONNRESET)')
          : { data: HEALTHY, error: null },
      ),
    '0|attempts=2|waited=2000|notice=yes|silent',
  );
  /**
   * The notice an operator reads. `(error.code || '?')` cut to `&&` prints an
   * empty code for exactly the fetch-level failures that carry `code: ''` --
   * which is most of them -- leaving a log line that begins ": TypeError".
   */
  add(
    'the retry notice names a MISSING code as ? rather than printing nothing',
    async () => {
      const said = [];
      let attempts = 0;
      await runMain([], {
        env: CREDS,
        makeClient: clientFrom(async () => {
          attempts += 1;
          return attempts === 1 ? fetchFailure('TypeError', 'fetch failed') : { data: HEALTHY, error: null };
        }),
        err: (line) => said.push(String(line)),
        sleep: SILENT,
      });
      const notice = said.find((line) => line.includes(RETRY_NOTICE)) || '';
      return notice.includes('(?: TypeError: fetch failed)') ? 'named' : 'garbled: ' + notice;
    },
    'named',
  );
  add(
    'the MESSAGE arm classifies a statement timeout with NO code at all -- both halves are live',
    () =>
      attemptOutcome((n) =>
        n === 1
          ? { data: null, error: { message: 'canceling statement due to statement timeout' } }
          : { data: HEALTHY, error: null },
      ),
    '0|attempts=2|waited=2000|notice=yes|silent',
  );

  /**
   * THE STALL, end to end, on the branch production actually reaches.
   *
   * With shouldThrowOnError false the transport RESOLVES an aborted request; it
   * does not reject. So a real 20-second stall lands on the timeout branch, and
   * the previous draft's fixture -- which rejected -- pinned cannot-measure for
   * it. Two consequences were shipped green by that one wrong assumption: the
   * wrong branch was asserted, and the stall was never RETRIED, because the
   * resolved error carries code '' and a message matching no needle. The retry
   * exists for exactly this noise.
   *
   * The timer fires immediately here, so the case costs no wall clock while
   * driving the real AbortController, the real signal and the real abort.
   */
  const fireAtOnce = (fn) => {
    fn();
    return 0;
  };
  add(
    'a STALLED RPC is aborted by this guard, RETRIED once, and lands on the timeout branch',
    async () => {
      let attempts = 0;
      const said = [];
      const waits = [];
      const code = await runMain([], {
        env: CREDS,
        makeClient: async (url, key) => {
          const client = await stallingClient()(url, key);
          return {
            rpc: (name) => {
              attempts += 1;
              return client.rpc(name);
            },
          };
        },
        err: (line) => said.push(String(line)),
        sleep: (ms) => waits.push(ms),
        setTimer: fireAtOnce,
      });
      const notice = said.some((line) => line.includes(RETRY_NOTICE));
      const text = said.filter((line) => !line.includes(RETRY_NOTICE)).join('\n');
      const hit = NEEDLES.find(([needle]) => text.includes(needle));
      return (
        code + '|attempts=' + attempts + '|waited=' + waits.join(',') +
        '|notice=' + (notice ? 'yes' : 'no') + '|' + (hit ? hit[1] : 'none')
      );
    },
    '2|attempts=2|waited=2000|notice=yes|rpc-timeout',
  );
  /**
   * THE SHIPPED BOUND, pinned separately from the seam that makes it cheap.
   *
   * This is the correction of the defect that reverted the previous draft's
   * timeout work: it injected `rpcTimeoutMs`, so the constant this comment
   * argues is load-bearing was asserted by nothing and `20_000 -> 20_000_000`
   * survived the whole suite. Injecting the TIMER instead leaves the DURATION
   * on the only path there is, and this case reads it back. It also pins that
   * the handle is cleared: an uncleared 20s timer keeps the process alive after
   * the answer is known.
   */
  add(
    'the bound handed to the timer is the SHIPPED constant, and the handle is cleared',
    async () => {
      const asked = [];
      const cleared = [];
      const code = await runMain([], {
        ...live(HEALTHY),
        setTimer: (fn, ms) => {
          asked.push(ms);
          return 'TIMER-HANDLE';
        },
        clearTimer: (handle) => cleared.push(handle),
      });
      return code + '|ms=' + asked.join(',') + '|cleared=' + cleared.join(',');
    },
    '0|ms=20000|cleared=TIMER-HANDLE',
  );

  // --- Payload SHAPE: every one of these is 2, because the guard cannot read
  // --- the answer. The first draft shipped three of them as 0 or 1.
  add('exit: a NULL payload is 2', () => mainOutcome([], live(null)), '2|bad-payload-type');
  /**
   * The message NAMES what arrived. describe()'s null arm inverted reports a
   * null payload as "(got object)", which is what an operator would then go
   * looking for -- the branch is right and the sentence is wrong.
   */
  add(
    'the shape message names what actually arrived: null as null, an array as array',
    async () => {
      const say = async (payload) => {
        const said = [];
        await runMain([], { ...live(payload), err: (line) => said.push(String(line)) });
        return said.join('\n');
      };
      const nul = (await say(null)).includes('(got null)') ? 'null' : 'wrong';
      const arr = (await say([HEALTHY])).includes('(got array)') ? 'array' : 'wrong';
      // NaN is typeof 'number', so without its own arm this branch printed
      // "is not a finite number (got number)" -- a sentence that denies itself.
      const nan = (await say({ ok: true, ghost_count: 0, total_is_override: NaN }))
        .includes('(got NaN)') ? 'NaN' : 'wrong';
      // Infinity and an ORDINARY number as well, and both are load-bearing
      // rather than completeness: they are the only inputs that separate the
      // two non-finite arms from each other and from the typeof fallthrough.
      // Added after the fixes above introduced three new mutants that lived --
      // a fix to a finding is unreviewed code, and this is what re-running the
      // battery over it is for. `ok` is the field that can carry a plain
      // number here, because it reaches describe() whenever it is not boolean.
      const inf = (await say({ ok: true, ghost_count: 0, total_is_override: Infinity }))
        .includes('(got Infinity)') ? 'Infinity' : 'wrong';
      const num = (await say({ ok: 1, ghost_count: 0, total_is_override: 357 }))
        .includes('(got number)') ? 'number' : 'wrong';
      return nul + '|' + arr + '|' + nan + '|' + inf + '|' + num;
    },
    'null|array|NaN|Infinity|number',
  );
  add(
    'exit: an ARRAY payload is 2 -- a SETOF re-declaration must not read as "? ghost rows"',
    () => mainOutcome([], live([HEALTHY])),
    '2|bad-payload-type',
  );
  add(
    'exit: a MISSING total_is_override is 2 -- the likeliest drift is a renamed key',
    () => mainOutcome([], live({ ok: true, ghost_count: 0 })),
    '2|bad-total-type',
  );
  /**
   * NaN is not JSON, so this cannot arrive over the wire -- and that is the
   * point of a shape gate. It is here because it is the ONLY input that
   * separates `typeof v === 'number' && Number.isFinite(v)` from the `||`
   * spelling: under `||`, NaN reads as a finite number and the payload is
   * accepted. Defence in depth is only depth if something drives it.
   */
  add(
    'exit: a NaN total_is_override is 2 -- finite is required, not merely numeric',
    () => mainOutcome([], live({ ok: true, ghost_count: 0, total_is_override: NaN })),
    '2|bad-total-type',
  );
  add(
    'exit: a NULL ghost_count is 2, not 1 -- an absent count is not seven ghosts',
    () => mainOutcome([], live({ ok: true, ghost_count: null, total_is_override: 357 })),
    '2|bad-ghost-type',
  );
  add(
    'exit: a STRING ok is 2 -- truthiness would ship ok:"false" as a pass',
    () => mainOutcome([], live({ ok: 'false', ghost_count: 0, total_is_override: 357 })),
    '2|bad-ok-type',
  );
  /**
   * THE DOWNGRADE THIS LADDER USED TO SHIP, all three shapes.
   *
   * Each of these carries a readable ghost_count of 7 beside a field whose TYPE
   * has drifted. Under the previous order every one exited 2 -- "the payload
   * shape drifted" -- and the third was pinned by a canary case that asserted
   * the downgrade as correct. Seven violating prod rows, reported as an
   * infrastructure notice, with the repair block never printed and my own
   * expectation agreeing. This is the repo's explicit-expectations note: a case
   * cannot catch a defect its author believes in.
   */
  add(
    'exit: 7 ghosts beside a STRING total_is_override are 1, not a shape-drift 2',
    () => mainOutcome([], live({ ok: false, ghost_count: 7, total_is_override: '357' })),
    '1|ghost-rows',
  );
  add(
    'exit: 7 ghosts beside a STRING ok are 1 -- ok cannot un-find rows',
    () => mainOutcome([], live({ ok: 'false', ghost_count: 7, total_is_override: 357 })),
    '1|ghost-rows',
  );
  add(
    'exit: 7 ghosts beside a MISSING total_is_override are 1 as well',
    () => mainOutcome([], live({ ok: false, ghost_count: 7 })),
    '1|ghost-rows',
  );
  /**
   * The other direction, so the reorder did not simply delete the gates: with a
   * ZERO ghost count the drifted field is what decides, because a zero can only
   * be believed if the payload around it is readable.
   */
  add(
    'exit: a STRING total_is_override beside ZERO ghosts is still 2 -- the zero is unbelievable',
    () => mainOutcome([], live({ ok: true, ghost_count: 0, total_is_override: '357' })),
    '2|bad-total-type',
  );

  // --- The sample-size floor: a guard that examined nothing has not passed ---
  add(
    'exit: ZERO rows measured is 2 -- "no ghosts" over no rows is a broken read',
    () => mainOutcome([], live({ ok: true, ghost_count: 0, total_is_override: 0 })),
    '2|nothing-measured',
  );
  add(
    'exit: a NEGATIVE count is 2 as well, so the floor is > 0 and not merely !== 0',
    () => mainOutcome([], live({ ok: true, ghost_count: 0, total_is_override: -1 })),
    '2|nothing-measured',
  );
  /**
   * The OTHER edge of the floor, and the named gap made executable: ONE row is
   * a pass. It is pinned because a floor is two edges and only one of them was
   * asserted -- `<= 0` widened to `<= 1` reds an honest single-row read while
   * every case above stays green. If a real floor is ever measured, this case
   * is the one that has to change with it.
   */
  add(
    'exit: exactly ONE row measured is a PASS -- the floor is > 0, deliberately no tighter',
    () => mainOutcome([], live({ ok: true, ghost_count: 0, total_is_override: 1 })),
    '0|silent',
  );

  // --- The data verdict, both directions ---
  add(
    'exit: ghost rows are 1, on STDERR where CI annotates it',
    () => mainOutcome([], live({ ok: false, ghost_count: 7, total_is_override: 357 })),
    '1|ghost-rows',
  );
  add(
    'exit: ok:true beside a NON-ZERO ghost_count is 1 -- the two fields are cross-checked',
    () => mainOutcome([], live({ ok: true, ghost_count: 7, total_is_override: 357 })),
    '1|ghost-rows',
  );
  /**
   * ORDER, not just values. With the sample floor ahead of the ghost verdict --
   * the previous draft's order -- this payload answered 2|nothing-measured and
   * the repair message never printed: seven violating rows reported as an
   * infrastructure notice. Rows FOUND is evidence even when the denominator
   * looks broken.
   */
  add(
    'exit: ghost rows beside a ZERO total are 1, not a "nothing was measured" 2',
    () => mainOutcome([], live({ ok: false, ghost_count: 7, total_is_override: 0 })),
    '1|ghost-rows',
  );
  add(
    'exit: ok:false beside a ZERO ghost_count is 1 -- a self-contradicting payload is not a pass',
    () => mainOutcome([], live({ ok: false, ghost_count: 0, total_is_override: 357 })),
    '1|not-ok',
  );
  add(
    'exit: a HEALTHY read is 0 and says nothing on stderr -- the contract is not merely "always 2"',
    () => mainOutcome([], live(HEALTHY)),
    '0|silent',
  );

  /**
   * verdict() is EXPORTED, so its own signature is a contract with importers
   * that no case drove: with a required third parameter, `verdict(data, null)`
   * threw on `timeout.timedOut` before reaching a single branch. The default is
   * safe against the mutation this file cares about -- the shipped bound is
   * pinned by the setTimer case, and the stall case drives timedOut TRUE
   * through main(), so dropping the argument at the call site still reds.
   */
  add(
    'the EXPORTED verdict is callable with two arguments, as an importer would call it',
    () => {
      const pass = verdict(HEALTHY, null);
      const fail = verdict({ ok: false, ghost_count: 7, total_is_override: 357 }, null);
      return pass.code + '|' + fail.code;
    },
    '0|1',
  );

  // --- Reporting: the sample rows are what an operator acts on ---
  add(
    'the payload is dumped on the FAILING path, so sample rows reach the log',
    async () => {
      const said = [];
      const code = await runMain([], {
        ...live({ ok: false, sample: [{ id: 'ghost-1' }], ghost_count: 1, total_is_override: 357 }),
        out: (line) => said.push(String(line)),
      });
      return code + '|' + (said.join('\n').includes('ghost-1') ? 'dumped' : 'silent');
    },
    '1|dumped',
  );
  add(
    'a NON-OBJECT payload is not dumped and then contradicted one line later',
    async () => {
      const said = [];
      const code = await runMain([], {
        ...live([HEALTHY]),
        out: (line) => said.push(String(line)),
      });
      return code + '|' + (said.length === 0 ? 'nothing' : said.join('\n'));
    },
    '2|nothing',
  );

  // --- The .env parser, whose bugs all present as a missing-secret exit 2 ---
  add(
    'the .env parser strips BOTH quote styles, honours `export `, and ignores comments',
    () => {
      const parsed = parseDotEnv(
        // The comment carries an `=` on purpose. With a plain `# comment` the
        // comment test and the no-`=` test are indistinguishable, so the `||`
        // joining them could be flipped with the case still green.
        ['# commented=out', "export A='one'", 'B="two"', 'C=three', 'no-equals', 'D=', ''].join('\n'),
      );
      return Object.keys(parsed).sort().join(',') + '|' + parsed.A + parsed.B + parsed.C;
    },
    'A,B,C,D|onetwothree',
  );
  /**
   * The QUOTE-STRIPPING EDGES. The condition is a length test AND a matched
   * pair of either quote style, and every one of those three joins was
   * flippable while the suite stayed green -- the fixture above only ever fed
   * it well-formed values. A .env holding `KEY=it's` is not exotic.
   */
  add(
    'the parser strips only MATCHED pairs, and only where there is something between them',
    () => {
      const parsed = parseDotEnv(
        ['M=mixed"', "N=mixed'", 'P="', 'Q=""', "R=''"].join('\n'),
      );
      return [parsed.M, parsed.N, parsed.P, '[' + parsed.Q + ']', '[' + parsed.R + ']'].join('|');
    },
    'mixed"|mixed' + "'" + '|"|[]|[]',
  );
  /**
   * A null-prototype bag, driven rather than asserted by reading. With a plain
   * `{}` the first key below is swallowed -- assigning `__proto__` sets the
   * prototype instead of a property -- and `constructor` reads back as a
   * function from Object.prototype. In the one module whose bugs all present as
   * a confusing missing-credentials 2, that is the worst possible failure mode
   * to add.
   */
  add(
    'the parser returns a NULL-PROTOTYPE bag, so __proto__ and constructor are ordinary keys',
    () => {
      const parsed = parseDotEnv(['__proto__=x', 'constructor=y', 'K=v'].join('\n'));
      return (
        Object.getPrototypeOf(parsed) + '|' + parsed.__proto__ + '|' + parsed.constructor + '|' + parsed.K
      );
    },
    'null|x|y|v',
  );
  /**
   * An UNQUOTED trailing comment. Left in the value it reaches createClient as
   * part of a URL, which throws "Invalid URL" -- so the guard answers
   * COULD NOT MEASURE instead of the branch that names the two secrets an
   * operator has to set. Inside quotes a `#` is data and stays.
   */
  add(
    'the parser drops an unquoted trailing comment, and keeps a quoted hash',
    () => {
      const parsed = parseDotEnv(
        ['U=https://x.supabase.co # prod', 'V=plain#nospace', 'W="keep # this"'].join('\n'),
      );
      return parsed.U + '|' + parsed.V + '|' + parsed.W;
    },
    'https://x.supabase.co|plain#nospace|keep # this',
  );
  /**
   * The FILE SET, not just the parser, driven against a real temporary
   * directory rather than a stubbed filesystem -- the property being proven is
   * which files on disk are opened and in what order.
   *
   * RESIDUAL, stated rather than papered over: this drives readEnvFiles, not
   * defaultReadDotEnv, so the binding of ROOT itself is still unproven here --
   * every case injects readDotEnv over it. Removing that function's default
   * parameter is what stops the binding being silently overridable; proving it
   * needs a fixture root the module cannot be pointed at.
   */
  add(
    'the reader takes .env.local, .env and .env.development, and the FIRST file wins',
    () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-env-'));
      try {
        fs.writeFileSync(path.join(dir, '.env.local'), 'K=from-local\n');
        fs.writeFileSync(path.join(dir, '.env'), 'K=from-env\nONLY_ENV=yes\n');
        fs.writeFileSync(path.join(dir, '.env.development'), 'ONLY_DEV=yes\n');
        const got = readEnvFiles(dir);
        return got.K + '|' + got.ONLY_ENV + '|' + got.ONLY_DEV;
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
    'from-local|yes|yes',
  );
  /**
   * FIRST NON-BLANK, not first PRESENT -- the same source-shadowing defect
   * firstValue() carries a paragraph about, one layer lower and covered by
   * nothing until review drove it. A stale `VITE_SUPABASE_URL=` in .env.local
   * made the guard exit 2 blaming absent secrets that were in .env.
   */
  add(
    'a BLANK value in an earlier file does not shadow a real one in a later file',
    () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-blank-'));
      try {
        fs.writeFileSync(path.join(dir, '.env.local'), 'K=\nJ=from-local\n');
        fs.writeFileSync(path.join(dir, '.env'), 'K=from-env\nJ=from-env\n');
        const got = readEnvFiles(dir);
        return got.K + '|' + got.J;
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
    'from-env|from-local',
  );

  /**
   * readEnvDirs: ROOT then cwd, additive. Two real temp directories, because
   * the property being proven is which DIRECTORY wins, not which file within
   * one does -- that half is proven above.
   */
  add(
    'readEnvDirs prefers the FIRST directory in the list for a name both define',
    () => {
      const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-dirA-'));
      const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-dirB-'));
      try {
        fs.writeFileSync(path.join(dirA, '.env'), 'K=from-A\n');
        fs.writeFileSync(path.join(dirB, '.env'), 'K=from-B\nONLY_B=yes\n');
        const got = readEnvDirs([dirA, dirB]);
        return got.K + '|' + got.ONLY_B;
      } finally {
        fs.rmSync(dirA, { recursive: true, force: true });
        fs.rmSync(dirB, { recursive: true, force: true });
      }
    },
    'from-A|yes',
  );
  add(
    'readEnvDirs: a BLANK value in the first directory does not shadow a real one in the second -- additive, not a replacement',
    () => {
      const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-dirA2-'));
      const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-dirB2-'));
      try {
        fs.writeFileSync(path.join(dirA, '.env'), 'K=\n');
        fs.writeFileSync(path.join(dirB, '.env'), 'K=from-B\n');
        const got = readEnvDirs([dirA, dirB]);
        return got.K;
      } finally {
        fs.rmSync(dirA, { recursive: true, force: true });
        fs.rmSync(dirB, { recursive: true, force: true });
      }
    },
    'from-B',
  );
  add(
    // Named for what it proves, not for defaultReadDotEnv's collapse branch --
    // that branch feeds THIS call, but is itself in the residual gap above,
    // unproven by any case here.
    'readEnvDirs reads ONE directory fine when the list has one entry',
    () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-dirOne-'));
      try {
        fs.writeFileSync(path.join(dir, '.env'), 'K=solo\n');
        return readEnvDirs([dir]).K;
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
    'solo',
  );

  /**
   * THE RUNNER'S OWN ARMS, driven with synthetic sub-suites.
   *
   * TWO failing-suite cases, not one, and the reason is worth stating because
   * it is not obvious: the mutant here is its OWN input state. With
   * `failed > 0` widened to `failed > 1`, a single case detecting the defect
   * fails -- and the outer suite then also sits at exactly one failure, where
   * the same widened threshold reports PASS. The defect cancels its own
   * detection. Two independent witnesses put the outer count at two, which the
   * widened threshold can no longer swallow.
   */
  const failing = { name: 'synthetic failure', run: () => 'a', expected: 'b' };
  const passing = { name: 'synthetic pass', run: () => 'a', expected: 'a' };
  add(
    'the runner names a NON-Error throw rather than recording "threw: undefined"',
    async () => {
      const said = [];
      const thrower = {
        name: 'synthetic thrower',
        run: () => {
          throw 'a bare string, thrown';
        },
        expected: 'never',
      };
      await runCases([thrower], (line) => said.push(String(line)), SILENT);
      return said.join('\n').includes('a bare string, thrown') ? 'named' : 'lost';
    },
    'named',
  );
  add(
    'the runner refuses to pass an EMPTY suite -- collected is not run',
    async () => String(await runCases([], SILENT, SILENT)),
    'false',
  );
  add(
    'the runner fails a suite with ONE failing case',
    async () => String(await runCases([failing], SILENT, SILENT)),
    'false',
  );
  add(
    'the runner fails a MIXED suite too -- one failure among passes is still a failure',
    async () => String(await runCases([passing, failing], SILENT, SILENT)),
    'false',
  );
  add(
    'the runner passes an all-green suite and reports the number it RAN, not the number collected',
    async () => {
      const said = [];
      const ok = await runCases([passing, passing, passing], (line) => said.push(String(line)), SILENT);
      const line = said.find((text) => text.includes('PASS self-test')) || '';
      return String(ok) + '|' + (line.includes('3 cases run') ? 'counted=3' : 'miscounted: ' + line);
    },
    'true|counted=3',
  );

  return runCases(cases, out, err);
}

/**
 * THE RUNNER, extracted so its FAILURE arms can be driven.
 *
 * It decides whether the whole suite passes, and until it was pulled out here
 * nothing exercised either arm: a green run leaves `failed` at 0 and `ran` at
 * the case count, so `failed > 0` widened to `failed > 1` -- one failing case
 * reported as a PASS -- survived every mutant sweep. That is this repo's
 * weakened-assertion note exactly: a threshold cannot be killed by input that
 * never reaches it.
 *
 * `ran` is incremented INSIDE the loop and is what gets printed. The obvious
 * spelling -- printing cases.length -- reports cases COLLECTED, so changing the
 * loop to iterate an empty array prints the same confident "PASS self-test --
 * N cases" line having executed nothing, and exits 0. The zero floor is the
 * half that actually bites: printing `ran` alone still reports "0 cases", which
 * any reader looking for the word PASS is perfectly happy with.
 */
export async function runCases(cases, out, err) {
  let failed = 0;
  let ran = 0;
  for (const testCase of cases) {
    ran += 1;
    let got;
    try {
      got = await testCase.run();
    } catch (error) {
      // Guarded exactly as main()'s catch is. A case throwing a bare string
      // recorded "threw: undefined", losing the only sentence naming what
      // broke -- in the runner that reports every result CI reads.
      got = 'threw: ' + (error && error.message ? error.message : String(error));
    }
    const ok = got === testCase.expected;
    if (!ok) failed += 1;
    const detail = ok
      ? ''
      : '  (expected ' + JSON.stringify(testCase.expected) + ', got ' + JSON.stringify(got) + ')';
    out((ok ? 'ok  ' : 'FAIL') + '  ' + testCase.name + detail);
  }

  if (ran === 0) {
    err('');
    err(
      'FAIL self-test -- the runner executed ZERO cases. ' + cases.length + ' were collected, ' +
        'so this is the runner, not an empty suite. A count of cases COLLECTED is not a ' +
        'count of cases RUN.',
    );
    return false;
  }
  if (failed > 0) {
    err('');
    err('FAIL self-test -- ' + failed + ' of ' + ran + ' case(s) run.');
    return false;
  }
  out('');
  out('PASS self-test -- ' + ran + ' cases run, every exit branch driven through main().');
  return true;
}

// Realpath-to-realpath (scripts/lib/entry-point.mjs). The hand-rolled
// `import.meta.url === pathToFileURL(process.argv[1]).href` compare this
// replaces fails OPEN through a junction: node realpaths one side and not the
// other, and the whole guard -- canary included -- prints nothing and exits 0.
// Listed in TARGETS in scripts/prove-entry-point-dispatch.mjs; omitting it from
// that list exits the sweep 2, and that sweep runs on every PR.
if (isEntryPoint(import.meta.url)) {
  // process.exitCode, never process.exit(): supabase-js leaves an undici handle
  // open, and on Windows process.exit() tears the loop down mid-close --
  //   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c
  // exiting -1073740791 AFTER printing OK. On Linux CI the same call truncates
  // buffered stdout. Both were measured in this repo.
  //
  // DROPPING THE ASSIGNMENT here -- keeping `await main(...)` -- is the one
  // mutation no case above can see, and it is a repo-wide gap shared with every
  // sibling guard rather than a hole in this one. See the header, and
  // ~/.claude/plans/queued-r7-dispatch-exit-wiring.md.
  process.exitCode = await main(process.argv.slice(2));
}
