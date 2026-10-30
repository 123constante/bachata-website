# Brief: G1 Website write-door CI guard (hard tier: scripts/**, owner Approve at PR head)

Lane: careful. Model: Opus. Website repo only. Branch: claude/g1-write-door-guard. One PR. Context cap 30%.
Stopping rule: one build, one independent review (Fable, run by the lead), one fix round, stop.

## Source
Read the design first: branch `claude/scope-g1-write-door` (PR #1189), file `docs/scoping/g1-write-door-check.md` (git fetch it). Build exactly that design: a Website CI check that every Website call site that writes events goes through a gated door, so a new ungated door cannot appear unnoticed. It reads the live guard `check_organiser_onboarding_gate_v1()` with the publishable key (read-only) and scrapes `src/` for RPC names, handling the `const rpc = (fn: string, ...)` indirection the doc lists.

## Timing
The admin gate migration (PR #1141, nine doors incl. admin_bulk_occurrence_command_p5) is NOT applied yet; the lead applies it today. Build and test the check against fixtures and against the live guard as it is now; the check must tolerate 6 gated now and 9 after the apply (derive counts from the guard's own gated list, never pin 6 or 9). Do not hard-fail on `admin_bulk_occurrence_command_p5` until the guard lists it: write the check so it is red only for a Website call site whose RPC is neither in the guard's gated list nor its allow-list nor a known read; and record the bulk door as an expected-pending entry that the lead removes after the apply.

## Standing rules (read ~/.claude/docs/gate-review-checklist.md equivalents inside the doc)
- Follow `scripts/check-script-conventions.mjs` (six rules) and add the check to the right workflow step in `.github/workflows/db-contract-check.yml`; count steps with the grep in CLAUDE.md, never pin a count in prose.
- Self-test with canaries: a call to a made-up ungated RPC name must make the check fail; the real current call sites must pass. Mutate your own new rule once.
- Never edit `perf-budgets.json` or `vite.config.ts`. No supabase/migrations.
- PR body: real "Verified on real data" block (shapes surveyed read-only: the guard's lists, counts only), Phone QA section with "Not applicable: CI script only", and Not verified.

## Done
Push branch with plain git (pre-push gate, no --no-verify). End the final message with [worker-done g1-guard] and list: files, the exact CI step added, the canary results.
