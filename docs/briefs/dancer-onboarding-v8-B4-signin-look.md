# Brief B4: sign-in and early-question screens, Neon look ONLY

Repo: Website. Branch: claude/dancer-onboarding-v8-b4-signin-look. Size: 5 files, ~380 lines. Independent of A (needs B1 for neon.css/NeonFrame). Shared spec: dancer-onboarding-v8-B-screens.md.
OWNER RULE: email and 8-digit code screens are LOOK ONLY. Auth logic, handlers, validation, rate limits, consent, redirect and test ids stay exactly as today.
Seam files (allowlisted for dancer-area PRs): src/pages/Auth.tsx, src/components/MagicLinkConfirmation.tsx, src/components/auth/AuthStepper.tsx, index.html. Everything else inside src/modules/dancer-app/.
Gate the new look behind DANCER_ONBOARDING_V3_ENABLED (flag off = byte-identical render path).

## Screens (copy exact)
Name (pos pre): "What do we call you?" / "Your first name is enough." input placeholder "First name"; Continue.
City: "Where do you dance?" / "Every city is open. Type to search."; search placeholder "Search your city"; list max-height 150px; rows 📍 18px + name with country small, padding 10 14, margin-bottom 6; footer link "Not listed? Message us and we add your city" (or "No match. Message us and we add your city" when search has no results). Use the REAL city list and existing CityCard logic; the mockup 37-city list is a stand-in. Default selection: none.
Lead/follow: "Lead, follow, or both?" / "Helps partners find you." rows Leader 🕺, Follower 💃, Both 🔄; Continue.
Email (Auth.tsx): "Where do we send your code?" / "No password. We email you 8 digits." placeholder "you@email.com"; small "By continuing you accept our Terms and Privacy." (Terms and Privacy underlined links, existing targets); CTA "Send my code".
Code (MagicLinkConfirmation.tsx): "Check your email" / "Open it on this phone and type the 8 digit code we sent."; eight code boxes (.code span height 54, 22px 800, border 1px #ff2d95, radius 10, bg rgba(255,255,255,.1)); CTA "Sign me in"; below link row "Resend code (30s) · Use a different email". KEEP the existing single real input (maxLength 8) behaviour; draw 8 boxes as a visual layer over it. KEEP existing resend/countdown/lock/expired wording and states (they are real logic; only restyle).
Roles screen look is in B1. Welcome menu (Create free account / Sign in) is NOT built here (stays prod).

## Files (suggested)
neon/NeonAuthSteps.tsx (NEW: name, city, lead-follow looks), neon/neon.css (EDIT), pages/Auth.tsx (EDIT: className/wrapper only), components/MagicLinkConfirmation.tsx (EDIT: className/wrapper only), __tests__/neonAuthLook.test.tsx (NEW). If a 6th file is needed, STOP and tell the lead.

## Tap table
Continue (name) -> city; Continue (city) -> lead/follow; Continue (lead/follow) -> email (existing destinations); Send my code -> code screen (existing handler); Sign me in -> existing verify; Resend code -> existing; Use a different email -> existing; Terms/Privacy -> existing links.
## Tests
Existing AuthCodeStep.test.tsx, AuthJourneyFixes.test.tsx, AuthConsentFunnel.test.tsx must pass UNCHANGED. New keep-list for the copy above. Flag-off snapshot equals today.
## Not in scope
Any auth/session/redirect logic, consent logic, copy outside the list, welcome menu.
