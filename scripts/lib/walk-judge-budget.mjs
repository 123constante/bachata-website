// walk-judge-budget.mjs -- the walk judge's DAILY budget, as a PURE decision.
//
// JUDGE_CONFIG.budget (scripts/lib/walk-judge.mjs) names the ceilings: per UTC
// day the judge worker gets at most judgeDispatchesPerDay dispatches and
// judgeRuntimeHoursPerDay hours of runtime, and one walk may run at most
// walkWallLimitMinutes. Over budget means HOLD AND ALERT, never "pass anyway".
//
// judgeBudgetDecision(ledger, now, config) answers one question for the Part D
// dispatcher, which must call it before EVERY judge dispatch (nothing here
// wires that): may one more judge be dispatched right now?
//
// FAIL-CLOSED. `allow: true` is reachable only from a well-formed ledger, a
// well-formed `now`, a well-formed config, and totals under every ceiling. A
// malformed ledger or entry, a non-ISO or future-dated timestamp, an entry that
// ends before it starts, a missing `now`, a bad config, or any throw returns
// `allow: false` with a reason. The function never throws.
//
// No clock, no fs, no network, no env: `now` is passed in.
import { JUDGE_CONFIG } from './walk-judge.mjs';

const HOLD = 'hold-and-alert';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const MS_PER_MIN = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MIN;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Epoch ms for a strict ISO-8601 string with an explicit zone, else NaN. */
function parseIso(s) {
  if (typeof s !== 'string' || !ISO.test(s)) return NaN;
  return Date.parse(s);
}

const isCeiling = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;

function hold(reasons, dispatchesToday = null, runtimeHoursToday = null) {
  return { allow: false, action: HOLD, reasons, dispatchesToday, runtimeHoursToday };
}

function decide(ledger, now, config) {
  if (!config || typeof config !== 'object') return hold(['budget config is missing or not an object']);
  const bad = ['judgeDispatchesPerDay', 'judgeRuntimeHoursPerDay', 'walkWallLimitMinutes']
    .filter((k) => !isCeiling(config[k]));
  if (bad.length) return hold(bad.map((k) => `budget config ${k} is not a finite positive number`));

  const nowMs = parseIso(now);
  if (!Number.isFinite(nowMs)) return hold(['now is missing or not an ISO-8601 timestamp with a zone']);
  if (!Array.isArray(ledger)) return hold(['ledger is not an array']);

  const dayStart = Math.floor(nowMs / MS_PER_DAY) * MS_PER_DAY;
  const reasons = [];
  let dispatches = 0;
  let runtimeMs = 0;

  ledger.forEach((e, i) => {
    if (!e || typeof e !== 'object' || Array.isArray(e)) {
      reasons.push(`ledger[${i}] is not an object`);
      return;
    }
    if (typeof e.branch !== 'string' || e.branch.trim() === '') reasons.push(`ledger[${i}] branch is missing`);
    const start = parseIso(e.startedAt);
    if (!Number.isFinite(start)) {
      reasons.push(`ledger[${i}] startedAt is not an ISO-8601 timestamp with a zone`);
      return;
    }
    const open = e.endedAt === null;
    const end = open ? nowMs : parseIso(e.endedAt);
    if (!open && !Number.isFinite(end)) {
      reasons.push(`ledger[${i}] endedAt is neither null nor an ISO-8601 timestamp with a zone`);
      return;
    }
    if (start > nowMs) reasons.push(`ledger[${i}] startedAt is in the future`);
    if (end > nowMs) reasons.push(`ledger[${i}] endedAt is in the future`);
    if (end < start) reasons.push(`ledger[${i}] endedAt is before startedAt`);
    if (start > nowMs || end > nowMs || end < start) return;

    if (open && end - start > config.walkWallLimitMinutes * MS_PER_MIN) {
      reasons.push(`ledger[${i}] (${e.branch}) is still open after ${Math.round((end - start) / MS_PER_MIN)} minutes, over the ${config.walkWallLimitMinutes} minute walk limit`);
    }
    if (start >= dayStart) dispatches += 1;
    // Only the minutes inside today (UTC) count: clamp the start to midnight.
    const from = Math.max(start, dayStart);
    if (end > from) runtimeMs += end - from;
  });

  const runtimeHoursToday = runtimeMs / MS_PER_HOUR;
  if (dispatches >= config.judgeDispatchesPerDay) {
    reasons.push(`${dispatches} judge dispatches today, the daily ceiling is ${config.judgeDispatchesPerDay}`);
  }
  if (runtimeHoursToday >= config.judgeRuntimeHoursPerDay) {
    reasons.push(`${runtimeHoursToday.toFixed(2)} judge runtime hours today, the daily ceiling is ${config.judgeRuntimeHoursPerDay}`);
  }
  if (reasons.length) return hold(reasons, dispatches, runtimeHoursToday);
  return { allow: true, action: 'allow', reasons: [], dispatchesToday: dispatches, runtimeHoursToday };
}

/**
 * May one more judge be dispatched at `now`?
 * Inputs are typed `unknown` on purpose: anything that is not the expected
 * shape holds rather than throws.
 * @param {unknown} ledger expected: Array<{startedAt: string, endedAt: string|null, branch: string}>
 * @param {unknown} now expected: ISO-8601 with a zone; the UTC day of `now` is counted.
 * @param {unknown} [config] defaults to JUDGE_CONFIG.budget
 * @returns {{allow: boolean, action: 'allow'|'hold-and-alert', reasons: string[], dispatchesToday: number|null, runtimeHoursToday: number|null}}
 */
export function judgeBudgetDecision(ledger, now, config = JUDGE_CONFIG.budget) {
  try {
    return decide(ledger, now, config);
  } catch (err) {
    return hold([`budget check threw: ${err && err.message ? err.message : String(err)}`]);
  }
}
