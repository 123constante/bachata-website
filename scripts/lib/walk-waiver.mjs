// walk-waiver.mjs -- slice 10 Part A: the owner-only `walk-waived` record
// (contract 11 item 4). PURE: no network, no clock, no env, no fs writes.
//
// A waiver lets a UI change through without a walk. It is valid ONLY when the
// actor of the `labeled` event is the owner, that actor is not a registered
// automation login, the label stood at the pinned head, and the record was read
// at merge time. A bot-applied label is invalid even while it is still on the PR
// (drill B5): removing it is cleanup, not the control -- this check is. An
// automation login that equals the owner login (A36 style) makes every waiver
// invalid, because the two can no longer be told apart.
//
// The workflow that reads the live event actor is Part E; this module only
// judges a record handed to it.
import { readFileSync } from 'node:fs';
import { isEntryPoint } from './entry-point.mjs';

export const WAIVER_LABEL = 'walk-waived';
const SHA40 = /^[0-9a-f]{40}$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const login = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim().toLowerCase() : null);

/** Shape-checks a record. Returns { ok, waiver, errors[] }; never throws. */
export function parseWaiver(record) {
  if (!isObj(record)) return { ok: false, waiver: null, errors: ['record is not an object'] };
  const errors = [];
  if (record.label !== WAIVER_LABEL) errors.push(`label is not ${WAIVER_LABEL}`);
  if (login(record.appliedBy) === null) errors.push('appliedBy is missing');
  if (login(record.eventActor) === null) errors.push('eventActor (actor of the labeled event) is missing');
  if (typeof record.headSha !== 'string' || !SHA40.test(record.headSha)) errors.push('headSha is not a 40-hex sha');
  if (record.readAtMergeTime !== true) errors.push('readAtMergeTime is not true');
  if (typeof record.reason !== 'string' || record.reason.trim() === '') errors.push('reason is missing');
  if (errors.length) return { ok: false, waiver: null, errors };
  return {
    ok: true,
    errors: [],
    waiver: {
      label: WAIVER_LABEL,
      appliedBy: record.appliedBy.trim(),
      eventActor: record.eventActor.trim(),
      headSha: record.headSha,
      readAtMergeTime: true,
      reason: record.reason.trim(),
    },
  };
}

/** @returns {{ valid: boolean, reasons: string[] }} -- fail-closed on any missing context. */
export function waiverValid(record, ctx) {
  const parsed = parseWaiver(record);
  const reasons = [...parsed.errors];
  if (!isObj(ctx)) return { valid: false, reasons: [...reasons, 'no context to judge the waiver against'] };
  const owner = login(ctx.ownerLogin);
  if (owner === null) reasons.push('ownerLogin is missing');
  if (typeof ctx.pinnedHeadSha !== 'string' || !SHA40.test(ctx.pinnedHeadSha)) reasons.push('pinnedHeadSha is not a 40-hex sha');
  const bots = Array.isArray(ctx.registeredAutomationLogins) ? ctx.registeredAutomationLogins.map(login).filter(Boolean) : null;
  if (bots === null) reasons.push('registeredAutomationLogins is not a list');
  if (owner !== null && bots && bots.includes(owner)) reasons.push('the owner login is also a registered automation login');
  if (parsed.ok) {
    const actor = login(parsed.waiver.eventActor);
    if (bots && bots.includes(actor)) reasons.push(`label applied by automation login ${parsed.waiver.eventActor}`);
    if (owner !== null && actor !== owner) reasons.push(`label applied by ${parsed.waiver.eventActor}, not the owner`);
    if (login(parsed.waiver.appliedBy) !== actor) reasons.push('appliedBy does not match the labeled event actor');
    if (parsed.waiver.headSha !== ctx.pinnedHeadSha) reasons.push('label stood at a different head than the pinned head');
  }
  return { valid: reasons.length === 0, reasons };
}

const USAGE = 'usage: node scripts/lib/walk-waiver.mjs --record <record.json> --context <context.json>';

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
  const ctxPath = arg('--context');
  if (!recordPath || !ctxPath) { error(USAGE); return 2; }
  let result;
  try {
    result = waiverValid(JSON.parse(readFile(recordPath)), JSON.parse(readFile(ctxPath)));
  } catch (err) {
    result = { valid: false, reasons: [`could not read: ${err && err.message ? err.message : String(err)}`] };
  }
  log(JSON.stringify(result, null, 2));
  return result.valid ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
