# Brief: fix the red OG bake unit test on PR #744 (Website)

Repo 123constante/bachata-website. Read CLAUDE.md first. Never merge, never --no-verify, push once. Push ONLY to `claude/storage-callers` (PR #744, head 44ed4e7); you are the only worker on it. Read `docs/briefs/storage-callers-v2-handover.md` on that branch first.

## Problem
CI job `unit (Europe/London, full)` on #744 fails with exactly one test: `tests/ogFactsTagFlagOn.test.ts > api.og.bake.tsx action, for real, with the flag on > a real bake POST with the flag on completes 200, driven by th...`. Everything else passes (6085). The v2 change made the OG baker (app/lib/ogUpload.ts, app/routes/api.og.bake.tsx) sign uploads with the service-role key and the exact Content-Type, and to return null with a loud log when the key env var is missing. Also known and NOT yours: ~15 other unit failures in 4 files exist on main as well (eventViewCompat.contract, integrityCouldNotRun, occurrenceProgram.contract, publicEventPageLineup.contract); compare against main and ignore those.

## Task
1. Reproduce the one failure locally (vitest, that file only) and read the failure message in full.
2. Decide whether the test or the code is wrong. If the test's environment does not provide the service key the baker now requires, fix the test setup (set the env var in the test, assert the bearer is the service key and that the PUT carries the signed Content-Type). If the code regressed the flag-on path (for example a missing key now aborts a bake that used to complete), fix the code and keep the loud-log behaviour. Do not weaken an assertion without saying why in the PR.
3. Run the whole unit job exactly as the workflow does, and the new/changed tests red-first where applicable. Report any failure that also fails on main separately.
4. Push once. Keep the PR body sections intact (`## Verified on real data` with its three lines and the Phone QA section); only append a short "OG test fix" note.

## Output
New head SHA, the unit job result (failures named, split into ours vs on-main), honest Verified / Not verified. Stop after the push.
