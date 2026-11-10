# Handover: raffle 1429 fix round (done)

Prod RPC `raffle_public_board_v1` (read-only definition read): nights carry occurrence_id, public_event_id, title,
start_local (UTC wall clock, no zone), venue_name, winner_first_name. Page depends on those plus pool_count.

Fixed: 1 real keys + fixtures from real keys; 2 start_local read as UTC, London day shown, BST/GMT tests;
3 distinct loading / error(retry) / empty / not-entered copy on tile and /raffles; 4 "Winners listed" counts nights
with a winner, not total_winners (766 on prod), real-shape test; 5 first night not before London today;
6 "See who won" hidden with no winners; 7 You're in persists in localStorage, sessionStorage fallback.

Not done / needs owner: item 7 cannot be derived from the server: there is no anon RPC that says "this person is in
the pool" (raffle_my_wins_v1 is authenticated, about wins). Needs an admin-repo RPC. Flag stays off; no flag/env touched.
Not verified: no 390x844 browser walk (sizes asserted from CSS: 44px); no CI run; no pre-ship.
tsc run on a9438d6: 0 errors in branch files
