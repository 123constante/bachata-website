# Brief: admin PR #1576 raffle, merge main and assign real migration versions (careful lane, continuation)
Branch: claude/profile-dash-organiser-raffle-build (head 62178df). Repo bachata-admin. Push to this branch only; the PR is #1576.

## State
Review PASS carries forward (delta cc84c80..62178df is merge-only). Reds doc-budget / docs-cap are runner artefacts; the npm fix landed on main 21:37Z. migration-version-fresh is pending.

## Do
1. Merge current origin/main into the branch (no rebase).
2. Run `node scripts/assign-migration-versions.mjs` (placeholders 99990101000000 and 99990102000003 become real versions); commit.
3. Confirm the migration files still match what the review passed (diff only versions/filenames). If anything else changed, say so in the handover.
4. Run the repo checks, put the per-job CI table in the PR. Report any red that is also red on main separately.
5. Do NOT apply to prod. Do NOT merge. Raffle open/close stays a hard stop. Push once, then write the handover. Supabase read-only.
