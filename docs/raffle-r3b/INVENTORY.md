# INVENTORY -- raffle entry dialog joins the pool (R3b-1)

Sources read: current Website (this repo @ main b07bca98). The admin app and the
public page are NOT in this checkout (no admin repo access in this worker);
admin items are taken from the brief only and listed as not inspected.

| # | Item | Where (file:line at main) | Covered by this PR |
|---|------|---------------------------|--------------------|
| 1 | Flag raffleV2 (default OFF) | src/lib/featureFlags.ts:24 | yes (read in dialog) |
| 2 | eventId prop (required today) | RaffleEntryDialog.tsx:44 | yes (optional) |
| 3 | submit_raffle_entry call + args | RaffleEntryDialog.tsx:~148 | yes (flag OFF unchanged; ON uses raffle_join_pool_v1) |
| 4 | reason table name_required/name_too_long/phone_invalid/consent_required/rate_limited | RaffleEntryDialog.tsx:62-80 | yes (+ removed) |
| 5 | already_entered ack state | RaffleEntryDialog.tsx:~170 | yes (pool: already_in ack, testid raffle-already-in) |
| 6 | already_won_this_event ack | RaffleEntryDialog.tsx:~180 | n/a to pool (flag OFF only) |
| 7 | network error toast | RaffleEntryDialog.tsx:~160 | yes |
| 8 | honeypot field -> p_honeypot | RaffleEntryDialog.tsx:~148, 290 | yes |
| 9 | session id -> p_session_id | src/lib/raffleSession.ts:26 | yes |
| 10 | consent version -> p_consent_version | RaffleEntryDialog.tsx:~148 | yes |
| 11 | WhatsApp send (entry keyed) | src/lib/raffleWaVerify.ts:23 | unchanged; pool twin added |
| 12 | WhatsApp poll (entry keyed) | src/lib/raffleWaVerify.ts:62 | unchanged; pool twin added |
| 13 | per-event entered key | src/lib/raffleSession.ts:41 | unchanged; pool key added |
| 14 | onSubmitted() fire rules | RaffleEntryDialog.tsx:~125, 215 | yes (same rules) |
| 15 | future-prizes opt-in checkbox | RaffleEntryDialog.tsx:~335 | flag OFF only; pool RPC has no such arg in brief |
| 16 | tiles/RaffleBlock + /raffles read of pool key | RaffleBlock.tsx, OpenRafflesGrid.tsx | NOT in scope (helper only) |
| 17 | admin app fields/options | not inspected | no |
| 18 | public page fields | not inspected | no |

Coverage: 14 covered or deliberately n/a of 18 (items 16-18 not covered; 15 flag-OFF only).
