#!/usr/bin/env node
/**
 * CLI over scripts/lib/automation-pause.mjs (the pause switch reader). Env only: GH_TOKEN,
 * GITHUB_REPOSITORY (never PR text), GITHUB_REPOSITORY_OWNER (--guard), GITHUB_OUTPUT.
 *
 *   node scripts/automation-pause.mjs           check: exit 0 = running, 3 = PAUSED (incl. every
 *                                               fail-closed case). Never 0 on an error.
 *   node scripts/automation-pause.mjs --info    same output, ALWAYS exit 0 (the brake: it logs
 *                                               the switch, it is never stopped by it).
 *   node scripts/automation-pause.mjs --guard   drill A15b: if a non-owner removed the label,
 *                                               re-add it and post ONE notice. Exit 0 = done or
 *                                               nothing to do, 1 = could not read / re-assert.
 * Prints `paused=true|false` and `reason=<text>` to stdout and $GITHUB_OUTPUT.
 * This file NEVER removes the label (tests/automationPauseGuard.test.ts tripwire).
 */
import { appendFileSync } from 'node:fs';
import { readPause, findPause, readPauseIssueEvents, decideReassert, postPauseNotice, pauseRequest, PAUSE_API, PAUSE_LABEL } from './lib/automation-pause.mjs';
import { isEntryPoint } from './lib/entry-point.mjs';

const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ').slice(0, 300);

function emit(r, env, out) {
  const lines = [`paused=${r.paused ? 'true' : 'false'}`, `reason=${oneLine(r.reason)}`];
  for (const l of lines) out(l);
  if (r.paused) out(`::notice::paused: ${oneLine(r.reason)}`);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}

async function guard(env, fetchImpl, out) {
  const repo = env.GITHUB_REPOSITORY;
  const token = env.GH_TOKEN;
  const ownerLogin = env.GITHUB_REPOSITORY_OWNER;
  try {
    const st = await findPause({ repo, token, fetch: fetchImpl });
    const events = await readPauseIssueEvents({ repo, token, fetch: fetchImpl, issue: st.number });
    const d = decideReassert({ labelPresent: st.labelPresent, events, ownerLogin });
    if (d.error) { out(`::error::pause guard could not decide: ${oneLine(d.error)}`); return 1; }
    if (!d.reassert) { out(`pause guard: nothing to do (label ${st.labelPresent ? 'present' : 'absent'}; last event ${d.eventId ?? 'none'} by ${d.actor ?? 'nobody'})`); return 0; }
    await pauseRequest(fetchImpl, `${PAUSE_API}/repos/${repo}/issues/${st.number}/labels`, token, { method: 'POST', body: { labels: [PAUSE_LABEL] } });
    out(`::warning::pause label removed by ${oneLine(d.actor)} (event ${d.eventId}); RE-ASSERTED`);
    const n = await postPauseNotice({
      repo, token, fetch: fetchImpl, key: `reassert:${d.eventId}`,
      text: `Pause switch: the \`${PAUSE_LABEL}\` label was removed by \`${oneLine(d.actor)}\` (event ${d.eventId}), who is not the owner. It has been re-added; automation stays PAUSED. Only the owner clears the switch (docs/automation-pause.md).`,
    });
    if (n.error) { out(`::error::label re-asserted but the notice failed: ${oneLine(n.error)}`); return 1; }
    return 0;
  } catch (e) {
    out(`::error::pause guard failed: ${oneLine(e && e.message ? e.message : e)}`);
    return 1;
  }
}

export async function main(argv = process.argv.slice(2), env = process.env, { fetch: fetchImpl = globalThis.fetch, out = (s) => console.log(s) } = {}) {
  const mode = argv.length === 0 ? 'check' : argv.length === 1 && ['--info', '--guard'].includes(argv[0]) ? argv[0].slice(2) : 'bad';
  if (mode === 'guard') return guard(env, fetchImpl, out);
  const r = mode === 'bad' ? { paused: true, reason: 'unknown arguments (fail closed)', issue: null } : await readPause({ repo: env.GITHUB_REPOSITORY, token: env.GH_TOKEN, fetch: fetchImpl });
  try { emit(r, env, out); } catch (e) { out(`::error::could not write output: ${oneLine(e.message)}`); if (mode !== 'info') return 3; }
  if (mode === 'info') return 0;
  return r.paused ? 3 : 0;
}

if (isEntryPoint(import.meta.url)) {
  main().then((code) => process.exit(code), (e) => {
    console.log(`::error::automation-pause: ${e && e.message}`);
    process.exit(process.argv.includes('--info') ? 0 : process.argv.includes('--guard') ? 1 : 3);
  });
}
