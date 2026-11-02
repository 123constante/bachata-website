# Walk S1 errors r1: /organisers/:slug at 390x844 (PR #1282 branch claude/organiser-public-s1-errors)

Mocked network only (SSR via tests/walk-s1/preload.mjs, browser via page.route); no prod calls, no src edits. Spec: `tests/walk-s1/organiser-s1-errors.spec.ts`, run: `npx playwright test --config playwright.walk-s1.config.ts`. Raw data: results.json. A failing feed answers HTTP 500 until Try again is tapped, then answers normally.

**Verdict: no findings.** No state shows a false 0 or a false empty box. Every failed feed has no stat and an error line with a 44px Try again that recovers.

| # | State | Stats strip shown | Section shown | Try again (once) | Pass |
|---|---|---|---|---|---|
| 01 | all ok, upcoming + past | 3 UPCOMING DATES / 4 PAST NIGHTS / 2 TEAM MEMBERS | Upcoming list, Past list, Team | n/a | pass |
| 02 | upcoming feed fails | 4 PAST NIGHTS / ~1 YRS ACTIVE | Past list; error line: Couldn’t load dates. Try again | tap 85x44; errors left: none; stats after: 3 UPCOMING DATES / 4 PAST NIGHTS / ~1 YRS ACTIVE | pass |
| 03 | past feed fails | 3 UPCOMING DATES / ~1 YRS ACTIVE | Upcoming list; error line: Couldn’t load past dates. Try again | tap 85x44; errors left: none; stats after: 3 UPCOMING DATES / 4 PAST NIGHTS / ~1 YRS ACTIVE | pass |
| 04 | events feed fails (both lists) | (strip empty, no numbers) | error line: Couldn’t load dates. Try again | Couldn’t load past dates. Try again | tap 85x44; errors left: none; stats after: 3 UPCOMING DATES / 4 PAST NIGHTS / ~1 YRS ACTIVE | pass |
| 05 | team roster fails | 3 UPCOMING DATES / 4 PAST NIGHTS / ~1 YRS ACTIVE | Upcoming list, Past list; error line: Couldn’t load the team. Try again | tap 85x44; errors left: none; stats after: 3 UPCOMING DATES / 4 PAST NIGHTS / ~1 YRS ACTIVE | pass |
| 06 | all fail | (strip empty, no numbers) | error line: Couldn’t load dates. Try again | Couldn’t load past dates. Try again | Couldn’t load the team. Try again | tap 85x44; errors left: past,team; stats after: 3 UPCOMING DATES / ~1 YRS ACTIVE | pass |
| 07 | real empty: no events | 0 UPCOMING DATES / 0 PAST NIGHTS / -- SINCE | empty box "No nights listed yet Walk S07 hasn’t lis…" (none) | n/a | pass |
| 08 | real empty: past only | 0 UPCOMING DATES / 4 PAST NIGHTS / ~1 YRS ACTIVE | Past list; empty box "No upcoming nights Walk S08 has nothing …" (past-only) | n/a | pass |
| 09 | claimed owner, no bio | 3 UPCOMING DATES / 4 PAST NIGHTS / ~1 YRS ACTIVE | Upcoming list, Past list | n/a | pass |

Pictures (full page, beside this file): [01](01-all-ok.png), [02](02-up-fail.png), [03](03-past-fail.png), [04](04-events-fail.png), [05](05-team-fail.png), [06](06-all-fail.png), [07](07-empty-none.png), [08](08-empty-past-only.png), [09](09-owner-no-bio.png); after a retry: [02](02-up-fail-after-retry.png), [03](03-past-fail-after-retry.png), [04](04-events-fail-after-retry.png), [05](05-team-fail-after-retry.png), [06](06-all-fail-after-retry.png).

## Measurements
| # | Taps under 44px | Sideways scroll | Axe contrast violations (lowest ratio) | Console errors (other than expected failed-load lines) |
|---|---|---|---|---|
| 01 | none | none | 0 | Warning: Extra attributes from the server: %s%s nonce  |
| 02 | none | none | 0 | Warning: Extra attributes from the server: %s%s nonce  ; Query error: Error: walk: feed failed |
| 03 | none | none | 0 | Warning: Extra attributes from the server: %s%s nonce  ; Query error: Error: walk: feed failed |
| 04 | none | none | 0 | Warning: Extra attributes from the server: %s%s nonce  ; Query error: Error: walk: feed failed |
| 05 | none | none | 0 | Warning: Extra attributes from the server: %s%s nonce  ; Query error: Error: walk: feed failed |
| 06 | none | none | 0 | Warning: Extra attributes from the server: %s%s nonce  ; Query error: Error: walk: feed failed ; Query error: Error: walk: feed failed ; Query error: Error: walk: feed failed ; Query error: Error: walk: feed failed |
| 07 | none | none | 0 | Warning: Extra attributes from the server: %s%s nonce  |
| 08 | none | none | 0 | Warning: Extra attributes from the server: %s%s nonce  |
| 09 | button "Edit city" 32x44; button "Edit year started" 32x44; button "Edit category" 32x44 | none | 3 (4.12 li[data-eip-link="instagram"] > span[title=""]) | Warning: Extra attributes from the server: %s%s nonce  |

## Notes
- Real zeros are correct: state 07 and 08 show "0" because the feeds answered an empty list, with the normal empty box beside it. State 07's third stat is "-- SINCE" (no events to date it).
- Failed feeds hide only their own stat: 02 keeps Past nights, 03 keeps Upcoming dates, 05 keeps both, 04 and 06 lose both (the third stat is derived from the events feed, so it goes too).
- 06 (all fail): one tap refetches only that section's feeds; after tapping the first line, Upcoming recovers and the Past and Team lines remain (three separate taps for full recovery). By design, not a defect.
- Tap targets: only the owner view (09) has any under 44px: three hero pencils, 32 wide by 44 high (height meets the bar). The sr-only "Skip to content" link is ignored. Try again is 85x44 everywhere.
- Contrast: automated axe violations are 0 on visitor views only where axe could compute; 12 to 23 nodes per page are "incomplete" (text over the gradient hero, not measurable). Owner view 09: 3 violations, lowest 4.12:1 on the Instagram row (`li[data-eip-link="instagram"] > span`), in the owner edit layer, not S1 code (not part of this PR's diff).
- Console: every state logs the dev-only React hydration warning "Extra attributes from the server: nonce" (all states incl. healthy, not S1). Failing states add "Query error: ..." lines (the thrown feed errors, expected) and failed-load 500s (counted separately). The dev server's own log prints the SSR loader's thrown feed errors, as designed (not dehydrated).

## Verified / Not verified
Verified: the 9 states above on the dev server at 390x844 with mocked data, SSR and client both mocked consistently, retry recovery.
Not verified: real production data shapes (no Supabase survey run), production build (dev server only), 360px, slow-network or partial-timeout failures (only HTTP 500), the loader's cache headers on a failing feed.
