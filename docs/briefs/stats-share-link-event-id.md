# Stats share link: use the public event id, not the series id (NORMAL lane, no database change)

Brief-version: 1
Branch: claude/stats-share-link-event-id (from main AFTER website#1428 merges). One push. Normal lane, Sonnet, context cap 50%. No `supabase/**`.

## Decisions
Public event URLs use `COALESCE(legacy_event_id, id)`. Admin #1276 is merged and applied: `my_tickets_v1` now returns it as `event_id`. The Stats share link must use that public id, never the series id, or a bridged event's link opens the wrong or no page.

## Verified on main (origin/main, 2026-11-06): NOT fixed -- the link does not exist on main yet
The share link is built only in open PR #1428 (branch claude/organiser-stats-v2-share-card, head e2d4a11): `ShareLinkCard.tsx` calls `shareLinkOf(window.location.origin, next.id, usable)` with `next = nextUpOf(...)` (the series id), and `shareLinkOf` in `src/modules/organiser/p3/data/analyticsV2.ts` returns `${origin}/event/${encodeURIComponent(eventId)}?ref=...`. Its own INVENTORY row 25 and HANDOVER "Not verified" admit `/event/<series id>`. `nextUpOf` is at src/modules/organiser/p3/data/home.ts:153 (P3Row.id = series id, home.ts:25). Do not start until #1428 is merged; re-grep `shareLinkOf` first and fix the real call site.

## What to build
1. Find where `home_v1` (or the organiser event data the P3 rows are built from) exposes the public id: check the `home_v1` series payload for `legacy_event_id`. If present, add `publicEventId: string` to `P3Row` (`legacy_event_id ?? id`) in one place (home.ts row builder). If `home_v1` does NOT carry it, STOP and report PARTIAL with what was grepped; do not guess and do not add a migration.
2. `ShareLinkCard.tsx`: pass `next.publicEventId` to `shareLinkOf`, not `next.id`.
3. Rename the `shareLinkOf` parameter to `publicEventId` so the series id cannot be passed by habit.

## Files
- src/modules/organiser/p3/data/home.ts
- src/modules/organiser/p3/data/analyticsV2.ts
- src/modules/organiser/p3/screens/ShareLinkCard.tsx
- src/modules/organiser/p3/data/__tests__/analyticsV2.test.ts
- src/modules/organiser/p3/data/__tests__/ (new publicEventId test next to the existing home tests)

## Tests
Table-driven, red first (run against unfixed code to show red): bridged event (legacy_event_id set, differs from id) -> link contains legacy id and not the series id; unbridged (legacy_event_id null/absent) -> link uses id; empty-string legacy id -> falls back to id; series with no next date -> no link (unchanged); code with spaces still encoded. Plus a source-scan test that no file under src/modules/organiser builds `/event/` from a bare `.id`.

## Verified / Not verified (put in PR body)
Survey prod counts only (read-only): organisers' listed series with legacy_event_id set vs null. Walk the card at 390x844 on a bridged and an unbridged account.
