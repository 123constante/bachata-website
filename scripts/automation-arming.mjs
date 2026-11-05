#!/usr/bin/env node
// scripts/automation-arming.mjs -- the workflows' ARMING reader (slice 2, drill A30;
// docs/automation-foundations.md). Read before editing: this file is a GUARD path.
//
// Run by autopilot.yml (job `arming`), bot-automerge.yml and dependabot-automerge.yml as a FIRST
// step, from a MAIN checkout without credentials: it reads .github/automation/arming.json (the file
// on main decides) and writes every value to $GITHUB_OUTPUT. The old repo variables arrive ONLY as
// env ARMING_VAR_<NAME> drift input: a variable that disagrees with the file is a drift line
// (::notice:: + step summary) and changes nothing.
//
//   node scripts/automation-arming.mjs [--gate key1,key2] [--post-notices]
//
// --gate: also writes enabled=true only when every named key is true in the file; otherwise
//         enabled=false and a visible ::notice:: (the job stays green, every later step is skipped).
// --post-notices: posts ONE notice per distinct drift on the pinned AUTOMATION PAUSE SWITCH issue
//         through slice 1's postPauseNotice (key arming-drift:<VAR>:<value>; GH_TOKEN with
//         issues: write, GITHUB_REPOSITORY). A notice that cannot be posted is a ::warning::.
// Exit: 0 values written (on or off, drift or not: a drift is not a red run);
//       2 usage error (unknown flag or gate key), enabled=false still written.
// FAIL CLOSED: an unreadable file reads off/false. Prints values and variable NAMES; never a token.
import { appendFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';
import { effectiveArming, varsFromEnv, gateOpen, ARMING_PATH, ARMING_KEYS, ARMING_VARS } from './lib/arming.mjs';
import { postPauseNotice } from './lib/automation-pause.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const {
    readFile = (p) => readFileSync(p, 'utf8'),
    writeOutput = (line) => (env.GITHUB_OUTPUT ? appendFileSync(env.GITHUB_OUTPUT, `${line}\n`) : console.log(line)),
    writeSummary = (s) => { if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${s}\n`); },
    out = (s) => console.log(s),
    postNotice = postPauseNotice,
    fetch: fetchImpl = globalThis.fetch,
  } = deps;
  let gate = null;
  let post = false;
  let usage = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--post-notices') post = true;
    else if (argv[i] === '--gate') {
      gate = String(argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const bad = gate.filter((k) => ARMING_KEYS[k] !== 'bool');
      if (!gate.length || bad.length) usage = `--gate wants boolean arming keys (${Object.keys(ARMING_KEYS).filter((k) => ARMING_KEYS[k] === 'bool').join(', ')}); got ${bad.join(', ') || 'nothing'}`;
    } else usage = `unknown argument ${JSON.stringify(argv[i])}`;
  }
  if (usage) {
    writeOutput('enabled=false');
    out(`::error::automation-arming: ${usage}`);
    return 2;
  }
  let text = null;
  try { text = readFile(join(ROOT, ARMING_PATH)); } catch (e) { text = null; out(`arming.json not read from the checkout (${e && e.message}): every key reads off/false`); }
  const vars = varsFromEnv(env);
  const { values, drift, notices } = effectiveArming({ file: text, vars });
  for (const [k, v] of Object.entries(values)) writeOutput(`${k}=${v}`);
  const lines = [`### Arming (${ARMING_PATH} on main decides; variables are drift input only)`, '', ...Object.entries(values).map(([k, v]) => `- ${k}: ${v}`)];
  if (gate) {
    const on = gateOpen(values, gate);
    writeOutput(`enabled=${on}`);
    const state = gate.map((k) => `${k}=${values[k]}`).join(', ');
    if (on) out(`arming: ON (arming.json: ${state})`);
    else out(`::notice::arming: OFF (arming.json on main: ${state}); every later step is skipped and the run stays green`);
    lines.push('', `Gate ${gate.join(' + ')}: ${on ? 'ON' : 'OFF (every later step skipped)'}`);
  }
  for (const d of drift) out(`::notice::${d}`);
  lines.push('', `Drift inputs set: ${Object.keys(ARMING_VARS).filter((n) => n in vars).join(', ') || 'none'}`);
  if (drift.length) lines.push('', '#### Drift (the file decided; nothing changed)', ...drift.map((d) => `- ${d}`));
  writeSummary(lines.join('\n'));
  if (post) {
    for (const n of notices) {
      const r = await postNotice({ repo: env.GITHUB_REPOSITORY, token: env.GH_TOKEN, fetch: fetchImpl, key: n.key, text: n.text });
      if (r && r.error) out(`::warning::arming drift notice ${n.key} not posted (${r.error}); the drift line above stands`);
      else out(`arming drift notice ${n.key}: ${r && r.skipped ? 'already posted' : 'posted'}`);
    }
  }
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  main().then((c) => { process.exitCode = c; }, (e) => { console.log(`::error::automation-arming: ${e && e.message}`); process.exitCode = 1; });
}
