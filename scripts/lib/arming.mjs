// scripts/lib/arming.mjs -- the ARMING reader (slice 2, drill A30; docs/automation-foundations.md).
// PURE, Node built-ins only. Read before editing: this file is a GUARD path (owner Approve at head).
//
// Arming is OUT of the reach of any token that can write repo variables: the state lives in the
// checked-in file .github/automation/arming.json on main (a guard path: changing it is a
// human-merged guard change). Every reader reads THE FILE. The old repo variables
// (AUTOPILOT_LIVE, AUTOPILOT_MERGE_MODE, AUTOMERGE_ENABLED, BOT_AUTOMERGE_ENABLED) are DRIFT input
// only: a variable set to a value the file does not have produces
//   arming drift: <VAR>=<value> but arming.json says <value>
// and changes nothing. A variable equal to the file, unset or empty, is silent.
//
// FAIL CLOSED: anything missing, unreadable or unknown in the file reads as the SAFE value
// (off / false) and adds a drift line; readArming() never throws.
import { MERGE_MODES } from './autopilot.mjs';

export const ARMING_PATH = '.github/automation/arming.json';
/** key -> kind. `mode` = one of MERGE_MODES or 'off'. */
export const ARMING_KEYS = Object.freeze({
  autopilot_live: 'bool',
  autopilot_merge_mode: 'mode',
  automerge_enabled: 'bool',
  bot_automerge_enabled: 'bool',
  approver: 'bool',
  audit_escalation: 'bool',
});
export const SAFE_ARMING = Object.freeze({
  autopilot_live: false,
  autopilot_merge_mode: 'off',
  automerge_enabled: false,
  bot_automerge_enabled: false,
  approver: false,
  audit_escalation: false,
});
/** The OLD repo variables (drift input only) -> the file key each one used to decide. */
export const ARMING_VARS = Object.freeze({
  AUTOPILOT_LIVE: 'autopilot_live',
  AUTOPILOT_MERGE_MODE: 'autopilot_merge_mode',
  AUTOMERGE_ENABLED: 'automerge_enabled',
  BOT_AUTOMERGE_ENABLED: 'bot_automerge_enabled',
});
/** Workflows pass each old variable as env ARMING_VAR_<NAME> (and nowhere else). */
export const VAR_ENV_PREFIX = 'ARMING_VAR_';

const PREFIX = 'arming drift: arming.json';
const show = (v) => String(v).replace(/[^\x20-\x7e]+/g, ' ').replace(/[<>`]/g, '_').slice(0, 64);
const keyPart = (v) => String(v).replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 40) || '_';

/** -> { values, problems: [drift line] }. Strict: only exact booleans and exact mode strings count. */
export function readArming(text) {
  const values = { ...SAFE_ARMING };
  const problems = [];
  let doc;
  try {
    if (typeof text !== 'string') throw new Error('no file text');
    doc = JSON.parse(text);
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('not a JSON object');
  } catch (e) {
    problems.push(`${PREFIX} unreadable (${show(e && e.message)}): every key reads off/false`);
    return { values, problems };
  }
  if (doc.version !== 1) {
    problems.push(`${PREFIX} version ${show(JSON.stringify(doc.version ?? null))} is not 1: every key reads off/false`);
    return { values, problems };
  }
  for (const [k, kind] of Object.entries(ARMING_KEYS)) {
    if (!(k in doc)) { problems.push(`${PREFIX} ${k} missing: reads ${SAFE_ARMING[k]}`); continue; }
    const v = doc[k];
    if (kind === 'bool') {
      if (typeof v === 'boolean') values[k] = v;
      else problems.push(`${PREFIX} ${k} is not a boolean (${show(JSON.stringify(v))}): reads ${SAFE_ARMING[k]}`);
    } else if (v === 'off' || MERGE_MODES.includes(v)) values[k] = v;
    else problems.push(`${PREFIX} ${k} ${show(JSON.stringify(v))} is not off|${MERGE_MODES.join('|')}: reads off`);
  }
  for (const k of Object.keys(doc)) if (k !== 'version' && !(k in ARMING_KEYS)) problems.push(`${PREFIX} unknown key ${show(k)} (ignored)`);
  return { values, problems };
}

/** The old variables as the workflow passed them (env ARMING_VAR_<NAME>); unset/empty are left out. */
export function varsFromEnv(env = {}) {
  const out = {};
  for (const name of Object.keys(ARMING_VARS)) {
    const v = env[`${VAR_ENV_PREFIX}${name}`];
    if (typeof v === 'string' && v !== '') out[name] = v;
  }
  return out;
}

/**
 * The file is authoritative. -> { values, drift: [line], notices: [{ key, text }] }.
 * `file` = the file's text (null/undefined = unreadable). `vars` = { AUTOPILOT_LIVE: 'true', ... }.
 * One notice per variable drift, keyed `arming-drift:<VAR>:<value>` (slice 1's postPauseNotice
 * de-duplicates by key, so a standing drift posts ONCE, ever).
 */
export function effectiveArming({ file, vars = {} } = {}) {
  const { values, problems } = readArming(file);
  const drift = [...problems];
  const notices = [];
  for (const [name, key] of Object.entries(ARMING_VARS)) {
    const raw = vars && vars[name];
    if (typeof raw !== 'string' || raw === '') continue;
    const fileSays = String(values[key]);
    if (raw === fileSays) continue;
    const line = `arming drift: ${name}=${show(raw)} but arming.json says ${fileSays}`;
    drift.push(line);
    notices.push({ key: `arming-drift:${name}:${keyPart(raw)}`, text: `${line}. The file on main is authoritative: the variable changed NOTHING. The owner deletes or corrects the variable (docs/automation-foundations.md).` });
  }
  return { values, drift, notices };
}

/** True only when every named key is exactly `true` in the effective values. */
export function gateOpen(values, keys) {
  return Array.isArray(keys) && keys.length > 0 && keys.every((k) => ARMING_KEYS[k] === 'bool' && values && values[k] === true);
}
