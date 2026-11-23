# Party chat S3 handover

Nothing STOPPED: every checklist element was built.

## Done
- Bell: third alert kind `party` (`party:<chat_id>`, "Party chat is open" / "Tap to join the chat.", MessageCircle tile, links to `/account/party-chat/<chat_id>`). Built only from card state `open`. Order party, ticket, rate; cap after merge. Card is fetched only when the bell is mounted (DANCER_BELL_ENABLED) AND `VITE_ENABLE_PARTY_CHAT` is on; flag off = zero card calls. Card failure = no party alert, other alerts unaffected. Read mark and prune use the existing read store.
- Chat screen: send scrolls to the bottom even when scrolled up; poll in-flight guard; poll drops held messages inside the newest page's range that are absent from it (admin removals), older pages stay; Space activates a message in report mode.
- Tests added in `shell/__tests__/dancerBell.test.tsx` and `partychat/__tests__/partyChat.test.tsx`.
- File count: 6 files (brief said 5) because the handover file is required on top of 2 source files, the model file and 2 test files.

## Not verified
- No 390x844 browser walk, no real-data survey. Unit tests, full lint and bundle budget run in GitHub CI (only typecheck run in the sandbox).

## Extras noticed, NOT built
- While the card loads, the bell shows "Loading" (it waits for the card like it waits for tickets); a slow card RPC delays the whole list.
- Party alert only appears on the next card fetch (no polling), so it can lag the chat opening until the bell remounts or the query refetches.

## TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| Bell: Party chat is open | /account/party-chat/<chat_id> | prototype |
