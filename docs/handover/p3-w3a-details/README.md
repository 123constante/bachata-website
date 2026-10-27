# Handover folder: P3 W3a "Name and details" + "Prices" (PR #1082), 2026-10-27

- `walk.phone.spec.ts.txt`: the throwaway 390x844 walk (W2a style); how to re-run is in its header.
- `shapes.json`: the workspace payloads it serves (`wsFixtures.ts` SHAPES plus `festival` (long About),
  `badTicket` (stored link that breaks the rule, chat + Instagram + video set), `ownerPasses`, `teamPasses`;
  stand-in names only).
- 30 PNGs and `metrics.jsonl` (28 rows): 0 sideways scroll, min tap 44px, 0 clipped text, 0 axe colour-contrast
  violations. The prices rows and PNGs are from a re-run after the "It's free" card border fix.
- Design record: `docs/design/1082.md`. Session handover: `docs/session-handover-2026-10-27-p3-w3a-details.md`.
- Review round 1 (2026-10-27): re-walked at 390x844 light + dark the states whose pixels changed: 01/02 (re-shot),
  `16-details-cover-*` (cover picker is now a normal button, r1 #7) and `17-details-city-fail-*` (the place's city
  lookup failed: plain words, Try again, Save held, r1 #3). 8 more metrics rows tagged `"round":"r1"`: 0 sideways,
  min tap 44px, 0 clipped, 0 contrast violations. The spec now has the r1 test.
- Review round 3 (2026-10-27): re-walked at 390x844 light + dark only the states whose pixels changed:
  `18-details-chat-problem-*` (a link the server's group-chat rule refuses, r3 #4), `19-details-banner-*` (the "someone else
  saved" copy now says the save will be refused, r3 #3), `20-prices-profile-lock-*` (Prices profile lock, r3 #5). 6 more metrics
  rows tagged `"round":"r3"`: 0 sideways, min tap 44px, 0 clipped, 0 contrast violations. Walk: `walk-r3.phone.spec.ts.txt`
  (same harness and run line as `walk.phone.spec.ts.txt`).
