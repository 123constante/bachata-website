# Fix round 1: website#2512 line-up names "shown as" + wider name box

Branch: claude/lineup-names-shown-as (existing PR #2512; push to the same branch, do not open a new PR)
Size: 5 files, 300 lines
Kind: ui (switch VITE_ENABLE_NAME_FIXES stays off by default)

## What
Fix the review findings F1-F4 below. Flag-off behaviour must stay exactly as on main.

F1 (high) `src/modules/areas/shared/DancersSeeLine.tsx`: the own-name fallback reads `display_name`/`first_name`/`surname` from `my_role_details_v1(p_role='dj').details`, but prod returns only `dj_name, genres, soundcloud, mixcloud, pricing` there. So the own name is never known. Fix: get the person's own public name from the signed-in dancer profile (the same profile data the DJ profile editor screen already loads, or the hook that loads it), computed with `ownPublicName` from `src/modules/dancer-app/api/publicName.ts` (it mirrors get_public_dancer_names_v1 incl. the hide-surname mask). Pass that string into DancersSeeLine as a prop. Remove the test fixtures that fake `display_name` inside the DJ details.

F2 (high): the hide-surname mask must apply. Using `ownPublicName` fixes it. Add a test: hide surname on, DJ name empty -> "Dancers see <first name>" only.

F3 (medium) `src/modules/areas/__tests__/nameFixes.off.test.tsx`: the D test checks only the constant. Add a render test of a stacked `PersonChip` with the flag mocked on and off: assert the name element's `maxWidth` is `96px` when on and `avatarPx + 24` px when off. It must go red if PersonChip.tsx is reverted.

F4 (low) copy in DancersSeeLine: use "On every line-up where you DJ." (the DJ name shows only in DJ slots), and drop the trailing " · DJ" after the name. Keep "Leave it empty to use your own name." Plain warm words, no jargon.

Design: owner-approved mockup https://claude.ai/artifact/KR5T49pSwVAYVbBFNM32nK (picks: D = wider 96px name box, 2 lines; B = "shown as" line as drawn).
Intent: under the DJ name box, a small line "Dancers see <b>X</b>. On every line-up where you DJ." where X = the DJ name if typed, else the person's own public name.

## Checks
`npx vitest run src/modules/areas` and `npx tsc --noEmit` if it fits.

## Rules
Do not merge or approve. No secrets. Do not turn the switch on. Stop after the push and report: head sha and files changed.
