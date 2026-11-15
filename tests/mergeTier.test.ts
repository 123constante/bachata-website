import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs script, no types
import { classifyTier, fileTier, mergeTiersEnabled } from '../scripts/lib/merge-tier.mjs';
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
    ['scripts/lib/merge-tier.mjs', 'B'],
    ['bin/x.sh', 'B'],
    ['.github/automation/guard-paths.json', 'A'],
    ['.github/workflows/e2e-smoke.yml', 'A'],
    ['scripts/owner-approval-audit.mjs', 'A'],
    ['supabase/migrations/20261115000000_x.sql', 'A'],
    ['scripts/fix.sql', 'A'],
    ['.env.local', 'A'],
    ['scripts/rotate-secret.mjs', 'A'],
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

  it('flag ON: a tier-B commit without approval is OK', () => {
    const v = decideAudit({ files: ['scripts/ship-gate.mjs', 'src/App.tsx'], prs: unapproved, mergeTiers: true });
    expect(v.code).toBe(0);
    expect(v.reason).toContain('merge tier B');
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
