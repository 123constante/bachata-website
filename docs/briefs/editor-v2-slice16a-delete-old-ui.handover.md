# Handover: Editor v2 slice 16a (delete old v2 event page and night screen)

Branch claude/editor-v2-s1c, based on 5227ad2. No PR (brief says none). Tap table: none, no UI added.

## Done
- Deleted `p3/v2/EventPageV2.tsx` and `p3/v2/NightV2.tsx`.
- `EditorGate.tsx`: always mounts `EditorV2` for v2 formats (recurring, one_off) without a festival_id; everything else gets `fallback`. `v2` prop removed.
- `P3Routes.tsx`: dropped `v2="editor"`.
- New `v2/__tests__/editorGate.test.tsx`: both gate branches (recurring and one_off mount EditorV2; festival, course, festival series get fallback).
- `routes.flag.test.tsx` needed no change (it stubs the gate and never passed `v2`). No other test imported the deleted files.
- `git grep "EventPageV2\|NightV2" src tests` returns nothing. Deleted exports were `EventPageV2` and `NightV2Route`, neither used elsewhere. No knip script was run; grep only.

## Verified
- `npx vitest run src/modules/organiser/p3/v2`: 28 files, 350 tests pass.
- `npm run check:mojibake`: clean.
- tsc -p tsconfig.app.json: 162 errors before and 162 after, none in files touched (EditorGate, P3Routes, editorGate.test). All pre-existing.

## Not verified
- Browser walk, real-data shape survey (no UI change, flag stays OFF), full CI, `pre-ship`.
- 16b: SaveBar, editorDraft, scope.ts remain (live importers).
