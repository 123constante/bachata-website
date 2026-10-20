# Brief: Website twin of the session-lock guard (admin #845), 2026-10-20

## Goal (plain words)
The admin repo merged PR #845, which changed `scripts/hooks/session-lock.mjs` (the guard-write that refuses a second session's writes, shadow mode by default). That file is a declared TWIN of the Website copy. The admin unit gate (`tests/hookSelfTests.test.ts`, "twin parity with the Website copies") now fails on plain admin `main` because the Website copy is still the old one. This blocks every admin push. Bring the Website copy to the admin version.

## The task
1. Read admin `scripts/hooks/session-lock.mjs` at admin `main` (repo `123constante/bachata-admin`). Fetch it with plain git, NOT `gh api`: `git clone --depth 1 https://github.com/123constante/bachata-admin.git` into a scratch folder outside the Website checkout, or `git fetch` from it as a second remote.
2. Make Website `scripts/hooks/session-lock.mjs` content-identical to it (the admin test compares modulo line endings; keep the Website file's existing line endings).
3. Open the admin test `tests/hookSelfTests.test.ts` (TWINS list around line 418) and check whether OTHER twin files also differ between the repos. Compare every file in that list by content (CR stripped). Sync any that differ ONLY if admin main is clearly the newer, intended version (git log both sides). If a twin differs the other way (Website newer), STOP and write it in the handover; do not overwrite.
4. Website has its own parity test or self-test for these hooks: find it (grep `session-lock` under `tests/` and `scripts/`) and run it. Run the Website's pre-push chain via a normal `git push` (never `--no-verify`).

## Boundaries
Never merge or approve; bot-authored PR; read and push with PLAIN git (no `gh api`, it stalls a cloud worker on a permission prompt); write shell commands without variables, loops or `$(...)` where a plain command works; never `--no-verify`; Supabase untouched. This is a Website-repo change: one push at the end only (Vercel Hobby cap about 100 deploys/24h); subject line may carry `[skip preview]` if Website's convention allows it (see recent commit subjects, e.g. #854).
CI rule (billing): GitHub Actions may refuse jobs with a "payments have failed / spending limit" annotation; that is not a code failure. Run every job step you can in your sandbox and put a per-job table (command, exit code) in the PR body.

## Output
ONE bot PR: `ci(hooks): sync the session-lock twin with admin #845`. PR body: before/after in plain words, the list of twin files compared and their result, per-job table, "Verified / Not verified" (NOT verified: the admin gate itself runs in the admin repo; the orchestrator re-runs it after merge). Handover note `docs/handover/session-lock-twin.md`. Last commit subject ends `[worker-done <ticket>]`. Stop after the push and the PR. Context: stay under 30%; a PARTIAL push with a handover if needed.
