# Handover: organiser dashboard slice 1 (dt_da39006499e9)
Done: pure model + view + flagged adapter (VITE_ENABLE_ORGANISER_DASH, default off), table-driven tests for 9 shapes and fixes 1-9, design doc `docs/design/pr-organiser-dash.md`.
Left: wire share handlers (page link, night link, WhatsApp, caption sheet); per-night reads (admin repo); 390x844 walk and screenshots; PR body; per-job CI run; Tickets tile read.
tsc (tsconfig.app.json, no typegen) run: 0 errors in branch files (148 total in repo, none in touched files; baseline in pre-ship is 106 with typegen). Not run: pre-ship, e2e, check:images, other CI jobs.
No dancer files touched; shared files changed: src/lib/featureFlags.ts (one flag) and HomeScreen.tsx (flag branch).

## Continuation (dt_c128e7febcc1)
Done: share handlers wired (`dash/shareLinks.ts`: page link `/organisers/:id`, night link `/event/:publicEventRef`, WhatsApp wa.me href, native share > clipboard > WhatsApp; caption sheet in hero; "Tell your group" with page link). Night with no safe public ref: Share disabled with a reason. Tests: `dash/__tests__/shareLinks.test.tsx`. 390x844 screenshots of all 9 shapes: `docs/design/organiser-dash-shots/` (rendered from a throwaway vite harness with fixtures shaped by the survey, not the live app).
Switch on: `VITE_ENABLE_ORGANISER_DASH=true` (Vercel env / .env.local); default OFF.
Omitted tiles (no read, no DB change): organiser rating, city average value, opens by source, per-night opens (series-level only), per-night going, per-type clicks, Tickets tile (sellingViaUs false in adapter), caption-sheet Instagram variant.
Survey (prod, read-only, counts): organisers by live upcoming dates: 0 -> 17, 1-3 -> 7, 4-20 -> 7, 21-100 -> 11, 100+ -> 7 (max 222); 4 organisers have cancelled upcoming dates; upcoming occurrences 1813 scheduled / 45 cancelled.
Not verified: pre-ship (run hit my 540s limit, result not seen), e2e, other CI jobs, real-app browser walk (loading/error shapes are drawn from the view only; adapter never emits 'loading'), contributor seat unreachable live. tsc (tsconfig.app.json): 0 errors in branch files.
