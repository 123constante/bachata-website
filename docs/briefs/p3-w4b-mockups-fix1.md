# Brief: W4b mockups, ONE fix round after the Fable review (Opus builder, docs/design only)

Continue branch `claude/p3-w4b-mockups` (PR 1114, head fc55cf5; fetch it, merge current `main` first). **Mockups and docs only: no `src/` changes.** Context cap 30%, push early. Source of truth: the independent review `docs/review/pr-1114-r1.md` on branch `claude/review-w4b-mockups-r1` (verdict PASS with should-fix; all your data counts reproduced). Read it fully, then fix S1-S9 and the nits N1, N2 (others are optional). Stopping rule: this is the ONE fix round; the owner picks next.

Priority (they change how the owner compares A and B):
- **S1** no-city A frames 1-6 must keep the beta note and the Browse link (there is room) OR the decision table must state the drop; prefer keeping them.
- **S2** no-city B: the gate sheets promise "we bring you back to this screen". The real behaviour today: the gated Finish screen saves then navigates to `/account/o` = the Welcome screen with the sheet closed and an empty search box. Word what exists ("you come back to Welcome; search for your page again") and mark any richer return as stage-3 conditional, saying in section 3 which wording each option needs.
- **S3** remove the "Profile finished..." line from no-city A frame 5 (the Finish screen already says Saved) or specify its carrier as stage-3 work outside the module.
- **S4** name the existing `useProfileCompletion` / `ProfileGateContext` (`completenessFact`, `stillToAddText`, `ratingGate`) as the single completeness source for stage 3 instead of a new `my_dancer_edit_v1` read; update the "New behaviour" row.
- **S5** frames labelled "unchanged / today's copy" must carry today's strings, or move each changed string to a "Changes copy" row as a proposal.
- **S6** fix the garbled note, regenerate, copy the real control counts into section 4's table, `next=` -> `returnTo=` in section 1, delete the unused `MISSING`.
- **S7** place the "Waiting for an answer" and "Request declined" cards in new-account B (one frame or one sentence).
- **S8** add the missing end frame for the claim path: Home with "X is yours. You can now manage it." in both new-account options.
- **S9** fix `selfcheck.cjs` so a bottom-anchored `.sheet` that grows above the frame goes red (check each sheet's top >= 0 within the frame); prove with a mutation (40 filler lines in no-city-B frame 3 must now FAIL).
- N1 keep the beta note and Browse on frames 2-5 or declare; N2 label the 6a frame as the `?add=1` variant.

Re-run `node docs/design/p3-w4b/selfcheck.cjs` and report the new numbers (contrast >= 4.5, taps >= 44, no clipped frames, width 390) light and dark. Update `docs/design/p3-w4b-mockups.md` (recommendations must still be justified by the data; say if S1/S2 change them). Final commit subject ends `[worker-done dt_<ticket>]`.

Standing header lines:
- Prove the data source first: your counts stand (re-verified by the reviewer); do not re-run unless a number changes.
- Zero bytes to /app first load: touch nothing under `src/`, `perf-budgets.json`, `vite.config.ts`.
- Append-only in shared files; do not touch another session's branches.
PR body: keep `## Verified on real data` with the literal `- Shapes surveyed:` / `- Checks run:` / `- NOT verified:` lines and `## Phone QA`; update them.
