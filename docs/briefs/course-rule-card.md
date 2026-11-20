# Brief: course rule card (Website, phase 1)

Size: 5 files, 250 lines

## Aim
Show a small rule card ABOVE the Week rows on a course event page, telling dancers whether they can drop in or must sign up first. Behind a flag, default OFF. Course page only. No button.

## Design (owner picked, 2026-11-20; DESIGN-REGISTRY row "Course rule card position + final look")
Final look mockup: https://claude.ai/artifact/S2872KfPuH4FUBvdk8LEPv (option 8 card). Build to that mockup. Rules:
- `sign_up_first`: headline "Sign up before you come", sentence "You can't just turn up. Book your place first."
- `drop_in`: headline "Drop in welcome", sentence "Just turn up. No booking needed."
- Headline + the one fixed sentence only. No button, no extra copy, no icons beyond the mockup.
- Position: directly above the Week rows (the `dates` block for a course, `WeeksLadderBlock`), not under the organiser card.
- Rule unset (null/missing) = render nothing. Get Tickets bar unchanged. Every other block, badge and line on the course page stays exactly as it is (keep-list frozen).
- Use `&rsquo;` style entities in JSX, no raw Unicode punctuation.

## Data
The event page payload from `event_view_p5` (`shape:'snapshot_compat'`) will carry `event.signup_rule` = `'drop_in' | 'sign_up_first' | null` once admin PR #2037 is merged and applied. It is NOT in prod yet: build and test against fixtures; absent key must behave as unset. Zero migrations here.

## Deliverables
- `src/modules/event-page/bento/blocks/SignupRuleBlock.tsx` (new, small, explicit px for sizes) + `src/modules/event-page/bento/blocks/__tests__/SignupRuleBlock.test.tsx` (server-render test: both rules render the exact copy, null renders nothing).
- Wire it in `src/modules/event-page/bento/BentoPage.tsx` and the layout entry in `src/modules/event-page/bento/BentoGrid.tsx` (LAYOUT, around lines 98-121), only for `format==='course'`, only when the flag is on and the rule is set.
- Flag in `src/lib/featureFlags.ts`: `VITE_ENABLE_COURSE_SIGNUP_RULE`, default off.

## Do not touch
`src/components/calendar/*`, `EventCalendar.tsx`, `useCalendarEvents.tsx`, `src/components/ui/dialog.tsx`. Read `src/modules/event-page/CLAUDE.md` first. No model change: read the rule straight from the snapshot in BentoPage.

## Done when
- Unit tests pass, `npx tsc --noEmit -p .` zero errors in your files, `npm run lint` clean on your files.
- With the flag on and a fixture rule, a 390x844 render shows the card above the Week rows; with the flag off the page is identical to main.
- PR opened (bot, body from `~/.claude/docs/pr-body-template.md` shape) with before/after phone screenshots if you can take them; say under Not verified what you could not.
