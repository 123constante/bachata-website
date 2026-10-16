/**
 * CONTRACT: the #820 SQL (admin repo 123constante/bachata-admin, branch claude/account-system-db)
 * against what lib/accountDeletion, lib/accountSettings and lib/accountDeletionCopy read.
 *
 * The key names, states and codes are READ FROM THE SQL, never typed here: for each function the
 * LAST `CREATE OR REPLACE FUNCTION` across the admin migrations (sorted by name) is parsed.
 *  - _account_deletion_status_v1 -> status keys (jsonb_build_object keys) and states ('state' values).
 *  - my_account_restore_v1       -> restore codes (the 'code' values of its jsonb_build_object calls).
 *  - my_account_delete_v1        -> refusal codes (MESSAGE = '...', the _account_erase_refusal_v1
 *    codes it re-raises, and rate_limited from _member_rate_check_v1) and the rate window.
 *
 * Where the SQL comes from: ADMIN_REPO_DIR, else a sibling checkout `../bachata-admin` or
 * `../bachata-admin-11april`. With one present, a rename in the SQL goes red here, AND so does any
 * drift from fixtures/account-820-contract.json (the parsed facts, refreshed from this test only).
 * Without one (this repo's CI has no admin checkout), the client assertions run against that
 * snapshot and say so: the live cross-repo pin is a db-contract-check script once #820 is applied
 * (handover docs/handover/account-grid-3ad.md, Left).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyRestore, parseDeletionStatus } from '../accountDeletion';
import { DELETE_REFUSAL_CODES, classifyErase } from '../accountSettings';
import { deleteRefusalMessage } from '../accountDeletionCopy';
import SNAPSHOT from './fixtures/account-820-contract.json';

type Facts = { statusKeys: string[]; states: string[]; restoreCodes: string[]; deleteRefusalCodes: string[]; deleteRateWindow: string };

const ROOT = path.resolve(__dirname, '..', '..', '..');
const migrationsDir = (): string | null => {
  const candidates = [process.env.ADMIN_REPO_DIR, path.resolve(ROOT, '..', 'bachata-admin'), path.resolve(ROOT, '..', 'bachata-admin-11april')];
  for (const c of candidates) {
    if (c && existsSync(path.join(c, 'supabase', 'migrations'))) return path.join(c, 'supabase', 'migrations');
  }
  return null;
};

/** The body of the LAST definition of public.<fn> across the migrations, or null. */
export const lastDefinition = (dir: string, fn: string): string | null => {
  let body: string | null = null;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    const sql = readFileSync(path.join(dir, f), 'utf8');
    for (const m of sql.matchAll(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`, 'gi'))) {
      const tag = /AS\s+(\$\w*\$)/.exec(sql.slice(m.index));
      if (!tag) continue;
      const start = m.index + tag.index + tag[0].length;
      body = sql.slice(start, sql.indexOf(tag[1], start));
    }
  }
  return body;
};

/** The top-level argument lists of every `<name>(...)` call in `sql`. */
const callArgs = (sql: string, name: string): string[][] => {
  const out: string[][] = [];
  for (const m of sql.matchAll(new RegExp(`${name}\\(`, 'g'))) {
    const args: string[] = [];
    let depth = 0;
    let cur = '';
    for (const ch of sql.slice(m.index + m[0].length)) {
      if (ch === '(') depth += 1;
      if (ch === ')' && depth-- === 0) break;
      if (ch === ',' && depth === 0) {
        args.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    args.push(cur.trim());
    out.push(args);
  }
  return out;
};
const quoted = (s: string): string | null => /^'(\w+)'$/.exec(s)?.[1] ?? null;
/** Every one-word string literal in a value expression (a CASE yields several; '30 days' is no code). */
const literals = (v: string): string[] => [...v.matchAll(/'(\w+)'/g)].map((m) => m[1]);
const pairs = (body: string) => callArgs(body, 'jsonb_build_object').flatMap((a) => a.flatMap((k, i) => (i % 2 === 0 ? [[k, a[i + 1] ?? ''] as const] : [])));
const uniq = (xs: Array<string | null>) => [...new Set(xs.filter((x): x is string => Boolean(x)))].sort();
const SIGN_IN_CODES = new Set(['not_signed_in', 'not_authenticated']);

/** The contract facts, parsed from the SQL. */
export const readFacts = (dir: string): Facts => {
  const need = (fn: string) => {
    const b = lastDefinition(dir, fn);
    if (b === null) throw new Error(`no definition of public.${fn} in ${dir}`);
    return b;
  };
  const status = pairs(need('_account_deletion_status_v1'));
  const restore = pairs(need('my_account_restore_v1'));
  const del = need('my_account_delete_v1');
  const refusalCodes = [...del.matchAll(/MESSAGE\s*=\s*'(\w+)'/g)].map((m) => m[1]);
  if (del.includes("v_refusal->>'code'")) refusalCodes.push(...pairs(need('_account_erase_refusal_v1')).filter(([k]) => k === "'code'").flatMap(([, v]) => literals(v)));
  const rate = /_member_rate_check_v1\('account_delete',\s*\d+,\s*interval\s*'([^']+)'\)/.exec(del);
  if (rate && need('_member_rate_check_v1').includes("'rate_limited'")) refusalCodes.push('rate_limited');
  return {
    statusKeys: uniq(status.map(([k]) => quoted(k))),
    states: uniq(status.filter(([k]) => k === "'state'").flatMap(([, v]) => literals(v))),
    restoreCodes: uniq(restore.filter(([k]) => k === "'code'").flatMap(([, v]) => literals(v))),
    deleteRefusalCodes: uniq(refusalCodes.filter((c) => !SIGN_IN_CODES.has(c))),
    deleteRateWindow: rate?.[1] ?? '',
  };
};

const DIR = migrationsDir();
const { _source: _ignored, ...PINNED } = SNAPSHOT as Facts & { _source: string };
const FACTS: Facts = DIR ? readFacts(DIR) : PINNED;

describe(`#820 SQL (${DIR ?? 'NO admin checkout: the client half runs on fixtures/account-820-contract.json'})`, () => {
  it.runIf(DIR)('the parsed SQL matches the pinned snapshot (refresh the JSON from here when #820 changes)', () => {
    expect(FACTS).toEqual(PINNED);
  });
});

describe('client parses the #820 shapes', () => {
  const live = Object.fromEntries(FACTS.statusKeys.map((k) => [k, k === 'state' ? 'pending' : '2026-10-01T10:00:00+00:00']));
  it('every status key the SQL builds is read, by that name', () => {
    expect(parseDeletionStatus(live)).toEqual(live);
  });
  it.each(FACTS.states)('state %s is understood', (state) => {
    expect(parseDeletionStatus({ ...live, state })?.state).toBe(state);
  });
  it.each(FACTS.restoreCodes)('restore code %s has its own outcome', (code) => {
    expect(classifyRestore({ ...live, restored: false, code }).kind).not.toBe('failed');
  });
  it('a restore with code NULL is restored', () => {
    expect(classifyRestore({ ...live, restored: true, code: null }).kind).toBe('restored');
  });
  it('the Website names exactly the refusals the SQL raises', () => {
    expect([...DELETE_REFUSAL_CODES].sort()).toEqual(FACTS.deleteRefusalCodes);
  });
  it('the rate-limit copy names the SQL window', () => {
    const WORDS: Record<string, string> = { '1 day': '24 hours' };
    expect(WORDS[FACTS.deleteRateWindow]).toBeDefined();
    expect(deleteRefusalMessage('rate_limited')).toContain(WORDS[FACTS.deleteRateWindow]);
  });
  it('success body keys ok / hidden (account-erase handler)', () => {
    expect(classifyErase({ ok: true, hidden: true })).toEqual({ kind: 'hidden' });
  });
  it('blockers ride only on sole_organiser_owner (account-erase handler)', () => {
    const b = [{ entity_id: 'o', name: 'N' }];
    expect(classifyErase({ ok: false, code: 'sole_organiser_owner', blockers: b })).toEqual({ kind: 'refused', code: 'sole_organiser_owner', blockers: b });
  });
});
