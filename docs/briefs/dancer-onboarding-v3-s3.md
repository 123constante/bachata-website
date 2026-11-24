# Dancer onboarding v3, UI slice 3: bio + links step, "Make your profile shine" Home card

Repo: 123constante/bachata-website
Branch: claude/dancer-onboarding-v3-s3
Size: 5 files, 360 lines (incl. tests)

## Goal
Behind `VITE_ENABLE_DANCER_ONBOARDING_V3`: (1) the optional bio + link screen as the last onboarding step; (2) a Home card under "1 night attended" and above "Be found" with a bio/link nudge, an Add button and a dismiss cross, shown to every role while bio or links are missing. Add opens the same bio+links screen. Flag off = today's Home and onboarding unchanged.
Branch from `main` AFTER s2b merged (`claude/dancer-onboarding-v3-s2b`: shell + partner + photo exist, markers `// s3 inserts bio`). If absent, STOP.

## Design pointer
DESIGN-REGISTRY row "Dancer onboarding" (`~/.claude/plans/DESIGN-REGISTRY.md`). The owner pick beats any older issue. Owner picked Home card OPTION A.
Prototype: v8 https://claude.ai/artifact/DczcxwnM3jCErXLCQkX5Dv (repo copy: admin repo `docs/design/dancer-onboarding/mockup-v8-after-code.html`, screen `i==12`); Home card https://claude.ai/artifact/37jjwbd4jdV5r6ooMKYnCB (repo copy: `plans/home-profile-card-mockup.html` in the admin repo, `card('A')`).

## Where the real Home lives (verified on origin/main)
`/account/dancer` redirects an allowed dancer to the dancer app Home `/app/home` = `src/modules/dancer-app/screens/home/HomeScreen.tsx`. The screen with "Hi", GO OUT, "N nights attended" and "Be found" is Layout C: `HomeCView` in `src/modules/dancer-app/screens/home/homeOptionB.tsx` (behind `DANCER_LAYOUT_C_ENABLED`, `layoutCFlag.ts`). `src/components/account/DancerHome.tsx` is the OLD page: do NOT touch it. The card goes in `HomeCView` only. If Layout C is off in prod, say so at the top of the handover (the card then never shows); do not add it to the A/B layouts.

## Files (verified on origin/main unless NEW)
- EDIT `src/modules/dancer-app/screens/home/homeOptionB.tsx`: in `HomeCView`, render `<ShineCard profile={profile} />` right after the `{rows && (<Card ... home-c-go-rows>)}` block and before `<Head testId="home-c-head-found">`, only when `DANCER_ONBOARDING_V3_ENABLED`. Nothing else in the file changes.
- NEW `src/modules/dancer-app/screens/home/ShineCard.tsx`: the card, missing rule, dismiss rule.
- EDIT `src/modules/dancer-app/screens/onboarding/stepsV3.tsx`: add `BioLinksCardV3`.
- EDIT `src/modules/dancer-app/screens/onboarding/OnboardingV3.tsx`: insert `bio` after `photo` at the `// s3 inserts bio` marker; handle `?step=bio` (open only that step, even when the profile is otherwise complete; Finish and Skip both go to `onboardingEnd(returnTo)`, default `/app/home`). Check `onwardReturnTo` in `src/lib/accountRouting.ts` accepts `/app/home` as `returnTo`; if it refuses, STOP and report.
- NEW `src/modules/dancer-app/screens/home/__tests__/shineCard.test.tsx` (bio step tests may live here too).
- Reuse: `useAuth` (`@/hooks/useAuth`), `Card` (`@/modules/organiser/ui`), the Edit screen's field handling for `bio`, `instagram`, `website_url` (`screens/edit/fields.tsx`, `api/errors.ts` instagram refusals) so the link input saves exactly like Edit does; `trackDancerEvent` only if the existing events list already fits (no new event names).

## Prototype checklist
Bio + links screen (`i==12`, onboarding style)
- [ ] Heading "Tell us about you", sub "Optional. Skip any time."
- [ ] Multi-line input, placeholder "A short bio (optional)", 3 rows -> `bio`.
- [ ] Single-line input, placeholder "Instagram or other link (optional)" -> an Instagram handle/URL goes to `instagram`, any other URL to `website_url` (same normaliser as Edit); a refusal shows the existing error copy under the field.
- [ ] Primary button "Finish": saves only the changed keys; empty inputs send nothing; then Home. Text button "Skip for now": Home, no save.
- [ ] Confetti only when Finish saved a bio or a link (`celebratesOnLeave`); none on Skip.
- [ ] Back returns to photo in the onboarding sequence; reached via Add from Home there is no Back to photo (Back/Skip return to Home).
- [ ] The prototype line "Next: your real Home, exactly as today." is a design note, NOT rendered.
Home card, option A
- [ ] Own card (same `Card` look as its neighbours) between the "N nights attended" card and the "Be found" heading.
- [ ] One line of copy, verbatim: "Add a bio and a link so dancers know you." No visible heading (the section carries `aria-label="Make your profile shine"`).
- [ ] Primary button "Add" (min 44px) -> `/app/welcome?step=bio&returnTo=/app/home` (the bio+links screen above).
- [ ] Dismiss cross top-right, `aria-label="Dismiss"`, 44px tap target, text keeps right padding so it never runs under the cross.
- [ ] Shown to EVERYONE (any role, linked or not) while bio is empty OR no link (`instagram`, `facebook`, `website_url` all empty); gone once both bio and at least one link exist, with no flash on load (render nothing until the profile has loaded).
- [ ] Dismiss: writes a timestamp to `localStorage` key `dancer_app_shine_dismissed:${userId}` (try/catch, works with storage blocked); card hidden while now - timestamp < 30 days; after 30 days returns if still missing; never returns once bio + links exist.
- [ ] Keep-list, nothing else on Home changes (assert in the test): h1 "Hi ...", linked-profile card, GO OUT group (Your ticket QR + pager, "Nothing planned yet" + "Find events this week"), "1 night attended" row, BE FOUND (Share, Preview my page), header logo / Dancer chip / bell / Switch, tabs Home / Nights / Me.
- [ ] The mockup's green "NEW" tag and dashed outline are annotations, NOT built.

## Rules
- No schema/RPC edits; gate and `profile_complete_v1` untouched. Flag off: no card, no bio step, `homeLayoutC.test.tsx` and onboarding tests pass unmodified (test it).
- Per-screen unit keep-list test for the bio screen and the Home card (every line, button, disabled state, the 30-day rule with a mocked clock).
- Any tap that leaves the prototype = not done. End the handover with a TAP TABLE: button | destination | prototype/OLD (Add, dismiss cross, Finish, Skip for now, Back). One OLD row = keep building.
- An element you cannot build: STOP and write it at the TOP of the handover.
- PR body carries the tap table. Never merge. Over size: stop at a clean boundary, write `PARTIAL [worker-done]`.
