// bot-pr.yml opens NO PR for review reports (claude/review-*) or "nothing to change" markers
// (claude/done-*): owner click 2026-11-04 (docs/briefs/bot-pr-skip-review-done.md). This test
// evaluates the REAL `jobs.open-pr.if` expression with a tiny evaluator for exactly the subset
// the expression uses; any other token throws, so a rewrite cannot pass by accident.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const YML = path.resolve(__dirname, '../.github/workflows/bot-pr.yml');

type Ctx = { ref_name: string; deleted: boolean };
type Val = string | boolean;

/** Tokenise + recursive-descent evaluate: ! && || ( ) , startsWith() github.ref_name github.event.deleted 'str'. */
export function evalIf(expr: string, ctx: Ctx): boolean {
  const src = expr.trim().replace(/^\$\{\{([\s\S]*)\}\}$/, '$1');
  const toks: string[] = [];
  const re = /\s*(&&|\|\||!|\(|\)|,|'(?:[^']|'')*'|[A-Za-z_][A-Za-z0-9_.-]*)/y;
  let i = 0;
  while (i < src.length) {
    if (/^\s*$/.test(src.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new Error(`unsupported token at ${i}: ${src.slice(i, i + 20)}`);
    toks.push(m[1]);
    i = re.lastIndex;
  }
  let p = 0;
  const peek = () => toks[p];
  const eat = (t?: string) => {
    const x = toks[p++];
    if (x === undefined || (t !== undefined && x !== t)) throw new Error(`expected ${t ?? 'token'}, got ${x}`);
    return x;
  };
  const truthy = (v: Val) => (typeof v === 'string' ? v.length > 0 : v);
  const primary = (): Val => {
    const t = eat();
    if (t === '!') return !truthy(primary());
    if (t === '(') { const v = or(); eat(')'); return v; }
    if (t.startsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
    if (t === 'github.ref_name') return ctx.ref_name;
    if (t === 'github.event.deleted') return ctx.deleted;
    if (t === 'startsWith') {
      eat('(');
      const a = or(); eat(',');
      const b = or(); eat(')');
      return String(a).toLowerCase().startsWith(String(b).toLowerCase());
    }
    throw new Error(`unsupported token: ${t}`);
  };
  const and = (): Val => { let v = primary(); while (peek() === '&&') { eat(); const r = primary(); v = truthy(v) ? r : v; } return v; };
  const or = (): Val => { let v = and(); while (peek() === '||') { eat(); const r = and(); v = truthy(v) ? v : r; } return v; };
  const v = or();
  if (p !== toks.length) throw new Error(`trailing tokens: ${toks.slice(p).join(' ')}`);
  return truthy(v);
}

const realIf = (text = readFileSync(YML, 'utf8')) => String(parse(text).jobs['open-pr'].if);

const ROWS: [string, boolean, boolean][] = [
  ['claude/review-x', false, false],
  ['claude/done-x', false, false],
  ['claude/review-1362-r1', false, false],
  ['claude/real', false, true],
  ['claude/reviewer-ui', false, true], // the prefix is `review-` WITH the dash
  ['claude/done', false, true], // no dash: a real branch
  ['claude/walk-x', false, true], // out of scope, unchanged
  ['ccr-abc', false, true],
  ['claude/real', true, false], // a branch deletion never opens a PR
];

/** Which rows the expression gets wrong. Empty = correct. */
const wrongRows = (expr: string) => ROWS.filter(([ref, del, opens]) => evalIf(expr, { ref_name: ref, deleted: del }) !== opens).map(([r, d]) => `${r}${d ? ' (deleted)' : ''}`);

describe('bot-pr.yml job if: skips claude/review-* and claude/done-*', () => {
  const expr = realIf();
  for (const [ref, deleted, opens] of ROWS) {
    it(`${ref}${deleted ? ' deleted' : ''} -> ${opens ? 'opens' : 'no PR'}`, () => {
      expect(evalIf(expr, { ref_name: ref, deleted })).toBe(opens);
    });
  }
  it('uses the job if:, not branch filters (branches + branches-ignore is invalid)', () => {
    const on = parse(readFileSync(YML, 'utf8')).on;
    expect(on.push['branches-ignore']).toBeUndefined();
    expect(on.push.branches).toEqual(['claude/**', 'ccr-*']);
  });
});

describe('the evaluator refuses anything outside its subset', () => {
  for (const bad of ["contains(github.ref_name, 'x')", 'github.head_ref', "github.ref_name == 'x'", 'always()']) {
    it(bad, () => expect(() => evalIf(bad, { ref_name: 'a', deleted: false })).toThrow());
  }
});

describe('MUTANTS of the real expression fail the table', () => {
  const expr = realIf();
  const M: [string, (e: string) => string][] = [
    ['M1 delete the review clause', (e) => e.replace(/\s*&&\s*!startsWith\(github\.ref_name, 'claude\/review-'\)/, '')],
    ['M2 delete the done clause', (e) => e.replace(/\s*&&\s*!startsWith\(github\.ref_name, 'claude\/done-'\)/, '')],
    ['M3 review prefix without the dash', (e) => e.replace("'claude/review-'", "'claude/review'")],
    ['M4 swap && for ||', (e) => e.replace(/&&/g, '||')],
    ['M5 drop !github.event.deleted', (e) => e.replace(/!github\.event\.deleted\s*&&\s*/, '')],
    ['M6 !startsWith -> startsWith', (e) => e.replace(/!startsWith/g, 'startsWith')],
  ];
  for (const [name, mut] of M) {
    it(name, () => {
      const m = mut(expr);
      expect(m).not.toBe(expr);
      expect(wrongRows(m)).not.toEqual([]);
    });
  }
});
