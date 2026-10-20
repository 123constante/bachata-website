VERDICT: FIX PASS NEEDED

# Independent review: A-WEB2 (invite person, auto-claim notice, Report a problem, retired pages hidden, Full profile mark)

Reviewer ticket dt_8c5a8ee3e53f. Slice branch `claude/people-a-web2-invites` at 24089ca (author Sonnet, ticket dt_91b10b492be5),
diffed against `origin/main` 960fc4c. Brief: admin `brief/people-publishing-2026-10-20` `briefs/people-arc/REVIEW-WAVE2.md`
plus COMMON, WEB-COMMON, A-WEB2 and DECISIONS. The slice code was not changed. This branch adds only this file and
`A-WEB2-screens/`.

There are no blocking findings. The fix pass is needed for one breach of the owner's UI rules (finding 1, a 36x14 px tap
target on the one control that undoes a wrong automatic claim), one routing change (finding 2), and four rules the tests
do not hold (finding 6: mutations that stay green).

## Findings (most severe first)

### 1. should: the "Tell us" link in the claim notice is 36x14 px, not 44x44
`src/pages/AuthCallback.tsx:437`. Measured in Chromium on the real `/auth/callback` route with a fake Supabase:
the `<a>` is **36 x 14 px** at 390x844 and at 360x640. The toast's close button (shared primitive) is 20 x 20.
**Scenario:** a person signs in and is told "You now manage Ritmo." The page is not theirs. On a phone, inside a toast that
closes after 15 s, the only way to report it is a 14 px-high text link. The owner's UI rule is 44 px, and this link is the
only way to undo an automatic claim that skipped the confirm screen.
**Fix:** give the link `inline-flex min-h-[44px] items-center px-2` (the same classes as `ReportProblemLink`). Also show the
notice somewhere that lasts: keep the toast but drop the 15 s `duration`, or add a dismissible banner on `/account/o` once
R1 opens that module. Add a test that asserts the class, because mutation M6 shows nothing checks tap size.

### 2. should: a non-empty claim overrides every returnTo, including an invite link
`src/pages/AuthCallback.tsx:466-469` (`routeOnwards`) and `:448` (`navigateToSignedInFallback`). `announceClaimedOrganisers()`
runs before `safeReturnTo` and the stashed return path, then deletes the stash.
**Scenario:** an admin uses Invite person for page X, and A-DB2 records the invite email as X's claim email (the brief's
"recorded claim email"). The person taps `/invite/<token>`, then "Sign in", and comes back to
`/auth/callback?returnTo=/invite/<token>`. `claim_my_organisers_v1` claims X, so they land on `/account/o`, the invite is
never redeemed, and the bearer link stays open for 7 days. The same happens on any sign-in that started from an event page
or a claim card: the person loses where they were going on that one sign-in. With an empty list, every route is the same
as on main (mutation M8 turns 60 existing AuthCallback tests red, so those routes are pinned).
**Fix (smallest):** honour an explicit `safeReturnTo`/stashed path when there is one and still show the notice. Land on
`/account/o` only when there is no return path. Add a table row: claimed 1 x returnTo `/invite/<token>`.

### 3. should: Leader prefill picks any one of several Leaders
`src/modules/admin-organisers/invitePersonApi.ts:36-42`: `.eq('is_leader', true).limit(1)` with no `order`.
Prod (read only, counts): **51 active Leader rows on 47 pages**, so at least one page, and up to four, has two or more.
**Scenario:** the admin picks such a page and the form prefills whichever Leader Postgres returns first. That can be the
wrong person, and the invite then joins that person's record to the email.
**Fix:** fetch up to 2 rows. If there are 2 or more, prefill nothing and say "This page has more than one Leader. Search for
the person to invite." Otherwise order deterministically (for example `.order('created_at')`).

### 4. should: the sitemap no longer matches the organiser page's visibility gate
`app/routes/sitemap.tsx:186-190` says it "Must match app/routes/organiser.tsx's own visibility gate exactly". The slice
adds `NOT_PUBLIC_LIFECYCLE` to the page read (`organiserPublicProfile.ts:379`) but not to the sitemap.
**Scenario:** an admin archives an organiser. The page now 404s, but the sitemap still submits its URL, and Google reports
"Submitted URL not found (404)". Prod has 0 archived or rejected rows today, so nothing is broken yet.
**Fix:** add `.not(...NOT_PUBLIC_LIFECYCLE)` to the sitemap query. The file is outside A-WEB2's list, so the orchestrator
needs to approve it. Without that, log it for the release PR.

### 5. should (contract for A-DB2): `email_mismatch` would show the invited address to whoever holds the link
`src/modules/admin-organisers/redeemMismatch.ts:271-273` prints `invite_email`/`email` from the redeem answer in full.
The pinned interface does not say redeem returns the email. Today's `peek_dancer_invite_v1` deliberately never returns it
("Never the email or the last name").
**Scenario:** an invite link is forwarded or seen over someone's shoulder. Anyone signed in who opens it learns the invited
person's full email address.
**Fix:** A-DB2 either returns no email, so the client's generic copy is used (already built and tested), or returns a masked
one (`m***@example.org`). Pin that choice in DECISIONS.

### 6. should: rules the tests do not hold (mutations that stay green)
- **M2:** removing the 4 s timeout from `claimMyOrganisers` (`src/lib/claimMyOrganisers.ts:103`) leaves 141/141 green.
  "Never block sign-in" has no test. Add one: an RPC that never resolves, with fake timers, still lands.
- **M4:** deleting `email_in_use` from `INVITE_PERSON_COPY` leaves 140/140 green, because the `it.each` iterates the table
  under test. Pin the D16 list (`not_admin, invalid_email, email_in_use, profile_not_found, organiser_not_found`)
  literally in the test.
- **M6:** removing `min-h-[44px]` from `ReportProblemLink` leaves 141/141 green.
- **M7:** `fetchOrganiserFullProfile` returning `!error` (so `{}` or `"true"` shows the mark) leaves 141/141 green. The Full
  profile mark has **no test at all**. The brief asks for true / false / missing / error; add those four rows.

### 7. nit: the redeem email prefill cannot be built from what exists (gap for A-DB2)
Brief item 2 / review check (c). `organiser_invites` has no email column (prod columns: id, organiser_id, token_hash,
issued_at, expires_at, used_at, used_by, revoked_at, revoked_by, issued_by). There is no organiser invite peek RPC, and
`peek_dancer_invite_v1` deliberately omits the email. The token is a hash-matched bearer secret with no email in it. Also,
the redeem page has no email field: sign-in happens on `/auth`. **Record for A-DB2:** store the invite email on
`admin_invite_person_v1`, expose it only to the holder (masked or full, per finding 5) through a peek RPC, and A-WEB1b
prefills the `/auth` email field when `returnTo` is an invite path. The author's handover is right that this needs an RPC.

### 8. nit: the invite message ignores the server's `message` and hardcodes "runs out in 7 days"
`invitePersonModel.ts:61` and `InvitePerson.tsx:47-55`. Prod organiser invites are 7 days today (5 of 5 rows). The person
invite in A-DB2 may mint a dancer invite with a different expiry. Prefer `inv.message` when present, or read the expiry
from the answer.

### 9. nit: "Hi Unnamed!"
`InvitePerson.tsx:49`: `person.name.split(' ')[0]`. For a profile with no names the name is `'Unnamed person'`, so the
message reads "Hi Unnamed!". Fall back to "Hi!" when the person has no first name.

### 10. nit: a raw curly apostrophe in source
`invitePersonModel.ts:29` `person’s`. `check:mojibake` passes, but CLAUDE.md asks for no raw Unicode punctuation in
source. Use a plain `'`.

### Not findings (checked)
- **(b) Leader read:** `organiser_team_members` has RLS on, the policy `public_read_organiser_team` is `SELECT TO public
  USING (true)`, and anon/authenticated have SELECT. The `dancer_profiles` name read passes the admin through
  `is_current_user_admin()`. The brief names no RPC for the Leader ("from its public team"), so a direct read is allowed.
- **(d) AuthCallback order:** the dancer claim (`claimAtSignIn`) runs first, then `claim_my_organisers_v1`. The deleted-account
  restore still takes precedence over both. With an empty list or any error, routing is the same as on main (M8). The landing
  measured in the browser for a first sign-in with an incomplete profile: `/finish-profile?returnTo=%2Faccount%2Fo` (the
  existing one-time hop), with the notice visible over it. The worst case adds up to 4 s to a sign-in.
- **(e) Retired pages hidden:** prod (read only) has 48 organiser pages, all `lifecycle_status = live` (43 `is_active` NULL,
  5 true), 0 archived, 0 rejected, 0 NULL lifecycle. The new filter would hide **0 pages that are public today**. The CHECK
  has no `paused` value; pausing is `is_active = false`, which was already filtered. SSR answers a hidden page with
  `throwDetailNotFound`: status 404 and an `X-Robots-Tag: noindex` header (`app/detailLoader.ts:80`). That is the noindex
  for a direct load; the new `useNoindexMeta` covers only an in-app render. The measured not-found page has no robots meta
  in the DOM, as expected on that path.
- **(f) Report a problem:** link to `https://wa.me/447577576006?text=Hi!%20Something%20is%20wrong%20on%20this%20Bachata%20Calendar%20page%3A%20<page URL>`,
  text "Something wrong on this page? Tell us" (plus a screen-reader-only "(opens WhatsApp in a new tab)"). It is present at the
  end of both the event page and the organiser page. Measured 230 x 44 px (229 x 44 at 360). Contrast 11.70 on the organiser
  page and 13.08 on the event page. It is absent on the organiser not-found page.
- **RPC boundary:** `admin_invite_person_v1` goes through a string-named `UntypedRpc` with no `as never`
  (`check:rpc-typing` passes). `claim_my_organisers_v1` and `organiser_full_profile_v1` use the existing `rpcLoose`. Parsers
  refuse unexpected shapes (null, `{}`, an off-site `link_path`, a non-string token). A missing function shows the generic error
  (invite) or nothing (claim, mark). No token, email or personal data is logged; the result is held in component state only.
- **Files outside the brief's list:** `scripts/lint-runtime-architecture.mjs` (allowlist for the two new `organiser_id`
  readers): **needed**. `src/pages/__tests__/OrganiserProfileEmpty.matrix.test.tsx` (selector excludes the Report link):
  **needed**. `src/lib/claimMyOrganisers.ts` (new, used by AuthCallback): **needed**, and it belongs with item 3.

## UI rules (measured: Chromium, real routes, fake Supabase at the network boundary)

Contrast is text colour against the composited background, with element opacity applied.

| Screen / state | 44 px targets | Contrast >= 4.5 | One shared mapping | No text pointing at absent control | Empty state has one action | Disabled has visible reason | Untouched save sends nothing | Plain British English, no codes | Reduced motion |
|---|---|---|---|---|---|---|---|---|---|
| Invite: closed (01) | Open button 44 h | pass | n/a | pass | n/a | n/a | n/a | pass | no animation added |
| Invite: empty, no page (02, 02-360) | select, search, email, Invite, Cancel all 44 h | labels 9.14, title 21 | refusals in ONE table `INVITE_PERSON_COPY` | pass | "Type at least two letters of their name." | Invite disabled (3.40, exempt) + "Choose the person to invite." 9.14 | Invite disabled until valid, so nothing is sent | pass | pass |
| Invite: page with no Leader (03) | pass | 9.14 | pass | pass | "Search for the person to invite." | pass | n/a | "Leader" is the existing team role word | pass |
| Invite: search no hits (04) | pass | 9.14 | pass | **"add them as a profile first" names no control on this screen** (nit) | yes | n/a | n/a | pass | pass |
| Invite: search error (05) | pass | 5.58 | pass | pass | "Check your connection and try again." (no Retry button; retyping refetches) | n/a | n/a | pass | pass |
| Invite: hits (06) | hit rows 44 h | pass | pass | pass | n/a | n/a | n/a | pass | pass |
| Invite: person chosen, no email (07) | Change 66x44, Invite 52x44 | 18.73 / 9.14 | pass | pass | n/a | Invite disabled + "Enter their email address to invite them." | pass | pass | pass |
| Invite: refusal email_in_use (08, 08-360) | pass | destructive text pass | pass | pass | n/a | n/a | n/a | plain words, no code | pass |
| Invite: submitting (09) | pass | pass | n/a | n/a | n/a | "Inviting" label, disabled | n/a | pass | pass |
| Invite: result (10, 10-360) | Copy 71x44, WhatsApp 100x44, Done 50x44 | 18.73 / 10.71 / note 8.21 | n/a | pass | n/a | n/a | n/a | pass | pass |
| Invite: Leader prefilled (11) | Change 66x44 | name 21 | n/a | pass | n/a | n/a | n/a | pass | pass |
| Redeem: email_mismatch named / unnamed (12, 12-360) | Sign out 353x44, Home 353x44 (333 at 360) | title 21, body 9.14, Sign out 10.71 | the mismatch copy is one function | pass ("Tap Sign out below": the button is on screen) | n/a | n/a | n/a | pass | pass |
| Sign-in claim notice (13, 13-360) | **"Tell us" 36x14: FAIL**; toast close 20x20 (shared primitive) | 21 / 16.75 | `claimedNoticeText` once | pass | n/a | n/a | n/a | pass | toast primitive (existing) |
| Organiser: Full profile mark (14) | not a control | 13.11 (75x23) | one fetcher | pass | n/a | n/a | n/a | "Full profile", never "Verified" | pass |
| Organiser: Report link (15, 15-360) | 230x44 | 11.70 | one component | pass | n/a | n/a | n/a | pass | pass |
| Organiser: not found (16) | n/a | h1 21 | n/a | pass | existing page | n/a | n/a | pass | pass |
| Event: Report link (17, 17-360) | 230x44 | 13.08 | same component | pass | n/a | n/a | n/a | pass | pass |

Screenshots: `docs/people-arc/reviews/A-WEB2-screens/` (390x844 unless the name ends `-360`; downscaled to 1x, 96
colours). Not captured: loading skeletons for the redeem and organiser pages (existing, unchanged by the slice). The
"Upcoming events" lines in the invite message show no events in screen 10 because the fake feed has none for that page.

## Red-first proof (re-run)
- `AuthCallbackOrganiserClaim.test.tsx` copied onto main's code: **5 failed | 12 passed (17)** (claimed 1/2 x complete/incomplete,
  plus the Tell us link). On the slice: 17/17.
- `organiserPublicVisibility.test.ts` on main's code: **2 failed | 2 passed (4)** (archived and rejected rendered). On the slice: 4/4.

## Mutations (one per main rule; each restored afterwards)
Command: `npx vitest run` over the slice's tests plus every `src/pages/__tests__/AuthCallback*.test.tsx`.

| # | Mutation | Result |
|---|---|---|
| M1 | AuthCallback never calls `claim_my_organisers_v1` | **5 failed** / 141, caught |
| M2 | no timeout race in `claimMyOrganisers` | 141 passed, **survives** (finding 6) |
| M3 | lifecycle filter removed | **2 failed**, caught |
| M4 | `email_in_use` removed from the refusal table | 140 passed, **survives** (finding 6) |
| M5 | no blocked reason when no person is chosen | **1 failed**, caught |
| M6 | Report link loses `min-h-[44px]` | 141 passed, **survives** (finding 6) |
| M7 | Full profile mark on any non-error answer | 141 passed, **survives** (finding 6) |
| M8 | an empty claim still lands on `/account/o` | **60 failed**, caught (existing routes are pinned) |

## CI (run in this sandbox on the slice head; job | step | command | exit)

| job | step | command | exit |
|---|---|---|---|
| architecture-guard | integrity guard | `bash bin/check-integrity.sh` | 0 |
| architecture-guard | legacy tables / program RPCs | `npm run check:legacy-tables` / `check:legacy-program-rpcs` | 0 / 0 |
| architecture-guard | runtime architecture | `npm run lint:architecture` | 0 |
| architecture-guard | images | `AUDIT_STRICT=1 npm run check:images` | 0 |
| architecture-guard | plan hygiene canary | `npm run check:plan-hygiene:self-test` | 0 |
| architecture-guard | mojibake canary / guard | `npm run check:mojibake:self-test` / `check:mojibake` | 0 / 0 |
| typecheck | RPC typing / WallClock brand | `npm run check:rpc-typing` / `check:wallclock-brand` | 0 / 0 |
| (not a CI step) | full tsc | `npm run typecheck` | 2: 97 errors on the slice vs 111 on main; none in the slice's new code (4 hits in BentoPage.tsx:337-339 and OrganiserProfile.tsx:1088 are on unchanged lines) |
| unit-tests | dancer-area isolation canary / check | `node scripts/check-dancer-area-isolation.mjs --self-test` / `npm run check:dancer-area-isolation` | 0 / 0 |
| unit-tests | unit (offline, as CI with LIVE_DB=false) | `npm run test:unit:offline` | 1: 6 failed / 9414. 5 are `tests/integrityCouldNotRun.test.ts`, which fail identically on main in this sandbox (TS-helper/worktree environment). 1 is `ProfilePage.test.tsx`, a load flake that passes alone. None are slice files. |
| unit-tests | live-db gate | `node scripts/ci-live-db-gate.mjs` | NOT RUN (needs the PR event context) |
| perf-budget | canaries | `check:bundle-budget:self-test`, `check:first-load-requests:self-test`, `check:chunk-cycles:self-test` | 0 / 0 / 0 |
| perf-budget | production build | `npm run build` | 0 |
| perf-budget | budgets | `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0 / 0 / 0 |
| perf-budget | Lighthouse / doc weight | `check:lighthouse` / `check:doc-weight` | NOT RUN (needs a preview deploy) |
| workflow-lint | masking / notification / no-preview prefixes | `node scripts/lint-workflow-*.mjs`, `check-no-preview-prefixes.mjs` | 0 / 0 / 0 |
| lint (local chain) | `npm run lint` | 1: only `check:integrity` exits 126 (the bin script is not executable in this checkout; the same guard through `bash` is 0). Every other link passes; eslint is skipped by the chain because a link is red |
| phone-qa | phone suite | `npx playwright test --config playwright.phone.config.ts` | NOT RUN in full. My temporary review spec ran on this config at 390x844 and 360x640: all its cases passed after fixing two harness mistakes |
| phone-qa | build smoke | `playwright.build.config.ts` | NOT RUN |
| e2e-smoke | `npm run test:e2e` | NOT RUN (needs live Supabase secrets) |
| db-contract-check, prod-smoke, live-qa, seo, og | | NOT RUN (secrets, live deploy) |

## Verified
- The diff is inside the owned paths, plus 3 needed extras. Code read in full.
- Red-first reproduced on main's code. 8 mutations run, results above.
- All screens rendered and measured in Chromium at 390x844 and 360x640 on the real routes with a fake Supabase. Production
  build green, and the bundle and first-load budgets green.
- Prod shapes (read only, counts): 48 live pages, 0 hidden by the new filter. at least 1 (up to 4) pages with more than one Leader (51 Leader rows on 47 pages). The
  `organiser_team_members` and `dancer_profiles` policies. The `organiser_invites` columns (no email). Invite expiry 7 days.

## Not verified
- None of the three new RPCs exists on any database. Every behaviour is judged against the pinned text and a fake.
- No real device, no real WhatsApp hand-off, no real clipboard (Copy is untested in the browser).
- No preview deploy (Lighthouse, live SSR 404 status) and no e2e/live suites.
- The claim notice was seen only on the first-sign-in path (it lands via `/finish-profile`). The complete-profile landing on
  `/account/o` is proven by unit tests only.
