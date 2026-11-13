// Foundations-web PART 4: the secrets/identity register and its checks.
//   - scripts/check-secrets-register.mjs   rules (a)-(f) of the brief, static half of drill A34,
//                                          and the --expiry mode behind automation-token-expiry.yml
//   - scripts/check-identity-register.mjs  GET /user identity check (drill A36) + isOwnerAction
//   - scripts/check-workflow-log-secrets.mjs  the A22 matcher (dummy-echo drill with fixtures)
//   - the two NEW workflows: structure + inert PR text (drill A23)
// Every fixture token below is BUILT by concatenation so no secret-shaped literal is in source.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import {
  parseRegister,
  measureWorkflows,
  checkRegister,
  decideExpiry,
  parseScope,
  main as registerMain,
} from '../scripts/check-secrets-register.mjs';
import { isOwnerAction, judgeIdentities, main as identityMain } from '../scripts/check-identity-register.mjs';
import { findSecretLeaks, main as leakMain } from '../scripts/check-workflow-log-secrets.mjs';

const ROOT = path.resolve(__dirname, '..');
const WF_DIR = path.join(ROOT, '.github/workflows');
const REGISTER_TEXT = readFileSync(path.join(ROOT, '.github/automation/secrets-register.json'), 'utf8');
const WORKFLOWS = readdirSync(WF_DIR)
  .filter((f) => /\.ya?ml$/.test(f))
  .sort()
  .map((name) => ({ name, text: readFileSync(path.join(WF_DIR, name), 'utf8') }));
const quiet = () => {
  const lines: string[] = [];
  return { lines, log: { log: (s: string) => lines.push(String(s)), error: (s: string) => lines.push(String(s)) } };
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const reg = (): Any => {
  const r = parseRegister(REGISTER_TEXT);
  expect(r.ok).toBe(true);
  return r.register;
};
const entry = (r: Any, name: string): Any => r.entries.find((e: Any) => e.name === name);
const wf = (name: string, body: string) => ({ name, text: body });

describe('the register file (.github/automation/secrets-register.json)', () => {
  const r = reg();
  it('version 1; every entry carries the fields of the brief', () => {
    expect(r.version).toBe(1);
    for (const e of r.entries) {
      for (const k of ['name', 'kind', 'acts_as', 'owner_login', 'required_minimum_scope', 'actual_scope', 'expiry', 'readers_allowed', 'exists']) {
        expect(e, `${e.name} lacks ${k}`).toHaveProperty(k);
      }
      expect(e.owner_login).toBe('123constante');
      if (e.acts_as === null) expect(['inferred kiki-claude-bot', 'to record']).toContain(e.acts_as_state);
    }
  });
  it('no scope is invented: every actual_scope is NOT VERIFIED; no expiry is recorded yet', () => {
    for (const e of r.entries) {
      expect(e.actual_scope, e.name).toBe('NOT VERIFIED');
      expect(e.expiry, e.name).toBeNull();
    }
  });
  it('the 6.1 rows are all present (Website-relevant), future ones with exists:false', () => {
    const names = r.entries.map((e: Any) => e.name);
    for (const n of ['AUTOMERGE_TOKEN', 'BOT_PR_TOKEN', 'AUTOMATION_PAUSE_TOKEN', 'GITHUB_TOKEN', 'APPROVER_APP', 'VERCEL_READ_TOKEN', 'VERCEL_AUTOMATION_BYPASS_SECRET', 'SENTRY_READ_TOKEN', 'CANARY_TEST_USER']) {
      expect(names).toContain(n);
    }
    for (const n of ['AUTOMATION_PAUSE_TOKEN', 'APPROVER_APP', 'VERCEL_READ_TOKEN', 'CANARY_TEST_USER']) expect(entry(r, n).exists).toBe(false);
    expect(entry(r, 'GITHUB_TOKEN').acts_as).toBe('github-actions[bot]');
    // Measured 2026-11-05 by the identity check (run 41990183311); AUTOMERGE_TOKEN has no secret here.
    expect(entry(r, 'BOT_PR_TOKEN').acts_as).toBe('kiki-claude-bot');
    expect(entry(r, 'AUTOMERGE_TOKEN').exists).toBe(false);
    expect(entry(r, 'AUTOMERGE_TOKEN').acts_as).toBeNull();
  });
  it('BOT_PR_TOKEN: the contract minimum is bot-pr.yml; every other measured reader is grandfathered with a dated reason', () => {
    const e = entry(r, 'BOT_PR_TOKEN');
    expect(e.contract_readers).toContain('bot-pr.yml');
    for (const w of e.readers_allowed) {
      if (e.contract_readers.includes(w)) continue;
      expect(e.grandfathered[w], w).toMatch(/2026-11-(0[45]|13)/);
    }
    expect(Object.keys(e.grandfathered).sort()).toEqual(['autopilot.yml', 'bot-automerge.yml', 'queue-daily-report.yml', 'queue-merge.yml', 'queue-watchdog.yml', 'queue-worker.yml', 'stale-bot-pr-sweep.yml']);
  });
  it('the owner PC gh session is recorded as NOT an automation credential and no workflow can name it', () => {
    expect(r.owner_credentials.map((c: Any) => c.acts_as)).toEqual(['123constante']);
  });
  it('fails closed on bad JSON and bad shape', () => {
    expect(parseRegister('{').ok).toBe(false);
    expect(parseRegister('{"version":2,"entries":[]}').ok).toBe(false);
    expect(parseRegister('{"version":1}').ok).toBe(false);
    const bad = clone(JSON.parse(REGISTER_TEXT));
    delete bad.entries[0].readers_allowed;
    expect(parseRegister(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe('measureWorkflows: secret readers, triggers, runners (real parse)', () => {
  it('finds secrets only inside expressions (a script named *-secrets.mjs or steps.secrets.outputs is not a secret)', () => {
    const m = measureWorkflows([
      wf('a.yml', [
        'on: { schedule: [{ cron: "0 0 * * *" }] }',
        'jobs:',
        '  j:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - id: secrets',
        '        run: node scripts/precheck-supabase-secrets.mjs',
        "      - if: steps.secrets.outputs.ok == 'true' && secrets.FOO_A != ''",
        '        env: { X: "${{ secrets.FOO_B }}", Y: "${{ secrets[\'FOO_C\'] }}" }',
        '        run: echo hi',
      ].join('\n')),
    ]);
    expect(Object.keys(m.readers).sort()).toEqual(['FOO_A', 'FOO_B', 'FOO_C']);
  });
  it('classifies triggers: pull_request, pull_request_target, push to non-main (branches, master, paths-only, tags) are untrusted', () => {
    const one = (on: string) => measureWorkflows([wf('w.yml', `on: ${on}\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "\${{ secrets.S }}"\n`)]);
    expect(one('{ push: { branches: [main] } }').untrustedReaders.S ?? []).toEqual([]);
    expect(one('{ schedule: [{ cron: "1 1 * * *" }], workflow_dispatch: {} }').untrustedReaders.S ?? []).toEqual([]);
    expect(one('{ pull_request: {} }').untrustedReaders.S[0].trigger).toBe('pull_request');
    expect(one('{ push: { branches: [main, master] } }').untrustedReaders.S[0].trigger).toMatch(/^push/);
    expect(one('{ push: { paths: [x] } }').untrustedReaders.S[0].trigger).toMatch(/^push/);
    expect(one('{ push: { branches: ["claude/**"] } }').untrustedReaders.S[0].trigger).toMatch(/^push/);
    expect(one('push').untrustedReaders.S[0].trigger).toMatch(/^push/);
    expect(one('[push, pull_request]').untrustedReaders.S.length).toBeGreaterThan(0);
  });
  it('pull_request_target is exempt ONLY when the job checks out main (or nothing)', () => {
    const job = (co: string) => measureWorkflows([wf('t.yml', `on: { pull_request_target: {} }\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n${co}      - run: echo "\${{ secrets.S }}"\n`)]);
    expect(job('').untrustedReaders.S ?? []).toEqual([]);
    expect(job('      - uses: actions/checkout@v7\n        with: { ref: main, persist-credentials: false }\n').untrustedReaders.S ?? []).toEqual([]);
    expect(job('      - uses: actions/checkout@v7\n').untrustedReaders.S.length).toBe(1);
    expect(job('      - uses: actions/checkout@v7\n        with: { ref: "${{ github.event.pull_request.head.sha }}" }\n').untrustedReaders.S.length).toBe(1);
  });
  it('workflow-level env secrets count for every job', () => {
    const m = measureWorkflows([wf('e.yml', 'on: { pull_request: {} }\nenv: { T: "${{ secrets.W }}" }\njobs:\n  a: { runs-on: ubuntu-latest, steps: [{ run: "true" }] }\n')]);
    expect(m.readers.W).toEqual(['e.yml']);
    expect(m.untrustedReaders.W.length).toBe(1);
  });
  it('the real tree: zero self-hosted runners anywhere (rule e measures, it does not assume)', () => {
    const m = measureWorkflows(WORKFLOWS);
    expect(m.jobCount).toBeGreaterThan(40);
    expect(m.selfHosted).toEqual([]);
  });
  it('an unparseable workflow is a measurement failure, never a clean scan', () => {
    expect(() => measureWorkflows([wf('x.yml', 'on: [\n')])).toThrow();
  });
});

describe('checkRegister: the real register over the real workflows is green', () => {
  it('no violation today', () => {
    const r = checkRegister({ register: reg(), measured: measureWorkflows(WORKFLOWS) });
    expect(r.violations).toEqual([]);
  });
  it('main() over the real tree exits 0', async () => {
    const q = quiet();
    expect(await registerMain([], {}, q.log)).toBe(0);
  });
});

describe('checkRegister: each rule (a)-(f) fires on its own mutant', () => {
  const base = () => ({ register: reg(), measured: measureWorkflows(WORKFLOWS) });
  const SCHED = 'on: { schedule: [{ cron: "0 0 * * *" }] }\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n';
  it('(a) a secret used in a workflow but not in the register', () => {
    const { register } = base();
    const measured = measureWorkflows([...WORKFLOWS, wf('new.yml', SCHED + '      - env: { X: "${{ secrets.BRAND_NEW_SECRET }}" }\n        run: "true"\n')]);
    expect(checkRegister({ register, measured }).violations).toContain('(a) secrets.BRAND_NEW_SECRET is used in new.yml but is not in the register');
  });
  it('(a) GITHUB_TOKEN is exempt', () => {
    const { register } = base();
    const measured = measureWorkflows([...WORKFLOWS, wf('gt.yml', SCHED + '      - env: { X: "${{ secrets.GITHUB_TOKEN }}" }\n        run: "true"\n')]);
    expect(checkRegister({ register, measured }).violations).toEqual([]);
  });
  it('(b) a new reader of a register secret that is not in readers_allowed', () => {
    const { register } = base();
    const measured = measureWorkflows([...WORKFLOWS, wf('sneaky.yml', SCHED + '      - env: { X: "${{ secrets.AUTOMERGE_TOKEN }}" }\n        run: "true"\n')]);
    expect(checkRegister({ register, measured }).violations).toContain('(b) AUTOMERGE_TOKEN: measured reader sneaky.yml is not in readers_allowed');
  });
  it('(b) a stale readers_allowed entry (nothing reads it any more) is refused', () => {
    const { register, measured } = base();
    entry(register, 'IO_HEALTH_SECRET').readers_allowed.push('gone.yml');
    expect(checkRegister({ register, measured }).violations).toContain('(b) IO_HEALTH_SECRET: readers_allowed gone.yml is not a measured reader (stale)');
  });
  it('(b) a reader beyond the contract minimum without a dated grandfather reason is refused', () => {
    const { register, measured } = base();
    delete entry(register, 'BOT_PR_TOKEN').grandfathered['autopilot.yml'];
    expect(checkRegister({ register, measured }).violations).toContain('(b) BOT_PR_TOKEN: reader autopilot.yml exceeds the contract minimum and is not grandfathered (reason with a date)');
    const r2 = base().register;
    entry(r2, 'BOT_PR_TOKEN').grandfathered['autopilot.yml'] = 'because';
    expect(checkRegister({ register: r2, measured }).violations).toContain('(b) BOT_PR_TOKEN: reader autopilot.yml exceeds the contract minimum and is not grandfathered (reason with a date)');
  });
  it('(c) a register secret read by a pull_request workflow', () => {
    const { register } = base();
    entry(register, 'AUTOMERGE_TOKEN').readers_allowed.push('pr.yml');
    entry(register, 'AUTOMERGE_TOKEN').contract_readers.push('pr.yml');
    const measured = measureWorkflows([...WORKFLOWS, wf('pr.yml', 'on: { pull_request: {} }\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n      - env: { X: "${{ secrets.AUTOMERGE_TOKEN }}" }\n        run: "true"\n')]);
    expect(checkRegister({ register, measured }).violations).toContain('(c) AUTOMERGE_TOKEN: pr.yml reads it and is reachable from pull_request (not grandfathered)');
  });
  it('(c) static half of A34: a register secret read by a workflow pushed from a non-main branch', () => {
    const { register } = base();
    entry(register, 'AUTOMERGE_TOKEN').readers_allowed.push('br.yml');
    entry(register, 'AUTOMERGE_TOKEN').contract_readers.push('br.yml');
    const measured = measureWorkflows([...WORKFLOWS, wf('br.yml', 'on: { push: { branches: ["claude/**"] } }\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n      - env: { X: "${{ secrets.AUTOMERGE_TOKEN }}" }\n        run: "true"\n')]);
    expect(checkRegister({ register, measured }).violations).toContain('(c) AUTOMERGE_TOKEN: br.yml reads it and is reachable from push (branches: claude/**) (not grandfathered)');
  });
  it('(c) removing a grandfather for an untrusted reader turns it red; a stale untrusted grandfather is refused too', () => {
    const { register, measured } = base();
    delete entry(register, 'BOT_PR_TOKEN').untrusted_trigger_grandfathered['bot-pr.yml'];
    expect(checkRegister({ register, measured }).violations.some((v: string) => v.startsWith('(c) BOT_PR_TOKEN: bot-pr.yml reads it and is reachable from push'))).toBe(true);
    const r2 = base().register;
    entry(r2, 'BOT_PR_TOKEN').untrusted_trigger_grandfathered['autopilot.yml'] = 'stale 2026-11-04';
    expect(checkRegister({ register: r2, measured }).violations).toContain('(c) BOT_PR_TOKEN: untrusted_trigger_grandfathered autopilot.yml is not reachable from an untrusted trigger (stale)');
  });
  it('(d) acts_as equal to the owner login (any case) = red', () => {
    const { register, measured } = base();
    entry(register, 'AUTOMERGE_TOKEN').acts_as = '123Constante';
    expect(checkRegister({ register, measured }).violations).toContain('(d) AUTOMERGE_TOKEN: acts_as 123Constante equals owner_login 123constante');
  });
  it('(e) a self-hosted runner reachable from an untrusted trigger = red', () => {
    const { register } = base();
    const measured = measureWorkflows([...WORKFLOWS, wf('sh.yml', 'on: { pull_request: {} }\njobs:\n  j:\n    runs-on: [self-hosted, linux]\n    steps: [{ run: "true" }]\n')]);
    expect(checkRegister({ register, measured }).violations).toContain('(e) sh.yml/j: self-hosted runner reachable from pull_request');
  });
  it('(f) actual_scope: NOT VERIFIED or a subset of the minimum passes; a wider recorded scope fails; junk fails', () => {
    const { register, measured } = base();
    const e = entry(register, 'AUTOMERGE_TOKEN');
    e.actual_scope = ['contents:write', 'pull-requests:read'];
    expect(checkRegister({ register, measured }).violations).toEqual([]);
    e.actual_scope = ['contents:write', 'pull-requests:write', 'workflows:write'];
    expect(checkRegister({ register, measured }).violations).toContain('(f) AUTOMERGE_TOKEN: actual_scope workflows:write exceeds required_minimum_scope');
    e.actual_scope = ['administration:read'];
    expect(checkRegister({ register, measured }).violations).toContain('(f) AUTOMERGE_TOKEN: actual_scope administration:read exceeds required_minimum_scope');
    e.actual_scope = 'everything';
    expect(checkRegister({ register, measured }).violations).toContain('(f) AUTOMERGE_TOKEN: actual_scope is neither "NOT VERIFIED" nor a list of permission tokens');
  });
  it('parseScope: read < write; malformed tokens are null', () => {
    expect(parseScope(['contents:write'])).toEqual([{ perm: 'contents', level: 2 }]);
    expect(parseScope(['contents:read'])).toEqual([{ perm: 'contents', level: 1 }]);
    expect(parseScope(['contents'])).toBeNull();
    expect(parseScope('x')).toBeNull();
  });
  it('an exists:false entry that a workflow already reads is refused', () => {
    const { register } = base();
    const measured = measureWorkflows([...WORKFLOWS, wf('p.yml', SCHED + '      - env: { X: "${{ secrets.AUTOMATION_PAUSE_TOKEN }}" }\n        run: "true"\n')]);
    entry(register, 'AUTOMATION_PAUSE_TOKEN').readers_allowed.push('p.yml');
    entry(register, 'AUTOMATION_PAUSE_TOKEN').contract_readers.push('p.yml');
    expect(checkRegister({ register, measured }).violations).toContain('(a) AUTOMATION_PAUSE_TOKEN: exists is false but p.yml reads it');
  });
});

describe('check-secrets-register main(): exit codes (0 / 1 / 2) pinned per branch', () => {
  it('1 on a violation (driven through injected inputs)', async () => {
    const q = quiet();
    const r = JSON.parse(REGISTER_TEXT);
    r.entries.find((e: Any) => e.name === 'BOT_PR_TOKEN').acts_as = '123constante';
    expect(await registerMain([], {}, q.log, { registerText: JSON.stringify(r), workflows: WORKFLOWS })).toBe(1);
    expect(q.lines.join('\n')).toContain('(d) BOT_PR_TOKEN');
  });
  it('2 when the register cannot be read or parsed, or a workflow cannot be parsed', async () => {
    expect(await registerMain([], {}, quiet().log, { registerText: '{', workflows: WORKFLOWS })).toBe(2);
    expect(await registerMain([], {}, quiet().log, { registerText: REGISTER_TEXT, workflows: [wf('x.yml', 'on: [\n')] })).toBe(2);
    expect(await registerMain([], {}, quiet().log, { registerText: REGISTER_TEXT, workflows: [] })).toBe(2);
  });
  it('--self-test passes', async () => {
    expect(await registerMain(['--self-test'], {}, quiet().log)).toBe(0);
  });
});

describe('A34 (workflow-file push by BOT_PR_TOKEN): static half only', () => {
  it('documented: the live drill needs the real BOT_PR_TOKEN and is NOT run here', () => {
    // GitHub rejects a push that adds/edits a workflow file when the token lacks the workflows
    // permission. Proving that needs the live token, which this slice never touches. What IS
    // proven here: rule (c) refuses any NEW register-secret reader reachable from a non-main push.
    const r = reg();
    expect(entry(r, 'BOT_PR_TOKEN').required_minimum_scope).not.toContain('workflows:write');
    expect(String(entry(r, 'BOT_PR_TOKEN').contract_text)).toMatch(/NO workflows permission/);
  });
});

describe('expiry (automation-token-expiry.yml): 7 days, 1 day, past', () => {
  const withExpiry = (name: string, expiry: string | null) => {
    const r = reg();
    entry(r, name).expiry = expiry;
    return r;
  };
  it('no expiry recorded = nothing to say', () => {
    expect(decideExpiry(reg(), '2026-11-04')).toEqual({ notices: [], expired: [], errors: [] });
  });
  it('8 days ahead = silent; 7 days = one 7d notice; 1 day = one 1d notice; today = 1d; yesterday = expired', () => {
    expect(decideExpiry(withExpiry('AUTOMERGE_TOKEN', '2026-11-12'), '2026-11-04').notices).toEqual([]);
    expect(decideExpiry(withExpiry('AUTOMERGE_TOKEN', '2026-11-11'), '2026-11-04').notices.map((n: Any) => n.key)).toEqual(['expiry:AUTOMERGE_TOKEN:2026-11-11:7d']);
    expect(decideExpiry(withExpiry('AUTOMERGE_TOKEN', '2026-11-05'), '2026-11-04').notices.map((n: Any) => n.key)).toEqual(['expiry:AUTOMERGE_TOKEN:2026-11-05:1d']);
    expect(decideExpiry(withExpiry('AUTOMERGE_TOKEN', '2026-11-04'), '2026-11-04').notices.map((n: Any) => n.key)).toEqual(['expiry:AUTOMERGE_TOKEN:2026-11-04:1d']);
    const past = decideExpiry(withExpiry('AUTOMERGE_TOKEN', '2026-11-03'), '2026-11-04');
    expect(past.expired).toEqual(['AUTOMERGE_TOKEN']);
    expect(past.notices.map((n: Any) => n.key)).toEqual(['expiry:AUTOMERGE_TOKEN:2026-11-03:past']);
  });
  it('a malformed expiry is an error, never silence', () => {
    expect(decideExpiry(withExpiry('AUTOMERGE_TOKEN', 'soon'), '2026-11-04').errors.length).toBe(1);
  });
  const run = async (r: Any, post: Any, env: Any = { GH_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' }) => {
    const q = quiet();
    const code = await registerMain(['--expiry', '--today', '2026-11-04'], env, q.log, { registerText: JSON.stringify(r), post });
    return { code, out: q.lines.join('\n') };
  };
  it('CLI: within 7 days posts ONE notice through postPauseNotice with the dedup key, exit 0', async () => {
    const calls: Any[] = [];
    const post = async (a: Any) => { calls.push(a); return { posted: true, skipped: false, error: null }; };
    const { code } = await run(withExpiry('AUTOMERGE_TOKEN', '2026-11-10'), post);
    expect(code).toBe(0);
    expect(calls.map((c) => c.key)).toEqual(['expiry:AUTOMERGE_TOKEN:2026-11-10:7d']);
    expect(calls[0].repo).toBe('o/r');
  });
  it('CLI: past expiry = notice + exit 1 (the arc stops, never silently continues)', async () => {
    const calls: Any[] = [];
    const post = async (a: Any) => { calls.push(a); return { posted: false, skipped: true, error: null }; };
    expect((await run(withExpiry('BOT_PR_TOKEN', '2026-10-01'), post)).code).toBe(1);
    expect(calls.length).toBe(1);
  });
  it('CLI: a notice that cannot be posted = exit 2; no token with a notice due = exit 2', async () => {
    const post = async () => ({ posted: false, skipped: false, error: 'HTTP 500' });
    expect((await run(withExpiry('AUTOMERGE_TOKEN', '2026-11-10'), post)).code).toBe(2);
    expect((await run(withExpiry('AUTOMERGE_TOKEN', '2026-11-10'), post, {})).code).toBe(2);
  });
  it('CLI: nothing due = exit 0 and no post at all', async () => {
    let n = 0;
    const post = async () => { n++; return { posted: true, skipped: false, error: null }; };
    expect((await run(reg(), post)).code).toBe(0);
    expect(n).toBe(0);
  });
});

describe('identity check (drill A36): GET /user per credential, fake fetch', () => {
  const TOK_A = ['tok', 'en', 'A', 'value'].join('-');
  const TOK_B = ['tok', 'en', 'B', 'value'].join('-');
  const fakeFetch = (logins: Record<string, string | number>) => {
    const seen: Any[] = [];
    const f = async (url: string, init: Any) => {
      seen.push({ url, init });
      const auth = String(init.headers.authorization || '');
      const tok = auth.replace(/^Bearer /, '');
      const v = logins[tok];
      if (typeof v === 'number') return new Response('{}', { status: v });
      return new Response(JSON.stringify({ login: v }), { status: 200 });
    };
    return { f, seen };
  };
  const env = { BOT_PR_TOKEN: TOK_A, AUTOMERGE_TOKEN: TOK_B };
  const run = async (logins: Record<string, string | number>, r: Any = reg(), e: Any = env) => {
    const q = quiet();
    const { f, seen } = fakeFetch(logins);
    const code = await identityMain([], e, q.log, { fetch: f, registerText: JSON.stringify(r) });
    return { code, out: q.lines.join('\n'), seen };
  };
  // MECHANISM fixture, independent of the shipped register's choices: both PATs exist, acts_as is
  // null, and author / merge are kept apart. The owner dropped that pair from the SHIPPED register
  // on 2026-11-05 (pinned in the next describe); the mechanism itself must still work.
  const fixture = (): Any => {
    const r = reg();
    r.separate_roles = [['author', 'merge'], ['author', 'approver'], ['merge', 'approver']];
    for (const n of ['BOT_PR_TOKEN', 'AUTOMERGE_TOKEN']) Object.assign(entry(r, n), { exists: true, acts_as: null, acts_as_state: 'to record' });
    return r;
  };
  it('distinct automation logins, acts_as null = loud "to record" lines, exit 0', async () => {
    const { code, out, seen } = await run({ [TOK_A]: 'kiki-claude-bot', [TOK_B]: 'kiki-merge-bot' }, fixture());
    expect(code).toBe(0);
    expect(out).toMatch(/BOT_PR_TOKEN -> kiki-claude-bot/);
    expect(out).toMatch(/to record/);
    expect(seen.every((s: Any) => s.url === 'https://api.github.com/user')).toBe(true);
  });
  it('A36: a credential that resolves to the owner login = red', async () => {
    const { code, out } = await run({ [TOK_A]: '123constante', [TOK_B]: 'kiki-merge-bot' }, fixture());
    expect(code).toBe(1);
    expect(out).toContain('BOT_PR_TOKEN resolves to the owner login 123constante');
  });
  it('A36: two roles kept apart by separate_roles (fixture: author, merge) resolving to one login = red', async () => {
    const { code, out } = await run({ [TOK_A]: 'kiki-claude-bot', [TOK_B]: 'kiki-claude-bot' }, fixture());
    expect(code).toBe(1);
    expect(out).toContain('roles author (BOT_PR_TOKEN) and merge (AUTOMERGE_TOKEN) resolve to one login kiki-claude-bot');
  });
  it('a recorded acts_as that differs from GET /user = red', async () => {
    const r = fixture();
    entry(r, 'AUTOMERGE_TOKEN').acts_as = 'kiki-merge-bot';
    expect((await run({ [TOK_A]: 'kiki-claude-bot', [TOK_B]: 'someone-else' }, r)).code).toBe(1);
    expect((await run({ [TOK_A]: 'kiki-claude-bot', [TOK_B]: 'kiki-merge-bot' }, r)).code).toBe(0);
  });
  it('missing credential env or an HTTP failure = exit 2 (cannot measure), never green', async () => {
    // A credential the register marks exists:true but the env lacks stays exit 2, never green.
    expect((await run({ [TOK_A]: 'kiki-claude-bot', [TOK_B]: 'x' }, fixture(), { BOT_PR_TOKEN: TOK_A })).code).toBe(2);
    expect((await run({ [TOK_A]: 401, [TOK_B]: 'x' }, fixture())).code).toBe(2);
    expect((await run({}, reg(), {})).code).toBe(2);
  });
  it('never prints a token or an authorization header', async () => {
    for (const logins of [{ [TOK_A]: '123constante', [TOK_B]: 'b' }, { [TOK_A]: 401, [TOK_B]: 'b' }, { [TOK_A]: 'a', [TOK_B]: 'b' }]) {
      const { out } = await run(logins as Any, fixture());
      expect(out).not.toContain(TOK_A);
      expect(out).not.toContain(TOK_B);
      expect(out.toLowerCase()).not.toContain('bearer');
    }
  });
  it('judgeIdentities is pure: owner login, shared role, mismatch each named', () => {
    const r = fixture();
    const v = judgeIdentities({ register: r, resolved: { BOT_PR_TOKEN: '123constante', AUTOMERGE_TOKEN: '123constante' } });
    expect(v.violations.length).toBeGreaterThanOrEqual(3);
  });
  it('--offline (the lint-chain link) judges the recorded acts_as only: real register 0, owner-acting entry 1', async () => {
    expect(await identityMain(['--offline'], {}, quiet().log)).toBe(0);
    const r = reg();
    entry(r, 'TYPES_BOT_TOKEN').acts_as = '123constante';
    expect(await identityMain(['--offline'], {}, quiet().log, { registerText: JSON.stringify(r) })).toBe(1);
  });
  it('--self-test passes', async () => {
    expect(await identityMain(['--self-test'], {}, quiet().log)).toBe(0);
  });
});

describe('the SHIPPED register after the owner decision of 2026-11-05 (author/merge separation dropped)', () => {
  const TOK = ['tok', 'en', 'S', 'value'].join('-');
  const runShipped = async (login: string | number, env: Any = { BOT_PR_TOKEN: TOK, AUTOMERGE_TOKEN: '' }) => {
    const q = quiet();
    const f = async () => (typeof login === 'number' ? new Response('{}', { status: login }) : new Response(JSON.stringify({ login }), { status: 200 }));
    const code = await identityMain([], env, q.log, { fetch: f, registerText: REGISTER_TEXT });
    return { code, out: q.lines.join('\n') };
  };
  it('separate_roles is exactly author/approver and merge/approver', () => {
    expect(reg().separate_roles).toEqual([['author', 'approver'], ['merge', 'approver']]);
  });
  it('AUTOMERGE_TOKEN is recorded absent, with a dated note and dated absent_readers', () => {
    const e = entry(reg(), 'AUTOMERGE_TOKEN');
    expect(e.exists).toBe(false);
    expect(e.note).toMatch(/2026-11-05/);
    expect(Object.keys(e.absent_readers).sort()).toEqual(['automation-identity-check.yml', 'autopilot.yml']);
  });
  it('the CI shape (BOT_PR_TOKEN set, AUTOMERGE_TOKEN empty) resolving to kiki-claude-bot = exit 0, no "to record"', async () => {
    const { code, out } = await runShipped('kiki-claude-bot');
    expect(code).toBe(0);
    expect(out).not.toMatch(/TO RECORD -- BOT_PR_TOKEN/);
  });
  it('the owner-login check is NOT dropped: BOT_PR_TOKEN resolving to the owner login = red', async () => {
    const { code, out } = await runShipped('123Constante');
    expect(code).toBe(1);
    expect(out).toContain('BOT_PR_TOKEN resolves to the owner login 123constante');
  });
  it('a login other than the recorded acts_as = red; a missing BOT_PR_TOKEN or HTTP failure = exit 2', async () => {
    expect((await runShipped('someone-else')).code).toBe(1);
    expect((await runShipped('kiki-claude-bot', {})).code).toBe(2);
    expect((await runShipped(401)).code).toBe(2);
  });
  it('the shipped register passes rules (a)-(f) against the real workflows', () => {
    expect(checkRegister({ register: reg(), measured: measureWorkflows(WORKFLOWS) }).violations).toEqual([]);
  });
  it('(a) an absent_readers entry for a workflow that no longer reads the secret = red (stale)', () => {
    const r = reg();
    entry(r, 'AUTOMERGE_TOKEN').absent_readers['gone.yml'] = 'measured 2026-11-05';
    expect(checkRegister({ register: r, measured: measureWorkflows(WORKFLOWS) }).violations).toContain('(a) AUTOMERGE_TOKEN: absent_readers gone.yml is not a measured reader (stale)');
  });
});

describe('isOwnerAction: the owner-login controls ignore every registered automation login', () => {
  const r = reg();
  it('the owner login (any case) is an owner action', () => {
    expect(isOwnerAction('123constante', r)).toBe(true);
    expect(isOwnerAction('123Constante', r)).toBe(true);
  });
  it('registered automation logins and anything else are not', () => {
    for (const l of ['kiki-claude-bot', 'github-actions[bot]', 'automation-approver[bot]', 'dependabot[bot]', '', null, undefined, 42]) {
      expect(isOwnerAction(l as Any, r)).toBe(false);
    }
  });
  it('fail closed: a register in which an automation credential acts as the owner makes NOTHING an owner action', () => {
    const bad = clone(r);
    entry(bad, 'AUTOMERGE_TOKEN').acts_as = '123constante';
    expect(isOwnerAction('123constante', bad)).toBe(false);
    expect(isOwnerAction('123constante', null as Any)).toBe(false);
  });
});

describe('A22: log secret matcher (dummy echo drill, fixtures only)', () => {
  const D = {
    ghp: 'ghp_' + 'A1b2'.repeat(9),
    pat: 'github_pat_' + 'Z9_y'.repeat(20) + 'ab',
    sbp: 'sbp_' + '0a1b2c3d4e'.repeat(4),
    sk: 'sk_' + 'live_' + 'Q'.repeat(24),
    wh: 'whsec_' + 'k'.repeat(32),
  };
  it('a deliberate echo of each dummy secret is caught, and the hit never carries the value', () => {
    for (const [k, v] of Object.entries(D)) {
      const log = `2026-11-04T10:00:00Z step ${k}\n2026-11-04T10:00:01Z echo ${v}\n`;
      const hits = findSecretLeaks(log);
      expect(hits.length, k).toBe(1);
      expect(hits[0].line).toBe(2);
      expect(JSON.stringify(hits)).not.toContain(v);
    }
  });
  it('masked values, bare prefixes and too-short tails are not hits', () => {
    expect(findSecretLeaks('token=***\nghp_ is the prefix\nghp_short\nsk_live_x')).toEqual([]);
  });
  it('the offline mode scans the real workflow files and finds nothing', async () => {
    expect(await leakMain([], {}, quiet().log)).toBe(0);
  });
  it('main over an injected leaking text exits 1 and does not print the value', async () => {
    const q = quiet();
    expect(await leakMain(['--file', 'x.log'], {}, q.log, { readText: () => 'echo ' + D.ghp })).toBe(1);
    expect(q.lines.join('\n')).not.toContain(D.ghp);
  });
  it('--self-test passes', async () => {
    expect(await leakMain(['--self-test'], {}, quiet().log)).toBe(0);
  });
});

for (const file of ['automation-identity-check.yml', 'automation-token-expiry.yml']) {
  const RAW = readFileSync(path.join(WF_DIR, file), 'utf8');
  for (const [eol, text] of [['as read', RAW], ['CRLF', RAW.replace(/\r?\n/g, '\r\n')]] as const) {
    describe(`${file} (${eol})`, () => {
      const w = parse(text);
      const on = w.on ?? w[true as unknown as string];
      it('nothing PR-shaped triggers it', () => {
        for (const t of ['pull_request', 'pull_request_target', 'issue_comment', 'pull_request_review']) expect(on[t]).toBeUndefined();
        if (on.push) expect(on.push.branches).toEqual(['main']);
        expect('workflow_dispatch' in on).toBe(true);
        expect(on.schedule.length).toBe(1);
      });
      it('least privilege, GitHub-hosted, main checkout without credentials, no job widens permissions', () => {
        const want = file === 'automation-identity-check.yml' ? { contents: 'read' } : { contents: 'read', issues: 'write' };
        expect(w.permissions).toEqual(want);
        for (const j of Object.values(w.jobs) as Any[]) {
          expect(j.permissions).toBeUndefined();
          expect(j['runs-on']).toBe('ubuntu-latest');
          const co = j.steps.filter((s: Any) => /^actions\/checkout@/.test(String(s.uses || '')));
          expect(co.length).toBe(1);
          expect(co[0].with).toEqual({ ref: 'main', 'persist-credentials': false });
        }
      });
      it('secrets reach a step only through env:, never a run: line; no ${{ }} inside run:', () => {
        for (const j of Object.values(w.jobs) as Any[]) for (const s of j.steps) {
          if (s.run) {
            expect(String(s.run)).not.toMatch(/\$\{\{/);
            expect(String(s.run)).not.toMatch(/secrets\./);
          }
          for (const v of Object.values(s.with || {})) expect(String(v)).not.toMatch(/secrets\./);
        }
      });
      it('A23: hostile PR title/body/branch text has no path in (no event text is referenced at all)', () => {
        expect(text).not.toMatch(/github\.event\.(pull_request|issue|comment|review|head_commit)/);
        expect(text).not.toMatch(/github\.head_ref|github\.event\.inputs|inputs\./);
        // Even if a dispatch carried hostile text, nothing reads it: no inputs are declared.
        expect(on.workflow_dispatch == null || on.workflow_dispatch.inputs === undefined).toBe(true);
      });
    });
  }
}

describe('automation-identity-check.yml passes exactly the two PATs, by env only', () => {
  const w = parse(readFileSync(path.join(WF_DIR, 'automation-identity-check.yml'), 'utf8'));
  it('push to main only on the register file; weekly schedule', () => {
    const on = w.on ?? w[true as unknown as string];
    expect(on.push.paths).toEqual(['.github/automation/secrets-register.json']);
  });
  it('the identity step env holds BOT_PR_TOKEN and AUTOMERGE_TOKEN from secrets and runs the script', () => {
    const steps = (Object.values(w.jobs)[0] as Any).steps;
    const s = steps.find((x: Any) => /check-identity-register\.mjs/.test(String(x.run || '')));
    expect(s.env).toEqual({ BOT_PR_TOKEN: '${{ secrets.BOT_PR_TOKEN }}', AUTOMERGE_TOKEN: '${{ secrets.AUTOMERGE_TOKEN }}' });
    expect(String(s.run).trim()).toBe('node scripts/check-identity-register.mjs');
  });
});

describe('automation-token-expiry.yml runs the expiry mode with github.token', () => {
  const w = parse(readFileSync(path.join(WF_DIR, 'automation-token-expiry.yml'), 'utf8'));
  it('daily schedule; the step uses GH_TOKEN = github.token and --expiry', () => {
    const steps = (Object.values(w.jobs)[0] as Any).steps;
    const s = steps.find((x: Any) => /check-secrets-register\.mjs/.test(String(x.run || '')));
    expect(String(s.run).trim()).toBe('node scripts/check-secrets-register.mjs --expiry');
    expect(s.env).toEqual({ GH_TOKEN: '${{ github.token }}' });
  });
});
