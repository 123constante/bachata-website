# FIX: festivalClientState regression on PR #821 (Website, branch claude/dancer-app-r1b; you are the ONLY worker on it). Model: Sonnet.
Read dancer-rebuild-COMMON.md (briefs branch arc/briefs-dancer-rebuild: `git fetch origin arc/briefs-dancer-rebuild`, `git show FETCH_HEAD:briefs/dancer-rebuild-COMMON.md`).

## The failure (in the owner's words: "one real test fails on GitHub")
GitHub unit job (run 39046317520, head ecd66803) fails exactly ONE test:
`tests/client/festivalClientState.test.tsx` > "client: a festival-to-festival navigation, through the REAL route > shows no frame carrying the previous festival day" -> `AssertionError: expected +0 to be 2`.
The last 4 unit runs on `main` are green. The same test also failed on the S1 lock branch, so the cause is S1's change to `src/pages/FestivalHub.tsx` (Going lock via `useGoingLock`, "lock shown once above the list", tap stopPropagation) or to what it imports. The previous finisher saw it fail in its sandbox, ran the file alone, saw it pass and wrongly called it flaky. It is NOT flaky: it fails in CI's full run.

## Do (only this)
1. `git diff origin/main -- src/pages/FestivalHub.tsx` and read the test. Find what the lock change does that breaks the "no frame with the previous festival day" behaviour (likely a hook/state added on the page that survives navigation, or a render before the new festival's data).
2. Reproduce red FIRST the way CI runs it: the full `npm run test:unit:offline` (TZ=Europe/London, same env values as `.github/workflows/unit-tests.yml`), or the whole `tests/client` directory with the same parallelism, not the file alone. Quote the failing output. If it only fails in the full run, say what ordering/state it depends on.
3. Fix the PRODUCT code (FestivalHub or the lock hook), never the test or its expectation. The Going lock behaviour and its tests must stay green (`gate/__tests__/goingLock.test.tsx`, `tests/client/rsvpBlock.test.tsx`).
4. Run the full unit job as CI does plus `check:dancer-area-isolation`, `check:bundle-budget`, `npm run build`. Per-job table in your handover `docs/handover/dancer-rebuild-b1b-festival-fix.md`.
5. ONE push to `claude/dancer-app-r1b`; last commit subject ends `[worker-done <ticket>]`. No PR (PR #821 exists), no merge. Stop after the push. Plain git, no `gh api`, no variables/loops in shell commands. Never pass 30% context.
