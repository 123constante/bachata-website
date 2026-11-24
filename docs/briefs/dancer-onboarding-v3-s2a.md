# Dancer onboarding v3, UI slice 2a: v3 shell, roles, styles, years, resume rule

Repo: 123constante/bachata-website
Branch: claude/dancer-onboarding-v3-s2a
Size: 4 files, 390 lines (incl. tests)

## Goal
Behind `VITE_ENABLE_DANCER_ONBOARDING_V3`, /app/welcome renders a new one-question-per-screen shell with a 6-segment progress bar and Back, showing roles, styles and years (required, one screen each) with the resume rule. Flag off = today's onboarding, unchanged.
Branch from `main` AFTER slice 1 (`claude/dancer-onboarding-v3-s1`) merged. If `modelV3.ts` / `onboardingV3Flag.ts` are missing on main, STOP.

## Design pointer
DESIGN-REGISTRY row "Dancer onboarding" (`~/.claude/plans/DESIGN-REGISTRY.md`). The owner pick beats any older issue.
Prototype: v8 https://claude.ai/artifact/DczcxwnM3jCErXLCQkX5Dv (repo copy: admin repo `docs/design/dancer-onboarding/mockup-v8-after-code.html`, screens `i==1`, `i==11`, `i==10`, the `seg` bar and `back` button in `render()`). Home card (not this slice): https://claude.ai/artifact/37jjwbd4jdV5r6ooMKYnCB.

## Files (verified on origin/main unless NEW)
- EDIT `src/modules/dancer-app/screens/onboarding/OnboardingScreen.tsx` (exports default `OnboardingScreen`, ~l.204): `DANCER_ONBOARDING_V3_ENABLED ? <OnboardingV3 /> : <existing tree>`. Nothing else in the file changes.
- NEW `src/modules/dancer-app/screens/onboarding/OnboardingV3.tsx`: shell. Reads `useMyDancerEdit({ refetchOnMount: 'always', retry: false })` like `OnboardingCards`; progress bar; Back; step driver from `modelV3.ts` (`stepsFor`, `resumeStep`, `celebratesOnLeave`); saves via `save(diffDelta(profile, delta), profile)` and `saveMyBuyerRoles` (`api/rpc.ts`); `daConfetti()` from `../../shell/confetti` on celebrate; end = `onboardingEnd(returnTo)` + `leaveFor` pattern (replace history) from the existing file (copy the 3-line helper, do not export-refactor the old file).
- NEW `src/modules/dancer-app/screens/onboarding/stepsV3.tsx`: `RolesCardV3`, `StylesCardV3`, `YearsCardV3`. Reuse `ui.tsx` (`Question`, `PrimaryButton`, `Chip`, `Reason`, `ErrorLine`, `Tag`, `WRAP`) and `Card` from `@/modules/organiser/ui`. Years use `YEAR_BANDS_V3` from modelV3.
- NEW `src/modules/dancer-app/screens/onboarding/__tests__/onboardingV3.test.tsx`: copy the harness of `__tests__/onboarding.test.tsx` (fake backend, `renderInShell`).
- Pre-steps: while `strength.missing` still contains `first_name`, `city` or `role`, the shell shows the EXISTING `NameCard` / `CityCard` / `RoleCard` from `./steps` unchanged (the sign-up questions before the code are not this slice), then continues in v3 order.
- After `years` this slice ends the flow (`leaveFor(... onboardingEnd(returnTo))`); partner/photo/bio arrive in s2b / s3. Mark that spot `// s2b replaces`.

## Prototype checklist
Shell
- [ ] 6 progress segments at the top (`seg`), segments `0..position` filled; hidden when position >= 6.
- [ ] "‹ Back" button on every step after the first; goes to the previous step in `stepsFor(...)`, keeps what was typed; first step has no Back.
- [ ] One required question per screen; Continue disabled until the screen's rule holds (slice-1 rules).
- [ ] Small confetti when leaving `styles` and `years` going forward (`celebratesOnLeave`); none on `roles`, none going Back; no confetti under reduced motion (`daConfetti` already no-ops).
- [ ] Resume: reopening /app/welcome (or a refresh) lands on the first step still missing on the server; all required done = `onboardingEnd` (Home), no flash of a card.
Roles screen (`i==1`)
- [ ] Heading "Who's hitting the floor?", sub "Pick all that fit. Change anytime."
- [ ] 4 multi-pick rows, in this order, each with icon, title, one-line sub, tick when on: "Dancer" / "Find nights and partners"; "Organiser" / "Run events and classes"; "Teacher" / "Share your classes"; "DJ" / "Play at nights". Icons in the prototype are 💃 🎟️ 🎓 🎧; use the repo's icon set (lucide) if emoji are not used elsewhere in the dancer app and list this in the handover.
- [ ] Dancer is ticked first when the person has no saved roles (prototype `S.roles=new Set(['Dancer'])`); a saved answer reopens as saved.
- [ ] "Continue" disabled with 0 picked; saves via `set_my_buyer_roles_v1` (`saveMyBuyerRoles`, labels `dancer|organiser|teacher|dj`); unchanged set sends nothing; error line uses `toDancerError` copy.
Styles screen (`i==11`)
- [ ] Heading "Which styles do you dance?", sub "Pick at least one." Multi-pick chips, "Continue" disabled with none; saves `favorite_styles`.
- [ ] Chip LABELS: the prototype shows Sensual, Dominican, Moderna, Urban, Fusion, Traditional but the live vocabulary is `FAVORITE_STYLE_OPTIONS` in `src/components/profile/dancerConstants.ts` (Bachata Sensual, Bachata Moderna, Bachata Tradicional, Salsa On1, Salsa On2, Kizomba, Zouk), loaded via `useLazy` as `StylesCard` does. Use the live list; write "style labels differ from prototype (owner click needed)" at the TOP of the handover.
Years screen (`i==10`)
- [ ] Heading "How long have you danced?", sub "Required. We store the year you started."
- [ ] 5 single-pick rows (calendar icon, tick): "Under 1 year", "1 to 2 years", "3 to 5 years", "6 to 10 years", "Over 10 years"; "Continue" disabled until one is picked; saves `dance_started_year` from `YEAR_BANDS_V3`; reopens ticked via `bandForYearV3`.
- [ ] No "Skip" on styles or years (the old cards had one; v3 does not).
Not built here (list at top of handover): the Neon Night look (full-bleed photo backdrop, Anton headings, pink/orange gradient). The shell uses today's dancer-app card look. If the owner wants the Neon skin, it is a separate decision.

## Rules
- No schema/RPC edits; no change to `profile_complete_v1`, the gate or `strength`. Client enforces styles + years; `useDancerArea` / gate untouched.
- Flag-off behaviour equals today's exactly: test that with the flag off `OnboardingScreen` renders the existing cards and the existing onboarding tests pass unmodified.
- Per-screen unit keep-list test: for each of roles / styles / years assert every heading, sub line, option, tick, button and disabled state in the checklist.
- Any tap that leaves the prototype (an old page, today's screen) = not done. End the handover with a TAP TABLE: button | destination | prototype/OLD. One OLD row = keep building, no "remaining differences" list.
- An element you cannot build: STOP and write it at the TOP of the handover.
- PR body carries the tap table. Never merge. Over size: stop at a clean boundary, write `PARTIAL [worker-done]`.

Owner decisions 2026-11-24 (click): use today's card look (Neon skin NOT built here); use the LIVE style list FAVORITE_STYLE_OPTIONS; Home card goes in the Layout C Home (HomeCView).
