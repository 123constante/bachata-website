# Brief: P3 W4a fix 3, review round 2 fixes (Website, normal lane, Opus builder)

Continue branch `claude/p3-w4a-fix3` (head 8818c1e; fetch it, merge current `main` first, append-only on conflicts). Context cap 30%: push early. Source: `docs/review/pr-1107-r2.md` on branch `claude/review-1107-r2`. Flag `organiserP3` is OFF. Stopping rule: this is the ONE fix round; the orchestrator walks next.

Owner rule: the UI never offers what the RPC accepts-but-should-not (data integrity) or refuses; disabled controls say why; no copy points at a missing control.

Fix:
- **R2-1 (should-fix, data integrity)** `more/index.tsx` Leave ("more-leave" and the sheet's "more-leave-yes") is still enabled for the sole manager of an ownerless page (39 of 51 prod pages), and its team read is `enabled: !!selected && isOwner`, so a manager never loads the members. Enable the team read for managers too, gate the row with `canLeave(team.data.members)` from `shared/teamRules.ts` (disabled + `GateReason` with `leaveLast` and the Message us link, same words as Team), and make sure the confirm sheet cannot be reached when disabled. Add the rows to `More.test.tsx`: sole manager no owner (disabled + reason), two managers no owner (enabled), manager on an owned page (enabled), contributor (as `canLeave` says). Red first: commit the failing tests in their own commit BEFORE the fix commit (the round-2 review could not replay red-first). Keep the owner's existing `soleOwner`/`HAND_OVER_FIRST` guard untouched.
- **R2-4 (nit)** `TEAM_REASONS.decline` second sentence ("You can add them as a Manager.") must not show when the join card's Add as Manager is itself disabled (full team): make the gate take `full` or drop the sentence when `blockedReason` is set; add a matrix row.
- **Not in this round:** R2-2 (shared R1 screens changed, two R1 tests edited) is the owner's call, record it in the PR body as "decision: apply to R1 too, per handover"; R2-3 admin mapping and R2-6 dead code stay as notes.

Standing header lines:
- Prove the data source first: re-read `remove_organiser_member_v1` read-only on prod (project stsdtacfauprzrdebmzg, counts only, never a write); state table/column and who writes it; the server guard stays the admin repo's.
- Zero bytes to the /app first load: `npm run check:bundle-budget` on main and the branch; never edit `perf-budgets.json` or `vite.config.ts`.
- Overlay geometry: the Leave sheet stays inside 390x844, no page scroll on open.
- Append-only edits in shared P3 files; do not touch another session's branches.
Run every CI job step in your sandbox, per-job table in the PR body, update the `## Verified on real data` section (Shapes surveyed / Checks run / NOT verified). Final commit subject ends `[worker-done dt_<ticket>]`.
