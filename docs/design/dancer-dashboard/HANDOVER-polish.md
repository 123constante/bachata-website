# Handover: dancer dashboard option B polish (admin #1537, ticket dt_6e9cb71167a2)

Branch `claude/profile-dash-design-polish` (from main @ cdbf2c4). Docs / design only.

## Done
- `INVENTORY-polish.md` (separate name: PR #1561 adds its own INVENTORY.md) written FIRST: 72 items (dancer profile fields, states, Website dancer app screens, account settings, public page, NEW: profile switch rows 63-72), file:line cited, GAPs G-1..G-8.
- `option-b-polished.html`: 8 frames at 390x844: new, partial, saveOff (D2 Save-untouched detail), complete, completeEmpty, unclaimed, switch, addProfile.
- `polish.md`: tokens, 11 decisions, alternatives rejected, checks table, coverage (69 / 72).
- `shots/b-polished-*.png` (8) + `shots/check-polish.cjs` (rerun: `node docs/design/dancer-dashboard/shots/check-polish.cjs` from repo root; it rewrites the shots).

## Left / next steps
- profile-dash runs the Opus critique on `option-b-polished.html` + `polish.md`.
- Owner calls: G-2 click-claim (needs a server RPC; today claim is automatic), G-7 DJ as a profile side, G-8 "+ Add a profile" destinations and the "Teach or DJ? Message us" copy.
- PR #1561 (option round) is still open; this branch does not depend on it.

## Verified
- Inventory citations re-read on main @ cdbf2c4 (types.ts, nextStep.ts, claimMyDancerProfile.ts, EditScreen.tsx, optionsModel.ts, ProfileSwitcher.tsx, SwitcherGate.tsx, accountRouting.ts, SideAvatar.tsx, ContinueAsPage.tsx).
- Prod read-only SELECT (counts only): 183 profiles, 169 unclaimed (35 with email), 14 claimed (0 without photo / city), 0 paused, longest first_name 21 chars (drawn).
- Playwright Chromium 390x844, 8 frames: 72 tap targets, 0 under 44px; min text contrast 5.06:1; scrollWidth 390 everywhere; 0 clipped; 0 cut by the tab bar; both disabled controls carry a reason.
- `npm run check:mojibake`: clean. File is ASCII + HTML entities only.

## Not verified
- Admin app dancer-profile screens: `bachata-admin-11april` could not be attached ("you don't have access"); G-6 uses the prod column list instead.
- No real phone; contrast measured by a script on computed colours, not an external a11y tool; SVG icons have no contrast rule applied (decorative).
- No app code, so tsc / unit / e2e were not run (nothing to type-check); no Vercel preview of this HTML (docs are not routed).
- Copy not reviewed by the owner; no independent design critique yet.
