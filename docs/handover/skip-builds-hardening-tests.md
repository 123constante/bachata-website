# Handover: skip-builds-by-diff hardening tests (PR #1295 review F1, F2)

Tests only; nothing under `scripts/` changed.

- F1: `tests/vercelIgnoreBuild.test.ts` new row "glob-only deletion" (tsconfig.json + tsconfig.app.json seeded, only the second deleted, expect BUILD).
  Mutant: `set -f` commented out of `scripts/vercel-ignore-build.sh` -> row RED (got SKIP, want BUILD); 1 failed | 80 passed. Reverted. Unmutated: green.
- F2: `tests/buildRule.test.ts` new test `expect(sh).toMatch(/^BUILD_PATHS='[^']*'$/m)`.
  Mutant: last line of the literal changed to `...vercel-ignore-build.sh'" extra"` -> test RED; 1 failed. Reverted. Unmutated: green.
- Unmutated run of both files: 81 passed.

Not verified: no UI involved; see CI for the full lint chain.
