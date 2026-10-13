# Brief: Website FIX-4b worker (checks only)

Branch `arc/event-truth-p1p3-fix4` (continue it; the first fix-4 worker ended before its checks). Never use `gh api`: read with git. Open NO PR.
Section 5 of `docs/handover/event-truth-p1p3-fix4.md` still reads CHECKS_TABLE. Do exactly this:
1. Run every no-secret step of every `pull_request` workflow as the fix-3 handover's table (unit legs incl. the two tz lists, typecheck jobs, e2e full list with the workflow env, architecture-guard integrity steps, bundle-budget build + both ratchets, the lint chain, db-contract-check no-secret steps incl. `check-event-truth-v1.mjs --self-test`), then `npm run pre-ship`. Node 22.
2. Write each step's exit code into section 5. Name environment-only reds as such against the fix-3 handover's baseline; any NEW red is yours.
3. Change NO source or test unless a step shows a new red caused by the fix-4 delta (`git diff origin/arc/event-truth-p1p3-fix3..HEAD`); if so, stop and report it before fixing.
4. Commit, push `arc/event-truth-p1p3-fix4` only, report the head SHA and the table.
