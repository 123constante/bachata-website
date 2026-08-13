/**
 * arc-checkpoint.mjs -- UserPromptSubmit + SessionStart hook. TWIN COPY: this file
 * is content-identical in Website and bachata-admin-11april (line endings follow
 * each repo's own convention -- their safe-write.py copies differ on that point).
 * Edit both or neither; the twin-parity unit test enforces it when the sibling
 * checkout is present. All parse/verdict logic lives in ../lib/arc-state.mjs
 * (shared with scripts/statusline-arc.mjs) -- fix rules THERE, not here. Its
 * entry-point dependency ../lib/entry-point.mjs is vendored into both repos on
 * the same terms and is in both parity lists.
 *
 * Reads <repo>/.claude/arc-state.json and, while an arc phase is open, injects
 * that phase's REQUIRED model + effort into every prompt. The injected text is
 * ADVISORY and SCOPED: it pins who AUTHORS the arc's phase work, names a
 * concrete remedy (switch, or declare the deviation and continue), and states
 * out loud that it does not bind a REVIEW session -- which doctrine requires to
 * run a DIFFERENT profile from the authoring one. It must never read as "halt":
 * a mismatch is a thing to resolve in one line, not a reason to deliver nothing.
 * No model field exists
 * in the UserPromptSubmit payload and Claude cannot switch its own model, so this
 * hook does the one thing that works at prompt time: it puts the requirement in
 * front of the model on every turn, where the doctrine's self-check can act on
 * it. Per-turn cadence is Ricky's explicit call (review finding 9's once-per-
 * session alternative was offered and declined); at session start the boot
 * registration and the first prompt each fire once -- one duplicate block, once
 * per session, accepted. SessionStart additionally compares, because that
 * payload sometimes carries the model. The statusline (scripts/statusline-arc.mjs)
 * is the continuous visual comparator; this is the in-transcript one.
 *
 * The registration passes the event explicitly (--event=SessionStart /
 * --event=UserPromptSubmit). Deriving it from the payload meant an unreadable
 * stdin during a SessionStart invocation emitted hookSpecificOutput for the
 * WRONG event name, which the harness silently drops (review finding 4).
 *
 * EXIT 2 IS FORBIDDEN BY DESIGN. A UserPromptSubmit hook that exits 2 BLOCKS the
 * prompt -- what the user typed is discarded and only stderr survives. An
 * advisory model reminder must never be able to do that, so every path here,
 * including every failure path, avoids exit 2; unexpected failures print nothing.
 *
 * Silent no-op when arc-state.json is missing, closed (phase "done" / non-null
 * closed_at), or inactive (no requirement declared). A CORRUPT file is NOT
 * silent: it gets a one-line note, because on this mount a corrupt .claude JSON
 * must never be indistinguishable from an absent one (review finding 2). A stale
 * set_at -- including a missing or future-dated one -- prints a staleness note
 * INSTEAD of the requirement (review finding 5).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadArcState, arcLabel, staleness, compareModel, isBareFamily, parseModelId, clip } from "../lib/arc-state.mjs";
import { isEntryPoint } from "../lib/entry-point.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ARC_STATE_PATH = path.join(REPO_ROOT, ".claude", "arc-state.json");

function readPayload() {
  // A human running this at a terminal has an interactive stdin that never
  // reaches EOF -- readFileSync(0) would hang until Ctrl+D (verify-workflow
  // finding). The harness always pipes, so a TTY means manual invocation.
  if (process.stdin.isTTY) return {};
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

/** argv is authoritative -- the registration KNOWS which event it is wired to;
 *  the payload field is only a fallback for an unwired invocation. */
function eventName(payload) {
  const arg = process.argv.find((a) => a.startsWith("--event="));
  if (arg) {
    const v = arg.slice("--event=".length);
    if (v === "SessionStart" || v === "UserPromptSubmit") return v;
  }
  return payload.hook_event_name === "SessionStart" ? "SessionStart" : "UserPromptSubmit";
}

/** Session model id, tolerating both the object and the bare-string payload shapes. */
function sessionModelId(payload) {
  const m = payload && payload.model;
  if (typeof m === "string") return m;
  if (m && typeof m.id === "string") return m.id;
  return "";
}

function build(payload) {
  const { status, arc } = loadArcState(ARC_STATE_PATH);
  if (status === "missing" || status === "closed" || status === "inactive") return "";
  if (status === "corrupt") {
    return (
      "ARC CHECKPOINT: .claude/arc-state.json exists but does not parse -- fix or delete it. " +
      "Corrupt is deliberately not treated as absent (this mount's failure mode is silent corruption)."
    );
  }

  const label = arcLabel(arc);
  const stale = staleness(arc);
  if (stale.stale) {
    return (
      "ARC CHECKPOINT [" + label + "]: arc-state.json is stale (" + stale.reason +
      ") -- treat its model requirement as expired and confirm the arc is still live before acting on it."
    );
  }

  const wantModel = typeof arc.required_model === "string" && arc.required_model ? clip(arc.required_model, 40) : "";
  const wantEffort = typeof arc.required_effort === "string" && arc.required_effort ? clip(arc.required_effort, 40) : "";
  const req = [];
  if (wantModel) req.push("/model " + wantModel);
  if (wantEffort) req.push("effort " + wantEffort);

  // This fires on EVERY prompt, so every static sentence here is a per-turn tax
  // (review: the first rewrite grew the block ~4.5x and repeated ~170 tokens of
  // invariant prose per turn). Keep it to: the pin, a self-check line only when
  // the payload cannot carry a model id, the verdict when it can, and one SCOPE
  // line -- which is the fix for review finding 16 (a deliberate cross-model
  // reviewer obeyed "on mismatch, stop before any work" and refused to run
  // /code-review at all; the pin names who AUTHORS, never who reviews).
  let pin = "ARC CHECKPOINT [" + label + "]: phase work pinned to " + req.join(", ") + ".";
  if (wantModel && isBareFamily(arc.required_model)) {
    // Suggest the spelling parseModelId actually reads. Interpolating the raw
    // pin here minted "opus[1m]-<version>" for a bracketed alias -- a spelling
    // the parser reads as family "opus[1m]", so obeying the note produced a
    // permanent false MISMATCH (review finding: the remedy text was the bug).
    const fam = parseModelId(arc.required_model);
    const famFamily = clip(fam.family, 40);
    const famCeiling = fam.ceiling ? clip(fam.ceiling, 40) : "";
    pin += " (Family pin -- any " + famFamily + " version matches; pin one as \"" +
      famFamily + "-<version>" + (famCeiling ? "[" + famCeiling + "]" : "") + "\" in arc-state.json.)";
  }
  const lines = [pin];

  // Compare the RAW id -- clipping first could truncate an id and flip the
  // verdict; clip is for display only.
  const rawSessionModel = sessionModelId(payload);
  const sessionModel = clip(rawSessionModel, 60);
  const verdict = compareModel(rawSessionModel, arc.required_model);
  if (wantModel && !rawSessionModel) {
    // Only when the payload carries no model id (UserPromptSubmit never does):
    // the model must self-check. When an id IS present, the verdict line below
    // already states the outcome and the remedy -- repeating both was the
    // duplication the review flagged. Emitted only for model pins (finding 10:
    // an effort-only arc ordered a model verify with no model named).
    lines.push(
      "Check your model id against the pin; on mismatch, /model " + wantModel +
        " before phase work, or state the deliberate deviation in one line and continue -- do not stop."
    );
  }
  if (verdict === "mismatch") {
    lines.push(
      "!! MODEL MISMATCH: session is " + sessionModel + ", arc requires " + wantModel +
        ". Switch with /model " + wantModel + " before phase work, or declare the deviation (see SCOPE)."
    );
  } else if (verdict === "ceiling") {
    lines.push(
      "!! CONTEXT-WINDOW DEVIATION: session is " + sessionModel + ", arc requires " + wantModel +
        " -- same tier, different context ceiling. Log it in the outcome line."
    );
  }
  lines.push(
    "SCOPE: this binds AUTHORING of the arc's phase work only. Review sessions (doctrine wants a profile " +
      "DIFFERENT from the authoring one), reading, and non-arc work are exempt -- note the deviation once and proceed."
  );
  return lines.join("\n");
}

// Guarded so IMPORTING this module is side-effect-free: without it, an importer
// with a non-TTY stdin that never closes (a vitest worker) would block forever
// inside readPayload's readFileSync(0) at module load. Every sibling script in
// this set is import-safe; this one silently wasn't (review finding).
//
// REALPATH TO REALPATH -- see scripts/lib/entry-point.mjs. The raw
// `import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href` that
// stood here fails open the way every raw compare in this repo did: node resolves
// import.meta.url to the realpath and leaves argv[1] as typed, so any
// junction/symlink spelling made this hook conclude it was imported and exit 0
// having emitted nothing -- a checkpoint that had silently stopped checkpointing.
//
// No byte count is pinned here on purpose. This hook emits nothing at all unless
// .claude/arc-state.json holds an OPEN arc, so a figure measured against one
// afternoon's arc-state cannot be re-derived from the tree -- the committed one is
// closed, and both arms then read 0, which would leave a reader unable to tell the
// fix from the defect. The reproducible instrument is `npm run prove:entry-point`,
// which probes this file canonically, through a junction and on a plain import, and
// reports the predicate's own verdict for each.
if (isEntryPoint(import.meta.url)) {
  try {
    const payload = readPayload();
    const context = build(payload);
    if (context) {
      process.stdout.write(
        JSON.stringify({ hookSpecificOutput: { hookEventName: eventName(payload), additionalContext: context } })
      );
    }
  } catch {
    // Deliberately silent -- see the exit-2 note in the header.
  }
  process.exitCode = 0;
}
