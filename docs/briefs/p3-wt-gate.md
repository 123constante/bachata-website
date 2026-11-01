# Brief: GATE-RETRY, Website-only rows (F-10, F-11, F-12, F-15)

Repo bachata-website, branch claude/p3-wt-gate, lane normal, Opus (save paths). The onboarding gate flag `organiser_onboarding_gate` stays OFF; do not change it, and do not touch server/admin functions.

Read first: `docs/design/p3-acceptance/FIXLIST.md` F-10, F-11, F-12, F-15; `AUDIT-gate.md` (A-gate-3, 4, 6, 10, 11); the existing shared gate sheet `p3/onboarding/GateSheet.tsx`.

## Standing header (do not skip)
- Prove the data source first: read the live RPC error shapes the gate returns (read-only prod, function bodies via pg_proc) and state exactly how a refusal is recognised client-side.
- Zero bytes to the /app first load (`npm run check:bundle-budget` main vs branch). Never edit `perf-budgets.json` / `vite.config.ts`.
- Overlay geometry: opening a sheet must not scroll the page; 390x844 e2e asserts sheet/confirm/toast boxes inside the viewport.
- Stopping rule: one independent review, one fix round, then the orchestrator walk.

## Scope (ONLY these rows)
- F-10: creating a first event / changing who runs an event, when refused by the gate, opens the SHARED gate sheet (not a fixed dead-end line).
- F-11: a refused ticket change opens the shared gate sheet instead of "That did not work. Try again"; "Add and sell" says the real state (draft saved, needs details). Fix the stale "not gated" entries in `scripts/onboarding-write-doors.json` (this is a hard-tier path: mention in the PR that it needs the owner Approve at head before merge).
- F-12: Repeat rule edit must NOT open the details sheet before Save is tapped, and a refused PREVIEW must not write a failed-change record.
- F-15: new-event refusal uses the shared sheet; upload the cover only after the create is accepted (no stray file on refusal); discarding a draft shows no wrong generic error.
- Do NOT touch F-08/F-09/F-13/F-14 (owner decisions), the server gate, `GraceBanner`, `EditTray.tsx`, or routing.

## Checks
1. Shape survey (counts only): organisers by onboarding-complete vs not, with live events and ticket types. 2. Table-driven vitest: every gated write (create, organisers, ticket type create/edit/pause, repeat rule save/preview, new-event with and without cover) x {gate off, gate on and refused, gate on and passed}; one shared refusal-to-sheet mapping; untouched save sends nothing. Red first. 3. Run every CI job step locally or on the side laptop (read `.github/workflows`), per-job table in PR body. 4. PR body lines `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:`, section `## Phone QA`. 5. Early checkpoint push; handover `docs/handover/p3-wt-gate.md`.
