#!/usr/bin/env node
/**
 * check-identity-register.mjs -- which login each automation credential acts as
 * (contract 6.1a identity register N2, criterion 6.2(10), drill A36; foundations slice 2).
 *
 * Rule: NO automation credential may authenticate as the owner's own GitHub login. For every
 * entry of `.github/automation/secrets-register.json` with `identity_check: "user"` that exists,
 * the credential is read from the env var of the SAME NAME (the workflow passes it by `env:`
 * only) and `GET https://api.github.com/user` is called with it. RED (exit 1) when:
 *   - the resolved login differs from a recorded `acts_as`;
 *   - the resolved login (or any recorded `acts_as`) equals `owner_login`;
 *   - two roles the register's `separate_roles` keeps apart (author / merge / approver)
 *     resolve to one login.
 * An `acts_as` still `null` is not compared: a loud `to record` line names the login to record.
 * Missing credential env, an HTTP error, a body without `login` = exit 2 (could not measure).
 * Prints LOGINS ONLY: never a token, never a header.
 *
 * isOwnerAction(login, register) is the pure helper every owner-login control (`resume`,
 * `walk-waived`, `owner-approval`, `hold`) imports: true only for the owner login, and never
 * when the register shows an automation credential acting as the owner (fail closed).
 *
 *   BOT_PR_TOKEN=... AUTOMERGE_TOKEN=... node scripts/check-identity-register.mjs
 *   node scripts/check-identity-register.mjs --self-test
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';
import { parseRegister } from './check-secrets-register.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTER_PATH = path.join(REPO_ROOT, '.github', 'automation', 'secrets-register.json');
const USER_URL = 'https://api.github.com/user';
const lc = (s) => String(s).toLowerCase();

/** Every login the register records for an AUTOMATION credential (acts_as values). */
function automationLogins(register) {
  return register.entries.map((e) => e.acts_as).filter((l) => typeof l === 'string' && l !== '').map(lc);
}

/**
 * True only when `login` is the register's owner login and no automation credential is recorded
 * as acting as it. Any doubt (no register, malformed entries, non-string login) = false.
 */
export function isOwnerAction(login, register) {
  if (typeof login !== 'string' || login === '') return false;
  if (!register || typeof register !== 'object' || !Array.isArray(register.entries)) return false;
  const owner = typeof register.owner_login === 'string' ? lc(register.owner_login) : '';
  if (!owner || lc(login) !== owner) return false;
  return !automationLogins(register).includes(owner);
}

/** Pure judgement. resolved = { NAME: login }. -> { violations: [string], notes: [string] } */
export function judgeIdentities({ register, resolved }) {
  const violations = [];
  const notes = [];
  const owner = lc(register.owner_login);
  const loginOf = new Map();
  for (const e of register.entries) {
    const got = resolved[e.name];
    if (typeof e.acts_as === 'string' && lc(e.acts_as) === owner) violations.push(`${e.name} is recorded as acting as the owner login ${register.owner_login}`);
    if (typeof got === 'string') {
      if (lc(got) === owner) violations.push(`${e.name} resolves to the owner login ${register.owner_login}`);
      if (e.acts_as === null) notes.push(`${e.name} -> ${got} (acts_as is null: to record, state "${e.acts_as_state || '?'}")`);
      else if (lc(e.acts_as) !== lc(got)) violations.push(`${e.name} resolves to ${got} but the register records acts_as ${e.acts_as}`);
    }
    const effective = typeof got === 'string' ? got : (typeof e.acts_as === 'string' ? e.acts_as : null);
    if (e.role && effective) loginOf.set(e.role, { name: e.name, login: effective });
  }
  for (const pair of register.separate_roles || []) {
    const [a, b] = pair;
    const x = loginOf.get(a);
    const y = loginOf.get(b);
    if (x && y && lc(x.login) === lc(y.login)) violations.push(`roles ${a} (${x.name}) and ${b} (${y.name}) resolve to one login ${x.login}`);
  }
  return { violations, notes };
}

async function getLogin(fetchImpl, token, timeoutMs = 10000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(USER_URL, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'bachata-identity-check' },
      signal: ac.signal,
    });
  } catch (e) {
    throw new Error(ac.signal.aborted ? `timeout after ${timeoutMs} ms` : `network error (${e && e.name ? e.name : 'unknown'})`);
  } finally {
    clearTimeout(timer);
  }
  if (!res || !res.ok) throw new Error(`HTTP ${res ? res.status : '?'} on GET /user`);
  let body;
  try {
    body = JSON.parse(await res.text());
  } catch (e) {
    throw new Error('GET /user body is not JSON');
  }
  if (!body || typeof body.login !== 'string' || body.login === '') throw new Error('GET /user returned no login');
  return body.login;
}

export async function main(argv = [], env = process.env, log = console, deps = {}) {
  if (argv.includes('--self-test')) return (await selfTest(log)) ? 0 : 1;
  let text = deps.registerText;
  if (text === undefined) {
    try {
      text = readFileSync(REGISTER_PATH, 'utf8');
    } catch (e) {
      log.error('identity-register: CANNOT RUN -- cannot read the register: ' + e.code);
      return 2;
    }
  }
  const parsed = parseRegister(text);
  if (!parsed.ok) {
    log.error('identity-register: CANNOT RUN -- ' + parsed.reason);
    return 2;
  }
  const register = parsed.register;
  const fetchImpl = deps.fetch || globalThis.fetch;
  const targets = register.entries.filter((e) => e.identity_check === 'user' && e.exists);
  if (targets.length === 0) {
    log.error('identity-register: CANNOT RUN -- no register entry has identity_check "user"; nothing would be measured');
    return 2;
  }
  const resolved = {};
  const gaps = [];
  for (const e of targets) {
    const token = env[e.name];
    if (!token) {
      gaps.push(`${e.name}: credential not in env (secret missing or not passed)`);
      continue;
    }
    try {
      resolved[e.name] = await getLogin(fetchImpl, token);
      log.log(`identity-register: ${e.name} -> ${resolved[e.name]}`);
    } catch (err) {
      gaps.push(`${e.name}: ${err.message}`);
    }
  }
  const { violations, notes } = judgeIdentities({ register, resolved });
  for (const n of notes) log.log('identity-register: TO RECORD -- ' + n);
  if (violations.length) {
    log.error(`identity-register: FAIL -- ${violations.length} violation(s):`);
    for (const v of violations) log.error('  ' + v);
    return 1;
  }
  if (gaps.length) {
    log.error('identity-register: CANNOT RUN -- could not resolve every credential:');
    for (const g of gaps) log.error('  ' + g);
    return 2;
  }
  log.log(`identity-register: OK -- ${targets.length} credential(s) resolved; none is the owner login; roles separate.`);
  return 0;
}

async function selfTest(log) {
  const quiet = { log() {}, error() {} };
  const reg = (over = {}, overA = {}) => JSON.stringify({
    version: 1,
    owner_login: 'own',
    separate_roles: [['author', 'merge']],
    entries: [
      { name: 'A', kind: 'pat', role: 'author', acts_as: null, acts_as_state: 'to record', owner_login: 'own', identity_check: 'user', required_minimum_scope: [], actual_scope: 'NOT VERIFIED', expiry: null, readers_allowed: [], exists: true, ...overA },
      { name: 'B', kind: 'pat', role: 'merge', acts_as: null, acts_as_state: 'to record', owner_login: 'own', identity_check: 'user', required_minimum_scope: [], actual_scope: 'NOT VERIFIED', expiry: null, readers_allowed: [], exists: true, ...over },
    ],
  });
  const fake = (map) => async (_u, init) => {
    const v = map[String(init.headers.authorization).slice(7)];
    return typeof v === 'number' ? new Response('{}', { status: v }) : new Response(JSON.stringify({ login: v }), { status: 200 });
  };
  const ENV = { A: 'ta', B: 'tb' };
  // Exit-code owner (main) driven end to end, each branch pinned (R5).
  const cases = [
    ['distinct bot logins (0)', await main([], ENV, quiet, { registerText: reg(), fetch: fake({ ta: 'bot-a', tb: 'bot-b' }) }), 0],
    ['owner login (1)', await main([], ENV, quiet, { registerText: reg(), fetch: fake({ ta: 'OWN', tb: 'bot-b' }) }), 1],
    ['shared role (1)', await main([], ENV, quiet, { registerText: reg(), fetch: fake({ ta: 'bot', tb: 'bot' }) }), 1],
    ['acts_as mismatch (1)', await main([], ENV, quiet, { registerText: reg({ acts_as: 'bot-b' }), fetch: fake({ ta: 'bot-a', tb: 'bot-c' }) }), 1],
    ['missing env (2)', await main([], { A: 'ta' }, quiet, { registerText: reg(), fetch: fake({ ta: 'bot-a' }) }), 2],
    ['HTTP 401 (2)', await main([], ENV, quiet, { registerText: reg(), fetch: fake({ ta: 401, tb: 'bot-b' }) }), 2],
    ['bad register (2)', await main([], ENV, quiet, { registerText: '[', fetch: fake({}) }), 2],
    ['nothing to measure (2)', await main([], ENV, quiet, { registerText: reg({ identity_check: null }, { identity_check: null }), fetch: fake({ ta: 'bot-a', tb: 'bot-b' }) }), 2],
  ];
  const r = JSON.parse(reg());
  cases.push(['isOwnerAction owner', isOwnerAction('Own', r), true]);
  cases.push(['isOwnerAction bot', isOwnerAction('bot-a', r), false]);
  r.entries[0].acts_as = 'own';
  cases.push(['isOwnerAction fails closed when an automation acts as owner', isOwnerAction('own', r), false]);
  let failed = 0;
  for (const [name, got, want] of cases) {
    if (got !== want) {
      failed++;
      log.error('FAIL ' + name + ': expected ' + want + ', got ' + got);
    }
  }
  if (failed) {
    log.error('FAIL self-test -- ' + failed + ' of ' + cases.length + ' case(s).');
    return false;
  }
  log.log('PASS self-test -- ' + cases.length + ' cases, every exit code proven.');
  return true;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
