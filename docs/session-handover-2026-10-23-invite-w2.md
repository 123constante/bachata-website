# Handover: invite journey W2 (phone + Instagram inputs, "Almost live" DJ/teach, "It's live")

Branch `claude/invite-w2-phone-ig-golive` (off `main` d4bff828). Brief: `brief/invite-journey` `briefs/invite-journey/W2.md` (blob f60a5072).
Session 1: ticket `dt_9d3af6214f98` (PARTIAL at the context gate). Session 2: ticket `dt_dc003c66f584`. Session 3 (W2c): ticket `dt_89e4a3aab7b8`. Session 4 (W2d, the design-critique fix-up): ticket `dt_0972ae40cfde`, see the W2d section at the end.
**Merges only after A1 is applied** (bachata-admin `claude/invite-a1-golive-phone-ig`, migration 20261205100000).

## Agreed names (from A1's handover on its branch, head 89791e7)
- Error codes `invalid_phone`, `invalid_instagram` (SQLSTATE 22023, MESSAGE = the code).
- Go-live keys in `profile_missing[].fields`: teacher `teaching_styles`; dj `dj_name`, `dj_genres`. The DJ editor FIELD is `genres`; W2 maps `dj_genres` -> `genres` (`ROLE_GO_LIVE_FIELD` in `goLiveCheck.ts`). New entries are `{area: 'teacher' | 'dj', organiser_id: null, fields}`, after dancer and organiser.
- Instagram is stored lowercase, bare name.
- **`socials.instagram`: KEEP sending it as today (orchestrator decision, W2c).** A1's trigger folds the key into `instagram` and removes it from `socials`. Removing it here would break the pinned "no partial socials" contract (`draftModel.test.ts`, `organiserProfileUpdate.test.ts`).

## Done
Session 1 (kept as is): `PhoneInput` extracted (raffle = thin wrapper, its tests green), `InstagramInput`, dancer edit + organiser edit-in-place use them, `invalid_phone`/`invalid_instagram` in the dancer error map. See git log 10ecbcc.

Session 2:
0. **Fixture = A1's canonical file, byte for byte** (`src/lib/__fixtures__/phone-instagram-cases.json`, LF sha256 `4c5ce98d...78c7`, pinned in `phoneInstagramParity.test.ts`). `phoneRules.normalizePhoneE164` now = `_phone_punct_strip_v1` step for step (unicode spaces/dashes, dots, `+44 (0)` / `0044 (0)` trunk drop, brackets, `00` -> `+`). `instagramHandle` refuses the reserved segments (p, reel, reels, tv, explore, stories, accounts) and a non-blank box that leaves no name (`@`, `https://www.instagram.com/`). 45/45 cases pass. `instagramHandle.ts` is now import-free (no `organiserLinkLabels`; `instagramDisplay` there was unused and is gone).
1. **Wizard steps**: `wizard/contactSteps.tsx` (`makePhoneStep`, `makeInstagramStep`), registry swaps 4 entries (dancer `instagram`, `phone_or_whatsapp`; organiser `instagram`, `contact_phone`). `stepKinds.tsx`: 4 helpers exported, nothing else. `dancerApi` COPY maps `invalid_phone` / `invalid_instagram`. Tests: `wizard/__tests__/contactSteps.test.tsx` (22).
2. **"Almost live" roles question**: `golive/roleQuestion.ts` (pure rules + writers), `golive/RoleQuestionScreen.tsx`, phase `roles` in `GoLiveFlow.tsx` after the quick questions, only with a series, only for roles neither claimed nor declined (`my_role_intent_v1`); counted as one more quick question, section "About your page"; intent that fails to load skips it. Yes opens DJ name + music (list) / styles taught; writes `answerDoYou` then `save_my_role_v1` with changed keys only. Tests: `roleQuestion.test.ts`, `GoLiveRoles.test.tsx`.
3. **goLiveCheck** accepts `teacher` / `dj` areas (additive: one type + one set + the parse line). Gaps read "Your DJ page: add your DJ name" etc. and link to `DEFAULT_AREA_PATHS[role].profile`; `lifecycleModel.profileFixPath` sends a role-only list to that editor. Tests: `shared/__tests__/goLiveCheck.roles.test.ts` (added to the architecture guard's allowlist with its siblings).
4. **"It's live"**: Go live from the flow ends on Done titled "It's live", "<event> is live.", with `ItsLiveOffer` cards (roles claimed + a Yes given on the way), "Maybe later" hides one. `doneState.offer` parsed defensively.
5. **Perf**: the phone field loads lazily inside the raffle dialog and the dancer edit screen (`lib-phone` group: PhoneInput + countryDialCodes); `phoneRules`, `instagramHandle`, `InstagramInput` ride `lib-org-ui`. `/event` 380.2 -> 375.3 KB, 43 chunks (= main). `/app` 367.2 -> 371.5 KB (budget 368 -> 372, reason in `perf-budgets.json`), chunks 53 -> 52 (allowance tightened).
6. Contact sheet phone spec (`tests/e2e-phone/organiser-contact-sheet.phone.spec.ts`) follows PhoneInput (picker + digits, picker >= 44px) at 390/360/412: 12/12 green locally.
7. Test data updated to the new rule: `whatsappSeat.matrix` saves E.164; organiser Page/More draft phones are `+44 ...`; `goLiveCheck.parse` "bad area" is now `venue`.

Session 3 (W2c):
8. **dancer-area-isolation (CI red at ccb0981b), FIXED BY SPLITTING, not by loosening.** The rule (`scripts/check-dancer-area-isolation.mjs` rule (a)): a PR that changes anything under `src/modules/dancer-app/` may change only that folder, tests, docs and listed seams. This PR mixed 4 dancer-app files with about 35 organiser/shared files. Adding 35 seams would loosen the check (and seams are an orchestrator decision), so the dancer-app slice is OUT of this PR: `errors.ts` / `types.ts` (`invalid_phone`, `invalid_instagram` copy), `EditScreen.tsx` (InstagramInput + lazy PhoneInput), `me/model.ts` (the shared rules, E.164 / bare-name save), plus their tests `tests/client/dancerAppApi.test.tsx` and `dancerAppRealDataFixes.test.tsx`. Kept byte for byte as **`docs/handover/invite-w2-dancer-edit.patch`** (`git apply` on this branch's base works). The check now reports "not a dancer-area PR: rule c only", OK. No allowlist entry was added.
9. Go-live route data for the phone suite: `goLiveRpcs(scenario)` in `tests/e2e-phone/fakeSupabase.mjs`, wired browser side only by `fakeSupabase(page, { goLive })` in `helpers.ts` (no other spec changes). `liveOk` alone lets Go live and the role answers succeed. New spec `tests/e2e-phone/invite-w2-golive.phone.spec.ts`: 12/12, every screen checked for sideways scroll, taps >= 44px, axe contrast.
10. Design record `docs/design/977.md` + 15 screenshots in `docs/design/977/` (390x844).
11. `/code-review low`: 3 findings, all consequences of item 8 (see Open).
12. `perf-budgets.json` note updated: after the split /app re-measured 371.2 KB / 52 chunks; budget 372 and allowance 52 unchanged.

## Open / for the orchestrator
- **MERGE ORDER (from item 8 + the review):** once A1's triggers are applied, the dancer edit screen (unchanged on main) sends WhatsApp / Instagram as typed. An edited value the trigger refuses comes back as `invalid_phone` / `invalid_instagram`, which `DANCER_ERROR_CODES` on main does not know: the dancer sees the generic error, not the field copy. Few rows are affected (dancer.whatsapp: 3 filled on prod; only for dancers with other roles), but it is a real gap. **Dispatch a dancer-area PR applying `docs/handover/invite-w2-dancer-edit.patch`, to merge with or before A1.** It touches only `src/modules/dancer-app/**` and `tests/**`, so it passes the isolation rule. It needs `PhoneInput`, `InstagramInput`, `phoneRules`, `instagramHandle` from THIS PR on main first.
- **`socials.instagram`**: DECIDED (orchestrator, W2c): keep sending it; see Agreed names. History: A1's reader trace said "W2 must stop sending it". `buildOrganiserProfilePatch` still writes `instagram` into `socials`; removing it breaks the pinned "no partial socials" contract in `draftModel.test.ts` (8 cases) and `organiserProfileUpdate.test.ts`. Harmless after A1 (its trigger folds and removes the key), so this is a decision, not a blocker. Phantom "came back different" is already avoided: the edit-in-place sends the bare lowercase name and E.164, which is what the trigger stores.
- Stale localStorage organiser drafts holding a national-form phone (`07700 ...`) are now refused at Save with the phone copy (never sent).
- `src/pages/__tests__/SurnameSwitchReachable.test.tsx` fails 1/11 on `main` d4bff82 too (pre-existing, not this branch).
- PR body written (W2c): CI table, Agreed names, overlap files, Phone QA and Verified on real data sections.

## Checks run locally (session 2)
- Unit: full `vitest run` = only env failures (live-DB contract tests, `integrityCouldNotRun`, both also red on main) + the pre-existing surname test above. Touched areas all green.
- `npm run lint`: every link green except `check:integrity`, which fails here only because `bin/check-integrity.sh` is mode 100644 (as on main); `bash bin/check-integrity.sh` = ok.
- Typecheck ratchet (`tsc -p tsconfig.app.json`): 100 errors vs baseline 106, none in touched files.
- `check:bundle-budget` and `check:first-load-requests`: green after the perf commit.
- `test:e2e` (smoke gate): 157 passed, 7 skipped, 1 failed (`organiser-layout.spec.ts:171`, More screen, timed out while a vitest run loaded the box); that spec re-run alone: 12/12 green.
- Phone suite: `organiser-contact-sheet.phone.spec.ts` 12/12.

## Checks run locally (session 3)
- `check:dancer-area-isolation`: OK (rule c only). Build + `check:bundle-budget` + `check:first-load-requests` + `check:chunk-cycles`: green. `vitest run src/modules/organiser src/lib src/components src/modules/event-page/bento/modals tests/client`: 264 files, 6932 passed. `npm run lint`: every link green except `check:integrity` (exit 126, file mode, as on main; `bash bin/check-integrity.sh` ok). `tsc -p tsconfig.app.json`: 100 (baseline 106). `AUDIT_STRICT=1 check:images` ok. Phone spec 12/12.

## Not verified
- Go-live screens were walked at 390x844 in the phone suite (fake backend), NOT on prod data or a Vercel preview.
- No prod shape survey this session (A1's counts are in its handover).
- Full `vitest run`: only env failures remain (live-DB contract tests, `integrityCouldNotRun`; same on main).

## W2d (fix-up of PR #977 after the design critique; ticket `dt_0972ae40cfde`)
Started from head `5b46b191`. Critique: `claude/review-design-977` `docs/reviews/design-977-critique.md` (VERDICT FIX: 1 blocker, 2 should-fix, 5 nits, 1 copy gap).

### Each finding -> change -> proving test
| # | Finding | Change | Proving test |
|---|---|---|---|
| 1 BLOCKER | Phone box became "Saved before: +447 / No country" after the first digit (wizard step, so "Almost live", and the contact sheet) | **Class fix:** `PhoneInput` decides "legacy" only from the STORED value: new `stored` prop (as `InstagramInput` has), else the value frozen at mount; `legacy = allowLegacy && !legacyOpen && value === saved && isLegacyPhone(saved)`. Both callers pass `stored` (`contactSteps.tsx`, `ContactSheet.tsx`). | `contactSteps.test.tsx` "typed digit by digit..." + "typed 77 digit by digit..." (x2 steps); `ContactSheet.test.tsx` "typing digit by digit into an empty phone..." + "typing a new number over a stored one..."; phone spec (pressSequentially, never fill() for the phone box) in the wizard, the sheet and the raffle |
| 2 SHOULD-FIX | No sheet / raffle shots | Spec gains "phone field in the Contact details sheet" (empty, valid, too short, legacy + Change, after Change) and "phone field in the raffle" (empty, valid, too short, country rows). `screenChecks(page, label, scope, tapScope)`: axe contrast scoped to the dialog (outside `main`), taps, overflow. `helpers.ts` `fakeSupabase` gains `contactPhone` and `raffle` options (browser side only). 8 shots in `docs/design/977/`, listed in `docs/design/977.md`. | the two new describes, 15/15 |
| 2b (found by the new shots) | In the sheet the field's tokens did not resolve (the public organiser page does not load `theme.css`): every colour fell back to cream, so "Looks short" read as plain text; and the sheet showed TWO messages (the field's line + its own "Pick the country..." alert) | `PHONE_FIELD_TOKENS` (sheetStyles.ts) set inline on the sheet's field wrapper; an edited number is explained by the field's own line (shown at once, since Done is off); the sheet's alert is kept only for an untouched stored draft it refuses | `ContactSheet.test.tsx` "the phone field carries the organiser tokens itself..." (pins every value to `.org-theme` in theme.css), "changing a legacy number...one message", "a phone that is not a phone number..." (now the field's line); `sheet-phone-short.png` |
| 3 SHOULD-FIX | Raffle taps 40px (34px measured: rem under the 13.5px root) | raffle tone: input `h-[44px]` (country button follows by `h-full`), rows `min-h-[44px]`; colours unchanged; wrapper untouched | raffle spec: box + country button >= 44, first 12 country rows >= 44 |
| 4 nit | `PHONE_INCOMPLETE` sent the person to the country picker | constant removed; Continue on an incomplete number sets the field's `showShort`, so its own line shows ("Looks short. United Kingdom numbers have 10 digits after +44."), no second step error | `contactSteps.test.tsx` "an incomplete number sends nothing and says what to do" (field line, `step-error` absent); spec `phone-invalid.png` |
| 5 nit | Broken flag icon | `FlagImg` `onError` hides the img | visual (shots, flagcdn unreachable in the sandbox: no broken glyph now) |
| 6 nit | Number said twice | "Saved as +44..." line dropped | spec: `phone-feedback-ok` is exactly the grouped number |
| 7 nit | DJ offer copy | "Add a photo and a few words about your sets, so dancers know whose set they are coming to." | ItsLiveOffer tests green |
| 8 nit | Title order | "Do you also teach or DJ?" everywhere (roleQuestion.ts, screen, flow comment, tests, spec, record) | `GoLiveRoles.test.tsx`, `roleQuestion.test.ts`, spec |
| 9 | `selfServeErrors.ts` Instagram line | "Use your Instagram name, like yourname or @yourname, or your profile link." (wizard `dancerApi` uses the same words) | `contactSteps.test.tsx` "the organiser and dancer Instagram refusals say the same rule" |

**Sweep for the same draft-vs-stored shape:** `InstagramInput` already compares the box to `stored` (correct; wizard step and dancer patch pass it). No other field decides a stored-only state from the draft (`grep isLegacy`). The held-back dancer patch `docs/handover/invite-w2-dancer-edit.patch` mounted `PhoneInput` without `stored`: fixed on that `+` line (`stored={profile.whatsapp ?? ''}`); `git apply --check` on origin/main still passes.

Shared fixture `src/lib/__fixtures__/phone-instagram-cases.json`: byte-identical to 5b46b191 (`git diff --quiet` ok).

### Red first (on 5b46b191, the new tests copied in, before the fix)
Unit:
```
--- Failed Tests 6 ---
 FAIL  src/modules/organiser/edit-in-place/__tests__/ContactSheet.test.tsx > the Contact details sheet > typing digit by digit into an empty phone keeps the box (never the "Saved before" legacy box)
 FAIL  src/modules/organiser/edit-in-place/__tests__/ContactSheet.test.tsx > the Contact details sheet > typing a new number over a stored one, digit by digit, keeps the box
 FAIL  src/modules/organiser/wizard/__tests__/contactSteps.test.tsx > phone step dancer:phone_or_whatsapp > typed digit by digit (a real phone keyboard), the box stays and the number saves as E.164
 FAIL  src/modules/organiser/wizard/__tests__/contactSteps.test.tsx > phone step organiser:contact_phone > typed digit by digit (a real phone keyboard), the box stays and the number saves as E.164
 FAIL  src/modules/organiser/wizard/__tests__/contactSteps.test.tsx > phone step dancer:phone_or_whatsapp > typed "77" digit by digit: the box keeps 77 and, once left, says the number is short
 FAIL  src/modules/organiser/wizard/__tests__/contactSteps.test.tsx > phone step organiser:contact_phone > typed "77" digit by digit: the box keeps 77 and, once left, says the number is short
      Tests  6 failed | 67 passed (73)
```
Phone spec (worktree at 5b46b191 with the new spec + helpers):
```
x wizard "empty, valid, invalid":  expect(step.getByTestId('phone-legacy')).toHaveCount(0)  Expected: 0  Received: 1   (line 68, after pressSequentially('7'))
x sheet  "empty, valid, too short": expect(sheet.getByTestId('phone-legacy')).toHaveCount(0) Expected: 0  Received: 1   (line 205)
x raffle "empty, valid, too short": raffle phone box height  Expected: >= 44  Received: 33.921875
3 failed
```
After the fix: the same unit tests 27/27 + sheet suite green; phone spec 15/15.

### Per-job table (local, this sandbox, head = the W2d commit)
| CI job (workflow) | Step(s) run locally | Result |
|---|---|---|
| unit-tests (Europe/London, full) | `test:unit:offline` + `test:unit:timing` | 542/543 files, 12530 passed; 5 failed, all in `tests/integrityCouldNotRun.test.ts` (temp-repo typescript probe, sandbox; red on main too). Timing pass green |
| unit-tests (America/New_York) | tz-sensitive file list, `--no-file-parallelism` | green |
| unit-tests (Australia/Sydney) | same | green |
| dancer-area-isolation (unit-tests.yml) | `--self-test`, `check:dancer-area-isolation` | green (rule c only: not a dancer-area PR) |
| architecture-guard / integrity | `bin/check-integrity.sh` (via `bash`: the file is 100644 here, CI chmods), legacy-tables, legacy-program-rpcs, `lint:architecture`, `AUDIT_STRICT=1 check:images`, image-widths, plan-hygiene canary, workflow-artifact policy, mojibake canary + guard, entry-point proof | all green (integrity: "ok, 2348 files, 0 issues") |
| typecheck | `check:rpc-typing`, `check:wallclock-brand`; `tsc -p tsconfig.app.json` | green; tsc 100 errors (baseline 106, none in touched files) |
| perf-budget | 3 self-tests, `build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | all green (/event 43 chunks, /app 52, allowances unchanged) |
| phone-qa (phone suite) | `playwright test --config playwright.phone.config.ts` (all projects) | 286 passed, 89 skipped, 1 failed: `invite-w2-golive` "empty, valid, invalid" at the pre-existing `phone-empty` screenshot, "Protocol error: Unable to capture screenshot" under the local full-suite load (default workers; CI uses 2 workers + 1 retry). That test re-run alone: passed; and 15/15 in three earlier spec runs |
| phone-qa (build-smoke) | `playwright test --config playwright.build.config.ts` | 67/67 |
| lint chain (`npm run lint`) | every link | 19/20 green; `check:integrity` exit 126 (file mode, as on main) |
| e2e-smoke (`test:e2e`) | not re-run this session | the spec list does not include the phone specs; W2c ran it |
| phone-qa-section, real-data-verified | PR-body checks | the text below carries both sections |

### Verified
- The blocker is gone on every surface it reached, proven by key-by-key tests that were red on 5b46b191: wizard step (so "Almost live"), the contact sheet, and the raffle (where `allowLegacy` is false).
- Real data shapes (read-only counts, prod `stsdtacfauprzrdebmzg`): organiser `contact_phone` 37 E.164, 5 "+ with spaces", 1 no-"+" legacy, 7 empty; dancer `whatsapp` 2 E.164, 1 legacy, 186 empty. Each shape has a test: empty -> typing key by key (the blocker path, the 7 organisers who will type a first number); E.164 -> typing over a stored number; "+ with spaces" -> the sheet suite's stored `+44 7700 900123`; legacy -> the legacy box, untouched never re-sent, Change.
- 390x844 shots of every new state, each opened and read (wizard too-short, sheet x5, raffle x3).

### Not verified
- No Vercel preview walk and no real phone (fake backend in the phone suite only).
- The raffle submit (never pressed; the fake refuses writes).
- The Ember world colours for the sheet field (the public organiser page is not in Ember).
- `integrityCouldNotRun.test.ts` (5 tests) and `check:integrity` exit 126 in the lint chain fail here for sandbox reasons (file mode / temp-repo typescript), as on main; `bash bin/check-integrity.sh` = ok.

### PR-body text for the orchestrator to paste (I cannot edit the PR body)
**Merges only after A1 is applied** (bachata-admin `claude/invite-a1-golive-phone-ig`, migration 20261205100000).

## W2d: design critique fixed (`docs/reviews/design-977-critique.md`, VERDICT FIX)
- **Blocker:** the phone box no longer turns into "Saved before: +447 / No country" after the first digit. `PhoneInput` decides "legacy" only from the STORED value (`stored` prop, else the value at mount), never from the draft; the wizard step and the contact sheet pass `stored`. Key-by-key tests (userEvent.type, pressSequentially) were red on 5b46b191 and are green now.
- Contact sheet + raffle: 8 new 390x844 shots with overflow, taps and dialog-scoped axe (`docs/design/977.md`). The new shots surfaced two more sheet defects, both fixed: the field's colours did not resolve (no theme.css on the public page), and the sheet showed two messages at once.
- Raffle phone taps are 44px (box, country button, country rows); raffle colours unchanged.
- Nits: one "too short" message (the field's own); hidden broken flag; no second "Saved as" line; DJ offer copy; "Do you also teach or DJ?"; organiser Instagram refusal says bare name, @name or link.

## Phone QA
Sizes checked: 390x844 (all W2 screens incl. the contact sheet and the raffle); the contact-sheet spec also at 360x640 and 412x915
Walked: Go live wizard phone step (empty, valid typed key by key, too short "77", legacy stored), Instagram step (4 inputs), "Do you also teach or DJ?" (5 states), go-live gaps, "It's live" offer; organiser Contact details sheet phone (empty, valid, too short, legacy + Change); event-page raffle phone (empty, valid, too short, country list); every screen machine-checked for sideways scroll, taps >= 44px and axe contrast
Not verified: a real phone and a Vercel preview (fake backend only); the raffle submit; Ember-world colours for the sheet field

## Verified on real data
- Shapes surveyed (read-only, counts): organiser `contact_phone` 37 E.164, 5 "+ with spaces", 1 no-"+" legacy, 7 empty; dancer `whatsapp` 2 E.164, 1 legacy, 186 empty. Each shape has a test (empty -> typing key by key, the blocker path; E.164 -> typing over a stored number; "+ with spaces" -> stored `+44 7700 900123`; legacy -> legacy box, never re-sent, Change).
- Checks run (matrix tests, every CI job step, browser walk at 390x844): unit in London / New York / Sydney, dancer-area-isolation, architecture-guard + integrity, typecheck, perf-budget, phone suite, build-smoke; per-job table in `docs/session-handover-2026-10-23-invite-w2.md` (W2d).
- NOT verified (be honest): no Vercel preview or real phone walk; `integrityCouldNotRun.test.ts` (5) and the lint chain's `check:integrity` link fail in the sandbox only, as on main; one phone-suite test hit a screenshot protocol error under local full-suite load and passed when re-run alone.

## Files shared with the open organiser-rebuild PRs (#903, #904, #905, #912, #914, #917, #919, #896)
Unchanged from W2c: `src/modules/organiser/shared/goLiveCheck.ts` (+ its tests). W2d touched none of them.
