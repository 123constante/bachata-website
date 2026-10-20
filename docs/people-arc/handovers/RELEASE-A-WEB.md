# RELEASE-A-WEB handover (integration + D55/D56/D72)

Branch `claude/people-release-a-web`, from `origin/main` 03f37b45. One push, no PR (D73: the orchestrator opens it;
#846, #863, #865 close as superseded).

## Done

### 1. Integration (recipe from the brief, heads did NOT move)
| slice | branch | head merged |
|---|---|---|
| A-WEB2 | `claude/people-a-web2-invites` | 70966afc |
| A-WEB1a | `claude/people-a-web1a-golive` | 78d94164 |
| A-WEB1b | `claude/people-a-web1b-wizard` | a4f430c4 |

web2 and 1a merged clean. 1b had the ONE expected conflict, `src/modules/organiser/shell/__tests__/noHandBuiltLinks.test.ts`
(both sides add `KNOWN['shared/profileProgress.ts']`): kept A-WEB1a's side (`git checkout --ours`), one entry.

### 2a. `email_unproven` on the invite landing (D56)
- Redeem caller: `InviteRedeemPage.tsx` -> `interpretRedeemWithMismatch` (`redeemMismatch.ts`), A-WEB2's wrapper over
  R1's `interpretRedeem`/`REDEEM_COPY`. The new reason goes in that wrapper, NOT in R1's `inviteModel.ts` (the file's own
  header says inviteModel belongs to organiser R1; same reason A-WEB2 put `email_mismatch` there). One place reads it.
- `redeemMismatch.ts`: `EMAIL_UNPROVEN_REASON`, `EMAIL_UNPROVEN_COPY` {title "Use the email link", body "Sign in with the
  email link to accept this invite." (D56 words), not terminal: the link stays usable}, `SIGN_IN_AGAIN_REASONS`
  (mismatch + unproven). Checked before the mismatch branch; no hint is ever read for it.
- `InviteRedeemPage.tsx`: the sign-out control now shows for both reasons (state holds the reason, not a boolean); for
  `email_unproven` it reads "Sign in with the email link" (it signs out, then opens THIS invite's sign-in, link unused);
  for `email_mismatch` it still reads "Sign out". The body names no control.
- `src/lib/claimMyDancerProfile.ts` uses the same word `email_unproven` (dancer self-claim status). It shows NO copy
  (silent by design), so there is no second copy map to share or drift.
- Test `src/modules/admin-organisers/__tests__/redeemUnproven.test.tsx` (table: unproven, unproven + stray hint,
  mismatch without hint; interpreter + landing render + button -> `/auth?mode=signin&returnTo=/invite/<token>`, sign-out
  once, redeem called once). **Red first** on the merged tree: `Tests 4 failed | 2 passed` (`expected 'failed' to be
  'refused'`: the person saw "Something went wrong"). Green after.

### 2b. Go live labels, all nine codes (D55)
- A-WEB1a ALREADY carried the three new labels (`name` "An event name", `country` "A city with a country on file",
  `organiser` "An active organiser") and the `basics`/`organisers` sections in `goLiveFixHref`; words checked identical
  to admin `lib/goLiveCheck.ts` on `claude/people-release-a-admin`. So no product change was needed here.
- New table in `src/modules/organiser/events/__tests__/goLive.webA1a.test.tsx` ("D55: ..."): the nine codes in server
  order; each renders its label, links to its screen with `returnTo` this event, and a TAP on it lands on a screen that
  shows the named control (`org-detail-name`, `org-detail-venue`, the about editor input, programme/dates/cover/
  organisers screens); all nine at once keep server order; an unknown code+section shows "Something else on the event",
  no link, never the raw code.
- **Red first: NOT possible on the merged tree** (green on first run; A-WEB1a had done it). Non-vacuity shown by mutation
  instead: deleting the `name` label, deleting the `organisers` section link and making unknown codes show the code ->
  `Tests 3 failed | 9 passed` (name, organiser, unknown rows). Restored, green.

### 3. D72 country copy pin
`src/modules/organiser/wizard/__tests__/wizardCountries.pin.test.ts`: `wizardCountries()` equals `loadCountries()` (codes and
names, same order, > 190 entries). Mutations: dropping the `unMember` filter (250 vs 195) and renaming Palestine both
red. Note: removing the Vatican override line does NOT red it: world-countries already marks VA as a UN member entry,
so both copies' VA override is currently a no-op (harmless; not changed).

### 4. A branch-only red, fixed
`check:images` (AUDIT_STRICT=1) failed on A-WEB1b's `src/modules/organiser/wizard/stepKinds.tsx:271` (img without
`loading`). The file does not exist on main, so red only here: added `loading="eager"` (the just-uploaded photo preview,
above the fold). Re-run: 0 missing.

## CI table (sandbox, merged tree)
| job | step | command | exit |
|---|---|---|---|
| architecture-guard | integrity | `bin/check-integrity.sh` (via bash) | 0 |
| architecture-guard | legacy-tables / legacy-program-rpcs | `npm run check:legacy-tables` / `check:legacy-program-rpcs` | 0 / 0 |
| architecture-guard | runtime architecture | `npm run lint:architecture` | 0 |
| architecture-guard | image audit | `AUDIT_STRICT=1 npm run check:images` | 1 -> fixed (above) -> 0 |
| architecture-guard | image widths, plan hygiene canary, artifact policy, mojibake canary + guard, entry-point | as in the workflow | all 0 |
| typecheck | rpc typing / wallclock brand | `npm run check:rpc-typing` / `check:wallclock-brand` | 0 / 0 |
| (pre-ship ratchet) | tsc | `npm run typecheck` | 2: 99 errors; clean origin/main also 99 (same files, line shifts only): ratchet holds |
| workflow-lint | masking, notification (+canary), no-preview (+canary) | as in the workflow | all 0 |
| lint chain | `npm run lint` | | 1: only `check:integrity` exit 126 (known sandbox missing exec bit); after `chmod +x bin/*.sh .githooks/*`, `npm run check:integrity` = 0 (modes restored, not committed). Every other link PASS |
| unit-tests | offline | `npm run test:unit:offline` | 1: 7 failed; same files red on clean main (`integrityCouldNotRun` x5 sandbox TS-helper, `SurnameSwitchReachable` x2) + `auth.today` snapshot that is red on main and passes alone here |
| unit-tests | unit | `npm run test:unit` | 1: 17 failed: the above + live-DB `*.contract` suites (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup`: 10 red on clean main too, CI gates them on secrets) + `dancerPage.today` (passes alone: 50/50) |
| unit-tests | timing | `npm run test:unit:timing` | 0 |
| perf-budget | canaries | bundle-budget / first-load-requests / chunk-cycles self-tests | 0 |
| perf-budget | PRODUCTION build | `npm run build` | 0 |
| perf-budget | bundle budget / first-load pin / chunk cycles | `npm run check:bundle-budget` / `check:first-load-requests` / `check:chunk-cycles` | 0 / 0 / 0 |
| db-contract | migration authority | `node scripts/check-migration-stamps.mjs` | 0 |
| e2e-smoke | curated smoke | `npm run test:e2e` | 1: 155 passed, 3 failed, 1 skipped (see E2E below) |
| phone-qa | full phone suite, build smoke | `playwright.phone.config.ts`, `playwright.build.config.ts` | NOT RUN in full (time; only the temporary screenshot spec ran: 2 passed) |
| db-contract live steps, types-drift, og/seo, real-data/phone-qa-section (PR body) | | | NOT RUN: need secrets / a deploy / a PR |

E2E (`npm run test:e2e`, 10.1 min): 3 failed in the full run. Re-run alone on this branch: `dancer-app/home-nights.spec.ts:75` and
`organiser-layout.spec.ts:171` PASS (load under the full run); `organiser-home.spec.ts:55` ("a load failure shows the error
state and Retry recovers") still fails, and fails identically on clean `origin/main` 03f37b45: not this branch's.

## Screens (`docs/people-arc/screens/RELEASE-A-WEB/`, 390x844, phone harness with a fake Supabase, temporary spec not committed)
- `golive-three-new-codes.png`: draft event, Go live list "An event name", "A city with a country on file", "An active
  organiser" (each 336x52 px row with a chevron link) + "A ticket link / Recommended".
- `invite-email-unproven.png`: "Use the email link" / "Sign in with the email link to accept this invite." Button
  "Sign in with the email link" 353x44 px; `elementFromPoint` at its centre hits it.
- frontend-design skill: not loaded (no new screens or primitives; one copy row and one button label inside existing
  ones).

## Verified
- Merge recipe, one conflict resolved as specified; all three heads as the brief expected.
- D56 red -> green; D55 nine-code table + mutation proof; D72 pin + mutation proof.
- Production build + bundle budget + first-load pin + chunk cycles green; tsc count equal to main.

## Not verified
- No real-data walk: `email_unproven` and the D55 codes are on the E2E path only, not prod (admin #877); everything is
  against fakes at the boundary.
- 360x640 screenshots, full phone suite, Vercel preview (no push before this one).
- Supabase not queried (no shape survey needed for copy/label mapping; nothing written).

## Next steps
Independent review, then ONE fix pass. Orchestrator opens the single Website PR from this branch (fill the PR's
"Verified on real data" and Phone QA sections).

---

# Fix pass (FIX-RELEASE-A-WEB, ticket dt_584da6df2cf4)

Base: e8095008 (review `docs/people-arc/reviews/RELEASE-A-WEB.md` on `claude/review-people-release-a-web`). Every finding of
the review table fixed on this branch; no new PR (PR #870 stays the one Website PR). Red-first, green and mutation output
for every finding: "Detail" below (per group). The pin on `src/modules/organiser/shared/profileProgress.ts` MOVED: D48's
"byte-identical in two slices" ended with the release merge; the file exists once, here, and this pass edited it (one shared
`requiredLeftText`, header comment says so).

## Finding -> fix -> test

| # | Fix | Test (red first unless noted) |
|---|-----|------|
| 1 blocking | `PersonInvite.inviteId`/`token` are `string \| null`, null accepted only when `link_path` is not an `/invite/` path; no-page success note on the Invite card | `admin-organisers/__tests__/groupAFixPass.test.tsx` (no-page row, `/invite/` path with nulls refused) |
| 2 blocking (D76) | Step stays required. Matrix rows "seat holder (owner / manager), not otherwise eligible" save `whatsapp` and are accepted (server rule from admin #877). If the save still answers `whatsapp_not_allowed`: new copy + "WhatsApp us" / "Email us" rows (`supportLinks()`, D7); with neither Vercel value set, a sentence pointing at Finish later (no dead link) | `wizard/__tests__/whatsappSeat.matrix.test.tsx` (refusal rows red first; seat rows green on old code because the client never gated WhatsApp, proven by mutation) |
| 3 | Go live "Complete your profile" link carries `?o=<first organiser with fields left>` (the existing page-choice param, which already ignores pages the person holds no seat on) | `events/__tests__/goLive.profilePage.test.tsx` (multi-page owner, 2-organiser series, non-member id) |
| 4 | ONE `requiredLeftText(n)` ("1 answer left" / "N answers left") in `profileProgress.ts`, read by Home, My page, the lock reason, the Go live row and the wizard (new count under the bar). The Go live row's number is still the go-live check's (per series, may be another page); the wording is shared | `shared/__tests__/requiredLeft.oneFormatter.test.tsx` |
| 5 | Copyable invite message = the server `message` as is when present; built locally only when null | groupAFixPass (real multi-line server text from admin `20261129240000`) |
| 6 | Wizard organiser labels read `FIELD_LABEL` (`fieldRules.ts`). `FIELD_LABEL` itself unchanged (it also feeds a 76 px row label), so the wizard's labels are now "Name", "City", "Instagram" | `wizard/__tests__/stepCopy.fixpass.test.tsx` |
| 7 | Claim notice: kept in sessionStorage; organiser Home draws it in flow (not over the rows) with a visible 44 px Close; no Infinity toast. A return path elsewhere gets an 8 s toast. `toast.tsx` untouched | `organiser/home/__tests__/ClaimNotice.test.tsx`, `pages/__tests__/AuthCallbackClaimFixPass.test.tsx`; measured: Close 54.5x44, a tap on the first job row hits the row |
| 8 | Bad-shape rows for `parseProfileProgress` (incl. `publish_ready:"false"` -> no lock), `parseGoLiveCheck` (incl. `ready:"false"` with valid arrays), `parseSetPublic` (`{}`, `{status:'shown'}`, null). Code unchanged: no row found a real bug | `shared/__tests__/shapeChecks.fixpass.test.tsx`, `shared/__tests__/goLiveCheck.parse.test.ts` (red = under the mutation that drops each check) |
| 9 | No-hits copy: "Check the spelling, or search for another name they use." (no missing control named) | groupAFixPass |
| 10 | Disabled Add shows its reason ("Type one first, then tap Add." / list full), via aria-describedby | stepCopy.fixpass |
| 11 | Phone help links "My page" (44 px) | stepCopy.fixpass |
| 12 | Rejected series: Go live offered (server decides), See it live off, no Discard | goLive.profilePage (seven-status table) |
| 13 | `email_unproven` / `email_mismatch` copy folded into `REDEEM_COPY`; `redeemMismatch.ts` holds no copy | existing redeem suites green + groupAFixPass |
| 14 | One `PROFILE_REQUIRED_NOTE` in `selfServeErrors.ts`, imported by `PublicToggle` | `team/__tests__/profileRequired.oneCopy.test.ts` |
| 15 | AuthCallback runs the deleted-account restore check before `claimMyOrganisers()` | AuthCallbackClaimFixPass |
| 16 | No code (ship order). See merge notes | - |
| 17 | Rows: `parsePersonInvite` with no `link_path`; claim answer with one good + one nameless row keeps "You now manage Ritmo." | groupAFixPass, AuthCallbackClaimFixPass (red under the reviewer's mutants M13/M14) |
| 18 | A-WEB1b handover: 3 failed / 45 passed (48); A-WEB2: 23 failed / 34 passed (57). Both marked corrected | - |
| Orchestrator "1 more" | Root cause: the Coming dates card took its ROWS from Home's `next_dates` but its COUNT from the workspace read; a draft with Home `next_dates: []` and a coming date in the workspace showed 0 rows + "1 more" + "No coming dates". New `comingCard()` (`eventModel.ts`) builds rows and count from the same dates (workspace rows when Home lists none); a count shows only under at least one row | `events/__tests__/datesCard.consistency.test.tsx` (incl. 0 coming + 1 past, 0 coming + 1 cancelled); red: `"more":"1 more","none":true,"rows":0` |

## Merge with main (done in this pass)
`origin/main` moved to 995c841 (#867 docs-only CI, #869 A1 gates ON) and the branch conflicted (the conflicting-PR trap:
PR checks would never queue). Merged main in: five `docs/handover/dancer-rebuild-*` PNGs that this branch had only as
test-run rewrites (A-WEB1b commit) take main's bytes; `pseries.parity.test.tsx` resolved for A1 ON + the server-checked Go
live (a draft whose check did not load sends, the refusal lists what is missing); main's new `lifecycleGate.test.ts`
re-pointed from the removed `goLiveReason` to `goLiveState`; `fpar.review.test.tsx` section 12 holds its OFF row with the
rollback switch off. `src/modules/organiser` 130 files, 3585 passed after the merge.

## Merge notes for the orchestrator
- **Review #16, ship order:** the Website merges ONLY after the admin migrations are applied on prod, including admin #877
  (migration 20261129370000, D76 seat -> WhatsApp-eligible). Before it, a seat-only person still meets `whatsapp_not_allowed`
  (now with contact rows, not a dead end) and Home shows no logo prompt while `my_profile_progress_v1` is absent.
- D7 support values (`VITE_SUPPORT_WHATSAPP`, `VITE_SUPPORT_EMAIL`): whether they are set on Vercel is NOT verified (the
  sandbox cannot reach api.vercel.com: proxy 403). Without them the WhatsApp refusal shows the Finish-later sentence only.
- `scripts/lint-runtime-architecture.mjs`: three new test files added to the `no-legacy-organiser-fields` allowlist (specs
  that feed a server answer carrying `organiser_id`, same as `goLive.webA1a.test.tsx`).

## Screens (`docs/people-arc/screens/RELEASE-A-WEB/`, 390x844 and 360x640, phone harness + fake Supabase, temporary spec not committed)
26 PNG, 13 states x 2 widths; stale `golive-three-new-codes.png` and `invite-email-unproven.png` replaced:
`golive-draft-dates`, `golive-draft-missing` (also the "Complete your profile (2 answers left)" row), `golive-draft-pastonly`,
`golive-rejected`, `home-claim-notice` (also the Home button "2 answers left"), `mypage-required`, `wizard-phone-step`,
`wizard-list-step`, `wizard-whatsapp-refused` (links version: fake support values set), `admin-invite-nopage`,
`admin-invite-nohits`, `admin-invite-page`, `invite-email-unproven`, each `-390` / `-360`. Measured on every shot: the new
control's centre hits it, no horizontal scroll, smallest new target 44 px tall. Over-150 KB shots reduced to PNG8.
Observed, not fixed (pre-existing row layout): at 360 the Coming dates rows cut the time ("Tuesday 20 October, ...") beside
"Sessions".

## CI table (this sandbox, branch tree after the main merge; Node 22, local Playwright chromium)

| job | step | command | exit |
|---|---|---|---|
| architecture-guard | integrity | `bash bin/check-integrity.sh` | 0 |
| architecture-guard | legacy-tables / legacy-program-rpcs | `npm run check:legacy-tables` / `check:legacy-program-rpcs` | 0 / 0 |
| architecture-guard | runtime architecture | `npm run lint:architecture` | 0 (after the allowlist lines above; 9 violations before) |
| architecture-guard | image audit | `AUDIT_STRICT=1 npm run check:images` (after the new PNGs) | 0 |
| architecture-guard | plan hygiene / mojibake canaries | `npm run check:plan-hygiene:self-test` / `check:mojibake:self-test` | 0 / 0 |
| typecheck | rpc typing / wallclock brand | `npm run check:rpc-typing` / `check:wallclock-brand` | 0 / 0 |
| (pre-ship ratchet) | tsc | `npm run typecheck` | 2: 99 errors, same count as e8095008 and main (ratchet holds; none in changed files) |
| workflow-lint | masking, notification (+self-test), no-preview (+self-test) | `node scripts/lint-workflow-*.mjs`, `check-no-preview-prefixes.mjs` | all 0 |
| unit-tests | dancer-area isolation (+self-test) | `npm run check:dancer-area-isolation` | 0 ("not a dancer-area PR"; first run 1 against a stale local origin/main ref, 0 after `git fetch origin main`) |
| unit-tests | offline | `npm run test:unit:offline` | 1: 6 failed / 10465 passed: `integrityCouldNotRun` x5 (sandbox TS helper, red on main too, as in the review) + `dancer-app/public-page/route.test.ts` photoless (passes alone: 27/27; load flake) |
| unit-tests | unit | `npm run test:unit` | 1: 15 failed / 10503 passed: the 5 above + live-DB `*.contract` suites (`eventViewCompat` 5, `occurrenceProgram` 2, `publicEventPageLineup` 3: no secrets here, red on main too, CI gates them on secrets) |
| unit-tests | timing | `npm run test:unit:timing` | 0 |
| perf-budget | canaries | `check:bundle-budget:self-test` / `check:first-load-requests:self-test` / `check:chunk-cycles:self-test` | 0 / 0 / 0 |
| perf-budget | PRODUCTION build | `npm run build` | 0 |
| perf-budget | bundle budget / first-load pin / chunk cycles | `npm run check:bundle-budget` / `check:first-load-requests` / `check:chunk-cycles` | 0 / 0 / 0 |
| db-contract | migration authority | `node scripts/check-migration-stamps.mjs` | 0 |
| e2e-smoke | curated smoke | `npm run test:e2e` | 0: 158 passed, 1 skipped (6.4 min) |
| lint chain | `npm run lint` | | 1: only `check:integrity` exit 126 (sandbox: `bin/check-integrity.sh` has no exec bit in this checkout; the same script via bash = 0). Every other link PASS |
| doc weight | `npm run check:doc-weight` | | not runnable: needs `GITHUB_REPOSITORY` + a preview URL |
| phone-qa full suite, build smoke, db-contract live steps, types-drift, og/seo, PR-body sections | | | NOT RUN: time / secrets / a deploy / the PR body (orchestrator's) |

Local test runs rewrite 11 `.snap` files to LF and some `docs/handover/**` PNGs (review environment note); restored before
committing. `.githooks/pre-commit` has no exec bit in this checkout, so the commit hook did not run here (no `--no-verify` used).

## Verified
- Every review finding 1-15, 17, 18 and the "1 more" bug: test red on e8095008 (or red under the mutation for the test-gap
  findings 8/17 and the seat rows of 2), green after; one mutation per fixed rule, each restored (Detail below).
- Main merged in; organiser suites green after it; production build, bundle budget, first-load pin, chunk cycles green;
  curated e2e smoke green; tsc count unchanged.
- 26 screenshots at 390x844 and 360x640 with measured targets (44 px minimum, centre hit, no horizontal scroll).

## Not verified
- No real-data walk: these screens are against fakes at the network boundary. The D76 seat rule (admin #877) and
  `whatsapp_not_allowed` on prod are not checked; the rejected -> live path cannot be met on prod (0 rejected series, review).
- Prod shape counts: taken from the review (read-only, same day); not re-queried in this pass.
- Vercel: preview not checked and whether `VITE_SUPPORT_WHATSAPP` / `VITE_SUPPORT_EMAIL` are set is unknown (needs owner:
  the sandbox cannot reach api.vercel.com). The WhatsApp-refusal screenshot used fake values (links version).
- Full phone suite and build smoke suites not run; CI on the pushed head not observed by this worker.

## Next steps
Orchestrator: read the diff, CI on the pushed head of PR #870, owner review pack from `screens/RELEASE-A-WEB/`, merge only
after admin #877 is applied (ship order above).

## Detail (per group, as reported with the red / green / mutation output)

### groupA
#### Group A fix pass (RELEASE-A-WEB review findings 1, 5, 7, 9, 13, 15, 17)

Branch `claude/people-release-a-web`, nothing committed. Line endings preserved (CRLF sources; new files CRLF).

#### Red first (unfixed code)
- `npx vitest run src/modules/admin-organisers/__tests__/groupAFixPass.test.tsx` -> `Tests 10 failed | 17 passed (27)` (red rows: no-page parser x2, no-page result card, server-message x3, no-hits copy, redeem one-map x3). Full log: scratchpad/redA.txt
- `npx vitest run src/pages/__tests__/AuthCallbackClaimFixPass.test.tsx` -> `Tests 6 failed | 3 passed (9)` (finding 7 x4, finding 15 x2; the 3 finding-17 rows were green, as the review predicted: only mutation shows them). Log: scratchpad/redAuth.txt
- `npx vitest run src/modules/organiser/home/__tests__/ClaimNotice.test.tsx` -> `Failed to resolve import "../ClaimNotice"` (no tests ran). Log: scratchpad/redNotice.txt

#### Green
`npx vitest run src/modules/admin-organisers src/pages/__tests__/AuthCallback src/modules/organiser/home src/lib` -> **Test Files 74 passed (74), Tests 1620 passed | 1 skipped**. Log: scratchpad/greenAll.txt.
`npm run typecheck | grep -c 'error TS'` -> **99** (baseline), none in group A files.
eslint on changed files: 1 error = pre-existing `any` in AuthCallback.tsx:120 (review noted it on main); exhaustive-deps warning now also names `land` (warning only, same pattern as before).

#### Per finding
### #1 BLOCKING no-page invite
- Files: `invitePersonModel.ts`, `InvitePerson.tsx`.
- Fix: `PersonInvite.inviteId/token` are `string | null`; both JSON null accepted only when `link_path` is not an `/invite/` path (else refused); `isNoPageInvite()`; result card shows "Their profile now has this email. Send them the message: when they sign in with that email, the profile is theirs." (`invite-person-no-page`) instead of the one-time-link warning.
- Tests: `groupAFixPass.test.tsx` > "parsePersonInvite: every answer shape" (17 rows incl. "no page -> {invite_id:null, token:null, link_path:'/account'}", null id/token on an /invite/ path, half-null, keys missing) and "Invite person with no page" > "no page -> the result card ...".
- Red: 3 failed (2 parser rows + result card showed the error state). Green: pass.
- Mutation M1 (no-page branch -> `if (false)`): 3 failed. M1b (drop the `/invite/` guard): 1 failed ("invite path with both null").

### #5 server message as is
- File: `invitePersonModel.ts` (`buildInviteMessage` returns `serverMessage` when present; local build only when null; local no-page line no longer says "It works once").
- Fixtures: real multi-line server texts (page + no page) copied from admin `20261129240000_people_a_db2_invites_v1.sql` @ FETCH_HEAD of `claude/people-release-a-admin`.
- Tests: `groupAFixPass.test.tsx` > "invite message uses the server text as is" (4 rows: exactly the server text, one greeting, one /invite/ link, no "Coming up"/raw date; no-page; null -> built; on-screen textarea).
- Existing test updated (behaviour intentionally changed): `invitePersonFixPass.test.tsx` "the sent message carries the server text and greets a nameless person plainly" -> "with no server message, the sent message greets a nameless person plainly" (it expected "Hi!" in front of the server text, i.e. the double greeting).
- Red: 3 failed. Mutation M5 (drop the early return): 5 failed across 2 files.

### #7 claim notice never covers Home
- Files: `src/lib/claimMyOrganisers.ts` (+`CLAIM_NOTICE_KEY`, `CLAIM_TOAST_MS = 8000`, `stashClaimNotice/readClaimNotice/clearClaimNotice` all try/catch, `notYouOrganiserHref`), `src/pages/AuthCallback.tsx`, NEW `src/modules/organiser/home/ClaimNotice.tsx`, `src/modules/organiser/home/index.tsx` (one import + `<ClaimNotice />` above the jobs, in flow). `toast.tsx` untouched.
- Behaviour: every claim is kept in sessionStorage; organiser Home draws "You now manage X. Not you? Tell us" as an in-flow `role=status` line with a visible 44x44 "Close" (clears it). Landing on Home: NO toast. Landing elsewhere (returnTo / stashed return path, D37): an 8 s toast there too (never Infinity), and Home still shows the line later.
- Tests: `AuthCallbackClaimFixPass.test.tsx` > "claim notice never covers Home (finding 7)" (4); `home/__tests__/ClaimNotice.test.tsx` (5: empty, in-flow + 44px visible Close + Tell us link, stays until closed, unreadable storage, Home renders it above `home-jobs`).
- Existing `AuthCallbackOrganiserClaim.test.tsx` updated to the new contract (Home landings: no toast + notice kept; returnTo landings: toast with `CLAIM_TOAST_MS`; "stays until closed" moved to ClaimNotice test).
- Red: 4 failed + ClaimNotice import failure. Mutations: M7a (duration back to Infinity) 4 failed / 2 files; M7b (toast on Home again) 7 failed; M7c (Home stops rendering it) 1 failed; M7d (Close does not clear) 1 failed.
- Not verified: browser walk at 390x844 (no browser run here).

### #9 no-hits copy
- File: `InvitePerson.tsx`: "No one matches "Zz". Check the spelling, or search for another name they use."
- Test: `groupAFixPass.test.tsx` > "Invite person "no hits" line" (no add/create/tap/click/button/menu). Red: 1 failed. Mutation M9 (old clause back): 1 failed.

### #13 one redeem copy map
- Files: `inviteModel.ts` (`REDEEM_COPY.email_unproven`, `REDEEM_COPY.email_mismatch`, `emailMismatchCopy(hint)` moved here: hint changes only the body), `redeemMismatch.ts` (no copy; `EMAIL_UNPROVEN_COPY = REDEEM_COPY.email_unproven`, re-exports `emailMismatchCopy`; `interpretRedeemWithMismatch` unchanged).
- Tests: `groupAFixPass.test.tsx` > "redeem copy lives in ONE map" (3). Existing redeemUnproven/invitePerson/routes.matrix/inviteModel suites green (admin-organisers 13 files, 219 tests before the new file was counted separately; all green).
- Red: 3 failed. Mutation M13 (literal copy back in redeemMismatch.ts): 1 failed.

### #15 restore check before claim
- File: `AuthCallback.tsx`: `claimMyOrganisers()` moved after `signInDeletionTarget`; a hidden account goes to restore without claiming.
- Tests: `AuthCallbackClaimFixPass.test.tsx` > "restore check runs before the organiser claim" (2). Red: 2 failed. Mutation M15 (claim before the check again): 3 failed / 2 files.

### #17 test rows
- `parsePersonInvite` link_path missing (page and no-page) -> null: `groupAFixPass` parser table. Mutation M17a (drop `typeof link_path`): 2 failed (was green in the review).
- `claimMyOrganisers` mixed answer: `AuthCallbackClaimFixPass` > "mixed claim answer" (parser keeps Ritmo, drops nameless/blank/null/no-id; sign-in keeps "You now manage Ritmo."). Green on unfixed code (parser already filters without throwing; no code change needed). Mutation M17b (drop name check = review M13): 2 failed (was green in the review).

#### Mutations log
scratchpad/mutations.txt (each mutant applied, suite run, file restored from a byte copy; no `.mutbak` left; `git diff` of each file is the intended fix).

#### Note for the parent (shared file)
- `scripts/lint-runtime-architecture.mjs`: added ONE allowlist line for `src/pages/__tests__/AuthCallbackClaimFixPass.test.tsx` (it feeds the claim RPC answer with `organiser_id`, like AuthCallbackOrganiserClaim.test.tsx). Without it the `no-legacy-organiser-fields` rule fails on my spec.
- That rule currently reports 9 OTHER violations, all in group C's new specs: `src/modules/organiser/events/__tests__/goLive.profilePage.test.tsx` and `src/modules/organiser/shared/__tests__/goLiveCheck.parse.test.ts`. They need allowlist entries too (not touched by me).

#### Files changed / created
Modified:
- scripts/lint-runtime-architecture.mjs (1 allowlist line)
- src/lib/claimMyOrganisers.ts
- src/modules/admin-organisers/InvitePerson.tsx
- src/modules/admin-organisers/inviteModel.ts
- src/modules/admin-organisers/invitePersonModel.ts
- src/modules/admin-organisers/redeemMismatch.ts
- src/modules/admin-organisers/__tests__/invitePersonFixPass.test.tsx
- src/modules/organiser/home/index.tsx
- src/pages/AuthCallback.tsx
- src/pages/__tests__/AuthCallbackOrganiserClaim.test.tsx
Created:
- src/modules/organiser/home/ClaimNotice.tsx
- src/modules/admin-organisers/__tests__/groupAFixPass.test.tsx
- src/modules/organiser/home/__tests__/ClaimNotice.test.tsx
- src/pages/__tests__/AuthCallbackClaimFixPass.test.tsx

### groupB
#### FIX-RELEASE-A-WEB group B report

Nothing committed. Line endings: every edited file is still CRLF, and the new test files are CRLF too. Typecheck: 99 `error TS`, the same as the baseline, and none of them in group B files.
Full runs of wizard, home, page, team, shared, events and edit-in-place: 84 files, 2370/2370 passed. Runs of organiser/__tests__, more and flows: 26 files, 912 passed and 2 skipped.
Every mutation below was applied with a cp backup and restored byte for byte by `cp` back. ProfileWizard.tsx was the one exception: I changed and restored one line there with sed, and grep confirms the line afterwards.

#### #4 One "N left" formatter (requiredLeftText)
- Files: home/ProfileButton.tsx, page/index.tsx (RequiredLine), shared/profileProgress.ts (profileLock), shared/goLiveCheck.ts (profileRowLabel), wizard/LevelTrack.tsx (ProgressBar takes `requiredLeft` and shows `wizard-required-left` under the bar), wizard/ProfileWizard.tsx (line 207 only: passes `requiredLeft={p.requiredLeft}`).
- Fix: all 5 surfaces call requiredLeftText(n).
- Tests: shared/__tests__/requiredLeft.oneFormatter.test.tsx, "required_left %i -> %s on every surface" with n=1 and n=2. Also wizard/__tests__/whatsappSeat.matrix.test.tsx "#4 the wizard screen shows...".
- RED on the unfixed code: 10 failed of 13. For example `expected 'Starter. Finish your profiles, 1 left' to be 'Starter. Finish your profiles, 1 answer...'` and `expected 'Complete your profile (2 left)' to be 'Complete your profile (2 answers left)'`.
- GREEN: 13/13 passed.
- Mutation 1, Home line back to `${p.requiredLeft} left`: 2 failed (Home rows). Restored: 13/13.
- Mutation 2, ProfileWizard no longer passes requiredLeft: 1 failed ("#4 the wizard screen..."). Restored.
- Updated pinned tests: events/__tests__/goLive.webA1a.test.tsx ('(3 answers left)', REASON '4 answers left') and wizard/__tests__/homeAndModel.test.tsx ('3 answers left', `Required to publish: ${left} answers left`).
- Note: the Go live row's number still comes from series_go_live_check_v1's profile_missing. Only the wording is shared. The two numbers can still differ, which is a server-side question.

#### #2 WhatsApp: seat holder (D76) and the whatsapp_not_allowed path
- Files: wizard/dancerApi.ts and wizard/stepKinds.tsx.
  - dancerApi.ts: exports WHATSAPP_NOT_ALLOWED_COPY = "We could not save your WhatsApp number yet. Message us and we will sort it out. Your number is kept." It also exports needsTeamHelp().
  - stepKinds.tsx: StepError adds TeamHelp under that error. TeamHelp shows the "WhatsApp us" and "Email us" rows from supportLinks() (48px tall, same pattern as NewPageFlow). With no contact set, it shows a sentence pointing at Finish later instead.
  - The step stays required.
- Test: wizard/__tests__/whatsappSeat.matrix.test.tsx. The REAL saveWizardDancer runs, and the RPC fake follows the D76 rule.
  - Rows that save `whatsapp` and are accepted: other role (teacher); seat holder owner with no other role; seat holder manager with no other role.
  - Rows for a server that still refuses `whatsapp_not_allowed`: both links shown; one link only; no links (sentence shown).
- RED on the unfixed code: 3 failed of 6, all on the refusal path. For example `Unable to find role="link" and name "Email us"` and `Unable to find [data-testid="step-support-none"]`. The 3 seat rows were GREEN on the unfixed code because the client never gated WhatsApp, so their red comes from mutation.
- GREEN: 7/7 passed.
- Mutation 2a, TeamHelp line removed: 3 failed. Mutation 2b, registry save key changed to 'phone': 6 failed, including all 3 seat rows. Restored: 7/7.
- Caveat: if neither VITE_SUPPORT_* value is set on Vercel, the screen shows a sentence and no link. There is no other contact route in the site to fall back on.

#### #6 One organiser field-label map
- File: wizard/registry.tsx. All 10 organiser step labels now read FIELD_LABEL.<key>.
- FIELD_LABEL itself is unchanged. 'Name', 'City' and 'Instagram' replace 'Organisation name/city/Instagram' in the wizard's screen-reader labels. Each step's heading question already names the organisation.
- I kept FIELD_LABEL as it was because its consumers use it in a 76px card row label, in "Edit name" aria-labels and in error sentences. Because it did not change, no consumer test changed.
- Test: wizard/__tests__/stepCopy.fixpass.test.tsx "#6 organiser steps read FIELD_LABEL" (10 rows).
- RED: 3 failed. For example `expected 'Organisation name' to be 'Name'`.
- GREEN: passed.
- Mutation, instagram label back to 'Organisation Instagram': 1 failed. Restored.

#### #8 Shape-check rows (code unchanged)
- Test: shared/__tests__/shapeChecks.fixpass.test.tsx, 36 rows, all green on the real code.
  - parseProfileProgress: each top-level key missing or of the wrong type, including publish_ready "false" and 0; unknown area; no field; required "true"; done 1; a null step; declined junk dropped.
  - Render rows: publish_ready "false" and 0 give isError with 'progress_bad_shape' and useEventLock unlocked; Home draws nothing.
  - parseGoLiveCheck: ready "false" and "true", applies "false", missing array.
  - parseSetPublic: {} / {status:'shown'} / null / a bare string throw, and setShownOnPublicTeam rejects.
- RED, one mutation per check:
  - publish_ready typeof removed: 6 failed, including the 3 render rows.
  - percent/required_left checks removed: 4 failed.
  - steps/declined Array checks removed: 4 failed.
  - AREAS check removed: 1 failed.
  - required/done checks removed: 2 failed.
  - declined filter removed: 1 failed.
  - goLive ready typeof removed: 2 failed.
  - set-public throw changed to `return 'unchanged'`: 5 failed.
  - All restored: 36/36.

#### #10 List step: disabled Add says why
- File: wizard/stepKinds.tsx. Add is described (aria-describedby) by a visible `step-list-add-reason` line. It reads LIST_ADD_HINT "Type one first, then tap Add." when nothing is typed, or LIST_FULL_HINT "That is the most there can be (20)." when the list is full.
- I did not use "Type a name first" because the lists are languages, styles and achievements, not names.
- Test: stepCopy.fixpass "#10 ...".
- RED: failed (no describedby or reason).
- GREEN: passed.
- Mutation, aria-describedby removed: 1 failed. Restored.

#### #11 Phone help links to My page
- Files: wizard/registry.tsx and wizard/stepKinds.tsx. In registry.tsx, the contact_phone help is a fragment with a react-router Link to ORG_PATHS.page (inline-flex, min-h 44px, gold, underlined). In stepKinds.tsx, step `help` now takes a ReactNode.
- Test: stepCopy.fixpass "#11 ...".
- RED: `Unable to find ... role "link" and name "My page"`.
- GREEN: passed.
- Mutation, help back to a plain string: 1 failed. Restored.

#### #14 One profile-required sentence
- Files: shared/selfServeErrors.ts and team/PublicToggle.tsx. selfServeErrors.ts exports PROFILE_REQUIRED_NOTE, and TEAM_COPY.profile_required uses it. PublicToggle.tsx sets NO_PROFILE_NOTE = PROFILE_REQUIRED_NOTE, imported.
- Test: team/__tests__/profileRequired.oneCopy.test.ts.
- RED: 2 failed (`expected ... to be undefined`, and the source matched /Finish your dancer profile/).
- GREEN: 2/2 passed.
- Mutation, literal copied back into PublicToggle: 1 failed. Restored.

#### Files changed
- Modified:
  - src/modules/organiser/home/ProfileButton.tsx
  - src/modules/organiser/page/index.tsx
  - src/modules/organiser/shared/profileProgress.ts
  - src/modules/organiser/shared/goLiveCheck.ts
  - src/modules/organiser/shared/selfServeErrors.ts
  - src/modules/organiser/team/PublicToggle.tsx
  - src/modules/organiser/wizard/LevelTrack.tsx
  - src/modules/organiser/wizard/ProfileWizard.tsx (line 207 only)
  - src/modules/organiser/wizard/registry.tsx
  - src/modules/organiser/wizard/stepKinds.tsx
  - src/modules/organiser/wizard/dancerApi.ts
  - src/modules/organiser/wizard/__tests__/homeAndModel.test.tsx
  - src/modules/organiser/events/__tests__/goLive.webA1a.test.tsx (2 string lines)
- Created:
  - src/modules/organiser/shared/__tests__/requiredLeft.oneFormatter.test.tsx
  - src/modules/organiser/shared/__tests__/shapeChecks.fixpass.test.tsx
  - src/modules/organiser/wizard/__tests__/stepCopy.fixpass.test.tsx
  - src/modules/organiser/wizard/__tests__/whatsappSeat.matrix.test.tsx
  - src/modules/organiser/team/__tests__/profileRequired.oneCopy.test.ts

#### Screens that changed visually (for screenshots)
1. Home /account/o with required_left > 0: the button's line reads "Starter. Finish your profiles, N answers left" (or "1 answer left").
2. My page /account/o/page with required_left > 0: "Required to publish: N answers left".
3. Event screens /account/o/events/:id (and Details) with the C14 lock: the reason reads "Finish your profiles first, N answers left".
4. Go live draft /account/o/events/:id: the profile row reads "Complete your profile (N answers left)".
5. Wizard /account/o/complete on any question with required_left > 0: a new right-aligned "N answers left" line under the progress bar.
6. Wizard, organiser phone step (organiser:contact_phone): the hint has a gold, underlined "My page" link, 44px tall.
7. Wizard, list steps (languages, favourite_styles, achievements) when empty: a new "Type one first, then tap Add." line under the input. When 20 items are in the list: "That is the most there can be (20)."
8. Wizard WhatsApp step (dancer:phone_or_whatsapp) after the server refuses with whatsapp_not_allowed: the new error copy plus "WhatsApp us" and "Email us" rows, or the no-contact sentence.
9. The wizard's organiser labels change for screen readers only ('Name', 'City', 'Instagram'). Nothing changes on screen.

### groupC
#### Group C fix pass (RELEASE-A-WEB): #3, #12, "1 more" dates card, #8 (goLiveCheck parser tests)

Nothing committed. Line endings preserved (CRLF on all edited sources). No edit to `goLiveCheck.ts` code, no edit to `ProfileWizard.tsx`.

#### Orchestrator finding: "1 more" above "No coming dates"
- **Root cause:** the Coming dates card (`OneEvent.tsx` `Dates`) took its ROWS from Home (`organiser_home_v1` `next_dates`, via `comingDates(home)`) but its COUNT from the workspace read (`moreLabel` = workspace coming scheduled dates minus rows shown). When Home lists no next_dates for the series but the workspace holds a coming date (the screenshot's draft fixture: Home row with `next_dates: []`, workspace 1 coming date; in real life also Home not yet refetched after a date is added), the card showed 0 rows, "1 more" and "No coming dates" at once. Not a past/cancelled-date count: `wsComing` already filters scheduled and >= today.
- **Fix (one line):** new `comingCard(home, ws, today)` in `eventModel.ts` builds rows and count from the same dates: Home's rows lead; if Home lists none and the workspace read is not at its 100 cap, rows come from the workspace (soonest first, with time); a count is shown only under at least one row. `OneEvent.tsx` uses it.
- **Tests:** `src/modules/organiser/events/__tests__/datesCard.consistency.test.tsx` (6 render rows incl. "0 coming dates + 1 past date", "0 coming + 1 cancelled", "0 coming + 1 past + 1 cancelled"; 5 pure rows incl. 100+ full read with no Home rows).
- **Red (unfixed code, render rows):** `Home lists none, the workspace holds 1 coming date (the screenshot)` -> `Received "more": "1 more", "none": true, "rows": 0`; `... 2 coming + 1 past` -> `"more": "2 more", "none": true, "rows": 0`. `Tests 2 failed | 4 passed (6)`.
- **Green:** `Tests 11 passed (11)`; s5.events.test.tsx still green.
- **Mutations:** (a) fallback `if` -> `if (false && ws)`: 4 failed | 7 passed; (b) drop the "count only under a row" guard: 1 failed (`expected '100+' to be null`). Both restored (cmp-verified), green.

#### #3 Go live "Complete your profile" goes to the wrong page
- **Fix:** `lifecycleModel.ts` new `profileFixPath(check)`: the row's href carries `?o=<id>` of the first `profile_missing` organiser entry with fields left (then `&returnTo=` as before). `?o=` is the existing page-choice param of `useOrganiserChoice`, which the wizard already reads and which already ignores ids the person holds no seat on, so `ProfileWizard.tsx` needed no change (the hook is untouched too).
- **Tests:** `src/modules/organiser/events/__tests__/goLive.profilePage.test.tsx`: 5 pure rows (one page; dancer-only -> no `o`; dancer then page; 2-organiser first complete; 2-organiser both incomplete -> first in server order) + walk "multi-page owner: page A selected (remembered), draft on page B -> link carries B and the wizard opens B" (asserts `my_profile_progress_v1` called only with B) + "2-organiser series" + "wizard ignores a page id the person holds no seat on".
- Updated `goLive.webA1a.test.tsx` profile-row assertion (it pinned the old link without `o`).
- **Red:** `Tests 7 failed | 8 passed (15)`, e.g. `expected '/account/o/complete?returnTo=%2Faccou...' to be '/account/o/complete?o=bbbb0000-0000-4...'` (the non-member row was green: existing hook behaviour).
- **Green:** 15/15. **Mutation:** `profileFixPath` returns the bare path -> 6 failed; restored, green.

#### #12 Go live on a rejected series
- **Fix:** `lifecycleRows` gives `rejected` Go live (server decides via series_go_live_check_v1), See it live off with the draft reason, no Discard (only draft -> archived is known allowed).
- **Test:** matrix in `goLive.profilePage.test.tsx` (draft, rejected, live, paused, ended, archived, pending_review). Red before fix: `rejected: Go live true, Discard false` -> `expected false to be true`. **Mutation:** `status === 'rejected' && false` -> 1 failed; restored, green.

#### #8 parseGoLiveCheck bad-shape table
- **Test:** `src/modules/organiser/shared/__tests__/goLiveCheck.parse.test.ts`: baseline + 18 one-bad-key rows (ready "false"/"true"/1/missing WITH valid arrays; items without section / numeric code / null; recommended; profile_rule_applies string/missing; profile_missing bad area / no area / numeric organiser_id / fields not array / non-string field) + 4 non-object answers. Green 23/23; no row exposed a real bug, code unchanged.
- **Mutation:** removed `typeof ready !== 'boolean' ||` -> 4 failed (all ready rows); restored exactly (group B's concurrent profileRowLabel edit in the same file left intact), green.

#### Gates
- `npx vitest run src/modules/organiser/events src/modules/organiser/wizard src/modules/organiser/jobs src/modules/organiser/shared`: **62 files, 1533 passed** (one earlier run caught homeAndModel.test.tsx mid-edit by group B; passes alone and in the final run).
- Typecheck: **99** `error TS` (at limit), none in my files.

#### Files
- Changed: `src/modules/organiser/events/eventModel.ts`, `src/modules/organiser/events/OneEvent.tsx`, `src/modules/organiser/events/lifecycleModel.ts`, `src/modules/organiser/events/__tests__/goLive.webA1a.test.tsx` (my 3 lines; the "answers left" lines in it are group B's).
- Created: `src/modules/organiser/events/__tests__/datesCard.consistency.test.tsx`, `src/modules/organiser/events/__tests__/goLive.profilePage.test.tsx`, `src/modules/organiser/shared/__tests__/goLiveCheck.parse.test.ts`.

#### Screens that changed visually
- `/account/o/events/:seriesId`, draft (or any series) whose Home row has no next_dates but the workspace has coming dates: Coming dates card now lists the date rows (with Sessions links), no "N more", no "No coming dates". Retake `golive-three-new-codes.png`.
- `/account/o/events/:seriesId`, rejected series: lifecycle card now shows Go live + "Still needed" list + See it live (off); before it showed nothing.
- No visual change to the profile row itself (only its href); the walk is "tap Complete your profile on a page-B draft -> wizard on page B" (`/account/o/complete?o=<B>&returnTo=...`).

#### Not verified
- No browser walk at 390x844; no prod read (Supabase not queried: the review's counts were used). Rejected Go live on the real server (0 rejected series on prod). Whether Home's real organiser_home_v1 omits next_dates for drafts (fallback covers either way).

## Go live card (D82)
Owner feedback "this section is not intuitive" -> the card is a checklist with a real button. Presentation only: `goLiveState`'s
rule, `parseGoLiveCheck`, the server list, order, codes and fix links are unchanged.

- Files: `src/modules/organiser/events/LifecycleActions.tsx` (card), `events/lifecycleModel.ts` (`leftCount`, `READY_HEADING`,
  `OPTIONAL_HEADING`, `STILL_NEEDED` = "Before you go live"; state `fix` is now `{ kind: 'fix', left }`, `firstFix` removed),
  `shared/goLiveCheck.ts` (`GO_LIVE_LABEL` = action labels, `thingsLeftText` the one "N things left" formatter,
  `profileRowLabel` = "Finish your profile (N answers left)").
- Card: heading "Before you go live" + "N things left" (event rows + one profile row; "1 thing left"); N = 0 -> "Ready to go live".
  Required rows = empty circle + action label + chevron + the same link. Recommended rows under "Optional", no circle.
  Go live = full-width primary button at the bottom (`data-testid="org-life-golive"`), reason under it via `aria-describedby`:
  "Finish the N things above first"; locked keeps the lock reason + wizard link; a1 keeps its reason. Rejected/past-only keep their meaning.
- Labels (every code the parser knows): venue "Add a venue", city "Add a city", upcoming_date "Add a date", session "Add a session
  with a title, start and end", cover "Upload a flyer", description "Write a description", name "Add an event name", country "Pick a
  city with a country", organiser "Link an active organiser", ticket_link "Add a ticket link". No code was missing from the brief's
  list except `city` and `ticket_link` (written in the same style). Unknown codes keep "Something else on the event".
- Decision: the off button uses `aria-disabled` (not `disabled`) and ignores clicks, so Tab still reaches it and the reason is read
  (PAR-B N9 test kept in spirit). Behaviour change: a not-ready tap no longer navigates to the first fix; the rows are the way.
  With the check unloaded/failed the button still sends and the server's refusal fills the list (unchanged).
- Red first: the new D82 matrix + label tests on unchanged source (9ff01c8e) -> `Tests 33 failed | 22 passed (55)` in
  `goLive.webA1a.test.tsx`; on the new code 55 passed. Old-noun tests updated (`fpar.review`, `lifecycleGate`, `requiredLeft.oneFormatter`).
- Tests: `goLive.webA1a.test.tsx` "D82: the Go live card, every state" (event only, profile only, both, recommended only, N=0,
  locked; rejected via refusal; a1 is the existing `fpar.review` case) x heading/count/rows/enabled/reason; label test fails if a code has no action label.

| job | step | command | exit |
|---|---|---|---|
| lint chain | 20 links (integrity, mojibake, legacy, architecture, rpc-typing, script-conventions ...) | `npm run lint` | 0 (trailing eslint informational WARN, red on main) |
| typecheck | tsc | `npx tsc --noEmit -p .` | 0 |
| unit | organiser module | `npx vitest run src/modules/organiser` | 0 (3593 passed, 2 skipped) |
| build | production build | `npm run build` | 0 |
| eslint | changed files | `npx eslint <changed>` | 0 errors (1 pre-existing warning) |
| e2e, phone-qa, full test:unit, pre-ship | - | - | NOT RUN here (the pre-push hook runs the suite once) |

## Screens (D82)
`golive-draft-missing`, `golive-draft-dates`, `golive-draft-pastonly`, `golive-rejected` re-shot and NEW `golive-ready`, at 390x844
and 360x640, in `screens/RELEASE-A-WEB/`. They show the real `LifecycleActions` in an isolated temp harness (stubbed
Supabase, not committed), not the full page. Measured at both widths: button 44 px tall, 332 px (390) / 302 px (360) wide,
`elementFromPoint` at its centre is the button, rows 52 px, no horizontal scroll, disabled-reason contrast 6.42:1 (dark theme).
Light theme not shot (the organiser theme is dark-only in this harness): NOT VERIFIED.

## Not verified (D82)
No real-data walk, no Vercel preview, no light theme, no phone-suite run; pastonly shot uses the same server codes as dates plus session.

## Home + background (D83, D84) and Go live polish (D85)

### D84: plain background
`src/components/layout/plainBackground.ts` holds the ONE list `PLAIN_BACKGROUND_ROUTES = ['/invite', '/admin/organisers']`
(+ `isPlainBackgroundPath`, matches the route and anything under it). `GlobalLayout` reads it: on those paths the wash is a
fixed `#0f0d0b` layer (the `.org-theme --bg`), no floating doodles, no animated gradient. Site header and breadcrumb stay (the
organiser area has its own shell, but these two pages still render inside the site frame). Nothing else changed.
Test: `src/components/layout/__tests__/plainBackground.test.tsx` (both route families plain, `/`, `/parties`, `/organisers`,
`/invites`, `/admin/organisers-x` keep the wash). GlobalLayout background layers now carry `data-testid="layout-bg" data-bg=...`.

### D83: copy, before -> after
| where | before | after |
|---|---|---|
| Home profile card title (answers left) | Complete your profile | Finish your profile |
| Home profile card sub | `Starter. Finish your profiles, 2 answers left` / `Ready to publish ...` | `2 answers left. Needed before your events can go live.` (`1 answer left` singular; level name only when 0 left; card hidden as before at 0 + dismissed) |
| heading over jobs | (none) | Your to-do list |
| empty list | (none) | Nothing to do right now. To put something on, tap New event below. (unreachable from `homeJobs` today, it always returns at least one job; covered by a forced test) |
| stale_draft title / sub | `<event>` / `Draft, 287 days` | `Finish and go live: <event>` / `Not live yet, started 287 days ago` (`1 day`) |
| no_dates_left | `<event>` / `Needs dates` | `Add dates: <event>` / `No coming dates, so dancers see nothing` |
| no_cover | `<event>` / `Needs a flyer` | `Add a flyer: <event>` / `Events with a flyer get more clicks` |
| create_first_event | New event | Create your first event |
| join_request | Wants to join | Answer a request to join (sub: requester email, unchanged) |
| change / add / cancel / add_manager | Change a date / Add a date / Cancel a date / Add a manager | unchanged (already verb + object) |
| My events chip, stale draft | Draft, 9 days | Not live yet |
| My events chip, other problems | Needs dates / Needs a flyer | unchanged |

One map: `PROBLEM_COPY` in `jobs/homeJobs.ts` holds `chip`, `title(name)` and `sub()` per problem; `seriesChip` and `homeJobs` both read it.
Decision: a NOT-stale draft's chip keeps the shared status word and age (`Draft, 2 days`), because the G1 consistency tests pin one status word per lifecycle across My events, One event and the date page. Only the Home problem (stale) chip became `Not live yet`.
Files: `jobs/homeJobs.ts`, `home/ProfileButton.tsx` (`PROFILE_TODO_LABEL`, `profileTodoSub`), `home/homeView.ts` (`TODO_HEADING`, `TODO_EMPTY`), `home/index.tsx`.
Tests: new `home/__tests__/HomeTodo.test.tsx` (every JobKind verb + event name, 8/9/287-day subs, London-day count, profile card 1/2/3 left, 0 left, heading, empty state). Updated old-word assertions in `homeJobs.matrix`, `HomeR1`, `requiredLeft.oneFormatter`, `homeAndModel` (no `Draft, ` / old profile words remain in tests/ or e2e).

### D85: Go live card
Files: `events/LifecycleActions.tsx`, `events/lifecycleModel.ts` (`goLiveLeads`), `events/OneEvent.tsx`.
- Circles replaced by plain numbers (`<ol>`, number aria-hidden, whole row still the link, trailing chevron). Required rows 1..N (event rows, then the profile row); Optional rows are numbered on their own (1, 2, ...) under the "Optional" heading, so the numbers never disagree with "N things left". No checkbox/radio/circle icon on the card.
- `goLiveLeads(ws)` (= `lifecycleRows(ws).goLive !== null`, the card's own draft fact; true for draft and rejected) puts the whole card above the month dots and dates; a live event keeps it last. The card still contains See it live and Discard (unchanged).
- Tests (in `goLive.webA1a.test.tsx`, "D85"): numbers 1..N, no checkbox/radio/switch/input/circle svg, row is a link with chevron; draft: card precedes `org-coming`; live: follows it. Existing tests moved from circle selectors to number selectors and read row words via `words()`.

### Red first
On the unfixed sources (stash of GlobalLayout/homeJobs/ProfileButton/index): `HomeTodo` + `plainBackground` = 23 failed | 7 passed. D85 tests on unfixed LifecycleActions/OneEvent: 2 failed (numbers, draft order) | 1 passed (live order, which must not move). All pass after.

### Screens
`screens/RELEASE-A-WEB/` at 390x844 and 360x640 (Playwright against the repo's fake Supabase, signed-in owner; temp spec and config deleted, not committed): `home-claim-notice`, `home-empty` (a brand-new page: first-steps list, the literal empty list is unreachable), `admin-invite-page`, `invite-email-unproven`, `mypage-required`, `golive-draft-missing`, `golive-draft-dates`, `golive-rejected`, `golive-ready`, new `golive-live`. (`golive-draft-pastonly` NOT re-shot; the old one is stale.) Looked at: Home 390, Go live 390, admin + invite 390, my page 360. No horizontal overflow in any shot (scrollWidth - clientWidth = 0). Contrast (dark theme): sub-line `--warn-fg #ffd58a` on `--card #1a1713` and muted text `#a39a8b` on `#1a1713`/`#0f0d0b` computed from the tokens: 12.87:1, 6.42:1, 6.98:1 (all >= 4.5). Job rows min-height 56 px, Go live button 44 px. The organiser theme is dark only: light theme N/A.

### CI
| job | step | command | exit |
|---|---|---|---|
| lint chain | 20 links | `npm run lint` | integrity link failed exit 126 (`bin/check-integrity.sh` has no exec bit in this sandbox); `bash bin/check-integrity.sh` = ok, 0 issues; all other links PASS; eslint link skipped by the chain |
| typecheck | tsc | `npx tsc --noEmit -p .` | 0 (no output) |
| eslint | changed files | `npx eslint <changed dirs>` | 0 errors, 4 warnings (react-refresh export warnings, same kind as before) |
| unit | organiser + admin-organisers + components | `npx vitest run src/modules/organiser src/modules/admin-organisers src/components` | 0 |
| build | production | `npm run build` | 0 |
| full unit, e2e smoke, phone-qa, pre-ship | - | - | NOT RUN here (pre-push hook runs the suite once) |

### Not verified
No real-data shape survey or prod read; no Vercel preview; no light theme; no real phone; full `test:unit` result: see final report. The contrast figures were computed from the tokens, not measured in browser. `golive-draft-pastonly` not re-shot.

## Main merge (D87)

Merged `origin/main` (0ab0ff90) into `claude/people-release-a-web` (merge commit, no rebase/force).

Conflicts: one only, `src/modules/event-page/bento/BentoPage.tsx` imports. Kept both sides: `memo`, `type ComponentProps`, `EventPageSnapshotOccurrence` (main) and `ReportProblemLink` (branch). All four names are still used in the file. BOM and CRLF preserved. No other conflicts (CoverFlow.tsx, OrganiserRoutes.tsx auto-merged).

| job | step | command | exit |
|---|---|---|---|
| types | tsc | `npx tsc --noEmit -p .` | 0 |
| lint | chain | `npm run lint` | 1 (only `check:integrity` exit 126, sandbox exec bit; 19 other links PASS; eslint link skipped by design) |
| lint | integrity direct | `bash bin/check-integrity.sh` | 0 (2088 files, 0 issues) |
| unit | vitest | `npx vitest run src/modules/organiser src/modules/admin-organisers src/modules/event-page src/components` | 0 (198 files, 4573 passed, 2 skipped) |
| build | production | `npm run build` | 0 |
