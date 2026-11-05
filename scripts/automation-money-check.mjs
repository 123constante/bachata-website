#!/usr/bin/env node
// scripts/automation-money-check.mjs -- the Dependabot lane's money-set check (slice 2, drill A16;
// docs/automation-foundations.md). A small CLI over scripts/lib/is-money.mjs isMoney(), run by
// .github/workflows/dependabot-automerge.yml after `Decide` and before `Enable auto-merge`, from a
// MAIN checkout (the money set is read from main, never the PR).
//
// It reads the PR's files WITH patches through the REST files API (GH_TOKEN = github.token), checks
// the count against the PR's changed_files, and writes to $GITHUB_OUTPUT:
//   money=true|false
//   money_reason=<`money set: <name>` | `money set: unreadable (<why>)` | empty>
// FAIL CLOSED: a read failure, a count mismatch, an unreadable set or patch is money=true. Only
// money=false (positively read, no hit) lets the workflow enable auto-merge.
//
// Exit: 0 a verdict was written (money true OR false: a hit is not a red run, it is a NO);
//       2 configuration missing (GH_TOKEN / REPO / PR_NUMBER), money=true still written.
// Env: GH_TOKEN, REPO (owner/name), PR_NUMBER, GITHUB_OUTPUT. Prints logins/paths only, never a token.
import { appendFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';
import { isMoney, parseMoneySet, MONEY_SET_PATH } from './lib/is-money.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.github.com';
const MAX_PAGES = 30;

async function readPrFiles(env, fetchImpl) {
  const get = async (p) => {
    const res = await fetchImpl(`${API}${p}`, { headers: { authorization: `Bearer ${env.GH_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'bachata-money-check' } });
    if (!res.ok) throw new Error(`GET ${p.replace(/\?.*/, '')} -> HTTP ${res.status}`);
    return res.json();
  };
  const pr = await get(`/repos/${env.REPO}/pulls/${env.PR_NUMBER}`);
  const files = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await get(`/repos/${env.REPO}/pulls/${env.PR_NUMBER}/files?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('files API returned no list');
    files.push(...batch);
    if (batch.length < 100) break;
  }
  if (!Number.isInteger(pr.changed_files) || pr.changed_files !== files.length) throw new Error(`file list incomplete (${files.length} read, PR says ${pr.changed_files})`);
  return files;
}

export async function main(env = process.env, deps = {}) {
  const {
    fetch: fetchImpl = globalThis.fetch,
    readFile = (p) => readFileSync(p, 'utf8'),
    out = console.log,
    err = console.error,
    writeOutput = (line) => (env.GITHUB_OUTPUT ? appendFileSync(env.GITHUB_OUTPUT, `${line}\n`) : console.log(line)),
  } = deps;
  const emit = (v) => {
    const reason = String(v.reason || '').replace(/[\r\n]+/g, ' ');
    writeOutput(`money=${v.money === false ? 'false' : 'true'}`);
    writeOutput(`money_reason=${reason}`);
    (v.money === false ? out : err)(v.money === false ? 'money set: no hit (auto-merge may be enabled)' : `${reason} (auto-merge NOT enabled)`);
  };
  if (!env.GH_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(String(env.REPO || '')) || !/^\d+$/.test(String(env.PR_NUMBER || ''))) {
    emit({ money: true, reason: 'money set: unreadable (GH_TOKEN, REPO and a numeric PR_NUMBER are required)' });
    return 2;
  }
  let set = null;
  try { set = parseMoneySet(readFile(join(ROOT, MONEY_SET_PATH))); } catch (e) { err(`money set unreadable: ${e.message}`); } // null = isMoney fails closed
  let files;
  try {
    files = await readPrFiles(env, fetchImpl);
  } catch (e) {
    emit({ money: true, reason: `money set: unreadable (${e.message})` });
    return 0;
  }
  const v = isMoney({ files, set });
  emit(v);
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.env);
}
