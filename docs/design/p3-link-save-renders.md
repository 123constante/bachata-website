# A ticket or video link the organiser can save always shows (p3-link-save-renders)

No visible layout change. The sheet, its Done button and Save already show and
disable on `linkProblem`; they now do so for more links.

## Rule chosen
For `ticket` and `video`, a link is accepted only when BOTH hold:
1. `publicUrlOk` (the server mirror: http(s), no whitespace/control chars, at most 2048), and
2. `linkRenders`: the same test as `safeExternalHref` (the function the event page uses), copied into linkRules.ts because importing `src/lib/url.ts` added a first-load chunk to /event/:id (bundle-budget ratchet 40 vs 39). The matrix test pins the two together.

A link failing (2) gets the existing `LINK_PROBLEM[kind]` text; no new copy.

## Why the server rule is left alone
The server rule is looser, which is safe: the sheet is the first gate, so a stricter
sheet never conflicts with a looser server. Tightening the server needs a migration
in the admin repo, and old rows would still exist. `src/lib/url.ts` has many readers
and is untouched.

## Known gaps, not fixed here
The same implication test (accepted by the sheet implies the page renders it) fails for
website (port too big, open bracket, angle bracket in host, userinfo only, non-numeric
port, `httpx://`), facebook (the first five) and chat (port too big). Pinned as
KNOWN_GAPS in the test. Instagram: no failing row.
