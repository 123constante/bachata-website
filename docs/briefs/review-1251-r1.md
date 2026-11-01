# Brief: independent review r1 of PR #1251 (claude/p3-wt-states)

Repo bachata-website, branch claude/review-1251-r1, lane normal, Opus (reviewer; the builder was Sonnet). READ-ONLY on code: you write ONE file `docs/review/pr-1251-r1.md` and push it. Do not edit the PR branch. Supabase read-only.

Subject: PR #1251 `claude/p3-wt-states`, scope F-06, F-16..F-19, F-22, F-24, F-25, F-34 of `docs/design/p3-acceptance/FIXLIST.md`. Builder handover: `docs/handover/p3-wt-states.md` on that branch. Brief it followed: `docs/briefs/p3-wt-states.md` on branch brief/p3-wt-states.

## Review for (verdict PASS / PASS WITH NITS / BLOCK, findings ranked, each with file:line and a failing input)
1. Correctness per row: does each fix do what the FIXLIST row asks, and only that? Scope creep (F-20/21/23, routing, status tagging beyond F-22, density-excluded calendar files) = finding.
2. F-22 `statusOf` change: who else reads status (Events list, Home, tags, tests)? Any screen where an ARCHIVED event now reads "Removed" but the user did not remove it (e.g. ended-and-archived by the system)? State the live shapes: read-only prod counts of events by archived/ended/removed flags.
3. F-24 leave-guard via the tray's router blocker: can Stay/Leave leave a stuck blocker, double prompt, or block on a clean (untouched) sheet? The builder did NOT test the blocker path: write or specify the test.
4. F-16/F-18/F-17/F-19 copy: no text pointing at a missing control; each empty/error state names what the person CAN do; disabled controls say why. Table-check every screen x state yourself.
5. F-34 link: correct public URL for slug vs id, only for live events, `rel` safe on `target=_blank`.
6. The builder did NOT run: shape survey, `npm run check:bundle-budget` (needs a build), the 390x844 overlay e2e (sheet, confirm, toast inside viewport, page does not scroll on open). Run what you can (bundle budget on main and the branch; add 0 bytes to dancer-app first load). List what you could not run under Not verified.
7. Mutation check: revert one fix line and confirm the new `states.matrix.test.tsx` goes red.

## Output
`docs/review/pr-1251-r1.md`: verdict, findings (severity, row, file:line, failing input, suggested fix), Verified / Not verified, coverage count (N rows reviewed of 9). Push once (final subject ends the done marker given in the dispatch prompt). No fix commits.
