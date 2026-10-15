# PR #764 journey-matrix follow-up: handover

Brief: `briefs/journey-matrix-followup.md` (sha 23c8e4f4) on `arc/briefs-dancer-rebuild`. Ticket dt_633510ae7ce3.
Branch `claude/dancer-app-routing`. Work list: "Proposed follow-up" in `MATRIX.md` (now copied into this folder, with
COVERED BY filled in for every kept row).

## Done

0. **build-smoke red fixed in `playwright.build.config.ts` only (no workflow edit).** The config now owns its
   build. Its webServer runs `npm run build` with `FAKE_BUILD_ENV` (the fake origin
   `https://phoneqafakenotaproject.supabase.co`, the placeholder key, the organiser detail, directory and
   **self-serve** flags), then serves it. The test runner's own `VITE_SUPABASE_URL` is pinned to the same fake
   origin, so the specs' stored-session key (`sb-phoneqafakenotaproject-auth-token`) matches what the build reads.
   `BUILD_QA_SKIP_BUILD=1` reuses `build/` for local re-runs. The webServer timeout is now 300 s. In CI the
   workflow's own build still runs first; the config then builds again (about 60 s), so local and CI cannot drift.
1. A red build-smoke on the branch head: the same cause as step 0, fixed by it. The 4 routing specs pass.
2. Every "Proposed follow-up" row and spec, plus the src changes the owner decisions require:
   - **13 journey rows** in `tests/journeys/publicEntryJourneys.ts`. Each is walked by the routing model
     (`publicEntryJourneys.test.ts`) and by the production build at 390x844 (`public-journeys.build.spec.ts`). Two
     new midways: `back-each-step`, and `magic-link-other-context`, which opens the link in a real second browser
     context. The fake backend and UI steps moved, unchanged, to `tests/e2e-build/helpers/journeyHarness.ts`.
   - **`tests/e2e-build/account-edges.build.spec.ts`** holds 5 of the 6 planned specs plus one for M57. The banner
     spec (M60) is **not** shipped here because the banner arrives with PR #765 (see M60).
   - **M76 / D1** (owner decision). `src/lib/personScopedStorage.ts` holds the one key list and
     `clearPersonScopedStorage()`. It runs inside `signOut` in `src/hooks/useAuth.tsx`, which every sign-out button
     already went through. A guard test checks that `auth.signOut(` appears only there. The keys are below.
   - **M57** (owner decision). The invite card says "You are joining as <first name / display name / e-mail>", with
     "Not you? Sign out". Sign-out uses the shared path, then goes to `/auth?mode=signin&returnTo=/invite/<token>`.
     Changed: `InviteRedeemPage.tsx` and `joiningAsName` in `inviteModel.ts`. **Behaviour change:** a signed-in
     person now taps **Join** instead of the invite being used on open. There is no other way to offer "Not you?"
     before the link is spent.
   - **M44** (owner decision). `signInLanding` sends a person with no side, who is not an admin, to `/app/welcome`
     when the dancer area is open. An admin, a failed admin read or a closed area still goes to `/`. It waits while
     the admin read loads, and `useProfileSides` reads admin only when the person has no side. See the open item
     below.
   - **M35** (found by the new row). `oldDancerHomeRedirect` let the organiser home beat an explicit
     `/finish-profile?returnTo=`. An organiser with an unfinished dancer profile was left on the old Finish form
     instead of going into onboarding and then `/account/o`. The fix is in `accountRouting.ts`. Separately, the
     build harness stamped every account as on its first sign-in, so the one-time post-login Finish hop fired.
     Returning accounts now carry an old `created_at`.
   - **M10/M24** (orchestrator default). Both "Go to Home" ends used `replace:false`. Every onboarding end now
     uses `replace:true`.
   - **M71** (orchestrator default). This already worked: a finished dancer on `/app/welcome` gets the end card (or,
     at 100%, a replace redirect). It is now pinned.
   - **M70** (Website side). `DANCER_LINK` and the callback self-claim (`claim_my_dancer_profile_v1`, run once
     before the persona read, on sign-up and sign-in) are pinned in `DancerInviteSelfClaim.test.tsx`. **The admin
     repo's `dancer-invite-send` URL must equal `DANCER_LINK` = `/auth?mode=signup&userType=dancer`. Admin was not
     edited.**
   - **D7** (small, done: `MagicLinkConfirmation.tsx` and `Auth.tsx`). The code step is kept in sessionStorage
     (`auth_code_step_v1`) for 10 minutes, for the same e-mail and mode. "Use a different email" or a verified code
     forgets it. After 5 wrong codes the box is disabled and "Send a new code" is offered at once, even during the
     cooldown. The lock survives a reload.
   - **M50/M51.** Marked "DEFERRED to the account-system plan (owner decision 2026-10-15)". Deletion is not
     changed. #764 adds no "erased immediately" or "permanently deleted" copy (checked with grep over the diff).
   - **Guards.** The isolation seams and notes cover the new files. The new invite spec joins its siblings on the
     `organiser_id` allow-list in `lint-runtime-architecture.mjs`. The `/app/*` budget goes from 360 to 361 KB, with
     the measurement in `perf-budgets.json`: base 359.7, head 360.1, +0.4 KB, chunk and puller ratchets unchanged.
3. **E-mail code walk against a real Supabase: needs owner: E2E Supabase credentials.** This environment has prod's
   service key (never used) and an anon key for a second project. It has no way to read an OTP on a branch or E2E
   project, so it cannot pass the code step there. The unit rows (`AuthCodeStep.test.tsx`) and the build walk with
   the fake auth cover it.
4. `MATRIX.md` is updated. Every kept row says COVERED BY. The rows left are:
   - PARTIAL: M44 and M77.
   - BLOCKED: M60 (#765) and M79 (needs real auth).
   - DEFERRED by the owner: M50 and M51.

### Sign-out storage keys (M76)
- **localStorage, exact keys:**
  - `auth_form_state_v1`, `auth_last_email`, `pending_profile_role`, `profile_entry_role`, `auth_pending_return_to`
  - `profile_last_active_role`, `auth_signup_draft_v1`, `profile_entry_flow`, `videographer_pre_auth`,
    `pending_level_rating`
- **localStorage, prefixes:** `finish_profile_`, `bc:organiser-edit-draft:`, `vendor_dashboard_draft_`,
  `dancer_app_linked_notice_dismissed:`.
- **sessionStorage:** `dancer_app_entered`, `auth_code_step_v1`, and the prefix `finish_profile_`.
- **Kept on purpose** (device settings or anonymous ids):
  - `sb-*-auth-token`, which supabase-js handles
  - the city, the calendar view, search recents, coordinates, the tap hint
  - raffle and viewer session ids, analytics and chunk-reload flags
- **Note:** unsaved organiser and vendor drafts are cleared on sign-out. That is the privacy default, but it is a
  visible change.

## Red-first output

Step 0, build-smoke as CI runs it (the workflow's build without the self-serve flag, no `VITE_SUPABASE_URL` in the
test step), before the config change:
```
  27 failed
  4 passed (7.9m)
```
After it: `31 passed (3.2m)`. On the final head: `50 passed (4.1m)`.

M35 (`npx vitest run src/lib/__tests__/accountSidesRouting.test.ts tests/journeys`, with the `accountRouting.ts`
fix stashed):
```
 FAIL  src/lib/__tests__/accountSidesRouting.test.ts > /finish-profile?returnTo= from the /account/o gate (M35: ...) > an explicit onward target wins over the organiser home
AssertionError: expected null to be '/app/welcome?returnTo=%2Faccount%2Fo' // Object.is equality
 FAIL  tests/journeys/publicEntryJourneys.test.ts > ... (routing model) > signin-unfinished-dancer-with-organiser
AssertionError: expected { end: '/finish-profile', …(1) } to deeply equal { end: '/account/o', trail: [ …(3) ] }
      Tests  3 failed | 188 passed (191)
```
Src decisions: `RED-src.md`, one block per decision, run against 2abac36.
- M76: `expected '{"email":"a@example.com","firstName":…' to contain '"email":""'`, 5 failed.
- M57: `Unable to find an element by: [data-testid="invite-joining-as"]`, 8 failed.
- M44: `expected '/' to deeply equal '/app/welcome'`.
- M10/M24: `expected [['/app/home',{replace:false}]] to deeply equal [['/app/home',{replace:true}]]`.
- D7: `Unable to find an element with the text: Check your email`.
- M71 and M70: pins, green on base.

Rows and specs: `RED-tests.md`, run on 2abac36.
- Red on base:
  - M24 / M10 Back re-opened "You're in"
  - M35
  - M76: `auth_last_email` and `auth_form_state_v1` still hold A
  - M57: the card showed "Something went wrong"
- Pins, green on base: the other 14. Each went red when its expected END was swapped.

## Per-job table (run locally on the final code; GitHub Actions not relied on)

| Workflow / job | Command | Exit | Note |
|---|---|---|---|
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0 / 0 | |
| (extra) | `tsc --noEmit -p tsconfig.app.json` | 2 | 96 errors, all pre-existing; none in a file this PR touches |
| unit-tests London | `ci-live-db-gate` | 0 | |
| unit-tests London | `test:unit:offline` (offline placeholders) | 1 | 5 failed / 8278 passed. All 5 are in `tests/integrityCouldNotRun.test.ts` (sandbox PATH layout; the same on `main`, see FIX-HANDOVER) |
| unit-tests London | `test:unit:timing` | 0 | 65/65 |
| unit-tests New_York / Sydney | timezone vitest list | 0 / 0 | 213/213 each |
| unit-tests isolation | `check-dancer-area-isolation --self-test`, `check:dancer-area-isolation` | 0 / 0 | The only local hit was the untracked agent worktree folder, which is not in the PR |
| architecture-guard | `bin/check-integrity.sh`, legacy-tables, legacy-program-rpcs, `lint:architecture`, `AUDIT_STRICT=1 check:images`, image-widths (+self-test), plan-hygiene self-test, artifact policy (+self-test), mojibake self-test + grep, prove:entry-point (+self-test) | all 0 | `lint:architecture` was 1 until the invite spec joined the allow-list |
| perf-budget | 3 self-tests, `npm run build` (perf env), bundle-budget, first-load-requests, chunk-cycles | all 0 | bundle-budget was 1 at 360.1 vs 360, so the budget went to 361 with the measurement. lighthouse / doc-weight need a preview, not run |
| phone-qa phone-qa | `playwright.phone.config.ts` (no Supabase env, as CI) | 0 | 174 passed, 64 skipped |
| phone-qa build-smoke | `npm run build` + `playwright.build.config.ts` | 0 | 50/50 |
| e2e-smoke | `npm run test:e2e` (e2e-smoke env) | 0 | 148 passed, 1 skipped |
| workflow-lint | BOM (workflows unchanged vs main), masking, notification (+self-test) | all 0 | |
| real-data-verified / phone-qa-section | `--self-test` | 0 / 0 | The real step reads the PR body; the sections are below |
| db-contract-check | migration-stamps, script-conventions | 0 / 0 | The live checks need secrets, not run |

## Decided for the owner (orchestrator defaults, logged)
- **M76:** every sign-out path clears all person-scoped storage keys (the owner also decided this as D1).
- **M10/M24:** onboarding ends use replace, so Back never re-opens "You're in".
- **M71:** a finished dancer on `/app/welcome` sees the end card and is never asked again.
- **M80:** unchanged. Pinned by the two-tabs spec.
- **M17:** as the code says. An admin-only account is sent through the dancer setup to open the organiser area.
- **Build-smoke:** the config owns its build (brief step 0).
- **M60:** the banner spec is held back until #765, rather than shipping a spec that is red forever on this branch.
- **perf:** the `/app/*` budget goes from 360 to 361 KB (+0.4 KB measured), following the file's own rule.

## Open items for the owner
1. **M44 is half done.** The landing now goes to `/app/welcome`. There, an account with no dancer row sees "We could
   not find your dancer profile. Message us", because `my_dancer_edit_v1` raises `no_profile`. Letting onboarding
   create the row (`save_my_dancer_profile_v1` does insert, read-only check) is a separate change, and it needs a
   call on archived stubs. There are 0 such accounts in prod.
2. **First sign-in versus "Continue as...".** A genuine FIRST sign-in by a person with an organiser and an
   unfinished dancer profile, for example an organiser set up by an admin, still gets the one-time post-login
   Finish hop (owner decision 2026-10-10) before the chooser. If the chooser should win, it is a one-line
   `postLoginDecision` exclusion for `/account/continue`.
3. **M57 adds a tap.** Signed-in invitees now press Join.
4. **Deletion copy on `main` (#743, not this PR).** `AccountSettings.tsx` says "This happens straight away and cannot
   be undone" and "you will not be able to log back in". That contradicts the revised M50/M51 decision. Change it in
   the account-system PR.
5. **M70:** the admin repo's invite URL must equal `DANCER_LINK`.
6. **E2E Supabase credentials** for the real code-step walk (step 3) and M79.

## Phone QA

Sizes checked: 390x844 (production build walk, every journey row and account-edge spec) and 390x844 + 360x640 (phone suite)
Walked: all 32 public journey rows (13 new: Back on each onboarding card, magic link on a second device, unfinished/organiser/open-request people opening the organiser link, existing dancer on the dancer link, sign-in with an unfinished dancer + organiser, sign-in with an open request, team invite for existing and unfinished dancers, old /app/welcome and /finish-profile bookmarks) plus the account-edge specs (sign out then a different person on the same phone, sign out in another tab, two organisers in the switch sheet, admin-only in /app, two tabs mid-onboarding, invite opened by a different signed-in person) in the production build with the fake backend; phone suite 174 passed
Not verified: a real phone, a real inbox (magic link / OTP), real Supabase auth, the home banner (PR #765), Lighthouse/preview checks

## Verified on real data

Shapes surveyed: read-only prod counts (MATRIX.md "Prod shapes", 2026-10-15): 20 accounts; 7 unfinished dancers, 7 finished dancers, 4 dancer + 1 organiser (1 with an unfinished dancer profile = the M35 shape), 0 with 2+ organisers, 1 open organiser request, 2 admin-only, 0 accounts with no dancer row and no organiser (M44), 4 team invites issued (1 open), 0 dancer invites, 0 erase requests
Checks run: every one of those shapes is a journey row or account-edge spec walked in the production build at 390x844 and in the routing model (vitest); red-first on the unfixed code for each new decision; every runnable pull_request CI job locally (table above)
NOT verified: real Supabase auth and OTP e-mail (needs owner: E2E Supabase credentials), a real phone, M44 onboarding for a row-less account (blocked, see open items), live-DB contract suites (secrets), GitHub Actions runs on this head

## Verified / Not verified

**Verified**
- Build-smoke: red as CI runs it (27/31 failed), green with the config change (31/31). On the final head: 50/50.
- Each owner decision has a test that was red on the unfixed code and is green after the fix (M71 and M70 are pins).
- The M35 defect was found by a new row, then fixed and pinned.
- Phone suite, production build, every runnable PR job (table).

**Not verified**
- A real phone, a real inbox, real Supabase auth, the OTP walk on a branch or E2E project.
- M79 (two live sessions).
- The banner (#765).
- Lighthouse and the preview checks.
- Live-DB contract suites.
- GitHub Actions on this head.
- The PR body (this file carries its sections; the orchestrator copies them in).
- The new rows' screenshots: about 19 MB, not committed.
