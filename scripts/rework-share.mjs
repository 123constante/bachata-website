/**
 * rework-share.mjs -- the rework-share metric, rendered for the weekly digest.
 *
 * WHAT IT MEASURES. Of the trailing 100 commit subjects, the share that look like
 * REWORK -- a fix, a revert, a review follow-up, a punch-list item, a repair. The
 * operating-model arc exists to push that share down; this is the number that says
 * whether it worked, and it arrives unasked every Monday instead of being counted by
 * hand once a quarter.
 *
 * THE RECIPE IS FROZEN AND OWNED ELSEWHERE. The regex below is a verbatim copy of the
 * one pinned in the admin repo's docs/workflow-overhaul-adoption-checkpoint.md:
 *
 *   git log --format=%s -100
 *     | grep -c -iE '^(fix|revert)|review|punch|follow-?up|repair|reconcile|correction'
 *
 * That doc is the OWNER. A number measured with a different recipe is not comparable to
 * the 52% / 51% baselines, so this file must never "improve" the pattern -- if it has to
 * change, the owner doc changes first and records a new baseline at the same time.
 *
 * TWO IMPLEMENTATIONS ON PURPOSE. The local repo is measured by running the frozen shell
 * pipeline itself, so drift from the recipe is impossible. The admin repo has no local
 * checkout in CI, so its subjects arrive over `gh api` and are classified by a JS twin of
 * the same pattern. --self-test asserts the twin and the shell agree on the same input; a
 * twin that silently diverged would make the two rows incomparable, which is the whole
 * point of freezing the recipe.
 *
 * FAIL-SOFT IS THE CONTRACT. The digest is the one push channel Ricky reads. A missing
 * token, a rate limit or a network failure degrades one LINE to "unavailable" with the
 * reason; it never fails the step and never kills the digest.
 *
 * Usage:
 *   node scripts/rework-share.mjs --markdown     # digest section on stdout
 *   node scripts/rework-share.mjs --self-test    # both-directions proof, exit 1 on failure
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isEntryPoint } from "./lib/entry-point.mjs";

// Verbatim from the owner doc (modulo joining its wrapped line). Do not edit without
// editing the owner doc first - a copy that drifts from the pinned recipe stops being
// comparable to the 52%/51% baselines. Note there is NO `|| true` here: the owner doc
// does not carry one, and the byte-for-byte test in tests/reworkShare.test.ts must be
// able to accept a verbatim paste. grep exits 1 on a zero count, so the CALL SITE
// appends the guard instead.
const FROZEN_RECIPE =
  "git log --format=%s -100 | grep -c -iE '^(fix|revert)|review|punch|follow-?up|repair|reconcile|correction'";

// JS twin of the grep pattern above. POSIX ERE and JS agree on this construct: `^(fix|revert)`
// is anchored, every other alternative floats. `-i` maps to the `i` flag; `grep -c` counts
// matching LINES, which is what .filter() over one-subject-per-element does.
const REWORK_RE = /^(fix|revert)|review|punch|follow-?up|repair|reconcile|correction/i;

// Baselines are ADMIN measurements (owner doc, table rows 1 and 2). The Website repo has no
// pre-overhaul baseline: its machinery only landed in this arc, so its first digest IS its
// baseline. Saying so beats printing a delta against a number never measured here.
const ADMIN_BASELINE_PCT = 52;
const ADMIN_PRE_OVERHAUL_PCT = 51;
const TARGET_PCT = 25;

const ADMIN_REPO = "123constante/bachata-admin";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Run a shell pipeline in THIS script's checkout - never process.cwd(), which would
 * quietly measure whatever repo the caller happened to stand in and label it "Website".
 */
function sh(command, input) {
  return execFileSync("bash", ["-c", command], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: [input == null ? "ignore" : "pipe", "pipe", "pipe"],
    ...(input == null ? {} : { input }),
  });
}

/** Count of rework-looking subjects among `subjects`, via the JS twin. */
function countTwin(subjects) {
  return subjects.filter((s) => REWORK_RE.test(s)).length;
}

/**
 * Trailing-N subjects of the local repo (the denominator; may be < 100 on a young
 * repo). Via git directly, NOT bash: this repo's dev boxes are Windows, and a missing
 * bash would otherwise read as "empty log" here while the bash-based recipe fails
 * separately - two different failure modes must not share one symptom.
 */
function localSubjects() {
  try {
    return execFileSync("git", ["log", "--format=%s", "-100"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split("\n")
      .filter((l) => l.length > 0);
  } catch {
    return [];
  }
}

/** Local repo measured by the frozen pipeline itself. Returns {n, total} or null. */
function localViaRecipe() {
  let n;
  try {
    // grep -c exits 1 on a zero count; that is a valid measurement, not a failure.
    n = Number.parseInt(sh(FROZEN_RECIPE + " || true").trim(), 10);
  } catch {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  const total = localSubjects().length;
  return total > 0 ? { n, total } : null;
}

/**
 * Admin subjects over the REST API. Requires ADMIN_READ_TOKEN (fine-grained, admin repo,
 * Contents:read) which is handed to gh as GH_TOKEN. Returns {subjects} or {error}.
 */
function adminSubjects() {
  if (!process.env.ADMIN_READ_TOKEN) return { error: "ADMIN_READ_TOKEN not set" };
  let raw;
  try {
    raw = execFileSync(
      "gh",
      [
        "api",
        `repos/${ADMIN_REPO}/commits?per_page=100`,
        // The SUBJECT is extracted inside jq, and it must mirror what git %s means: the
        // first PARAGRAPH (up to the first blank line) with embedded newlines folded to
        // spaces. First-physical-line would drop the tail of a wrapped subject, so a
        // rework keyword on the continuation line would count in the Website row (recipe)
        // and not in this row (twin) -- the exact incomparability the freeze forbids.
        // gsub folds the paragraph to one output line per commit, keeping the denominator honest.
        "--jq",
        '.[].commit.message | split("\\n\\n")[0] | gsub("\\n"; " ")',
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GH_TOKEN: process.env.ADMIN_READ_TOKEN },
        // Hard timeout: gh has no default request timeout, and a stalled api.github.com
        // would otherwise block this synchronous call until the workflow-level cap kills
        // the whole digest job -- the exact all-or-nothing this file exists to avoid.
        timeout: 20_000,
        killSignal: "SIGKILL",
      }
    );
  } catch (err) {
    // stderr carries the useful half (404 = the token cannot see the repo, 401 = bad token).
    const detail = String(err.stderr || err.message || err).trim().split("\n")[0] || "gh api failed";
    return { error: detail.slice(0, 160) };
  }
  // One output line per commit, guaranteed by the jq filter above.
  const subjects = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  return subjects.length ? { subjects } : { error: "no commits returned" };
}

function pct(n, total) {
  return Math.round((n / total) * 100);
}

function verdict(sharePct) {
  return sharePct <= TARGET_PCT ? "at target" : `over target by ${sharePct - TARGET_PCT} pts`;
}

function render() {
  const lines = [];
  lines.push("## Rework share (trailing 100)");
  lines.push("");
  lines.push(
    "Share of the last 100 commit subjects that look like rework (fix / revert / review / " +
      "punch / follow-up / repair / reconcile / correction). Frozen recipe &mdash; owner: " +
      "admin `docs/workflow-overhaul-adoption-checkpoint.md`. Target **&le;" + TARGET_PCT + "%**."
  );
  lines.push("");
  lines.push("| Repo | Rework | Share | vs baseline |");
  lines.push("|---|---|---|---|");

  const local = localViaRecipe();
  if (local) {
    const share = pct(local.n, local.total);
    lines.push(
      `| Website | ${local.n} / ${local.total} | **${share}%** | no pre-overhaul baseline ` +
        `(first measured this arc) &mdash; ${verdict(share)} |`
    );
  } else {
    lines.push("| Website | &mdash; | unavailable | local git log unreadable |");
  }

  const admin = adminSubjects();
  if (admin.subjects) {
    const n = countTwin(admin.subjects);
    const total = admin.subjects.length;
    const share = pct(n, total);
    const delta = share - ADMIN_BASELINE_PCT;
    const arrow =
      delta === 0 ? "level with" : delta < 0 ? `${Math.abs(delta)} pts below` : `${delta} pts above`;
    lines.push(
      `| admin | ${n} / ${total} | **${share}%** | ${arrow} the ${ADMIN_BASELINE_PCT}% baseline ` +
        `(${ADMIN_PRE_OVERHAUL_PCT}% pre-overhaul) &mdash; ${verdict(share)} |`
    );
  } else {
    lines.push(`| admin | &mdash; | unavailable | ${admin.error} |`);
  }

  lines.push("");
  lines.push(
    "_Trailing-100 is a moving window over calendar-irregular commits, so week-to-week " +
      "wobble is expected; the trend is the signal, not any single reading. Known bias: the " +
      "frozen pattern's unanchored `review` also matches `preview` commits and features " +
      "named after review tooling, so the raw share reads a few points HIGH -- and more so " +
      "as review machinery ships. Comparable across weeks; not a pure rework count._"
  );
  return lines.join("\n");
}

/* ---------------------------------------------------------------- self-test */

const FIXTURES = [
  // [subject, isRework]
  ["fix(event-page): render time-less sessions", true],
  ['Revert "feat(map): cluster markers"', true],
  ["feat(raffle): sitewide all-time winners", false],
  ["chore(deps): bump vite", false],
  ["feat(hooks): fold the review findings", true],
  ["docs: punch list for the venue arc", true],
  ["feat: follow-up on the organiser link", true],
  ["feat: followup on the organiser link", true],
  ["chore: reconcile the migration ledger", true],
  ["chore: repair the corrupt fixture", true],
  ["style: correction to the header copy", true],
  ["perf(home): window the SSR feed", false],
  ["prefix-fix: not anchored at the start", false],
  ["FIX(ci): uppercase still counts", true],
];

function selfTest() {
  let failures = 0;
  const fail = (msg) => {
    console.error(`  FAIL ${msg}`);
    failures += 1;
  };

  // Direction 1: the twin classifies each fixture as expected -- rework AND non-rework.
  for (const [subject, expected] of FIXTURES) {
    const got = REWORK_RE.test(subject);
    if (got !== expected) fail(`classify "${subject}" -> ${got}, expected ${expected}`);
  }
  console.log(`  ${FIXTURES.length} classification fixtures (both directions)`);

  // Direction 2: twin vs the frozen grep on the SAME input - the FIXTURES, hermetically,
  // not whatever the last 100 commits happen to contain. The equivalence being proven
  // (POSIX ERE vs the JS twin) is a property of the two patterns, so a fixture feed is
  // deterministic and exercises every edge case (anchoring, -i, follow-?up) on every
  // run, at any checkout depth. A live-history comparison would silently weaken
  // whenever recent commits contain no edge cases - and it forced a fetch-depth knob
  // onto CI in an earlier draft of this file.
  const grepPart = FROZEN_RECIPE.split(" | ").slice(1).join(" | ");
  const fixtureSubjects = FIXTURES.map(([subject]) => subject);
  try {
    const viaGrep = Number.parseInt(
      sh(grepPart + " || true", fixtureSubjects.join("\n") + "\n").trim(),
      10
    );
    const viaTwin = countTwin(fixtureSubjects);
    if (!Number.isFinite(viaGrep)) {
      fail("frozen grep did not produce a count over the fixtures");
    } else if (viaGrep !== viaTwin) {
      fail(`twin/grep disagree on the ${fixtureSubjects.length} fixtures: grep ${viaGrep}, twin ${viaTwin}`);
    } else {
      console.log(`  twin == frozen grep on all ${fixtureSubjects.length} fixtures (${viaGrep} rework)`);
    }
  } catch (err) {
    // A missing bash is an environment gap, not a parity verdict - name it as itself.
    fail(
      err && err.code === "ENOENT"
        ? "bash unavailable -- cannot execute the frozen grep for the parity check"
        : `frozen grep failed: ${(err && err.message) || err}`
    );
  }

  // Direction 3: the admin arm degrades to a LINE, never a throw, when there is no token.
  const saved = process.env.ADMIN_READ_TOKEN;
  delete process.env.ADMIN_READ_TOKEN;
  let degraded;
  let md = "";
  try {
    degraded = adminSubjects();
    md = render();
  } catch (err) {
    fail(`token-less path threw: ${err.message}`);
  } finally {
    if (saved !== undefined) process.env.ADMIN_READ_TOKEN = saved;
  }
  if (!degraded || !degraded.error || degraded.subjects) fail("token-less admin arm did not degrade");
  else console.log(`  token-less admin arm degrades: "${degraded.error}"`);

  // ...and the degraded state still renders a COMPLETE section, not a stub.
  if (md) {
    if (!/^## Rework share/m.test(md)) fail("rendered section lost its heading");
    if (!/\| admin \|.*unavailable/.test(md)) fail("degraded admin row missing from render");
    if (!/\| Website \|/.test(md)) fail("Website row missing from render");
    if (!failures) console.log("  degraded render still emits the heading + both rows");
  }

  if (failures) {
    console.error(`rework-share --self-test: ${failures} FAILURE(S)`);
    return 1;
  }
  console.log("rework-share --self-test: OK");
  return 0;
}

/* ---------------------------------------------------------------------- cli */

// Only when RUN, never when imported. Without this guard the test file's `import` would
// fire a live gh call and print the whole section into the vitest log -- an import with a
// network side effect is the kind of thing that turns a unit suite flaky months later.
// Realpath-to-realpath (scripts/lib/entry-point.mjs) -- path.resolve() does not
// follow a junction or symlink, so the compare it replaces could report
// "imported" for a direct invocation and print nothing at all.
if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  const unknown = argv.filter((a) => a !== "--markdown" && a !== "--self-test");
  // exitCode, never process.exit(): on Windows an immediate exit can discard a pending
  // pipe write (the libuv quirk pre-ship.mjs documents) - here that pending write IS
  // the digest section.
  if (unknown.length) {
    console.error(`rework-share: unknown argument(s): ${unknown.join(", ")}`);
    console.error("usage: node scripts/rework-share.mjs [--markdown|--self-test]");
    process.exitCode = 2;
  } else if (argv.includes("--self-test")) {
    process.exitCode = selfTest();
  } else {
    // --markdown is the only rendering mode; a bare invocation renders too, so a digest step
    // that forgot the flag still produces the section rather than silence.
    try {
      console.log(render());
    } catch (err) {
      // Belt and braces: the digest never dies because this file threw.
      console.log("## Rework share (trailing 100)\n\nunavailable &mdash; " + (err.message || String(err)));
    }
  }
}

export { REWORK_RE, FROZEN_RECIPE, countTwin, render, selfTest };
