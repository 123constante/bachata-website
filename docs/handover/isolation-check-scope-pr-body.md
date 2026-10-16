## Summary
Scopes `check:dancer-area-isolation`. Since #759 merged, rule (a) ("only dancer-app files + seams may change") runs on every PR, so ordinary site PRs go red (e.g. #762 Terms/Privacy: 8 violations). Now:
- a **dancer-area PR** (changes at least one file under `src/modules/dancer-app/`) runs rules a+b+c as before;
- **any other PR** runs rule (c) only: nothing outside the seams imports the module (always on).
The check prints `dancer-area PR: rules a+b+c` or `not a dancer-area PR: rule c only`.

## Scope
`scripts/check-dancer-area-isolation.mjs` (logic + self-test, 53 -> 60 cases), `docs/handover/isolation-check-scope.md`. No UI, no DB, no allow-list change.

## Supabase Source of Truth
N/A: guard-only change, no DB read or write.

## Privacy Gates (Hard Requirement)
N/A: no data surface touched.

## Visibility & Access
N/A.

## UX & System Consistency
N/A: no UI change.

## Validation Evidence
Red-first: new case `not a dancer-area PR: only src/pages/Privacy.tsx changes` on the old logic:
`FAIL ... expected exit 0 naming not a dancer-area PR: rule c only, got 1` / `(a) changed file is neither inside src/modules/dancer-app/, nor a test, nor a seam: src/pages/Privacy.tsx`. Passes after the fix.

## QA Examples (Must Fail / Must Pass)
### Must fail examples
- `src/modules/dancer-app/x.tsx` + `src/pages/Other.tsx` changed -> (a) violation, exit 1
- a folder file deleted + `src/pages/Other.tsx` changed -> (a), exit 1
- every protected file edited alongside a folder change -> (a), exit 1
- `src/pages/Other.tsx` imports `@/modules/dancer-app/x` (no folder change) -> (c), exit 1
### Must pass examples
- only `src/pages/Privacy.tsx` changed -> exit 0, `not a dancer-area PR: rule c only`
- only a protected file changed (ordinary site PR) -> exit 0
- a folder file alone -> exit 0, `dancer-area PR: rules a+b+c`

## Reviewer Sign-off
Awaiting owner review. Bot never merges or approves.

## Verified on real data (required)
### Shapes surveyed
Guard-only change: the shapes are PR diff shapes, one self-test case each (listed above). Real diff: #762 (`origin/claude/site-legal-pages` @ 256c18d) merged with this branch, `DANCER_ISOLATION_BASE=origin/main`: `15 changed file(s); protected files not checked. / not a dancer-area PR: rule c only / dancer-area isolation: OK`, **0 violations**, exit 0.
### Checks run
| Job / step | Command | Exit | Result |
|---|---|---|---|
| unit-tests.yml `dancer-area-isolation`: self-test | `node scripts/check-dancer-area-isolation.mjs --self-test` | 0 | 60 cases, all behave |
| unit-tests.yml `dancer-area-isolation`: check | `npm run check:dancer-area-isolation` | 0 | OK |
| typecheck | `npm run typecheck` | n/a | 96 errors, under pre-ship baseline 106 (pre-existing; .mjs not in TS project) |
| lint chain | `npm run lint` | 1 | 15/16 PASS; `check:integrity` exit 126 because `bin/check-integrity.sh` is mode 100644 in git (pre-existing on main). `bash bin/check-integrity.sh`: 0 issues, exit 0 |
| related tests | `vitest run tests/client/dancerAppReviewFixes.test.ts` | 0 | 97 passed |
| entry-point proof | `node scripts/prove-entry-point-dispatch.mjs` | 0 | 43 proven |
| unit suite | `npm run test:unit` | 1 | 15 failures in 4 DB-contract files ("Invalid API key", no Supabase key in sandbox); identical with main's script |
### NOT verified
- Real GitHub Actions run (billed runners intermittently blocked).
- DB contract tests (no key in sandbox).
- Pre-push receipt gate (`.githooks` not executable in this sandbox checkout).

## Phone QA
N/A: no UI change (CI guard script only), so no viewport to measure.

## DECISIONS
- The script's own rule (b) (folder never imports a legacy screen) is also skipped on a non-dancer PR, so "rule c only" is literally true; lossless, since (b) reads only folder files that such a PR does not change.
- A deleted folder file counts as a dancer-area change.
- The protected-glob existence check (exit 2 on drift) stays on in both modes: it is configuration, not a PR rule.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EU5K1u3xbAcjo6PEXywHZt
