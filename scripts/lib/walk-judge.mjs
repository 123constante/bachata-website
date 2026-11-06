// walk-judge.mjs -- slice 10 Part A: the walk judge's verdict, as a PURE function.
//
// The judge is a separate worker (a different model, a fresh session) that reads
// a walk report -- measured numbers per screen x shape x engine plus a picture
// list -- and says pass / red / doubt. This module is the part of that judgement
// that must not depend on a model's mood: it is FAIL-CLOSED. `pass` is reachable
// only when every rubric check has a cited, finite, measured number on every
// screen x shape x engine and every number meets its threshold. Anything else --
// a missing number, NaN, an out-of-range number, a viewport other than 390x844,
// a bad doubts entry, a missing picture, an unknown shape, an absent engine, a
// model or session collision, a stale head, malformed input, or a throw -- is
// red (or doubt, which isPass() treats as not pass).
//
// The written spec is docs/automation/judge-worker.md; tests/walkJudge.test.ts
// compares its constant and rubric tables with JUDGE_CONFIG and RUBRIC both ways.
//
// No network, no clock, no env, no fs writes. main() reads the two JSON files it
// is pointed at through an injectable readFile.
import { readFileSync } from 'node:fs';
import { isEntryPoint } from './entry-point.mjs';

export const ENGINES = Object.freeze(['chromium', 'webkit']);

/** The only viewport a walk may be measured at (contract: 390x844 phone). */
export const VIEWPORT = Object.freeze({ width: 390, height: 844 });

/** Finite ceiling for any px measurement; a bigger number is a broken walk, not a pass. */
export const MAX_PX = 10000;

const deepFreeze = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
};

export const JUDGE_CONFIG = deepFreeze({
  dispatcher: {
    dispatchedBy: 'dispatcher',
    liveWorkersPerBranch: 1,
    neverDispatchedBy: ['builder', 'human'],
    pauseModule: 'scripts/lib/automation-pause.mjs',
    blockedWhilePaused: true,
  },
  model: {
    defaultJudgeModel: 'sonnet',
    requireDifferentModelId: true,
    requireFreshSession: true,
    builderSummaryAllowed: false,
  },
  budget: {
    walkWallLimitMinutes: 15,
    judgeRuntimeHoursPerDay: 3,
    judgeDispatchesPerDay: 8,
    overBudgetAction: 'hold-and-alert',
    dailyTotalEnforcedIn: 'scripts/lib/walk-judge-budget.mjs',
  },
});

/**
 * The fixed, ordered rubric. A walk report keys each measured number by the
 * rubric `id` (a report keyed by `metric` reads as missing, so red: fail-closed).
 * `metric` documents WHAT that number is; `op` is how it must compare with
 * `threshold` to pass. Counts of offenders use `<= 0`. `min`/`max` are the
 * sanity range: a number outside it is red whatever the threshold says
 * (`max: null` = no ceiling beyond finite).
 */
export const RUBRIC = deepFreeze([
  { id: 'tapTargets', metric: 'minTapTargetPx', op: '>=', threshold: 44, unit: 'px', min: 0, max: MAX_PX },
  { id: 'noSidewaysScroll', metric: 'horizontalOverflowPx', op: '<=', threshold: 0, unit: 'px', min: 0, max: MAX_PX },
  { id: 'noClipping', metric: 'clippedElementCount', op: '<=', threshold: 0, unit: 'count', min: 0, max: null },
  { id: 'contrast', metric: 'minContrastRatio', op: '>=', threshold: 4.5, unit: 'ratio', min: 1, max: 21 },
  { id: 'emptyLoadingErrorHaveAction', metric: 'statesWithoutActionCount', op: '<=', threshold: 0, unit: 'count', min: 0, max: null },
  { id: 'iosInputFontSize', metric: 'minInputFontPx', op: '>=', threshold: 16, unit: 'px', min: 0, max: MAX_PX },
  { id: 'iosNoRawVh', metric: 'raw100vhWithoutDvhCount', op: '<=', threshold: 0, unit: 'count', min: 0, max: null },
  { id: 'iosFixedBarsSafeArea', metric: 'fixedBarsWithoutSafeAreaCount', op: '<=', threshold: 0, unit: 'count', min: 0, max: null },
]);

export const INVALIDATED_BY = 'any push';

export const verdictSchema = deepFreeze({
  type: 'object',
  required: ['verdict', 'headSha', 'reasons', 'cited', 'engines', 'invalidatedBy'],
  properties: {
    verdict: { enum: ['pass', 'red', 'doubt'] },
    headSha: { type: 'string', pattern: '^[0-9a-f]{40}$' },
    reasons: { type: 'array', items: { type: 'string' } },
    cited: {
      type: 'array',
      items: { type: 'object', required: ['check', 'measured', 'threshold', 'screen', 'shape', 'engine'] },
    },
    engines: { type: 'array', items: { enum: [...ENGINES] } },
    invalidatedBy: { const: INVALIDATED_BY },
  },
});

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonBlank = (v) => typeof v === 'string' && v.trim() !== '';

/** Leaves of JUDGE_CONFIG as `{ 'JUDGE_CONFIG.a.b': 'value' }` (arrays comma-joined). */
export function flattenConstants() {
  const out = {};
  const walk = (o, prefix) => {
    for (const [k, v] of Object.entries(o)) {
      const key = `${prefix}.${k}`;
      if (isObj(v)) walk(v, key);
      else out[key] = Array.isArray(v) ? v.join(', ') : String(v);
    }
  };
  walk(JUDGE_CONFIG, 'JUDGE_CONFIG');
  return out;
}

/** Shape-checks the lane's request. Returns { ok, errors[] }; never throws. */
export function validateJudgeInput(input) {
  const errors = [];
  if (!isObj(input)) return { ok: false, errors: ['input is not an object'] };
  if (typeof input.headSha !== 'string' || !SHA40.test(input.headSha)) errors.push('headSha is not a 40-hex sha');
  const engines = input.engines;
  if (!Array.isArray(engines)) errors.push('engines is not a list');
  else {
    for (const e of ENGINES) if (!engines.includes(e)) errors.push(`engine ${e} is absent`);
    for (const e of engines) if (!ENGINES.includes(e)) errors.push(`engine ${String(e)} is unknown`);
    if (new Set(engines).size !== engines.length) errors.push('engines repeat');
  }
  if (!Array.isArray(input.screens) || input.screens.length === 0) errors.push('screens is empty or not a list');
  else {
    const ids = new Set();
    for (const s of input.screens) {
      if (!isObj(s) || !nonBlank(s.id)) { errors.push('a screen has no id'); continue; }
      if (ids.has(s.id)) errors.push(`screen ${s.id} repeats`);
      ids.add(s.id);
      if (!Array.isArray(s.shapes) || s.shapes.length === 0 || !s.shapes.every(nonBlank)) {
        errors.push(`screen ${s.id} has no shapes`);
      }
    }
  }
  const ids = ['builderModelId', 'judgeModelId', 'builderSessionId', 'judgeSessionId'];
  for (const k of ids) if (!nonBlank(input[k])) errors.push(`${k} is missing`);
  if (nonBlank(input.builderModelId) && nonBlank(input.judgeModelId)
    && input.builderModelId.trim().toLowerCase() === input.judgeModelId.trim().toLowerCase()) {
    errors.push('judge model id equals builder model id');
  }
  if (nonBlank(input.builderSessionId) && nonBlank(input.judgeSessionId)
    && input.builderSessionId.trim() === input.judgeSessionId.trim()) {
    errors.push('judge session id equals builder session id (not a fresh session)');
  }
  return { ok: errors.length === 0, errors };
}

const inRange = (rule, n) => n >= rule.min && (rule.max === null || n <= rule.max);
const meets = (rule, n) => (rule.op === '>=' ? n >= rule.threshold : n <= rule.threshold);

function verdictOf(headSha, reasons, cited, doubts) {
  let verdict = 'pass';
  if (reasons.length > 0 || cited.length === 0) verdict = 'red';
  else if (doubts.length > 0) verdict = 'doubt';
  if (verdict === 'red' && reasons.length === 0) reasons.push('no measured numbers were cited');
  return {
    verdict,
    headSha: typeof headSha === 'string' ? headSha : '',
    reasons: verdict === 'doubt' ? doubts.map((d) => `judge doubt: ${d}`) : reasons,
    cited,
    engines: [...ENGINES],
    invalidatedBy: INVALIDATED_BY,
  };
}

function judge(input, report) {
  const reasons = [];
  const v = validateJudgeInput(input);
  if (!v.ok) return verdictOf(isObj(input) ? input.headSha : '', v.errors.map((e) => `input: ${e}`), [], []);
  if (!isObj(report)) return verdictOf(input.headSha, ['report is not an object'], [], []);
  if (report.headSha !== input.headSha) {
    reasons.push(`report head ${String(report.headSha)} is not the judged head ${input.headSha}`);
  }
  const measurements = report.measurements;
  if (!isObj(measurements)) return verdictOf(input.headSha, [...reasons, 'report.measurements is not an object'], [], []);

  const pictures = new Map();
  if (!Array.isArray(report.pictures)) reasons.push('report.pictures is not a list');
  else for (const p of report.pictures) if (isObj(p) && nonBlank(p.name)) pictures.set(p.name, p.sha256);

  // Every entry must be a non-blank string; nothing is silently dropped.
  const doubts = [];
  if (report.doubts !== undefined && !Array.isArray(report.doubts)) reasons.push('report.doubts is not a list');
  else if (Array.isArray(report.doubts)) {
    report.doubts.forEach((d, i) => {
      if (nonBlank(d)) doubts.push(d);
      else reasons.push(`report.doubts[${i}] is not a non-blank string`);
    });
  }

  const cited = [];
  const wanted = new Map(input.screens.map((s) => [s.id, new Set(s.shapes)]));
  for (const [screenId, byShape] of Object.entries(measurements)) {
    if (!wanted.has(screenId)) { reasons.push(`unknown screen ${screenId}`); continue; }
    if (!isObj(byShape)) { reasons.push(`screen ${screenId}: measurements are not an object`); continue; }
    for (const shape of Object.keys(byShape)) {
      if (!wanted.get(screenId).has(shape)) reasons.push(`screen ${screenId}: unknown shape ${shape}`);
    }
  }
  for (const s of input.screens) {
    for (const shape of s.shapes) {
      const byEngine = isObj(measurements[s.id]) ? measurements[s.id][shape] : undefined;
      if (!isObj(byEngine)) { reasons.push(`${s.id} / ${shape}: not measured`); continue; }
      for (const engine of ENGINES) {
        const where = `${s.id} / ${shape} / ${engine}`;
        const pic = pictures.get(`${s.id}--${shape}--${engine}.png`);
        if (pic === undefined) reasons.push(`${where}: picture missing`);
        else if (typeof pic !== 'string' || !SHA256.test(pic)) reasons.push(`${where}: picture sha256 malformed`);
        const m = byEngine[engine];
        if (!isObj(m)) { reasons.push(`${where}: engine absent`); continue; }
        const vp = m.viewport;
        if (!isObj(vp) || vp.width !== VIEWPORT.width || vp.height !== VIEWPORT.height) {
          const seen = isObj(vp) ? `${String(vp.width)}x${String(vp.height)}` : 'missing';
          reasons.push(`${where}: viewport ${seen}, needs ${VIEWPORT.width}x${VIEWPORT.height}`);
        }
        for (const rule of RUBRIC) {
          const n = m[rule.id];
          if (typeof n !== 'number' || !Number.isFinite(n)) {
            reasons.push(`${where}: ${rule.id} has no measured number`);
            continue;
          }
          if (!inRange(rule, n)) {
            reasons.push(`${where}: ${rule.id} measured ${n} is out of range ${rule.min}..${rule.max === null ? 'finite' : rule.max}`);
            continue;
          }
          cited.push({ check: rule.id, measured: n, threshold: rule.threshold, op: rule.op, screen: s.id, shape, engine });
          if (!meets(rule, n)) reasons.push(`${where}: ${rule.id} measured ${n}, needs ${rule.op} ${rule.threshold}`);
        }
      }
    }
  }
  return verdictOf(input.headSha, reasons, cited, doubts);
}

/**
 * The verdict. Never throws; a throw anywhere inside is itself a red verdict.
 * @returns {{verdict:'pass'|'red'|'doubt', headSha:string, reasons:string[],
 *   cited:{check:string, measured:number, threshold:number}[], engines:string[], invalidatedBy:'any push'}}
 */
export function judgeVerdict(input, report) {
  try {
    return judge(input, report);
  } catch (err) {
    return verdictOf('', [`judge threw: ${err && err.message ? err.message : String(err)}`], [], []);
  }
}

/**
 * The only reading of a verdict that may unblock anything: an explicit,
 * well-formed pass with numbers, FOR THE HEAD THE CALLER IS ABOUT TO UNBLOCK.
 * `expectedHeadSha` is mandatory; missing, malformed or different is not a pass.
 */
export function isPass(v, expectedHeadSha) {
  return typeof expectedHeadSha === 'string' && SHA40.test(expectedHeadSha)
    && isObj(v)
    && v.verdict === 'pass'
    && v.headSha === expectedHeadSha
    && Array.isArray(v.reasons) && v.reasons.length === 0
    && Array.isArray(v.cited) && v.cited.length > 0
    && v.cited.every((c) => isObj(c) && typeof c.measured === 'number' && Number.isFinite(c.measured))
    && Array.isArray(v.engines) && ENGINES.every((e) => v.engines.includes(e))
    && v.invalidatedBy === INVALIDATED_BY;
}

const USAGE = 'usage: node scripts/lib/walk-judge.mjs --input <input.json> --report <report.json>';

function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 && typeof argv[i + 1] === 'string' && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}

/** CLI. Exit 0 = pass, 1 = red/doubt (including unreadable files), 2 = usage. */
export function main(argv = [], deps = {}) {
  const readFile = deps.readFile || ((p) => readFileSync(p, 'utf8'));
  const log = deps.log || ((s) => console.log(s));
  const error = deps.error || ((s) => console.error(s));
  const inputPath = argValue(argv, '--input');
  const reportPath = argValue(argv, '--report');
  if (!inputPath || !reportPath) { error(USAGE); return 2; }
  let verdict;
  let expectedHead = null;
  try {
    const input = JSON.parse(readFile(inputPath));
    expectedHead = isObj(input) ? input.headSha : null;
    verdict = judgeVerdict(input, JSON.parse(readFile(reportPath)));
  } catch (err) {
    verdict = verdictOf('', [`could not read input: ${err && err.message ? err.message : String(err)}`], [], []);
  }
  log(JSON.stringify(verdict, null, 2));
  return isPass(verdict, expectedHead) ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
