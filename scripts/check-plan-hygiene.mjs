/**
 * check-plan-hygiene.mjs -- the plan-layer guard (operating-model-v2 Phase 5).
 *
 * WHY: ~115 files live in ~/.claude/plans and there is no way to answer "which
 * arcs are live" without opening them. This lints the frontmatter convention on
 * arc-tagged plans (status / arc / supersedes), cross-checks the repo's
 * .claude/arc-state.json against the plan it names, and can render
 * PLANS-INDEX.md so that question costs one file read.
 *
 * NO SHEBANG, deliberately -- same reason as pre-ship.mjs: this module is also
 * IMPORTED (by tests, and by pre-ship for plansDir), and vite-node wraps an
 * imported module body in a function, where a shebang is a SyntaxError. It is
 * always invoked as "node scripts/check-plan-hygiene.mjs".
 *
 * GRANDFATHERING is the load-bearing design decision. ~111 of the files
 * predate the convention (4 arc-tagged at seeding time) and will never be
 * retro-tagged; a guard that reds on them on day one is a guard that gets
 * bypassed on day two. The rule: a file is linted ONLY when it declares a
 * non-empty "arc:" frontmatter key. Everything else -- no frontmatter, a bare
 * "---" horizontal rule opening the file, an unterminated fence with no arc:,
 * a "-agent-<hex>.md" subagent transcript -- is grandfathered: never linted,
 * never indexed. Grandfathered files ARE counted in the index footer, so the
 * size of the exclusion stays visible instead of becoming invisible.
 *
 * READ-ONLY BY DEFAULT (review finding 3): every other check:* script in this
 * repo is read-only and pre-ship runs this one as a gate, so the default mode
 * only LINTS. "--render" opts into (re)writing PLANS-INDEX.md, and a stale or
 * missing index is reported as a note, never a failure. Unknown flags are an
 * error -- "--norender" must not silently mean the opposite of "--no-render".
 *
 * FAIL-OPEN on an ABSENT plans dir: a CI checkout has no home plans dir, and a
 * check that reds on every CI run trains you to ignore it. Absent => SKIP,
 * exit 0. An UNREADABLE dir, an unlistable dir, or a non-directory at that
 * path is a DIFFERENT thing and reds -- the same ENOENT-vs-unreadable
 * distinction Phase 4's loadArcState had to learn.
 *
 * ARC-STATE CROSS-CHECK (review finding 7): arc: slugs are free text, so a
 * typo silently creates a phantom arc and defeats the one-live-per-arc rule.
 * The repo's own .claude/arc-state.json carries the canonical slug + plan
 * path, so when it exists and is live, the plan it names must exist, be
 * arc-tagged, carry the SAME arc slug, and be status: live. Missing, corrupt,
 * or closed arc-state skips the cross-check silently -- the Phase 4
 * checkpoint hook owns those states.
 *
 * Flags:
 *   --render      after a passing lint, write PLANS-INDEX.md
 *   --no-render   accepted no-op (lint-only is the default since finding 3)
 *   --self-test   tmpdir fixtures proving every rule in BOTH directions
 *
 * Env:
 *   PLANS_DIR       override the plans directory (self-test fixtures and CI)
 *   ARC_STATE_FILE  override the arc-state path (default <cwd>/.claude/arc-state.json)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isEntryPoint } from "./lib/entry-point.mjs";

/** The status enum, compared case-insensitively. Anything else is a hard error. */
export const STATUSES = ["live", "superseded", "shipped", "scratch"];

export const INDEX_FILENAME = "PLANS-INDEX.md";

/**
 * Only the first 4 KB of a plan is read. Frontmatter lives at byte 0 by
 * definition, and the arc plan itself is 56 KB -- reading ~115 files whole to
 * find a four-line header is the kind of waste the economy amendment exists to
 * stop. An ARC-TAGGED header whose fence does not close inside this window is
 * an error telling you to keep the frontmatter at the top and short.
 */
export const FRONTMATTER_BYTES = 4096;

/** Subagent transcript naming, e.g. "audit-the-thing-agent-a23b34c357e08294a.md". */
export const AGENT_TRANSCRIPT = /-agent-[0-9a-f]{6,}\.md$/i;

const STATUS_RANK = { live: 0, shipped: 1, superseded: 2, scratch: 3 };

/** Resolve the plans dir: PLANS_DIR wins, else ~/.claude/plans. */
export function plansDir(env = process.env) {
  const override = env.PLANS_DIR && String(env.PLANS_DIR).trim();
  return override ? path.resolve(override) : path.join(os.homedir(), ".claude", "plans");
}

/** Read at most `bytes` bytes off the front of a file, as utf8. */
export function readHead(file, bytes = FRONTMATTER_BYTES) {
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, read).toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Parse a leading "---" frontmatter block out of a file head.
 *
 * Returns { kind: "none" } when the file does not open with a fence.
 * Otherwise fields are collected up to the closing fence or the window end:
 * { kind: "ok", fields, endLine } with endLine the closing-fence line index,
 * or { kind: "unterminated", fields } when no closing fence appears in the
 * window. Fields are returned even for "unterminated" so the caller can
 * grandfather a bare horizontal rule (no arc:) instead of erroring on it
 * (review finding 1). Lines that are not "key: value" are ignored rather than
 * rejected -- strictness there would red legitimate multi-line YAML for no
 * guard value.
 */
export function parseFrontmatter(head) {
  const lines = String(head).split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== "---") return { kind: "none" };
  const fields = new Map();
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") return { kind: "ok", fields, endLine: i };
    const m = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(lines[i]);
    if (m) fields.set(m[1].toLowerCase(), m[2].trim());
  }
  return { kind: "unterminated", fields };
}

/**
 * First markdown H1 at or after `fromLine`, for a human label in the index.
 * The caller passes the line AFTER the closing fence so a "# comment" inside
 * the frontmatter block never becomes the label (review finding 10).
 */
export function firstHeading(head, fromLine = 0) {
  const lines = String(head).split(/\r?\n/);
  for (let i = fromLine; i < lines.length; i += 1) {
    const m = /^#\s+(.+?)\s*$/.exec(lines[i]);
    if (m) return m[1];
  }
  return null;
}

/** Index labels are interpolated into markdown link text: keep them inert. */
function safeLabel(text, max = 90) {
  const flat = String(text).replace(/[\r\n]+/g, " ").replace(/[[\]]/g, "").trim();
  return flat.length > max ? flat.slice(0, max - 3) + "..." : flat;
}

/**
 * Link TARGETS need their own escaping (review finding 13): a space or a
 * parenthesis in a filename otherwise truncates the markdown link.
 */
function safeTarget(name) {
  return encodeURI(String(name)).replace(/\(/g, "%28").replace(/\)/g, "%29");
}

const err = (file, code, message) => ({ file, code, message });

/**
 * Walk the dir once: split every .md FILE into tracked (arc-tagged) vs
 * grandfathered, and surface parse-level errors. Directories whose names end
 * in .md are ignored entirely (review finding 8), and an unlistable dir is an
 * error record, not a throw (review finding 4).
 */
export function collect(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return {
      allNames: [],
      tracked: [],
      grandfathered: [],
      errors: [err(dir, "E_UNREADABLE_DIR", "plans dir exists but could not be listed: " + (e && e.code ? e.code : String(e)))],
    };
  }
  const allNames = entries
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".md") && d.name !== INDEX_FILENAME)
    .map((d) => d.name)
    .sort();

  const tracked = [];
  const grandfathered = [];
  const errors = [];

  for (const name of allNames) {
    if (AGENT_TRANSCRIPT.test(name)) {
      grandfathered.push(name);
      continue;
    }
    let head;
    try {
      head = readHead(path.join(dir, name));
    } catch (e) {
      errors.push(err(name, "E_UNREADABLE", "could not be read: " + (e && e.code ? e.code : String(e))));
      continue;
    }
    const fm = parseFrontmatter(head);
    if (fm.kind === "none") {
      grandfathered.push(name);
      continue;
    }
    const arc = (fm.fields.get("arc") || "").trim();
    if (!arc) {
      // Covers the bare "---" horizontal-rule opener and any untagged fence,
      // terminated or not: no arc claim, nothing to hold the file to.
      grandfathered.push(name);
      continue;
    }
    if (fm.kind === "unterminated") {
      // An ARC-TAGGED header that never closes is a truncated or overlong
      // header, and must not silently become a free pass.
      errors.push(
        err(
          name,
          "E_FRONTMATTER_UNTERMINATED",
          'declares "arc: ' + arc + '" but no closing "---" fence appears within the first ' +
            FRONTMATTER_BYTES +
            " bytes -- keep the frontmatter block at the very top and short",
        ),
      );
      continue;
    }
    tracked.push({
      name,
      arc,
      status: (fm.fields.get("status") || "").trim().toLowerCase(),
      supersedes: (fm.fields.get("supersedes") || "").trim(),
      title: firstHeading(head, fm.endLine + 1) || name,
    });
  }

  return { allNames, tracked, grandfathered, errors };
}

/**
 * The frontmatter rules. `allNames` is every .md on disk INCLUDING
 * grandfathered files: superseding a legacy untagged plan is legitimate, so
 * target existence is checked against disk (case-insensitively -- this is an
 * NTFS host, review finding 9), while "target is not still live" can only be
 * checked when the target carries frontmatter. Untagged targets are reported
 * informationally by the caller so the weaker check stays visible.
 */
export function lintTracked(tracked, allNames = tracked.map((p) => p.name)) {
  const errors = [];
  const onDisk = new Map(allNames.map((n) => [n.toLowerCase(), n]));
  const byName = new Map(tracked.map((p) => [p.name, p]));
  const untaggedTargets = [];

  for (const p of tracked) {
    if (!p.status) {
      errors.push(err(p.name, "E_STATUS_MISSING", 'is arc-tagged ("arc: ' + p.arc + '") but has no "status:" key'));
    } else if (!STATUSES.includes(p.status)) {
      errors.push(err(p.name, "E_STATUS_ENUM", 'status: "' + p.status + '" is not one of ' + STATUSES.join(" | ")));
    }

    if (!p.supersedes) continue;
    if (/[\/]/.test(p.supersedes)) {
      errors.push(
        err(p.name, "E_SUPERSEDES_PATH", 'supersedes: "' + p.supersedes + '" must be a bare filename in the plans dir'),
      );
      continue;
    }
    const targetRef = p.supersedes.toLowerCase().endsWith(".md") ? p.supersedes : p.supersedes + ".md";
    if (targetRef.toLowerCase() === p.name.toLowerCase()) {
      errors.push(err(p.name, "E_SUPERSEDES_SELF", "supersedes itself"));
      continue;
    }
    const target = onDisk.get(targetRef.toLowerCase());
    if (!target) {
      errors.push(
        err(p.name, "E_SUPERSEDES_MISSING_TARGET", 'supersedes: "' + targetRef + '" does not exist in the plans dir'),
      );
      continue;
    }
    const targetPlan = byName.get(target);
    if (!targetPlan) {
      untaggedTargets.push(p.name + " -> " + target);
    } else if (targetPlan.status === "live") {
      errors.push(
        err(
          p.name,
          "E_SUPERSEDES_TARGET_LIVE",
          "supersedes " + target + ', which is still "status: live" -- mark the superseded plan as superseded',
        ),
      );
    }
  }

  const liveByArc = new Map();
  for (const p of tracked) {
    if (p.status !== "live") continue;
    if (!liveByArc.has(p.arc)) liveByArc.set(p.arc, []);
    liveByArc.get(p.arc).push(p.name);
  }
  for (const [arc, names] of [...liveByArc].sort()) {
    if (names.length > 1) {
      // One error per offending FILE (review finding 11): consumers key on
      // `.file` as a single path, so a comma-joined list there resolves to
      // nothing in an editor jump or a CI annotation.
      for (const name of names) {
        errors.push(
          err(
            name,
            "E_MULTI_LIVE",
            'arc "' + arc + '" has ' + names.length + " live plans (" + names.join(", ") + "); exactly one may be live",
          ),
        );
      }
    }
  }

  return { errors, untaggedTargets };
}

/**
 * Cross-check .claude/arc-state.json against the plans dir (review finding 7).
 *
 * Pure: `state` is the parsed arc-state (or null), `tracked`/`allNames` come
 * from collect(). Missing, corrupt, closed, or plan-less arc-state SKIPs --
 * the Phase 4 checkpoint hook owns those states; this only asserts that a
 * LIVE arc-state's canonical plan is present, tracked, same-arc, and live,
 * which is what catches an `arc:` typo creating a phantom arc.
 */
export function lintArcState(state, tracked, allNames) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return { checked: false, errors: [] };
  }
  if (state.phase === "done" || state.closed_at) return { checked: false, errors: [] };
  const arc = typeof state.arc === "string" ? state.arc.trim() : "";
  const planPath = typeof state.plan === "string" ? state.plan.trim() : "";
  if (!arc || !planPath) return { checked: false, errors: [] };

  const base = planPath.split(/[\/]/).pop();
  const onDisk = new Map(allNames.map((n) => [n.toLowerCase(), n]));
  const actual = onDisk.get(String(base).toLowerCase());
  if (!actual) {
    return {
      checked: true,
      errors: [err(base, "E_ARCSTATE_PLAN_MISSING", 'arc-state (arc "' + arc + '") names a plan that is not in the plans dir')],
    };
  }
  const plan = tracked.find((p) => p.name === actual);
  if (!plan) {
    return {
      checked: true,
      errors: [
        err(actual, "E_ARCSTATE_PLAN_UNTRACKED", 'arc-state (arc "' + arc + '") names this plan, but it carries no arc: frontmatter'),
      ],
    };
  }
  const errors = [];
  if (plan.arc !== arc) {
    errors.push(
      err(actual, "E_ARCSTATE_ARC_MISMATCH", 'arc-state says arc "' + arc + '" but the plan is tagged "arc: ' + plan.arc + '" -- fix the typo on whichever side is wrong'),
    );
  }
  if (plan.status !== "live") {
    errors.push(
      err(actual, "E_ARCSTATE_PLAN_NOT_LIVE", 'arc-state is live for arc "' + arc + '" but the plan is "status: ' + plan.status + '"'),
    );
  }
  return { checked: true, errors };
}

/** Full pipeline for one directory. Returns records; never throws on the ordinary paths. */
export function run(dir, { arcState = null } = {}) {
  let stat;
  try {
    stat = fs.statSync(dir);
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return { skipped: true, reason: "no plans dir at " + dir, errors: [], tracked: [], grandfathered: [], allNames: [] };
    }
    return {
      skipped: false,
      errors: [
        err(dir, "E_UNREADABLE_DIR", "plans dir exists but could not be read: " + (e && e.code ? e.code : String(e))),
      ],
      tracked: [],
      grandfathered: [],
      allNames: [],
    };
  }
  if (!stat.isDirectory()) {
    return {
      skipped: false,
      errors: [err(dir, "E_NOT_A_DIRECTORY", "PLANS_DIR points at something that is not a directory")],
      tracked: [],
      grandfathered: [],
      allNames: [],
    };
  }

  const c = collect(dir);
  const { errors: ruleErrors, untaggedTargets } = lintTracked(c.tracked, c.allNames);
  const arcCheck = lintArcState(arcState, c.tracked, c.allNames);
  return {
    skipped: false,
    ...c,
    untaggedTargets,
    arcStateChecked: arcCheck.checked,
    errors: [...c.errors, ...ruleErrors, ...arcCheck.errors],
  };
}

/**
 * Render PLANS-INDEX.md. Deterministic by construction -- no timestamps, no
 * drifting counts -- so re-rendering an unchanged tree is a byte-identical
 * write and the file never churns.
 */
export function renderIndex({ tracked, grandfathered }) {
  const byArc = new Map();
  for (const p of tracked) {
    if (!byArc.has(p.arc)) byArc.set(p.arc, []);
    byArc.get(p.arc).push(p);
  }
  for (const plans of byArc.values()) {
    plans.sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || a.name.localeCompare(b.name));
  }

  const arcs = [...byArc.keys()].sort();
  const live = arcs.filter((a) => byArc.get(a).some((p) => p.status === "live"));
  const closed = arcs.filter((a) => !live.includes(a));

  const out = [
    "# Plans index",
    "",
    "<!-- MACHINE-GENERATED by scripts/check-plan-hygiene.mjs --render",
    "     (npm run plans:index). Hand edits are overwritten. Change a plan's",
    "     frontmatter instead. -->",
    "",
  ];

  const section = (heading, names, empty) => {
    out.push("## " + heading, "");
    if (names.length === 0) {
      out.push(empty, "");
      return;
    }
    for (const arc of names) {
      out.push("### " + safeLabel(arc), "");
      for (const p of byArc.get(arc)) {
        out.push("- `" + p.status + "` [" + safeLabel(p.title) + "](" + safeTarget(p.name) + ")");
      }
      out.push("");
    }
  };

  section("Live arcs", live, "_None -- no arc has a live plan._");
  section("Closed arcs", closed, "_None._");

  out.push(
    "---",
    "",
    grandfathered.length +
      " grandfathered plan file(s) are not indexed: no `arc:` frontmatter, or a" +
      " `-agent-<hex>` subagent transcript. They are never linted either.",
    "",
  );

  return out.join("\n");
}

function report(dir, res) {
  if (res.skipped) {
    console.log("SKIP plan hygiene -- " + res.reason + " (fail-open: CI has no home plans dir)");
    return 0;
  }
  // The supersedes-target-was-untagged notes print on BOTH verdicts (review
  // finding 12): they exist to keep the weaker check visible, and a failing
  // run is exactly when the operator is reading most carefully.
  const notes = (res.untaggedTargets || []).map(
    (t) => "  note: " + t + " supersedes an untagged plan (its status could not be checked)",
  );
  if (res.errors.length) {
    console.error("\nFAIL plan hygiene -- " + res.errors.length + " problem(s) in " + dir + "\n");
    for (const e of res.errors) console.error("  [" + e.code + "] " + e.file + "\n      " + e.message);
    for (const n of notes) console.error(n);
    console.error(
      "\n  Convention: arc plans carry `status: " +
        STATUSES.join("|") +
        "`, `arc: <slug>`, optional `supersedes: <file.md>`.\n" +
        "  A plan with no `arc:` key is grandfathered and never linted.\n",
    );
    return 1;
  }
  console.log(
    "PASS plan hygiene -- " +
      res.tracked.length +
      " arc-tagged plan(s) across " +
      new Set(res.tracked.map((p) => p.arc)).size +
      " arc(s), " +
      res.grandfathered.length +
      " grandfathered" +
      (res.arcStateChecked ? ", arc-state cross-check ok" : "") +
      ".",
  );
  for (const p of res.tracked.filter((x) => x.status === "live")) {
    console.log("  live: " + p.arc + " -> " + p.name);
  }
  for (const n of notes) console.log(n);
  return 0;
}

// ---------------------------------------------------------------------------
// self-test -- THE single rule matrix (review finding 14: the per-rule cases
// live here and only here; tests/planHygiene.test.ts runs this in-process and
// keeps only the spawn-level CLI and index assertions of its own).
// ---------------------------------------------------------------------------

const frontmatter = (fields) =>
  "---\n" +
  Object.entries(fields)
    .map(([k, v]) => k + ": " + v)
    .join("\n") +
  "\n---\n";

function makeDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-hygiene-"));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
  return dir;
}

const plan = (fields, title) => frontmatter(fields) + "\n# " + (title || "A plan") + "\n\nbody\n";

/**
 * Every rule, proven in BOTH directions: a fixture that must pass and a
 * fixture that must fail with a named code. A guard only ever shown to fail is
 * indistinguishable from one that always fails.
 */
export function selfTest(log = console.log) {
  const cases = [];
  const add = (name, files, expectCodes, arcState) => cases.push({ name, files, expectCodes, arcState });

  add("clean tree passes", { "a.md": plan({ status: "live", arc: "alpha" }, "Alpha") }, []);
  add("status enum: a valid value passes", { "a.md": plan({ status: "shipped", arc: "alpha" }) }, []);
  add("status enum: values compare case-insensitively (Status: Live)", { "a.md": plan({ Status: "Live", arc: "alpha" }) }, []);
  add("status enum: a bogus value fails", { "a.md": plan({ status: "in-progress", arc: "alpha" }) }, ["E_STATUS_ENUM"]);
  add("status missing on an arc-tagged plan fails", { "a.md": plan({ arc: "alpha" }) }, ["E_STATUS_MISSING"]);
  add(
    "supersedes: an existing, non-live target passes",
    {
      "old.md": plan({ status: "superseded", arc: "alpha" }),
      "new.md": plan({ status: "live", arc: "alpha", supersedes: "old.md" }),
    },
    [],
  );
  add(
    "supersedes: an extension-less target resolves",
    {
      "old.md": plan({ status: "superseded", arc: "alpha" }),
      "new.md": plan({ status: "live", arc: "alpha", supersedes: "old" }),
    },
    [],
  );
  add(
    "supersedes: target casing is forgiven on this NTFS host",
    {
      "old-plan.md": plan({ status: "superseded", arc: "alpha" }),
      "new.md": plan({ status: "live", arc: "alpha", supersedes: "Old-Plan.MD" }),
    },
    [],
  );
  add(
    "supersedes: a missing target fails",
    { "new.md": plan({ status: "live", arc: "alpha", supersedes: "ghost.md" }) },
    ["E_SUPERSEDES_MISSING_TARGET"],
  );
  add(
    "supersedes: a still-live target fails",
    {
      "old.md": plan({ status: "live", arc: "beta" }),
      "new.md": plan({ status: "live", arc: "alpha", supersedes: "old.md" }),
    },
    ["E_SUPERSEDES_TARGET_LIVE"],
  );
  add("supersedes: self fails", { "a.md": plan({ status: "live", arc: "alpha", supersedes: "a.md" }) }, [
    "E_SUPERSEDES_SELF",
  ]);
  add(
    "supersedes: a path rather than a bare filename fails",
    {
      "old.md": plan({ status: "shipped", arc: "alpha" }),
      "new.md": plan({ status: "live", arc: "alpha", supersedes: "sub/old.md" }),
    },
    ["E_SUPERSEDES_PATH"],
  );
  add(
    "supersedes: an untagged (grandfathered) target passes",
    {
      "legacy.md": "# Legacy plan\n\nno frontmatter\n",
      "new.md": plan({ status: "live", arc: "alpha", supersedes: "legacy.md" }),
    },
    [],
  );
  add(
    "one live per arc: two live in DIFFERENT arcs passes",
    { "a.md": plan({ status: "live", arc: "alpha" }), "b.md": plan({ status: "live", arc: "beta" }) },
    [],
  );
  add(
    "one live per arc: two live in the SAME arc fails, one error per file",
    { "a.md": plan({ status: "live", arc: "alpha" }), "b.md": plan({ status: "live", arc: "alpha" }) },
    ["E_MULTI_LIVE", "E_MULTI_LIVE"],
  );
  add(
    "grandfathering: an untagged plan full of garbage is never linted",
    { "legacy.md": "# Legacy\n\nstatus: nonsense\narc: nonsense\n" },
    [],
  );
  add(
    "grandfathering: an -agent-<hex> transcript is never linted, even arc-tagged and broken",
    { "x-agent-a23b34c357e08294a.md": plan({ status: "nonsense", arc: "alpha" }) },
    [],
  );
  add(
    "grandfathering: a bare --- horizontal-rule opener is untagged, not an error",
    { "legacy-hr.md": "---\n\n# An old plan opening with a rule\n" },
    [],
  );
  add(
    "grandfathering: an unterminated fence with NO arc: is untagged, not an error",
    { "legacy.md": "---\nauthor: someone\n\n# no close, no arc\n" },
    [],
  );
  add(
    "an ARC-TAGGED unterminated fence fails (it must not read as untagged)",
    { "a.md": "---\nstatus: live\narc: alpha\n\n# no closing fence\n" },
    ["E_FRONTMATTER_UNTERMINATED"],
  );
  add(
    "an arc-tagged fence closing past the 4 KB window fails with the keep-it-short message",
    { "a.md": "---\nstatus: live\narc: alpha\nnote: " + "x".repeat(FRONTMATTER_BYTES) + "\n---\n\n# t\n" },
    ["E_FRONTMATTER_UNTERMINATED"],
  );
  add("an empty arc: value is grandfathered, not an error", { "a.md": plan({ status: "nonsense", arc: "" }) }, []);
  add("CRLF frontmatter parses", { "a.md": "---\r\nstatus: live\r\narc: alpha\r\n---\r\n\r\n# t\r\n" }, []);

  // Arc-state cross-check, both directions.
  const ARC = (over) => ({ version: 1, arc: "alpha", phase: 5, plan: "C:/home/plans/a.md", set_at: "2026-07-30T00:00:00Z", ...over });
  add("arc-state: matching live plan passes", { "a.md": plan({ status: "live", arc: "alpha" }) }, [], ARC({}));
  add("arc-state: arc slug typo in the plan fails", { "a.md": plan({ status: "live", arc: "alphaa" }) }, ["E_ARCSTATE_ARC_MISMATCH"], ARC({}));
  add("arc-state: named plan absent from the dir fails", { "b.md": plan({ status: "live", arc: "alpha" }) }, ["E_ARCSTATE_PLAN_MISSING"], ARC({}));
  add("arc-state: named plan untagged fails", { "a.md": "# untagged\n" }, ["E_ARCSTATE_PLAN_UNTRACKED"], ARC({}));
  add("arc-state: named plan not live fails", { "a.md": plan({ status: "shipped", arc: "alpha" }) }, ["E_ARCSTATE_PLAN_NOT_LIVE"], ARC({}));
  add("arc-state: phase done skips the cross-check", { "b.md": plan({ status: "live", arc: "alpha" }) }, [], ARC({ phase: "done" }));
  add("arc-state: closed_at skips the cross-check", { "b.md": plan({ status: "live", arc: "alpha" }) }, [], ARC({ closed_at: "2026-07-30" }));
  add("arc-state: corrupt (non-object) skips the cross-check", { "b.md": plan({ status: "live", arc: "alpha" }) }, [], "garbage");
  add("arc-state: no plan field skips the cross-check", { "b.md": plan({ status: "live", arc: "alpha" }) }, [], ARC({ plan: undefined }));

  let failures = 0;
  const check = (name, ok, detail) => {
    log((ok ? "  ok   " : "  FAIL ") + name + (ok || !detail ? "" : " -- " + detail));
    if (!ok) failures += 1;
  };

  for (const c of cases) {
    const dir = makeDir(c.files);
    const res = run(dir, { arcState: c.arcState === undefined ? null : c.arcState });
    const codes = res.errors.map((e) => e.code).sort();
    const want = [...c.expectCodes].sort();
    check(
      c.name,
      JSON.stringify(codes) === JSON.stringify(want),
      "got [" + codes.join(",") + "] want [" + want.join(",") + "]",
    );
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // Multi-live errors carry ONE filename each in .file (review finding 11).
  {
    const dir = makeDir({
      "a.md": plan({ status: "live", arc: "alpha" }),
      "b.md": plan({ status: "live", arc: "alpha" }),
    });
    const files = run(dir).errors.map((e) => e.file).sort();
    check("multi-live .file fields are single filenames", JSON.stringify(files) === JSON.stringify(["a.md", "b.md"]));
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // Fail-open: an absent dir SKIPs; a non-directory and an .md-named subdir do NOT red wrongly.
  const gone = path.join(os.tmpdir(), "plan-hygiene-does-not-exist-" + process.pid);
  check("an absent plans dir SKIPs (fail-open for CI)", run(gone).skipped === true);
  {
    const dir = makeDir({ "a.md": plan({ status: "live", arc: "alpha" }) });
    const notDir = run(path.join(dir, "a.md"));
    check(
      "a non-directory PLANS_DIR reds rather than skipping",
      notDir.skipped === false && notDir.errors.some((e) => e.code === "E_NOT_A_DIRECTORY"),
    );
    fs.mkdirSync(path.join(dir, "notes.md"));
    const withSubdir = run(dir);
    check(
      "a SUBDIRECTORY named *.md is ignored, not an unreadable plan",
      withSubdir.errors.length === 0 && withSubdir.tracked.length === 1,
    );
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // Index rendering: content, exclusions, labels, encoding, idempotency.
  const idxDir = makeDir({
    "live-a.md": plan({ status: "live", arc: "alpha" }, "Alpha live"),
    "old-a.md": plan({ status: "superseded", arc: "alpha" }, "Alpha old"),
    "done-b.md": plan({ status: "shipped", arc: "beta" }, "Beta shipped"),
    "space plan (v2).md": plan({ status: "scratch", arc: "beta" }, "Spacey"),
    "comment.md": "---\n# internal note\nstatus: shipped\narc: gamma\n---\n\n# Real title\n",
    "legacy.md": "# Legacy\n\nno frontmatter\n",
    "x-agent-a23b34c357e08294a.md": "# transcript\n",
  });
  const first = renderIndex(run(idxDir));
  const second = renderIndex(run(idxDir));
  check("index rendering is idempotent (no timestamps, no churn)", first === second);
  check("index puts live arcs before closed arcs", first.indexOf("### alpha") < first.indexOf("### beta"));
  check("index lists a live arc under Live arcs", /## Live arcs[\s\S]*### alpha/.test(first));
  check("index lists a closed arc under Closed arcs", /## Closed arcs[\s\S]*### beta/.test(first));
  check("index excludes grandfathered files", !first.includes("legacy.md") && !first.includes("x-agent-"));
  check("index footer counts the grandfathered files", first.includes("2 grandfathered plan file(s)"));
  check("index never indexes itself", !first.includes(INDEX_FILENAME));
  check("index link targets are URI-safe", first.includes("(space%20plan%20%28v2%29.md)"));
  check(
    "index labels come from AFTER the frontmatter, never a # comment inside it",
    first.includes("[Real title]") && !first.includes("[internal note]"),
  );
  fs.rmSync(idxDir, { recursive: true, force: true });

  log("");
  log(
    failures === 0
      ? "PASS self-test -- every rule proven in both directions."
      : "FAIL self-test -- " + failures + " case(s).",
  );
  return failures === 0;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const KNOWN_FLAGS = ["--self-test", "--render", "--no-render"];

/** Load the arc-state file for the cross-check; null on any miss (the checkpoint hook owns those). */
function loadArcStateFile(env = process.env) {
  const file = (env.ARC_STATE_FILE && String(env.ARC_STATE_FILE).trim()) || path.join(process.cwd(), ".claude", "arc-state.json");
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch {
    return null;
  }
}

export function main(argv) {
  // Unknown flags are an ERROR (review finding 3): "--norender" silently
  // falling through to some default is how a typo inverts a flag's meaning.
  const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a));
  if (unknown.length) {
    console.error("FAIL plan hygiene -- unknown flag(s): " + unknown.join(" ") + " (known: " + KNOWN_FLAGS.join(" ") + ")");
    return 1;
  }
  if (argv.includes("--self-test")) return selfTest() ? 0 : 1;

  const dir = plansDir();
  const res = run(dir, { arcState: loadArcStateFile() });
  const code = report(dir, res);
  if (code !== 0 || res.skipped) return code;

  const target = path.join(dir, INDEX_FILENAME);
  const body = renderIndex(res);
  let existing = null;
  try {
    existing = fs.readFileSync(target, "utf8");
  } catch {
    existing = null;
  }

  if (!argv.includes("--render")) {
    // Read-only by default: report staleness, never write. pre-ship invokes
    // this mode, so the ship gate cannot mutate a directory outside the repo.
    if (existing === body) console.log("  index up to date: " + target);
    else console.log("  index STALE (or missing) -- refresh with: npm run plans:index");
    return 0;
  }
  if (existing === body) {
    console.log("  index up to date: " + target);
  } else {
    fs.writeFileSync(target, body, "utf8");
    console.log("  index written: " + target);
  }
  return 0;
}

// Realpath-to-realpath (scripts/lib/entry-point.mjs). path.resolve() makes a
// path absolute; it does NOT follow a junction or symlink, so this spelling
// carried the same fail-open as its siblings -- and hid from the grep census
// that found them, because the argv read is wrapped rather than bare.
if (isEntryPoint(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error("FAIL plan hygiene -- unexpected error: " + (e && e.stack ? e.stack : String(e)));
    process.exitCode = 1;
  }
}
