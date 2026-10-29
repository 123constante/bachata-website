# Brief: independent review of Website PR #1143 (login dead ends F1 + F2), read-only

You did not build it. Review `claude/p3-login-deadends` (head 00f6627) against `main`: 18 files, about +100/-28, routing and copy. Change no code.

Owner intent: F1 = the invite Done screen must not dead-end on the homepage when `organiserSelfServe` is OFF (show an honest end state with one next step). F2 = retired targets `/create-organiser-profile` and `/listing-request` must no longer be linked; sign-in and join links go to the working listing route. Sign in, organiser area and onboarding switch on together LATER, so nothing here may turn anything on.

Check: (1) every changed link target exists as a route; grep the whole repo for remaining uses of the two retired paths; (2) the flag-off and flag-on branches of DoneScreen both render sensibly and the tests assert both; (3) nothing else changes landing behaviour after sign-in with the flag ON (compare `landingPathAfterAuth` before/after); (4) copy: British English, no text pointing at a missing control; (5) the updated authCallback regression test is a real expectation, not loosened to pass.

Output: `docs/reviews/review-1143-r1.md` on branch `claude/review-1143-r1`: verdict PASS / PASS with should-fix / FIX FIRST, numbered findings with severity and file:line, Not verified. Docs-only; push once, subject ending `[worker-done <ticket>]`. Opus, normal lane.
