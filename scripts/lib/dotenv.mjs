// Shared .env parsing and precedence rules for scripts/check-override-mirror-ghost.mjs
// (#68) and scripts/check-program-day-offsets.mjs (#67).
//
// EXTRACTED 2026-08-22, on the third attempt at this seam. The first attempt
// (queued-dotenv-rpc-unification-reverted.md) moved this pair before the
// parser underneath was correct, and migrated no call site -- so it shipped
// two implementations plus a false "no third copy" claim, worse than two
// honest implementations. That is fixed here: #68's parser was corrected in
// two prior PRs (Website#268 name-major/ROOT-then-cwd, Website#269 the
// comment-needle and blank-predicate fixes) before this file existed, and
// THIS PR is the one that migrates both call sites, closing the exact gap the
// first attempt's docstring only claimed to close.
//
// WHAT DID NOT MOVE, deliberately: ROOT (each guard's own
// `path.dirname(path.dirname(fileURLToPath(import.meta.url)))`) and the
// ROOT-vs-cwd collapse in each guard's own `defaultReadDotEnv()`. The exact
// two-`dirname()` formula would resolve one directory too shallow if copied
// in here verbatim -- this file lives in scripts/lib/, one level below the
// guards -- but that is a reason to depth-adjust it, not proof it cannot move
// at all: scripts/lib/review-scope.mjs, in this same directory, already
// exports a working `REPO_ROOT` computed the same way one level deeper. Left
// out of THIS PR's scope anyway: the task this file exists for named four
// pure functions (parseDotEnv, readEnvFiles, readEnvDirs, firstValue), and
// widening it to also own ROOT resolution is exactly the kind of scope creep
// that sank two earlier attempts at this seam (see
// queued-dotenv-rpc-unification-reverted.md). That is also why the residual
// gap named in each guard's own header (the ROOT/cwd BINDING is unproven by
// any case, verified instead by running the live guard from a foreign cwd) is
// unaffected by this extraction: the binding never lived here and still
// doesn't. Everything below is parameterised on `dir`/`dirs`/`sources` -- pure
// functions with no closure over either guard's own identifiers.
import fs from 'node:fs';
import path from 'node:path';

/**
 * The three files this repo actually keeps keys in, FIRST file wins.
 *
 * Reading only .env gave one machine two answers: a developer keeping
 * credentials in .env.local got a green #68 beside a #67 that exited 2 and
 * blamed the secrets. Not exported: nothing outside readEnvFiles below reads
 * it, and the previous extraction attempt's own review found it exported for
 * no consumer while both guards carried paragraphs explaining they
 * deliberately did not re-export it -- dead surface, not a convenience.
 */
const ENV_FILES = ['.env.local', '.env', '.env.development'];

/**
 * Object.create(null), and not for tidiness. Every bug in this parser
 * presents downstream as a confusing missing-credentials exit 2, and a plain
 * `{}` gives a .env line spelled `__proto__=x` or `constructor=x` a silent,
 * invisible effect on the result -- the one failure mode this module can
 * least afford to add. A null-prototype bag makes those ordinary keys.
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
    // UNTRIMMED on purpose: the comment scan below keys on whitespace
    // immediately before `#`, and `.trim()` would already have erased that
    // whitespace for a comment-only remainder (`A=<TAB># cmt`), making it
    // indistinguishable from `A=#cmt` (no marker, data). Scan this raw slice
    // first; `value` (trimmed) is only what the quote/comment branches below
    // actually keep.
    const rawSuffix = line.slice(idx + 1);
    let value = rawSuffix.trim();
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
      //
      // The needle requires an ACTUAL preceding whitespace character in the
      // untrimmed text -- never the bare fact of being first -- so
      // `A=#nospace` and `A=a#b` (no whitespace anywhere) keep their `#` as
      // data. SPACE or TAB only, not the regex `\s` class: `\s` also matches
      // NBSP (U+00A0) and the Unicode line/paragraph separators, so a `.env`
      // value corrupted by the exact cp1252 mojibake this repo's own
      // CLAUDE.md warns about would have a literal `#` mid-value silently
      // read as a comment marker.
      let hash = -1;
      for (let i = 1; i < rawSuffix.length; i++) {
        const prev = rawSuffix[i - 1];
        if (rawSuffix[i] === '#' && (prev === ' ' || prev === '\t')) { hash = i; break; }
      }
      if (hash >= 0) value = rawSuffix.slice(0, hash).trim();
    }
    // A blank must not clobber a real value FOR THE SAME KEY within one
    // file, matching the cross-file/cross-dir rule below -- but unlike
    // those merges (where FILE ORDER is a priority list, so first-non-blank
    // is correct), lines within one file are a sequential edit log: a real
    // value legitimately REPLACES an earlier real one (an operator rotating
    // a credential by appending a corrected line below a stale one). So the
    // new value always wins UNLESS it is itself blank AND would clobber a
    // real one -- the one case this rule exists to stop.
    if (value.trim() !== '' || String(vars[key] ?? '').trim() === '') vars[key] = value;
  }
  return vars;
}

/**
 * Files only, one directory, FIRST NON-BLANK wins -- not first PRESENT. A
 * stale `VITE_SUPABASE_URL=` left in .env.local must not shadow a real value
 * sitting in .env.
 */
export function readEnvFiles(dir) {
  const merged = Object.create(null);
  for (const name of ENV_FILES) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    const parsed = parseDotEnv(fs.readFileSync(file, 'utf8'));
    for (const key of Object.keys(parsed)) {
      if (String(merged[key] ?? '').trim() === '') merged[key] = parsed[key];
    }
  }
  return merged;
}

/**
 * ROOT, then cwd -- additive, not a replacement, in the caller's own list.
 * This function makes no assumption about what `dirs` contains or in what
 * order; it merges first-non-blank-per-name across whatever list it is
 * given, so a blank value in the first directory does not block a real one
 * in the second. NO DEFAULT PARAMETER, deliberately: a default here would be
 * a seam every canary case could override, leaving the caller's own
 * ROOT-vs-cwd resolution never once driven by a live call.
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
 * First non-blank value, NAME-major then SOURCE-major.
 *
 * Source-major (both guards' shape until 2026-08-22) fixed a blank-export
 * hole and opened a worse one: a FALLBACK name exported by a running
 * `supabase start` (bare SUPABASE_URL) beat the PRIMARY name (VITE_SUPABASE_URL)
 * sitting correctly in this repo's own files, because source-major checks env
 * against every name before ever looking at the files. That reads the LOCAL
 * stack against prod-correct files and turns a healthy tree into a false
 * CONTRACT violation (exit 1, "apply the ADMIN migration") -- worse than the
 * blank-shadowing bug it replaced, which only ever produced an honest exit 2.
 *
 * Name-major closes both without reopening either: for each name, in order,
 * take the first non-blank value across the sources given. A blank export
 * still falls through to a real file value FOR THAT NAME, and
 * db-contract-check.yml exports secrets under the PRIMARY names only
 * (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY), so CI already wins on
 * the NAME axis -- source-major bought CI nothing it did not already have.
 */
export const firstValue = (sources, ...names) => {
  for (const name of names) {
    for (const source of sources) {
      const value = String(source[name] ?? '').trim();
      if (value) return value;
    }
  }
  return '';
};
