# S3 App screens: stats, views, my page, feedback, partner tile, consent (Website, branch claude/dancer-app-r1b-app from origin/main). Model: Sonnet.
Read dancer-rebuild-COMMON.md, dancer-rebuild-b1b-COMMON.md, INTERFACE section 5, and the existing screens under `src/modules/dancer-app/screens/`.

## What and why (plain words)
Give beta dancers the rest of the app: numbers on Home, a "My page" screen, real in-app feedback, and a
"tell me when partner search is ready" tile.

## Files you own
`src/modules/dancer-app/**` EXCEPT `public-page/` and `gate/useGoingLock.ts`; plus `src/lib/analytics.ts`,
`src/components/catchallClientPaths.ts`, `public/robots.txt`, `perf-budgets.json`, the `package.json` e2e spec list.

## Do
1. Home: two tiles from `my_dancer_stats_v1` / `my_profile_views_v1` ("People who looked at your page this week" and a stats strip).
   Zero data says what the dancer CAN do ("Add a photo and share your page"). Loading and error states; never NaN/undefined.
2. `/app/page` (add to the routes, catchallClientPaths, robots Disallow): says in words how the public page looks and has a button
   "View my page" (opens `/dancers/<slug>`; disabled WITH a reason when the profile is not public yet or paused) plus Share.
   Do NOT import S2's component. Bottom tabs unchanged; reach it from Me and Options.
3. Options: replace the WhatsApp feedback row with an in-app form: text box (max length per the RPC), kind chips, send via
   `submit_feedback_v1` with `p_page` = current route. Map `rate_limited` -> "You've sent a few today, try again tomorrow",
   `area_closed`, and offline. Keep the WhatsApp "message us" row as a separate help row. Fire `feedback_sent` once on success.
4. Home partner tile: "Partner search: coming soon" with "Tell me when it's ready" via `register_feature_interest_v1('partner_search')`;
   after success (or `my_feature_interest_v1()` already true) show "We'll tell you" and disable the button.
5. Consent: B1a already shows the terms line and `src/lib/termsConsent.ts` exists. Prove by test that a first app visit writes one
   consent and a second writes none (mock rpc); fix only a gap you can prove. Report what you found.
6. Add the new RPCs to `api/rpc.ts`, `api/types.ts`, `api/fakeBackend.ts` (named fixtures for every shape: zero, normal, huge counts,
   error). Table test: every screen x every shape reads the same numbers through ONE mapping.
Boundaries: no PR, no merge. Stop after the push.
