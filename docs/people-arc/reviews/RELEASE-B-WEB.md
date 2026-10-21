VERDICT: FIX PASS NEEDED

# Independent review: Release B web (D97)

- Release branch reviewed (read-only): `claude/people-release-b-web` at **9a469d92e401348382c96041a5d53e6c843fa0a2**
  (main fb91b8a + B-WEB3 54fbbda + B-WEB4 a8c8dd8 + seam commit). Diffed against `origin/main` fb91b8a.
- Brief: admin `brief/people-d89` `briefs/people-arc/REVIEW-RELEASE-B-WEB.md` (sha 58957dc). Ticket dt_7274cf319b2b.
- Server truth read from admin `claude/people-release-b-admin` (127bdd5) migrations 20261129550000 (role self-save,
  intent writers), 20261129570000 (requirements/progress), 20261129580000 (`my_roles_v1`), and from prod (read-only
  `pg_get_functiondef` of `organiser_home_v1`, `series_go_live_check_v1`; no row data read).

## Findings (most severe first)

### B1 (blocking) A Teacher/DJ sign-up is told "Not added" for the role they just chose; seam (b) is not met
`src/modules/areas/home/areaStatus.ts:53`, `src/modules/areas/home/SwitcherAreas.tsx:19`,
`src/modules/areas/__tests__/releaseBSeams.empty.test.tsx:65`.

- Server fact: `my_roles_v1` sets teacher/DJ `active` ONLY from an active `person_roles` row (20261129580000); that row is
  created by the first real `save_my_role_v1` write (20261129550000, line ~308). Intent alone never makes it active. But
  `my_profile_progress_v1` DOES list the 7 teacher steps for a role that is only in intent (D40, 20261129570000).
- Failure scenario: new sign-up ticks Dancer + Teacher -> lands on `/account/t` (B-WEB4) -> opens Your areas: Teacher
  reads "Not added" with "Add"; the switcher shows no Teacher entry; meanwhile the profile wizard / Home ring count
  the teacher steps as to-do. Same fact, two answers (WEB-COMMON "one shared mapping"). Tapping "Add" asks "Do you
  teach?" again, sends nothing (intent already holds teacher) and goes to `/account/t`; back on Your areas it still
  says "Not added". The integration handover marks (b) PASS, but its own test asserts the opposite of the brief's
  seam (b) ("lists the roles chosen at sign-up via intent").
- Proposed fix (one mapping, no new RPC): in `areaStatus`, a teacher/DJ role that is not active but has steps in
  `my_profile_progress_v1` (`progress.steps.some(s => s.area === role)`, already declined-filtered by the server)
  reads as added: `to-finish` with `stepsLeft`, action Open. The switcher's `held` filter must use the same predicate
  (export one `isAreaShown(role, row, progress)` from areaStatus). Flip `releaseBSeams.empty.test.tsx` to a
  prod-shaped progress fake (7 open teacher steps, `active:false`) and expect "7 to finish" + Open on both surfaces,
  red first on 9a469d9.

### S1 (should) Your areas says "N to finish"; Home and the wizard say "N answers left"
`src/modules/areas/home/areaStatus.ts:38` vs `src/modules/organiser/shared/profileProgress.ts:61`.

- `toFinishWords` is a second wording for the count of open profile answers; `requiredLeftText` ("1 answer left" /
  "N answers left") is what Home's ring, the wizard and the Go live profile row already say. The brief's check 1
  names exactly this ("Your areas, switcher, Home and wizard say the same status words"). The file header
  (`areaStatus.ts:2`) also claims "the wizard read it" -- nothing outside `areas/home` imports it.
- The consistency matrix (`areasConsistency.test.tsx`) compares Your areas with the switcher only; Home and the
  wizard are not in it.
- Proposed fix: `toFinishWords = requiredLeftText` (import, not copy); add a Home/wizard column to the matrix that
  renders the ring text from the same progress fake; correct the header comment.

### S2 (should) Re-using the sign-up form on an EXISTING account overwrites its stored intent
`src/pages/AuthCallback.tsx:229-232`.

- `set_my_role_intent_v1` REPLACES `account_role_intent.roles` (20261129550000: `ON CONFLICT ... SET roles =
  EXCLUDED.roles`). `Auth.tsx` sign-up mode does no existing-email check and `signInWithOtp({shouldCreateUser:true})`
  signs an existing account in; the callback runs with `mode=signup`, reads the stash (default `['dancer']`) and
  records it.
- Failure scenario: a person who signed up as Dancer+Teacher (no teacher details yet) later taps "Create account"
  again by mistake with the default ticks -> intent becomes `['dancer']` -> the teacher steps vanish from the wizard
  and (after B1's fix) from Your areas. Silent data loss of an owner-visible choice.
- Proposed fix: record intent only on the account's first sign-in (`isFirstSignIn(user)`, already imported and used
  two lines above for the finish-profile hop), else skip. Add the row "sign-up mode, existing account -> zero intent
  calls" to the `AuthCallbackRoleIntent` table, red first.

### S3 (should) Test matrices use a teacher/DJ shape the server never returns
`src/modules/areas/home/__tests__/areasConsistency.test.tsx:33` (teacher/DJ `n-left` rows) and the screenshot
`docs/people-arc/screens/B-WEB3/your-areas-filled.png`.

- `profile_requirements_v1('teacher'|'dj')` is "required always [] and complete true" (owner decision, 20261129570000),
  so `my_roles_v1` returns `active:true, complete:true` for every held teacher/DJ. "Teacher, held, N to finish"
  (the B-WEB3 screenshot `your-areas-filled.png` shows "3 to finish") cannot happen on the real server; the reachable
  teacher/DJ states are complete, intent-only (B1), declined and not held. The CLAUDE.md real-data rule asks for the
  real shapes.
- Proposed fix: replace the teacher/DJ `n-left` rows with the intent-only row from B1; keep `n-left` for dancer and
  organiser only. (Optional product question for the owner: should a held teacher with 0 of 7 details read
  "Complete"? Today the server says yes.)

### S4 (should) B-WEB4 sign-up screenshots do not show the screen
`docs/people-arc/screens/B-WEB4/signup-roles-*.png`.

- Every `signup-roles-*` capture is taken behind a blurred overlay ("Not now" gate); the 360x640 one is almost black.
  Labels, contrast and the disabled reason cannot be judged from them. `callback-already-listed-*` is clear and fine.
- Proposed fix: dismiss the gate (or seed its "seen" key) before capturing; re-take the six PNGs. Release seam
  screens (a)-(b) under `docs/people-arc/screens/RELEASE-B-WEB/` are also still missing (integration handover says so).

### N1 (nit) Last step can briefly name the flyer after one is uploaded
`src/modules/organiser/flows/new/NewFlow.tsx:292`. After upload, the old server answer (with `cover` missing) stays
in cache until the refetch lands; the cover check passes client-side, so the button reads "Upload a flyer first."
for a moment. Fix: treat `goLiveCheck.isFetching` after an invalidate as `pending` (CHECKING_REASON), or drop
`cover` from `eventMissing` when `hasCover`.

### N2 (nit) A failed server check enables Go live on the last step
`src/modules/organiser/flows/new/model.ts:82`. Documented and safe (the server refuses and the refusal is shown), but
it differs from the event card, which shows an error state rather than an enabled button. Acceptable; say it in the
handover as the one remaining difference.

### N3 (nit) Videographer and Vendor left the sign-up screen
`src/pages/Auth.tsx` ROLE_OPTIONS. The brief's four choices replace the old six; a `?userType=videographer` link still
sets `user_type` silently and `VALID_ROLES` in AuthCallback still routes it. Owner should know the two options are
gone from the screen.

## Check 2: routing truth table and B-WEB4 decisions

The 112-row table (`AuthCallbackRoleIntent.test.tsx`) covers roles x seat x claim x returnTo x carrier; plus sign-in
rows (zero intent calls). Read against the code: returnTo (param, then stash) is decided before
`signupIntentLanding` and wins; intent is recorded once (the effect is guarded by `resolved`); sign-in never calls it
(`signupRoles` is null unless `isSignupFlow`); Organiser intent grants nothing (only the landing reads it; the seat
comes from `organiser_home_v1`, an owner/manager `entity_members` read, checked on prod; `{organisers: []}` for no
seat, so the Teacher/DJ landing works on prod). Gap: S2 (existing account in sign-up mode).

| B-WEB4 decision | Verdict | Reason |
|---|---|---|
| 1. Organiser+Teacher, no seat -> `/account/t` | Agree | The brief's order is literal (seat, then Teacher, then DJ); the organiser request stays one tap away (Your areas Organiser "Add" -> `/account/o`). |
| 2. Failed seat read keeps today's landing | Agree | Never guess; `/account/continue` routes by real sides. |
| 3. C13 only on `no_match` | Agree | C13 says "no person matched"; `ambiguous` means matches exist and admin linking is a different path. Worth an owner note: ambiguous people might be the ones who most need "ask us to link". |
| 4. Failure fallback keeps its own landing (C13 still detours) | Agree | An unfilled profile has a recovery route that should not be bypassed. |

## Check 3: D91

The last step now reads `series_go_live_check_v1` through `shared/goLiveCheck.ts` (`useGoLiveCheck(seriesId)`), the
same query key as the event card; both D91 shapes (start without title/end; added session without programme) now get
the server's answer. Remaining differences: N1 (stale flyer item for one refetch) and N2 (error -> enabled rather than
an error card). The client `coverStepReason` runs before the server answer, which is consistent because the server
also lists `cover`.

## Check 4: RPC boundary

`my_roles_v1`, `my_role_intent_v1`, `set_my_role_intent_v1` (areas, `rolesApi.ts`), `my_role_details_v1`,
`save_my_role_v1`, `set_my_role_declined_v1`, `my_lineup_appearances_v1` (`areaApi.ts`) go through a string-named
`UntypedRpc` with strict parsers (unknown roles dropped, wrong types throw `malformed_answer` -> error state).
The callback uses `rpcLoose(SET_MY_ROLE_INTENT_RPC)` with `parseRoleIntentResult`, a 4 s timeout and no throw: a
missing function lands normally (tested). Note: that is a second boundary for `set_my_role_intent_v1` beside
`rolesApi.setMyRoleIntent` (two call sites, two parsers for one function). Not a defect; the fix pass may route the
callback through `rolesApi` if the import does not pull the areas chunk into `/auth/callback`.

## Check 5: commands (this review's own runs, sandbox, node_modules shared)

| command | release 9a469d9 | origin/main fb91b8a | verdict |
|---|---|---|---|
| `npm run build` | 0 | 0 | green |
| `npm run test:unit:offline` | 1: 470 files (1 failed), 10857 passed, 5 failed, 18 skipped | 1: 460 files (1 failed), 10542 passed, 5 failed, 18 skipped | same 5 failures, all `tests/integrityCouldNotRun.test.ts` (sandbox/worktree bound): inherited. +10 files, +315 passing tests |
| `npm run lint` | 1: 19 of 20 links green, `check:integrity` exit 126 | 1: same | inherited (script not executable in this checkout; the integration handover shows 0 after CI's `chmod +x`) |

## Verified
- Read every changed source file in areas/home, the routes, switcher, AuthCallback, auth-otp-routing, Auth.tsx role
  step, NewFlow/model, wizard registry/api against the admin migrations that define the RPCs.
- Prod (read-only): `organiser_home_v1` answers a no-seat person with an empty `organisers` list (not an error), so
  the seat read can return `false`; `series_go_live_check_v1` is the function the card and last step share.
- Build, offline unit suite and lint chain on both trees, numbers above.
- Screenshots viewed: B-WEB3 `your-areas-filled`, B-WEB4 `signup-roles-default-*`, `callback-already-listed-390x844`.

## Not verified
- No browser walk at 390x844 / 360x640 by this review (44 px targets and 4.5:1 contrast taken from the slices'
  measured specs and class names, not re-measured); the B-WEB4 captures are unusable (S4).
- None of the Release B RPCs exist on prod or on a branch DB I could reach; behaviour read from migration SQL only.
- e2e-smoke, phone-qa, perf-budget, db-contract-check, Vercel preview: not run (need a browser build server, secrets
  or a deploy).
