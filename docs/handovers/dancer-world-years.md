# Handover: dancer world "N years dancing" (dt_5b1a3bde73c0)

Branch `claude/dancer-world-years`, brief `brief/dancer-world-years:briefs/dancer-world-years-brief.md`. Status: **done**, one push. No flag flipped, no DB write, no migration.

## Files changed
- `src/modules/person-page/facts/index.ts`: `plural` and `yearsDancingLine` now live here, the one shared rule (finite number > 0 -> "N year(s) dancing"; null / "" / 0 / negative / NaN -> null).
- `src/modules/person-page/hub/model.ts`: `factsOf` and the dancer `cardLine` now call `yearsDancingLine` (the local copy of `plural` is gone). Same output, except a non-finite string like "Infinity" no longer prints on the hub card line.
- `src/modules/person-page/worlds/dancer/model.ts`: `DancerWorldInput.yearsDancing`, `DancerCard.years`.
- `src/modules/person-page/worlds/dancer/DancerWorld.tsx`: `dancer-world-years` line under the sub line, 15px, `T.card.muted`, `mt-1` (same as the sub line). Not rendered when null.
- `src/modules/person-page/worlds/dancer/DancerWorldPage.tsx`: passes `yearsDancing` through and into the `useMemo` deps.
- `src/pages/DancerProfile.tsx`: `yearsDancing: dancerView.yearsDancing` in the world input.
- Type-only test fixture updates: `app/routes/dancers.rolesSeed.test.tsx`, `src/components/dj/__tests__/djPageFonts.test.tsx`.
- `docs/design/dancer-world-years.md` (design record).
- Snapshots: **none changed.**

## Tests
- `dancerWorld.matrix.test.tsx`: +36 model rows (years undefined / null / "" / "0" / "-2" / "abc" / "1" / "4" / "11" x sub on/off x languages on/off) and +24 DOM rows with the flag ON (no years / this year / future / 1 / 4 / 11 x sub on/off x languages on/off). The year sits in `dancing_role_details[0].dance_started_year`, as prod stores it. Checks: exact text, singular "1 year dancing", inside the card, 15px, directly under the sub line (or the name), absent -> no node, never "0 years" / negative / NaN, no Level / Veteran / Experienced / Beginner / Intermediate / Advanced.
- Red first: against the unfixed source, **48 failed / 140 passed (188)**: every model row, plus the 12 DOM rows that expect a line. Fixed: **188 / 188**.
- Touched area + person-page + dancer-app + pages + regression: 121 files, 3349 tests, all pass.

## CI-equivalent local run (Node 22.22.0, fresh `npm ci --ignore-scripts`)
| Check | Result |
|---|---|
| `npm run test:unit` | 14416 pass, 15 fail. The same 15 fail on unmodified `main` in this container: 3 live-Supabase contract files (no API key) and `integrityCouldNotRun` (a temp-repo precondition). |
| `npm run typecheck` | 113 errors, the same count as `main`, 0 new (pre-ship ratchet: 95 < baseline 106, PASS) |
| `npm run lint` chain | 21/22 links PASS. `check:integrity` exited 126 because `bin/check-integrity.sh` has no exec bit in this checkout (mode 100644 on main). Run by hand: ok, 2550 files, 0 issues |
| `AUDIT_STRICT=1 npm run check:images` | PASS (0 missing) |
| `npm run pre-ship` | every gate PASS except test:unit (the same 15 environment failures). It skipped e2e because of that |
| eslint (scoped, pre-ship) | held level, 2 pre-existing errors in `DancerProfile.tsx` (not on the changed line) |

## Verified on real data
- Shapes, read-only prod survey 2026-10-25 via the `dancing_role_details` join: 0 years 2, 1 year 3, 2-7 years 3, 8+ years 11, future 0, before 1960 0; the rest have no start year. These match the brief's counts.
- Every shape is a row in the matrix, both in the model and in the DOM with the flag ON.

## Not verified
- 390x844 browser walk: the orchestrator does this. Route: `/dancers/<slug>` with `flags.personWorlds` ON. Walk three dancers: one with 11 years ("11 years dancing"), one with 1 year ("1 year dancing", singular), and one with no start year (no line, no gap).
- e2e smoke was not run locally, because pre-ship gates it behind the unit run, which is red only because of the environment.
- The skeleton (`CARD_SKELETON_PX = 233`) is kept for the common no-years card. A card with a years line is about 22px taller (one 15px line plus `mt-1`) on 19 of the live dancers, so content below shifts by that much when the read answers. The brief chose this deliberately.

## Follow-ups (out of this brief's scope, flagged by review)
- `src/modules/dancer-app/public-page/model.ts` (~L308) has its own years rule (`>= 0`, its own plural) and still shows Level. Owner call: move it onto `yearsDancingLine`?
- `src/components/profile/DancerProfileGrid.tsx` (~L188) prints `{yearsDancing} years dancing` without a guard, so it can show "1 years" or "0 years" on the flag-OFF grid.
- `dancerPublicProfile.ts` computes years with the device's local `getFullYear()`, not a London date. Around New Year this can differ by one.
