# Brief: going-hidden (Website, one small worker, ONE push, then open ONE PR)

Branch: `claude/going-hidden` (create from current `origin/main`, head 0a9d2d4e or later). Read/push with PLAIN git, never `gh api`.
Shell commands without variables/loops/`$(...)`. Never merge/approve, never `--no-verify`, Supabase read-only. Push ONCE (Vercel cap).
Open the PR as the bot with `gh pr create` (the dispatch default allows it); do NOT add any label.

## Owner decision (2026-10-18, do not re-open)
Hide the "I'm Going / Interested" (check-in) control from visitors COMPLETELY for now. Reason: nothing visible happens when someone taps
(3 attendance rows in prod, "who is going" is not shown anywhere), and the profile-completeness lock is client-side only. It comes back later with ONE switch.

## Task
1. Survey every place a public visitor can see or tap Going / Interested / RSVP / check-in: start with
   `src/modules/event-page/bento/blocks/RsvpBlock.tsx` and `RsvpBlockPlaceholder.tsx`; also `src/pages/FestivalHub.tsx`, the dancer app Home "nights" tiles
   (`src/modules/dancer-app/**`), and anything importing the attendance RPC hooks (`get_my_event_attendance_v1/v2`, set-attendance RPC). List them in your handover
   (file, what a visitor sees today).
2. Add ONE exported constant, e.g. `GOING_CHECKIN_ENABLED = false` in a small new file (pick a sensible lib/config path), and make EVERY surface from step 1
   render nothing for Going when it is false (no button, no empty gap/heading, no "sign in to say you're going" text, no layout hole).
   Do NOT delete the code, RPCs, tables or hooks; do NOT write to the database. Keep a short comment on the constant: why it is off and the 3 conditions to turn it on
   (dancers to show, server-side lock, "Going next" opt-in).
3. Red-first tests: a table-driven test over every surface from step 1 asserting nothing Going-related renders when the switch is false (run against UNFIXED code first, it must fail),
   and that the same surfaces render as before when the switch is true (so the switch really works). Fix existing tests that assumed Going is visible by setting the switch true in them.
4. Run every CI job step in `.github/workflows/*.yml` that applies in your sandbox (list per-job results with exit codes in the PR body; GitHub Actions may refuse on billing, say so), plus `npm run build`.
5. Handover `docs/handover/going-hidden.md`: surfaces found, what you changed, how to turn it back on, Verified / Not verified. One commit, subject ending
   `[worker-done <your ticket>]`, ONE push. Stop after the push and the PR.
