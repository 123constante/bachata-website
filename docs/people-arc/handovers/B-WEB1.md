# B-WEB1 handover: Teacher area + DJ area (Website)

Branch `claude/people-b-web1-areas` (from `origin/main` 960fc4c). No PR (per brief). Both halves (teacher AND DJ)
are done; no continuation worker is needed.

## What was built (all new files, all inside the owned paths)

| File | What |
|---|---|
| `src/modules/areas/wizardStep.ts` | The pinned wizard-step contract, verbatim from the brief. |
| `shared/fieldRegistry.ts` | THE role field registry: `ROLE_FIELDS[role]` = key, label, question, kind (`years`/`list`/`yesno`/`text`/`longtext`/`link`), max, help, group. Keys = exactly the pinned writable list. `ROLE_NAME`, `ROLE_NOUN`, limits. |
| `shared/roleModel.ts` | Pure rules: `toDraft`, `toServerValue`, `validateValue`/`validatePatch` (client copy of the server rules), `diffPatch(role, details, draft)` (diff-first: only changed keys, `{}` when untouched), `completeness(role, details)` + `completenessLine` (the ONE completeness rule/sentence). |
| `shared/errorCopy.ts` | THE refusal table: `ROLE_ERROR_COPY` for all 11 pinned codes, `roleErrorCode`, `roleErrorMessage` (unknown error -> calm fallback). |
| `shared/areaApi.ts` | The ONE string-named RPC boundary (`UntypedRpc`, as in `adminOrganisers/adminApi.ts`; no `as never`). `fetchMyRoleDetails`, `saveMyRole` (refuses an empty patch), `setMyRoleDeclined`, `fetchMyLineup`; strict parsers (`parseRoleDetails`, `parseSaveResult`, `parseDeclinedResult`, `parseLineup`) throw `malformed_answer` on any unexpected shape. Query keys. |
| `shared/inputs.tsx` | `FieldInput` (per kind), `ListInput` (add/remove chips, 20-item cap and duplicate refusal with a visible reason), `YesNoInput` (Chip x2; tap again clears). |
| `shared/AreaFrame.tsx` | Page frame: `.org-theme` tokens, top bar with back link, phone-width column. |
| `shared/LineupList.tsx` | "Where you're on the line-up": skeleton / error (quiet retry) / empty ("When an organiser adds you to a line-up, it shows here.") / rows in SERVER order, each linking to `eventHref({slug, event_id: series_id})`, date via `londonDateParts`. |
| `shared/RoleAreaPage.tsx` | Dashboard used by both roles: completeness meter (line + progressbar, same on both) + "Edit details" (the one primary), then the line-up list. |
| `shared/RoleProfilePage.tsx` | `RoleProfileForm` (groups, every label ends "(optional)", Save disabled with visible reason "Nothing has changed yet, so there is nothing to save." when untouched, client validation + shake, server refusal sentence) and `RoleProfilePage` (load, save via diff patch, form restarts from the saved details, announces "Saved"). |
| `shared/roleWizard.tsx` | `makeRoleWizardSteps(role)` (one step per key, one question, Continue + Skip), `makeDoYouStep`, `DECLINED_FIELD = 'declined'`, and `submitRoleWizardStep(step, value)`: the yes/no step -> `set_my_role_declined_v1` (No = declined true), a field step -> `save_my_role_v1` with exactly its key. |
| `shared/paths.ts` | Module-local default paths only (`/account/teacher`, `/account/teacher/details`, `/account/dj`, `/account/dj/details`, back `/account`). B-WEB3 passes the real ones as props. |
| `teacher/TeacherAreaPage.tsx`, `teacher/TeacherProfilePage.tsx`, `dj/DjAreaPage.tsx`, `dj/DjProfilePage.tsx` | Thin default-export pages. Props: area pages `profilePath?`, `backPath?`; profile pages `areaPath?`. |
| `teacher/wizardSteps.tsx`, `dj/wizardSteps.tsx` | `teacherWizardSteps`, `doYouTeachStep`, `djWizardSteps`, `doYouDjStep`. |
| `index.ts` | Lazy pages ONLY: `TeacherAreaPage`, `TeacherProfilePage`, `DjAreaPage`, `DjProfilePage` (`lazyWithRetry`). |

Nothing outside `src/modules/areas/**`, this handover and `docs/people-arc/screens/B-WEB1/**` was touched.
No route wiring, no `AnimatedRoutes.tsx`, no `src/lib/areaPaths.ts`, no edits under `src/modules/organiser/**`
(its `ui/**` primitives and `theme.css` are imported, not changed). No public teacher/DJ page is linked.

## Decisions (and why)

1. **One shared implementation, two thin role shells** (D12): every rule (registry, diff, completeness, error copy,
   line-up list) exists once; the teacher and DJ pages differ only by `role`.
2. **Cleared values**: a cleared text/link/years/yes-no sends `null`, a cleared list sends `[]`. The brief does not pin
   clearing; B-DB1 must accept `null` for those keys (and `[]` for lists). **B-DB1 to confirm**, else map in `toServerValue`.
3. **"No" counts as filled** for `offers_private` (it is an answer). A list of blank strings is not filled.
4. **Years** typed as text, digits only; a non-number is kept as a string so validation refuses it (never silently dropped).
5. **Link rule** mirrors the server exactly (<= 300, no whitespace); no `https://` requirement was invented.
6. **Pricing** trims the ends only; inner new lines are kept.
7. **unlockLine** states only the real effect: "Yes lets you add your teaching/DJ details next. Every one is optional."
   Field steps carry none (no invented rewards).
8. **`submitRoleWizardStep`** lives in shared so the wizard shell (A-WEB1b) never re-decides which RPC a step uses.
   The yes/no step's `toPatch(v)` returns `{ declined: v === false }`.
9. **Frame**: `AreaFrame` instead of `OrganiserShell` (whose tab bar and profile switcher are organiser-specific);
   same tokens, same 52px top bar, px-only sizes. No new palette, fonts or primitives.
10. **frontend-design skill**: did NOT load (not present in this cloud session's skill list nor in
    `.claude/settings.json` here). Built inside the organiser design system per `ui/README.md` instead.

## Red-first proof

Tests: `src/modules/areas/__tests__/roleModel.test.ts` (55) and `areas.screens.test.tsx` (35).

1. On `origin/main` (module absent), the same test files:
   ```
   FAIL src/modules/areas/__tests__/areas.screens.test.tsx
   Error: Failed to resolve import "../teacher/TeacherAreaPage" ... Does the file exist?
   FAIL src/modules/areas/__tests__/roleModel.test.ts
   Error: Failed to load url ../shared/fieldRegistry ... Does the file exist?
   Test Files  2 failed (2)
   ```
2. Mutation (diff-first broken: `diffPatch` sends every key): **17 tests fail**, including "untouched Save ... sends
   nothing" and "one changed key sends exactly that key" for both roles and every `diff-first` row. Restored after.
3. On this branch: `Test Files 2 passed (2) / Tests 90 passed (90)`.

What the tests cover: field-set equality with the pinned list (both roles) and one wizard step per key; untouched
form sends nothing (model + UI, Save disabled with visible reason); one changed key sends exactly that key (model +
UI, both roles); every pinned refusal -> its sentence (no internal codes on screen), unknown -> fallback; client
validation at every limit boundary; completeness rows; parsers refuse bad shapes; line-up rows keep server order and
link to the event; dashboard loading / filled / empty / error (missing function -> calm error state, retry re-asks) /
pinned refusal on load; each role asks only for its own role; wizard: yes/no -> `set_my_role_declined_v1` (No =
declined true, Yes = false), field step -> one key, Skip, bad value refused locally, Continue disabled with a reason
until answered; 44px tap targets (class check) on all four pages.

## Phone checks (measured in Chromium)

Temporary harness OUTSIDE the repo (scratchpad Vite root with the Supabase client aliased to a fake; never committed)
rendered every page and state at **390x844 and 360x640**. Measured with `getBoundingClientRect` on every
button/link/input/textarea: **0 targets under 44x44 px, no horizontal overflow**, in all 15 states x 2 sizes.
Colours are only the existing `.org-theme` tokens (contrast table in the organiser ARC doc).
Reduced motion: the only animation used is the existing skeleton shimmer / button spinner, which theme.css and
`motion-reduce:` already stop.

Screenshots (390x844) in `docs/people-arc/screens/B-WEB1/`: teacher dashboard filled / empty / loading / error,
DJ dashboard filled / empty, teacher profile filled / empty, DJ profile filled, profile loading, profile error, DJ
profile save refused (rate_limited), wizard do-you-teach / years / styles / DJ pricing.

## CI: every applicable job step, run locally

| job | step | command | exit |
|---|---|---|---|
| architecture-guard | integrity | `bin/check-integrity.sh` | 0 |
| architecture-guard | legacy tables | `npm run check:legacy-tables` | 0 |
| architecture-guard | legacy program RPCs | `npm run check:legacy-program-rpcs` | 0 |
| architecture-guard | runtime architecture | `npm run lint:architecture` | 0 |
| architecture-guard | images (strict) | `AUDIT_STRICT=1 npm run check:images` | 0 |
| architecture-guard | image widths | `check:image-widths:self-test` + `check:image-widths` | 0 / 0 |
| architecture-guard | plan hygiene canary | `npm run check:plan-hygiene:self-test` | 0 |
| architecture-guard | workflow artifact policy | `:self-test` + guard | 0 / 0 |
| architecture-guard | mojibake canary | `npm run check:mojibake:self-test` | 0 |
| architecture-guard | mojibake guard | `git grep` pattern; new files are ASCII-only (checked) | 0 |
| architecture-guard | entry-point proof | `prove:entry-point:self-test` + `prove:entry-point` | 0 / 0 |
| typecheck | rpc typing | `npm run check:rpc-typing` | 0 |
| typecheck | wallclock brand | `npm run check:wallclock-brand` | 0 |
| unit-tests | offline suite | `npm run test:unit:offline` | 1 (see note) |
| unit-tests | dancer-area isolation | `--self-test` + `check:dancer-area-isolation` | 0 / 0 |
| perf-budget | canaries | bundle-budget / first-load-requests / chunk-cycles self-tests | 0 / 0 / 0 |
| perf-budget | build | `npm run build` | 0 |
| perf-budget | budgets | `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0 / 0 / 0 |
| perf-budget | doc weight | `npm run check:doc-weight` | NOT RUN: needs `GITHUB_REPOSITORY` + a live Vercel preview |
| perf-budget | lighthouse | `npm run check:lighthouse` | NOT RUN: needs a deployed preview |
| db-contract-check | migration authority | `node scripts/check-migration-stamps.mjs` | 0 |
| db-contract-check | live contract steps | `ci-live-db-gate` + `check-*.mjs` | NOT RUN: need Supabase secrets; this slice has no DB-facing code |
| phone-qa | phone specs | `npx playwright test --config playwright.phone.config.ts` | INCONCLUSIVE: sandbox 15-min cap stopped it at 223/346; the failures seen were existing `keyboard.phone.spec.ts` / `organiser-contact-sheet` specs on routes this branch does not touch (no new route, nothing imported by existing pages). Not rerun on main for comparison. |
| phone-qa | build specs | `playwright.build.config.ts` | NOT RUN (time); new pages are not routed yet, so no spec reaches them |
| e2e-smoke | `npm run test:e2e` | | NOT RUN: no spec reaches unrouted pages |
| phone-qa-section / real-data-verified | PR-body checks | | N/A: no PR (orchestrator's PR carries them) |
| local | lint chain | `npm run lint` | 0 |
| local | targeted | `npx vitest run src/modules/areas` | 0 (90/90) |

**unit-tests note**: the only failures are 5 tests in `tests/integrityCouldNotRun.test.ts` (safe-write / TS-helper
could-not-run fixtures). The SAME 5 fail on a clean `origin/main` worktree in this sandbox (`5 failed | 62 passed`),
so they are environmental and not caused by this branch. Everything else in the offline suite passes.

`tsc -p tsconfig.app.json`: zero errors in `src/modules/areas/**`; the repo has pre-existing errors elsewhere on main
(e.g. `src/pages/Venues.tsx`, `venuePublicService.ts`), which no CI job gates on.

## Verified / Not verified

Verified: everything above against fakes at the one RPC boundary, including all refusal codes, malformed answers and
a missing function; phone sizes measured in Chromium.

**Not verified** (honest):
- Against the REAL RPCs: none of `save_my_role_v1`, `my_role_details_v1`, `set_my_role_declined_v1`,
  `my_lineup_appearances_v1` exists on any database yet (B-DB1). Response shapes are the pinned ones only.
- Prod data-shape survey: not run. The four functions do not exist, and the role details live in tables B-DB1 is
  still shaping; the orchestrator should run the survey (lists over 20, long event names, null slug, a line-up
  over the 100-row cap) once B-DB1 lands.
- Clearing semantics (decision 2) against the real server.
- Routes, auth gating and the account entry points (B-WEB3); the wizard shell (A-WEB1b).
- Vercel preview: no VERCEL_TOKEN used; doc-weight / lighthouse not run.

## Next steps (for the orchestrator / other slices)

- B-WEB3: route `TeacherAreaPage` / `DjAreaPage` with `profilePath` + `backPath`, and the profile pages with
  `areaPath`, from `src/lib/areaPaths.ts`; wrap in the auth guard.
- A-WEB1b: render `step.Component`, show `title` + `unlockLine`, and send answers with `submitRoleWizardStep`.
- B-DB1: confirm `null` clears a scalar key and `[]` clears a list.
- After B-DB1 is on a branch DB: run the table-driven screens against the real RPCs and the prod shape survey.
