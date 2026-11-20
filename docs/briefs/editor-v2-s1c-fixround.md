# Editor v2 S1 fix round (PR 1865, branch claude/editor-v2-s1c)
Size: 4 files, 300 lines
Files: src/modules/organiser/p3/v2/SaveBar.tsx, src/modules/organiser/p3/v2/editorModel.ts, src/modules/organiser/p3/v2/useEditor.tsx, src/modules/organiser/p3/v2/screens/EditTray.tsx (+ tests beside them).
Rule: for each finding write a FAILING test first. If you cannot reproduce it, drop it and say so in the handover. Do not change anything else. Flag VITE_ENABLE_ORGANISER_EDITOR_V2 stays off by default.

Findings (from one sonnet code-review of head ce1c1e5):
1. SaveBar ~746: retry after a partial failure restarts the series version from the prop. Keep seriesVersion in a held ref, like occ.
2. SaveBar ~741: the sig computed from live eventCommands changes after a refetch, so done resets to 0, landed night overrides are re-sent, and the programme step version goes stale. Drop landed steps, or do not reset on a removal-only change.
3. editorModel ~1392: programme step version relies on the set_override response new_version/version. If absent it falls back to the stale s.version. Refetch the version, or test the real response shape.
4. editorModel ~1352: writePlan skips nights not in ws.dates but dirty still counts them, so Save does nothing. Drop those drafts or raise an error.
Nits (do if cheap): useEditor leave-sheet go() after clear() may re-block; EditTray sameV2Editor is not flag-gated (gate on the flag); SaveBar busy guard needs a sync ref.
Out of scope: round B items (picture input styling, line-up per night, event-page removal warning).
