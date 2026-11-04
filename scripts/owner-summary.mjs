#!/usr/bin/env node
// Owner-summary CLI -- DISARMED. Modes: send | digest | approvals | heartbeat.
// Default is --dry-run (prints, exit 0, no I/O). Live needs --live AND OWNER_SUMMARY_ARMED=1,
// and reads the pause switch first. No workflow, no schedule is wired to this file.
import { isEntryPoint } from './lib/entry-point.mjs';
import { assertNotPaused, PausedError, pauseRequest, PAUSE_API } from './lib/automation-pause.mjs';
import { makeKey, formatMessage, buildDigest, buildApprovalList } from './lib/owner-summary.mjs';
import { createStore } from './lib/owner-summary-store.mjs';
import { postPlainComment } from './lib/owner-summary-issue.mjs';
import { sendNtfy } from './lib/ntfy-send.mjs';

/**
 * begin -> send -> commit. Failure (case w): comment stays, marker stays `pending` for the
 * heartbeat, and the result says `pause: true`; the pause call is INJECTED, not wired here.
 */
export async function deliver({ store, key, message, send, setPause }) {
  const b = await store.begin(key, { text: message });
  if (b.decision !== 'GO') return { status: 'skip', pause: false };
  let r;
  try { r = await send(message); } catch { r = { status: 'failed', reason: 'send threw' }; }
  if (r && r.status === 'sent') {
    await store.commit(key, { proof: r.id });
    return { status: 'sent', pause: false };
  }
  if (typeof setPause === 'function') { try { await setPause(`owner message not delivered for ${key}`); } catch { /* the pending marker still stands */ } }
  return { status: r && r.status === 'refused' ? 'refused' : 'failed', pause: true, reason: r && r.reason ? r.reason : null, httpStatus: r && r.httpStatus ? r.httpStatus : null };
}

function parseArgs(argv) {
  const o = { mode: argv[0], live: false };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') o.live = true;
    else if (a === '--dry-run') o.live = false;
    else if (a.startsWith('--')) o[a.slice(2)] = argv[++i];
  }
  return o;
}

function githubClient({ repo, issue, token, fetch: fetchImpl }) {
  const base = `${PAUSE_API}/repos/${repo}/issues`;
  return {
    async list() {
      const { data } = await pauseRequest(fetchImpl, `${base}/${issue}/comments?per_page=100`, token);
      return data.map((c) => ({ id: c.id, body: c.body }));
    },
    async create(body) { return (await pauseRequest(fetchImpl, `${base}/${issue}/comments`, token, { method: 'POST', body: { body } })).data; },
    async edit(id, body) { await pauseRequest(fetchImpl, `${base}/comments/${id}`, token, { method: 'PATCH', body: { body } }); },
  };
}

/** -> exit code (0 ok / paused / dry-run, 1 bad usage, 2 cannot run). */
export async function main(argv, deps = {}) {
  const env = deps.env ?? process.env;
  const out = deps.out ?? ((s) => console.log(s));
  const o = parseArgs(argv);
  if (!['send', 'digest', 'approvals', 'heartbeat'].includes(o.mode)) { out('usage: owner-summary.mjs send|digest|approvals|heartbeat [--live]'); return 1; }
  let key = null, msg = null;
  if (o.mode === 'send') {
    try { key = makeKey({ arc: o.arc, head: o.head, kind: o.kind }); } catch (e) { out(`refused: ${e.message}`); return 1; }
    const f = formatMessage({ kind: o.kind, arc: o.arc, pr: o.pr, link: o.link, what: o.what, next: o.next, undone: o.undone });
    if (!f.ok) { out(`refused: ${f.error}`); return 1; }
    msg = f.text;
  }
  const armed = o.live && env.OWNER_SUMMARY_ARMED === '1';
  if (!armed) {
    out(`dry-run${o.live ? ' (OWNER_SUMMARY_ARMED not set)' : ''}: ${o.mode}${key ? ` ${key}` : ''}`);
    if (msg) out(msg);
    return 0;
  }
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const repo = env.GITHUB_REPOSITORY, token = env.GH_TOKEN;
  try { await assertNotPaused({ repo, token, fetch: fetchImpl }); } catch (e) {
    if (e instanceof PausedError) { out('paused: nothing sent'); return 0; }
    throw e;
  }
  const client = deps.client ?? githubClient({ repo, issue: env.OWNER_SUMMARY_ISSUE, token, fetch: fetchImpl });
  const store = createStore({ client });
  if (o.mode === 'digest') { await postPlainComment(client, buildDigest({ stops: deps.stops ?? [], markers: await store.unsent(), now: new Date() })); return 0; }
  if (o.mode === 'approvals') { await postPlainComment(client, buildApprovalList({ prs: deps.prs ?? [] })); return 0; }
  if (o.mode === 'heartbeat') {
    const stale = await store.heartbeat({});
    out(`undelivered: ${stale.length}`);
    return 0;
  }
  const send = (text) => sendNtfy({ url: env.NTFY_URL, topic: env.NTFY_TOPIC, title: `Bachata arc ${o.arc}`, body: text, fetch: fetchImpl, env });
  const r = await deliver({ store, key, message: msg, send, setPause: deps.setPause });
  out(`${r.status}${r.pause ? ' (set the pause)' : ''}`);
  return r.status === 'sent' || r.status === 'skip' ? 0 : 2;
}

if (isEntryPoint(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error(`owner-summary: ${e && e.message ? e.message : e}`); process.exitCode = 2; });
}
