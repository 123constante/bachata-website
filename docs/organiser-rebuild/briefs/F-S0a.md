# Fix brief F-S0a -- one fix pass on slice S0a (shell), three SHOULDs and nothing else

Line 1 of the rule: read `docs/organiser-rebuild/briefs/00-COMMON.md` first (branch `arc/briefs-organiser-r1`: `git fetch origin arc/briefs-organiser-r1`, then `git show FETCH_HEAD:docs/organiser-rebuild/briefs/00-COMMON.md`). It binds you in full (plain git, no variables or loops in shell commands, every CI job step run, per-job table, context 25%/30%, handover).

Repo `123constante/bachata-website`. You are the FIX worker for slice S0a. Work and push ONLY on `claude/org-r1-shell` (it exists; head `ecfe6b38`). One independent review found 0 BLOCKING, 3 SHOULD, 6 NOTE. Read the review first: `git fetch origin claude/org-r1-review-S0a` then `git show FETCH_HEAD:docs/organiser-rebuild/reviews/REVIEW-S0a.md`. Also read the author's handover on your branch: `docs/organiser-rebuild/handovers/S0a.md`.

## Scope: exactly these three edits, no other file, no other finding

NOTES 1-6 and SHOULD-3b are NOT yours (the orchestrator owns them). Do not touch the e2e specs, do not change the `'deleted'` or `'signed-out'` rendering, do not touch the `noHandBuiltLinks` allowlist, do not rename `:userId`. If you believe a fourth change is needed, stop and say so in the handover; do not make it.

### SHOULD-1 -- bottom safe area lost on screens without an action bar
File `src/modules/organiser/shell/OrganiserShell.tsx` (the `org-content` scroller, review cites line 108; the action bar carries the safe-area padding at line 126). On main the removed TabBar carried `paddingBottom: env(safe-area-inset-bottom)`. Fix: give the `org-content` scroller `style={{ paddingBottom: actionBar ? undefined : 'env(safe-area-inset-bottom)' }}` (merge with any style it already has; do not drop an existing one). Add a `routes.test.tsx` case asserting that the scroller carries that paddingBottom when `actionBar` is absent and does NOT when `actionBar` is present. Chromium reports `env(safe-area-inset-bottom)` as 0, so assert the inline style string, not a measured pixel.

### SHOULD-2 -- `paths.test.ts` does not prove `encodeURIComponent` on `addDate`'s `date`
File `src/modules/organiser/shell/__tests__/paths.test.ts`. Set the test's day constant to `'day 1'` and expect `addDate` to return `'/account/o/add/s%201/day%201'` (use the series id the file already uses with a space so BOTH arguments are proven encoded; if the file's series constant has no characters to encode, change it to one that has, e.g. `'s 1'`, and update every expectation in that file that uses it). The `routes.test.tsx` row `/account/o/add/s1/day-1` stays as is.
**RED FIRST (mandatory, paste it in the handover):** make the test change, then apply this mutant to `shell/paths.ts` only to prove the test can fail: `addDate` built as `.../${id(seriesId)}/${date}` (no encode on `date`). Run `npx vitest run src/modules/organiser/shell/__tests__/paths.test.ts`: it MUST fail (paste the failing output). Revert the mutant (`git checkout -- src/modules/organiser/shell/paths.ts` BEFORE your SHOULD-3a edit, or revert by hand), run again: green. The mutant is never committed.

### SHOULD-3a -- delete the uncalled `profile` alias
File `src/modules/organiser/shell/paths.ts` (review cites lines 64-65) and its line in `paths.test.ts`. `ORG_PATHS.profile` has no caller anywhere in `src/` or `tests/` (re-run `grep -rn "ORG_PATHS.profile" src tests` and quote the empty result in the handover; if there IS a caller, stop and report). Delete the `profile` alias and its test expectation. KEEP the `/account/o/profile` legacy route and `moduleLegacyPath('profile')` exactly as they are (bookmarks). Keep the `newEvent` and `date` aliases: their owner slices are assigned by the orchestrator.

## Done means
- `npx vitest run src/modules/organiser/shell` green (was 67 tests; report the new count), plus the full set of CI job steps the common header lists (typecheck steps, unit tests offline, lint, architecture-guard steps, `npm run build` and the perf-budget checks, e2e-smoke for the organiser layout and legacy-redirect specs). `npm run test:e2e` still shows the S8-owned reds named in review NOTE-1 (`organiser-home.spec.ts` x3, `organiser-events.spec.ts:257`, `organiser-loop.spec.ts:14`) and nothing new; compare against `origin/claude/org-r1-shell` @ `ecfe6b38`, not against main.
- Handover `docs/organiser-rebuild/handovers/F-S0a.md` on `claude/org-r1-shell`: done / left / the RED-first output for SHOULD-2 / per-job CI table / Verified / Not verified.
- Last commit subject ends `[worker-done <ticket>]` (the dispatch prompt carries the ticket). One commit is fine; keep the commits to the three files above plus the handover and the new test case.
