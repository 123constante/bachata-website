# Brief S-GOLIVE-SESSION -- Go live needs at least one session (event page AND New event flow)

Repo `123constante/bachata-website`, branch `claude/org-r1-golive-session`, base `main` (#880 merged). READ FIRST: `docs/organiser-rebuild/briefs/00-COMMON.md` with `<X>` = S-GOLIVE-SESSION. ONE push at the end, plus ONE `PARTIAL [worker-done ...]` push if you reach 30% context (handover file `docs/organiser-rebuild/handovers/S-GOLIVE-SESSION.md`; a continuation reads it). Website only: NO migration, NO admin repo change, NO prod write (Supabase read-only). Read and push with plain git, never `gh api`. No variables/loops in shell where a plain command works. Check `npm run build`, not only dev.

## The failure the owner saw (his words)
On prod 2026-10-20 he tapped Go live on draft "zz test" (a4e38c9f-b3d3-4007-a56f-85d7e36768da; date 17 Nov 20:00, flyer, venue, NO session). It went live and the public page said "Time to be confirmed - The organiser has not set a time yet" although he had set Time 20:00 in Details. He asked: "why am I telling you this though the rule is already in the system?"

## Evidence (orchestrator, read-only, 2026-10-20)
- The rule "an event needs a session" exists ONLY in `src/modules/organiser/events/reviewModel.ts` (Send for review: `NO_SESSION_REASON = 'Add at least one session first.'`, `sessionDates()`; owner decision 2026-10-08, mirrors the admin editor) and the admin editor.
- Go live (`events/lifecycleModel.ts` `goLiveMissing`/`goLiveReason`, and the New event flow last step `flows/new/model.ts`) checks only name, venue, a date from today, a flyer. The server gate `_owner_series_go_live_ready_p5` (admin A1b) = readiness ok + cover + upcoming scheduled date: no session. So nothing stopped it.
- Prod shapes (counts): live 67 (0 without a session), paused 2 (1 without = zz test), draft 1 (no session), ended 21 (1 without). So the rule is already true of every live event; only the new Go live path skips it.
- Public headline time comes from sessions, which is why Details "Time" does not show with no session.

## Owner decisions 2026-10-20 (click answers)
1. Website only: Go live disabled WITH reason `Add at least one session first.` Same words as Send for review (reuse `NO_SESSION_REASON`; do not copy the string).
2. Leave the public page alone.
3. Apply to BOTH Go live buttons: event page lifecycle card AND the New event flow last step, through ONE shared function so the two cannot disagree.

## Task
- Add the session rule to `goLiveMissing`/`goLiveReason` using `sessionDates()` (series programme session OR a session added to an upcoming listed date). Reason text must name where to do it (the card already links Details / Add a date; add a link or wording to the programme/sessions screen if one exists, else plain `Add at least one session first.`). Order: keep the existing order, session last.
- New event flow last step (`flows/new/model.ts` finish gating, `finishLabel`, the disabled-with-reason logic): same rule, same function. If the flow has no way to add a session on that step, the disabled reason must say what to do ("Save as draft, then add a session from the event"); an empty state must say what the person CAN do.
- Check the GO_LIVE_READY / A1 wording still reads right (A1 applied: `A1_APPLIED`).
- Make Send for review and Go live read the same mapping (one shared helper); do not leave two copies.
- Red first: table-driven test rows (draft x {no session, series session only, added session on a future date only, added session only on a PAST/cancelled date, session + no cover, session + no date}) on BOTH screens; run against main first and state the failing run in the PR body. Include prod-shaped fixtures: one_off draft with 0 sessions (zz test), weekly series with a programme session.
- Walk 390x844 on the Vercel preview if one exists (draft with no session: Go live off with reason; add a session: it enables). Do not press Go live on prod.

## Verified / Not verified, CI
Run EVERY CI step yourself (read `.github/workflows`), per-job table with command and exit code in the PR body and handover (GitHub Actions billing is intermittent; an annotation "payments have failed" is not a code failure). Write "Not verified" honestly (real phone, live publish, server-side bypass: the server still accepts a live event with no session if the app is bypassed; owner chose to accept that).
