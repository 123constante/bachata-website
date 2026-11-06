// Required jobs (slice 2, drill A17; docs/automation-foundations.md). PURE, Node built-ins only.
// The checked-in file .github/automation/required-jobs.json names the check-runs every merge path
// must see green AT THE PINNED HEAD immediately before it merges. This module parses that file
// (fail closed on bad JSON or a bad shape) and judges one head's check-runs against it.
//
//   parseRequiredJobs(text)                          -> { version, pr_head, conditional, post_merge_audits }  (throws)
//   checkRequiredJobs({ required, checkRuns, headSha }) -> { ok, missing, notGreen, reason, reasons }
//
// Rules (verbatim from the brief, PART 1.2): only runs whose head_sha equals headSha count; the
// LATEST run per name (highest id) decides; OK = success | skipped | neutral (the lane's existing
// OK set, not tightened); anything else (absent, in_progress, queued, cancelled, failure,
// timed_out, action_required, stale, ...) refuses with `required job missing: <name>` (absent) or
// `required job not green: <name>=<state>`. An empty or unreadable check-run list refuses.
// A `conditional` job (behind a workflow-level path filter) is checked only when present.

export const OK_CONCLUSIONS = new Set(['success', 'skipped', 'neutral']);
export const REQUIRED_JOBS_PATH = '.github/automation/required-jobs.json';
const KEYS = new Set(['version', 'pr_head', 'conditional', 'post_merge_audits']);

function names(list, where) {
  if (!Array.isArray(list)) throw new Error(`${where} is not a list`);
  for (const n of list) if (typeof n !== 'string' || !n.trim()) throw new Error(`${where} has a non-string or empty name`);
  return list;
}

/** Strict parse; throws on anything that is not exactly the documented shape. `_*` keys are comments. */
export function parseRequiredJobs(text) {
  if (typeof text !== 'string') throw new Error('required-jobs: no text');
  let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error(`required-jobs: not JSON (${e.message})`); }
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('required-jobs: not an object');
  for (const k of Object.keys(j)) if (!KEYS.has(k) && !k.startsWith('_')) throw new Error(`required-jobs: unknown key ${k}`);
  if (j.version !== 1) throw new Error(`required-jobs: version ${JSON.stringify(j.version)} is not 1`);
  const prHead = names(j.pr_head, 'pr_head');
  if (!prHead.length) throw new Error('required-jobs: pr_head is empty');
  if (!Array.isArray(j.conditional)) throw new Error('required-jobs: conditional is not a list');
  for (const c of j.conditional) {
    if (!c || typeof c !== 'object' || typeof c.name !== 'string' || !c.name.trim() || typeof c.when !== 'string' || !c.when.trim()) {
      throw new Error('required-jobs: a conditional entry needs a name and a when');
    }
  }
  const audits = names(j.post_merge_audits, 'post_merge_audits');
  const all = [...prHead, ...j.conditional.map((c) => c.name)];
  const dup = all.find((n, i) => all.indexOf(n) !== i);
  if (dup) throw new Error(`required-jobs: duplicate name ${dup}`);
  return { version: 1, pr_head: [...prHead], conditional: j.conditional.map((c) => ({ name: c.name, when: c.when })), post_merge_audits: [...audits] };
}

const stateOf = (r) => (r.status === 'completed' ? String(r.conclusion ?? 'unknown') : String(r.status ?? 'unknown'));

/** Judge one pinned head. Never throws; anything unreadable is a refusal. */
export function checkRequiredJobs({ required, checkRuns, headSha } = {}) {
  const missing = [];
  const notGreen = [];
  const reasons = [];
  const out = (ok) => ({ ok, missing, notGreen, reason: reasons[0] ?? '', reasons });
  if (!required || !Array.isArray(required.pr_head) || !required.pr_head.length || !Array.isArray(required.conditional)) {
    reasons.push('required-jobs list unreadable (fail closed)');
    return out(false);
  }
  if (typeof headSha !== 'string' || !/^[0-9a-f]{40}$/.test(headSha)) {
    reasons.push('pinned head sha unknown (fail closed)');
    return out(false);
  }
  if (!Array.isArray(checkRuns)) {
    reasons.push('check-runs not read at the pinned head');
    return out(false);
  }
  const latest = new Map();
  for (const r of checkRuns) {
    if (!r || typeof r.name !== 'string' || r.head_sha !== headSha) continue;
    const prev = latest.get(r.name);
    if (!prev || Number(r.id) > Number(prev.id)) latest.set(r.name, r);
  }
  const judge = (name, demanded) => {
    const r = latest.get(name);
    if (!r) {
      if (demanded) { missing.push(name); reasons.push(`required job missing: ${name}`); }
      return;
    }
    if (r.status === 'completed' && OK_CONCLUSIONS.has(r.conclusion)) return;
    const s = stateOf(r);
    notGreen.push(`${name}=${s}`);
    reasons.push(`required job not green: ${name}=${s}`);
  };
  for (const n of required.pr_head) judge(n, true);
  for (const c of required.conditional) judge(c.name, false);
  return out(reasons.length === 0);
}
