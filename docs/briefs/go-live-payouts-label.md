# Brief: Go live list names and links the payouts blocker (P69)
Brief-version: 1
Branch: claude/go-live-payouts-label
Lane: normal, Sonnet. Repo 123constante/bachata-website. One PR.
Size: max 5 files, 200 lines. No new design: one more row in the existing Go live list.

## Read the brief
Never run `gh api`. Read this file with `git fetch origin brief/claude/go-live-payouts-label && git show FETCH_HEAD:docs/briefs/go-live-payouts-label.md`.

## Goal
Since admin migration 20261127131657_go_live_ticket_payouts_check_v1 (on prod), the server's go-live check (_series_go_live_check_p5) sends `{code: 'ticket_payouts', section: 'tickets'}` in event_missing when the event has a paid ticket type (draft or on sale, price above 0) and the organiser has no working payouts. The website has no label for it, so the organiser sees "Something else on the event" (UNKNOWN_ITEM_LABEL) and, worse, the row's fix link goes to the ticket-link editor (section 'tickets'), which cannot fix it. Name it and send the organiser to the Get paid screen.

## What main lacks
- GO_LIVE_BLOCKERS has a `ticket_payouts` entry with label 'Set up payouts to sell paid tickets' -- grep: ticket_payouts in src/modules/organiser/shared/goLiveKeys.ts
- The fix link for ticket_payouts opens the Get paid screen (P3_TICKET_PATHS.getPaid, src/modules/organiser/p3/tickets/paths.ts), never detailEditPath(seriesId, 'tickets').

## Files (expected; inventory first, stay within 5)
- src/modules/organiser/shared/goLiveKeys.ts
- src/modules/organiser/shared/goLiveCheck.ts (goLiveFixHref)
- src/modules/organiser/events/__tests__/goLive.webA1a.test.tsx
- src/modules/organiser/shared/__tests__/goLiveWalk.matrix.test.tsx and/or goLiveSaveBack.matrix.test.tsx only if they enumerate server codes

## What to build
0. INVENTORY (in the PR body, not a file): every caller of goLiveFixHref and goLiveLabel / GO_LIVE_BLOCKERS (Go live list on the event, Go live flow "Still to do", Home to-do row); what organiser id each caller has; coverage count at the end.
1. goLiveKeys.ts: add `ticket_payouts: { label: 'Set up payouts to sell paid tickets', section: 'tickets' }` (the server's section stays 'tickets'; the words match the existing 'Set up payouts' button).
2. Fix link: the row for code ticket_payouts must open Get paid. Choose the smallest change that fits the callers: e.g. an optional per-code `href` override in BlockerDef read by a code-aware helper, or a client-side section 'payouts' in the BlockerDef mapped in goLiveFixHref to P3_TICKET_PATHS.getPaid(...) wrapped in withReturnTo(..., ORG_PATHS.event(seriesId)). If a caller cannot know the organiser id and getPaid needs it, that caller shows no link (null), never a dead or wrong one. Other codes keep today's links exactly.
3. Tests: goLive.webA1a.test.tsx label contract: add 'ticket_payouts' to the code list and add `Set` to the verb regex (`/^(Add|Upload|Write|Pick|Link|Give|Move|Fix|Say|Set|A flyer is required) /`). Add a test that goLiveFixHref (or the helper) for ticket_payouts returns the Get paid path with returnTo the event, and that 'ticket_link' still returns the ticket-link editor. Run the new tests against unfixed code first and say so in the PR body.
No other copy change; no admin repo change; no server change.

## Do NOT touch
EventCalendar.tsx, calendar/CalendarGrid.tsx, calendar/CalendarListView.tsx, calendar/DayDetailModal.tsx, calendar/calendarUtils.ts, useCalendarEvents.tsx (density-exempt), src/components/ui/dialog.tsx, supabase/**, migrations, workflows, scripts/**, .env*, any file not needed for the above.

## Done when
One push; PR body has "## Verified on real data" (- Shapes surveyed: / - Checks run: / - NOT verified:) and "## Phone QA" (- Sizes checked: / - Walked: / - Not verified:); tests green; every CI job step that applies has been run and the per-job table is in the PR body; last commit subject ends with the [worker-done ...] marker.
