# REVIEW RELEASE A WEB: independent review of `claude/people-release-a-web` (e8095008)

VERDICT: FIX PASS NEEDED

Reviewer: independent (wrote none of it). Brief: admin `brief/people-publishing-2026-10-20:briefs/people-arc/REVIEW-RELEASE-A-WEB.md`.
Server truth: admin `claude/people-release-a-admin` @ 9320c6ca. Target was not changed; this branch adds only this file and
`RELEASE-A-WEB-screens/` (44 PNGs, each < 150 KB).

## Findings (most severe first)

| # | Sev | file:line | Failure scenario | Proposed fix |
|---|-----|-----------|------------------|--------------|
| 1 | **blocking** | `src/modules/admin-organisers/invitePersonModel.ts:18` | Admin invites a person with no page (teacher/DJ). `admin_invite_person_v1` (admin `20261129240000_people_a_db2_invites_v1.sql:164-169`) returns `invite_id: NULL, token: NULL, link_path: '/account'`. `parsePersonInvite` requires both to be strings, returns null, and the admin sees "Something went wrong" after the server has already written the email onto the profile. A retry then hits `email_in_use`. No test covers it. Reproduced with tsx. | Allow `invite_id`/`token` to be null when `link_path === '/account'` (type them `string \| null`), render the no-page success copy, and add the no-page answer to the parser test table. |
| 2 | **blocking** (server decision) | `src/modules/profile/wizard/registry.tsx:105` vs `save_my_dancer_profile_v2` (admin `20261121080000_...sql:1366-1387`) | The required `phone_or_whatsapp` step saves `whatsapp`. The server refuses that with `whatsapp_not_allowed` unless the person holds an active non-dancing role, and an organiser seat does not count. `phone` is not an accepted key either. On prod (read-only counts), 4 of the 7 seat holders are not allowed WhatsApp and have no phone/WhatsApp stored, so they can never reach `publish_ready` and the edit lock never lifts. | Orchestrator/owner decision: let an owner/manager seat count for WhatsApp in `save_my_dancer_profile_v2`, or accept a `phone` key. Then add a wizard test for the seat-only person. |
| 3 | should | `src/modules/organiser/events/lifecycleModel.ts:50-52`, `ProfileWizard.tsx:216,226` | The Go live "Complete your profile" row links to the wizard with no organiser id, so the wizard fixes whichever page is selected. On prod one owner holds 3 pages (2 incomplete), and 5 live series have 2 organisers. Opening a draft of a non-selected page means Go live stays blocked in a loop. | Carry the server's `organiser_id` in the link, have the wizard select that page, and test multi-page owners and 2-organiser series. |
| 4 | should | `src/modules/profile/ProfileButton.tsx:33`, `.../page/index.tsx:23`, `profileProgress.ts:62`, `goLiveCheck.ts:55` | The same "N left" reads four different ways, and the Go live row's count comes from `series_go_live_check_v1`, not `my_profile_progress_v1`, so the numbers can disagree on screen. Breaks the "one shared mapping" rule. | One shared label function fed by one number. Since `profileProgress.ts` is pinned, put it next to it. |
| 5 | should | `src/modules/admin-organisers/invitePersonModel.ts` (`buildInviteMessage`) | It wraps a server `message` that already has the greeting, link, events and expiry. With the real server format the copied text has two greetings, two event lists and the link twice on two hosts. The A-WEB2 screenshots used a one-line fake message. | Use the server message as-is when present; only build locally when it is null. Fixture with the real server text. |
| 6 | should | `src/modules/profile/wizard/registry.tsx:118-132` | A second organiser field-label map; 3 labels differ from `FIELD_LABEL` (`fieldRules.ts:48`), so the wizard and My page name the same field differently. | Read labels from `FIELD_LABEL`. |
| 7 | should | `src/pages/AuthCallback.tsx:72` (+ shared `toast.tsx:17,70`) | The claim notice toast has `duration: Infinity`. Its close button is 20.3x20.3 px with opacity 0, and the toast sits mid-screen covering Home rows at 390x844 and 360x640. Measured: still showing after 8 s and blocking taps. | Give it a finite duration (for example 8 s), or render the notice inline on Home with a 44px dismiss button. |
| 8 | should (test gap, found by mutation) | `profileProgress.ts:27-36` (pinned), `goLiveCheck.ts:90`, `publicTeamApi.ts:33` | Removing the shape checks stays green. A `publish_ready: "false"` string would open the edit lock, `ready: "false"` would send Go live, and an unexpected set-public answer counts as "unchanged". | Add bad-shape rows (string booleans, missing keys) to each parser's test table. Code stays as-is. |
| 9 | should (low impact, admin-only) | `src/modules/admin-organisers/InvitePerson.tsx:122` | The "no hits" text says "add them as a profile first", but no such control is on screen. | Link to the create-profile screen, or reword. |
| 10 | nit | `wizard/stepKinds.tsx:184` | The list step's disabled "Add" button has no visible reason. | Add a hint ("Type a name first"). |
| 11 | nit | wizard phone help text | It names a switch on My page without linking to it. | Link it. |
| 12 | nit | `lifecycleModel.ts:99-105` | Go live is offered only for drafts, but the server also allows an owner rejected -> live. There are 0 rejected series on prod today. | Include rejected, or record the decision. |
| 13 | nit | `redeemMismatch.ts` / `REDEEM_COPY` | Redeem error copy is split across two places. | Fold it into one map. |
| 14 | nit | profile-required sentence | The same sentence is written twice. | Share one constant. |
| 15 | nit | `src/pages/AuthCallback.tsx` | Pages are claimed before the deleted-account restore check. | Run the restore check first. |
| 16 | nit (ship order) | Home "Add a photo" prompt removed | The Website must ship after the admin migrations. | Record it in the merge plan. |
| 17 | nit | `invitePersonModel.ts:17`, `claimMyOrganisers.ts:27` | No test covers a missing `link_path` or a mixed good/nameless claim answer (mutations stayed green). | Add the rows. |
| 18 | nit | A-WEB1b handover | It claims 57 homeJobs tests; 48 exist (the same 3 fail red-first). A-WEB2's red count is 23 vs the claimed 22. | Correct the handover. |

Environment note (not a branch defect): local test runs rewrite 11 `.snap` files to LF and about 340 docs PNGs, and `bin/check-integrity.sh`
lacks its exec bit in this checkout, so `npm run lint` exits 126 until `chmod +x`. Same on main.

## Summary of the sections below
- **Step 1 (scope and integration):** 187 files changed. 11 are outside the owned paths and all are needed (verdicts in A). No conflict leftovers. There is one wizard path constant, one Go live label map and one error-copy map per RPC family. The duplicates are findings 6, 13 and 14. The pinned `profileProgress.ts` is byte-identical to PINNED once line endings are normalised.
- **Step 2 (correctness):** RPC names, argument names, answer keys and refusal codes match the 9320c6ca SQL, including `email_unproven`, `organiser_invite_required`, `team_full`, `profile_required`, `not_on_team`, the 9 `event_missing` codes and the `my_profile_progress_v1` keys. All calls go through `UntypedRpc`/`rpcLoose`, with no `as never`. A missing function shows the error state. No new logging. AuthCallback routes match main or D37. The exception is finding 1.
- **Step 3:** all 10 FIX-A-WEB2 findings still hold. 9 test files pass 125/125.
- **Step 4 (UI):** production build, fake boundary, 390x844 and 360x640, 84 Playwright tests, exit 0, 333 measured rows. Minimum contrast is 6.42:1. All new targets are at least 44 px except the toast close button (finding 7). No raw codes or US spellings. Reduced motion is 0 on new components. An untouched save sends 0 calls. Limit: `A1_APPLIED = false` (`a1Gate.ts:2`), so the Go live tap behaviour (send, or jump to the first missing item) cannot render. The list, labels, links and lock were measured.
- **Step 5 (prod shapes):** 0 draft series on prod, so the Go live list can't be walked on real data. 43 of 48 pages lack a founded year, so "Complete your profile" is the most common real row. Multi-page owners and 2-organiser series are not covered by tests (finding 3).
- **Step 6:** every handover red-first proof reproduces. I ran 20 own mutations: 15 caught, 5 green (findings 8 and 17).
- **Step 7:** every runnable job step is green on the target. `test:unit` (16 failures in 5 files: live-DB, sandbox integrity helper, SurnameSwitchReachable) is also red on main (18 failures). `lint` exits 126 on both because of the exec bit, and passes 20/20 links with it. `typecheck` has 99 errors, the same 99 per file as main. NOT RUN rows are in D.

## Verified
- Client/server contract against the 9320c6ca SQL bodies (A). FIX-A-WEB2's 10 findings (A).
- UI rules measured on a production build at two viewports (B), and screenshots in `RELEASE-A-WEB-screens/`.
- Prod shapes by read-only counts (C). Red-first proofs and 20 mutations (D). Every runnable CI step, with reds compared against main (D).

## Not verified
- Go live tap behaviour, because `A1_APPLIED=false`. Real RPCs (not on prod; the fake boundary only). Real phone, real email links and real Vercel preview (no PR and no preview, by design).
- DB contract checks, types-drift, ci-budget and the PR-body checks (they need secrets or a PR).
- Go live on real drafts (prod has 0 drafts).

---

# A. Scope, integration, correctness, FIX-A-WEB2 re-check (review steps 1-3)

Target `claude/review-people-release-a-web` == `origin/claude/people-release-a-web` head e8095008; base `origin/main`.
Server truth: admin `origin/claude/people-release-a-admin` (9320c6ca), migrations 20261129200000..270000.
Working tree left clean (`git status --short` empty). No tracked file changed.

## Findings (most severe first)

### F1 BLOCKING: an invite with no page (teacher/DJ) always fails on the Website, even though the server has already done the work
- `src/modules/admin-organisers/invitePersonModel.ts:18` (`parsePersonInvite`) requires `invite_id` and `token` to be strings.
  `admin_invite_person_v1` with `p_organiser_id = NULL` returns `{invite_id: NULL, token: NULL, email, link_path: '/account', message}`
  (admin `20261129240000_people_a_db2_invites_v1.sql`, the `IF p_organiser_id IS NULL` branch). The parser returns `null`, and
  `invitePersonApi.ts:86` throws `malformed_invite_answer`. The admin sees "Something went wrong. Please try again."
- Measured: `npx tsx -e "...parsePersonInvite({invite_id:null,token:null,email:'a@b.co',link_path:'/account',message:'...'})"` prints `null`.
- Scenario: an admin picks "No page (teacher, DJ or other)" (`InvitePerson.tsx:106`), picks a person, types an email and taps Invite. The server
  has ALREADY written the email onto `dancer_profiles.email` (the UPDATE runs before the return), but the screen says it failed. A retry does the
  same thing, and the admin never gets the message to send. No test covers the no-page answer: grep for `invite_id: null` / `token: null` in
  `__tests__/invitePerson*` finds nothing.
- Fix: in `PersonInvite`, make `inviteId` and `token` `string | null`. Accept `null` for both only when `link_path` is not an `/invite/` path. Add a
  table row "no page -> {invite_id:null, token:null, link_path:'/account'} -> result card", red first.

### F2 BLOCKING (prod shape): the required dancer step `phone_or_whatsapp` cannot be saved by 4 of the 7 people who hold an organiser seat today, so the C14 lock never lifts for them
- `src/modules/organiser/wizard/registry.tsx:105` (step `phone_or_whatsapp`) writes the key `whatsapp` through `save_my_dancer_profile_v2`.
  The server refuses `whatsapp` with `whatsapp_not_allowed` unless `_dancer_whatsapp_eligible_v1(person)` is true, which needs an active
  `person_roles` row other than `dancing` or `guest_dancer` (admin `20261121080000...sql:303-305`). An organiser seat does not count.
  `phone` is not in the save's `c_keys`, so no self-serve writer can satisfy the step.
- Prod (read-only, counts only): there are 7 distinct owner/manager seat users. All 7 resolve to a persona. **4 are not eligible for WhatsApp, and
  those same 4 have no phone and no whatsapp stored.**
- Scenario: one of those 4 opens Go live and sees "Complete your profile (N left)". The wizard reaches "What is your WhatsApp number?", and Continue
  shows the `whatsapp_not_allowed` copy ("...Ask the Bachata Calendar team", `dancerApi.ts:31`). This is a required step, so there is no Skip.
  `publish_ready` stays false, and every locked control (details, programme, flyer, add dates, Go live) stays locked.
- Fix: a cross-repo decision for the orchestrator. Either the server counts an organiser seat as eligible for WhatsApp, or it accepts `phone` in
  save v2. Either way, the wizard must not offer a required step that its writer refuses for this person. Add a matrix row for "seat holder, not
  eligible".

### F3 SHOULD: the invite message repeats the greeting, the link and the event list
- `invitePersonModel.ts:66-87` (`buildInviteMessage`) wraps the server `message` with its own "Hi X!", "Here is your link...", "Coming up" list
  and link. The real server `message` already holds the greeting, the link (`https://bachatacalendar.co.uk/invite/...`), "Events already on the page"
  and the 7-day line. The fake used for the A-WEB2 screenshots was a single short sentence ("It works once and runs out on 27 October."), not this
  shape.
- Measured output (real server message format): two greetings ("Hi Rosa!" / "Hello Rosa!"), two event lists (the client's shows a raw `2026-10-24`
  date), and the invite link twice, on two different hosts (with and without `www`).
- Fix: when `serverMessage` is present, the copyable message is `serverMessage` alone, optionally followed by "Your page: <url>". Add a test that
  uses the server's real multi-line message.

### F4 SHOULD: a second organiser field-label set in the wizard
- `wizard/registry.tsx:118-132` writes organiser labels as literals: 'Organisation name', 'Organisation city', 'Organisation logo', 'Category',
  'Year started', 'Organisation Instagram', 'Phone', 'About', 'Website', 'Facebook'. `edit-in-place/fieldRules.ts:48 FIELD_LABEL` is the existing
  map for the same `FieldKey`s, and three of the labels already differ from it (name, city, instagram).
- Scenario: this release had to rename the logo by hand in both places. The next rename in `FIELD_LABEL` will not reach the wizard's screen-reader
  label.
- Fix: `label: FIELD_LABEL[key]` in `organiser()`. Where the extra "Organisation" is wanted, change `FIELD_LABEL` itself.

### F5 NIT: the error copy for invite redeem lives in two places
`REDEEM_COPY` is in `inviteModel.ts:174`. The new `email_unproven` and `email_mismatch` copy is in `redeemMismatch.ts:16-36`, added through a
wrapper, because A-WEB2 could not edit `inviteModel.ts`. RELEASE-A-WEB asked for `email_unproven` to go into "the ONE error-copy map it uses". It is
reached through one entry point (`interpretRedeemWithMismatch`), so no copy is duplicated and no word is wrong. Suggest moving both entries into
`REDEEM_COPY` now that the release branch owns both files. `claimMyDancerProfile.ts:34` lists `email_unproven` as a status only (no copy), so there
is no clash.

### F6 NIT: the same copy is written twice
`team/PublicToggle.tsx:56` `NO_PROFILE_NOTE` is the same string as `selfServeErrors.ts` `TEAM_COPY.profile_required`. Export one and import it.

### F7 NIT: AuthCallback ordering
`AuthCallback.tsx:124` runs `claimMyOrganisers()` BEFORE `signInDeletionTarget` (`:134`). A hidden (deleted) account that signs in claims pages
before the restore screen, and the "You now manage X" notice is never shown on that branch. It also adds a second sequential RPC (up to 4 s on a
hang) to every sign-in. Suggest moving the claim after the restore check.

### F8 NIT: deploy order
`homeJobs.ts:107` drops the "Add a photo" job (C15). Until `my_profile_progress_v1` is on prod, the Home button stays hidden on error
(`ProfileButton.tsx:31`). If the Website ships before the admin migrations, Home shows no logo prompt at all. Ship after the admin apply.

## Step 1: files outside the owned paths

Diff: 187 files (+4672/-183), 111 of them PNGs under `docs/people-arc/screens/**` (owned). The remaining 76 were checked against the four briefs'
"Files you own".

| File | Verdict | Why |
|---|---|---|
| `app/routes/sitemap.tsx` | needed | D38 (FIX-A-WEB2 #4) allows this edit. It imports the one `NOT_PUBLIC_LIFECYCLE`, with no copy. |
| `tests/sitemapOrganiserLifecycle.test.ts` | needed | D38's test |
| `scripts/lint-runtime-architecture.mjs` | needed | Only adds allowlist entries for the snake_case `organiser_id` readers (goLiveCheck + its spec, claimMyOrganisers + its spec). Without them the lint chain is red. No rule logic changed. |
| `src/lib/claimMyOrganisers.ts` | needed | The A-WEB2 item-3 boundary for `AuthCallback.tsx`. It is a new file in `src/lib`, not in admin-organisers. |
| `src/modules/organiser/edit-in-place/fieldRules.ts` (+`EditInPlaceLayer.test.tsx`) | needed | A-WEB1b item 3 ("Organisation logo" wherever the logo is named) is a one-line label change. The brief owned only `FieldSheet.tsx`. |
| `tests/regression/today/__snapshots__/account.today.test.tsx.snap` | needed | "Add a photo" Home job removed (C15) |
| `src/modules/organiser/__tests__/fpar.review.test.tsx`, `pseries.parity.test.tsx` | needed | They tested the deleted client go-live rule. They now test `goLiveState` over the server answer. |
| `src/modules/admin-organisers/__tests__/routes.matrix.test.tsx` | needed | The signed-out case now allows only `organiser_invite_preview_v1` (D36). |
| `src/pages/__tests__/OrganiserProfileEmpty.matrix.test.tsx` | needed | Excludes the new `report-problem` wa.me link from the contact-button assertions. |
| `src/modules/organiser/shell/__tests__/noHandBuiltLinks.test.ts` | needed | The RELEASE merge conflict, resolved as the brief said: ONE `KNOWN` entry, `'shared/profileProgress.ts'`. |
| `src/modules/profile/__tests__/organiserPublicVisibility.test.ts` | needed | A-WEB2 item 5 test (owned file's test) |

Inside the owned paths, as expected: `flows/add/AddFlow.tsx` and `flows/fix/CoverFlow.tsx` (A-WEB1a, lock gate only); `dates/**`, `events/**`;
`home/**`, `jobs/**`, `page/**`, `team/**`, `wizard/**`, `shell/OrganiserRoutes.tsx` (+1 route), `shared/selfServeErrors.ts` (+3 TEAM_COPY rows);
`event-page/bento/BentoPage.tsx` (+2, the link only); `areas/wizardStep.ts`. **No file needs reverting.**

Integration checks:
- Conflict markers: `grep '^<<<<<<<\|^>>>>>>>\|^=======$'` over every changed non-PNG file found 0 hits. Added lines matching markers: 0.
- PINNED `shared/profileProgress.ts`: byte-identical to the brief block after CRLF->LF (`tr -d '\r' | cmp` exit 0). The index is LF
  (`git ls-files --eol`: `i/lf w/crlf`, from the repo's eol=crlf attribute).
- `areas/wizardStep.ts`: blob a8bca66f is identical to `origin/claude/people-b-web1-areas`.
- ONE path constant: `PROFILE_WIZARD_PATH` is defined only in `profileProgress.ts:44`. Every user imports it (page, wizard, lifecycleModel,
  ProfileLock, ProfileButton); the literal appears only in a comment (`ProfileWizard.tsx:1`).
- ONE go-live label map: `GO_LIVE_LABEL` (`shared/goLiveCheck.ts:34`), read by both the list and the refusal.
- Error-copy maps: invite person `INVITE_PERSON_COPY` (one); redeem `REDEEM_COPY` + the `redeemMismatch` wrapper (F5); team `TEAM_COPY` (+ the
  duplicate string, F6); wizard dancer save `dancerApi.ts:29 COPY` (new codes only, no overlap).
- Field label map: duplicated in the wizard (F4).

## Step 2: correctness against the server bodies

| Client call (file:line) | Server function / args | Answer keys and refusals | Verdict |
|---|---|---|---|
| `invitePersonApi.ts:76` `rpc('admin_invite_person_v1', {p_dancer_profile_id, p_email, p_organiser_id})` | matches | `{invite_id, token, email, link_path, message}`; refusals not_admin, invalid_email, email_in_use, profile_not_found, organiser_not_found (raised) are all mapped | **no-page answer refused, F1** |
| `adminApi.ts:105` `organiser_invite_preview_v1 {p_token}` | matches | `{email_hint, organiser_name}` or `{}`; `{}` -> no hint | OK |
| `adminApi.ts:97` `redeem_organiser_invite_v1 {p_token}` | matches | sign_in_required, unconfirmed_account, email_unproven (no hint), email_mismatch (+`invite_email_hint`), profile_incomplete (raised), rate_limited, invalid, used, revoked, expired, team_full, already_member/redeemed: all mapped (`inviteModel.ts:174-187`, `redeemMismatch.ts`) | OK |
| `claimMyOrganisers.ts:40` `rpcLoose('claim_my_organisers_v1')` | no args | `{status, claimed:[{organiser_id, name}]}`; email_unproven / no_email -> empty list | OK |
| `organiserPublicProfile.ts` `rpcLoose('organiser_full_profile_v1', {p_organiser_id})` | matches, anon grant | boolean; only a literal `true` shows the mark | OK |
| `goLiveCheck.ts:109` `series_go_live_check_v1 {p_series_id}` | matches | keys ready / event_missing / recommended / profile_rule_applies / profile_missing{area, organiser_id, fields}; the nine codes in server order venue, city, upcoming_date, session, cover, description, name, country, organiser; sections venue, dates, programme, cover, about, basics, organisers (+ tickets) all have a route (`OrganiserRoutes.tsx:111-141`). Refusal text `... needs a ready series: <json>` + DETAIL, both parsed (`:118-137`) | OK |
| `profileProgress.ts` `my_profile_progress_v1 {p_organiser_id}` | matches | percent, required_left, publish_ready, steps[{area, field, required, done}], declined: exactly the PINNED keys (`_profile_progress_p5`) | OK |
| `team/publicTeamApi.ts:37` `organiser_team_set_public_v1 {p_organiser_id, p_public}` | matches | status hidden/public/unchanged; raises authentication_required, invalid_arguments, profile_required, not_on_team, team_full: all in `TEAM_COPY` / `PUBLIC_TEAM_FULL` | OK |
| `wizard/dancerApi.ts` `my_dancer_edit_v1`, `save_my_dancer_profile_v2 {p_payload}` | matches; keys first_name, based_city_id, dance_role, avatar_url, nationality, languages, instagram, whatsapp, dance_started_year, surname, bio, website_url, favorite_styles, achievements are all in `c_keys` | whatsapp_not_allowed dead end, F2. `area_closed` is not mapped (generic copy); prod `dancer_area_open` = true today, so it is not live | F2 |
| door `organiser_invite_required`, `team_full` | `selfServeErrors.ts:102-103,280` | match the door trigger / A1b | OK |

- **Boundary**: every new RPC call goes through a local `UntypedRpc` cast (`invitePersonApi.ts:8-11`, `goLiveCheck.ts:13-16`,
  `profileProgress.ts`, `dancerApi.ts:9-12`, `publicTeamApi.ts:8,37`) or the existing `rpcLoose` (claimMyOrganisers, organiser_full_profile).
  `admin_search_people_v1` is typed (in `types.ts:10600`). `as never` in added non-test source: 0. The one hit is a test: `Door.test.tsx`
  `fresh as never`.
- **Parsers refuse bad shapes**: `parseGoLiveCheck` and `parseProfileProgress` throw; `parseSetPublic` throws; `parsePersonInvite` returns null
  (too strict, F1); `parseInvitePreview` and `safeEmailHint` return null; `parseClaimedOrganisers` drops bad rows.
- **Missing function (PGRST202 / 404)**: invite person -> GENERIC copy (test "a missing function shows the normal error state, never raw text");
  preview -> no hint; claim -> []; full profile -> false; go-live check -> `check` undefined, so the button sends and the server decides, and it
  never locks; progress -> the wizard shows `ErrorState` (`ProfileWizard.tsx:133-135`), the Home button is hidden, the lock is off (`profileLock`).
  Nothing crashes.
- **Direct table reads**: `fetchPageLeader` reads `organiser_team_members` + `dancer_profiles` (`invitePersonApi.ts:49-61`), and
  `fetchShownOnPublicTeam` reads `organiser_team_members` (`publicTeamApi.ts:17`). No brief names an RPC for either read (A-WEB2 says "from its
  public team", A-WEB1b names an RPC only for the write). Acceptable; the A-WEB2 handover says so.
- **Personal data in logs**: added `console.*` / Sentry / `captureException` / breadcrumb lines in `src/**` and `app/**`: 0. The invite result is
  held in component state only.
- **AuthCallback routes** (diff traced, `AuthCallback.tsx:56-82, 121-124, 191-217`; with no claim, `claimLanding` is null, which gives exactly
  main's expressions):

| Route | main | target, no claim | target, claimed >= 1 | D37 |
|---|---|---|---|---|
| plain sign-in, no return path | `landingPathAfterAuth` (/account/continue) | same | `/account/o` + notice | yes |
| plain sign-in with returnTo / stashed | returnTo / stashed | same | returnTo / stashed + notice | yes (tests "complete/incomplete profile x claimed 1 x returnTo/stashed invite link") |
| invite redeem (`returnTo=/invite/<t>`) | /invite/<t> | same | /invite/<t> + notice; redeem answers `already_member` because the claim seated them (server membership check runs before the revoked check) | yes |
| dancer sign-up, incomplete stub | fill-in, then routeOnwards, else fallback `returnTo ?? stash ?? "/"` | same | same order, `/account/o` before `/` | yes |
| organiser sign-up (pending_profile_role) | organiser onboarding | same | `/account/o` (no return path) | yes: "land on /account/o only when there was no return path" |
| hidden (deleted) account | restore page | same | restore page, no notice (F7) | n/a |

## Step 3: FIX-A-WEB2's 10 findings on the target

| # | Still fixed? | Evidence | Test that holds it |
|---|---|---|---|
| 1 Tell us 44 px | yes | `AuthCallback.tsx` notice link `inline-flex min-h-[44px] items-center px-2`, `duration: Infinity` | `AuthCallbackOrganiserClaim.test.tsx` > "the Tell us link is a 44 px tap target and the notice stays until closed" |
| 2 returnTo wins (D37) | yes | `AuthCallback.tsx:81` `safeReturnTo ?? pendingReturnTo ?? claimLanding ?? "/"`; `:193-215` | same file > "AuthCallback organiser auto-claim x return path (D37)" > complete/incomplete profile x claimed 1 x returnTo an invite link / stashed invite link (4 + event-page cases) |
| 3 Leader prefill, 2+ = none | yes | `invitePersonApi.ts:55-58` `.limit(2)`, `>= 2 -> several`; `InvitePerson.tsx:25` note | `invitePersonApi.leader.test.ts` > fetchPageLeader > no / one / 2 / 3 Leaders; `invitePersonFixPass.test.tsx` > Leader prefill > "two or more Leaders prefill nobody and say to search" |
| 4 sitemap = page gate (D38) | yes | `app/routes/sitemap.tsx:7,194` `.not(...NOT_PUBLIC_LIFECYCLE)` from `organiserPublicProfile.ts` | `tests/sitemapOrganiserLifecycle.test.ts` > "filters organiser_profiles by the page read's own NOT_PUBLIC_LIFECYCLE" |
| 5 no full email on mismatch (D36) | yes | `redeemMismatch.ts:262-264` reads only `invite_email_hint` via `safeEmailHint` (`invitePreview.ts:10-17`) | `invitePersonFixPass.test.tsx` > "email_mismatch never shows the full invite email" > full invite_email only / a hint that is really a full address / masked hint / masked hint beside a full address |
| 6 surviving mutants | yes | `claimMyOrganisers.ts:37-41` timeout race; literal D16 list | AuthCallbackOrganiserClaim > "a claim call that never answers still lands once its timeout passes"; invitePersonFixPass > "D16 refusal codes (pinned literally)" x5; "Report a problem tap target (mutation M6)"; "Full profile mark answer (mutation M7)" x7 |
| 7 redeem preview hint | yes | `InviteRedeemPage.tsx:119-128,193`; `adminApi.ts:105`; no email field to prefill | `invitePreview.test.tsx` > "asks the preview with the token and shows the masked hint above Sign in", "function missing / network failure / full address / no hint: no hint line" |
| 8 server message | yes (but see F3) | `invitePersonModel.ts:77` `serverMessage ?? ...` | invitePersonFixPass > "uses the server's message instead of a hardcoded expiry", "never states an expiry the server did not send" |
| 9 "Hi Unnamed!" | yes | `invitePersonModel.ts:70` `personName ? Hi X! : Hi!`; `invitePersonApi.ts:27` firstName null | invitePersonFixPass > "greets without a name when the person has none (never \"Hi Unnamed!\")", "the sent message carries the server text and greets a nameless person plainly" |
| 10 curly apostrophe | yes | `invitePersonModel.ts:30` `person's` ASCII | invitePersonFixPass > "the copy has no raw curly punctuation (CLAUDE.md: entities or plain ASCII only)" |

Runs (on the target, this sandbox):
- `npx vitest run invitePersonFixPass invitePersonApi.leader invitePreview invitePerson redeemUnproven routes.matrix AuthCallbackOrganiserClaim
  tests/sitemapOrganiserLifecycle organiserPublicVisibility`: **Test Files 9 passed (9), Tests 125 passed (125)**, 0 failed.
- `npx vitest run src/pages/__tests__/AuthCallback* goLive.webA1a wizard/`: **Test Files 10 passed (10), Tests 215 passed (215)**. This covers all
  six AuthCallback suites (DanceRole, Deletion, Fallback, Notice, OrganiserClaim, SignupConsent), the nine-code Go live table, and the wizard.

## Prod reads used (read-only, counts only)
- `app_feature_flags.dancer_area_open` = true; `dancer_area_access` rows = 1; `my_dancer_edit_v1` and `save_my_dancer_profile_v2` exist on prod.
- Organiser owner/manager seat users = 7, with persona = 7, not WhatsApp-eligible = 4, of those with no phone or whatsapp = 4 (F2).

## Not verified
- No browser walk in this slice (other sections cover it). No mutation runs of my own here (step 6 is another slice).
- F2 depends on whether the admin side intends an organiser seat to count as a WhatsApp-eligible role. It was measured against the release-admin
  bodies, not decided.


---

# B. UI rules (WEB-COMMON.md), measured in a headless browser

Target: `claude/review-people-release-a-web` == `origin/claude/people-release-a-web` (e8095008). Read-only; nothing committed.

## Harness (how the numbers were taken)

- **Production build**: `npm run build` (react-router framework build) with the SAME fake env `playwright.build.config.ts`
  uses (`VITE_SUPABASE_URL=https://phoneqafakenotaproject.supabase.co`, the placeholder anon key from phone-qa.yml,
  `VITE_ENABLE_ORGANISER_DETAIL/DIRECTORY/SELF_SERVE=true`, `NODE_OPTIONS=--import ./tests/e2e-phone/fakeSupabasePreload.mjs`,
  every other `*SUPABASE*` var blanked). Exit **0**. Output in the git-ignored `build/`.
- **Served with `scripts/_serve-build.mjs`, not `npx vite preview`**: this is a react-router framework (SSR) build;
  `vite preview` serves no SSR handler. `_serve-build.mjs` is what the repo's own build smoke (`playwright.build.config.ts`)
  uses, with the fake-Supabase preload answering the server's fetches.
- **Fake RPC boundary**: Playwright 1.63.0, Chromium from /opt/pw-browsers. Reused `tests/e2e/helpers/organiserFake.ts`
  (`OrganiserFake`: fake OTP session in `sb-<ref>-auth-token`, every `/auth/v1` + `/rest/v1` call answered) and, for the two
  public SSR pages, `tests/e2e-phone/helpers.ts#fakeSupabase`. On top, a scratch router answers the Release-A RPCs with the
  shapes from the client parsers and the admin SQL on `origin/claude/people-release-a-admin`:
  `my_profile_progress_v1` (built exactly as `_profile_fields_p5` orders it: required dancer, required organiser, optional dancer,
  optional organiser; `percent = floor(done*100/all)`), `series_go_live_check_v1` (codes/sections as in
  `20261129220000_people_a_db1_series_go_live_check_v1.sql:91-132`), `my_dancer_edit_v1`, `save_my_dancer_profile_v2`,
  `organiser_team_v1` (+`profile_id`), `organiser_team_set_public_v1`, `admin_is_admin`, `admin_search_people_v1`,
  `admin_invite_person_v1`, `redeem_organiser_invite_v1`, `organiser_invite_preview_v1`, `claim_my_organisers_v1`.
- Viewports 390x844 and 360x640 (Pixel 7 traits, isMobile, hasTouch, DSF 1), `reducedMotion: 'reduce'` emulated in every test.
- Per screen, scoped to the NEW component (selector in the script): every visible `button, a[href], a[role=link], input,
  select, textarea, [role=switch]` -> `getBoundingClientRect`; contrast twice: axe `color-contrast` (min ratio over passes +
  violations) AND my own fg/bg computation (colour alpha x ancestor opacity, composited on the first opaque ancestor
  background); disabled controls -> visible text of their `aria-describedby`; snake_case regex + "A · B · C" on `innerText`;
  US-spelling regex; reduced motion = computed `transition-duration`/`animation-duration` > 10 ms on any element in scope
  (the site's global reduced-motion reset sets `all 1e-05s`, counted as 0).
- Script: `/tmp/claude-0/-home-user/fb0d4e52-dea6-5a92-8c68-c9fae19e8f08/scratchpad/ui/screens.rv.ts` (+ `lib.ts`,
  `pw.config.ts`). Run: `npx playwright test --config pw.config.ts` -> **84 passed** (82 in the full run + the email_unproven
  follow-through x2), exit 0. Raw rows: `.../scratchpad/ui/rows.jsonl` (680 rows).
- Screenshots (390x844; PNG, JPEG where the PNG was >150 KB; largest 112.6 KB): 44 files in
  `/home/user/bachata-website/docs/people-arc/reviews/RELEASE-A-WEB-screens/` (untracked, not committed).

**Every listed screen was reached.** One caveat: `A1_APPLIED = false` (`src/modules/organiser/shared/a1Gate.ts:2`), so in this
build Go live is always the OFF row (`goLiveState` -> `a1`); the "tap Go live -> jump to the first missing item" / "send"
paths cannot render in a production build until the merge train flips that flag. The list, its links, the lock and every
label were measured; the tap behaviour was not.

## Findings

1. **should -- Claim notice cannot be dismissed on a phone and covers Home indefinitely.**
   `src/pages/AuthCallback.tsx:61-73` raises the toast with `duration: Infinity`. The shared toast viewport is centred on the
   screen (`src/components/ui/toast.tsx:17`, `fixed top-1/2 ... -translate-y-1/2`) and its close button is
   `opacity-0 ... group-hover:opacity-100` (`toast.tsx:70`). Measured: toast at y=368 (390x844) / y=267 (360x640), 363x107;
   close button **20.3x20.3 px, computed opacity 0, no accessible name**; still on screen after 8 s; `elementFromPoint` at
   the centre of Home's job rows hits the toast: rows "6 Friday Bachata", "7 Sunday Party" (390x844) and "5 Wants to join"
   (360x640) cannot be tapped. Only a sideways swipe (Radix default, undiscoverable) removes it.
   Scenario: an organiser claimed by email lands on Home, a black card sits mid-screen over their to-do rows with no visible
   way to close it. Fix: give this toast a visible 44x44 "Close"/"OK" control (a `ToastAction`-free plain button in the
   description works without the chunk cost noted at line 66), or a finite duration plus a persistent line on Home; do not
   change the shared `toast.tsx` for it (other toasts are short-lived).
   Also measured on it: `transition: all 0.15s` + `animation: enter 0.15s` under `prefers-reduced-motion: reduce`
   (shared primitive, pre-existing; nit for this slice).
2. **should -- The same number reads four different ways** (WEB-COMMON "the same fact reads the same on every screen").
   Same fixture (2 required answers left), measured text:
   Home `"Starter. Finish your profiles, 2 left"` (`home/ProfileButton.tsx:33`) | My page `"Required to publish: 2 left"`
   (`page/index.tsx:23`) | Go live lock `"Finish your profiles first, 2 left"` (`shared/profileProgress.ts:62`) | Go live list
   row `"Complete your profile (2 left)"` (`shared/goLiveCheck.ts:55`). Four hand-written strings, and the fourth counts
   `series_go_live_check_v1.profile_missing` while the other three count `my_profile_progress_v1.required_left` (two RPCs for
   one number; they agreed only because the fixture made them). Fix: one shared label function in `profileProgress.ts`
   used by all four, fed by one number.
3. **should -- Invite person "no hits" points at a control that is not there.** `admin-organisers/InvitePerson.tsx:122`:
   "No one matches "Zz". Check the spelling, or add them as a profile first." Measured: no add-profile control on the
   screen (both viewports). Scenario: the admin looks for the way to "add them as a profile" and finds none here. Fix: drop
   the clause, or link to the admin screen that creates a profile (admin-only screen, so low impact).
4. **nit -- Wizard list step: disabled "Add" has no reason.** `wizard/stepKinds.tsx:184` disables Add while the box is empty;
   it has no `aria-describedby` and no visible reason (measured "NO REASON", 64x48 px). Self-evident to most people, but the
   rule says every disabled control carries its reason. Fix: point it at the existing hint, or keep it enabled and no-op.
5. **nit -- wizard phone help names a control on another screen.** `wizard/registry.tsx` (`organiser('contact_phone')`):
   "It shows on your page only if you switch that on in My page." No link. Fix: "...you can switch that on later in My page"
   is fine as is if the owner accepts naming another screen; otherwise link it.

No failures on: 44 px targets (every new control; smallest 44x44), contrast (axe min 6.42:1, own computation min 6.42:1;
nothing under 4.5:1 anywhere), raw codes (none), British English (no US spellings), reduced motion (0 on every new
component; `Celebration` reads `data-motion=off`; `ProgressBar` and the team switch use `motion-reduce:transition-none`),
untouched save (wizard: 1 save for a changed answer, still 1 after Back + Continue unchanged; Invite: 0 RPCs on Enter in the
empty form), disabled-with-reason (Go live off rows, Invite, team switch without profile, wizard required Continue), failed
save keeps the answer ("Ana" kept, "Your answer was not saved. Try again. Your answer is kept."), every Go live item link
lands on a working screen, email_unproven way out lands on `/auth?mode=signin&returnTo=/invite/<token>` which shows
"Email me a sign-in link".

Unrelated to my slice, observed: the Website working tree shows 11 modified `*.snap` files (`tests/regression/today/__snapshots__/*`,
`src/modules/dancer-app/public-page/__tests__/__snapshots__/embedded.test.tsx.snap`), mtimes 15:57-15:59 UTC, LF line-ending
rewrites. I ran no vitest; another sub-agent's unit run likely wrote them. I did not revert them (another agent may own them);
the orchestrator should `git checkout -- <those files>` once all slices finish.

## Results table (both = identical value and verdict at 390x844 and 360x640)

| screen | viewport | rule | measured value | pass/fail |
|---|---|---|---|---|
| Go live missing venue | both | 4.5:1 contrast (axe) | 5 text nodes, min 6.42:1 | PASS |
| Go live missing venue | both | 4.5:1 contrast (computed fg/bg) | 7 text elements, min 6.42:1 | PASS |
| Go live missing venue | both | 44px tap targets | 390: 4 controls, min 335.7x52 ;; 360: 4 controls, min 305.8x52 | PASS |
| Go live missing venue | both | British English | no US spelling found | PASS |
| Go live missing venue | both | disabled has visible reason | Go live [org-life-golive]: Needs the next platform update.; See it live [org-life-seelive]: Dancers can see it once it is live. | PASS |
| Go live missing venue | both | item links land on a working screen | Go live off, reason "Needs the next platform update."; /account/o/events/:id/details -> /account/o/events/:id/details | PASS |
| Go live missing venue | both | no raw codes / A·B·C | none | PASS |
| Go live missing venue | both | no text points at absent control |  | PASS |
| Go live missing venue | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Go live missing city | both | 4.5:1 contrast (axe) | 5 text nodes, min 6.42:1 | PASS |
| Go live missing city | both | 4.5:1 contrast (computed fg/bg) | 7 text elements, min 6.42:1 | PASS |
| Go live missing city | both | 44px tap targets | 390: 4 controls, min 335.7x52 ;; 360: 4 controls, min 305.8x52 | PASS |
| Go live missing city | both | British English | no US spelling found | PASS |
| Go live missing city | both | disabled has visible reason | Go live [org-life-golive]: Needs the next platform update.; See it live [org-life-seelive]: Dancers can see it once it is live. | PASS |
| Go live missing city | both | item links land on a working screen | Go live off, reason "Needs the next platform update."; /account/o/events/:id/details -> /account/o/events/:id/details | PASS |
| Go live missing city | both | no raw codes / A·B·C | none | PASS |
| Go live missing city | both | no text points at absent control |  | PASS |
| Go live missing city | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Go live missing upcoming_date | both | 4.5:1 contrast (axe) | 5 text nodes, min 6.42:1 | PASS |
| Go live missing upcoming_date | both | 4.5:1 contrast (computed fg/bg) | 7 text elements, min 6.42:1 | PASS |
| Go live missing upcoming_date | both | 44px tap targets | 390: 4 controls, min 335.7x52 ;; 360: 4 controls, min 305.8x52 | PASS |
| Go live missing upcoming_date | both | British English | no US spelling found | PASS |
| Go live missing upcoming_date | both | disabled has visible reason | Go live [org-life-golive]: Needs the next platform update.; See it live [org-life-seelive]: Dancers can see it once it is live. | PASS |
| Go live missing upcoming_date | both | item links land on a working screen | Go live off, reason "Needs the next platform update."; /account/o/add/:id -> /account/o/add/:id | PASS |
| Go live missing upcoming_date | both | no raw codes / A·B·C | none | PASS |
| Go live missing upcoming_date | both | no text points at absent control |  | PASS |
| Go live missing upcoming_date | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Go live missing session | both | 4.5:1 contrast (axe) | 5 text nodes, min 6.42:1 | PASS |
| Go live missing session | both | 4.5:1 contrast (computed fg/bg) | 7 text elements, min 6.42:1 | PASS |
| Go live missing session | both | 44px tap targets | 390: 4 controls, min 335.7x52 ;; 360: 4 controls, min 305.8x52 | PASS |
| Go live missing session | both | British English | no US spelling found | PASS |
| Go live missing session | both | disabled has visible reason | Go live [org-life-golive]: Needs the next platform update.; See it live [org-life-seelive]: Dancers can see it once it is live. | PASS |
| Go live missing session | both | item links land on a working screen | Go live off, reason "Needs the next platform update."; /account/o/events/:id/programme -> /account/o/events/:id/programme | PASS |
| Go live missing session | both | no raw codes / A·B·C | none | PASS |
| Go live missing session | both | no text points at absent control |  | PASS |
| Go live missing session | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Go live missing cover | both | 4.5:1 contrast (axe) | 5 text nodes, min 6.42:1 | PASS |
| Go live missing cover | both | 4.5:1 contrast (computed fg/bg) | 7 text elements, min 6.42:1 | PASS |
| Go live missing cover | both | 44px tap targets | 390: 4 controls, min 335.7x52 ;; 360: 4 controls, min 305.8x52 | PASS |
| Go live missing cover | both | British English | no US spelling found | PASS |
| Go live missing cover | both | disabled has visible reason | Go live [org-life-golive]: Needs the next platform update.; See it live [org-life-seelive]: Dancers can see it once it is live. | PASS |
| Go live missing cover | both | item links land on a working screen | Go live off, reason "Needs the next platform update."; /account/o/cover/:id -> /account/o/cover/:id | PASS |
| Go live missing cover | both | no raw codes / A·B·C | none | PASS |
| Go live missing cover | both | no text points at absent control |  | PASS |
| Go live missing cover | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Go live missing description | both | 4.5:1 contrast (axe) | 5 text nodes, min 6.42:1 | PASS |
| Go live missing description | both | 4.5:1 contrast (computed fg/bg) | 7 text elements, min 6.42:1 | PASS |
| Go live missing description | both | 44px tap targets | 390: 4 controls, min 335.7x52 ;; 360: 4 controls, min 305.8x52 | PASS |
| Go live missing description | both | British English | no US spelling found | PASS |
| Go live missing description | both | disabled has visible reason | Go live [org-life-golive]: Needs the next platform update.; See it live [org-life-seelive]: Dancers can see it once it is live. | PASS |
| Go live missing description | both | item links land on a working screen | Go live off, reason "Needs the next platform update."; /account/o/events/:id/details -> /account/o/events/:id/details | PASS |
| Go live missing description | both | no raw codes / A·B·C | none | PASS |
| Go live missing description | both | no text points at absent control |  | PASS |
| Go live missing description | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Go live missing name | both | 4.5:1 contrast (axe) | 5 text nodes, min 6.42:1 | PASS |
| Go live missing name | both | 4.5:1 contrast (computed fg/bg) | 7 text elements, min 6.42:1 | PASS |
| Go live missing name | both | 44px tap targets | 390: 4 controls, min 335.7x52 ;; 360: 4 controls, min 305.8x52 | PASS |
| Go live missing name | both | British English | no US spelling found | PASS |
| Go live missing name | both | disabled has visible reason | Go live [org-life-golive]: Needs the next platform update.; See it live [org-life-seelive]: Dancers can see it once it is live. | PASS |
| Go live missing name | both | item links land on a working screen | Go live off, reason "Needs the next platform update."; /account/o/events/:id/details -> /account/o/events/:id/details | PASS |
| Go live missing name | both | no raw codes / A·B·C | none | PASS |
| Go live missing name | both | no text points at absent control |  | PASS |
| Go live missing name | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Go live missing country | both | 4.5:1 contrast (axe) | 5 text nodes, min 6.42:1 | PASS |
| Go live missing country | both | 4.5:1 contrast (computed fg/bg) | 7 text elements, min 6.42:1 | PASS |
| Go live missing country | both | 44px tap targets | 390: 4 controls, min 335.7x52 ;; 360: 4 controls, min 305.8x52 | PASS |
| Go live missing country | both | British English | no US spelling found | PASS |
| Go live missing country | both | disabled has visible reason | Go live [org-life-golive]: Needs the next platform update.; See it live [org-life-seelive]: Dancers can see it once it is live. | PASS |
| Go live missing country | both | item links land on a working screen | Go live off, reason "Needs the next platform update."; /account/o/events/:id/details -> /account/o/events/:id/details | PASS |
| Go live missing country | both | no raw codes / A·B·C | none | PASS |
| Go live missing country | both | no text points at absent control |  | PASS |
| Go live missing country | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Go live missing organiser | both | 4.5:1 contrast (axe) | 5 text nodes, min 6.42:1 | PASS |
| Go live missing organiser | both | 4.5:1 contrast (computed fg/bg) | 7 text elements, min 6.42:1 | PASS |
| Go live missing organiser | both | 44px tap targets | 390: 4 controls, min 335.7x52 ;; 360: 4 controls, min 305.8x52 | PASS |
| Go live missing organiser | both | British English | no US spelling found | PASS |
| Go live missing organiser | both | disabled has visible reason | Go live [org-life-golive]: Needs the next platform update.; See it live [org-life-seelive]: Dancers can see it once it is live. | PASS |
| Go live missing organiser | both | item links land on a working screen | Go live off, reason "Needs the next platform update."; /account/o/events/:id/organisers -> /account/o/events/:id/organisers | PASS |
| Go live missing organiser | both | no raw codes / A·B·C | none | PASS |
| Go live missing organiser | both | no text points at absent control |  | PASS |
| Go live missing organiser | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Go live all nine + profile row | both | 4.5:1 contrast (axe) | 16 text nodes, min 6.42:1 | PASS |
| Go live all nine + profile row | both | 4.5:1 contrast (computed fg/bg) | 18 text elements, min 6.42:1 | PASS |
| Go live all nine + profile row | both | 44px tap targets | 390: 14 controls, min 335.7x52 ;; 360: 14 controls, min 305.8x52 | PASS |
| Go live all nine + profile row | both | British English | no US spelling found | PASS |
| Go live all nine + profile row | both | disabled has visible reason | Go live [org-life-golive]: Needs the next platform update.; See it live [org-life-seelive]: Dancers can see it once it is live. | PASS |
| Go live all nine + profile row | both | item links land on a working screen | Go live off, reason "Needs the next platform update."; /account/o/events/:id/details -> /account/o/events/:id/details; /account/o/events/:id/details -> /account/o/events/:id/details; /account/o/add/:id -> /account/o/add/:id; /account/o/events/:id/programme -> /account/o/events/:id/programme; /account/o/cover/:id -> /account/o/co | PASS |
| Go live all nine + profile row | both | no raw codes / A·B·C | none | PASS |
| Go live all nine + profile row | both | no text points at absent control |  | PASS |
| Go live all nine + profile row | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Go live ready | both | 4.5:1 contrast (axe) | 3 text nodes, min 6.42:1 | PASS |
| Go live ready | both | 4.5:1 contrast (computed fg/bg) | 5 text elements, min 6.42:1 | PASS |
| Go live ready | both | 44px tap targets | 390: 3 controls, min 335.7x52 ;; 360: 3 controls, min 305.8x52 | PASS |
| Go live ready | both | British English | no US spelling found | PASS |
| Go live ready | both | disabled has visible reason | Go live [org-life-golive]: Your event is ready. Go live switches on here after the next platform update.; See it live [org-life-seelive]: Dancers can see it once it is live. | PASS |
| Go live ready | both | item links land on a working screen | Go live off, reason "Your event is ready. Go live switches on here after the next platform update." | n/a |
| Go live ready | both | no raw codes / A·B·C | none | PASS |
| Go live ready | both | no text points at absent control |  | PASS |
| Go live ready | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Go live recommended-only | both | 4.5:1 contrast (axe) | 5 text nodes, min 6.42:1 | PASS |
| Go live recommended-only | both | 4.5:1 contrast (computed fg/bg) | 7 text elements, min 6.42:1 | PASS |
| Go live recommended-only | both | 44px tap targets | 390: 4 controls, min 335.7x52 ;; 360: 4 controls, min 305.8x52 | PASS |
| Go live recommended-only | both | British English | no US spelling found | PASS |
| Go live recommended-only | both | disabled has visible reason | Go live [org-life-golive]: Your event is ready. Go live switches on here after the next platform update.; See it live [org-life-seelive]: Dancers can see it once it is live. | PASS |
| Go live recommended-only | both | item links land on a working screen | Go live off, reason "Your event is ready. Go live switches on here after the next platform update."; /account/o/events/:id/details -> /account/o/events/:id/details | PASS |
| Go live recommended-only | both | no raw codes / A·B·C | none | PASS |
| Go live recommended-only | both | no text points at absent control |  | PASS |
| Go live recommended-only | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Go live locked by profile | both | 4.5:1 contrast (axe) | 6 text nodes, min 6.42:1 | PASS |
| Go live locked by profile | both | 4.5:1 contrast (computed fg/bg) | 8 text elements, min 6.42:1 | PASS |
| Go live locked by profile | both | 44px tap targets | 390: 4 controls, min 335.7x52 ;; 360: 4 controls, min 305.8x52 | PASS |
| Go live locked by profile | both | British English | no US spelling found | PASS |
| Go live locked by profile | both | disabled has visible reason | Go live [org-life-golive]: Finish your profiles first, 2 left; See it live [org-life-seelive]: Dancers can see it once it is live. | PASS |
| Go live locked by profile | both | no raw codes / A·B·C | none | PASS |
| Go live locked by profile | both | no text points at absent control | reason names profiles; "Complete your profile" link on screen: true | PASS |
| Go live locked by profile | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Claim notice | both | 4.5:1 contrast (axe) | 1 text nodes, min 21.00:1; 2 undecidable | PASS |
| Claim notice | both | 4.5:1 contrast (computed fg/bg) | 3 text elements, min 16.75:1 | PASS |
| Claim notice | both | 44px tap targets | 2 controls, min 20.3x20.3; under 44: BUTTON 20.3x20.3 | FAIL |
| Claim notice | both | British English | no US spelling found | PASS |
| Claim notice | both | Home controls covered by the toast | 390: 6 Friday Bachata Needs a flyer; 7 Sunday Party Needs a flyer ;; 360: 5 Wants to join tom.b@example.com | FAIL |
| Claim notice | both | disabled has visible reason | no disabled control | n/a |
| Claim notice | both | no raw codes / A·B·C | none | PASS |
| Claim notice | both | notice shown | toast shown; landed /account/o; claim_my_organisers_v1 x1 | PASS |
| Claim notice | both | reduced motion | 0 running animations; li: transition all 0.15s animation enter 0.15s; button: transition opacity 0.15s | FAIL |
| Claim notice | both | toast geometry / dismiss | 390: {"toast":"14,368 363x107","closeOpacity":"0","close":"20.34375x20.34375","closeLabel":"","tellUs":"50x44","vh":844} ;; 360: {"toast":"14,267 333x107","closeOpacity":"0","close":"20.25x20.25","closeLabel":"","tellUs":"49x44","vh":640} | n/a |
| Claim notice | both | toast still on screen after 8 s (duration Infinity) | true | n/a |
| Home auto-open (Starter, no Finish later) | both | lands on wizard | /account/o/complete | PASS |
| Home card Ready | both | 4.5:1 contrast (axe) | 3 text nodes, min 6.42:1; 1 undecidable | PASS |
| Home card Ready | both | 4.5:1 contrast (computed fg/bg) | 4 text elements, min 6.42:1 | PASS |
| Home card Ready | both | 44px tap targets | 390: 2 controls, min 358x44 ;; 360: 2 controls, min 328x44 | PASS |
| Home card Ready | both | British English | no US spelling found | PASS |
| Home card Ready | both | card shown as expected | shown=true; "93% Complete your profile Ready to publish Not now" | PASS |
| Home card Ready | both | disabled has visible reason | no disabled control | n/a |
| Home card Ready | both | no raw codes / A·B·C | none | PASS |
| Home card Ready | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Home card Starter | both | 4.5:1 contrast (axe) | 2 text nodes, min 6.42:1; 1 undecidable | PASS |
| Home card Starter | both | 4.5:1 contrast (computed fg/bg) | 3 text elements, min 6.42:1 | PASS |
| Home card Starter | both | 44px tap targets | 390: 1 controls, min 358x64 ;; 360: 1 controls, min 328x64 | PASS |
| Home card Starter | both | British English | no US spelling found | PASS |
| Home card Starter | both | card shown as expected | shown=true; "90% Complete your profile Starter. Finish your profiles, 2 left" | PASS |
| Home card Starter | both | disabled has visible reason | no disabled control | n/a |
| Home card Starter | both | no raw codes / A·B·C | none | PASS |
| Home card Starter | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Home card hidden at 100 | both | 4.5:1 contrast (axe) | 25 text nodes, min 9.14:1 | PASS |
| Home card hidden at 100 | both | 4.5:1 contrast (computed fg/bg) | 25 text elements, min 9.14:1 | PASS |
| Home card hidden at 100 | both | 44px tap targets | 13 controls, min 44x44 | PASS |
| Home card hidden at 100 | both | British English | no US spelling found | PASS |
| Home card hidden at 100 | both | card shown as expected | shown=false | PASS |
| Home card hidden at 100 | both | disabled has visible reason | no disabled control | n/a |
| Home card hidden at 100 | both | no raw codes / A·B·C | none | PASS |
| Home card hidden at 100 | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Invite email_unproven -> sign-in | both | way out offers the email link | landed /auth?mode=signin&returnTo=%2Finvite%2Fabababababababababababababababababababababababababababababababab; password inputs visible 0; email-link/code wording 1; controls: Sign in / Create account / you@example.com / Email me a sign-in link / New here? Create an account / Continue browsing | PASS |
| Invite landing email mismatch | both | 4.5:1 contrast (axe) | 1 text nodes, min 10.70:1; 3 undecidable | PASS |
| Invite landing email mismatch | both | 4.5:1 contrast (computed fg/bg) | 4 text elements, min 9.14:1 | PASS |
| Invite landing email mismatch | both | 44px tap targets | 390: 2 controls, min 352.9x44 ;; 360: 2 controls, min 333x44 | PASS |
| Invite landing email mismatch | both | British English | no US spelling found | PASS |
| Invite landing email mismatch | both | button label | Sign out | PASS |
| Invite landing email mismatch | both | disabled has visible reason | no disabled control | n/a |
| Invite landing email mismatch | both | no raw codes / A·B·C | none | PASS |
| Invite landing email mismatch | both | no text points at absent control | body names "Sign out"; button reads "Sign out" | PASS |
| Invite landing email mismatch | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Invite landing email unproven | both | 4.5:1 contrast (axe) | 1 text nodes, min 10.70:1; 3 undecidable | PASS |
| Invite landing email unproven | both | 4.5:1 contrast (computed fg/bg) | 4 text elements, min 9.14:1 | PASS |
| Invite landing email unproven | both | 44px tap targets | 390: 2 controls, min 352.9x44 ;; 360: 2 controls, min 333x44 | PASS |
| Invite landing email unproven | both | British English | no US spelling found | PASS |
| Invite landing email unproven | both | button label | Sign in with the email link | PASS |
| Invite landing email unproven | both | disabled has visible reason | no disabled control | n/a |
| Invite landing email unproven | both | no raw codes / A·B·C | none | PASS |
| Invite landing email unproven | both | no text points at absent control | body names no control; button "Sign in with the email link" | PASS |
| Invite landing email unproven | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Invite landing signed out (hint) | both | 4.5:1 contrast (axe) | 1 text nodes, min 10.70:1; 3 undecidable | PASS |
| Invite landing signed out (hint) | both | 4.5:1 contrast (computed fg/bg) | 4 text elements, min 9.14:1 | PASS |
| Invite landing signed out (hint) | both | 44px tap targets | 390: 1 controls, min 352.9x44 ;; 360: 1 controls, min 333x44 | PASS |
| Invite landing signed out (hint) | both | British English | no US spelling found | PASS |
| Invite landing signed out (hint) | both | disabled has visible reason | no disabled control | n/a |
| Invite landing signed out (hint) | both | no raw codes / A·B·C | none | PASS |
| Invite landing signed out (hint) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Invite person (empty form) | both | 4.5:1 contrast (axe) | 4 text nodes, min 9.14:1; 5 undecidable | PASS |
| Invite person (empty form) | both | 4.5:1 contrast (computed fg/bg) | 6 text elements, min 9.14:1 | PASS |
| Invite person (empty form) | both | 44px tap targets | 390: 5 controls, min 51.8x44 ;; 360: 5 controls, min 51.6x44 | PASS |
| Invite person (empty form) | both | British English | no US spelling found | PASS |
| Invite person (empty form) | both | disabled has visible reason | Invite [invite-person-submit]: Choose the person to invite. | PASS |
| Invite person (empty form) | both | no raw codes / A·B·C | none | PASS |
| Invite person (empty form) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Invite person (empty form) | both | untouched save sends nothing | admin_invite_person_v1 x0 after Enter on the empty form | PASS |
| Invite person (no hits) | both | 4.5:1 contrast (axe) | 4 text nodes, min 9.14:1; 5 undecidable | PASS |
| Invite person (no hits) | both | 4.5:1 contrast (computed fg/bg) | 6 text elements, min 9.14:1 | PASS |
| Invite person (no hits) | both | 44px tap targets | 390: 5 controls, min 51.8x44 ;; 360: 5 controls, min 51.6x44 | PASS |
| Invite person (no hits) | both | British English | no US spelling found | PASS |
| Invite person (no hits) | both | disabled has visible reason | Invite [invite-person-submit]: Choose the person to invite. | PASS |
| Invite person (no hits) | both | empty state has one action | "No one matches “Zz”. Check the spelling, or add them as a profile first."; a control to add a profile on screen: false | FAIL |
| Invite person (no hits) | both | no raw codes / A·B·C | none | PASS |
| Invite person (no hits) | both | no text points at absent control | "add them as a profile first" -> add-profile control on screen: false | FAIL |
| Invite person (no hits) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Invite person (result) | both | 4.5:1 contrast (axe) | 3 text nodes, min 10.70:1; 3 undecidable | PASS |
| Invite person (result) | both | 4.5:1 contrast (computed fg/bg) | 6 text elements, min 8.21:1 | PASS |
| Invite person (result) | both | 44px tap targets | 390: 4 controls, min 50.4x44 ;; 360: 4 controls, min 50.2x44 | PASS |
| Invite person (result) | both | British English | no US spelling found | PASS |
| Invite person (result) | both | disabled has visible reason | no disabled control | n/a |
| Invite person (result) | both | no raw codes / A·B·C | none | PASS |
| Invite person (result) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Invite person (search hits) | both | 4.5:1 contrast (axe) | 4 text nodes, min 9.14:1; 5 undecidable | PASS |
| Invite person (search hits) | both | 4.5:1 contrast (computed fg/bg) | 6 text elements, min 9.14:1 | PASS |
| Invite person (search hits) | both | 44px tap targets | 390: 6 controls, min 51.8x44 ;; 360: 6 controls, min 51.6x44 | PASS |
| Invite person (search hits) | both | British English | no US spelling found | PASS |
| Invite person (search hits) | both | disabled has visible reason | Invite [invite-person-submit]: Choose the person to invite. | PASS |
| Invite person (search hits) | both | no raw codes / A·B·C | none | PASS |
| Invite person (search hits) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| My page required line | both | 4.5:1 contrast (axe) | 1 text nodes, min 15.86:1 | PASS |
| My page required line | both | 4.5:1 contrast (computed fg/bg) | 1 text elements, min 15.86:1 | PASS |
| My page required line | both | 44px tap targets | 390: 1 controls, min 358x48 ;; 360: 1 controls, min 328x48 | PASS |
| My page required line | both | British English | no US spelling found | PASS |
| My page required line | both | disabled has visible reason | no disabled control | n/a |
| My page required line | both | no raw codes / A·B·C | none | PASS |
| My page required line | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Report a problem (event page) | both | 4.5:1 contrast (axe) | 0 text nodes, min -:1; 1 undecidable | PASS |
| Report a problem (event page) | both | 4.5:1 contrast (computed fg/bg) | 1 text elements, min 13.08:1 | PASS |
| Report a problem (event page) | both | 44px tap targets | 390: 1 controls, min 230.1x44 ;; 360: 1 controls, min 228.9x44 | PASS |
| Report a problem (event page) | both | British English | no US spelling found | PASS |
| Report a problem (event page) | both | disabled has visible reason | no disabled control | n/a |
| Report a problem (event page) | both | link carries page address | https://wa.me/447577576006?text=Hi! Something is wrong on this Bachata Calendar page: http://127.0.0.1:4196/event/flag-social-phone-qa | PASS |
| Report a problem (event page) | both | no raw codes / A·B·C | none | PASS |
| Report a problem (event page) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Report a problem (organiser page) | both | 4.5:1 contrast (axe) | 0 text nodes, min -:1; 1 undecidable | PASS |
| Report a problem (organiser page) | both | 4.5:1 contrast (computed fg/bg) | 1 text elements, min 11.70:1 | PASS |
| Report a problem (organiser page) | both | 44px tap targets | 390: 1 controls, min 230.1x44 ;; 360: 1 controls, min 228.9x44 | PASS |
| Report a problem (organiser page) | both | British English | no US spelling found | PASS |
| Report a problem (organiser page) | both | disabled has visible reason | no disabled control | n/a |
| Report a problem (organiser page) | both | link carries page address | https://wa.me/447577576006?text=Hi! Something is wrong on this Bachata Calendar page: http://127.0.0.1:4196/organisers/ritmo-phone-qa | PASS |
| Report a problem (organiser page) | both | no raw codes / A·B·C | none | PASS |
| Report a problem (organiser page) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Same fact: profile answers left | both | one wording for the same number | Home: "Starter. Finish your profiles, 2 left" / My page: "Required to publish: 2 left" / Go live lock: "Finish your profiles first, 2 left" + link "Complete your profile" / Go live list row (unlocked/admin): "Complete your profile (2 left)" | FAIL |
| Team public toggle (no dancer profile) | both | 4.5:1 contrast (axe) | 1 text nodes, min 6.42:1 | PASS |
| Team public toggle (no dancer profile) | both | 4.5:1 contrast (computed fg/bg) | 2 text elements, min 6.42:1 | PASS |
| Team public toggle (no dancer profile) | both | 44px tap targets | 1 controls, min 64x44 | PASS |
| Team public toggle (no dancer profile) | both | British English | no US spelling found | PASS |
| Team public toggle (no dancer profile) | both | disabled has visible reason | team-public-switch [team-public-switch]: Finish your dancer profile first, then you can show on the public team. | PASS |
| Team public toggle (no dancer profile) | both | no raw codes / A·B·C | none | PASS |
| Team public toggle (no dancer profile) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Team public toggle (off) | both | 4.5:1 contrast (axe) | 2 text nodes, min 6.42:1 | PASS |
| Team public toggle (off) | both | 4.5:1 contrast (computed fg/bg) | 2 text elements, min 6.42:1 | PASS |
| Team public toggle (off) | both | 44px tap targets | 1 controls, min 64x44 | PASS |
| Team public toggle (off) | both | British English | no US spelling found | PASS |
| Team public toggle (off) | both | disabled has visible reason | no disabled control | n/a |
| Team public toggle (off) | both | no raw codes / A·B·C | none | PASS |
| Team public toggle (off) | both | one tap sends one write | organiser_team_set_public_v1 x1 | PASS |
| Team public toggle (off) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Wizard 100 percent | 360x640 | 4.5:1 contrast (axe) | 8 text nodes, min 6.97:1; 1 undecidable | PASS |
| Wizard 100 percent | 390x844 | 4.5:1 contrast (axe) | 9 text nodes, min 6.97:1 | PASS |
| Wizard 100 percent | both | 4.5:1 contrast (computed fg/bg) | 9 text elements, min 6.98:1 | PASS |
| Wizard 100 percent | both | 44px tap targets | 3 controls, min 73.8x44 | PASS |
| Wizard 100 percent | both | British English | no US spelling found | PASS |
| Wizard 100 percent | both | disabled has visible reason | no disabled control | n/a |
| Wizard 100 percent | both | no raw codes / A·B·C | none | PASS |
| Wizard 100 percent | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Wizard choice step (dance role) | both | 4.5:1 contrast (axe) | 8 text nodes, min 6.97:1 | PASS |
| Wizard choice step (dance role) | both | 4.5:1 contrast (computed fg/bg) | 8 text elements, min 6.98:1 | PASS |
| Wizard choice step (dance role) | both | 44px tap targets | 5 controls, min 72.1x44 | PASS |
| Wizard choice step (dance role) | both | British English | no US spelling found | PASS |
| Wizard choice step (dance role) | both | disabled has visible reason | no disabled control | n/a |
| Wizard choice step (dance role) | both | no raw codes / A·B·C | none | PASS |
| Wizard choice step (dance role) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Wizard elsewhere step (photo) | both | 4.5:1 contrast (axe) | 5 text nodes, min 9.88:1; 1 undecidable | PASS |
| Wizard elsewhere step (photo) | both | 4.5:1 contrast (computed fg/bg) | 6 text elements, min 6.98:1 | PASS |
| Wizard elsewhere step (photo) | both | 44px tap targets | 3 controls, min 73.8x44 | PASS |
| Wizard elsewhere step (photo) | both | British English | no US spelling found | PASS |
| Wizard elsewhere step (photo) | both | disabled has visible reason | no disabled control | n/a |
| Wizard elsewhere step (photo) | both | no raw codes / A·B·C | none | PASS |
| Wizard elsewhere step (photo) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Wizard list step (languages, one added) | both | 4.5:1 contrast (axe) | 8 text nodes, min 6.97:1 | PASS |
| Wizard list step (languages, one added) | both | 4.5:1 contrast (computed fg/bg) | 7 text elements, min 6.98:1 | PASS |
| Wizard list step (languages, one added) | both | 44px tap targets | 6 controls, min 44x44 | PASS |
| Wizard list step (languages, one added) | both | British English | no US spelling found | PASS |
| Wizard list step (languages, one added) | both | disabled has visible reason | Add [step-list-add]: NO REASON | FAIL |
| Wizard list step (languages, one added) | both | no raw codes / A·B·C | none | PASS |
| Wizard list step (languages, one added) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Wizard milestone (ready to publish) | both | 4.5:1 contrast (axe) | 10 text nodes, min 6.97:1; 1 undecidable | PASS |
| Wizard milestone (ready to publish) | both | 4.5:1 contrast (computed fg/bg) | 11 text elements, min 6.98:1 | PASS |
| Wizard milestone (ready to publish) | both | 44px tap targets | 3 controls, min 73.8x44 | PASS |
| Wizard milestone (ready to publish) | both | British English | no US spelling found | PASS |
| Wizard milestone (ready to publish) | both | celebration under reduced motion | data-motion=off | PASS |
| Wizard milestone (ready to publish) | both | disabled has visible reason | no disabled control | n/a |
| Wizard milestone (ready to publish) | both | no raw codes / A·B·C | none | PASS |
| Wizard milestone (ready to publish) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Wizard milestone (ready to publish) | both | untouched save sends nothing | save calls 1 for one changed answer | PASS |
| Wizard optional text step (skip) | both | 4.5:1 contrast (axe) | 7 text nodes, min 6.97:1 | PASS |
| Wizard optional text step (skip) | both | 4.5:1 contrast (computed fg/bg) | 6 text elements, min 6.98:1 | PASS |
| Wizard optional text step (skip) | both | 44px tap targets | 4 controls, min 73.8x44 | PASS |
| Wizard optional text step (skip) | both | British English | no US spelling found | PASS |
| Wizard optional text step (skip) | both | disabled has visible reason | no disabled control | n/a |
| Wizard optional text step (skip) | both | no raw codes / A·B·C | none | PASS |
| Wizard optional text step (skip) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Wizard pick step (city, results) | both | 4.5:1 contrast (axe) | 6 text nodes, min 9.88:1; 1 undecidable | PASS |
| Wizard pick step (city, results) | both | 4.5:1 contrast (computed fg/bg) | 6 text elements, min 6.98:1 | PASS |
| Wizard pick step (city, results) | both | 44px tap targets | 4 controls, min 73.8x44 | PASS |
| Wizard pick step (city, results) | both | British English | no US spelling found | PASS |
| Wizard pick step (city, results) | both | disabled has visible reason | no disabled control | n/a |
| Wizard pick step (city, results) | both | no raw codes / A·B·C | none | PASS |
| Wizard pick step (city, results) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Wizard pick step (no match) | both | 4.5:1 contrast (axe) | 6 text nodes, min 6.97:1; 1 undecidable | PASS |
| Wizard pick step (no match) | both | 4.5:1 contrast (computed fg/bg) | 6 text elements, min 6.98:1 | PASS |
| Wizard pick step (no match) | both | 44px tap targets | 3 controls, min 73.8x44 | PASS |
| Wizard pick step (no match) | both | British English | no US spelling found | PASS |
| Wizard pick step (no match) | both | disabled has visible reason | no disabled control | n/a |
| Wizard pick step (no match) | both | empty state has one action | "Nothing matches. Try a different spelling." with the search box on screen | PASS |
| Wizard pick step (no match) | both | no raw codes / A·B·C | none | PASS |
| Wizard pick step (no match) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Wizard save error | both | 4.5:1 contrast (axe) | 7 text nodes, min 6.97:1; 1 undecidable | PASS |
| Wizard save error | both | 4.5:1 contrast (computed fg/bg) | 7 text elements, min 6.98:1 | PASS |
| Wizard save error | both | 44px tap targets | 4 controls, min 73.8x44 | PASS |
| Wizard save error | both | British English | no US spelling found | PASS |
| Wizard save error | both | answer kept on failed save | input still "Ana"; error "Your answer was not saved. Try again. Your answer is kept." | PASS |
| Wizard save error | both | disabled has visible reason | no disabled control | n/a |
| Wizard save error | both | no raw codes / A·B·C | none | PASS |
| Wizard save error | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Wizard text step (required, blank) | both | 4.5:1 contrast (axe) | 6 text nodes, min 6.97:1 | PASS |
| Wizard text step (required, blank) | both | 4.5:1 contrast (computed fg/bg) | 5 text elements, min 6.98:1 | PASS |
| Wizard text step (required, blank) | both | 44px tap targets | 4 controls, min 73.8x44 | PASS |
| Wizard text step (required, blank) | both | British English | no US spelling found | PASS |
| Wizard text step (required, blank) | both | disabled has visible reason | Continue [step-continue]: Needed before your events can go live. | PASS |
| Wizard text step (required, blank) | both | no raw codes / A·B·C | none | PASS |
| Wizard text step (required, blank) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |
| Wizard untouched answer | both | untouched save sends nothing | save RPCs: 1 after a changed answer, 1 after Back + Continue unchanged | PASS |
| Wizard upload step (org logo) | both | 4.5:1 contrast (axe) | 6 text nodes, min 6.97:1 | PASS |
| Wizard upload step (org logo) | both | 4.5:1 contrast (computed fg/bg) | 6 text elements, min 6.98:1 | PASS |
| Wizard upload step (org logo) | both | 44px tap targets | 3 controls, min 73.8x44 | PASS |
| Wizard upload step (org logo) | both | British English | no US spelling found | PASS |
| Wizard upload step (org logo) | both | disabled has visible reason | no disabled control | n/a |
| Wizard upload step (org logo) | both | no raw codes / A·B·C | none | PASS |
| Wizard upload step (org logo) | both | reduced motion | 0 transitions/animations with duration > 0 | PASS |


---

# C. Prod shape survey (stsdtacfauprzrdebmzg, 2026-10-20, read-only SELECTs, counts only)

Rule source: admin `origin/claude/people-release-a-admin:supabase/migrations/20261129220000_people_a_db1_series_go_live_check_v1.sql:70-160`
(`_series_go_live_check_p5`) + `20261129210000_people_a_db1_profile_requirements_v1.sql:49-145` (placeholder rule, organiser 7 required
fields). Neither function is on prod (`pg_proc` has only `event_publish_readiness_v1` and `_owner_series_go_live_ready_p5`). The six A-DB1
rules were re-expressed as plain SELECTs with the placeholder rule inlined; the three D55 codes (name/country/organiser) came from prod's
own `event_publish_readiness_v1` (STABLE, read-only; prosrc checked), with the same de-dup the new function applies (country only when
city present; start folded into upcoming_date). Templates: 0 on prod.

Website tests checked at e8095008. "Covered" = a vitest/fixture that feeds this shape to the screen that renders it.

## 1. Series by lifecycle x event_missing code (non-template series, today = London date)

| lifecycle | n | venue | city | upcoming_date | session | cover | description | name | country | organiser | ticket_link (rec.) | 0 codes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| draft / pending_review / rejected | **0** | - | - | - | - | - | - | - | - | - | - | - |
| live | 67 | 0 | 0 | 18 | 3 | 0 | 0 | 0 | 0 | 0 | 16 | 47 |
| paused | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| ended | 21 | 0 | 0 | 21 | 2 | 0 | 2 | 0 | 0 | 0 | 9 | 0 |
| archived | 652 | 606 | 601 | 643 | 612 | 612 | 611 | 0 | 0 | 571 | 619 | 4 (614 have >=3 codes) |

Extra series shapes: 3 series whose only future dates are cancelled (counts as `upcoming_date`); 4 non-archived series that HAVE programme
items but none with title+start+end (so `session` fires though a programme exists); 0 non-archived series with cover only via `poster_url`;
5 live series with 2 organisers (62 with 1, 0 with none); "start" never fired outside `upcoming_date`.

Seated subset (series with >=1 owner/manager seat on one of its organisers): live 11 (5 no upcoming date, 3 items-but-no-complete-session,
3 no ticket link, 1 multi-organiser), ended 6, archived 8. Unseated live series: 56.

## 2. Organiser pages

| shape | count |
|---|---|
| pages total / lifecycle live | 48 / 48 (no draft/paused/archived page exists); is_active NULL 43, true 5 |
| missing logo (avatar_url) | 3 |
| missing founded_year | **43** |
| missing category | 2 (5 distinct category values) |
| missing contact_phone | 7 |
| missing instagram (col + socials) | 4 |
| missing city | 0 |
| logo+founded+category+phone ALL missing | 2 |
| all 7 required present (blank test) | **4 of 48** |
| required field filled with a placeholder word/punct | 0 on every field |
| founded_year out of 1950-2026 | 0 |

## 3. Seats (entity_members)

| shape | count |
|---|---|
| seat rows by role | owner/organiser 9; **manager 0**; series-type seats 0 |
| pages with 0 / 1 / 2 / 3+ owner-or-manager seats | 40 / 7 / 1 / 0 |
| pages with 2 owners | 1 |
| seated users holding 1 page / 3 pages | 6 / **1** |
| that 3-page owner: pages incomplete / pages with non-archived events / their non-archived series | 2 / 3 / 14 |

## 4. Live events per organiser page

| live series | pages | | non-archived series | pages |
|---|---|---|---|---|
| 0 | 13 | | 0 | 9 |
| 1 | 20 | | 1 | 21 |
| 2-5 | 13 | | 2-5 | 15 |
| 6-10 | 2 (max 7) | | 6-10 | 2 |
| 11+ | 0 | | 11+ | 1 (max 12) |

## 5. Shape -> test coverage

| shape | prod count | covered? | file |
|---|---|---|---|
| each of the 9 event_missing codes (label + fix link) | venue/city/session/cover/description/organiser non-zero (archived/live); name/country 0 | yes, all nine + order + unknown code | `src/modules/organiser/events/__tests__/goLive.webA1a.test.tsx:168-228` |
| several codes at once, server order, tap goes to first | 614 archived series carry >=3 | yes | goLive.webA1a.test.tsx:210, :239 |
| `session` missing while programme items exist (items lack time/title) | 4 non-archived | yes (weekly event with dated-only session) | goLive.webA1a.test.tsx:230 |
| `ticket_link` recommended only | 16 live, 9 ended | yes | goLive.webA1a.test.tsx:249 |
| profile_missing with dancer + ONE organiser entry | n/a (rule not on prod) | yes | goLive.webA1a.test.tsx:260 |
| profile_missing with TWO organiser entries (owner seated on both organisers of a 2-organiser series) | 5 live 2-organiser series, 1 seated | **no** | - |
| profile row for an owner of SEVERAL pages whose selected page != the series' organiser | 1 owner x 3 pages, 2 incomplete, 14 series | **no** | - (see F1) |
| admin caller (profile_rule_applies false) | n/a | yes | goLive.webA1a.test.tsx:271 |
| Go live card for draft only; live/paused/ended/archived show none | draft 0, live 67, paused 1, ended 21 | yes (rows) | `src/modules/organiser/events/lifecycleModel.ts:99-105`, homeJobs.matrix:140,171,184 |
| rejected / pending_review series (server gates rejected->live) | 0 | **no** (UI shows no Go live for rejected) | - (F2) |
| live with 0 upcoming scheduled / all upcoming cancelled | 18 / 3 | yes | `src/modules/organiser/jobs/__tests__/homeJobs.matrix.test.ts:80,89` |
| live with no cover | 0 | yes | homeJobs.matrix.test.ts:109 |
| page with many series (>=11 non-archived; 40 archived) | 1 (12) | yes (45 series, 40 archived) | homeJobs.matrix.test.ts:133 |
| organiser page missing logo / phone (public page) | 3 / 7 | yes | `src/pages/__tests__/OrganiserProfileEmpty.matrix.test.tsx` |
| organiser page missing founded_year / category (public page) | 43 / 2 | partial: wizard steps only | `src/modules/organiser/wizard/__tests__/ProfileWizard.test.tsx` (founded_year x4, category x1); not in the public empty matrix |
| full-profile mark false/missing/error | ~44 of 48 pages would be false (only 4 have all 7) | yes (answer parsing) | `src/modules/admin-organisers/__tests__/invitePersonFixPass.test.tsx:139-155` |
| placeholder-filled required field | 0 on prod | yes (client check) | ProfileWizard.test.tsx:202 |
| manager seat | 0 on prod | yes | homeJobs.matrix / HomeR1 / Door tests |
| page with 2 owners | 1 | not specifically | - (no rendering depends on it found) |
| organiser page lifecycle other than live | 0 | yes | `tests/sitemapOrganiserLifecycle.test.ts`, `src/modules/profile/__tests__/organiserPublicVisibility.test.ts` |

Screenshots on the target (`docs/people-arc/screens/`): A-WEB1a (7: locked x3, not-ready, ready, refusal, unlocked), A-WEB1b (wizard / home
button / team, 360 and 390), A-WEB2 (invite/redeem/mark/report, 13 x2), RELEASE-A-WEB (golive-three-new-codes, invite-email-unproven).
None shows a multi-page owner, a two-organiser profile_missing, or the all-nine/three-plus-code list at 360 width.

## Findings

**F1 (should) - profile row goes to the wrong page for a multi-page owner.** `src/modules/organiser/events/lifecycleModel.ts:50-52` builds the
row's href as `withReturnTo(PROFILE_WIZARD_PATH, ...)` with no organiser id; the wizard (`src/modules/organiser/wizard/ProfileWizard.tsx:216,226`)
works on `useOrganiserChoice().selected`, not on `profile_missing[].organiser_id`. Real shape: 1 owner holds 3 pages, 2 of them incomplete,
with 14 non-archived series across all 3. Scenario: that owner opens a draft on page B while page A is selected; the server lists page B's
fields; "Complete your profile (N left)" opens the wizard for A (possibly already 100% -> "Full profile" screen), Go live stays blocked, loop.
Same for a 2-organiser series where the owner is seated on both (5 live 2-organiser series exist): the count sums both pages but the wizard
fixes one. No test feeds >1 organiser entry or a non-selected organiser. Fix: carry `organiser_id` of the first organiser entry in the href
(e.g. `?organiser=<id>`) and have the wizard select it; add a matrix row for both shapes.

**F2 (nit/should, no prod instance today) - rejected series get no Go live.** `lifecycleModel.ts:99-105` offers Go live only for `draft`;
the server rule (go-live SQL header lines 9-11) gates `draft | rejected -> live` for the owner. Prod has 0 rejected/pending_review series,
so nothing mis-renders today; a rejected event would show an empty card. Fix: either include `rejected` in the Go live rows or state the
decision in the handover; add a row to the matrix.

**F3 (info) - the go-live list cannot be exercised on prod data today.** 0 draft series exist; every live/ended/paused series is excluded
from Go live by the UI. The real-data walk of A-WEB1a therefore needs a fresh draft (E2E project); 43/48 pages miss `founded_year`, so
virtually every owner draft will show the profile row (only 4 pages pass all 7 required fields) - the "Complete your profile" path is the
dominant real shape, more than any event code.

**F4 (nit) - public empty matrix omits founded_year/category nulls** (43 and 2 pages). Rendering is pre-existing code (`src/pages/OrganiserProfile.tsx:1045,1091`
null-guarded), so low risk; add both to `OrganiserProfileEmpty.matrix.test.tsx` for completeness.


---

# D. Red-first proofs, own mutations, CI table (review brief steps 6 and 7)

Target `e809500` (claude/people-release-a-web head), base `origin/main` 03f37b4 (= the merge-base). Proofs ran in a
detached worktree (`git worktree add ... origin/main`, node_modules symlinked); every mutation was made in that
worktree at e809500, restored with `git checkout -- src`, `git status` empty after each. Both worktrees are removed.
The main checkout is clean (`git status`: only the untracked `docs/people-arc/reviews/` another agent created).

## Findings from this slice (most severe first)

1. **should** `src/modules/organiser/shared/profileProgress.ts:27-36` (PINNED file, so the fix is a test). The
   `my_profile_progress_v1` parser's refusals are not held by any test. Mutant M1 (step-row check `area/field/required/done`
   turned into a no-op) and mutant M1b (top-level `percent/required_left/publish_ready/steps/declined` check removed)
   both stay green: wizard + goLive + home suites **10 files, 171/171 passed** under each. The only bad-shape row
   (`goLive.webA1a.test.tsx:373`, `{percent:'x'}`) still throws through `steps.map` on `undefined`, so it cannot tell the
   two apart. Scenario: a server change sends `publish_ready: "false"` (string) -> with the check gone, `profileLock`
   (`profileProgress.ts:62`) reads it truthy and unlocks every edit; the wizard reads a step with `required: "yes"`. Fix:
   a table test of `parseProfileProgress` (each key missing / wrong type, step with unknown area, non-boolean
   required/done, `declined` with junk) expecting `progress_bad_shape`, plus one render row with `publish_ready:"false"`
   asserting the lock still holds via the error path (no lock, normal state).
2. **should** `src/modules/organiser/shared/goLiveCheck.ts:90` `parseGoLiveCheck`. Mutant M3 (drop
   `typeof ready !== 'boolean'`) stays green: `src/modules/organiser/events` + `__tests__` **30 files, 1309 passed | 2
   skipped**. The "check bad shape" row (`goLive.webA1a.test.tsx:385`, `{ready:'yes'}`) throws anyway on the missing
   arrays. Scenario: `ready: "false"` -> `goLiveState` treats it as ready and Go live sends instead of jumping to the
   first missing item (the server still refuses, so the user sees the refusal list rather than being taken to the fix).
   Fix: table test of `parseGoLiveCheck` per key (ready non-boolean with valid arrays, item without section,
   profile_missing with bad area / non-string fields).
3. **should** `src/modules/organiser/team/publicTeamApi.ts:30-33` `parseSetPublic`. Mutant M10 (the
   `set_public_bad_shape` throw replaced by `return 'unchanged'`) stays green: `team` + `wizard` suites **6 files, 102/102
   passed**. Scenario: the RPC answers `{ok:true}` or a renamed key -> the toggle silently treats it as "unchanged" and
   shows the old state as saved, instead of the error state. Fix: test row(s) with `{}`, `{status:'shown'}`, `null`
   expecting the visible error.
4. **nit** `src/modules/admin-organisers/invitePersonModel.ts:17` `parsePersonInvite`: mutant M14 (drop
   `typeof r.link_path !== 'string'`) stays green (admin-organisers **12 files, 192/192**); with it, a missing
   `link_path` throws on `.startsWith` instead of returning null. The caller (`invitePersonApi.ts:85`) runs inside the
   mutation, so it most likely lands in the error state anyway. Fix: add `{...ANSWER, link_path: undefined}` to the
   `refuses %j` row at `invitePerson.test.tsx:119`.
5. **nit** `src/lib/claimMyOrganisers.ts:27`: mutant M13 (drop the `name` string/trim check) stays green (AuthCallback
   suites **6 files, 111/111**). The "rows without a name are dropped" row passes only because `r.name.trim()` then
   throws and the never-throw wrapper returns `[]`. A mixed answer (one good row + one nameless) would lose the good
   page's notice. Fix: add a mixed-rows case expecting "You now manage Ritmo."
6. **nit (handover accuracy)**: claimed counts differ slightly from what I measured (below); the direction (red on the
   unfixed code, green on target) holds in every case.
7. **nit (environment, not this branch)**: running `npm run test:unit` locally rewrites 11 tracked `.snap` files to LF
   (status-dirty, empty diff), and `test:e2e` + the phone suite rewrite **340 tracked PNGs** under `docs/handover/**`
   and `docs/review-packs/**`. Restored. Anyone running the gates locally will get a dirty tree.

No blocking finding in this slice. CI: every runnable PR-applicable step is green on the target, except two reds
(`npm run lint` exit 1 and `npm run test:unit` exit 1), both sandbox or live-DB causes that are red on clean main too
(details below).

## Step 6a: red-first proofs claimed by the handovers

| handover | claim | how I ran it | measured on unfixed code | on target |
|---|---|---|---|---|
| A-WEB2 (first pass) | `AuthCallbackOrganiserClaim.test.tsx` 5 failed on unfixed AuthCallback; `organiserPublicVisibility.test.ts` 2 failed | origin/main + the 35 new (A) files from e809500; modified sources left at main | **16 failed / 15 passed (31)**: AuthCallback 14 failed (the file has grown to the D37 rows since then, and they also need the notice that main never shows), organiserPublicVisibility **2 failed** (archived and rejected with is_active NULL) | pass (full unit run: neither file in the failing list) |
| A-WEB2 fix pass | on 24089ca: **22 failed / 34 passed (56)** + `invitePreview.test.tsx` fails to load | worktree at 24089ca + the five test files from 70966af | **23 failed / 34 passed (57)** + invitePreview load failure (`invitePreview.test.tsx` FAIL at import). Failures by finding as claimed: 7 D37 rows + Tell us 44 px, 4 fetchPageLeader, 2 Leader prefill, 4 message, 4 D36 masking, curly punctuation, sitemap lifecycle. One test more than claimed | pass |
| A-WEB1a | `goLive.webA1a.test.tsx` on main + only `goLiveCheck.ts`: **25 failed / 10 passed (35)** | origin/main + `goLiveCheck.ts` + the test at 78d9416 | **25 failed / 10 passed (35)**, exact (`Unable to find ... org-life-item-venue` etc.). The target's version of the file (47 tests, incl. the D55 table): **36 failed / 11 passed** on main | 47/47 pass |
| A-WEB1b | homeJobs: **3 failed / 57 passed** on the unfixed `homeJobs.ts` | origin/main + `homeJobs.matrix.test.ts` + `Door.test.tsx` from a4f430c | **3 failed / 45 passed (48)**: the same three named tests (0 series, paused+ended, Door "three first steps"). I could not reproduce the 57 total; with `HomeR1.test.tsx` added: 6 failed / 60 passed (HomeR1 needs the new ProfileButton) | pass |
| A-WEB1b | the "unchanged answer sends nothing" mutation turns red | covered by my own M4b below | red (5 failed) | n/a |
| RELEASE-A-WEB D56 | `redeemUnproven.test.tsx` on merged tree 14ba4f1: **4 failed / 2 passed** (`expected 'failed' to be 'refused'`) | worktree at 14ba4f1 + the test from e809500 | **4 failed / 2 passed (6)**, exact, same assertion text | pass |
| RELEASE-A-WEB D55 | red-first not possible: green on the merged tree | 14ba4f1 + target `goLive.webA1a.test.tsx` + `wizardCountries.pin.test.ts` | **48/48 passed** on 14ba4f1, so the claim that it was already green holds; non-vacuity is shown by mutations M2/M11 below | pass |
| RELEASE-A-WEB D72 | pin is red under mutation | my M7/M7b below | red | pass |

Server-shape cross-check for D56: admin `20261129240000_people_a_db2_invites_v1.sql:326` returns
`jsonb_build_object('ok', false, 'reason', 'email_unproven')` as data (not an exception), which matches
`redeemMismatch.ts` reading `data.reason` with `error` null.

## Step 6b: my own mutations (one per rule; each restored, `git status` clean after)

| # | rule | mutation (file) | tests run | result |
|---|---|---|---|---|
| M1 | progress parser refuses bad step rows | step-row throw -> no-op (`profileProgress.ts:35-36`) | organiser/wizard, goLive.webA1a, organiser/home | **GREEN 171/171: finding 1** |
| M1b | progress parser refuses bad top level | top-level throw -> no-op (`profileProgress.ts:27-28`) | same | **GREEN 171/171: finding 1** |
| M2 | go-live code -> words (D49) | `cover: 'A flyer'` -> `'A cover image'` (`goLiveCheck.ts:39`) | src/modules/organiser | caught: **4 failed** / 3448 passed |
| M3 | go-live parser refuses bad shape | drop `typeof ready !== 'boolean'` (`goLiveCheck.ts:90`) | organiser/events + organiser/__tests__ | **GREEN 1309 passed: finding 2** |
| M11 | every fix link carries returnTo (D37) | `withReturnTo(...)` removed (`goLiveCheck.ts:74`) | organiser/events | caught: **16 failed** |
| M4a | untouched save sends nothing (empty list = null) | `[]` no longer equal to null (`wizardModel.ts:70`) | organiser/wizard | caught: **1 failed** |
| M4b | untouched save sends nothing | `sameAnswer` -> `a === b` (`wizardModel.ts:73`) | organiser/wizard | caught: **5 failed** incl. "an untouched answer sends nothing and moves on" |
| M5a | AuthCallback: returnTo beats the claim landing (fallback path) | `claimLanding ?? safeReturnTo ?? pending` (`AuthCallback.tsx:81`) | src/pages/__tests__/AuthCallback* | caught: **3 failed** (incomplete profile x invite / stashed / event) |
| M5b | AuthCallback: a claim lands on /account/o | drop `claimLanding ??` (`AuthCallback.tsx:215`) | same | caught: **3 failed** |
| M6a | email_unproven gets the sign-in-again control | removed from `SIGN_IN_AGAIN_REASONS` (`redeemMismatch.ts:23`) | admin-organisers | caught: **2 failed** |
| M6b | email_unproven button words | label always "Sign out" (`InviteRedeemPage.tsx:212`) | admin-organisers | caught: **2 failed** |
| M6c | email_unproven keeps the link usable | `EMAIL_UNPROVEN_COPY.terminal: true` | admin-organisers | caught: **2 failed** |
| M7 | D72 copy equals the source (order) | sort by code (`wizardCountries.ts:23`) | wizardCountries.pin | caught: **1 failed** |
| M7b | D72 drift from the SOURCE side | add Kosovo to `src/constants/countries.ts` | wizardCountries.pin | caught: **1 failed** |
| M8 | C14 lock: an admin is never locked | drop `isAdmin ||` (`profileProgress.ts:62`) | organiser/events, wizard, home | caught: **1 failed** |
| M9 | archived AND rejected pages hidden (D38) | `"(archived,rejected)"` -> `"(archived)"` (`organiserPublicProfile.ts:59`) | profile, sitemap, pages | caught: **2 failed** |
| M10 | team public toggle parser refuses | throw -> `return 'unchanged'` (`publicTeamApi.ts:33`) | organiser/team, wizard | **GREEN 102/102: finding 3** |
| M12 | D50 "Not now" = 30 days | 30 -> 3 days (`wizardModel.ts:82`) | wizard, home | caught: **1 failed** |
| M13 | claim rows need a name | drop name check (`claimMyOrganisers.ts:27`) | AuthCallback* | **GREEN 111/111: finding 5 (nit)** |
| M14 | invite answer parser refuses | drop `typeof link_path` (`invitePersonModel.ts:17`) | admin-organisers | **GREEN 192/192: finding 4 (nit)** |

## Step 7: CI table (target e809500, this sandbox, Node + local Playwright chromium)

PR-applicable workflows were read in full: architecture-guard, typecheck, unit-tests, perf-budget, workflow-lint,
e2e-smoke, phone-qa (paths match: `src/**/*.tsx` changed), db-contract-check, ci-budget-guard, og-image-check,
seo-check, synthetic-ssr-monitor, types-drift, phone-qa-section, real-data-verified, pr-mergeable-guard,
bot-pr/bot-automerge/dependabot-automerge, stale-wip-report, live-qa, prod-smoke.

| job | step | command | exit |
|---|---|---|---|
| architecture-guard | PyYAML present | `python3 -c "import yaml"` | 0 |
| architecture-guard | integrity guard | `bash bin/check-integrity.sh` (CI does `chmod +x bin/*.sh` first; the file is 100644 in git on main and target) | 0 |
| architecture-guard | legacy tables / legacy program RPCs | `npm run check:legacy-tables` / `check:legacy-program-rpcs` | 0 / 0 |
| architecture-guard | runtime architecture | `npm run lint:architecture` | 0 |
| architecture-guard | image audit | `AUDIT_STRICT=1 npm run check:images` | 0 |
| architecture-guard | image widths (canary, guard) | `check:image-widths:self-test`, `check:image-widths` | 0, 0 |
| architecture-guard | plan hygiene canary | `check:plan-hygiene:self-test` | 0 |
| architecture-guard | artifact policy (canary, guard) | `check:workflow-artifact-policy:self-test`, `check:workflow-artifact-policy` | 0, 0 |
| architecture-guard | mojibake canary / guard | `check:mojibake:self-test` / the workflow's `git grep -nE ...` (no match) | 0 / 0 |
| architecture-guard | entry-point (canary, sweep) | `prove:entry-point:self-test`, `prove:entry-point` | 0, 0 |
| typecheck | RPC typing / WallClock brand | `check:rpc-typing` / `check:wallclock-brand` | 0 / 0 |
| (not a CI step; pre-ship ratchet) | full tsc | `npm run typecheck` | 2: **99 errors, clean origin/main also 99, identical per-file counts** (`diff` of per-file tallies empty). None new |
| unit-tests | live-DB gate canary | `node scripts/ci-live-db-gate.mjs --self-test` | 0 |
| unit-tests | live-DB gate decision | `node scripts/ci-live-db-gate.mjs` | NOT RUN: needs the PR event context |
| unit-tests | unit + contract suite | `npm run test:unit` | **1: 16 failed / 10333 passed / 28 skipped (446 files, 5 red)**. Red files: `eventViewCompat.contract` (5), `occurrenceProgram.contract` (2), `publicEventPageLineup.contract` (3): need a live DB (CI gates them on secrets); `integrityCouldNotRun` (5): sandbox TS-helper; `SurnameSwitchReachable` (1). **Same 5 files on clean origin/main: 18 failed / 79 passed / 14 skipped**: all red on main too. `SurnameSwitchReachable` re-run alone on target: still 1 failed (`Unable to find role="switch" ... "Hide my surname from the public"`), and red on main, so not this branch's. Every proof test file above passes |
| unit-tests | timing suite | `npm run test:unit:timing` | 0 |
| unit-tests (dancer isolation) | canary / check | `node scripts/check-dancer-area-isolation.mjs --self-test` / `npm run check:dancer-area-isolation` | 0 / 0 |
| perf-budget | canaries | `check:bundle-budget:self-test`, `check:first-load-requests:self-test`, `check:chunk-cycles:self-test` | 0, 0, 0 |
| perf-budget | PRODUCTION build | `npm run build` | 0 |
| perf-budget | budgets | `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0, 0, 0 |
| perf-budget | Lighthouse / doc weight | | SKIPPED by design on `claude/*` heads (workflow `if:`); preview-only |
| workflow-lint | BOM check | the workflow's loop (`od` in place of `xxd`, which is absent here) | 0 |
| workflow-lint | masking / notification (canary, lint) / no-preview (canary, check) | `lint-workflow-masking.mjs`; `lint-workflow-notification.mjs --self-test`, plain; `check-no-preview-prefixes.mjs --self-test`, plain | 0; 0, 0; 0, 0 |
| lint chain (local) | `npm run lint` | as is | **1: only `check:integrity` exit 126** (exec bit missing in this checkout; same mode on main, so red there by construction). With `chmod +x bin/*.sh` (modes restored after): **0, "20 of 20 links green"**; the eslint link is informational: whole tree 316 errors, red on main as the chain says |
| (pre-ship scoped eslint) | changed src files | `npx eslint <72 changed .ts/.tsx>` | 1: 4 errors, all in modified files and **all present on origin/main** (InviteRedeemPage refs-in-render, BentoPage + OrganiserProfile setState-in-effect, AuthCallback `any`); new files 0 errors |
| e2e-smoke | curated smoke | `npm run test:e2e` with the workflow env (fake key, `VITE_ENABLE_ORGANISER_SELF_SERVE=true`, `CI=1`) | **0: 156 passed, 2 flaky (passed on retry: `dancer-app/home-nights.spec.ts:75`, `dancer-home.spec.ts:168`), 1 skipped, 7.0 min**. `organiser-home.spec.ts:55`, which the RELEASE handover saw red on main, passed here |
| phone-qa | phone suite 390x844 + 360x640 | `npx playwright test --config playwright.phone.config.ts` (`CI=1`) | **0: 272 passed, 74 skipped, 13.5 min** |
| phone-qa | build smoke | `npm run build` with the workflow's fake-Supabase env + `NODE_OPTIONS=--import ./tests/e2e-phone/fakeSupabasePreload.mjs`, then `npx playwright test --config playwright.build.config.ts` | build 0; smoke **0: 66 passed** |
| db-contract-check | live-DB gate canary | `node scripts/ci-live-db-gate.mjs --self-test` | 0 |
| db-contract-check | migration authority | `node scripts/check-migration-stamps.mjs` | 0 |
| db-contract-check | guest-list canary | `node scripts/check-guest-list-contract.mjs --self-test` | 0 |
| db-contract-check | secrets precheck + every live contract check | | NOT RUN: need the Supabase service secrets (absent); not run against prod by rule |
| ci-budget-guard | canary | `node scripts/check-ci-budget.mjs --self-test` | 0 |
| ci-budget-guard | measure the account | `node scripts/check-ci-budget.mjs` | NOT RUN: needs a GitHub token and the Actions API (`gh api` forbidden to this review) |
| phone-qa-section / real-data-verified | canaries | `node scripts/check-pr-phone-qa.mjs --self-test` | 0 |
| phone-qa-section / real-data-verified | PR body checks | `check-pr-phone-qa.mjs`, `check-pr-real-data-verified.mjs` | NOT RUN: there is no PR (D73: the orchestrator opens it); they read the PR body |
| pr-mergeable-guard | canary | `npm run check:pr-mergeable:self-test` | 0 (the job itself is push/hourly, not pull_request) |
| og-image-check / seo-check | canaries | `check:og:self-test`, `check:seo:self-test` | 0, 0 |
| og-image-check / seo-check / synthetic-ssr-monitor | preview guards | | SKIPPED by design on `claude/*` heads (no Vercel preview) |
| types-drift | regenerate types from the live schema | `npm run gen:types` | NOT RUN: needs a Supabase access token. Path-filtered; the branch touches no `types.ts` |
| live-qa, prod-smoke | | | NOT RUN: they read live production (schedule/deploy jobs) |
| bot-pr, bot-automerge, dependabot-automerge, stale-wip-report | | | not applicable (bot/owner automation, no build step) |

Reds on the target: `npm run test:unit` (exit 1) and `npm run lint` (exit 1). Both are red on clean origin/main for the
same reasons (live-DB contract suites + sandbox helper + `SurnameSwitchReachable`; the integrity script's exec bit),
so neither comes from this branch.

## Verified
- Every handover red-first proof re-run. All of them go red on the unfixed code and green on the target. Counts match
  exactly for A-WEB1a (25/10) and D56 (4/2). The A-WEB2 fix pass (23/34 vs 22/34) and A-WEB1b (3 failed of 48 vs 57)
  differ slightly in totals, with the same failing tests.
- 20 own mutations: 15 caught, 5 green (findings 1-5).
- Production build, bundle/first-load/chunk-cycle budgets, full phone suite (390 + 360), build smoke, curated e2e, and
  the whole architecture-guard / typecheck / workflow-lint battery: green on the target.

## Not verified
- Live-DB contract checks, types-drift, ci-budget measurement, PR-body checks, preview-only jobs (Lighthouse, doc weight,
  og/seo/synthetic preview): secrets / PR / preview absent.
- GitHub Actions itself (local runs only; `CI=1` set for the Playwright runs). `build/` was last written by the
  fake-Supabase build-smoke build; it is gitignored and not shipped.
