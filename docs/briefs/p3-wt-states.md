# Brief: EDITOR-STATES + HOME-COPY (F-06, F-16..F-19, F-22, F-24, F-25, F-34)

Repo bachata-website, branch claude/p3-wt-states, lane normal, Sonnet (screens, no new rule). organiserP3 is live; no flags.

Read first: `docs/design/p3-acceptance/FIXLIST.md` those rows, `AUDIT-gate.md` (J4, J10, J11, J12, J13, J14), `AUDIT-public.md` (9, 8), `CONTRACT.md`.

## Standing header (do not skip)
- Prove the data source first: for each row state which RPC/table feeds the screen and the live shapes (read-only prod counts).
- Zero bytes to the /app first load: `npm run check:bundle-budget` on main and branch; 0 bytes added. Never edit `perf-budgets.json` / `vite.config.ts`.
- Overlay geometry: sheets are portalled to `document.body`; opening one must not scroll the page (`focus({ preventScroll: true })`); an e2e at 390x844 asserts sheet, confirm button and toast boxes sit inside the viewport.
- Stopping rule: one independent review, one fix round, then the orchestrator walk.

## Scope (ONLY these rows)
- F-06 "Complete your profile" link stays inside the new area (client navigation, no full page load): `DetailsScreen.tsx:80`, `PricesScreen.tsx:45`, `shared/profileProgress.ts:45`.
- F-16 Home copy: no "Add dates" beside Finished events; all-ended copy must not name a button that is not on Home (say what the person CAN do).
- F-17 venue list failure -> sheet with Try again; empty list -> says what to do. Same for the per-date "Where" sheet.
- F-18 festival with no prices: copy must not point at a switch that is not on screen.
- F-19 empty cancel-reasons list -> visible message and a way out.
- F-22 after Remove, leave the event page for Events; a link to a removed event shows a clear "removed" state, not "Finished".
- F-24 half-typed per-date name/photos/price: ask before discarding on tab-bar tap or Back (reuse the existing leave guard).
- F-25 bad cover URL: no broken-image icon (fallback).
- F-34 add "See it as dancers see it" link on the organiser event page (public event URL).
- Do NOT touch F-21/F-23/F-20 (owner decisions), `status.ts` tagging rules beyond F-22, routing files, or the density-excluded calendar files.

## Checks
1. Shape survey (counts only) for each row's data. 2. Table-driven vitest: each screen x each state (loading, error, empty, one, many, ended, removed, no-prices), one shared mapping; no text pointing at a missing control; empty states say what the person can do; untouched save sends nothing. Red first. 3. Run every CI job step locally or on the side laptop; per-job table in PR body. 4. PR body lines `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:`, section `## Phone QA`. 5. Early checkpoint push; handover `docs/handover/p3-wt-states.md`.
