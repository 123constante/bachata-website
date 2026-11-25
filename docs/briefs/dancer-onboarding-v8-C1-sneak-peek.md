# Brief C1: Sneak peek (real Home, locked)

Repo: Website. Branch: claude/dancer-onboarding-v8-c1-sneak-peek. Size: 5 files, ~330 lines. Needs Brief A merged. Index: dancer-onboarding-v8-C-home.md. Flag: DANCER_ONBOARDING_V3_ENABLED.

## Behaviour
After the "You're in" moment (Brief B3 phase `peek`) the dancer sees the REAL Home (same HomeBodyView data, not the mockup's fake rows), clearly visible (no blur, unlike the existing ticket teaser in screens/teaser which blurs), in `locked` mode:
- Every tappable item (cards, rows, tiles, buttons, tabs/links) is non-functional and shows a 🔒 on its right.
- Title "Hi {name} 👋" (Anton 30px) at body top 52px.
- Tap on a locked item: remove then add class `.shake` (animation 0.45s ease: translateX 0, -7, 7, -5, 5, 0px); then a toast.
- Toast: left/right 20px, bottom 150px, z-index 9, bg white, text #1b1330, radius 14, padding 12 14, weight 600, shadow 0 8px 30px rgba(0,0,0,.5), opacity transition .25s; text "🔒 Finish your profile to unlock this"; button "Finish" (bg #ff2d95, white, radius 99, padding 8 14, 700 14px). Shown opacity 1, hidden after 2200ms (TOAST_MS), clearTimeout on repeat taps (restarts). Finish button -> /app/welcome step flow (Roles, pos 0).
- Bottom bar (.peekbar, gradient rgba(11,6,20,0)->rgba(11,6,20,.97) 30%, padding 16 22 28): `b` Anton 28px uppercase "Almost there, {name}"; text "Add a photo, years dancing and styles to unlock everything."; CTA "Finish my profile" -> Roles.
- Not reachable after the required fields are done (peek only when photo, years and styles are all missing; B3 owns the trigger).
Mockup stand-in rows ("Bachata Sensual Social" etc.) are NOT built; the real Home content is used.

## Files (src/modules/dancer-app/)
1. screens/home/lockedMode.tsx (NEW): `LockedHome` wrapper: renders the real Home body inside a `locked` context; intercepts clicks (capture phase), adds lock chips, shake, toast, bar. Pure CSS class `.da-locked`; no change to child components beyond a context read.
2. screens/home/locked.css (NEW)
3. screens/home/HomeScreen.tsx (EDIT: export a `HomeBodyForPeek` or accept `locked` prop; minimal)
4. screens/onboarding/OnboardingV3.tsx (EDIT: render `<LockedHome onFinish/>` for phase `peek`; coordinate with B3 slot)
5. screens/home/__tests__/lockedHome.test.tsx (NEW)
If a 6th file is needed, STOP and tell the lead.

## Tap table
Any locked item | shake + toast | mockup; Finish (toast) | /app/welcome Roles | mockup; Finish my profile | Roles | mockup; Hardware back | stays on peek.
## Tests
keep-list (title, bar copy, toast copy exact); locked click does not navigate or fire the item's handler; shake class toggles; toast hides after 2200ms and restarts on repeat tap; no blur filter applied; flag off = nothing changes.
## Not in scope
Ring card, % logic, confetti, removal of "Nothing planned yet" (C2).
