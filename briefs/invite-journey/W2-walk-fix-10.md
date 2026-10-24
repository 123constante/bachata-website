# W2 walk fix 10 on PR #977: event editors honour returnTo after Save (Website, normal lane)

Repo: 123constante/bachata-website. Work ON `claude/invite-w2-phone-ig-golive` (PR #977, head 869866a). Add commits; no new PR. Read `docs/session-handover-2026-10-24-invite-w2-walk.md` first (fixes 1-9 are done; do not redo them).

## Why (orchestrator walk 2026-10-24, 390x844, prod backend, walk test account)
The event's "Before you go live" list links every row with `?returnTo=<event page>` (`withReturnTo` in `shared/goLiveCheck.ts`), and the editors' Back honours it. But Save on an event editor calls `useEventSend().sendThenDone(...)` -> `goDone` -> `/account/o/done` "Saved | Back to Home". Walked: "Say how dancers pay" -> pick Cash -> Save -> lands on "Saved / Back to Home", not back on the list (prod saved `payment_methods='cash'` correctly). A beginner fixing 7 go-live items is sent Home 7 times. Same class as walk finding 2 ("Finish later drops returnTo"). Already on main; the owner wants all walk findings fixed in #977.

## Task
1. One rule for every editor reached with `?returnTo=` (details incl. `edit=payment` and `edit=tickets`, venue/city, programme, cover/flyer, add-a-date, and any other target of a go-live row): after a successful Save, go back to the sanitised `returnTo` (`sanitizeReturnTo` in `src/lib/authRouting.ts`) — either directly, or via the Done screen whose primary button is "Back to <event name>" (pick one behaviour for all editors and say which in the PR). Without `returnTo`, behaviour is unchanged.
2. Red first: a table-driven test over EVERY go-live blocker in `GO_LIVE_BLOCKERS` (`shared/goLiveKeys.ts`): follow its link, save, assert you end on the event page (or the Done screen offers it as primary). Plus: no returnTo -> unchanged; an unsafe returnTo (external URL, `//evil`) -> ignored.
3. Optional only if trivial: on Home, the separate "Add a date" to-do row duplicates the date item already counted inside "Finish and go live: <name> — N things left". If one shared mapping makes it trivial, show the date once; otherwise leave it and note it in the handover.

## Boundaries
- No database change, nothing under `supabase/**`, nothing under `src/modules/dancer-app/**` (dancer-area isolation).
- Vercel is near its daily cap: run every CI job step locally (`.github/workflows/*`), then push ONCE.
- Update the PR body: add row 10 to "Walk-through fixes" and the per-job table for the new head; append to the handover doc.

## Output
Head SHA, tests added (red then green), per-job table, Verified / Not verified.
