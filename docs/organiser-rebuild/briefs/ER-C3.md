# ER-C3 (website-screen): ER-S1 rules + lookup, and ER-S0 the switch

Branch `claude/er-s1-rules` from `main`. FIRST and alone for Website screens: later slices build on the interface you pin. Plan: "How one rule set works", rules 1-13, PRs and slices (ER-S1, ER-S0).

## Do
1. `src/modules/organiser/shared/event-rules.json`: the rules + messages + shape fixtures (readiness, blockers with the 2-4 word reasons, payment codes, time-from-sessions, session kinds incl. level-only-on Class+Masterclass, lesson quick lengths 45/60/90/120, festival default 22:00-04:00, cancel reasons list). Machine-readable, no code. Write it so the ADMIN repo can carry a byte-identical copy.
2. `shared/eventRules.ts`: thin typed reader + pure functions: `readiness(series)`, `blockers(series)`, `startFromSessions`, `endFromSessions`, `paymentCodes`, `validSessionPair`, `sessionKindRules`. No React.
3. `shared/useOrganiserSeries(id)`: ONE hook replacing the three `allSeries/findSeries` copies (`flows/add/addModel.ts`, `flows/change/changeModel.ts`, `events/eventsApi.ts`). States: loading / found / not-found-archived / no-access / gone. RED-FIRST: reproduce "Add a date: Not found" on a series with 0 dates (draft) against the unfixed code, then fix.
4. ER-S0 switch: one flag read in `shell/OrganiserRoutes.tsx`, ON for an allowlist of organiser ids first (config/env, default off; owner's own pages first). Old screens stay until the switch is on for everyone.
5. `scripts/check-event-rules-mirror.mjs` + an npm script: compares `event-rules.json` with the admin repo's copy (path given by env/arg; skip with a clear message when absent). Do NOT edit workflows: write in the PR body the exact step an owner must add ("needs owner: workflow step").
6. Table-driven tests over the prod shapes in ER-COMMON; "no time input anywhere in the organiser module" grep test (will be red until C7/C8/C9 remove them: mark it as a ratchet listing today's offenders, never silently failing); untouched save sends nothing.
7. Pin the public interface in `docs/organiser-rebuild/er/handover/ER-C3.md`: exported names and signatures, JSON schema, hook states. Later slices read it.

## Touches only
`shared/event-rules.json`, `shared/eventRules.ts`, `shared/useOrganiserSeries.ts`, `shared/__tests__/eventRules*`, `shell/OrganiserRoutes.tsx`, `flows/add/addModel.ts`, `flows/change/changeModel.ts`, `events/eventsApi.ts`, `scripts/check-event-rules-mirror.mjs`, `package.json` (script line only). New Event flow `flows/new/**` is NOT yours (C7).
