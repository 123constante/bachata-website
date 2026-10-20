# S-PERF handover: "Add a performance" on the series Programme

Branch `claude/org-r1-integrate` (PR #809), one push.

## Change
- `src/modules/organiser/events/programmeSeriesModel.ts`: `START_SECTIONS` replaced by `ADD_ACTIONS` (class -> `classes`, party -> `party`, performance -> `showcase`) and `EMPTY_PROGRAMME` copy.
- `src/modules/organiser/events/ProgrammeSeries.tsx`: the Add row maps `ADD_ACTIONS`; new button "Add a performance", test id `prog-add-performance`; empty state uses `EMPTY_PROGRAMME`.
- Levels, the people refusal ("Performers and the MC are added by the Bachata Calendar team.") and the type chips are the existing shared rules (`levelsApplyTo`, `whyCannotAddPerson`, `SESSION_TYPES`); nothing copied. S-SORT unchanged.
- Tests: `events/__tests__/sw1.parity.test.tsx` (describe "S-PERF"); throwaway walk `tests/e2e/walk-sperf.spec.ts` (not in the gate list).

## Section-kind evidence (prod, read-only counts, `event_series_program_item_p5` x `_section_p5`)
Items of type `performance`: `showcase` 1, `competition` 1. No other kind holds one. `showcase` is a kind the editor already labels (`SECTION_LABEL`), so it reads back; no new kind invented. (The admin repo is not in this sandbox; the evidence is the stored data plus `SECTION_LABEL`.) Other rows seen: classes/class 267, party/party 358, masterclass/masterclass 16, plus a few mixed legacy types.

## Red-first
Tests run against the unfixed source: 6 failed / 56 passed (buttons x4 shapes, empty copy, add-performance flow). With the change: 62/62. The model test `addSession` is generic so it passes on both.

## Mutations
| Mutation | Result |
|---|---|
| performance button points at section `social` | 1 failed (saved command expects `showcase`) |
| `LEVEL_TYPES` includes `performance` | 3 failed |

## Per-job (sandbox)
| Command | Exit |
|---|---|
| `npx vitest run src/modules/organiser src/modules/admin-organisers` | 0 (121 files, 3477 passed, 2 skipped) |
| `npm run build` (production) | 0 |
| `npx tsc --noEmit -p tsconfig.app.json` | 98 errors before AND after my change (pre-existing, none new) |
| `npm run lint` | 1: only `check:integrity` failed, exit 126 (sandbox cannot execute it); 19 other links green, eslint link skipped by the chain |
| GitHub Actions | not run here |

## Screenshot
`docs/organiser-rebuild/walk-PERF/a-programme-add-performance.png` (390x844, production build with `VITE_ENABLE_ORGANISER_SELF_SERVE` and `AW1_APPLIED` flipped locally, never committed; mocked backend). Read: three Add buttons, a Showcase section with the performance row, no level chips.

## Verified / Not verified
Verified: tests above, red-first, mutations, production build, walk screenshot.
Not verified: `check:integrity` and the remaining CI jobs (billing/sandbox); admin editor read-back of a `showcase` performance (admin repo not available; relies on prod already holding one); real phone.
