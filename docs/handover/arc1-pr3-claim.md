# Arc 1 PR 3 slice C (`claude/arc1-pr3-claim`) &mdash; handover

Brief: admin `brief/arc1-organiser-onboarding-2026-10-21` `docs/briefs/arc1/arc1-pr3-onboarding.md`
(sha c3b77f4), plus `arc1-common.md` and `arc1-as-built.md`. Slice C = claim states 6a-6e, the
two-page switch at event creation (7b) and second-page welcome (7c), the cannot-create screen (8),
the new phone / ended session flow (9). Base: `main` 817a4dd.

## Done

| Mockup | Where | What |
|---|---|---|
| 6a-6e | `home/onboarding/claimStates.ts` (ONE mapping), `OrganiserSheet.tsx`, `OnboardingView.tsx` | Every search row opens its claim screen in the sheet: title + one line + primary + "Not this one". 6c with an unproven mailbox shows the code step first. A refused claim becomes the ask-to-join screen worded as an unknown hint. The failed-hint row gets "Is X yours? / Ask to join and we will check." |
| 7b | `flows/new/whichPage.ts`, `flows/new/WhichPage.tsx`, `NewFlow.tsx` WhatStep | "Which page is this for?" before the format question when the login runs 2+ pages (once per New event: `&page=set`); the `?o=` page starts ticked; one page skips it. |
| 7c | `switch/welcomeModel.ts`, `switch/Welcome.tsx`, route `welcome`, `ORG_PATHS.welcome(id)`, `InviteRedeemPage.tsx` (one line) | A NEW seat from an invite lands on `/account/o/welcome?o=<id>`: with another page on the login "You now manage X / You also manage Y. Switch any time from Home."; the first page forwards to Home on it. Already-member still goes to Home. |
| 8a/8b | `flows/newpage/cannotCreate.ts`, `openRequestApi.ts`, `NewPageFlow.tsx` | `organiser_invite_required` shows "Events are not open to you yet" + "Ask us to open it" -> `request_signup_access_v1(email, 'Wants to create the page <name>')` -> "We are checking". `rate_limited` -> "Try again later."; anything else -> not sent, ask stays. No email on the login: the old support rows. |
| 9a | `src/pages/Auth.tsx` | Sign-in sub line: "Sign in with the email you used before." (snapshot `auth.today` updated, 4 lines). |
| 9b | `src/lib/auth-otp-routing.ts` `callbackErrorCopy` | Shorter words for expired / invalid / timeout. |
| 9c | `shared/selfServeErrors.ts` `SESSION_ENDED` | "Your sign-in ended. Sign in again." on series commands (was the "You cannot make that change here" catch-all) and the programme save. |

## Findings the owner should see

1. **"You cannot start an event yet" IS in Website src** (`flows/new/NewFlow.tsx`, NameStep, from
   `createBlock` = a page that is not live). It is NOT the `_organiser_create_allowed_v1` door. The
   door's refusal (`organiser_invite_required`) is the create-a-PAGE sheet; mockup 8 was built there.
2. **"Ask us to open it" cannot open anything by itself.** It reuses `request_signup_access_v1`
   (lands in the admin access-request list). Approving it writes an allow-list row with
   `source='admin_invite'`, which D98 (20261129860000) excludes from arm (b) of
   `_organiser_create_allowed_v1`. So after approval the admin must ALSO issue an email-bound invite
   (arm d) or add a hand row. Needs owner: change approve's source for this note, or accept.
3. ~~6a wording fitted to the server value~~ closed: the owner kept the mockup's "You are already its owner." (finishing pass).
4. **9c "What you typed is kept on this phone" is NOT said**: no flow keeps a draft across a sign-in.
   The mockup's 9c "Sign in" button is not built (copy only).
5. 9a/9b buttons ("Send code", "Send a new link") keep today's Auth labels; only the words changed.
6. Prod: one person holds owner/manager seats on 3 pages (arc1-as-built said 0 with two teams), so
   7b/7c meet real data now. Page names reach 34 chars: the sheet header truncates, so the deciding
   sentence is an `h3` in the body.

## Cross-slice touches (merge carefully)

PR 2 slice A owns `InviteRedeemPage.tsx` and its tests: this slice changes ONE navigate line there
and adds a `/account/o/welcome` route line to three of its test routers (`fixup1`,
`inviteJoiningAs`, `routes.matrix`). `callbackErrorCopy` is also in PR 2's list; flow 9 is this
slice's. No Home (`home/index.tsx`) edit (slice B owns the go-live card).

## Left / next steps

- Owner calls on findings 2 and 4 (and whether 9c gets a Sign in button).
- A review pass + one fix pass (per the brief's worker plan).
- Phone test by Ricky (final confirmation only).

## Finishing pass (dt_775933031045, 2026-10-21)

Merged into `claude/arc1-pr3-claim`, in order: `origin/main` (3bbea89), `origin/claude/arc1-pr3-ten`
(slice B, FIRST), `origin/claude/arc1-pr3-dancer4` (slice A).

| Item | What |
|---|---|
| merge: `NewFlow.tsx` | One conflict (imports). Kept both: `whichPage`/`WhichPage` (7b, this slice) AND `goLivePath`/`profileQuestionsLeft` (slice B). WhatStep keeps the 7b page question; CoverStep keeps slice B's Go live hop. Dancer4 merged clean. |
| merge fallout: `goLiveModel.openQuestions` | main (#897) registered teacher/DJ wizard steps, so slice B's go-live list started asking `teacher:years_teaching` (its own test went red). Go live needs only dancer + organiser fields (`_series_go_live_check_p5`): the list now keeps those two areas only. |
| review 7, 6a | Mockup wording back: "You are already its owner." (owner decision; finding 3 above is closed). |
| review 7, 9a | `SIGN_IN_SUB` (`lib/auth-otp-routing.ts`) is the one sub line under "Welcome back"; `AuthSignInSub.test.tsx` tables it over every sign-in visit (plain, returnTo, each callbackError, unknown reason, from the Join tab). |
| review 7, 1d | A first-page invite no longer skips the welcome: "You manage X / Add your first event whenever you are ready." + "Add an event" (New event on that page) + "Look around first" (Home on it). 7c unchanged. `joinedWelcome` now always returns a screen (`1d` or `7c`). |
| review 8 | ONE hint-to-words map: `CLAIM_COPY` in `home/onboarding/claimStates.ts` holds the row words, the screen and the primary per hint (and `unknown`). `HINT_TEXT`/`NO_HINT_TEXT` deleted; the row reads `hintRowText`, `rowAction` reads `claimPrimary`. `ClaimStates.test.tsx` tables every hint x row words x row button x sheet screen x row action. `NO_EMAIL_COPY` moved with it. |

Not done here (by instruction): prefill wiring (a later worker).

### Left / next steps (after this pass)

- Owner calls on findings 2 and 4 above (and whether 9c gets a Sign in button).
- Phone test by Ricky (final confirmation only).

## Checks run in the sandbox (first pass; this pass's results are in the PR body) (no PR opened: sub-branch, the orchestrator merges)

| Job / step | Command | Result |
|---|---|---|
| unit-tests | `npm run test:unit` | 10913 passed; 15 failed in 4 files (`tests/eventViewCompat.contract`, `integrityCouldNotRun`, `occurrenceProgram.contract`, `publicEventPageLineup.contract`) &mdash; the SAME 15 fail on `main` 817a4dd (live-DB / sandbox), none in this diff |
| typecheck.yml | `check:rpc-typing`, `check:wallclock-brand` | pass (in the lint chain) |
| full `tsc` (not a CI step) | `npm run typecheck` | 99 errors, all pre-existing, none on a line this diff adds |
| lint | `npm run lint` | 19/20 links pass; `check:integrity` exit 126 = `bin/check-integrity.sh` is not executable in this checkout (mode 100644); `bash bin/check-integrity.sh` passes (0 issues) |
| eslint (pre-ship ratchet) | `npx eslint <changed files>` | 0 new: 7 in `Auth.tsx` and 1 in `InviteRedeemPage.tsx` exist on `main` |
| build | `npm run build` | exit 0 |
| e2e-smoke | `npm run test:e2e -- --workers=2` (CI env) | 156 passed, 2 failed: `organiser-home:55` also fails on `main`; `organiser-layout:171` timed out under load and PASSES alone (36.7 s) |
| integrity (pre-commit) | `node scripts/check-source-integrity.cjs` | 0 corrupted |
| walk 390x844 | `npx playwright test tests/e2e/arc1-claim-walk.spec.ts` | 8/8 (6a-6e, 7b, 7c, 8a/8b); screenshots in `test-results/arc1-claim/` (not committed) |

Red-first: `ClaimStates.test.tsx` 9 failed on the unfixed view; `WhichPage.test.tsx` 3 failed on the
unfixed `NewFlow`; `CannotCreate.test.tsx` 7 failed on the unfixed `NewPageFlow`; `sessionEnded.test.ts`
5 failed; the 9b copy table 4 failed. All green after.

## Verified on real data / Not verified

Verified: prod shape survey (read-only, counts only): 49 live pages = 38 no team + no contact email,
2 no team + email, 6 team + no email, 3 team + email; longest name 34 chars (drove the body-title fix);
owner/manager seats per person: 7 people x 1 page, 1 person x 3 pages (7b/7c are real). Every hint x
screen in vitest and in the browser walk with the fake.

Not verified: the hint for any REAL viewer (computed per login; no session as a real user);
`request_signup_access_v1` on prod (PR 1 not merged: before it lands the ask shows "That did not send");
the redeem -> welcome hop on a real invite; real phone keyboard; Vercel preview (not pushed before this run).
