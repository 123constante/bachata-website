# Brief: free row picker, CONTINUATION 3 (same branch claude/free-row, PR #1809)

Read docs/briefs/free-row-picker.md and docs/briefs/free-row-picker-handover.md on the branch first.

Done already: code, lint (35/36; the 1 red, check:no-social-word on fixture strings, is red on main too), prod shape survey, PR body. Left, in order:
1. `npm run pre-ship` on the branch head. Run it in the background and poll; it timed out at 10 min in a foreground run. Fix reds in the same PR. Report any red that is also on main instead of fixing it.
2. 390x844 walk on the Vercel preview: a mixed night (one free + one paid type) and a free-only night (none in prod: use a fixture or test event). Screenshots go in the PR.
3. Add the preview URL and the walk result to the PR #1809 Phone QA block. Run both body checks until exit 0.
4. Final commit subject ends with the new ticket's `[worker-done <ticket>]` marker; push claude/free-row.

Do not widen scope: no organiser switch, no rate limit, no renames, no Social-fixture fix.
