# Brief: P3-LAND (F-01..F-05) -- everyone with a page lands in the NEW organiser area

Repo bachata-website, branch claude/p3-wt-land, lane normal, Opus (routing/permission logic). Owner decision D1 = (c) is RECORDED: everyone who has a page lands in the new area, `/account/o` redirects to `/account/p3`, `?legacy=1` keeps the old area until 2026-12-08 (a sibling PR moves the date constant; do NOT touch `LEGACY_UNTIL` or `LEGACY_UNTIL_LABEL`). organiserP3 is already live in prod; do not touch flags or env.

Read first: `docs/design/p3-acceptance/FIXLIST.md` rows F-01..F-05, `AUDIT-gate.md` (A-gate-J1..J3, J7), `AUDIT-team.md` (A-team-1, A-team-29), `CONTRACT.md` and `WALKLIST.md` entries for J-d1, J-e1, J-e2, J-f1, J-f3, J-x1.

## Standing header (do not skip)
- Prove the data source first: read the routing helpers and `src/lib/organiserAreaHome.ts`; state which existing function decides "has a page" and who writes it.
- Zero bytes to the /app first load: `npm run check:bundle-budget` on main and on the branch; add 0 bytes to dancer-app first load. Never edit `perf-budgets.json` or `vite.config.ts`.
- Stopping rule: one independent review, one fix round, then the orchestrator walk.

## Scope (ONLY these rows; files as listed in FIXLIST)
- F-01: sign-in, claim landing, dancer-home links, Options, "Your areas", "I organise events" go to the new area for people with a page. People with NO page keep today's behaviour.
- F-02/F-03: old links (New event, an event, Team, `/account/o`, `/account/new`, `/account/team`, `/account?o=`) map to their new-area equivalents; an old event link KEEPS its event id. `?legacy=1` inside the window still opens the old area.
- F-04: after claim / invite / email-code proof, the "go" link opens the new area.
- F-05: after accepting an invite, land where the words say ("Open your organiser home" = new Home).
- Do NOT touch F-06 (another worker owns DetailsScreen/PricesScreen), `LEGACY_UNTIL*`, `auth-otp-routing.ts` lines outside 172-173, or any admin/DB.

## Checks (Definition of done)
1. Shape survey, read-only on prod (project stsdtacfauprzrdebmzg): counts of accounts by {has organiser page, no page, dancer only, admin} using the same predicate the code uses. Counts only.
2. Table-driven vitest: every entry point x every person shape x (legacy window open/closed, `?legacy=1` or not) -> one destination from ONE shared mapping. Red first against unfixed code.
3. Run every CI job step locally via the repo scripts or, if heavy, on the side laptop (`node ~/.claude/bin/remote-test.mjs`); put the per-job table in the PR body.
4. PR body must contain the lines `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` and a `## Phone QA` section.
5. Early checkpoint push, then final push + handover `docs/handover/p3-wt-land.md`. Hard limits baked into the dispatch prompt apply.
