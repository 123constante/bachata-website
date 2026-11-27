# Brief: Raffle v2 entry dialog joins the pool (R3b-1)
Brief-version: 2
Branch: claude/raffle-r3b-pool-entry
Lane: normal, Sonnet. Website only; do not touch supabase/, src/types/supabase.ts, src/integrations/supabase/types.ts, src/modules/organiser/p3/, onboarding files or any calendar density-exclusion file
Serves: a dancer who taps the raffle tile and enters once for the one general raffle (never expires), and sees "You're in" afterwards on every raffle surface
## What main lacks
- The entry dialog still calls submit_raffle_entry with an event id; with flags.raffleV2 ON it must call raffle_join_pool_v1 without an event and show the "you're in" state for already_in (owner D2), with data-testid raffle-already-in on the success state -- grep: raffle-already-in
- No pool-keyed WhatsApp confirmation: the send and the poll only know an entry id -- grep: sendPoolWaConfirm
- No pool-keyed status poll over get_raffle_pool_wa_status_v1 sharing the existing outcome types and timing -- grep: pollPoolWaStatus
- No pool-level "this browser is in" sessionStorage helper shared by the tile and /raffles -- grep: rafflePoolJoinedKey
- extends: the flag raffleV2 already exists (default OFF, PR #1424); flag OFF must keep the dialog exactly as on main -- src/lib/featureFlags.ts
## Files
src/modules/event-page/bento/modals/RaffleEntryDialog.tsx
src/lib/raffleWaVerify.ts
src/lib/raffleSession.ts
src/lib/__tests__/raffleWaVerify.test.ts
src/lib/__tests__/raffleSession.pool.test.ts (new)
src/modules/event-page/bento/modals/__tests__/RaffleEntryDialog.pool.test.tsx (new)
## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. In raffleSession.ts add rafflePoolJoinedKey (one literal, guarded read and write like the existing helpers), set on join success or already_in.
2. In raffleWaVerify.ts add sendPoolWaConfirm(poolId, sessionId) (edge fn raffle-send-confirmation with pool_id and session_id) and pollPoolWaStatus(poolId, sessionId, opts) over get_raffle_pool_wa_status_v1 via rpcLoose. Do not change the entry-keyed functions.
3. In RaffleEntryDialog.tsx, only when flags.raffleV2 is ON: call raffle_join_pool_v1 with p_first_name, p_phone, p_consent_version, p_session_id, p_honeypot and no event id (eventId prop becomes optional); map the same reason table as today (name_required, name_too_long, phone_invalid, consent_required, rate_limited) plus removed; already_in true shows the "you're in" success state with no error; verify through the pool functions. Do not hand-edit generated types; use rpcLoose.
## Tests
Table-driven, red first: join reply (ok, already_in, each reason incl. removed, network error) x flag (ON, OFF): assert RPC name called, whether an event id was sent (never when ON), the message or success state shown, and that the in-pool key is set only on ok or already_in. Pool WhatsApp send and poll mirror the existing entry-keyed cases. Flag OFF: dialog behaviour identical to main.
## Done when
- Table green, and red against unfixed main. Browser walk at 390x844 with route-mocked RPC replies (fresh, already in, removed, rate limited); tap targets at least 44px.
- PR body carries a Verified / Not verified block. Not verified: the real raffle_join_pool_v1 (admin PR #1135 is not applied) and a real WhatsApp message.
