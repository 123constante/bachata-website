# Handover: invite journey W2 (phone + Instagram inputs, "Almost live" DJ/teach, "It's live")

Branch `claude/invite-w2-phone-ig-golive` (off `main` d4bff828). Brief: `brief/invite-journey` `briefs/invite-journey/W2.md` (blob f60a5072).
Session 1: ticket `dt_9d3af6214f98` (PARTIAL at the context gate). Session 2 (this update): ticket `dt_dc003c66f584`.
**Merges only after A1 is applied** (bachata-admin `claude/invite-a1-golive-phone-ig`, migration 20261205100000).

## Agreed names (from A1's handover on its branch, head 89791e7)
- Error codes `invalid_phone`, `invalid_instagram` (SQLSTATE 22023, MESSAGE = the code).
- Go-live keys in `profile_missing[].fields`: teacher `teaching_styles`; dj `dj_name`, `dj_genres`. The DJ editor FIELD is `genres`; W2 maps `dj_genres` -> `genres` (`ROLE_GO_LIVE_FIELD` in `goLiveCheck.ts`). New entries are `{area: 'teacher' | 'dj', organiser_id: null, fields}`, after dancer and organiser.
- Instagram is stored lowercase, bare name.

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

## Open / for the orchestrator
- **`socials.instagram`** (A1's reader trace: "W2 must stop sending it"): NOT done. `buildOrganiserProfilePatch` still writes `instagram` into `socials`; removing it breaks the pinned "no partial socials" contract in `draftModel.test.ts` (8 cases) and `organiserProfileUpdate.test.ts`. Harmless after A1 (its trigger folds and removes the key), so this is a decision, not a blocker. Phantom "came back different" is already avoided: the edit-in-place sends the bare lowercase name and E.164, which is what the trigger stores.
- Stale localStorage organiser drafts holding a national-form phone (`07700 ...`) are now refused at Save with the phone copy (never sent).
- `src/pages/__tests__/SurnameSwitchReachable.test.tsx` fails 1/11 on `main` d4bff82 too (pre-existing, not this branch).
- PR body still to write: per-CI-job table, "Agreed names" (above), list of overlap files touched (`goLiveCheck.ts` additive; `stepKinds.tsx` exports only; `registry.tsx` 4 entries + 1 import), design record `docs/design/<pr>.md` + 390x844 screenshots. `/code-review` has NOT been run on this diff.

## Checks run locally (session 2)
- Unit: full `vitest run` = only env failures (live-DB contract tests, `integrityCouldNotRun`, both also red on main) + the pre-existing surname test above. Touched areas all green.
- `npm run lint`: every link green except `check:integrity`, which fails here only because `bin/check-integrity.sh` is mode 100644 (as on main); `bash bin/check-integrity.sh` = ok.
- Typecheck ratchet (`tsc -p tsconfig.app.json`): 100 errors vs baseline 106, none in touched files.
- `check:bundle-budget` and `check:first-load-requests`: green after the perf commit.
- `test:e2e` (smoke gate): 157 passed, 7 skipped, 1 failed (`organiser-layout.spec.ts:171`, More screen, timed out while a vitest run loaded the box); that spec re-run alone: 12/12 green.
- Phone suite: `organiser-contact-sheet.phone.spec.ts` 12/12.

## Not verified
- No browser walk of the go-live roles screen or "It's live" at 390x844 (the phone suite's fake backend has no go-live route data); no prod-data walk; no Vercel preview walk.
- No prod shape survey this session (A1's counts are in its handover).
- Full `vitest run`: only env failures remain (live-DB contract tests, `integrityCouldNotRun`; same on main).
