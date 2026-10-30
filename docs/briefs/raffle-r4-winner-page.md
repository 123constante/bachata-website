# Brief R4 -- Raffle v2 winner page `/raffle/win/:token` to mockup B (Website, normal lane, Sonnet)

Context cap 30%. Push an early checkpoint commit once the state model and its matrix test exist; push again before every pause. If you reach 30% before Done, commit what you have with subject ending `PARTIAL [worker-done raffle-r4]` and a "what is left" list in `docs/handover/raffle-r4-winner-page.md`. Supabase READ-ONLY (SELECT counts only, never a write). Never `gh api`, never `--no-verify`, never print a secret or a real link token. Plain git. You NEVER merge or approve.

- **Repo:** `123constante/bachata-website`
- **Branch:** `claude/raffle-r4-winner-page`, **based on `claude/raffle-r3-board-and-raffles-page`** (R3 adds `flags.raffleV2` and `src/lib/raffleWinState.ts`, which this page extends). PR base `claude/raffle-r3-board-and-raffles-page`; the orchestrator retargets to `main` after R3 merges.
- **Model / lane:** Sonnet, Normal lane.
- Read this brief: `git fetch origin claude/raffle-briefs && git show FETCH_HEAD:docs/briefs/raffle-r4-winner-page.md`.

## Owner decisions that bind this slice (2026-10-30)
- **D1** The one-time token in the WhatsApp link binds whoever signs in first; email / Google sign-in, NO phone OTP.
- **D3** Nights offered = upcoming raffle-enabled nights, minus taken, minus nights the winner attended (the server computes this: `raffle_win_open_nights_v1` / the `open_nights` of `raffle_win_claim_link_v1`).
- **D4** QR also shown on this page (WhatsApp delivery is R1's).
- **D8** Night ended = occurrence end, London wall clock; release is impossible after it.
- **D12** Build to **mockup B: week strip + 3-column tiles, lock sheet at the bottom**, plus the five shared states: **sign-in gate, locked with QR + Release, spot just taken, night passed, released**. https://claude.ai/artifact/6etRLTgKVcdtYYT2nntH94 . Design Gate stage 2 DONE; no new mockups.
- **D14 / S4** Locked state: countdown pill, **Add to calendar** (.ics), **Directions** (maps link), Release copy "Can&rsquo;t make it? Release my spot".
- **D15 / A2** Link expires 7 days after contact; an expired link shows "ask the organiser for a new link".
- Plan "Website": sign-in gate reuses `Auth.tsx`'s `returnTo`; open nights as 3-col compact cards with explicit px tap targets; one tap -> confirm sheet -> lock; then QR + "Release my spot", disabled with a reason once the night has ended; breadcrumb id in `siteIa.ts`; behind `flags.raffleV2`.

## Read first
1. Plan `git fetch origin brief/raffle-v2-plan && git show FETCH_HEAD:docs/briefs/raffle-v2-plan.md`.
2. Admin repo (plain clone of `123constante/bachata-admin`): R1 brief `origin/brief/raffle-r1-rpcs:docs/briefs/raffle-r1-rpcs.md` section A (exact shapes and reasons: `raffle_win_claim_link_v1(p_link_token)` -> `link_expired` | `link_not_found` | `bound_to_other_account` | ok with `win` + `open_nights`; `raffle_win_open_nights_v1(p_win_id)`; `raffle_win_lock_v1(p_win_id, p_occurrence_id)` -> `spot_taken`; `raffle_win_release_v1(p_win_id)` -> `night_ended`; `raffle_my_wins_v1()`; all need a NON-anonymous JWT, anon -> 28000) and the R1 migration on `origin/claude/raffle-r1-rpcs` (`*raffle_v2_rpcs_v1.sql`; its keys win over this brief). QR payload is `r:<qr_token>` (plan data model; tickets use `t:`).
3. Website: root `CLAUDE.md`, `.claude/rules/*` for your files, `src/pages/Auth.tsx` + `src/lib/authRouting.ts` (`sanitizeReturnTo` returns the path as given, so the case of a base64url token survives -- prove it in a test), `src/lib/breadcrumbs/siteIa.ts` + `.claude/rules/breadcrumbs.md`, `src/components/catchallClientPaths.ts`, `src/modules/event-page/bento/utils/ics.ts` (`buildIcs` / `downloadIcs`) and `utils/eventActions.ts` (`buildDirectionsUrl`) -- REUSE these two, `src/integrations/supabase/rpcLoose.ts`, R3's `src/lib/raffleWinState.ts`.

## Do (numbered, each testable)
1. **State model** `src/modules/raffle-win/model.ts` (pure, ONE table): every screen state -> headline, body, primary/secondary actions, disabled reasons. States: `loading`, `signin_gate` (no session or an anonymous session), `link_expired` (expired OR not found -- one screen, R1 returns one message so nothing is revealed: "This link has expired. Ask the organiser for a new link."), `bound_to_other_account`, `choose` (state `contacted`: week strip + tiles), `no_nights` (contacted, `open_nights` empty), `confirm` (lock sheet open), `spot_taken`, `locked` (QR), `night_passed` (locked night ended / release refused with `night_ended`), `released`, `attended`, `cancelled_or_other`, `error` (retry). Extend R3's `raffleWinState.ts` with the winner-page column for each win state instead of spelling state words in the page.
2. **Data** `src/modules/raffle-win/data.ts`: the five RPCs via `rpcLoose` (no hand edits to generated types). 28000 / 42501 -> `signin_gate`. Network failure -> `error` with Retry. Every reason code from R1 section A maps to a state in item 1 (test greps the R1 migration text when available, else the brief's list).
3. **Page** `src/pages/RaffleWin.tsx` (lazy route chunk): on mount with a session, call `raffle_win_claim_link_v1(token)`; without one, the sign-in gate sends to `/auth?returnTo=/raffle/win/<token>` (encoded) and nothing else is called.
4. **Choose (mockup B)**: a week strip (one chip per week that has open nights; tapping scrolls/filters the tiles) and **3-column compact tiles** (title, London weekday + date + start time from `start_local` displayed as stored -- never Intl-convert a local-as-Z value, venue). Tap targets in explicit px (>= 44px; html font-size is ~13.5px on phones). One tap -> the **lock sheet** at the bottom: night summary, "Lock this night" + "Back". Locking sends `raffle_win_lock_v1`; double tap sends ONE call (button disabled while in flight with the reason "Locking your night&hellip;").
5. **Spot just taken**: `spot_taken` -> the state's copy, then refresh `raffle_win_open_nights_v1` and return to choose with the taken night gone.
6. **Locked (S4)**: QR of `r:<qr_token>` rendered client side, large, high contrast, with the token never printed as text; night title, date, venue; **countdown pill** to the London start; **Add to calendar** via `downloadIcs`; **Directions** via `buildDirectionsUrl` (hidden with a reason when the night has no address); **"Can&rsquo;t make it? Release my spot"** -> confirm -> `raffle_win_release_v1` -> `released`. When the night has ended (London wall clock, same rule as D8) the Release button is disabled with the reason "This night has passed".
7. **QR library**: no QR GENERATOR is in `package.json` today (`jsqr` only reads). Add ONE small, dependency-free generator, dynamically imported only inside this page's chunk, pinned exact version; record the choice (size raw/gz, licence, last publish) in the PR body as the ticket door handover did for jsQR. Run `npm run check:bundle-budget` flags off and `VITE_ENABLE_RAFFLE_V2=true`; no other route may grow.
8. **Expired-link screen (A2)** and **bound-to-other-account** screen: say what the person can do ("Ask the organiser for a new link" / "Sign out and sign in with the account you used first", with a sign-out button).
9. **Breadcrumbs**: add `raffleWin` (label "Your free night", parent `raffles`) in `siteIa.ts`; the page passes `buildBreadcrumbs('raffleWin', ctx)` to `<GlobalLayout>`. Add `/raffle/win` to `catchallClientPaths.ts` the way `/raffles` is listed.
10. **No token leakage**: the token is never logged, never sent to analytics or Sentry breadcrumbs as part of a URL you build, and the page sets `noindex` (see Open question 1). Test: render each state and assert the token string does not appear in the DOM text.
11. **Tests (vitest)**: table-driven matrix: every state from item 1 x render (headline, actions, disabled reasons, no copy pointing at a control not on screen); RPC reason -> state; lock double-tap = one call; release disabled after the night ends (fake clock, London rule incl. a BST/GMT edge); open nights x week strip grouping (0, 1, 3 nights in one week, nights across 3 weeks, a night after midnight London); `returnTo` keeps the token's case; flag OFF -> the route renders the not-found page.
12. **Route -- separate small commit, flagged.** Everything above lands WITHOUT touching `src/components/AnimatedRoutes.tsx`. Then, as its own last code commit `feat(raffle): R4 route /raffle/win/:token`, add the lazy route behind `flags.raffleV2` (flag off -> the same not-found element the other flag-gated routes use). **Before writing that commit check that Website PR #1165 has merged** (`git fetch origin main && git log origin/main --oneline | grep '#1165'`). If it has NOT merged: do not touch `AnimatedRoutes.tsx`; write the exact diff into the handover and the PR body under "Route commit waiting on #1165". If it has merged: make the commit and say so in the PR body under the same heading, so the reviewer looks at it.

## May touch
`src/pages/RaffleWin.tsx` (new), `src/modules/raffle-win/*` (new), `src/lib/raffleWinState.ts`, `src/lib/breadcrumbs/siteIa.ts`, `src/components/catchallClientPaths.ts`, `src/lib/seo/buildSeoForRoute.ts` (a `raffleWin` noindex entry only), `package.json` + lockfile (the one QR generator), `src/components/AnimatedRoutes.tsx` ONLY in the item-12 commit, tests, `docs/handover/raffle-r4-winner-page*`.

## Must NOT touch
- `src/modules/organiser/p3/*` and onboarding files (read `teamModel.ts` only if you need it).
- `src/pages/Auth.tsx` and `src/lib/authRouting.ts` behaviour (reuse `returnTo`; if it cannot carry the token, stop and record it).
- The event page, `/raffles`, `RaffleEntryDialog` (R3's).
- Calendar density-excluded files, `src/components/ui/dialog.tsx` (use the existing sheet/drawer primitive for the lock sheet).
- Generated Supabase types; any SQL or admin file.
- Files over 2 KB go through `scripts/safe-edit.py` / `scripts/safe-write.py`.

## Design gate (visible change)
1. Stage 1-2: DONE (D12, mockup B + the five shared states + S4). Build to it; any deviation is listed with its reason.
2. Stage 3: existing tokens (raffle brass palette); compact density; QR on a white quiet zone whatever the theme.
3. Stage 4: screenshots at 390x844 in `docs/handover/raffle-r4-winner-page/` for EVERY state in item 1 (dark and light where the site supports both), each next to its mockup frame with one line of differences.
4. Stage 5 critique and stage 6 walk are the orchestrator's (R6).

## Done =
- PR titled `feat(raffle): R4 winner page /raffle/win/:token (mockup B)`, base `claude/raffle-r3-board-and-raffles-page`, body with every template section, including:
  - **Verified on real data**: *Shapes surveyed* (read-only counts on prod `stsdtacfauprzrdebmzg`: upcoming nights per week over the next 60 days on raffle-on series (max/median per week -- drives the strip and tile count), nights with no venue address, nights starting after midnight London, nights crossing a BST/GMT change in range; once R0/R1 are applied also `raffle_wins` by state). Map each shape to a matrix row. *Checks run*: every step of every job in `.github/workflows/*.yml` that applies (at least `unit-tests`, `typecheck`, `architecture-guard`, `e2e-smoke`, `perf-budget`/bundle budget flags off and on, `seo-check`, `integrity` incl. `check:images` with `AUDIT_STRICT=1`, `npm run lint`, `npm run pre-ship`) as a per-job table; browser walk at 390x844 with route-mocked RPCs shaped like prod (if you add an e2e spec, add it BY NAME to `test:e2e`). *NOT verified*: at least the RPCs on a real database (not applied), a real magic-link sign-in round trip with the token, the QR scanned by a real phone camera.
  - **Phone QA**: Sizes checked (390x844, 360x640), Walked, Not verified.
  - **Route commit waiting on #1165** (item 12).
- Handover `docs/handover/raffle-r4-winner-page.md`.
- Final commit subject ends `[worker-done raffle-r4]` (or `PARTIAL [worker-done raffle-r4]`).

## Open questions for the owner (plan silent; do not decide in code beyond the reversible default named)
1. **noindex / privacy** of `/raffle/win/:token`: the plan does not say. Default built: `noindex`, no token in any log. Confirm.
2. **`attended` and `cancelled` states** are not among the five mockup states. Default copy: attended -> "You went to <night>. Enjoy, and enter again any time."; cancelled -> "This win was cancelled. Ask the organiser if this is a mistake." Owner to confirm wording.
3. **Changing a locked night**: the plan has release (back to the pool, D3 eligibility) but no "swap night". Confirm that release is final and the winner does NOT get to choose again with the same link.
4. **Countdown pill granularity** ("in 3 days" vs "2d 4h 10m") -- mockup B decides if it shows one; else default "in N days" / "tonight at 21:00".
5. **Multiple wins**: `raffle_my_wins_v1` exists; should the page (or an account page) list a person's other wins? Default: no; the page shows only the link's win.
6. **QR library choice** adds a dependency; confirm the owner is fine with one new runtime dependency in a lazy chunk.
