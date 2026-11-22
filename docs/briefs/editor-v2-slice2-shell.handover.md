# Editor v2 slice 2 handover (shell, route, look)

Top note: the frozen prototype HTML (C:/Users/ecual/...) is not reachable from the cloud worker. Built from the brief's checklist (G-01..G-26, N-01..N-09, N-40, E-01..E-03) only; no pixel comparison to the prototype was possible.

## Done
- `v2/EditorV2.tsx`: back link, tabs (weekly only), date chips (first 6 coming + More dates -> `onMoreDates`), title, scope line, slot `data-ev2-slot="night|every"`, `V2Toast`. Night in `?night=`, tab in `?tab=every`, replace without scroll reset.
- `v2/V2Sheet.tsx`: portal, focus trap, Escape / scrim / x close, no save.
- `v2/v2.css`: slice 2 section appended, all rules under `.ev2` / `.ev2-sheet`.
- `P3Routes.tsx`: flag ON `events/:id` = gate with EditorV2 (fallback R4Night); `/edit` and `/night/:occ` redirect with `?night=`. Flag OFF unchanged.
- `EditorGate.tsx` got a `v2="editor"` prop (one line outside the brief's list; needed to reuse the gate).
- Tests: routes.flag.test.tsx extended; new editorV2.shell.test.tsx.

## Left / next
- Slices 3 and 6 fill the slots; slice 3 builds the All dates sheet behind `onMoreDates`.
- The "Ended" tag is not shown on chips (brief names only Cancelled and Changed).
- `.v2-page` class on the root reuses S1's rule that hides the shell header (page draws its own back link).

## Verified / Not verified
- Verified: vitest src/modules/organiser/p3 (all pass), check:mojibake. tsc run on the pre-commit tree: 0 errors in branch files.
- Not verified: `check:bundle-budget` (needs a build; EditorV2 is lazy via the gate), 390x844 browser walk, prod data shape survey, prototype pixel match.

## TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| 1 Back "← Events" | events list (`P3_PATHS.events`) | prototype |
| 2 This night | same screen, tab night | prototype |
| 3 Every <day> | same screen, tab every | prototype |
| 4 date chip | same screen redrawn for that night | prototype |
| 33 × Close | sheet closes, nothing saved | prototype |
| 113 scrim / Escape | sheet closes, nothing saved | prototype |
