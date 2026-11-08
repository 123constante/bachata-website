import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs script, no types
import { decideAudit, decideRecordAudit, worstCode, recordLine } from '../scripts/owner-approval-audit.mjs';

const OWNER = '123constante';
const approve = (commit_id: string, login = OWNER) => ({ user: { login }, state: 'APPROVED', commit_id });

describe('owner-approval audit -- decideAudit', () => {
  it('passes when no hard-tier path is touched (src/ is soft, docs are exempt)', () => {
    expect(decideAudit({ files: ['src/App.tsx', 'README.md'], prs: [] }).code).toBe(0);
  });

  it('passes a hard-tier change the owner approved at the PR head', () => {
    const v = decideAudit({
      files: ['.github/workflows/unit-tests.yml'],
      prs: [{ number: 7, headSha: 'abc123', reviews: [approve('abc123')] }],
    });
    expect(v.code).toBe(0);
  });

  it('REDS a hard-tier change merged with no approval at all (a merge is not an approval)', () => {
    const v = decideAudit({ files: ['scripts/ship-gate.mjs'], prs: [{ number: 8, headSha: 'h1', reviews: [] }] });
    expect(v.code).toBe(1);
    expect(v.reason).toContain('scripts/ship-gate.mjs');
  });

  it('REDS when the approval is on an OLDER commit (a later push voids it)', () => {
    const v = decideAudit({
      files: ['.githooks/pre-push'],
      prs: [{ number: 9, headSha: 'new', reviews: [approve('old')] }],
    });
    expect(v.code).toBe(1);
  });

  it('REDS when the owner\'s LATEST review is changes-requested after an approval', () => {
    const v = decideAudit({
      files: ['scripts/x.mjs'],
      prs: [{ number: 10, headSha: 'h', reviews: [approve('h'), { user: { login: OWNER }, state: 'CHANGES_REQUESTED', commit_id: 'h' }] }],
    });
    expect(v.code).toBe(1);
  });

  it('ignores a COMMENTED review after the approval, and approvals by anyone else', () => {
    expect(decideAudit({
      files: ['scripts/x.mjs'],
      prs: [{ number: 11, headSha: 'h', reviews: [approve('h'), { user: { login: OWNER }, state: 'COMMENTED', commit_id: 'h' }] }],
    }).code).toBe(0);
    expect(decideAudit({
      files: ['scripts/x.mjs'],
      prs: [{ number: 12, headSha: 'h', reviews: [approve('h', 'kiki-claude-bot')] }],
    }).code).toBe(1);
  });

  it('REDS a hard-tier direct push to main (no PR)', () => {
    expect(decideAudit({ files: ['bin/tool'], prs: [] }).code).toBe(1);
  });
});

// ---- class C review record (detective; brief audit-review-record-class-c) ----

const BOT = 'kiki-claude-bot';
const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const PUSH = Date.parse('2026-11-01T10:00:00Z');
const AFTER = '2026-11-01T11:00:00Z';
const BEFORE = '2026-11-01T09:00:00Z';
const pack = (sha = HEAD, created_at = AFTER, login = BOT) => ({
  user: { login }, created_at, body: `Review done.\nreview-pack: https://example.com/pack head ${sha}`,
});
const labelled = (login = BOT, created_at = AFTER) => ({ event: 'labeled', label: { name: 'review-passed' }, actor: { login }, created_at });
const record = (over: Record<string, unknown> = {}) => ({ pushAnchorMs: PUSH, comments: [pack()], labelEvents: [labelled()], ...over });
const prOf = (over: Record<string, unknown> = {}) => ({ number: 42, headSha: HEAD, labels: ['review-passed'], reviews: [], ...over });
const TEST_FILE = 'tests/foo.test.ts';

type Row = [string, { files: string[]; pr: unknown; record: unknown }, { applies: boolean; ok: boolean; problem?: RegExp; skipped?: boolean }];
const rows: Row[] = [
  ['non-test file does not apply', { files: ['src/App.tsx', 'docs/x.md'], pr: prOf(), record: null }, { applies: false, ok: true }],
  ['tests file with a valid record', { files: [TEST_FILE], pr: prOf(), record: record() }, { applies: true, ok: true }],
  ['no pack comment', { files: [TEST_FILE], pr: prOf(), record: record({ comments: [] }) }, { applies: true, ok: false, problem: /no review-pack comment/ }],
  ['pack for another sha', { files: [TEST_FILE], pr: prOf(), record: record({ comments: [pack(OTHER)] }) }, { applies: true, ok: false, problem: /not for head/ }],
  ['pack posted before the push', { files: [TEST_FILE], pr: prOf(), record: record({ comments: [pack(HEAD, BEFORE)] }) }, { applies: true, ok: false, problem: /before the latest push/ }],
  ['label added by a human', { files: [TEST_FILE], pr: prOf(), record: record({ labelEvents: [labelled('123constante')] }) }, { applies: true, ok: false, problem: /was not added by kiki-claude-bot/ }],
  ['label absent', { files: [TEST_FILE], pr: prOf({ labels: [] }), record: record() }, { applies: true, ok: false, problem: /no review-passed label/ }],
  ['record API error (fail closed)', { files: [TEST_FILE], pr: prOf(), record: { error: 'GET x -> 502' } }, { applies: true, ok: false, problem: /read failed \(GET x -> 502\)/ }],
  ['record not read at all (fail closed)', { files: [TEST_FILE], pr: prOf(), record: null }, { applies: true, ok: false, problem: /not read/ }],
  ['owner-approved head is skipped', { files: [TEST_FILE], pr: prOf({ labels: [], reviews: [approve(HEAD)] }), record: null }, { applies: true, ok: true, skipped: true }],
  ['owner approval on an OLDER commit is not a skip', { files: [TEST_FILE], pr: prOf({ reviews: [approve(OTHER)] }), record: record({ comments: [] }) }, { applies: true, ok: false, problem: /no review-pack comment/ }],
];

describe('owner-approval audit -- decideRecordAudit (class C review record)', () => {
  it.each(rows)('%s', (_name, input, want) => {
    const r = decideRecordAudit(input);
    expect(r.applies).toBe(want.applies);
    expect(r.ok).toBe(want.ok);
    expect(Boolean(r.skipped)).toBe(Boolean(want.skipped));
    if (want.ok) expect(r.problems).toEqual([]);
    else expect(r.problems.join(' | ')).toMatch(want.problem as RegExp);
  });

  it('prints RECORD-MISSING with the sha8, PR number and first problem; owner skip prints its own line', () => {
    const miss = decideRecordAudit({ files: [TEST_FILE], pr: prOf(), record: record({ comments: [] }) });
    expect(recordLine('0123456789abcdef', miss)).toMatch(/^RECORD-MISSING 01234567: PR #42 class C review record: no review-pack comment/);
    const skip = decideRecordAudit({ files: [TEST_FILE], pr: prOf({ reviews: [approve(HEAD)] }), record: null });
    expect(recordLine('0123456789abcdef', skip)).toMatch(/^RECORD-SKIP 01234567: PR #42 owner-approved at head/);
    expect(recordLine('0123456789abcdef', decideRecordAudit({ files: ['src/a.ts'], pr: prOf(), record: null }))).toBeNull();
  });

  it('a mixed run returns exactly the exit code it would without the record check', () => {
    const missing = { applies: true, ok: false, problems: ['class C review record: no review-pack comment by kiki-claude-bot'] };
    const runs = [
      [{ code: 0 }, { code: 0 }],
      [{ code: 0 }, { code: 2 }],
      [{ code: 2 }, { code: 1 }, { code: 0 }],
      [{ code: 1 }, { code: 2 }],
    ];
    const want = [0, 2, 1, 1];
    runs.forEach((vs, i) => {
      expect(worstCode(vs)).toBe(want[i]);
      expect(worstCode(vs.map((v) => ({ ...v, records: [missing] })))).toBe(want[i]);
    });
  });
});
