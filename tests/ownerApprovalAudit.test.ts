import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs script, no types
import { decideAudit, decideRecordAudit, worstCode, recordLine, reviewerDocAtHead, reviewDocNameRe } from '../scripts/owner-approval-audit.mjs';

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

  it('passes a hard-tier change with a reviewer success status by the reviewer account', () => {
    const st = { context: 'hard-tier-review', state: 'success', creator: { id: 336045711 } };
    const v = decideAudit({ files: ['scripts/ship-gate.mjs'], prs: [{ number: 9, headSha: 'h9', reviews: [], statuses: [st] }] });
    expect(v.code).toBe(0);
  });

  it('REDS when the reviewer status is failure, pending, absent, or set by someone else', () => {
    const mk = (state: string, id: number) => ({ context: 'hard-tier-review', state, creator: { id } });
    for (const statuses of [
      [mk('failure', 336045711)],
      [mk('pending', 336045711)],
      [mk('success', 1)],
      [{ context: 'other', state: 'success', creator: { id: 336045711 } }],
      [],
    ]) {
      expect(decideAudit({ files: ['scripts/ship-gate.mjs'], prs: [{ number: 9, headSha: 'h9', reviews: [], statuses }] }).code).toBe(1);
    }
  });

  it('uses the NEWEST status by created_at, whatever the list order', () => {
    const ok = { id: 1, created_at: '2026-01-01T00:00:00Z', context: 'hard-tier-review', state: 'success', creator: { id: 336045711 } };
    const bad = { id: 2, created_at: '2026-01-02T00:00:00Z', context: 'hard-tier-review', state: 'failure', creator: { id: 336045711 } };
    for (const statuses of [[ok, bad], [bad, ok]]) {
      expect(decideAudit({ files: ['scripts/ship-gate.mjs'], prs: [{ number: 9, headSha: 'h9', reviews: [], statuses }] }).code).toBe(1);
    }
  });

  it('never lets the reviewer status cover a guard path, with escalation on or off', () => {
    const st = { context: 'hard-tier-review', state: 'success', creator: { id: 336045711 } };
    for (const escalation of [false, true]) {
      const v = decideAudit({ files: ['.github/automation/guard-paths.json'], prs: [{ number: 9, headSha: 'h9', reviews: [], statuses: [st] }], escalation });
      expect(v.code).toBe(1);
    }
  });

  it('never lets the reviewer status cover a mixed commit (hard file plus a guard file that is not hard-tier), escalation off', () => {
    const st = { context: 'hard-tier-review', state: 'success', creator: { id: 336045711 } };
    const v = decideAudit({ files: ['scripts/ship-gate.mjs', 'CLAUDE.md'], prs: [{ number: 9, headSha: 'h9', reviews: [], statuses: [st] }], escalation: false });
    expect(v.code).toBe(1);
  });

  it('breaks a created_at tie by id (higher id wins)', () => {
    const t = '2026-11-15T10:00:00Z';
    const ok = { id: 5, context: 'hard-tier-review', state: 'success', created_at: t, creator: { id: 336045711 } };
    const bad = { id: 6, context: 'hard-tier-review', state: 'failure', created_at: t, creator: { id: 336045711 } };
    for (const statuses of [[ok, bad], [bad, ok]]) {
      expect(decideAudit({ files: ['scripts/x.mjs'], prs: [{ number: 9, headSha: 'h9', reviews: [], statuses }] }).code).toBe(1);
    }
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

describe('owner-approval audit -- reviewer doc evidence', () => {
  const HEAD = 'a'.repeat(7) + 'b'.repeat(33);
  const doc = (verdict: string, hard: string, at = '2026-11-17T10:00:00Z', sha = HEAD.slice(0, 9), name = 'b:review-5.md') => ({
    name, committedAt: at, text: `# Review 5: PR #5 at ${sha}, hard tier\n\n## Verdict: ${verdict}\n\nbody\n\n## Hard-tier: ${hard}\n`,
  });
  const good = (over: Partial<ReturnType<typeof doc>> = {}) => ({ ...doc('PASS - ok', 'PASS'), ...over });
  const pr = (reviewDocs: unknown[], extra = {}) => ({ number: 5, headSha: HEAD, mergedAt: '2026-11-17T11:00:00Z', reviews: [], statuses: [], reviewDocs, ...extra });
  const files = ['scripts/x.mjs'];

  it('passes hard-tier and guard paths with a reviewer PASS doc naming the head (short or full sha)', () => {
    expect(decideAudit({ files, prs: [pr([good()])] }).code).toBe(0);
    expect(decideAudit({ files, prs: [pr([doc('PASS', 'PASS', undefined, HEAD)])] }).code).toBe(0);
    expect(decideAudit({ files: ['.github/workflows/phone-qa.yml'], prs: [pr([good()])] }).code).toBe(0);
    expect(decideAudit({ files: ['.github/workflows/phone-qa.yml'], prs: [pr([good()])], escalation: true }).escalate).toBe(false);
  });
  it('REDS with no evidence, doc for an older sha, FAIL, no hard-tier heading, committed after merge, no merged_at', () => {
    for (const docs of [[], [doc('PASS', 'PASS', undefined, '1234567')], [doc('BLOCK', 'PASS')], [doc('PASS', 'FAIL')], [doc('PASS', 'PASS-pending')], [good({ committedAt: '2026-11-17T12:00:00Z' })], [good({ committedAt: 'x' })]]) {
      expect(decideAudit({ files, prs: [pr(docs)] }).code).toBe(1);
    }
    expect(decideAudit({ files, prs: [pr([good()], { mergedAt: undefined })] }).code).toBe(1);
    expect(reviewerDocAtHead(pr([good()], { headSha: 'short' }))).toBe(false);
  });
  it('the NEWEST doc for the head decides: a later FAIL voids an earlier PASS, a later PASS clears a FAIL', () => {
    const early = good({ committedAt: '2026-11-17T09:00:00Z' });
    const lateFail = doc('BLOCK', 'FAIL', '2026-11-17T10:00:00Z', undefined, 'b2:review-5b.md');
    expect(decideAudit({ files, prs: [pr([early, lateFail])] }).code).toBe(1);
    expect(decideAudit({ files, prs: [pr([lateFail, good({ committedAt: '2026-11-17T10:30:00Z' })])] }).code).toBe(0);
  });
  it('ignores a PASS heading inside a code fence and a sha only deep in the body', () => {
    const fenced = { name: 'b:review-5.md', committedAt: '2026-11-17T10:00:00Z', text: `# Review at ${HEAD.slice(0, 9)}\n\n## Verdict: PASS\n\n\`\`\`\n## Hard-tier: PASS\n\`\`\`\n` };
    const deep = { name: 'b:review-5.md', committedAt: '2026-11-17T10:00:00Z', text: `# Review\n\n\n\n\n\nsee ${HEAD.slice(0, 9)}\n## Verdict: PASS\n## Hard-tier: PASS\n` };
    expect(decideAudit({ files, prs: [pr([fenced])] }).code).toBe(1);
    expect(decideAudit({ files, prs: [pr([deep])] }).code).toBe(1);
  });
  it('never covers money, SQL or secret paths', () => {
    for (const f of ['supabase/migrations/1.sql', '.env.production', 'supabase/functions/stripe-webhook/index.ts']) {
      expect(decideAudit({ files: [f, 'scripts/x.mjs'], prs: [pr([good()])] }).code).toBe(1);
    }
  });
  it('skips the class C record line when the reviewer PASS doc stands', () => {
    const r = decideRecordAudit({ files: ['tests/a.test.ts'], pr: pr([good()]), record: null });
    expect(r.skipped).toBe(true);
    expect(recordLine('0123456789', r)).toContain('RECORD-SKIP');
  });
});

describe('owner-approval audit -- bot Hard-tier PASS marker', () => {
  const HEAD = 'a'.repeat(40);
  const OLD = 'b'.repeat(40);
  const files = ['scripts/owner-approval-audit.mjs'];
  const pass = (sha: string, login = 'kiki-claude-bot') => ({ user: { login }, body: `ok\nHard-tier PASS at ${sha}\n` });

  it('owner approve at head stays green', () => {
    expect(decideAudit({ files, prs: [{ number: 1, headSha: HEAD, reviews: [approve(HEAD)] }] }).code).toBe(0);
  });
  it('PASS comment at head is green and names the path', () => {
    const v = decideAudit({ files, prs: [{ number: 2, headSha: HEAD, reviews: [], comments: [pass(HEAD)] }] });
    expect(v.code).toBe(0);
    expect(v.reason).toContain('Hard-tier PASS');
  });
  it('PASS in a bot review body at head is green', () => {
    expect(decideAudit({ files, prs: [{ number: 3, headSha: HEAD, reviews: [pass(HEAD)], comments: [] }] }).code).toBe(0);
  });
  it('PASS at an OLD head is RED', () => {
    expect(decideAudit({ files, prs: [{ number: 4, headSha: HEAD, reviews: [], comments: [pass(OLD)] }] }).code).toBe(1);
  });
  it('PASS by another login is RED', () => {
    expect(decideAudit({ files, prs: [{ number: 5, headSha: HEAD, reviews: [], comments: [pass(HEAD, 'someone-else')] }] }).code).toBe(1);
  });
  it('a PASS that is not an exact line is RED', () => {
    const c = { user: { login: 'kiki-claude-bot' }, body: `not Hard-tier PASS at ${HEAD} really` };
    expect(decideAudit({ files, prs: [{ number: 6, headSha: HEAD, reviews: [], comments: [c] }] }).code).toBe(1);
  });
  it('no PR is RED', () => {
    expect(decideAudit({ files, prs: [] }).code).toBe(1);
  });
  it('botLogin param overrides the default', () => {
    expect(decideAudit({ files, botLogin: 'other-bot', prs: [{ number: 7, headSha: HEAD, reviews: [], comments: [pass(HEAD, 'other-bot')] }] }).code).toBe(0);
  });
});

describe('owner-approval audit -- review doc file names', () => {
  it.each(['1747.md', 'review-1748.md', 'review-1748b.md', 'pr-1747-review.md', 'pr-1741.md', '1741-round2.md'])('accepts %s for its own PR', (name) => {
    const n = name.match(/\d{4}/)![0];
    expect(reviewDocNameRe(n).test(name)).toBe(true);
  });
  it.each([['review-17470.md', '1747'], ['pr-11747.md', '1747'], ['pr-1747.txt', '1747'], ['onboard-a-1763.md', '1763'], ['review-1748.md', '1747']])('rejects %s for PR %s', (name, n) => {
    expect(reviewDocNameRe(n).test(name)).toBe(false);
  });
});
