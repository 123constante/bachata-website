# Handover: event editor S1 (branch claude/editor-v2-s1)

Done: flag `organiserEditorV2` (VITE_ENABLE_ORGANISER_EDITOR_V2, off by default); `events/readiness.ts` + unit test; EventRow shows dots, "N of 3 ready" text, Edit and Cancel buttons (44px) when flag on. Flag off returns the original link untouched.

Reported gaps (brief rules):
- Tickets and Classes/programme dots left out: organiser_home_v1 does not load them (no migration/RPC allowed here).
- "Poster+text" is "Poster" (cover image only); poster text is not loaded.
- Guest list button hidden: no guest-list route in ORG_PATHS on main.
- Edit and the row link both go to ORG_PATHS.event (per brief).

Left: 390x844 browser walk (flag on/off) with screenshots; flag-on render test; owner to decide on extending the payload for Tickets/Classes.

## Continuation (dt_da2874e0b5c6)
Done: flag-on/off EventRow render tests (`events/__tests__/eventRow.editorV2.test.tsx`: dots, "N of 3 ready", Edit and Cancel 44px, keep-list testids, flag-off link unchanged); Cancel now goes to ORG_PATHS.event (per brief; was cancelEvent); EventRow exported for the test.
pre-ship on this branch: unit run had 6 failed files, none in branch files: 4 live-DB contract tests (fetch failed, sandbox has no DB), integrityCouldNotRun, and consistency.matrix (raw em dash, fixed by the — escape). build:ship hit the 10 min sandbox timeout, so it did NOT finish.
tsc (tsconfig.app.json): 141 errors total, 0 in branch files (baseline 106 in pre-ship.mjs; the extra errors are outside this branch, likely missing typegen).
Left: orchestrator 390x844 walk; owner decision on Tickets/Classes dots (S4) and the Guest list button.
