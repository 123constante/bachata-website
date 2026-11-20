# Handover: dancer layout C S3 (Sign out at the foot of Account settings)

Nothing in the brief was unbuildable.

## What changed
- `src/pages/AccountSettings.tsx`: `QuietSignOut` now shows when `flags.dashboardSwitchR4 || DANCER_LAYOUT_C_ENABLED`; the card "Sign out" button inside `SignOutSection` is hidden by the same condition (default `quiet` prop). The section keeps its "Signed in as" line and "Sign out of all devices" where they were. Exactly one Sign out control, last on the page. Same copy and behaviour, no new component.
- `src/modules/dancer-app/screens/home/layoutCFlag.ts`: S1 (PR #1872, branch `claude/dancer-layout-c-s1`) had not landed on main, so I created the identical file from that branch (byte copy). Merge S1 first or either order is fine (identical content).
- `tests/client/AccountSettingsSignOutC.test.tsx` (new). **Deviation from the brief path** (`src/pages/__tests__/`): `check-dancer-area-isolation.mjs` goes red for a new file there (not a seam); `tests/**` is exempt. Not adding a seam: that is an orchestrator decision.

## Coverage
coverage 5 of 5 checklist lines built (flag-on single link at bottom; tap -> "Sign out?" two-step -> signOutToHome; failure shows SIGN_OUT_FAILED; card section button gone; Sign out of all devices unchanged; flag off unchanged).
Test matrix C x R4 (4 cases) counts controls, checks position, plus flow and failure. Red on old source: 2 of 6 fail (C on, count/position and the confirm flow), verified by stashing the source change.

PR: #1873

## Checks
tsc run on branch head: 0 errors in branch files. `npm run check:mojibake` clean. `check-dancer-area-isolation.mjs` clean. Existing `AccountSettings.test.tsx` 52/52 pass.

## Not verified
390x844 browser walk (needs auth + Supabase session; not available to this worker). Vercel env value for VITE_ENABLE_DANCER_LAYOUT_C not checked (flag is off by default).

## TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| Sign out (quiet link, page foot, flag C) | "Sign out?" confirm step | prototype |
| Yes, sign out | signs out, leaves to home | OLD (existing QuietSignOut) |
| Stay signed in | back to the link | OLD |
| Sign out of all devices | existing sheet | OLD |
| Sign out (card button, flag C off) | existing two-step | OLD |
