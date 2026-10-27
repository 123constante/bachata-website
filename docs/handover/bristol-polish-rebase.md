# Handover: Bristol polish (PR #1056) brought up to main

Ticket dt_91527fb08e3b. Branch `claude/bristol-polish`.

## Done
- Merged `origin/main` (9fc14dc) into `claude/bristol-polish`. Merge commit `1075733`.
- Method: merge commit, not the brief's rebase plus force-with-lease. It keeps history intact and avoids rewriting a branch this session did not create.
- Only conflict: `src/pages/Organisers.tsx`, import block. Main added `fetchDirectoryOrganisers` / `OrgRow`; the PR added `pageCity`, `useCity`, `EmptyCityNote`. Both are kept. Nothing else conflicted, and a clean merge-tree check against main passes.
- PR #1056 `mergeable_state` moved from conflicting to `blocked` (pending checks or reviews, not a conflict).

## Checks run locally (on the merge)
- `npx tsc --noEmit`: pass.
- `npx eslint src/pages/Organisers.tsx`: pass.
- `bash bin/check-integrity.sh`: pass (2669 files, 0 issues).
- `npm run lint`: 21 of 22 links green. `check:integrity` exit 126 is a pre-existing mode issue: `bin/check-integrity.sh` is 100644 on main too. Not fixed here (out of brief scope). CI chmods it.
- `npm run test:unit -- --maxWorkers=3`: 15 failed, 15504 passed, 29 skipped.
  - 5 in `tests/integrityCouldNotRun.test.ts`: the known sandbox failures.
  - 8 in `*.contract.test.ts` (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup`): no live Supabase credentials in the sandbox ("Invalid API key").
  - 2 "plan hygiene" failures: an unrelated tool fixture (`--norender` flag).

## Left
- Checks on head `1075733` were still queued or running when this was written. Check PR #1056 for the final result.
- Owner review (not run by this session).
- Not verified: contract tests against live DB; full lint link `check:integrity` as a runnable script (mode issue); browser walks.

## Next steps
1. Once CI on `1075733` is green, PR #1056 should be mergeable. Owner or reviewer approves and merges. This session does not merge or approve.
2. Separately, make `bin/check-integrity.sh` executable on main (`git update-index --chmod=+x`), so `npm run lint` passes locally.
