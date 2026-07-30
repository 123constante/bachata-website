/**
 * arc-checkpoint.mjs -- UserPromptSubmit + SessionStart hook. TWIN COPY: this file
 * is content-identical in Website and bachata-admin-11april (line endings follow
 * each repo's own convention -- their safe-write.py copies differ on that point).
 * Edit both or neither; the twin-parity unit test enforces it when the sibling
 * checkout is present. All parse/verdict logic lives in ../lib/arc-state.mjs
 * (shared with scripts/statusline-arc.mjs) -- fix rules THERE, not here.
 *
 * Reads <repo>/.claude/arc-state.json and, while an arc phase is open, injects
 * that phase's REQUIRED model + effort into every prompt. No model field exists
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
import { loadArcState, arcLabel, staleness, compareModel, clip } from "../lib/arc-state.mjs";

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
  const lines = [
    "ARC CHECKPOINT [" + label + "]: required " + req.join(", ") +
      ". Verify your model id from your system prompt; on mismatch, stop and emit the checkpoint statement before any work.",
  ];

  // Compare the RAW id -- clipping first could truncate an id and flip the
  // verdict; clip is for display only.
  const rawSessionModel = sessionModelId(payload);
  const sessionModel = clip(rawSessionModel, 60);
  const verdict = compareModel(rawSessionModel, arc.required_model);
  if (verdict === "mismatch") {
    lines.push(
      "!! MODEL MISMATCH: session is " + sessionModel + ", arc requires " + wantModel +
        ". Switch with /model " + wantModel + " before any work."
    );
  } else if (verdict === "ceiling") {
    lines.push(
      "!! CONTEXT-WINDOW DEVIATION: session is " + sessionModel + ", arc requires " + wantModel +
        " -- same tier, different context ceiling. Log it in the outcome line."
    );
  }
  return lines.join("\n");
}

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
