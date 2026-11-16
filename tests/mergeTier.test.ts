import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs script, no types
import { classifyTier, fileTier, mergeTiersEnabled, hasSelfReview } from '../scripts/lib/merge-tier.mjs';
// @ts-expect-error -- plain .mjs script, no types
import { isGuardPath } from '../scripts/lib/guard-paths.mjs';
// @ts-expect-error -- plain .mjs script, no types
import { decideAudit } from '../scripts/owner-approval-audit.mjs';

describe('merge tiers -- classifyTier', () => {
  it.each([
    ['src/App.tsx', 'C'],
    ['README.md', 'C'],
    ['docs/changelog-archive-2026.md', 'C'],
    ['docs/automerge.md', 'A'],
    ['tests/foo.test.ts', 'C'],
    ['scripts/ship-gate.mjs', 'B'],
    // slice 4a #1: the tier code and its test are guard paths now
    ['scripts/lib/merge-tier.mjs', 'A'],
    ['scripts/lib/review-scope.mjs', 'A'],
    ['tests/mergeTier.test.ts', 'A'],
    // slice 4a #2: widened money set (each new pattern, file and directory form)
    ['src/lib/priceFormat.ts', 'A'],
    ['src/components/price/Tag.tsx', 'A'],
    ['src/components/PaymentSummary.tsx', 'A'],
    ['src/payments/index.ts', 'A'],
    ['src/lib/promoCode.ts', 'A'],
    ['src/promo-codes/List.tsx', 'A'],
    ['src/lib/fees.ts', 'A'],
    ['src/fee-rules/x.ts', 'A'],
    // *fee* is a deliberate over-match (fail closed): feedback paths are A too
    ['src/components/FeedbackForm.tsx', 'A'],
    // slice 4a #2: deploy/build config and non-ticket edge functions are B
    ['package.json', 'B'],
    ['vercel.json', 'B'],
    ['vite.config.ts', 'B'],
    ['supabase/functions/og-image/index.ts', 'B'],
    ['supabase/functions/ticket-checkout/index.ts', 'A'],
    ['supabase/functions/stripe-webhook/index.ts', 'A'],
    ['src/package.json', 'C'],
    ['docs/vite.config.ts.md', 'C'],
    ['bin/x.sh', 'B'],
    ['.github/automation/guard-paths.json', 'A'],
    ['.github/workflows/e2e-smoke.yml', 'A'],
    ['scripts/owner-approval-audit.mjs', 'A'],
    ['supabase/migrations/20261115000000_x.sql', 'A'],
    ['scripts/fix.sql', 'A'],
    ['.env.local', 'A'],
    ['scripts/rotate-secret.mjs', 'B'],
    // fix1 #5: secrets by basename / whole segment / whole stem
    ['.env', 'A'],
    ['.env.production', 'A'],
    ['config/.envrc', 'A'],
    ['deploy/env.production', 'A'],
    ['src/secrets/keys.json', 'A'],
    ['src/config/secret.ts', 'A'],
    ['secrets.json', 'A'],
    ['docs/secret-santa.md', 'C'],
    ['src/components/SecretMenu.tsx', 'C'],
    ['docs/environment.md', 'C'],
    ['src/lib/envelope.ts', 'C'],
    ['src/lib/ticketBookingFee.ts', 'A'],
  ])('%s -> %s', (p, t) => {
    expect(classifyTier([p])).toBe(t);
  });

  it('the highest tier of any file wins', () => {
    expect(classifyTier(['src/App.tsx', 'scripts/ship-gate.mjs'])).toBe('B');
    expect(classifyTier(['scripts/ship-gate.mjs', 'supabase/migrations/x.sql', 'src/App.tsx'])).toBe('A');
  });

  it('fails closed: no files, a non-string or an unsafe path is A', () => {
    expect(classifyTier([])).toBe('A');
    expect(classifyTier(null)).toBe('A');
    expect(classifyTier([42])).toBe('A');
    expect(classifyTier(['../etc/passwd'])).toBe('A');
  });

  it('an unreadable money set is A', () => {
    expect(fileTier('src/App.tsx', { moneySet: null })).toBe('A');
  });

  it('a file object is money-scanned on its changed lines, and a missing patch fails closed', () => {
    expect(classifyTier([{ filename: 'src/App.tsx', patch: '@@ -1 +1 @@\n+const x = 1;', changes: 1 }])).toBe('C');
    expect(classifyTier([{ filename: 'src/App.tsx', changes: 3 }])).toBe('A');
    expect(classifyTier([{ filename: 'src/x.ts', previous_filename: '.github/automation/guard-paths.json', changes: 0 }])).toBe('A');
  });

  it('every guard path is A, never B (reuses isGuardPath, no second list)', () => {
    for (const p of ['.github/workflows/owner-approval.yml', '.claude/settings.json', 'scripts/lib/guard-paths.mjs']) {
      expect(isGuardPath(p)).toBe(true);
      expect(classifyTier([p])).toBe('A');
    }
  });

  it('MUTANT: a classifier that ignores the guard check downgrades a guard path to B (so the real one must not)', () => {
    const mutant = (files: string[]) => classifyTier(files, { isGuardPath: () => false });
    expect(mutant(['scripts/owner-approval-audit.mjs'])).toBe('B');
    expect(classifyTier(['scripts/owner-approval-audit.mjs'])).not.toBe(mutant(['scripts/owner-approval-audit.mjs']));
  });

  it('hasSelfReview needs the heading AND content under it', () => {
    expect(hasSelfReview('## Self-review\r\n- read every hunk')).toBe(true);
    expect(hasSelfReview('## Self-review\n')).toBe(false);
    expect(hasSelfReview('## Self-review\n\n## Phone QA\n- x')).toBe(false);
    expect(hasSelfReview('Self-review: done')).toBe(false);
    expect(hasSelfReview(null)).toBe(false);
  });

  it.each([
    ['<!-- fill this in -->'],
    ['-'],
    ['TODO'],
    ['- TODO'],
    ['n/a'],
    ['None'],
    ['tbd'],
    ['- ok, done'],
    ['<!--\nmulti-line comment that is long enough\n-->'],
  ])('fix1 #2: a placeholder self-review body fails: %j', (b) => {
    expect(hasSelfReview(`## Self-review\n${b}\n\n## Next\nlong enough text here`)).toBe(false);
  });

  it('fix1 #2: a real line after placeholders passes', () => {
    expect(hasSelfReview('## Self-review\n<!-- note -->\nTODO\n- read every hunk of the diff\n')).toBe(true);
  });

  it('the flag is on only for the exact string true', () => {
    expect(mergeTiersEnabled({ MERGE_TIERS_ENABLED: 'true' })).toBe(true);
    for (const v of [undefined, '', 'TRUE', '1', 'yes', 'false']) expect(mergeTiersEnabled({ MERGE_TIERS_ENABLED: v })).toBe(false);
  });
});

describe('owner-approval audit -- merge tiers flag', () => {
  const unapproved = [{ number: 8, headSha: 'h1', reviews: [] }];

  it('flag OFF: a tier-B commit without approval is RED, exactly as today', () => {
    const off = decideAudit({ files: ['scripts/ship-gate.mjs'], prs: unapproved });
    expect(off.code).toBe(1);
    expect(decideAudit({ files: ['scripts/ship-gate.mjs'], prs: unapproved, mergeTiers: false })).toEqual(off);
    expect(decideAudit({ files: ['scripts/ship-gate.mjs'], prs: unapproved, mergeTiers: 'true' })).toEqual(off);
  });

  const SHA = 'a'.repeat(40);
  const reviewed = [{ number: 10, headSha: 'h3', reviews: [], author: 'kiki-claude-bot', mergeCommitSha: SHA, body: '## Summary\nx\n\n## Self-review\n- checked every hunk of the diff\n' }];

  it('flag ON: a tier-B commit from a PR with a recorded self-review is OK without approval', () => {
    const v = decideAudit({ files: ['scripts/ship-gate.mjs', 'src/App.tsx'], prs: reviewed, mergeTiers: true, sha: SHA });
    expect(v.code).toBe(0);
    expect(v.reason).toContain('merge tier B');
  });

  it('flag ON: a tier-B DIRECT PUSH (no PR) stays RED', () => {
    expect(decideAudit({ files: ['scripts/ship-gate.mjs'], prs: [], mergeTiers: true, sha: SHA }).code).toBe(1);
  });

  it('fix1 #1: a human (or any non-bot) author with a self-review stays RED', () => {
    for (const author of ['123constante', 'someone-else', '', undefined]) {
      expect(decideAudit({ files: ['scripts/ship-gate.mjs'], prs: [{ ...reviewed[0], author }], mergeTiers: true, sha: SHA }).code).toBe(1);
    }
  });

  it('fix1 #3: only the PR whose merge_commit_sha IS the audited sha counts', () => {
    const files = ['scripts/ship-gate.mjs'];
    const other = [{ ...reviewed[0], mergeCommitSha: 'b'.repeat(40) }];
    expect(decideAudit({ files, prs: other, mergeTiers: true, sha: SHA }).code).toBe(1);
    // a self-reviewed OTHER PR next to the real (unreviewed) one does not lend its body
    const mixed = [{ number: 11, headSha: 'h4', reviews: [], author: 'kiki-claude-bot', mergeCommitSha: SHA, body: '' }, other[0]];
    expect(decideAudit({ files, prs: mixed, mergeTiers: true, sha: SHA }).code).toBe(1);
    // no sha = no shortcut
    expect(decideAudit({ files, prs: reviewed, mergeTiers: true }).code).toBe(1);
  });

  it('flag ON: a tier-B PR without a self-review (or an empty heading) stays RED', () => {
    expect(decideAudit({ files: ['scripts/ship-gate.mjs'], prs: unapproved, mergeTiers: true, sha: SHA }).code).toBe(1);
    const empty = [{ ...reviewed[0], body: '## Self-review\n\n## Next\nx' }];
    expect(decideAudit({ files: ['scripts/ship-gate.mjs'], prs: empty, mergeTiers: true, sha: SHA }).code).toBe(1);
  });

  it('flag ON: a self-review does not lift tier A', () => {
    expect(decideAudit({ files: ['scripts/owner-approval-audit.mjs'], prs: reviewed, mergeTiers: true, sha: SHA }).code).toBe(1);
  });

  it('flag ON: tier A keeps today\'s rule (guard path RED without owner approval at head)', () => {
    const files = ['scripts/owner-approval-audit.mjs'];
    const on = decideAudit({ files, prs: unapproved, mergeTiers: true });
    expect(on).toEqual(decideAudit({ files, prs: unapproved }));
    expect(on.code).toBe(1);
    const approved = [{ number: 9, headSha: 'h2', reviews: [{ user: { login: '123constante' }, state: 'APPROVED', commit_id: 'h2' }] }];
    expect(decideAudit({ files, prs: approved, mergeTiers: true }).code).toBe(0);
  });

  it('flag ON: escalation verdicts for tier A are unchanged', () => {
    const files = ['.github/automation/guard-paths.json'];
    expect(decideAudit({ files, prs: unapproved, escalation: true, mergeTiers: true })).toEqual(decideAudit({ files, prs: unapproved, escalation: true }));
  });

  it('flag ON: tier C keeps today\'s rule (no hard path -> OK)', () => {
    expect(decideAudit({ files: ['src/App.tsx'], prs: [], mergeTiers: true }).code).toBe(0);
  });
});

describe('revert-on-red proposal (fix1 #4)', () => {
  const y = readFileSync(new URL('../docs/proposals/revert-on-red.yml', import.meta.url), 'utf8');

  it('a conflicting revert or a failed push opens an owner-turn issue and exits 0', () => {
    expect(y).toMatch(/if ! git revert --no-edit "\$SHA"; then git revert --abort \|\| true; owner_turn /);
    expect(y).toMatch(/if ! git push origin "\$BRANCH"; then owner_turn /);
    const fn = y.slice(y.indexOf('owner_turn() {'), y.indexOf('owner_turn() {') + 600);
    expect(fn).toContain('--label owner-turn');
    expect(fn).toContain('$SHA');
    expect(fn).toContain('$FAILED_WORKFLOW');
    expect(fn).toContain('exit 0');
  });

  it('the duplicate guard checks revert PRs in ANY state and issues naming the branch', () => {
    expect(y).toMatch(/pulls\.list, \{ \.\.\.context\.repo, state: 'all', head:/);
    expect(y).not.toMatch(/state: 'open'/);
    expect(y).toContain("github.request('GET /search/issues'");
  });
});
