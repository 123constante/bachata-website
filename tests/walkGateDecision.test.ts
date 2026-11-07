// Slice 10: the walk gate decision -- judge pass at the LIVE head, or a valid
// owner waiver pinned to the LIVE head, else blocked (fail-closed).
// The full table is verdict x head x waiver; every cell asserts allowed and via.
// MUTANTS at the bottom copy the module with one rule weakened and require the
// same table to go red, so the table is proven to guard each rule.
import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { decideWalkGate, WALK_GATE_REASONS, main } from '../scripts/lib/walk-gate-decision.mjs';

const LIVE = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const OWNER = 'owner-login';
const BOT = 'claude[bot]';
const CTX = { ownerLogin: OWNER, registeredAutomationLogins: [BOT, 'automation-bot'] };

type Decide = (input: unknown) => { allowed: boolean; via: string | null; reasons: { id: string; detail: string }[] };

const cited = [{ check: 'tapTargets', measured: 48, threshold: 44, op: '>=', screen: 's', shape: 'x', engine: 'chromium' }];
const verdictOf = (kind: string, headSha: unknown): unknown => {
  if (kind === 'none') return undefined;
  if (kind === 'malformed') return { verdict: 'PASS!', headSha };
  const base = { headSha, cited, engines: ['chromium', 'webkit'], invalidatedBy: 'any push' };
  if (kind === 'pass') return { ...base, verdict: 'pass', reasons: [] };
  if (kind === 'red') return { ...base, verdict: 'red', reasons: ['s / x / chromium: tapTargets measured 30, needs >= 44'] };
  return { ...base, verdict: 'doubt', reasons: ['judge doubt: picture looks clipped'] };
};
const HEADS: Record<string, unknown> = { same: LIVE, other: OTHER, missing: undefined, malformed: 'abc123' };
const waiverRec = (actor: string, headSha: string) => ({
  label: 'walk-waived', appliedBy: actor, eventActor: actor, headSha, readAtMergeTime: true, reason: 'copy-only change',
});
const WAIVERS: Record<string, { record: unknown; ctx: unknown }> = {
  none: { record: undefined, ctx: CTX },
  'owner at head': { record: waiverRec(OWNER, LIVE), ctx: CTX },
  'owner at old head': { record: waiverRec(OWNER, OTHER), ctx: CTX },
  'bot actor': { record: waiverRec(BOT, LIVE), ctx: CTX },
  'owner equal to bot login': { record: waiverRec(OWNER, LIVE), ctx: { ownerLogin: OWNER, registeredAutomationLogins: [BOT, OWNER] } },
};

type Cell = { name: string; input: unknown; allowed: boolean; via: string | null };
const CELLS: Cell[] = [];
for (const kind of ['pass', 'red', 'doubt', 'none', 'malformed']) {
  for (const [head, headSha] of Object.entries(HEADS)) {
    if ((kind === 'none') && head !== 'same') continue; // no verdict has no head
    for (const [w, { record, ctx }] of Object.entries(WAIVERS)) {
      const judgeOk = kind === 'pass' && head === 'same';
      const waiverOk = w === 'owner at head';
      CELLS.push({
        name: `verdict ${kind} / head ${head} / waiver ${w}`,
        input: { liveHeadSha: LIVE, verdict: verdictOf(kind, headSha), waiverRecord: record, waiverContext: ctx },
        allowed: judgeOk || waiverOk,
        via: judgeOk ? 'judge' : waiverOk ? 'waiver' : null,
      });
    }
  }
}
// The live head itself missing or malformed blocks everything, even a matching pass + owner waiver.
for (const [name, live] of [['missing', undefined], ['malformed', 'abc'], ['uppercase', 'A'.repeat(40)]] as const) {
  CELLS.push({
    name: `live head ${name} / pass at that head / owner waiver at that head`,
    input: { liveHeadSha: live, verdict: verdictOf('pass', live), waiverRecord: waiverRec(OWNER, live as string), waiverContext: CTX },
    allowed: false, via: null,
  });
}
// A caller-supplied pinnedHeadSha never overrides the live head.
CELLS.push({
  name: 'owner waiver at old head, caller context pins the old head',
  input: { liveHeadSha: LIVE, waiverRecord: waiverRec(OWNER, OTHER), waiverContext: { ...CTX, pinnedHeadSha: OTHER } },
  allowed: false, via: null,
});
CELLS.push({
  name: 'owner waiver at head, no waiver context',
  input: { liveHeadSha: LIVE, waiverRecord: waiverRec(OWNER, LIVE) },
  allowed: false, via: null,
});
// A 'pass' at the live head that isPass still rejects (one engine only) is blocked: the gate trusts isPass, not the word.
CELLS.push({
  name: 'pass at head missing webkit',
  input: { liveHeadSha: LIVE, verdict: { ...(verdictOf('pass', LIVE) as object), engines: ['chromium'] } },
  allowed: false, via: null,
});
for (const bad of [null, undefined, 'x', 42, []]) {
  CELLS.push({ name: `input ${JSON.stringify(bad) ?? 'undefined'}`, input: bad, allowed: false, via: null });
}

const ids = new Set(Object.values(WALK_GATE_REASONS));
function runTable(decide: Decide): string[] {
  const wrong: string[] = [];
  for (const c of CELLS) {
    const r = decide(c.input);
    if (r.allowed !== c.allowed || r.via !== c.via) wrong.push(c.name);
  }
  return wrong;
}

describe('decideWalkGate table', () => {
  it('has the full verdict x head x waiver grid', () => expect(CELLS.length).toBe(96));
  it.each(CELLS)('$name -> allowed $allowed via $via', (c) => {
    const r = decideWalkGate(c.input);
    expect(r.allowed).toBe(c.allowed);
    expect(r.via).toBe(c.via);
    if (r.allowed) expect(r.reasons).toEqual([]);
    else {
      expect(r.reasons.length).toBeGreaterThan(0);
      for (const x of r.reasons) expect(ids.has(x.id)).toBe(true);
    }
  });
});

describe('reasons', () => {
  const idsOf = (input: unknown) => decideWalkGate(input).reasons.map((r) => r.id);
  it('table is frozen', () => expect(Object.isFrozen(WALK_GATE_REASONS)).toBe(true));
  it('judge pass for another head names the wrong head', () => {
    expect(idsOf({ liveHeadSha: LIVE, verdict: verdictOf('pass', OTHER) })).toEqual(
      expect.arrayContaining([WALK_GATE_REASONS.VERDICT_WRONG_HEAD, WALK_GATE_REASONS.NO_WAIVER]));
  });
  it('owner waiver at old head names the wrong head and the invalid waiver', () => {
    expect(idsOf({ liveHeadSha: LIVE, waiverRecord: waiverRec(OWNER, OTHER), waiverContext: CTX })).toEqual(
      expect.arrayContaining([WALK_GATE_REASONS.NO_VERDICT, WALK_GATE_REASONS.WAIVER_WRONG_HEAD, WALK_GATE_REASONS.WAIVER_INVALID]));
  });
  it('red and doubt are named', () => {
    expect(idsOf({ liveHeadSha: LIVE, verdict: verdictOf('red', LIVE) })).toContain(WALK_GATE_REASONS.VERDICT_RED);
    expect(idsOf({ liveHeadSha: LIVE, verdict: verdictOf('doubt', LIVE) })).toContain(WALK_GATE_REASONS.VERDICT_DOUBT);
  });
  it('a bad live head is blamed on the live head, not the verdict or waiver', () => {
    const r = idsOf({ liveHeadSha: undefined, verdict: verdictOf('pass', LIVE), waiverRecord: waiverRec(OWNER, LIVE), waiverContext: CTX });
    expect(r).toContain(WALK_GATE_REASONS.LIVE_HEAD_INVALID);
    expect(r).not.toContain(WALK_GATE_REASONS.VERDICT_MALFORMED);
    expect(r).not.toContain(WALK_GATE_REASONS.WAIVER_WRONG_HEAD);
  });
  it('a getter that throws is blocked, not thrown', () => {
    const evil = { get liveHeadSha() { throw new Error('boom'); } };
    const r = decideWalkGate(evil);
    expect(r.allowed).toBe(false);
    expect(r.reasons[0].id).toBe(WALK_GATE_REASONS.DECIDER_THREW);
  });
});

describe('main', () => {
  const files: Record<string, string> = {
    'ok.json': JSON.stringify({ liveHeadSha: LIVE, verdict: verdictOf('pass', LIVE) }),
    'blocked.json': JSON.stringify({ liveHeadSha: LIVE, verdict: verdictOf('pass', OTHER) }),
    'garbage.json': '{not json',
  };
  const deps = { readFile: (p: string) => { if (!(p in files)) throw new Error('ENOENT'); return files[p]; }, log: () => {}, error: () => {} };
  it('exit 0 allowed, 1 blocked or unreadable, 2 usage', () => {
    expect(main(['--input', 'ok.json'], deps)).toBe(0);
    expect(main(['--input', 'blocked.json'], deps)).toBe(1);
    expect(main(['--input', 'garbage.json'], deps)).toBe(1);
    expect(main(['--input', 'missing.json'], deps)).toBe(1);
    expect(main(['--input'], deps)).toBe(2);
    expect(main([], deps)).toBe(2);
  });
});

// ---------------------------------------------------------------- mutants
const SRC_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/lib/walk-gate-decision.mjs');
const SRC = readFileSync(SRC_FILE, 'utf8');
// Mutants live in an OS temp dir (never in the tracked scripts/ tree); their
// relative imports are rewritten to absolute URLs of the real sibling modules.
const MUTANT_DIR = mkdtempSync(path.join(os.tmpdir(), 'walk-gate-mutant-'));
let seq = 0;
async function mutant(pairs: [string, string][]): Promise<Decide> {
  let src = SRC;
  for (const [from, to] of pairs) {
    expect(src.includes(from), `mutation anchor not found: ${from}`).toBe(true);
    src = src.split(from).join(to);
  }
  src = src.replace(/from '\.\/([a-z-]+\.mjs)'/g, (_m, f) => `from '${pathToFileURL(path.join(path.dirname(SRC_FILE), f)).href}'`);
  const f = path.join(MUTANT_DIR, `m-${seq++}.mjs`);
  writeFileSync(f, src);
  return (await import(pathToFileURL(f).href)).decideWalkGate as Decide;
}
afterAll(() => rmSync(MUTANT_DIR, { recursive: true, force: true }));

describe('MUTANTS: each weakened rule turns the table red', () => {
  it('unmutated copy is green (the harness itself is sound)', async () => {
    expect(runTable(await mutant([]))).toEqual([]);
  });
  it('drop the judge head compare', async () => {
    const d = await mutant([['isPass(verdict, liveHeadSha)', 'isPass(verdict, isObj(verdict) ? verdict.headSha : liveHeadSha)']]);
    expect(runTable(d)).toContain('verdict pass / head other / waiver none');
  });
  it('drop the waiver head pin', async () => {
    const d = await mutant([['pinnedHeadSha: liveHeadSha }', 'pinnedHeadSha: isObj(waiverRecord) ? waiverRecord.headSha : liveHeadSha }']]);
    expect(runTable(d)).toContain('verdict none / head same / waiver owner at old head');
  });
  it('accept a bot waiver: drop the automation-login list only', async () => {
    const d = await mutant([['pinnedHeadSha: liveHeadSha }', 'pinnedHeadSha: liveHeadSha, registeredAutomationLogins: [] }']]);
    expect(runTable(d)).toContain('verdict none / head same / waiver owner equal to bot login');
  });
  it('accept a bot waiver: treat the label actor as the owner', async () => {
    const d = await mutant([['pinnedHeadSha: liveHeadSha }', 'pinnedHeadSha: liveHeadSha, registeredAutomationLogins: [], ownerLogin: isObj(waiverRecord) ? waiverRecord.eventActor : null }']]);
    expect(runTable(d)).toContain('verdict none / head same / waiver bot actor');
  });
  it('trust the word pass instead of isPass', async () => {
    const d = await mutant([['isPass(verdict, liveHeadSha)', "(isObj(verdict) && verdict.verdict === 'pass' && verdict.headSha === liveHeadSha)"]]);
    expect(runTable(d)).toContain('pass at head missing webkit');
  });
  it('let doubt pass', async () => {
    const d = await mutant([['isPass(verdict, liveHeadSha)',
      "isPass(isObj(verdict) && verdict.verdict === 'doubt' ? { ...verdict, verdict: 'pass', reasons: [] } : verdict, liveHeadSha)"]]);
    expect(runTable(d)).toContain('verdict doubt / head same / waiver none');
  });
});
