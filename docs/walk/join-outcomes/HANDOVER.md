# Handover: walk-join-outcomes-r1

Done: `tests/e2e/walk-join-outcomes.spec.ts` (not in the CI gate), 32 pictures `NN-<outcome>-<entry>.png`, `INVENTORY.md`, `RESULTS.md` (table per case). No product code changed.
Run: `npx playwright test tests/e2e/walk-join-outcomes.spec.ts --project=chromium --workers=1` then rebuild RESULTS from the rows (the spec appends `rows.tmp`; sort it into RESULTS.md).
Result: 24 pass, 8 fail the bar, all the SAME bar: "exactly one primary action" counts 0 on screens whose only controls are ghost buttons/links (not a layout break; no sideways scroll, no <44px control, "we've told" only on not_linked, anywhere):
- not_linked (05, 20): single ghost "Try a different email", no home link. JoinScreens.tsx:292-301
- dead / invalid (09, 24): ghost Home only, no ask-for-new-link. JoinScreens.tsx:190 (offerNewLink false for invalid)
- rate_limited (10, 25): Try again is primary but DISABLED (waits an hour), Home ghost. JoinScreens.tsx:251 / ReasonActions :213
- unconfirmed_account (12, 27): ghost Home only. StopScreen :313 (action 'home')
Each has a live control (the bar "live control" passes). Whether ghost-only is a defect or intended is a product call.
Send my code: enabled with an empty box and shows "Use an email like name@example.com." on tap, signed-out and person-bound (31, 32): pass.

Verified: 30 outcome cases + 2 send-code cases at 390x844 against route-mocked RPCs; viewed pictures 05 and 12.
Not verified: profile_incomplete (13, 28) lands back on Join, not About, because the fake reports a complete profile (fixture limit, not a product finding); sign_in (14, 29) lands on the email step; bind/send rate-limit, blocked_domain, already_bound screens; real prod data shapes, real Supabase, real devices (the fake is seeded fixtures only); only 2 of 32 pictures were opened by me, the rest are asserted not eyeballed.
