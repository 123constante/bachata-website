# Handover: #977 W2 walk-through fixes 1-9 (session 2: complete)

Branch `claude/invite-w2-phone-ig-golive`, PR #977. Brief: `brief/invite-w2-phone-ig-golive:briefs/invite-journey/W2-walk-fixes.md` (sha 4c18e66). Dispatch ticket dt_8c2b6db0a69a.
This session stopped at the owner's cloud context gate (30%). The code for every in-scope finding is in; CI-job runs, the browser walk and the PR body are NOT done yet.

## Commits (this session)

| Commit | What |
|---|---|
| `72fd5ac` | Merge `origin/main` (one conflict, `perf-budgets.json` /parties /classes chunk allowance: took main's 44; this PR never changed it) |
| `b1e3176` | **Tests red first**: `shared/__tests__/goLiveWalk.matrix.test.tsx`, `wizard/__tests__/walkFixes.test.tsx`, `home/__tests__/walkFixes.copy.test.tsx`, `src/lib/__tests__/auth-otp-routing.test.ts` (+ the pinned mapping `shared/goLiveKeys.ts`). 57 failed against the unfixed code. |
| `adbe174` | **The fixes** (below). The 4 new test files: 49 + 10 + 17 + auth 108 (with the journeys suite) all pass. |

## Findings 1-9

| # | Status | Where |
|---|---|---|
| 1 | FIXED `adbe174` | `goLiveKeys.askOrder`: the wizard asks every required step first; `?returnTo=` asks ONLY the required ones ("Keep going" then opens the optional ones). Role steps take `required` (`roleWizard.tsx`): the required words `REQUIRED_HINT`, no Skip, a disabled Continue pointing at the reason. Counter stays `required_left` (required only; already the server's). |
| 2 | FIXED `adbe174` | `ProfileWizard.tsx`: returnTo read with `sanitizeReturnTo`; Finish later, Back-from-first and every end screen go back; "Back to <event name>" primary (`wizard-back-to-event`), "Keep going" ghost. The photo hand-off keeps the returnTo. |
| 3 | FIXED `adbe174` | `RoleProfilePage.tsx` / `RoleAreaPage.tsx` / do-you lines: go-live fields say `REQUIRED_HINT`, never "(optional)"; the lead line names them (`ROLE_REQUIRED_LEAD`). |
| 4 | FIXED `adbe174` | `homeJobs.goLiveRow` + `useHomeData` (one `series_go_live_check_v1` read per draft, same cache key as the event card): every draft gets "Finish and go live: <name>" with `goLiveLeft(check)` = the event's `leftCount` (test-pinned equal). It replaces the stale-draft row on Home only (My events chips unchanged). |
| 5 | FIXED `adbe174` | `goLiveKeys.GO_LIVE_BLOCKERS`: all 13 prod codes + ticket_link, each with words and a section; `no_flyer` is `cover`'s twin and shows once (`eventBlockers`). `no_payment` -> NEW How to pay editor `/details?edit=payment` (`PaymentEdit.tsx`, `paymentModel.ts`; chips ticket_link/door/bank_transfer/cash/free, festival ticket_link only; one `series.upsert` `payment_methods`). `payment_methods` added to `OWNER_UPSERT_KEYS` (prod's `check_owner_command_allowlist_v1` lists it; both pinned test lists updated). Prod: 0 of 72 series have payment set, so before this EVERY draft was stuck on a row with no link. |
| 6 | FIXED `adbe174` | `registry.ORG_PHONE_HELP`: "It shows on your page so dancers can reach you. You can hide it in My page." |
| 7 | FIXED `adbe174` | `shouldHonorReturnTo({..., organiserSignup})` + `isTaskReturnTo`: an Organiser sign-up from a plain public page lands `/account/o`; claim (`?claim=1`, `/organisers/*`), `/invite`, `/account`, `/app`, `/finish-profile` kept; sign-in unchanged. `AuthCallback.tsx` applies it to the stashed returnTo too, and an Organiser ticked in the multi-select counts as the organiser landing role. |
| 8 | FIXED (organiser side) `adbe174` | `BETA_NOTE` on Find your page and the Page name step. **Not fixed: "Become an organiser"** in the dancer app (`dancer-app/screens/options/optionsModel.ts`): the dancer-area isolation rule keeps `src/modules/dancer-app/**` out of this PR. Proposed: a sub line under `BECOME_ORGANISER_LABEL` with the same `BETA_NOTE`. |
| 9 | FIXED except the photo step `adbe174` | Page name hint + disabled Next reason; the city step offers the sign-up city ("Use London", from `my_dancer_edit_v1.city_name`); nationality matches demonyms (world-countries `demonyms.eng.m`) + UK/English/Scottish/Welsh/USA/UAE/Holland, with help text. **Not fixed: photo step** "Not now" header vs "cannot be skipped" (`dancer-app/screens/onboarding/steps.tsx:136`), same isolation rule. Proposed words: "A photo is needed to finish setting up your page. Not now keeps everything you have entered." |

No database change, nothing under `supabase/**`.

## Not done (next session, in this order)

1. Full `npm run test:unit` FINISHED after the push at `adbe174`: **56 failed / 13467 passed, 12 files**: `AuthCallbackRoleIntent` 16 (fix 7 landings), `regression/today/account.today` 6, `HomeTodo` 5 + `homeJobs.matrix` 5 (fix 4 go_live rows), `areas.screens` 4 + `areas.fixpass` 2 (fix 3 copy), `goLive.webA1a` 2, `NewPageFlow` 1; and `eventViewCompat` / `occurrenceProgram` / `publicEventPageLineup` contract 10 + `integrityCouldNotRun` 5, which look environment-bound (live DB / file mode): confirm they fail on main too. (Originally: check for fallout in existing tests that pinned the old copy/order: `wizard/__tests__/ProfileWizard.test.tsx` "server order", `areas/__tests__/*` "Every detail is optional", `jobs/__tests__/homeJobs.matrix.test.ts` stale_draft rows, `AuthCallback*` landings). Fix the tests to the new rules, never the reverse.
2. Every CI job locally (read `.github/workflows`): `npm run lint`, `lint:architecture`, `bin/check-integrity.sh`, `AUDIT_STRICT=1 check:images`, `check:dancer-area-isolation` (must stay "rule c only"), `check:rpc-typing`, `check:wallclock-brand`, build + `check:bundle-budget` + `check:first-load-requests` + `check:chunk-cycles` (Home now imports `goLiveCheck` fetch into `useHomeData`; `goLiveKeys` <-> `goLiveCheck` is a type-only cycle; re-measure), typecheck (94 errors, none in touched files; branch baseline was 100).
3. Phone suite: `npx playwright test --config playwright.phone.config.ts tests/e2e-phone/invite-w2-walk.phone.spec.ts` (NEW spec, NOT YET RUN; the fake gained `eventMissing`, `progressSteps`, `noPages`). Then `SHOTS=docs/design/977` for the shots, and update `docs/design/977.md` (stage 4: contrast >= 4.5, taps >= 44px, no clipping, no sideways scroll).
4. `/code-review` on the diff (CLAUDE.md: before commit; it did not run this session).
5. PR body: per-job table, Phone QA section, "Walk-through fixes 1-9" list (the table above), Verified on real data block.
6. Push ONCE (Vercel at 70/100).

## Verified / Not verified

- Verified: prod shapes by read-only SELECT (`_series_go_live_check_p5` codes/sections, `my_profile_progress_v1` required flags, `_role_required_keys_v1`, `_payment_methods_problem_v1`, owner allowlist has `payment_methods`, payment set on 0/72 series, `my_dancer_edit` returns `city_name`); the 4 new test files green; typecheck has no error in touched files.
- Not verified: the full unit suite, every CI job, the phone spec, any browser walk, the payment save against a real server (the fake refuses writes).

## Session 2 (dispatch dt_224877544d5b): done

All six "Not done" items above are closed.

1. **Stale tests fixed to the new rules** (never the reverse): `AuthCallbackRoleIntent` (fix 7: an Organiser sign-up drops a plain public returnTo), `areas.screens` / `areas.fixpass` (fix 3 copy; the styles list and input share a label, so the input is picked by `selector: 'input'`), `goLive.webA1a` (the one map is `GO_LIVE_BLOCKERS`; 5 later prod codes added), `HomeTodo` / `homeJobs.matrix` (fix 4: every draft is ONE `go_live` row; fresh = plain "Not live yet"), `NewPageFlow` (fix 8: the beta note is the one place that talks approval), `account.today` snapshots (+ the beta note line only). The 15 env-bound failures fail identically on `origin/main` here.
2. **Every CI job locally**: table in the PR body. Two real fixes: `lint:architecture` (the new matrix spec joins the `organiser_id` allowlist like its siblings) and the bundle ratchet (dancer-app 52 -> 51, the measured win). `REQUIRED_HINT` had two copies (`stepKinds.tsx` and `goLiveKeys.ts`); `stepKinds` now re-exports the one.
3. **Phone suite**: `invite-w2-walk` 5/5 (the spec used a test id that does not exist, `org-golive-list` -> `org-life-list`) + `invite-w2-golive` 15/15. Shots `docs/design/977/walk-*.png`, `docs/design/977.md` updated.
4. **/code-review (high)**, 10 findings, fixed (red first where testable):
   - Teacher / DJ editors ignored `?returnTo=` from a Go live gap: Back now goes there (`RoleProfilePage`, test in `areas.screens`).
   - Festival with a stored non-ticket method: the save sends only what the event may offer (`paymentModel.toSend`; NEW `paymentModel.test.ts`, the editor had no unit test).
   - Contact sheet lost Enter-to-Done + `enterKeyHint` in the PhoneInput swap: `PhoneInput.onEnter` (test in `ContactSheet.test`).
   - `/organisers` (the directory) counted as a task returnTo: only `/organisers/<page>` does now.
   - `PhoneInput` comment claimed "typed": it is paste / autofill only (digits-only box).
   Not fixed, with reasons: workspace read lacks `payment_methods` (NOT REAL: `_snapshot_series_p5` is `to_jsonb` of the whole `event_series_p5` row); one go-live RPC per draft on Home (prod has 4 drafts of 748 series); three Instagram reserved lists (two pre-date this PR, one in the event page module; consolidation is a follow-up); role minimum restated by hand in 3 places and `profileFixPath` for mixed role gaps (design-level, follow-up; both are covered by the matrix today).
5. **PR body** rewritten: walk fixes table, per-job table, Phone QA, Verified on real data (both body checks pass locally).

Still open for the owner: fix 8 "Become an organiser" and fix 9 photo step (dancer-app, isolation rule; proposed words above); a prod-data browser walk of fixes 1-9; the Vercel preview.
