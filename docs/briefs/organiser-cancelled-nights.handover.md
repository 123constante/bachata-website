# Handover: organiser-cancelled-nights (E7) -- BLOCKED at step 1, no code changed

Date: 2026-11-10. Ticket dt_49ae107e9cb2. Brief: docs/briefs/organiser-cancelled-nights.md (v2, sha 8dad387c).

## Finding (read-only prod, project stsdtacfauprzrdebmzg)
Brief step 1 ("prove `get_organiser_nights_v2` returns cancelled upcoming rows with `is_cancelled`") FAILS.
`pg_get_functiondef(get_organiser_nights_v2)` ends its inner filter with
`and not coalesce(t.is_cancelled, false)` -- cancelled occurrences are dropped SERVER-SIDE, for both the
upcoming and past feeds. The client `if (occ.is_cancelled) continue;` guards in
src/pages/OrganiserProfile.tsx (~L693, ~L706) are therefore dead defence; removing them changes nothing.
The brief's "What main lacks" assumes the data arrives and the client drops it; it does not arrive.

## Why I stopped
The brief is Website-only (no migration, no supabase/**). The fix needs the RPC to return cancelled rows
(admin repo `bachata-admin-11april/supabase/migrations/`), e.g. drop the filter and return `is_cancelled`,
with the upcoming `limit` ordering scheduled nights before cancelled ones (brief item 4 cannot be met
client-side: the server LIMIT 20 would already be filled/ordered without knowing which are cancelled).
Also: the public RPC is shared, so every other caller of get_organiser_nights_v2 (past feed, hosted count,
stats, loader prefetch app/routes/organiser.tsx) must keep excluding cancelled -- an additive param
(e.g. `p_include_cancelled boolean default false`) is the safe shape.
I cannot write migrations (read-only connector, repo owns none), so no count of cancelled upcoming rows
was taken (the occurrence table name differs from my guess; not pursued).

## Next steps (for owner / orchestrator)
1. Admin-repo migration: additive `p_include_cancelled` on get_organiser_nights_v2; when true, return cancelled
   rows with `is_cancelled`, ordering the upcoming LIMIT so scheduled nights come first. Default false.
2. Then re-dispatch this brief with the website part: upcoming fetch passes the param; split cancelled from
   scheduled in OrganiserProfile's useMemo (cancelled excluded from stats/upcomingListItems counts/empty-state);
   add `cancelled?: boolean` to the NightsCard model/props; PUBLIC_CANCELLED_WORD; muted card, text tag, no
   action row; tests per the brief's matrix (existing organiserPage.matrix.test.tsx already has a
   `cancelledExtra` shape helper to extend).

## Verified / Not verified
Verified: RPC definition read from prod (SELECT only).
Not verified: everything else -- INVENTORY.md not written, no code, no tests, no tsc, no walk (nothing built).
Coverage: 0/0 inventory items (not started). tsc: not run (no source changes).
