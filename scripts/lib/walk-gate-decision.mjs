// walk-gate-decision.mjs -- slice 10: ONE answer to "may this UI PR merge without
// a phone walk?", combining the walk judge's verdict and the owner's waiver.
// PURE: no network, no clock, no env, no fs writes; main() reads one JSON file
// through an injectable readFile.
//
// The rules live in walk-judge.mjs (isPass) and walk-waiver.mjs (waiverValid);
// this module only calls them and never retypes them. The single thing it adds
// is the head: BOTH are judged against the PR's LIVE head the caller passes in.
// A judge pass for another head, or a waiver pinned to another head, is blocked
// even when the owner applied the label -- the waiver's pinnedHeadSha is always
// overwritten with liveHeadSha, whatever the caller's context says.
//
// Fail-closed: allowed only when isPass(...) or waiverValid(...).valid is true.
// Every blocked answer cites at least one WALK_GATE_REASONS id; the reason ids
// are diagnostics and never decide anything. decideWalkGate never throws.
import { readFileSync } from 'node:fs';
import { isEntryPoint } from './entry-point.mjs';
import { isPass } from './walk-judge.mjs';
import { waiverValid } from './walk-waiver.mjs';

export const WALK_GATE_REASONS = Object.freeze({
  INPUT_MALFORMED: 'input-malformed',
  LIVE_HEAD_INVALID: 'live-head-invalid',
  NO_VERDICT: 'no-verdict',
  VERDICT_MALFORMED: 'verdict-malformed',
  VERDICT_WRONG_HEAD: 'verdict-wrong-head',
  VERDICT_RED: 'verdict-red',
  VERDICT_DOUBT: 'verdict-doubt',
  VERDICT_NOT_PASS: 'verdict-not-pass',
  NO_WAIVER: 'no-waiver',
  WAIVER_CONTEXT_MISSING: 'waiver-context-missing',
  WAIVER_WRONG_HEAD: 'waiver-wrong-head',
  WAIVER_INVALID: 'waiver-invalid',
  DECIDER_THREW: 'decider-threw',
});

const R = WALK_GATE_REASONS;
// Diagnostics only (reason ids); the decision itself is isPass / waiverValid.
const SHA40 = /^[0-9a-f]{40}$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const validSha = (v) => typeof v === 'string' && SHA40.test(v);
const why = (id, detail) => ({ id, detail });

function verdictReasons(verdict, liveHeadSha) {
  if (verdict === undefined || verdict === null) return [why(R.NO_VERDICT, 'no judge verdict')];
  if (!isObj(verdict) || !['pass', 'red', 'doubt'].includes(verdict.verdict)) {
    return [why(R.VERDICT_MALFORMED, 'verdict is not a judge verdict object')];
  }
  const out = [];
  // Head diagnostics only when the live head is itself usable; otherwise
  // LIVE_HEAD_INVALID is the cause and blaming the verdict would mislead.
  if (!validSha(liveHeadSha)) { /* reported by the caller */ }
  else if (!validSha(verdict.headSha)) {
    out.push(why(R.VERDICT_MALFORMED, 'verdict headSha is not a 40-hex sha'));
  } else if (verdict.headSha !== liveHeadSha) {
    out.push(why(R.VERDICT_WRONG_HEAD, `verdict is for ${verdict.headSha}, live head is ${String(liveHeadSha)}`));
  }
  if (verdict.verdict === 'red') out.push(why(R.VERDICT_RED, 'judge said red'));
  if (verdict.verdict === 'doubt') out.push(why(R.VERDICT_DOUBT, 'judge said doubt'));
  if (out.length === 0) out.push(why(R.VERDICT_NOT_PASS, 'verdict does not satisfy isPass'));
  return out;
}

function decide({ liveHeadSha, verdict, waiverRecord, waiverContext }) {
  // The two calls that decide. Nothing else can set allowed.
  if (isPass(verdict, liveHeadSha)) return { allowed: true, via: 'judge', reasons: [] };
  const ctx = { ...(isObj(waiverContext) ? waiverContext : {}), pinnedHeadSha: liveHeadSha };
  const waiver = waiverRecord === undefined || waiverRecord === null ? null : waiverValid(waiverRecord, ctx);
  if (waiver && waiver.valid === true) return { allowed: true, via: 'waiver', reasons: [] };

  const reasons = [];
  if (!validSha(liveHeadSha)) {
    reasons.push(why(R.LIVE_HEAD_INVALID, 'liveHeadSha is not a 40-hex sha'));
  }
  reasons.push(...verdictReasons(verdict, liveHeadSha));
  if (waiver === null) reasons.push(why(R.NO_WAIVER, 'no walk-waived record'));
  else {
    if (!isObj(waiverContext)) reasons.push(why(R.WAIVER_CONTEXT_MISSING, 'no waiver context'));
    if (isObj(waiverRecord) && validSha(liveHeadSha) && validSha(waiverRecord.headSha) && waiverRecord.headSha !== liveHeadSha) {
      reasons.push(why(R.WAIVER_WRONG_HEAD, `waiver stood at ${String(waiverRecord.headSha)}, live head is ${String(liveHeadSha)}`));
    }
    const detail = Array.isArray(waiver.reasons) && waiver.reasons.length ? waiver.reasons.join('; ') : 'waiver not valid';
    reasons.push(why(R.WAIVER_INVALID, detail));
  }
  return { allowed: false, via: null, reasons };
}

/**
 * @returns {{ allowed: boolean, via: 'judge'|'waiver'|null, reasons: {id:string, detail:string}[] }}
 */
export function decideWalkGate(input) {
  try {
    if (!isObj(input)) {
      return { allowed: false, via: null, reasons: [why(R.INPUT_MALFORMED, 'input is not an object')] };
    }
    return decide(input);
  } catch (err) {
    return { allowed: false, via: null, reasons: [why(R.DECIDER_THREW, err && err.message ? err.message : String(err))] };
  }
}

const USAGE = 'usage: node scripts/lib/walk-gate-decision.mjs --input <file.json>';

/** CLI. Exit 0 allowed, 1 blocked or unreadable, 2 usage. */
export function main(argv = [], deps = {}) {
  const readFile = deps.readFile || ((p) => readFileSync(p, 'utf8'));
  const log = deps.log || ((s) => console.log(s));
  const error = deps.error || ((s) => console.error(s));
  const i = argv.indexOf('--input');
  const inputPath = i >= 0 && typeof argv[i + 1] === 'string' && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  if (!inputPath) { error(USAGE); return 2; }
  let result;
  try {
    result = decideWalkGate(JSON.parse(readFile(inputPath)));
  } catch (err) {
    result = { allowed: false, via: null, reasons: [why(R.INPUT_MALFORMED, `could not read input: ${err && err.message ? err.message : String(err)}`)] };
  }
  log(JSON.stringify(result, null, 2));
  return result.allowed === true ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
