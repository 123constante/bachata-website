# Brief: New ticket saved as draft on an event that went live meanwhile (P70)
Brief-version: 1
Branch: claude/draft-ticket-stale-live
Lane: careful, Opus. Repo 123constante/bachata-website. One PR.
Size: 4 files, 200 lines. No new design, no copy change.

## Read the brief
Never run `gh api`. Read this file with `git fetch origin brief/draft-ticket-stale-live && git show FETCH_HEAD:docs/briefs/draft-ticket-stale-live.md`.

## Goal
`TicketsV2.tsx` passes `seriesLive={s.lifecycle_status === 'live'}` to `TicketSheetV2` from the workspace snapshot. `writeTicket` (src/modules/organiser/p3/v2/TicketSheetV2.tsx, `if (!a.type && !a.seriesLive) return { ... draft: true }`) then skips the on_sale call for a NEW ticket. If the event went live in another tab after the snapshot was read, the new ticket stays `draft` on a live event forever: the admin go-live trigger (trg_go_live_flip_draft_tickets_v1) only flips draft tickets AT the go-live moment, and the toast says "goes on sale when you put the event live" although it already is live.
The opposite case is already safe (stale live, real draft: on_sale is refused `series_not_live`, the row is closed, the error shows). Leave it as is.

## What main lacks
When writeTicket is about to return `draft: true` for a new ticket, it does not re-read the event's real lifecycle. Fix: just before that return, read the series' current `lifecycle_status` from the server (fresh, not the cached snapshot). If it is `live`, carry on exactly like the live path (`setTicketStatus(id, 'on_sale')`; on refusal return the same `{ ok: false, error: refusal(st), wrote, createdId }` as the live path). Otherwise return `draft: true` as today. If the read itself fails, return `draft: true` (today's behaviour; the trigger covers a later go-live).
Why this closes the gap: the row is already inserted when we re-read. If the event goes live after our read, the trigger flips the row. If it went live before, our read sees live and we put it on sale. `setTicketStatus` on an already on_sale row returns ok/changed false, so a double flip is harmless.

## Files (expected; inventory first)
- src/modules/organiser/p3/v2/TicketSheetV2.tsx (writeTicket; the toast copy line in the sheet must follow the result: no `draft` flag means the normal "Saved" text)
- src/modules/organiser/p3/tickets/ticketsApi.ts ONLY if no existing read of one series' lifecycle_status fits. Prefer an existing reader (grep `lifecycle_status` under src/modules/organiser). The read must bypass any react-query cache (a plain supabase select or RPC call). Respect `.claude/rules/data-contracts.md`.
- src/modules/organiser/p3/v2/__tests__/draftTicketSave.test.tsx

## Tests (run against unfixed code first; say so in the PR body)
Table-driven (`it.each`) over: prop seriesLive false + server says live -> on_sale called, no draft flag; prop false + server says draft/pending_review/rejected -> no on_sale call, draft flag; prop false + read fails -> draft flag, no throw; prop false + server live + on_sale refused -> ok false with createdId; prop true -> unchanged (on_sale called, no extra read); existing ticket (type set) -> no read, no on_sale call. Typed input stays in the sheet on every error (assert inputs keep their values).

## Do NOT touch
EventCalendar.tsx, calendar/*, useCalendarEvents.tsx, src/components/ui/dialog.tsx, supabase/**, workflows, scripts/**, .env*, TicketsV2.tsx (no change needed there), any file not needed above. No admin/server change.

## Done when
One push; PR body has "## Verified on real data" (- Shapes surveyed: / - Checks run: / - NOT verified:) and "## Phone QA" (- Sizes checked: / - Walked: / - Not verified:); tests green; every CI job step that applies has been run and the per-job table is in the PR body; last commit subject ends with the [worker-done ...] marker.
