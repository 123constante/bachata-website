# Brief S-GOLIVE-SESSION-FIX -- ONE fix pass on PR #885 (branch claude/org-r1-golive-session, head fe8e7ce7)

Push ONCE to the SAME branch `claude/org-r1-golive-session` (commit subject ends `[worker-done <ticket>]`; PARTIAL rule as usual). Plain git only. Website only, no migration. Review file: `git show origin/claude/done-r-golive-session:docs/organiser-rebuild/reviews/R-GOLIVE-SESSION.md` (fetch that branch). Original brief + handover: arc/briefs-organiser-r1 S-GOLIVE-SESSION.md and docs/organiser-rebuild/handovers/S-GOLIVE-SESSION.md on the PR branch.

Do these (owner defaults, decided by the orchestrator):
- F1 (fix): add render tests. (a) RTL render `LifecycleActions` for the zz-test shape (one_off draft, 0 sessions, cover, future date): Go live off with `Add at least one session first.`, `org-life-add-session` link href = ORG_PATHS.eventProgramme(id); with a session it is enabled and the link is gone. (b) render the New flow cover/last step with a session-less draft: `org-new-live` off with NO_SESSION_NEW_REASON; with a programme session it is on. Then MUTATE: revert NewFlow `finishReason` wiring and the card link, show those tests fail, put it back.
- N1: remove the unused `coverStepReason` import.
- N2: when the session is the ONLY blocker on the New flow last step, "Save as draft and leave" goes to ORG_PATHS.eventProgramme(seriesId) (so the person lands where they add the session); otherwise unchanged. Test it.
- N3: fix the capital letter mid-sentence in the A1-off reason (lower-case join) without changing the A1-on text. Test both.
- N4: festival draft with no session: no "Add a session" link; use the team wording the programme screen already uses ("Festival days are edited with the platform team for now."). Test a festival row.
- Leave N5, N6 alone (note them in the handover as accepted).

Then run EVERY CI step you can in the sandbox (read .github/workflows): organiser vitest, `npm run build`, eslint on touched files, lint:architecture, check:rpc-typing, check:wallclock-brand. Table of command + exit code in the handover. Update docs/organiser-rebuild/handovers/S-GOLIVE-SESSION.md. Do NOT edit the PR body (the orchestrator does).
