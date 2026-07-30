/**
 * statusline-arc.mjs -- Claude Code statusLine command. Wired from USER settings
 * (statusLine.command in C:/Users/<user>/.claude/settings.json pointing at this
 * file's absolute path), never from either repo's project settings: the
 * statusline is a per-machine harness concern, but the FILE lives in this repo
 * so it is versioned, reviewed and tested (review finding 7: the original
 * home-dir copy had no git history and no review trail, and finding 10: its
 * parsing logic had already diverged from the hook's). Checking out a branch
 * that predates this file makes the line vanish until back on main -- fail-soft,
 * accepted when Ricky chose the repo home.
 *
 * The continuous live comparator for the arc model/effort doctrine: the
 * prompt-time hook (scripts/hooks/arc-checkpoint.mjs) can only INJECT the
 * requirement, and a fresh session silently resets to the resting default
 * (claude-opus-5 / effort low), so without this line a phase can run half-done
 * on the wrong tier before anyone notices. All parse/verdict rules live in
 * ./lib/arc-state.mjs -- shared with the hook, fix rules THERE.
 *
 * Renders (project_dir's arc-state decides which repo's arc it reflects):
 *   [<model>/<effort>] <arc> <phase> -> wants <m>/<e> OK        (green)
 *   [<model>/<effort>] <arc> <phase> -> wants <m>/<e> SWITCH: /model <m>   (red)
 *   [<model>/<effort>]                                          (no arc-state)
 *   [statusline err]                                            (any failure)
 * plus review-stamp age, context-window use and session cost. An unobservable
 * session model or effort renders NEUTRAL, never red -- a comparator that cries
 * wolf on a malformed frame teaches the operator to ignore the red (findings 1/3).
 *
 * fs reads only -- no git, no network. Runs on every render; stays under ~100 ms.
 * Every failure path prints something harmless and exits 0.
 */

import fs from "node:fs";
import path from "node:path";
import { loadArcState, arcLabel, staleness, compareModel, compareEffort } from "./lib/arc-state.mjs";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const AMBER = "\x1b[33m";
const DIM = "\x1b[2m";
const OFF = "\x1b[0m";

const STAMP_FRESH_MS = 24 * 60 * 60 * 1000;

function readPayload() {
  // Interactive stdin never reaches EOF -- a manual terminal run would hang
  // until Ctrl+D. The harness always pipes, so a TTY means manual invocation.
  if (process.stdin.isTTY) return {};
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function str(v) {
  return typeof v === "string" && v ? v : "";
}

function arcSegment(dir, modelId, effort) {
  const { status, arc } = loadArcState(path.join(dir, ".claude", "arc-state.json"));
  if (status === "missing" || status === "closed" || status === "inactive") return "";
  if (status === "corrupt") return AMBER + "arc-state unreadable (corrupt, not absent)" + OFF;

  const name = arcLabel(arc, 40);
  const stale = staleness(arc);
  if (stale.stale) return AMBER + name + " (arc-state stale: " + stale.reason + ")" + OFF;

  const wantModel = str(arc.required_model);
  const wantEffort = str(arc.required_effort);
  const wants = (wantModel || "any") + "/" + (wantEffort || "any");
  const modelVerdict = compareModel(modelId, wantModel);
  const effortVerdict = compareEffort(effort, wantEffort);

  if (modelVerdict === "mismatch" || effortVerdict === "mismatch") {
    const fix = [];
    if (modelVerdict === "mismatch") fix.push("/model " + wantModel);
    if (effortVerdict === "mismatch") fix.push("effort " + wantEffort);
    return RED + name + " -> wants " + wants + " SWITCH: " + fix.join(" + ") + OFF;
  }
  if (modelVerdict === "ceiling") {
    return AMBER + name + " -> wants " + wants + " (context ceiling differs)" + OFF;
  }
  if (modelVerdict === "unknown") {
    // Session model unobservable: state the requirement neutrally, no verdict.
    return DIM + name + " -> wants " + wants + OFF;
  }
  const suffix = effortVerdict === "unknown" ? DIM + " (effort unverified)" + OFF : "";
  return GREEN + name + " -> wants " + wants + " OK" + OFF + suffix;
}

function stampSegment(dir) {
  const stamp = readJson(path.join(dir, ".claude", ".review-stamp.json"));
  if (!stamp) return DIM + "stamp none" + OFF;
  const age = Date.now() - Date.parse(str(stamp.timestamp));
  if (!Number.isFinite(age)) return AMBER + "stamp ?" + OFF;
  const hours = (age / 3600000).toFixed(1) + "h";
  return age >= 0 && age <= STAMP_FRESH_MS ? DIM + "stamp " + hours + OFF : AMBER + "stamp " + hours + " stale" + OFF;
}

function ctxSegment(payload) {
  const cw = payload.context_window || {};
  const pct = [cw.used_percentage, cw.usedPercentage, payload.context_used_percentage].find(
    (v) => typeof v === "number" && Number.isFinite(v)
  );
  if (pct === undefined) return "";
  const rounded = Math.round(pct);
  const colour = rounded >= 70 ? RED : rounded >= 50 ? AMBER : DIM;
  return colour + "ctx " + rounded + "%" + OFF;
}

function costSegment(payload) {
  const usd = (payload.cost || {}).total_cost_usd;
  if (typeof usd !== "number" || !Number.isFinite(usd)) return "";
  return DIM + "$" + usd.toFixed(2) + OFF;
}

try {
  const payload = readPayload();
  const workspace = payload.workspace || {};
  const dir = str(workspace.project_dir) || str(workspace.current_dir) || process.cwd();
  const model = payload.model || {};
  const modelId = str(model.id) || (typeof payload.model === "string" ? payload.model : "");
  const effort = str((payload.effort || {}).level) || str(payload.effortLevel);

  const segments = [
    "[" + (modelId || "model?") + "/" + (effort || "?") + "]",
    arcSegment(dir, modelId, effort),
    stampSegment(dir),
    ctxSegment(payload),
    costSegment(payload),
  ].filter(Boolean);

  process.stdout.write(segments.join(" " + DIM + "|" + OFF + " "));
} catch {
  process.stdout.write("[statusline err]");
}
process.exitCode = 0;
