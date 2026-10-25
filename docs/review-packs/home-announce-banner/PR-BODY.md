## Summary
- Adds a home-page announcement banner (`HomeAnnounceBanner`) that ships OFF behind the single constant `HOME_ANNOUNCE_BANNER_ON = false`. OFF renders nothing and changes no layout.
- Mounted only in `Index.tsx`. CTA links to the existing dancer sign-up (`/auth?mode=signup&userType=dancer`). Dismiss is remembered in localStorage and still hides for the visit when storage is blocked.
- This update merges main (new isolation-check scope) and fixes the phone-qa spec: it read the stylesheet from `build/client/assets`, but the phone-qa job runs no build, so it failed there. It now fetches the app's compiled CSS from the dev server the suite already runs.

## Phone QA
- Sizes checked: 390x844 and 360x640 (phone suite, banner ON and OFF)
- Walked: the banner mounted in a harness (the real home page cannot show it while OFF) and styled with the app's own compiled CSS: CTA and Dismiss are at least 44px tall, banner under 120px tall, no sideways scroll, Dismiss hides it and persists; OFF renders nothing and the calendar placeholder stays visible.
- Not verified: a real phone; the full home page with the banner ON (page-level layout); colour contrast was not measured by a tool (black text on the orange primary).

## Verified on real data
- Shapes surveyed: none needed. The banner reads no database data (only a localStorage flag), so no Supabase query was made.
- Checks run: unit tests for the banner, typecheck, dancer-area isolation check, phone suite for the announce-banner spec at 390x844 and 360x640, production build. See HANDOVER.md for the per-job table.
- NOT verified: a real phone; the banner ON on the live home page; the live-DB contract tests, which cannot run without network.
