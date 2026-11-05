# Walk: checklist "read failed" screen, PR #1320 (claude/p3-checklist-back-1)

Date 2026-11-04. Viewport 390x844, Chromium (Playwright, headless, run on the orchestrator PC, one worker).
Every server answer is a `page.route` mock (no prod access): `organiser_onboarding_status_v1` returns HTTP 500 on every read.
Route: `/account/p3/start?o=<org>&at=review` with and without `&back=/account/p3/events/<id>`.
Flags: `VITE_ENABLE_ORGANISER_SELF_SERVE=true`, `VITE_ENABLE_ORGANISER_P3=true`. The spec is not committed (kept out of the fast lane).

| Picture | Arrival | Result |
|---|---|---|
| `with-back.png` | valid event in `?back=` | "We couldn't load your page. Try again." with **Try again** (filled) and **Back to your event** (outlined), both 358x52 px; no sideways scroll (0 px). Tapping Back to your event opens `/account/p3/events/<id>`. |
| `no-back.png` | no `?back=` | Same message and **Try again** only; no second button; no sideways scroll (0 px). |

Both pictures were opened and looked at.

Seen, not changed (identical with and without the new button, so not part of #1320):
- The heading says "Welcome" on this failed Review read, and shows a visible focus box (the heading takes focus on arrival).

Not verified: iOS safe-area at the bottom edge (Chromium cannot emulate it); a real phone; the home-read and no-page failed screens (same `failed()` helper, covered by the jsdom table test, not pictured).
