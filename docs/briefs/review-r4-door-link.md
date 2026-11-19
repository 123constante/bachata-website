# Review: Website PR #1800 (R4 door invite link), hard tier (grants door seat)

Review PR #1800 (branch feat/organiser-r4-door-link) at its current head. Read-only: change nothing, push only your review doc.

Check, with file:line evidence:
1. DoorJoinPage never logs or leaks the token (console, referrer, URL after use, analytics). Malformed token never reaches the server.
2. Every ticket_door_seat_accept_v1 and ticket_door_seat_invite_v1 result value is handled; no client-side widening of who may scan. SeatDoorPage grants nothing itself.
3. Seat-only door has no path into /account/p3 or any organiser screen; all exits go to "/".
4. Sign-in-then-accept: isDoorReturnTo only keeps door paths (no open redirect). returnTo cannot point off-site.
5. Invite mint only on tap, only for the chosen night; stale mint dropped.
6. /door/* routes live with organiserR4 off: confirm nothing else is exposed.
7. Tests cover the above; flagOff and catchall guards still true.

Write docs/review/review-pr-1800.md on your branch with these EXACT headings on their own lines: `## Verdict: PASS` (or PASS WITH NITS / BLOCK), `## Hard-tier: PASS` (or FAIL with reason), and a line `head <full sha reviewed>`.
