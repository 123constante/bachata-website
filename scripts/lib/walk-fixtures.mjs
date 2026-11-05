// walk-fixtures.mjs -- slice 10 Part A: survey-derived walk fixtures and the
// per-screen shape coverage check. PURE: no network, no clock, no randomness,
// no env, no fs writes. main() reads one JSON file through an injectable reader.
//
// Input is the read-only shape survey, counts only:
//   [{ status, type, count, empty, past, huge }]   ("huge" = over the 100-row API cap)
// Output is one static fixture per distinct shape, with placeholder names
// (`Fixture event 001`) and integer counts -- never a real name, email, phone,
// URL or handle. assertNoPersonalData() is the gate on that.
//
// coverageGaps() lists the shapes a screen's walk does not cover; a non-empty
// list is red (drill B4: an uncovered huge list). uncoveredUiFiles() lists UI
// files with no walk mapped; non-empty is red unless the file is waived by a
// VALID walk-waived record (drill B3; see walk-waiver.mjs).
import { readFileSync } from 'node:fs';
import { isEntryPoint } from './entry-point.mjs';

export const API_ROW_CAP = 100;
const NORMAL_ROWS = 3;
const SLUG = /^[a-z][a-z0-9_-]*$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function checkRow(row, i) {
  if (!isObj(row)) throw new Error(`survey row ${i} is not an object`);
  for (const k of ['status', 'type']) {
    if (typeof row[k] !== 'string' || !SLUG.test(row[k])) throw new Error(`survey row ${i}: ${k} must be a lower-case slug`);
  }
  if (!Number.isInteger(row.count) || row.count < 0) throw new Error(`survey row ${i}: count must be a non-negative integer`);
  for (const k of ['empty', 'past', 'huge']) {
    if (typeof row[k] !== 'boolean') throw new Error(`survey row ${i}: ${k} must be true or false`);
  }
  if (row.empty && row.huge) throw new Error(`survey row ${i}: a shape cannot be both empty and huge`);
}

/** `status.type.empty|nonempty.past|upcoming.huge|normal` */
export function shapeId(row) {
  return [row.status, row.type, row.empty ? 'empty' : 'nonempty', row.past ? 'past' : 'upcoming', row.huge ? 'huge' : 'normal'].join('.');
}

const pad = (n) => String(n).padStart(3, '0');

/** One fixture per distinct shape, sorted by shape id. Throws on a malformed survey. */
export function generateFixtures(surveyCounts) {
  if (!Array.isArray(surveyCounts)) throw new Error('survey must be a list of shape rows');
  if (surveyCounts.length === 0) throw new Error('survey is empty: no shapes means no fixtures, never "nothing to walk"');
  const byShape = new Map();
  surveyCounts.forEach((row, i) => {
    checkRow(row, i);
    const id = shapeId(row);
    const prev = byShape.get(id);
    if (prev) prev.surveyCount += row.count;
    else byShape.set(id, { shape: id, status: row.status, type: row.type, empty: row.empty, past: row.past, huge: row.huge, surveyCount: row.count });
  });
  const fixtures = [...byShape.values()].sort((a, b) => (a.shape < b.shape ? -1 : a.shape > b.shape ? 1 : 0));
  return fixtures.map((f) => {
    const rows = f.empty ? 0 : f.huge ? API_ROW_CAP + 1 : NORMAL_ROWS;
    const items = Array.from({ length: rows }, (_, k) => ({ id: `fixture-${pad(k + 1)}`, name: `Fixture event ${pad(k + 1)}` }));
    const fixture = { ...f, items };
    assertNoPersonalData(fixture);
    return fixture;
  });
}

const PERSONAL = [
  ['email', /[^\s@]+@[^\s@]+\.[^\s@]+/],
  ['url', /\bhttps?:\/\/|\bwww\./i],
  ['handle', /(^|[^\w])@\w+/],
  ['phone', /\+?\d[\d\s().-]{6,}\d/],
];

/** Throws if any string (value OR key) anywhere in `value` looks like personal data. */
export function assertNoPersonalData(value, at = '$') {
  const test = (s, where) => {
    for (const [kind, re] of PERSONAL) if (re.test(s)) throw new Error(`personal data (${kind}) at ${where}`);
  };
  if (typeof value === 'string') test(value, at);
  else if (Array.isArray(value)) value.forEach((v, i) => assertNoPersonalData(v, `${at}[${i}]`));
  else if (isObj(value)) {
    for (const [k, v] of Object.entries(value)) {
      test(k, `${at} key`);
      assertNoPersonalData(v, `${at}.${k}`);
    }
  }
  return true;
}

/** Schema check for docs/design/walk-coverage.json. Returns { ok, errors[] }. */
export function validateCoverage(doc) {
  const errors = [];
  if (!isObj(doc)) return { ok: false, errors: ['coverage is not an object'] };
  if (doc.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!Array.isArray(doc.screens)) return { ok: false, errors: [...errors, 'screens is not a list'] };
  const ids = new Set();
  doc.screens.forEach((s, i) => {
    if (!isObj(s) || typeof s.id !== 'string' || s.id === '') { errors.push(`screen ${i} has no id`); return; }
    if (ids.has(s.id)) errors.push(`screen ${s.id} repeats`);
    ids.add(s.id);
    if (!Array.isArray(s.uiFiles) || !s.uiFiles.every((f) => typeof f === 'string' && f !== '')) errors.push(`screen ${s.id}: uiFiles must be a list of paths`);
    if (!(s.walk === null || (typeof s.walk === 'string' && s.walk !== ''))) errors.push(`screen ${s.id}: walk must be a name or null`);
    if (!Array.isArray(s.shapes) || !s.shapes.every((x) => typeof x === 'string')) errors.push(`screen ${s.id}: shapes must be a list`);
    if (s.example !== undefined && typeof s.example !== 'boolean') errors.push(`screen ${s.id}: example must be true or false`);
  });
  return { ok: errors.length === 0, errors };
}

function mustBeValid(doc) {
  const v = validateCoverage(doc);
  if (!v.ok) throw new Error(`walk-coverage is malformed: ${v.errors.join('; ')}`);
}

/**
 * Shapes each screen's walk does not cover. A screen with no walk misses every
 * shape unless its id is in `waivedScreens` (already checked by waiverValid).
 * Throws on a malformed coverage doc, an empty screens list or an empty shapes
 * list: a broken or empty table must never read as "no gaps".
 */
export function coverageGaps(walkCoverage, shapes, { waivedScreens = [] } = {}) {
  mustBeValid(walkCoverage);
  if (!Array.isArray(shapes)) throw new Error('shapes must be a list');
  if (walkCoverage.screens.length === 0) throw new Error('coverage screens is empty: an empty table must never read as "no gaps"');
  if (shapes.length === 0) throw new Error('shapes is empty: no shapes must never read as "no gaps"');
  const gaps = [];
  for (const s of walkCoverage.screens) {
    if (waivedScreens.includes(s.id)) continue;
    const covered = new Set(s.walk ? s.shapes : []);
    for (const shape of shapes) {
      if (!covered.has(shape)) gaps.push({ screen: s.id, shape, reason: s.walk ? 'uncovered-shape' : 'no-walk' });
    }
  }
  return gaps;
}

/** UI files no screen with a walk maps, minus files waived by a valid record. Sorted. */
export function uncoveredUiFiles(walkCoverage, uiFiles, { waivedFiles = [] } = {}) {
  mustBeValid(walkCoverage);
  if (!Array.isArray(uiFiles)) throw new Error('uiFiles must be a list');
  const walked = new Set(walkCoverage.screens.filter((s) => s.walk).flatMap((s) => s.uiFiles));
  return [...new Set(uiFiles)].filter((f) => !walked.has(f) && !waivedFiles.includes(f)).sort();
}

const USAGE = 'usage: node scripts/lib/walk-fixtures.mjs --survey <survey-counts.json>';

/** CLI: prints the fixtures as JSON. Exit 0 ok, 1 bad survey, 2 usage. */
export function main(argv = [], deps = {}) {
  const readFile = deps.readFile || ((p) => readFileSync(p, 'utf8'));
  const log = deps.log || ((s) => console.log(s));
  const error = deps.error || ((s) => console.error(s));
  const i = argv.indexOf('--survey');
  const file = i >= 0 ? argv[i + 1] : undefined;
  if (typeof file !== 'string' || file.startsWith('--')) { error(USAGE); return 2; }
  try {
    log(JSON.stringify(generateFixtures(JSON.parse(readFile(file))), null, 2));
    return 0;
  } catch (err) {
    error(`walk-fixtures: ${err && err.message ? err.message : String(err)}`);
    return 1;
  }
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
