# Party chat S1 handover

Nothing STOPPED: every prototype element was built (C1 + C3; C2 confirm dropped per brief).

## Done
- `VITE_ENABLE_PARTY_CHAT` flag (partyChatFlag.ts, default off). Flag off: card lazy chunk never mounts, zero party RPC calls (tested).
- PartyChatCard.tsx (lazy) at the top of Nights, above "Coming up". States none / in / open; closed, loading, error, signed out = no card.
- Profile city = `based_city_id` + `city_name` from useMyDancerEdit. Other cities = `cities` where `is_active`, ordered by name.
- Tests: `screens/nights/__tests__/partyChatCard.test.tsx` (9) + existing nights tests green.
- tsc (tsconfig.app.json): 0 errors in nights files. check:mojibake clean.

## Not done / Not verified
- No 390x844 browser walk, no real-data survey (read-only prod check not run).
- `.env` example not touched (flag defaults off).

## Extras noticed, NOT built
- `in` state before cities load shows "You're in" without the city until the list arrives.
- `open` state with null chat_id disables the button.

## TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| Profile city | join (register_party_interest_v1), card becomes "You're in" | prototype |
| Other city | in-card list of active cities | prototype |
| City row | join that city | prototype |
| Open chat | /account/party-chat/<chat_id> (S2, may 404) | prototype |
