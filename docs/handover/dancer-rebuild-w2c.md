# Dancer Rebuild W2c: Me (`/app/me`) + Edit (`/app/me/edit`) handover

Branch `arc/dancer-app-w2c`, from `claude/dancer-app-r1a` @ 9fc95715. No PR (the orchestrator merges the sub-branch).

## What changed (files)
- `src/modules/dancer-app/screens/me/MeScreen.tsx` (real Me), `model.ts` (the ONE mapping + form rules, pure), `ui.tsx` (strength bar, avatar, load/error gate), `useMyDancerEdit.ts`.
- `src/modules/dancer-app/screens/edit/EditScreen.tsx` (real Edit), `fields.tsx` (inputs, chips).
- Tests: `tests/client/dancerAppMeEditModel.test.ts` (69), `tests/client/dancerAppMeEdit.test.tsx` (71), `tests/e2e/dancer-app/me-edit.spec.ts` (12).
- 390x844 screenshots: `docs/handover/dancer-rebuild-w2c/` (Me, Edit top and bottom, five shapes: emptyStub, fourFieldComplete, completeAllExtras, teacherWithWhatsapp, paused).
- No W1 file, no seam, no package.json edited.

## Decisions and INTERFACE deviations (for the orchestrator)
1. **`useMyDancerEdit` not exported by W1** -> written in `screens/me/useMyDancerEdit.ts` (key `['my-dancer-edit', userId]`, `// ORCHESTRATOR:` comment there). DUPLICATE with other slices likely; unify into `api/`. Edit imports `../me/model|ui|useMyDancerEdit` (same slice, two folders).
2. **Dancing-since helper**: W2a had not exported one on my base. Four bands in `me/model.ts`: This year / 1-2 / 3-5 / 6+ years -> year `now-0 / now-1 / now-4 / now-8`; year -> band by age (0 / <=2 / <=5 / more). Choosing the band the saved year is already in keeps the saved year (no change sent); pressing the chosen chip clears (sends `null`). DUPLICATE vs W2a: unify.
3. **Languages**: no vocabulary exists on main -> free text split on commas, trimmed, deduped case-insensitively (`parseLanguages`).
4. **Favourite styles**: chips from `FAVORITE_STYLE_OPTIONS` (`components/profile/dancerConstants.ts`) plus any style already saved that is not in that list (fixtures hold `Sensual`, `Dominican`), so nothing saved is hidden or dropped. Songs/achievements: chips input, caps 20 items x 60 chars (client choice; the server's `invalid_list` rule is not known to me).
5. **Hide-surname**: the EXISTING `HideSurnameSwitch` mounted once under Surname. The component is presentational, so the Edit wraps it with an immediate write `saveMyDancerProfile({hide_surname_publicly}, profile)` (v2 through W1's wrapper, NOT a second switch) and writes the returned shape into the cache. The form never holds that key. (The dancer home card writes through v1 behind a Save button; here it is immediate because the brief says the form treats it as read-only state.)
6. **WhatsApp**: shown only when `other_roles.length > 0`; `buildDelta` never emits `whatsapp` / `show_whatsapp_publicly` for a pure dancer (does not depend on the W1-finish wrapper change). Client number check: only `0-9 + ( ) - space`, 7-15 digits; the server's `invalid_whatsapp` is not in W1's `DANCER_ERROR_CODES` yet, so until the W1-finish merge it shows as an unpredicted top-of-form error with Retry.
7. **Errors**: field codes via `DancerApiError.field`; `invalid_handle` has no field in W1's map, so it is placed under whichever of Instagram/Facebook was in the delta; codes with no field go top-of-form with "Try again" (resends the same delta).
8. **Replace-only** (first name, city): refused inline only when the saved value was non-empty and the person emptied it; a never-filled field is not an error, so an untouched form stays "Nothing has changed yet". Save is then disabled with "Fix the fields marked above, then save." The photo has no remove control (only "Change photo" / "Add photo" -> `/app/me/photo?return=/app/me/edit`).
9. **Me**: at 100 the main button IS "Edit my profile" (no second copy). Paused: banner "Your profile is hidden" + link to `/account/settings`, and "See my public page" is DISABLED with its reason (a hidden page cannot be seen). Nameless profile: name shows "No name yet". Loading/error use `data-testid="dancer-state-<id>"` so `dancer-screen-<id>` means the loaded screen.
10. "Saved" is an inline status AND `toast({title:'Saved'})` (the app root mounts the Toaster).
11. `docs/handover/**` is flagged by `check-dancer-area-isolation.mjs` rule (a) (also for W1's `docs/session-handover-...` file, a pre-existing violation); the brief names this path. Orchestrator: decide seam or move.

## Needs the orchestrator (not done: W1 files frozen)
- **`tests/client/dancerAppShell.test.tsx` `/app/me/edit` reachability now fails**: HideSurnameSwitch's Radix Switch needs `ResizeObserver`, absent in jsdom. Fix: add `import './jsdomPolyfills';` (already has a ResizeObserver stub, `tests/client/jsdomPolyfills.ts`) to that test. My own test stubs it inline.
- **`tests/e2e/dancer-app/reachability.spec.ts`** expects placeholder test ids with no `my_dancer_edit_v1` mock; Me/Edit now need that mock (see `me-edit.spec.ts`' `open()`), so `/app/me` and `/app/me/edit` rows there must mock it or move to my spec.
- **`package.json` `test:e2e`**: add `tests/e2e/dancer-app/me-edit.spec.ts` BY NAME or it does not gate. Run with the e2e-smoke env (`VITE_SUPABASE_URL`, key, `VITE_ENABLE_ORGANISER_SELF_SERVE=true`); without them every spec redirects to /auth.

## Shapes surveyed
No new survey: used W1's `DANCER_SHAPES` (plan section 3, re-checked 2026-10-15: 152 profiles). Every live shape (15 with a profile) goes through Me and Edit; the two no-persona shapes through the Me error state. Prod was not queried by me ("Not verified" below).

## Red-first proof (mutants against the new tests)
| Mutant (in `me/model.ts`) | Result |
|---|---|
| whole-form save (`buildDelta` returns the full candidate, no `diffDelta`) | 43 tests red (every "untouched = nothing sent" shape, delta-key tests) |
| whatsapp key built for a pure dancer (guard removed) | red: "pure dancer never produces a whatsapp key" |
| Save enabled on mount (untouched reason removed) | 33 tests red ("Save disabled with the reason" on every shape) |
Each mutant restored after the run. (The screens were written together with the tests, so there is no "unfixed code" for bug-shaped tests; the mutants are the red proof.)

## CI per-job (run locally; Node 22.22)
| Job / step | Command | Result |
|---|---|---|
| my unit tests | `npx vitest run tests/client/dancerAppMeEdit*` | 140/140 pass |
| all dancer-app unit | `npx vitest run tests/client/dancerApp` | 372 pass, 2 fail: `dancerAppApi fetchGate` (FAILS ON BASE TOO, unrelated), `dancerAppShell /app/me/edit` (ResizeObserver, see above) |
| full unit | `npm run test:unit` | 19 fail in 7 files: `dancerAppApi`, `dancerAppShell` (above); `eventViewCompat`/`occurrenceProgram`/`publicEventPageLineup` contract tests (need a live DB); `integrityCouldNotRun`, plan-hygiene (sandbox); `reminderBanner.today` (fails on base too, date-sensitive; it rewrote its `.snap`, which I reverted) |
| typecheck | `npx tsc -p tsconfig.app.json --noEmit` | 0 errors in my files (repo has ~100 pre-existing errors from un-generated route types) |
| eslint (my files) | `npx eslint` | 0 errors, 3 `react-refresh/only-export-components` warnings |
| lint chain | `npm run lint` | all links PASS except `check:integrity` exit 126 (sandbox: `bin/check-integrity.sh` not executable); `bash bin/check-integrity.sh` -> ok, 0 issues |
| build | `npm run build` | success |
| isolation | `node scripts/check-dancer-area-isolation.mjs` | 1 violation, NOT mine (`docs/session-handover-2026-10-15-dancer-w1.md`); mine adds `docs/handover/**` (item 11) |
| Playwright | `me-edit.spec.ts`, chromium, e2e-smoke env | 12/12 pass (390x844: renders, Save disabled+reason, only changed key sent, no control < 44px, no horizontal scroll) |
| `npm run pre-ship`, other workflows (image audit, db-contract-check, perf budgets) | not run | NOT RUN (see below) |

## 390x844 walk
Done through Playwright on the five shapes above, screenshots in `docs/handover/dancer-rebuild-w2c/`. Not a real phone. 360x640 and 200% text were not checked.

## Verified / Not verified
Verified: items in the CI table marked pass; Save-disabled/untouched, exact delta keys, `null` clears, replace-only refusal, 279/280/281 bio, link refusal, pure-dancer WhatsApp absent and never sent, one hide-surname switch, per-field and top errors, Me/Edit read one mapping.
Not verified: `pre-ship`, the remaining workflow jobs, the public-page link target `/dancers/:id` (assumed to take the profile id), the real `CityPicker` inside the form in a browser against real city data (the unit test stubs it; the Playwright screenshots do show it rendering "London"), any real server (all against the fake backend), real phone, 360x640, 200% text, the W1-finish error copy (`invalid_whatsapp` etc.), prod shape survey.

## What is left
The orchestrator items above; unify the three duplicates (`useMyDancerEdit`, the year-band helper, shared test ResizeObserver stub).
