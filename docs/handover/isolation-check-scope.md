# Handover: scope the dancer-area isolation check (brief isolation-scope-fix)

Ticket dt_ccc7ae84cafa. Branch `claude/isolation-check-scope` from `origin/main` @ 2260d46.

## What changed (files)
- `scripts/check-dancer-area-isolation.mjs`: the check now decides a MODE from the changed-file list.
  A PR that changes (adds, edits or deletes) at least one file under `src/modules/dancer-app/` is a
  dancer-area PR and runs rules a+b+c as before. Any other PR runs rule (c) only (nothing outside the
  seams imports the module). It prints `dancer-area PR: rules a+b+c` or `not a dancer-area PR: rule c only`.
  Self-test grows from 53 to 60 cases; the old (a) cases now also change a folder file so they stay red.
- `docs/handover/isolation-check-scope.md`: this file.

## Decisions and INTERFACE deviations
- Letter mapping. The brief's (a) "only folder files + seams" and (b) "protected byte-identical" are BOTH
  halves of the script's rule (a). The script's own (b) (folder never imports a legacy dancer screen) is
  also skipped on a non-dancer PR so the printed line "rule c only" is literally true. Skipping it is
  lossless: (b) reads only folder files, and a PR that changes none of them leaves them as main has them.
- The protected-list existence check (a protected glob matching no file = exit 2) still runs in both
  modes: it is a configuration check, not a PR rule.
- No INTERFACE deviation; seams and protected lists untouched.

## Shapes surveyed
Guard-only change: no DB read, no UI. The "shapes" are PR diff shapes, each a self-test case:
only a site page; only a protected file; folder file alone; folder + non-seam page; folder file deleted +
non-seam page; non-dancer page importing the module; every protected file with a folder change.

## Red-first proof
Case `not a dancer-area PR: only src/pages/Privacy.tsx changes` added BEFORE the fix, on main's logic:
`FAIL ... expected exit 0 naming not a dancer-area PR: rule c only, got 1`
`(a) changed file is neither inside src/modules/dancer-app/, nor a test, nor a seam: src/pages/Privacy.tsx`
Kept red after the fix: `(a) dancer-area PR: src/modules/dancer-app/x.tsx + src/pages/Other.tsx` (exit 1),
`(c) not a dancer-area PR: src/pages/Other.tsx imports src/modules/dancer-app/x` (exit 1).

## #762 run
`origin/claude/site-legal-pages` (256c18d) merged with this branch in a throwaway worktree,
`DANCER_ISOLATION_BASE=origin/main node scripts/check-dancer-area-isolation.mjs`:
`15 changed file(s); protected files not checked. / not a dancer-area PR: rule c only / dancer-area isolation: OK`, exit 0.

## CI per-job table (run in sandbox)
| Job / step | Command | Exit | Result |
|---|---|---|---|
| unit-tests.yml dancer-area-isolation: self-test | `node scripts/check-dancer-area-isolation.mjs --self-test` | 0 | 60 cases, all behave |
| unit-tests.yml dancer-area-isolation: check | `npm run check:dancer-area-isolation` | 0 | OK (rule c only on this branch) |
| typecheck | `npm run typecheck` | n/a | 96 `error TS` lines, under the pre-ship baseline 106 (pre-existing; script is .mjs, not in the TS project) |
| lint chain | `npm run lint` | 1 | 15/16 PASS; `check:integrity` exit 126 = `bin/check-integrity.sh` is mode 100644 in git (pre-existing on main, sandbox has no exec bit). Run as `bash bin/check-integrity.sh`: 0 issues, exit 0 |
| related unit tests | `vitest run tests/client/dancerAppReviewFixes.test.ts` | 0 | 97 passed |
| entry-point proof | `node scripts/prove-entry-point-dispatch.mjs` | 0 | 43 entry points proven |
| unit suite | `npm run test:unit` | 1 | 15 failed in 4 DB-contract files ("Invalid API key": no Supabase key in sandbox); identical with main's script |

## 390x844 walk
N/A: no UI change.

## Verified / Not verified
- Verified: self-test 60/60; red-first case failed on old logic; #762 diff gives 0 violations; this branch's own check green.
- NOT verified: real GitHub Actions run (billing-blocked runners per COMMON); DB contract tests (no key);
  pre-push receipt gate (`.githooks` not executable in this sandbox checkout).

## What is left
Nothing for this slice. Owner/orchestrator: merge this before #762 (or merge main into #762 after).
