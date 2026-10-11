## Summary
- **What changed?** The dancer-first **hard gate** on top of #718's layout D. Owner decision 2026-10-11: every signed-in account, organisers included, finishes the dancer profile before it reaches any account or organiser page. All four fields count: first name, city, dance role, photo. Dancer profile first, then organiser.
  - **This PR supersedes #718 and #717.** It is built on #718's head (`96bd93c`) and keeps everything from it except the skippable row: layout D (the finished dancer profile lives in the account menu), the shared `accountRouting` mapping, the dancer home, finish-to-rate, the dead-link guard and the background seam fix.
  - **One shared guard.** A single route wrapper, `src/components/account/DancerProfileGate.tsx`, makes its decision through `dancerGate()` in `src/lib/accountRouting.ts`. It is not copied per page. It sits inside AuthGuard and inside each lazy chunk (`Account.tsx`, `MyAttendance.tsx`, `OrganiserRoutes.tsx`).
  - **Gated routes:** every `/account*` path (`isDancerGatedPath`):
    - `/account` and `/account/dancer`;
    - `/account/attendance`;
    - `/account/o` and every `/account/o/*` (the organiser home, its onboarding with claim / request / create, events, dates, team, profile);
    - the old `/account/new|series|team` links and `/account?add|o|from|claim`, which all redirect into `/account/o*`.
  - **Not gated:** every public page, whether signed out or signed in with an unfinished profile. That means the calendar, parties, classes, event pages (including RSVPs), festivals, profiles, organiser pages, search, `/auth*` and `/finish-profile`. The full list is in `docs/dancer-home.md`.
  - **An unfinished profile is redirected** to `/finish-profile?gate=organiser&returnTo=<the page they wanted>`. The gated screen says *"Finish your dancer profile first, then you can set up your organiser page."* It offers **no "Skip for now"**. After the save that completes the profile, returnTo takes the person on to where they were going. A plain `/finish-profile` visit (rating card, banner) keeps its old behaviour, Skip included.
  - **Removed:** the organiser home's skippable "Finish your dancer profile" row (`DancerProfileRow`) and its session dismissal. The gate makes them unreachable.
  - **Sign-in landing:** `landingPathAfterAuth` is unchanged. Organiser intent still lands on `/account/o`, which is now a gated page, so an unfinished profile goes through Finish first with `returnTo=/account/o` and then carries on to the organiser onboarding. Proved by unit tests over every role × lookup result, by a matrix row per cell, and by the browser walk.
  - **Server enforcement** comes in a separate admin PR. This PR defines `PROFILE_INCOMPLETE_CODE = 'profile_incomplete'` once, in `src/modules/organiser/shared/selfServeErrors.ts`. Its comment states that **the admin PR must raise that exact bare string**, deciding "unfinished" as this site does: `profile_complete_v1` of the resolved persona, where no live persona counts as unfinished. It is the same word the live party-rating gate already raises. I could not read the admin repo from here (the session has no access to it), so the string is the one the task offered.
    - When an organiser claim, request or create comes back with that code, the onboarding sheet and the public "Is this you?" card send the person to the gated Finish screen and then back (`useProfileIncompleteRedirect`). They never show raw error text.
    - The public card also checks, before sending, the completeness AppChrome already publishes. A known unfinished profile goes to Finish first. A claim intent waits while that status is still loading. If the check failed, the server decides.
- **Why was it needed?** The owner's decision supersedes #718's "skippable row" rule. Nobody has signed up yet except the owner, so there are no users to migrate. See "Verified on real data" for the accounts that do exist.
- **Notable decisions** (each one is stated in `docs/dancer-home.md`):
  - **Archived = no live dancer profile = gated.** An archived row never resolves (`_dancer_profile_id_for_account_v1`), so nothing can be filled in. The gated screen offers the WhatsApp contact and **no Continue**, because Continue would loop straight back into the gate. The same applies to an account with no dancer row at all.
  - **A failed completeness check passes (fail open).** Round 1 of the review had it failing closed; review round 2 showed that locks an organiser out of tonight's event on a timeout. Every completeness surface here fails open, and the server refuses the organiser writes anyway.
  - **Once the gate lets a page through, a read back in flight never takes it away.** The fail-open version first looped: TanStack v5 puts an errored query back to `pending` whenever a new observer mounts, so the gate unmounted and remounted the page hundreds of times a second. Caught by the matrix and pinned with a loop detector, which reds against the mutant in a full-file run.
  - **The gate's wording is the owner's**, and it is used on every gated arrival, including a plain dancer opening `/account`. Review flagged this as odd for someone with no organiser intent. Owner: say if dancer-only pages should get different words.
  - `/invite/:token` (admin team invites) is not gated itself; the organiser home it leads to is.

## Scope
- [x] One branch, one commit, on top of #718's head. 24 files: 11 source files edited, 2 new (the gate, the refusal hook), 2 docs (one is this body), 9 test files.
- [x] Source edits: `accountRouting.ts` (the gate rule), `profileCompletion.ts` (`finishProfileHref` marks gated links; `isGatedFinish`), `FinishProfile.tsx` (gated mode), `Account.tsx` / `MyAttendance.tsx` / `OrganiserRoutes.tsx` (wrapped), `OrganiserHomeDancer.tsx` + `home/index.tsx` (row removed), `selfServeErrors.ts` + `OrganiserSheet.tsx` + `PublicClaimCard.tsx` (the server refusal).
- [x] Tests:
  - the matrix is rewritten;
  - `accountRouting.test.tsx` is updated;
  - a new `profileIncompleteRefusal.test.tsx`;
  - `dancer-home.spec.ts` is rewritten;
  - `organiserFake` answers the dancer-profile reads (complete by default, so the organiser e2e specs reach the organiser area);
  - four existing tests that stub `AuthGuard` / `useAuth` now stub the gate or the published context in the same way (`shell`, `MyAttendance`, `OrganiserProfileEmpty.matrix`, `OrganiserProfileContactEdit`).
- [x] Not touched: any RPC, the types, any budget, OrganiserOnboarding, the rating gate.
- [x] `docs/pr-body-dancer-home-v3.md` is this body. **Delete it before merge.**

## Supabase Source of Truth
- [x] "Complete" is still the server's `profile_complete_v1` of the persona from `_my_dancer_profile_id_v1`. This PR adds no new RPC and no write path.

## Privacy Gates (Hard Requirement)
- [x] No phone or whatsapp is read or rendered. The only WhatsApp link is the existing group/contact URL.

## Visibility & Access
- [x] All of this sits behind `VITE_ENABLE_ORGANISER_SELF_SERVE`, which is **OFF in production**, as for #718.

## UX & System Consistency
- [x] No copy points at a control that is not on screen. The matrix asserts it per cell, Skip and Save included.
- [x] Gated with no live profile: the contact is offered and Continue is not.
- [x] A gated arrival whose profile reads complete shows no "finish first" line.

## Effect on requests reaching Vercel
- **Expected: none on any public route.** All 6 prerendered first-load pins are unchanged. Every first-load KB figure equals #718's (event 378.8, home 203.6, auth 288.4); parties and style are 0.1 KB smaller.
- **One new static chunk on account pages:** `DancerProfileGate-*.js` (392 B gz, shared by the three account chunks). It is fetched once, on the first visit to an `/account*` page, and then cached. Lazy chunks gz: Account 4.7 KB, OrganiserRoutes 3.5 KB, FinishProfile 3.6 KB, MyAttendance 2.8 KB.
- No new API, edge or SSR route and no `/_vercel/image` use. The gate's reads go to Supabase, not Vercel. On an account page they are usually answered from the `profile-completion` cache that AppChrome already fills.

## Validation Evidence
- [x] `npm run build` OK.
- [x] `check:bundle-budget`: passes, **no budget raised**. `check:first-load-requests`: 6/6 pins equal. Puller and chunk ratchets equal. Self-tests for both pass.
- [x] `tsc -p tsconfig.app.json`: 95 errors, **the same set as main** (`5bde22e`, route typegen run). The one textual difference is the known union-size count in the breadcrumbs error, as in #718.
- [x] `npm run lint`: 16/16 links green (after `chmod +x bin/*.sh`, as CI does). ESLint findings on every touched file are **identical to #718's**.
- [x] `env -u NODE_PATH npm run test:unit:offline` (placeholder Supabase env): **244 files, 4754 passed**, 15 skipped (as on main).
- [x] `npm run test:e2e` (the curated gate, CI's env, preinstalled Chromium): **89 passed, 1 skipped**, twice in a row.
- [x] architecture-guard steps (integrity, legacy tables/RPCs, `lint:architecture`, `AUDIT_STRICT=1 check:images`, image widths + self-test, plan-hygiene self-test) pass. So do `check:migration-stamps`, `check:ci-budget --self-test`, `check:seo:self-test`, and `check:pr-real-data-verified` on this body.
- [x] Two `/code-review` rounds at high effort before commit, as for a user-facing change.
  - Round 1 fixes:
    - the public card treats a failed check as "server decides";
    - the gated "done" state no longer says "finish first";
    - the gated Finish screen re-asks the server only when the cache says complete;
    - My attendance gets a skeleton;
    - stale comments.
  - Round 2 fixes:
    - **a real bug:** the chrome publishes `{status:'loading'}`, not only `'loading'`, so a claim intent could fire before the status was known. Fixed, and pinned with both forms (one reds against the mutant);
    - fail open on a failed check (above), which surfaced the remount loop (fixed and pinned);
    - anonymous sessions waited forever (they now pass, as in #718);
    - stale comment.
  - Declined, with reasons:
    - the gate wording on dancer-only pages: the owner's words;
    - a typed create form is lost on a server refusal: only reachable if the server and this site disagree about "complete";
    - the gate re-checks a live editor after an admin clears a field mid-session: rare, and correct per the rule;
    - `PrefetchOrganiserHome` stays outside the gate: inside, every organiser's cold load would wait for the gate first;
    - the cold `/account/o` load waits for the completeness reads: usually cached by AppChrome;
    - the dancer home's unfinished branch is now unreachable: kept as a defensive fallback.

**New matrix run against #718's code (v2) first** (the new test file copied into a v2 worktree): **87 of 144 fail.**
- Every unfinished cell fails all 7 gate checks. That is 4 shapes (no dancer row, stub, partly filled, archived) × 3 roles (no organiser, organiser, open access request) = 12 cells × 7 checks = 84.
  - The 7 checks: `/account` gated; `/account/o` gated; deep link keeps returnTo; organiser-intent landing gated; gated screen explains itself with no Skip; returnTo round-trips; `/account/dancer` gated.
  - On v2, `/account` and `/account/o` render instead, with the skippable row.
- Plus 3 edges: My attendance gated, an old `/account?from=` link gated with its query, and a gated check that fails offers no Skip.
- All 27 checks on the 3 **complete** cells pass on v2 and on this branch: complete profiles are never gated.
- `profileIncompleteRefusal.test.tsx` fails at import on v2, because the code did not exist there.
- Mutations:
  - letting `no_profile` pass reds 43 checks;
  - forcing the Finish screen ungated reds 87;
  - dropping the claim-intent wait reds 1;
  - dropping the stay-mounted rule reds the loop detector.

## Verified on real data
- Shapes surveyed: read-only SELECTs (Supabase MCP, prod `stsdtacfauprzrdebmzg`, counts only, 2026-10-11).
  - **dancer_profiles 166**: 52 no first name, 73 no city, 153 no dance role, 68 no photo, **15 archived**, 12 complete. These match the task's counts.
  - **auth accounts 16**, by resolved persona (`_dancer_profile_id_for_account_v1`, then `profile_complete_v1`):
    - 4 complete, 1 of them an organiser member;
    - 5 partly filled, 1 an organiser;
    - 5 stubs, 2 organisers;
    - 2 with no live dancer profile, 0 organisers.
  - So with the flag on, **3 of the 4 organiser-member accounts would be sent to Finish first** (organiser membership is from `entity_members`, `entity_type` organiser). No organiser has *no* live profile, so nobody is left with only the WhatsApp contact.
  - The open-access-request count was **not** re-surveyed: the table behind `list_organiser_access_requests_v1` was not visible to my read. That role shape is covered in the matrix.
- Checks run: the 15-cell matrix (5 dancer shapes × 3 roles, 144 checks through the real route components, guards included), the refusal tests, every CI step listed above, and a Playwright browser walk at 390x844 (and 390x600) against the organiser fake in prod shapes.
  - **Signed-in organiser with an unfinished profile hitting `/account/o`:**
    - lands on `/finish-profile?gate=organiser&returnTo=%2Faccount%2Fo`;
    - the heading is "Finish your dancer profile", the gate line is shown, and there is no Skip;
    - Save is disabled with its reason until a field is filled;
    - picking a role and saving sends one save and lands on the organiser home with no row.
    - A deep link (`/account/o/team`) keeps its address.
  - **Complete organiser:** never gated. The account menu opens "Your dancer profile", which links back. The header icon lands on `/account/o`.
  - **Brand-new account** (empty stub, no organiser, organiser intent):
    - gated with all four fields asked;
    - no horizontal scroll;
    - every control 44px or more.
  - **No dancer profile:** the WhatsApp contact, and no Continue.
  - **Unfinished dancer:** public pages open; the account icon is gated.
- NOT verified: anything on a real phone or against live data beyond the read-only counts. In full:
  - anything on a real phone;
  - a real sign-in round trip (the magic link and the `/auth/callback` → landing → gate hop were tested as unit decisions plus the routes, not end to end);
  - real Supabase RLS answers for these reads (all browser runs used the route-mocked backend);
  - the admin PR's refusal itself: the string is agreed only by comment, and nothing here calls the real RPC with an unfinished profile;
  - the open-access-request count in prod;
  - `check:doc-weight`, `check:ci-budget` and `check:og`, which need a live preview deploy or a secret;
  - Lighthouse;
  - screen readers;
  - the live-DB contract tests;
  - behaviour with `VITE_ENABLE_ORGANISER_SELF_SERVE` on in prod (it is off there, so none of this is reachable in prod until it is turned on).

## Next steps
- **Branch collision, owner's choice needed.** When this was pushed, `feat/dancer-home-v3` already held `6adcef1` from another session (a parallel run of the same task, pushed 14:53 UTC). I did not overwrite it. This work is on **`feat/dancer-home-v3-alt`**. Open only one of the two. Where they differ:
  - **`/account/attendance`:** gated here, open there. The task says RSVP viewing stays usable, which favours theirs.
  - **`/invite`:** gated there, not here.
  - **A failed completeness check:** passes here (fail open), gated there.
  - **The public claim card while completeness is loading:** here a claim intent waits; there it goes ahead and relies on the server refusal, which is not live yet.
  - **The remount loop fix:** a page the gate has let through stays mounted here.
- Open as the bot from the orchestrator's machine. This branch was pushed from a session whose token resolves to the owner, so no PR was opened here.
- Close #718 and #717 once this is open.
- The admin PR must raise `profile_incomplete` (bare) from `claim_organiser_v1`, `request_organiser_access_v1` and `create_organiser_profile_v1`, deciding with `profile_complete_v1` of the resolved persona.
- Delete `docs/pr-body-dancer-home-v3.md` before merge.
- Not merged, not approved.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_012YAnJ7X8GDNaR7o3DQG6B2
