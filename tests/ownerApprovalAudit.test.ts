import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs script, no types
import { decideAudit } from '../scripts/owner-approval-audit.mjs';

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
