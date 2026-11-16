# Self-test: merge tiers on main (read-only, MERGE_TIERS_ENABLED untouched)

Ticket dt_e8004f60f70e. Checkout: origin/main at `c37a8cb` (after #1725 and #1726). No product code,
workflow or variable was changed.

## Self-test: FAIL

The only FAIL is step 7's docs-only expectation, and it looks like the brief is wrong rather than the
code. See the note under step 7.

## Steps

1. PASS: vitest on mergeTier / automationMoney / automationPauseWorkflows / automationRegister: 4 files, 273 tests passed, exit 0.
2. PASS: `node scripts/check-workflow-artifact-policy.mjs` exit 0 (says it does not cover 1 upload conditioned on a matrix leg).
3. PASS: `node scripts/check-secrets-register.mjs`: `secrets-register: OK -- 48 workflows, 73 jobs, 24 secret(s) read, 29 register entries, 0 self-hosted runners, 1 routed job(s) trust-gated.`
4. NOT VERIFIED: `node scripts/owner-approval-audit.mjs` exit 2: `INFRA: need <sha>, GITHUB_REPOSITORY and GH_TOKEN` (needs GitHub env; not run with a token here).
5. PASS: `cmp` shows docs/proposals/auto-merge-on-open.yml and revert-on-red.yml are byte-identical to .github/workflows/ (both exit 0).
6. PASS (mutant killed): in a scratch worktree, deleting the `scripts/owner-approval-audit.mjs` glob from .github/automation/guard-paths.json made `fileTier` return `B`, and tests/mergeTier.test.ts FAILED (3 tests), e.g. `FAIL ... > scripts/owner-approval-audit.mjs -> A` `AssertionError: expected 'B' to be 'A'`. The worktree was reverted and removed, and nothing from it was pushed.
7. FAIL on the docs-only line only:
   - FAIL: docs-only `["docs/x.md","README.md"]` -> `C`. The brief expects A or B. But the code rule (`C  auto-merge on green: everything else`, scripts/lib/merge-tier.mjs header) and the existing tests (`docs/secret-santa.md -> C`, `docs/environment.md -> C`) both say docs-only is C by design. So the brief's expectation looks inverted. Owner to confirm.
   - PASS: `["docs/x.md","package.json"]` -> B (not lowest)
   - PASS: `["vercel.json"]` -> B
   - PASS: `["supabase/functions/x/index.ts"]` -> B
   - PASS: price `src/lib/price.ts` -> A; payment `src/payment/x.ts` -> A; promo `src/components/PromoBanner.tsx` -> A; fee `src/lib/fees.ts` -> A

## Handover

- Done: steps 1-7 run on main `c37a8cb`. This doc is the only file changed.
- Left: step 4 needs a run with `GITHUB_REPOSITORY` + `GH_TOKEN` + a sha. The owner needs to decide whether docs-only should be C (as coded) or the brief is right.
- tsc: not run, because this is a docs-only change with no TS files touched.
