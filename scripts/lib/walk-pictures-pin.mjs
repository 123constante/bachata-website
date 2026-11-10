// walk-pictures-pin.mjs -- slice 10: walk pictures pinned to the head they were
// taken at (contract 11 item 3). PURE: no network, no clock, no env, no fs writes.
//
// walk-judge.mjs checks that each picture's sha256 is well-formed; it does not
// check that the picture SET belongs to the live head. This module does:
//   pinPictureSet(headSha, pictures)  -> frozen { headSha, pictures, count }
//   pictureSetValid(record, liveHead) -> { valid, reasons[] }; any head other
//                                        than the pinned one is invalid, so a
//                                        push voids the set. Never throws.
//   picturesMatchVerdict(record, input) -> true only when the pictures the judge
//                                        input lists are exactly the pinned set,
//                                        each with an equal sha256.
// The head comparison is the FULL 40 characters; a short sha is never accepted.
// No workflow calls this yet (Part C/E).
import { readFileSync } from 'node:fs';
import { isEntryPoint } from './entry-point.mjs';

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonBlank = (v) => typeof v === 'string' && v.trim() !== '';
const msg = (err) => (err && err.message ? err.message : String(err));

/** Problems with a picture list (pinned shape: { path, sha256 }). Empty = ok. */
function pictureListErrors(pictures) {
  if (!Array.isArray(pictures)) return ['pictures is not a list'];
  if (pictures.length === 0) return ['pictures is empty'];
  const errors = [];
  const seen = new Set();
  pictures.forEach((p, i) => {
    if (!isObj(p) || !nonBlank(p.path)) { errors.push(`pictures[${i}] has no path`); return; }
    if (seen.has(p.path)) errors.push(`picture ${p.path} repeats`);
    seen.add(p.path);
    if (typeof p.sha256 !== 'string' || !SHA256.test(p.sha256)) errors.push(`picture ${p.path} sha256 is malformed`);
  });
  return errors;
}

/**
 * Pins a picture set to the head it was taken at. Throws on a non-40-hex head,
 * an empty list, a duplicate path or a malformed sha256.
 * @returns {Readonly<{headSha:string, pictures:ReadonlyArray<{path:string, sha256:string}>, count:number}>}
 */
export function pinPictureSet(headSha, pictures) {
  if (typeof headSha !== 'string' || !SHA40.test(headSha)) throw new Error('headSha is not a 40-hex sha');
  const errors = pictureListErrors(pictures);
  if (errors.length) throw new Error(`cannot pin pictures: ${errors.join('; ')}`);
  const pinned = pictures.map((p) => Object.freeze({ path: p.path, sha256: p.sha256 }));
  return Object.freeze({ headSha, pictures: Object.freeze(pinned), count: pinned.length });
}

/** Shape problems with a pinned record (which may have come from a JSON file). */
function recordErrors(record) {
  if (!isObj(record)) return ['record is not an object'];
  const errors = [];
  if (typeof record.headSha !== 'string' || !SHA40.test(record.headSha)) errors.push('record headSha is not a 40-hex sha');
  errors.push(...pictureListErrors(record.pictures).map((e) => `record ${e}`));
  if (Array.isArray(record.pictures) && record.count !== record.pictures.length) {
    errors.push(`record count ${String(record.count)} is not the number of pictures ${record.pictures.length}`);
  }
  return errors;
}

/**
 * Is this pinned set valid for the live head? Any head other than the pinned
 * one is invalid (a push voids it). Never throws.
 * @returns {{ valid: boolean, reasons: string[] }}
 */
export function pictureSetValid(record, liveHeadSha) {
  try {
    const reasons = recordErrors(record);
    if (typeof liveHeadSha !== 'string' || !SHA40.test(liveHeadSha)) {
      reasons.push('live head is not a 40-hex sha');
    } else if (isObj(record) && typeof record.headSha === 'string' && record.headSha !== liveHeadSha) {
      reasons.push(`pictures were pinned at head ${record.headSha}, live head is ${liveHeadSha}`);
    }
    return { valid: reasons.length === 0, reasons };
  } catch (err) {
    return { valid: false, reasons: [`pin check threw: ${msg(err)}`] };
  }
}

/**
 * True only when every picture the judge input lists is in the pinned set with
 * an equal sha256 and no pinned picture is missing. `input` is a picture list or
 * an object with `pictures` (walk report shape); an entry names its picture by
 * `path` or `name`. An `input.headSha`, when present, must equal the pinned head.
 * Never throws.
 */
export function picturesMatchVerdict(record, input) {
  try {
    if (recordErrors(record).length) return false;
    if (isObj(input) && input.headSha !== undefined && input.headSha !== record.headSha) return false;
    const listed = Array.isArray(input) ? input : isObj(input) ? input.pictures : null;
    if (!Array.isArray(listed) || listed.length === 0) return false;
    const pinned = new Map(record.pictures.map((p) => [p.path, p.sha256]));
    const seen = new Set();
    for (const p of listed) {
      if (!isObj(p)) return false;
      const key = nonBlank(p.path) ? p.path : p.name;
      if (!nonBlank(key) || seen.has(key)) return false;
      seen.add(key);
      if (!pinned.has(key) || typeof p.sha256 !== 'string' || p.sha256 !== pinned.get(key)) return false;
    }
    return seen.size === pinned.size;
  } catch {
    return false;
  }
}

const USAGE = 'usage: node scripts/lib/walk-pictures-pin.mjs --record <record.json> --head <sha>';

/** CLI. Exit 0 valid, 1 invalid or unreadable, 2 usage. */
export function main(argv = [], deps = {}) {
  const readFile = deps.readFile || ((p) => readFileSync(p, 'utf8'));
  const log = deps.log || ((s) => console.log(s));
  const error = deps.error || ((s) => console.error(s));
  const arg = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 && typeof argv[i + 1] === 'string' && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };
  const recordPath = arg('--record');
  const head = arg('--head');
  if (!recordPath || !head) { error(USAGE); return 2; }
  let result;
  try {
    result = pictureSetValid(JSON.parse(readFile(recordPath)), head);
  } catch (err) {
    result = { valid: false, reasons: [`could not read record: ${msg(err)}`] };
  }
  log(JSON.stringify(result, null, 2));
  return result.valid ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
