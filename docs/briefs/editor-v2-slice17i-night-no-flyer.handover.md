# Handover: slice 17i, remove the flyer for one night

Branch claude/editor-v2-s1c. Flag `organiserEditorV2` stays OFF. No migration, no admin change, no PR opened (brief says No PR).

## Tap table
| button | destination | prototype/OLD |
|---|---|---|
| Remove the flyer (night) | `occurrence.set_override {cover_image_url:''}`, toast "Saved for <date> only", Undo | prototype |
| Choose a new flyer (night) | `occurrence.set_override {cover_image_url:<url>}` (unchanged) | prototype |
| Back to the usual flyer | `occurrence.set_override {cover_image_url:null}` (existing step, test added) | prototype |
| Undo on the toast | same command with the prior value (url, or null to inherit) | prototype |

## Readers list (truthy checks that would show the series flyer / miss a blank night flyer)
- src/modules/organiser/p3/data/dateFacts.ts:16 `!!(... || detail.coverImageOverride)`: a `''` override counts as "no override" (old P3, flag OFF).
- src/modules/organiser/flows/change/changeModel.ts:289 same `||` truthy (old flow).
- src/modules/organiser/p3/data/dates.ts:220 `!!(... d.coverImageOverride ...)` same.
- src/modules/organiser/p3/screens/DateSheet.tsx:350 `detail?.coverImageOverride ? L.onlyThis : null` and line ~: `if (detail?.coverImageOverride) patch.cover_image_url = null` (a blank override is not reset by "back to usual" there).
- src/modules/event-page/useEventPageQuery.ts:190 `asString(event.cover_image_url) ?? asString(event.hero_image_url)`: `asString('')` is null, so a blank night cover falls through to `hero_image_url`. What `hero_image_url` holds for an occurrence page is NOT read here (it comes from the event-page RPC, not this repo), so I cannot say whether the public night page still shows the series flyer. Owner follow-up; not built.

## UNBUILT
- Public night page behaviour for a blank flyer (above).
- G3 B-N8: `p3/v2/EveryBody.tsx:232` still has a raw U+2014 (`venue?.name ?? '—'`). It is a 6th file, so per the brief I stopped and did not touch it. The B-N8 test (`consistency.matrix.test.tsx`) stays RED on only that file; fix is `'—'` in that one line. NightCard.tsx and Facts.tsx are fixed.

## Verified / Not verified
Verified: `npx vitest run src/modules/organiser/p3/v2` 35 files, 414 tests green; the 3 core new tests FAIL on the 17h code (stashed NightCard/FlyerSheet); `npx tsc --noEmit -p .`: 0 errors in p3/v2 files; `npm run check:mojibake` clean.
Not verified: no prod write was made; server behaviour of `''` is as stated in the brief (read from the live function source by the briefer, not re-read). No browser walk at 390x844. `npm run pre-ship` not run. consistency.matrix B-N8 still red (EveryBody.tsx, see UNBUILT).
