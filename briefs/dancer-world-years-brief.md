# Dancer world: show "N years dancing" (Website, NORMAL lane, no database change)

Your branch: `claude/dancer-world-years` (repo `123constante/bachata-website`). One slice, one branch, ONE push. No migration, no `supabase/**`, no workflow edits.

## Why (owner words, 2026-10-25)
Walk of the personWorlds flag: the new dancer world (`/dancers/:id` with `flags.personWorlds` ON) drops "Dancing N years" and "Level" that prod `/dancers/<slug>` shows today. Owner decision: **the dancer world shows years only: "N years dancing". No Level, no derived Veteran/Experienced label.** This must land before the flag can be flipped. Do NOT flip any flag.

## The change (4 files + snapshots, all under `src/modules/person-page/worlds/dancer/` and `src/pages/DancerProfile.tsx`)
1. `model.ts`: add `yearsDancing: string | null | undefined` to `DancerWorldInput` (the string the page already has as `dancerView.yearsDancing`, see how `hub/model.ts` `factsOf` reads it) and `years: string | null` to `DancerCard`. Produce the line through the ONE existing mapping: reuse the plural/`factsOf` rule from `src/modules/person-page/hub/model.ts` (export the small helper from where it lives or from `facts/`; do NOT paste a second copy of the rule). Rule: a finite number > 0 -> "N year(s) dancing" ("1 year dancing", "4 years dancing"); null, empty, 0, negative, NaN -> no line (never "0 years").
2. `DancerWorld.tsx`: render the line inside the card directly under the sub line (role · city), same muted 15px style as the sub line, `data-testid="dancer-world-years"`. Explicit px sizes only (html is ~13.5px on phones). No new box, no new colour (tokens from `../tokens`). Absent -> nothing rendered and no empty gap.
3. `DancerWorldPage.tsx`: pass `yearsDancing` through the `input` -> `dancerCard` call and its `useMemo` deps.
4. `src/pages/DancerProfile.tsx` (the `input={{...}}` object near `danceRole: dancerView.partnerRole`): add `yearsDancing: dancerView.yearsDancing`.
5. Card skeleton height (`CARD_SKELETON_PX = 233`, measured with a name and one sub line, no languages) must stay right for the common no-years shape; if a years line changes the card height, say so and keep the reserve for the common case (154 of 173 have no years).

## Real-data shapes (read-only prod survey 2026-10-25, counts only, 173 live dancers)
no years 154; with a year 19: future 0; this year (= 0 years) 2; exactly 1 year 3; 2-7 years 3; 8+ years 11; before 1960 0. Cover each as a row in the table-driven matrix: none / null / "" / "0" / "1" / "4" / "11" / junk ("abc") x with and without sub line x with and without languages.

## Tests (red first)
Extend `__tests__/dancerWorld.matrix.test.tsx`: add the years rows above to the existing table (card model AND rendered DOM, flag ON). Run them against the UNFIXED code first and show the red. No "0 years" anywhere, singular "1 year dancing", no Level / Veteran / Experienced text on the world, no gap when absent. Update only the snapshots this changes and say which.

## Checks (every CI job step that applies; read `.github/workflows`)
`npm run test:unit` for the touched area plus the person-page and Dancers tests, `npm run lint`, typecheck, `check:images` with `AUDIT_STRICT=1` if the integrity job runs it, the pre-ship gate. Node 22 and a real `npm ci --ignore-scripts` (an old node_modules junction false-reds ~240 tests). Put the per-job table and the **Verified on real data / Not verified** block in the PR body (template sections are required by `phone-qa-section` / `real-data-verified`). 390x844 browser walk is done by the orchestrator, not you: state the exact route and the three shapes to walk (a 11-year dancer, a 1-year dancer, a dancer with no years).

## Design record
This is a visible one-line change: add `docs/design/<pr>.md` (5 lines: what, where, why, token used, shapes) and link it in the PR body.

## Rules
Never merge/approve, no `--no-verify`, bot-authored PR, no flag flip, no prod write. Do not edit the calendar density-excluded files. Source files over 2 KB go through `scripts/safe-edit.py` / `safe-write.py` (the pre-write hook prints the exact call). HTML entities in JSX (`&middot;`), never raw Unicode punctuation. Context under 50% (normal lane). Handover `docs/handovers/dancer-world-years.md`: files changed, tests (counts, red-first proof), CI table, Verified / Not verified.
