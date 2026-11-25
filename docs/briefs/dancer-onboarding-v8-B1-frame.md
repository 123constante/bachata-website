# Brief B1: Neon frame + Roles, Styles, Years

Repo: Website. Branch: claude/dancer-onboarding-v8-b1-frame. Size: 5 files, ~380 lines. Needs Brief A merged. Shared spec: dancer-onboarding-v8-B-screens.md (read it first, copy values from it).
Flag: DANCER_ONBOARDING_V3_ENABLED only.

## Files (under src/modules/dancer-app/screens/onboarding/ unless stated)
1. neon/NeonPhoto.tsx (NEW): SVG background `photo(d,id)` copied verbatim from the mockup (radial gradient, blurred bokeh, two silhouettes) + overlay gradient.
2. neon/NeonFrame.tsx (NEW): phone frame wrapper: photo bg, segment bar (6, 4px, gap 4, 20px inset, top 20), Back button, body slot with `top` prop (300 default, 215 years). Props: pos, total, onBack, top, children.
3. neon/neon.css (NEW): all tokens/classes from shared spec, scoped `.neon`.
4. neon/NeonSteps.tsx (NEW): RolesNeon, StylesNeon, YearsNeon reusing handlers/state from stepsV3.tsx (import helpers, do not copy logic).
5. index.html (EDIT, allowlisted seam): add Anton font link. Do NOT edit src/main.tsx.
(OnboardingV3.tsx wiring edit counts as the 6th touch: keep within 400 lines by wiring only these 3 steps to render NeonFrame+NeonSteps when flag on; if over 5 files, split wiring into the B1 PR body note and use a minimal 3-line import in OnboardingV3.tsx. Size line is a hard cap: if exceeded, STOP and tell the lead.)

## Element checklist
Roles (pos 0): h2 "Who's hitting the floor?"; sub "Pick all that fit. Change anytime."; 4 rows: dancer-emoji Dancer / "Find nights and partners"; ticket-emoji Organiser / "Run events and classes"; graduation-emoji Teacher / "Share your classes"; headphones-emoji DJ / "Play at nights"; tick circle each; multi-pick; CTA "Continue" disabled when none picked. Emoji exactly: 💃 🎟️ 🎓 🎧.
Styles (pos 1): h2 "Which styles do you dance?"; sub "Pick at least one."; chips (live styles from FAVORITE_STYLE_OPTIONS, NOT the mockup's fake 6: Bachata Sensual, Moderna, Tradicional, Salsa On1, On2, Kizomba, Zouk; keep real values, mockup look); Continue disabled until one picked. (Decision: real data wins over mockup fake list; tell owner in PR.)
Years (pos 2, body top 215px): h2 "How long have you danced?"; sub "Required. We store the year you started."; rows with calendar emoji 📅: "Under 1 year", "1 to 2 years", "3 to 5 years", "6 to 10 years", "Over 10 years" (store via yearForBandV3, existing); Continue disabled until picked.
Photo background on all three. Segment bar and Back as shared spec. Confetti: 120ms after Continue on styles and years (hook into celebratesOnLeave; confetti module itself arrives in B3, so B1 only calls the existing prop/callback).

## Tap table (fill in PR)
Back | previous step (Roles: no Back) | mockup
Role row | toggles tick | mockup
Continue (roles) | styles | mockup
Style chip | toggles | mockup
Continue (styles) | years, confetti | mockup
Year row | single pick | mockup
Continue (years) | partner (or photo if not dancer) | mockup

## Tests (block merge)
- neon roles/styles/years keep-list: heading, sub, row count + order + icon + title + sub, disabled states, no Skip.
- existing onboardingV3.test.tsx stays green with flag off AND the same assertions with flag on where selectors are test ids.

## Not in scope
Partner, Photo, Bio, You're in, sign-in screens, Home.
