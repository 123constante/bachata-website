# A-WEB2 handover (Website, branch claude/people-a-web2-invites)

Ticket dt_91b10b492be5. No PR opened (per brief). frontend-design skill: NOT available in this session (not in the skill list); I stayed inside the existing Tailwind/shadcn admin page styles.

## Built
1. **Invite person** on `/admin/organisers`: `InvitePerson.tsx` (new), `invitePersonApi.ts` (new; `admin_invite_person_v1` through the string-named `UntypedRpc` boundary, `searchPeople` via typed `admin_search_people_v1`, `fetchPageLeader` from `organiser_team_members.is_leader`, `fetchUpcoming` from the public feed), `invitePersonModel.ts` (new; ONE refusal table `INVITE_PERSON_COPY`, parser, message builder, blocked-reason). `AdminOrganisersPage.tsx`: 2 lines (import + `<InvitePerson organisers={list.data ?? []} />`). `inviteModel.ts` and `polish.test.tsx` untouched. Result: message with link, page URL, up to 5 upcoming events; Copy and WhatsApp buttons; shown once.
2. **Redeem**: `redeemMismatch.ts` (new) wraps `interpretRedeem` with `email_mismatch` copy (names the invite email if the answer carries `invite_email`/`email`); `InviteRedeemPage.tsx` uses it and shows a Sign out button for that refusal. **Email field prefill NOT done**: the redeem page has no invite lookup and no email field today (sign-in lives on /auth), so there was nothing to prefill. Needs an admin RPC that returns the invite email for a token.
3. **AuthCallback**: `src/lib/claimMyOrganisers.ts` (new; `claim_my_organisers_v1`, 4 s timeout, never throws, empty on any failure). After the dancer claim, a non-empty list lands on `/account/o` (also from the profile-incomplete fallback) with a toast "You now manage X. Not you? Tell us" (Tell us = WhatsApp link). The notice is a global toast because `src/modules/organiser/**` is read-only for this slice; it uses a plain link, not `ToastAction`, because importing `components/ui/toast` split a new first-load chunk (+1 request on /parties etc.).
4. **ReportProblemLink** in `contactLinks.tsx`, rendered at the end of `BentoPage.tsx` and `OrganiserProfile.tsx`.
5. **Paused/archived hidden**: `organiserPublicProfile.ts` adds `NOT_PUBLIC_LIFECYCLE` (`lifecycle_status` not in archived, rejected). Prod shape (read-only SELECT, counts only): 43 live/is_active NULL, 5 live/true; CHECK allows draft, pending_review, live, rejected, archived. **There is no "paused" lifecycle value**; paused = `is_active=false` (already filtered) or archived. `OrganiserProfile.tsx` also calls `useNoindexMeta` on the not-found state. SSR loader shares the same fetch so it 404s too.
6. **Full profile mark**: `fetchOrganiserFullProfile` (rpcLoose, any error/missing = false) and a `FullProfileMark` in `OrganiserProfile.tsx`; never the dead `is_verified` badge.

## Files outside the brief's list (needed)
- `scripts/lint-runtime-architecture.mjs`: allowlisted the two new files that read the server key `organiser_id`.
- `src/pages/__tests__/OrganiserProfileEmpty.matrix.test.tsx`: its "no WhatsApp link" selector now ignores the Report link.

## Red first
- `AuthCallbackOrganiserClaim.test.tsx` against unfixed AuthCallback: 5 failed (claimed 1/2 pages x complete/incomplete profile: no toast, wrong landing); 17 pass now (claimed 0/1/2, error, function missing, throws, malformed, nameless rows, x complete/incomplete profile, plus the Tell us link).
- `organiserPublicVisibility.test.ts` against unfixed code: archived and rejected pages with is_active NULL rendered (2 failed); 4 pass now.

## CI table (sandbox)
| job | step | command | exit |
|---|---|---|---|
| lint | chain | npm run lint | all links pass except check:integrity (script not executable here: ran `bash bin/check-integrity.sh` = ok) and lint:architecture (fixed by allowlist, now 0); eslint link informational, my files have 0 errors |
| build | production build | npm run build | 0 |
| perf | check:first-load-requests / check:bundle-budget | npm run ... | 0 / 0 |
| guards | check:rpc-typing, check:mojibake | npm run ... | 0 / 0 |
| unit | npm run test:unit equivalent | npx vitest run src/modules src/pages src/lib | all pass after the selector fix |
| e2e, phone-qa, Supabase contract checks | | | NOT RUN (browser/secrets/Docker) |

## Not verified
- **No 390x844 / 360x640 screenshots** (docs/people-arc/screens/A-WEB2 is empty) and no browser walk; no live-data walk of Invite person. Admin RPCs `admin_invite_person_v1`, `claim_my_organisers_v1`, `organiser_full_profile_v1` do not exist yet: everything is tested against a fake at the boundary only.
- Tap targets are 44px by class, contrast by existing tokens; not measured.
- Person search for teacher/DJ invites uses existing `admin_search_people_v1` (works); the Leader prefill reads `organiser_team_members` directly.

## Next
Screenshots + phone walk once A-DB1/A-DB2 land; redeem email prefill needs an invite-lookup RPC.

---

# Fix pass (ticket dt_09aede470f2b, 2026-10-20)

Brief: admin `brief/people-publishing-2026-10-20` `briefs/people-arc/FIX-A-WEB2.md` (D36, D37, D38). Review:
`docs/people-arc/reviews/A-WEB2.md` on `claude/review-people-a-web2` (finding numbers below are the review's). Same
branch, no PR. frontend-design skill: NOT available in this session either (not in the skill list); stayed inside the
existing admin-page Tailwind classes and the invite card's `BTN`/`LINK`.

## What changed, per finding
1. **Tell us 36x14 -> 50x44** (`AuthCallback.tsx`): the link has the `ReportProblemLink` classes
   (`inline-flex min-h-[44px] items-center px-2`), and the notice now stays until closed (`duration: Infinity`, was 15 s):
   it is the only way to undo a claim that skipped the confirm screen. Measured 50x44 at 390, 49x44 at 360, centre hits it.
2. **D37 routing** (`AuthCallback.tsx`): `announceClaimedOrganisers()` now only shows the notice (once) and returns the
   claim landing; the routing is `safeReturnTo` (when honoured) -> stashed path -> `/account/o` after a claim -> today's
   landing. Same order in `navigateToSignedInFallback` (`safeReturnTo ?? pending ?? claimLanding ?? "/"`). An invite
   link (`returnTo=/invite/<token>`) now lands on the invite and the notice shows there.
3. **Leader prefill** (`invitePersonApi.ts`, `InvitePerson.tsx`): `fetchPageLeader` returns
   `PageLeader = {kind:'none'} | {kind:'one', person} | {kind:'several'}`; it reads `.order('created_at').limit(2)`, and two
   rows = `several`: nobody prefilled, the note says "This page has more than one Leader. Search for the person to invite."
4. **D38 sitemap** (`app/routes/sitemap.tsx`): the organiser query adds `.not(...NOT_PUBLIC_LIFECYCLE)`, imported from
   `organiserPublicProfile.ts` (the one constant; no copy). New test `tests/sitemapOrganiserLifecycle.test.ts`.
5. **D36 email_mismatch** (`redeemMismatch.ts`): reads only `invite_email_hint`, through `safeEmailHint` (new
   `invitePreview.ts`), which refuses anything whose local part is not masked (`...` or `*`). A full `invite_email` /
   `email` is never read; no usable hint = the generic copy.
6. **Mutations that stayed green** (all now caught, table below): never-resolving RPC with fake timers (M2); the D16
   list pinned literally (M4); 44 px class asserted on the Report link (M6) and on Tell us; Full profile mark answer
   true / false / missing / error / `{}` / `"true"` / thrown (M7).
7. **Invite preview** (`invitePreview.ts`, `adminApi.ts` appended `previewOrganiserInvite`, `InviteRedeemPage.tsx`):
   signed out, the page calls `organiser_invite_preview_v1({p_token})` through the existing string-named `UntypedRpc`
   boundary, parses `{email_hint}` through `safeEmailHint`, and shows "This invite is for r...@ymail.com. Sign in with
   that email." above Sign in. Held in component state (not the query cache: the token would be the key). Missing
   function, network error, a full address or null = no line, card unchanged. No email field exists on this page, so
   nothing is prefilled (D36).
8. **Server message** (`invitePersonModel.ts`): `buildInviteMessage` takes `serverMessage` (the answer's `message`) and
   uses it in place of the expiry line; without it the line says "It works once." and states no expiry.
9. **"Hi Unnamed!"**: `PersonHit` has `firstName` (first name, else display name, else null); null greets "Hi!".
10. **Curly apostrophe**: `person's` is plain ASCII now; a test asserts every refusal string is printable ASCII.

Files outside the original list, both needed: `app/routes/sitemap.tsx` (D38 allows it) and
`src/modules/admin-organisers/__tests__/routes.matrix.test.tsx` (its signed-out case asserted "no rpc at all"; it now
asserts no RPC other than the preview, so the link is still never used signed out). `inviteModel.ts` and
`polish.test.tsx` untouched.

## Red first (on the slice head 24089ca, then green)
New/extended tests: `invitePersonFixPass.test.tsx`, `invitePersonApi.leader.test.ts`, `invitePreview.test.tsx`,
`AuthCallbackOrganiserClaim.test.tsx` (+12), `tests/sitemapOrganiserLifecycle.test.ts`.
On 24089ca: **23 failed | 34 passed (57)** (corrected in the RELEASE-A-WEB fix pass, review #18: first written as 22 | 34 (56); the review re-ran it and counted one more) and `invitePreview.test.tsx` failed to load (module absent). The failures, by finding:
- 2: `complete|incomplete profile x claimed 1 x returnTo an invite link`, `... x stashed invite link`, `... x returnTo an event page` (6 failed: landed on `/account/o`).
- 3: `fetchPageLeader > no Leader / one Leader / 2 Leaders / 3 Leaders` (4), `Leader prefill > one Leader / two or more Leaders` (2).
- 5: `email_mismatch never shows the full invite email > full invite_email only / full email only / masked hint / masked hint beside a full address` (4).
- 7: `invitePreview.test.tsx` (could not import `../invitePreview`; the page made no preview call).
- 1: `the Tell us link is a 44 px tap target and the notice stays until closed`; 8/9: the 4 `invite message` cases; 10: `no raw curly punctuation`.
- 4: `sitemapOrganiserLifecycle` on the old sitemap: `expected [ [ 'is_active', 'is', false ] ] to deep equally contain [ 'lifecycle_status', 'in', ... ]`.
After the fix: the slice tests (AuthCallback*, admin-organisers, profile, OrganiserProfile*, event-page, sitemap) **544/544**.

## Mutations (each applied alone, the targeted tests run, restored)
| mutation | result |
|---|---|
| M2 no timeout race in `claimMyOrganisers` | 1 failed, caught |
| M4 `email_in_use` removed from the table | 1 failed, caught |
| M6 Report link loses `min-h-[44px]` | 1 failed, caught |
| M7 Full profile on `!error` | 3 failed, caught |
| Tell us loses `min-h-[44px]` | 1 failed, caught |
| claim landing beats returnTo again | 3 failed, caught |
| Leader read back to `limit(1)` | 2 failed, caught |
| `safeEmailHint` accepts a full address | 3 failed, caught |
| no preview call | 5 failed, caught |
| server message ignored | 2 failed, caught |
| sitemap lifecycle filter removed | 1 failed, caught |

## Screens (`docs/people-arc/screens/A-WEB2/`, 390x844 and `-360` = 360x640, 1x, 96 colours)
Rendered on the real routes with the repo's phone harness (`playwright.phone.config.ts`, fake Supabase at the network
boundary, a temporary spec that is not committed). Measured (w x h px, `elementFromPoint` at the centre hits the control):
| screen | file | measured |
|---|---|---|
| Invite person empty | 01-invite-empty | Invite 52x44 (disabled + "Choose the person to invite.") |
| page with 2 Leaders | 02-invite-page-several-leaders | note shown, nobody prefilled |
| filled | 03-invite-filled | Change 66x44, Invite 52x44 |
| refusals: not_admin, invalid_email, email_in_use, profile_not_found, organiser_not_found, function missing | 04-invite-refusal-* | plain words, no code; missing function = "Something went wrong. Please try again." |
| success | 05-invite-success | Copy 71x44, WhatsApp 100x44, Done 50x44; message = "Hi Rosa!" + the server's "It works once and runs out on 27 October." |
| redeem, signed out, hint | 06-redeem-hint | hint above Sign in (353x44) |
| redeem, no preview function | 07-redeem-generic | no hint line |
| redeem, email_mismatch with hint | 08-redeem-mismatch-hint | "sent to r...@ymail.com"; Sign out 353x44, Home 353x44 |
| redeem, email_mismatch generic | 09-redeem-mismatch-generic | generic copy |
| sign-in claim notice | 10-signin-claim-notice | Tell us 50x44 (49x44 at 360); landed `/account/o` (no return path) |
| organiser Full profile mark | 11-organiser-full-profile-mark | 75x23, "Full profile" |
| organiser Report link | 12-organiser-report-problem | 230x44 (229 at 360) |
| event Report link (unchanged, for completeness) | 13-event-report-problem | 230x44 |

## CI (run in this sandbox on the fix-pass tree; job | step | command | exit)
| job | step | command | exit |
|---|---|---|---|
| architecture-guard | integrity | `bash bin/check-integrity.sh` (the bin script is not executable in this checkout, so `npm run check:integrity` is 126 here, as the review found) | 0 |
| architecture-guard | legacy tables / program RPCs | `npm run check:legacy-tables` / `check:legacy-program-rpcs` | 0 / 0 |
| architecture-guard | runtime architecture | `npm run lint:architecture` | 0 |
| architecture-guard | images | `AUDIT_STRICT=1 npm run check:images` | 0 |
| architecture-guard | plan hygiene canary | `npm run check:plan-hygiene:self-test` | 0 |
| architecture-guard | mojibake guard | `npm run check:mojibake` | 0 |
| typecheck | RPC typing / WallClock brand | `npm run check:rpc-typing` / `check:wallclock-brand` | 0 / 0 |
| (not a CI step) | full tsc | `npm run typecheck` | 2: 97 errors, none in touched files (same count the review recorded on the slice) |
| unit-tests | dancer-area isolation canary / check | `node scripts/check-dancer-area-isolation.mjs --self-test` / `npm run check:dancer-area-isolation` | 0 / 0 |
| unit-tests | unit (offline, LIVE_DB=false) | `npm run test:unit:offline` | 1: 5 failed / 9488, all `tests/integrityCouldNotRun.test.ts` (the TS-helper/worktree sandbox failure the review recorded on main; not re-run on main by me). 387/388 files pass. |
| unit-tests | live-db gate | `node scripts/ci-live-db-gate.mjs` | NOT RUN (needs the PR event context) |
| perf-budget | canaries | `check:bundle-budget:self-test`, `check:first-load-requests:self-test`, `check:chunk-cycles:self-test` | 0 / 0 / 0 |
| perf-budget | production build | `npm run build` | 0 |
| perf-budget | budgets | `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0 / 0 / 0 |
| perf-budget | Lighthouse / doc weight | | NOT RUN (needs a preview deploy) |
| workflow-lint | masking / notification / no-preview prefixes | `node scripts/lint-workflow-masking.mjs`, `lint-workflow-notification.mjs`, `check-no-preview-prefixes.mjs` | 0 / 0 / 0 |
| lint (local chain) | `npm run lint` | 1: only `check:integrity` (126, above); the other 19 links pass. `npx eslint` on touched files: 2 errors, both on lines this pass did not change (`InviteRedeemPage.tsx` "Cannot access refs during render" at `tokenRef.current = token`, `AuthCallback.tsx` `any` in `resolveSession`), same on 24089ca |
| phone-qa | phone suite | `npx playwright test --config playwright.phone.config.ts` | 1: 271 passed, 74 skipped, 1 failed (`keyboard (resize) > dancer setup: city search`, 390: `settled()` hydration timeout under full-suite load); re-run alone: 4/4 passed. Not a file this branch touches |
| phone-qa | build smoke | `playwright.build.config.ts` | NOT RUN |
| e2e-smoke | `npm run test:e2e` | | NOT RUN (needs live Supabase secrets) |
| db-contract-check, prod-smoke, live-qa, seo, og, real-data-verified, phone-qa-section | | | NOT RUN (secrets, live deploy, or a PR body; no PR by brief) |

## Verified
- Every finding 1-10 fixed in code, red first on 24089ca for 2, 3, 5, 7 (and 1, 4, 8, 9, 10), green after; 11 mutations all caught.
- All changed screens rendered and measured on the real routes at 390x844 and 360x640 (fake Supabase): Tell us 50x44,
  hint above Sign in, mismatch copy masked, several-Leader note, server message used, every control 44 px high.
- Production build and the bundle/first-load budgets green.

## Not verified
- `organiser_invite_preview_v1`, `admin_invite_person_v1`, `claim_my_organisers_v1`, `organiser_full_profile_v1` and the
  `invite_email_hint` field exist on no database yet: judged against D36's pinned shape and a fake only. If A-DB2 masks
  with a character other than `...` or `*`, `safeEmailHint` hides the hint (safe direction) and needs one line added.
- No real device, real WhatsApp hand-off or real clipboard. No preview deploy (no push until now), no e2e/live suites.
- The claim notice was walked only with no return path (lands `/account/o`); the returnTo / stashed-path landings are
  proven by the 8 unit rows only.
- No prod read was needed in this pass (the Leader counts are the review's: 51 Leader rows on 47 pages).

## Next
A-DB2 builds the preview RPC and `invite_email_hint` to D36; then a walk of the invite on the branch preview.
