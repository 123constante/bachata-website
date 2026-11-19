# Brief: organiser R4, Guest list on the night page (option B)

Repo: Website only. Behind flag `organiserTicketing` as the night page already is (no new flag needed; the list lives inside existing gated code). One PR, no migration, no admin change. Look: white + #C2410C, 390x844, plain words, no emoji, tap targets explicit 44px. Reference: existing R4 screens (src/modules/organiser/p3/r4, R4Night.tsx). Do NOT edit R4Shell.tsx (another window owns it). Do not touch src/integrations/supabase/types.ts. No refund buttons, no Message everyone, no Reminders row, no Raffle. Add place stays 34px. End with the [worker-done] marker.

## Owner pick (2026-11-19, DESIGN-REGISTRY row "Organiser night: Guest list + Cancel refund")
Guest list = option B: list on the night page UNDER the numbers, no extra screen. Chips: All / In / Not yet. Owner and admin also get a Refunded chip. Door staff (seat-only) see name, tickets, in / not yet ONLY: no money, no Refunded tag.

## Build
- Data: `fetchDoorList` in src/modules/organiser/p3/door/data.ts (RPC ticket_door_list_v3), query key `doorKeys.list`. Handle result not_allowed (hide the list), wrong_night, truncated (say 'Showing the first N of M'), loading, error with retry, empty ('No tickets yet').
- Row: first name, ticket count, type name, In (time) or Not yet. 44px rows.
- Refunded chip: only if the v3 payload carries a refund/cancelled state per row. If it does not, build All/In/Not yet only and LIST the gap in the PR body; do not invent data.
- Matrix tests: each chip filter, owner vs seat-only variant, truncated, not_allowed, empty, error retry. Real-data block: read-only counts from prod project stsdtacfauprzrdebmzg, include a list over the 100-row cap. Phone-QA labels exact.
- Extras noticed: list in PR body, never change.
