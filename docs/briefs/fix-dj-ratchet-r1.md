# Brief: fix-dj-ratchet-r1 (WEBSITE, CI GUARD, Opus, careful lane). Branch claude/fix-dj-ratchet-r1. Push ONCE.

Context line: stay under 30% of your context; push + handover by 30%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY (counts and profile ids only; no personal data in the PR). No migration.

Problem: after admin #1191 cleared the guest-entries step, the Website `contract-check` on main (workflow_dispatch run 41666265616, 2026-11-03 15:41Z) fails at the NEXT step, `scripts/check-teacher-dj-assignment-integrity.mjs`: "FAIL: 33 teacher / 9 DJ unassigned (baseline: 33/8)". The step was masked until now by the guest-entries red. It blocks #1294 and every Website PR.

Lesson to apply (memory project_ci_guard_false_positives): CHECK THE CHECK before changing data or the baseline. Do:
1. Read the script and its header history (the "listed before first booking" re-baseline pattern: 2026-07-24, 2026-09-14, 2026-10-02). Read the live RPC `check_teacher_dj_assignment_integrity_v1` body (read-only) and find WHICH active DJ profile is unassigned now that was not in the 8 (sample_profiles is empty in the payload: say why). Read-only SELECT: profile ids and created/listed dates only.
2. Decide and say which it is: (a) a genuine new DJ profile listed before its first booking (the documented pattern: the ceiling is re-baselined 8 -> 9 with a dated comment naming the pattern), or (b) a regression (a DJ that WAS assigned lost its line-up credit: then do NOT re-baseline; report the cause and the exact rows and stop).
3. If (a): the one-line ceiling change plus the dated comment, following the previous re-baseline commits exactly; run the script's self-test and `npm run lint` chain pieces that cover it; prove the check goes green against live prod with the new ceiling and still goes red at 10 (mutant).
4. Also make the payload's sample_profiles useful if trivial, otherwise leave it and say so.

Hard tier (scripts/**): needs the owner's Approve at head. Deliverable: PR from the claude/ branch, handover docs/handover/fix-dj-ratchet-r1.md with Verified / Not verified (case a or b, the evidence) and the per-job CI table. Commit subject ends [worker-done <ticket>].
