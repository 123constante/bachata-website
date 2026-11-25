# Brief B3: "You're in" moment, phase flow, neon confetti

Repo: Website. Branch: claude/dancer-onboarding-v8-b3-flow. Size: 4 files, ~300 lines. Needs A, B1, B2 merged. Shared spec: dancer-onboarding-v8-B-screens.md.
Files (under src/modules/dancer-app/screens/onboarding/): neon/neonConfetti.ts (NEW), neon/YoureIn.tsx (NEW), OnboardingV3.tsx (EDIT: phases), __tests__/neonFlow.test.tsx (NEW).

## Phase flow (flag on)
code accepted -> phase `in` (about 2s) -> phase `peek` (sneak peek, built in Brief C1; B3 renders a placeholder slot component `<SneakPeek onFinish />` imported from the home module path C1 will fill; until C1 merges, `peek` is skipped) -> steps (Roles, Styles, Years, Partner, Photo, Bio).
Trigger: phase `in` + `peek` only when all three required fields (photo, years, styles) are missing and no `?step=` param. A session flag marks "seen" so reload does not repeat. NOT a routing change.
"Finish my profile" (sneak peek button) and the toast "Finish" button lead to Roles (pos 0).

## "You're in" screen (body top 52px)
Title `You're in, {firstName}! 🎉` Anton 30px (.fh1), margin-top 6; sub "Welcome to the London bachata scene." (use the user's city name if known, else keep text; mockup says London).
Four UNLOCKED rows (.lk): 🎉 "Bachata Sensual Social" / "Tonight 21:00 · Soho"; 💃 "Salsa y Bachata Club" / "Tonight 22:00 · Camden"; 🎓 "Beginner class + party" / "Sat 19:30 · Shoreditch"; 🤝 "Dancers looking for a partner" / "12 near you". These are mockup stand-ins: render real feed items where available, else the mockup rows. Bottom bar (.peekbar): "Make your profile shine" / "Add a bio and links so dancers know you." (button "Add bio and links", link "Go to Home" exist in the mockup but are no-ops; OWNER RULE says no button, auto-advance after 2000ms (YOURE_IN_MS). Build auto-advance, NO buttons. Open question for owner.)

## neonConfetti.ts
Replace-free: NEW module (shell/confetti.ts daConfetti stays untouched). `boom(big)` per Brief A CONFETTI_SMALL/CONFETTI_BIG:
Small: 28 pieces, colours cycle ['#ff2d95','#ffa600','#7a1fff','#fff','#2ee6a6'], start x = 195±30, top 520, size 9x14, radius 2, dx ±150, dy -(150..400), rotate 0-720deg, 1.1s, removed after 3200ms.
Big: 90 pieces, x random 0-390, top -20, dx ±100, dy 500..850, 1.8-2.8s, plus overlay "PROFILE COMPLETE!" (left/right 0, top 300px, centred, Anton 44px, white, text-shadow 0 0 30px #ff2d95, `pop` animation .6s, removed after 2600ms). Honour reduced motion (no pieces; banner static).
Wire: small burst CONFETTI_DELAY_MS (120) after forward nav from photo, years, styles, partner, and bio when bio/link filled. Big is used by Brief C2.

## Tap table
none on "You're in" (no buttons); auto-advance 2s -> peek (or Roles if C1 not merged); Back from Roles after peek -> peek.
## Tests
YoureIn keep-list copy; advances after 2000ms with fake timers; not shown twice (session flag); no `?step=` skip; confetti pieces count 28 / 90; reduced-motion = zero pieces.
## Not in scope
Sneak peek content (C1), Home (C2), auth logic.
