// walk-report.mjs -- slice 10 Part B glue: assemble the judge's report from the
// raw records a walk runner produces.
//
// A runner measures each screen x shape x engine and writes one flat record per
// measurement, plus a list of picture files with their sha256. judgeVerdict()
// (walk-judge.mjs) wants them nested as measurements[screen][shape][engine].
// buildJudgeReport() does that nesting and nothing else:
//
//   - it never invents a number: a missing rubric field stays missing, so the
//     judge goes red on it (and it is listed as a problem here too);
//   - it copies only the RUBRIC ids and the viewport -- any other field a runner
//     adds is stripped;
//   - a duplicate (screen, shape, engine) record is a problem and the second one
//     is dropped, never merged into the first;
//   - a record whose engine is not in ENGINES, or that carries a rubric value
//     that is not a finite number, is a problem and is dropped whole, so the
//     judge reports that engine absent;
//   - pictures and doubts are passed through as given.
//
// PURE: no network, no clock, no env, no fs writes; never throws. main() reads
// its JSON files through an injectable readFile.
import { readFileSync } from 'node:fs';
import { isEntryPoint } from './entry-point.mjs';
import { ENGINES, RUBRIC } from './walk-judge.mjs';

const SHA40 = /^[0-9a-f]{40}$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonBlank = (v) => typeof v === 'string' && v.trim() !== '';
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** The one definition of a walk picture's file name; the judge looks pictures up by it. */
export function pictureName(screen, shape, engine) {
  return `${screen}--${shape}--${engine}.png`;
}

function buildReport({ headSha, records, pictures, doubts }) {
  const problems = [];
  if (typeof headSha !== 'string' || !SHA40.test(headSha)) problems.push('headSha is not a 40-hex sha');

  const measurements = {};
  const seen = new Set();
  const kept = [];
  if (!Array.isArray(records)) problems.push('records is not a list');
  else if (records.length === 0) problems.push('records is empty: no measurements means nothing to judge');
  else {
    records.forEach((r, i) => {
      const at = `records[${i}]`;
      if (!isObj(r)) { problems.push(`${at} is not an object`); return; }
      const { screen, shape, engine } = r;
      if (!nonBlank(screen) || !nonBlank(shape)) { problems.push(`${at} has no screen or shape`); return; }
      if (RESERVED_KEYS.has(screen) || RESERVED_KEYS.has(shape)) { problems.push(`${at} uses a reserved name`); return; }
      const where = `${screen} / ${shape} / ${String(engine)}`;
      if (!ENGINES.includes(engine)) { problems.push(`${where}: engine ${String(engine)} is unknown, record dropped`); return; }
      const key = JSON.stringify([screen, shape, engine]);
      if (seen.has(key)) { problems.push(`${where}: duplicate record ${at} dropped (an earlier record had this screen / shape / engine)`); return; }
      seen.add(key);

      const bad = RUBRIC.filter((rule) => rule.id in r && !(typeof r[rule.id] === 'number' && Number.isFinite(r[rule.id])));
      if (bad.length > 0) {
        problems.push(`${where}: ${bad.map((rule) => rule.id).join(', ')} not a finite number, record dropped`);
        return;
      }
      const m = {};
      if (isObj(r.viewport)) m.viewport = { width: r.viewport.width, height: r.viewport.height };
      else problems.push(`${where}: viewport missing`);
      const missing = [];
      for (const rule of RUBRIC) {
        if (rule.id in r) m[rule.id] = r[rule.id];
        else missing.push(rule.id);
      }
      if (missing.length > 0) problems.push(`${where}: ${missing.join(', ')} missing`);

      if (!isObj(measurements[screen])) measurements[screen] = {};
      if (!isObj(measurements[screen][shape])) measurements[screen][shape] = {};
      measurements[screen][shape][engine] = m;
      kept.push([screen, shape, engine]);
    });
  }

  if (!Array.isArray(pictures)) problems.push('pictures is not a list');
  else {
    const names = new Set(pictures.filter(isObj).map((p) => p.name));
    for (const k of kept) {
      const name = pictureName(...k);
      if (!names.has(name)) problems.push(`picture ${name} missing`);
    }
  }
  if (doubts !== undefined && !Array.isArray(doubts)) problems.push('doubts is not a list');

  const report = {
    headSha,
    measurements,
    pictures,
    doubts: doubts === undefined ? [] : doubts,
  };
  return { report, problems };
}

/**
 * records = [{ screen, shape, engine, viewport, ...rubric ids }],
 * pictures = [{ name, sha256 }]. Returns { report, problems[] }; never throws.
 * The report is what judgeVerdict(input, report) reads.
 */
export function buildJudgeReport(args) {
  try {
    return buildReport(isObj(args) ? args : {});
  } catch (err) {
    return {
      report: { headSha: isObj(args) ? args.headSha : undefined, measurements: {}, pictures: [], doubts: [] },
      problems: [`report builder threw: ${err && err.message ? err.message : String(err)}`],
    };
  }
}

const USAGE = 'usage: node scripts/lib/walk-report.mjs --records <records.json> --pictures <pictures.json> --head <sha> [--doubts <doubts.json>]';

function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 && typeof argv[i + 1] === 'string' && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}

/** CLI: prints the report JSON. Exit 0 = no problems, 1 = problems (report still printed) or unreadable file, 2 = usage. */
export function main(argv = [], deps = {}) {
  const readFile = deps.readFile || ((p) => readFileSync(p, 'utf8'));
  const log = deps.log || ((s) => console.log(s));
  const error = deps.error || ((s) => console.error(s));
  const recordsPath = argValue(argv, '--records');
  const picturesPath = argValue(argv, '--pictures');
  const head = argValue(argv, '--head');
  const doubtsPath = argValue(argv, '--doubts');
  if (!recordsPath || !picturesPath || !head || (argv.includes('--doubts') && !doubtsPath)) { error(USAGE); return 2; }
  let parsed;
  try {
    parsed = {
      headSha: head,
      records: JSON.parse(readFile(recordsPath)),
      pictures: JSON.parse(readFile(picturesPath)),
      doubts: doubtsPath ? JSON.parse(readFile(doubtsPath)) : undefined,
    };
  } catch (err) {
    error(`walk-report: could not read input: ${err && err.message ? err.message : String(err)}`);
    return 1;
  }
  const { report, problems } = buildJudgeReport(parsed);
  log(JSON.stringify(report, null, 2));
  for (const p of problems) error(`walk-report: ${p}`);
  return problems.length === 0 ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
