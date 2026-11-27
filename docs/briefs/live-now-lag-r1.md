# Brief: live-now-lag-r1 (MEASURE the cache lag, then design the fix; docs only)

Lane: careful (public route). Model: Opus. Branch: claude/live-now-lag-r1. Docs and measurement only: NO feature code, NO migration, NO prod write.
Stopping rule: one independent review later; this round produces a doc.

## Owner words (why)
Owner 2026-11-01: an organiser saves a change and the public page does not match straight away (example: a Bailando cancellation saved 19:19:39 UTC purged city-london-gb OK, but the event page caught up a few minutes later). He wants (1) cancelled, moved or on-now events to read LIVE over the cached page, and (2) after a save, the organiser sees "Live now" once the public page matches.

## INVENTORY FIRST
Write `docs/design/live-now-lag/INVENTORY.md` BEFORE any proposal: every public surface that shows an event's state (event page `/event/:id`, calendar, city lists, tonight, organiser page, OG/SEO output), the cache layer in front of each (Vercel edge/ISR/SSR TTLs, purge calls, `waitUntil`), and every organiser-side surface that shows a "saved/live" state (file:line cited, GAPs listed). End with a coverage count: N surfaces, N covered, none silently omitted.

## Measure (read-only, prod, counts and timings only)
1. For 5-10 recent saves that changed a public event field (cancel, move, time), read the save time (audit/updated_at) and the first time the public URL showed the change (fetch the public page with and without a cache-busting query at 30 s steps, for up to 15 minutes, on a TEST event only if one exists; otherwise measure by reading response headers: `age`, `x-vercel-cache`, `cache-control`, `s-maxage`, `stale-while-revalidate` per surface). State the lag per surface in seconds with the method.
2. Find where the purge is called (grep the repo; read `vercel.json`, `app/**` loaders, any `purge`/`revalidate` code) and say which surface it does NOT purge.
3. Never publish, edit or cancel a real event. Do not write to prod.

## Deliver (`docs/design/live-now-lag/PLAN.md`)
Root cause per surface with numbers; 2 or 3 options (a client-side live overlay on the cached page; shorter TTL; on-save purge of the missing surface) each with cost, risk, bundle bytes (zero bytes to /app first load), and what the organiser's "Live now" check would read (which RPC, which field); a recommended option; the acceptance tests it needs (table-driven: surface x state). No code.

## Hard limits
Supabase read-only. Never merge or approve. No change to calendar protected files (`EventCalendar.tsx`, `calendar/*`, `useCalendarEvents.tsx`): read only. Docs-only PR; run `npm run lint` on your docs. Handover `docs/handover/live-now-lag-r1.md`.
