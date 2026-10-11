## Summary
- **Supersedes #718 and #717.** Everything from #718 stays: layout D (a finished dancer profile is an account-menu entry on the organiser home), the one shared `accountRouting` mapping, the dancer home, finish-to-rate, the dead-link guard and the `/finish-profile` background seam fix. What changes is the owner decision of 2026-10-11, which replaces #718's skippable row: **dancer first, then organiser, for everyone.**
- **What changed?**
  - **One shared guard**, `src/components/account/DancerProfileGate.tsx`. It is a route wrapper mounted inside AuthGuard in each gated lazy chunk: `pages/Account.tsx`, `organiser/shell/OrganiserRoutes.tsx` and `admin-organisers/InviteRedeemPage.tsx`. It reads `dancerGate()` from `lib/accountRouting.ts` (the one mapping). While the dancer profile is unfinished, it replaces the page with `/finish-profile?returnTo=<the page they wanted, query and hash kept>`.
  - **Gated routes** (`isDancerGatedPath`):
    - `/account` and `/account/dancer`;
    - `/account/o` and everything under it: the organiser home, onboarding (claim / request / create), events, dates, team and profile;
    - the old `/account/new|series|team` links, which redirect into `/account/o`;
    - `/invite` and `/invite/:token`.
  - **Not gated**:
    - the public site (calendar, event pages, RSVPs, the rating card, profiles and search);
    - `/account/attendance`, the person's own RSVPs;
    - `/finish-profile`, `/auth*` and `/admin/*`.
  - **Which shapes are gated**, decided explicitly in `dancerGate`:
    - no row: `no_profile`, gated;
    - **archived with no live profile**: `no_profile`, gated. `_dancer_profile_id_for_account_v1` never resolves an archived row, so it is treated exactly like no row;
    - empty stub and partly filled: `incomplete`, gated;
    - complete: never gated;
    - **check failed: gated**. This fails CLOSED, onto the Finish screen's "Try again". The banner and rating card still fail open;
    - loading: a skeleton.
  - **Gated Finish screen**. `/finish-profile` is gated when `returnTo` is a gated destination (`isDancerGatedTarget`).
    - It says **"Finish your dancer profile first, then you can set up your organiser page."**
    - It has **no "Skip for now"**, in the form or in the error state.
    - When there is no profile to fill in, it offers "Message us on WhatsApp" and "Back to the calendar", never a Continue that would loop.
    - Saving the last field goes to `returnTo`.
    - A plain visit (the rating card, the banner, the post-sign-in hop to a public page) keeps Skip, exactly as before.
  - **Removed**: `DancerProfileRow` ("Finish your dancer profile" / Skip on the organiser home), its session-storage skip, and `accountView().unfinishedRow`. The gate makes all of them unreachable.
  - **Sign-in landing**. `landingPathAfterAuth` is unchanged, and every organiser destination it returns is a gated route. So an organiser-intent sign-up goes from sign-up to the Finish screen (returnTo `/account/o`), then to organiser onboarding. This is proved in the matrix ("an organiser-intent sign-up lands on the gate, then continues to organiser onboarding").
  - **Public organiser page claim card**. A claim or request with an unfinished profile goes to `/finish-profile?returnTo=<page>?claim=1` and never calls the server. It reads the completion that AppChrome already publishes (`ProfileGateContext`), so there is no second read. The existing claim intent re-runs the claim on the way back.
  - **Server refusal handled**. `PROFILE_INCOMPLETE_CODE = 'profile_incomplete'` is one constant in `lib/accountRouting.ts`. Its comment says **the admin PR must raise this exact string**; it is the same string the rating RPC already raises. I could not read the admin repo: this session is scoped to the Website repo only.
    - `selfServeErrorCopy` maps the code to `next: 'finish_profile'`.
    - When a claim, request or create call returns it, the onboarding sheet and the public claim card send the person to the gated Finish screen, with returnTo = where they were. They never see a raw error.
- **Why was it needed?** Owner decision 2026-10-11: every signed-in account must finish the dancer profile (all four fields: first name, city, dance role, photo) before it reaches the organiser home, the organiser onboarding or any `/account/o*` page. The order is dancer profile first, then organiser.
- **Notable decisions**:
  - **The gate fails closed on a failed check.** A gate that opens on a network blip would not be a gate, and the screen it lands on offers "Try again".
  - **`/account/attendance` stays open.** It lists the person's own RSVPs, which must stay usable.
  - `useSeriesLevelRating` keeps its own `PROFILE_INCOMPLETE_ERROR` literal. Importing `accountRouting` there cost `/event/:id` one more first-load chunk (the ratchet caught it: 48 > 47). `selfServe.test.ts` pins the two strings equal.

## Scope
- [x] 24 files changed against #718 (+838 / -305).
  - New: `DancerProfileGate.tsx`, `DancerFirstGate.matrix.test.tsx` (it replaces `AccountLayoutD.matrix.test.tsx`; git shows it as a rename) and `dancerFirst.refusal.test.tsx`.
  - Five existing specs that render gated routes now say the person's dancer profile is finished. They are not about the gate. Those specs are `fixup1`, `routes.matrix`, `shell`, `OrganiserProfileContactEdit` and `OrganiserProfileEmpty.matrix`.
  - `tests/e2e/helpers/organiserFake.ts` answers the gate's reads with a finished profile by default (`dancerProfile: 'none'` opts out).
- [x] No RPC, migration, `types.ts`, budget or workflow is touched. The template's dancer-public-profile and privacy items do not apply: no public profile read or render changes, and no phone or whatsapp is read.

## Visibility & Access
- [x] Every gated page is signed-in only and sits behind `VITE_ENABLE_ORGANISER_SELF_SERVE`, which `e2e-smoke.yml` notes is **OFF in production**. With the flag off, nothing here is reachable in prod except the Finish screen copy and the claim-card gate on the public organiser page.

## UX & System Consistency
- [x] The gated page explains itself, there is no Skip in gated mode, and no copy points at a control that is not on screen. All three are asserted per cell. Tap targets are px-sized, and the browser walk found no control under 44px on the gated form.

## Effect on requests reaching Vercel
- **Expected: none.** No new API, edge route, SSR loader or image.
- `check:first-load-requests`: all 6 prerendered route pins unchanged.
- Chunk and puller ratchets: every route is within its allowance. No allowance was raised.
- `DancerProfileGate` builds as its own small lazy chunk, shared by Account, OrganiserRoutes and InviteRedeem. That is one extra JS request, only on those signed-in lazy routes (none is a budgeted first-load route), and it is served from Vercel's static CDN.
- The gate's reads (`_my_dancer_profile_id_v1`, `profile_complete_v1`) go to Supabase, not Vercel, and reuse the cache the site chrome already fills.

## Validation Evidence
- [x] `npm run build` OK.
- [x] `check:bundle-budget` and its self-test: pass. No budget raised, and Account is still a lazy chunk (`Account-*.js`).
- [x] `check:first-load-requests` and its self-test: pass.
- [x] `tsc --noEmit -p tsconfig.app.json`: 95 errors, the same set as `origin/main` (95). The only textual difference is one pre-existing TS2339 whose union reads "47 more" instead of "44 more", from #718's breadcrumb entries.
- [x] `npm run lint`: chain green, 16/16 links. The trailing eslint is informational. On the touched files, eslint findings are identical to #718's, and the new files are clean.
- [x] `npm run test:unit:offline` (`env -u NODE_PATH`, placeholder Supabase env): **244 files, 4738 passed, 15 skipped, 0 failed.** `test:unit:timing`: 65 passed.
- [x] `npm run test:e2e` (the CI e2e-smoke list, CI env, flag on): **90 passed.**
- [x] architecture-guard steps: integrity, legacy-tables, legacy-program-rpcs, lint:architecture, `check:images` (also with `AUDIT_STRICT=1`), image-widths, plan-hygiene self-test, workflow-artifact-policy, mojibake self-test and prove:entry-point. All pass.
- [x] typecheck workflow: `check:rpc-typing` and `check:wallclock-brand` pass.
- [x] `PR_BODY="$(cat docs/pr-body-dancer-home-v3.md)" node scripts/check-pr-real-data-verified.mjs` passes.
- [x] **The new matrix run against #718 (v2) first**: 52 of 113 failed there. Every failure is a gating cell:
  - for each of the 12 unfinished cells ({no row, stub, partial, archived} x {no organiser, organiser, open request}), these four checks failed on v2:
    - `/account` gated;
    - `/account/o` gated with no skippable row;
    - `/account/dancer` gated;
    - returnTo round-trip;
  - plus 4 entry edges: organiser-intent sign-up, role-less sign-in of an unfinished organiser, deep `/account/o/events/new?o=` link, and old `/account?from=email` link.
  - Every complete-profile cell and every same-fact cell passed on v2.
  - On this branch: **113/113 pass.**

## Verified on real data
- Shapes surveyed: read-only counts on prod `stsdtacfauprzrdebmzg`, re-surveyed 2026-10-11. `dancer_profiles` 166 rows:
  - 52 no first name, 73 no city, 153 no dance role, 68 no photo;
  - 15 archived;
  - 11 complete and live.
  
  Auth accounts: 16. Of those, 2 resolve no live dancer row, 4 have a complete live profile, and the other 10 are unfinished. **So 12 of the 16 existing accounts would meet the gate the moment the flag is on.** The owner said nobody has signed up yet except them, but 16 accounts exist (test, admin or owner). It is worth checking which one is the owner's before flipping `VITE_ENABLE_ORGANISER_SELF_SERVE`.
- Checks run: the matrix, the refusal tests, every CI step above and a 390x844 browser walk, as follows.
  - The table-driven matrix `DancerFirstGate.matrix.test.tsx` covers {no dancer row, empty stub, partial, complete, archived} x {no organiser, organiser, open access request}. It goes through the real route entries (the lazy pages' default exports, guards included) against a fake backend shaped like the prod reads. Per cell it asserts:
    - where `/account`, `/account/o` and `/account/dancer` land;
    - that the gated page explains itself and has no Skip;
    - that complete profiles never visit the Finish screen;
    - that returnTo round-trips;
    - that the same completeness fact appears on the dancer home, the Finish screen and the rating card;
    - that the event page stays open.
    
    It also covers the sign-in landing and deep-link edges.
  - `dancerFirst.refusal.test.tsx` covers the `profile_incomplete` refusal on claim and request, in the sheet and on the public card, plus the claim card's client gate for incomplete, no_profile and error.
  - Every CI job step listed above was run.
  - **Playwright browser walk** (`tests/e2e/dancer-home.spec.ts`, 14/14) at 390x844, plus 390x600 for the layout checks:
    - (1) **Signed-in unfinished organiser hitting `/account/o`**: lands on `/finish-profile?returnTo=%2Faccount%2Fo` with the gate sentence and no Skip. Picking the dance role and saving lands back on `/account/o`: organiser home, no row, account menu present, 1 save sent.
    - (2) **Complete organiser**: `/account/o` is never gated. The account menu opens `/account/dancer`.
    - (3) **Brand-new account** (stub, every field empty): the account icon goes to the gate, which asks for all four fields. A part-save stays on the gate and names what is left.
    - Also: a deep `/account/o/team` link keeps its address through the gate, public pages stay open with an unfinished profile, and the non-gated `/finish-profile?returnTo=/event/...` keeps Skip.
    - On every layout check: no horizontal scroll, one background source and no control under 44px.
- NOT verified: the server side, a real phone and a few paths, as follows.
  - the admin PR's server refusal (it does not exist yet). The Website side is tested only against the agreed string `profile_incomplete`; I could not read the admin repo to confirm its name;
  - the gate on a real phone or against the real Supabase project (all browser walks used the route fakes);
  - the brand-new account's photo upload in a browser (AvatarUpload to storage is not faked in e2e; the unit matrix covers saving all four fields);
  - which of the 16 prod accounts is the owner's, and whether it is complete;
  - `check:doc-weight` and Lighthouse (they need a Vercel preview);
  - `/code-review` was not run (it needs the owner to type it);
  - the invite page's gate was checked through the existing invite specs with a finished profile, not walked with an unfinished one.
