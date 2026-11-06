# Brief: Raffle v2 winner page /raffle/win/:token (mockup B)
Brief-version: 2
Branch: claude/raffle-r4-winner-page
Lane: normal, Sonnet. Website (123constante/bachata-website); must not touch the P3 organiser module, onboarding files, the sign-in page and its returnTo helper, the event page, RaffleEntryDialog, calendar density-exclusion files, the shared dialog primitive, generated Supabase types, any SQL or admin file.
Serves: a raffle winner who taps the WhatsApp link, signs in, picks a free night, and gets a QR to show at the door.

Full spec (12 numbered items, owner decisions D1/D3/D4/D8/D12/D14/D15, state list, tests, Done block): `docs/briefs/raffle-r4-winner-page.md` on origin/main. Read it first. Differences now: base is `main` (R3a, `flags.raffleV2` and `src/lib/raffleWinState.ts` are already on main; Website PR #1165 has merged so the route commit is allowed); the R1 RPCs (`raffle_win_claim_link_v1`, `raffle_win_open_nights_v1`, `raffle_win_lock_v1`, `raffle_win_release_v1`) are NOT yet applied on prod, so build against route-mocked RPCs shaped by `origin/brief/raffle-r1-rpcs:docs/briefs/raffle-r1-rpcs.md` (admin repo) and list "RPCs on a real database" under Not verified.

## What main lacks
- extends: winner-column per win state, so the page spells no state words itself -- src/lib/raffleWinState.ts
- extends: `/raffle/win` listed as a client path next to /raffles -- src/components/catchallClientPaths.ts
- extends: breadcrumb id raffleWin (label "Your free night", parent raffles) -- src/lib/breadcrumbs/siteIa.ts
- the winner page itself and its pure state model (sign-in gate, expired link, choose, confirm, spot taken, locked with QR, night passed, released) -- grep: raffle-win-locked-qr
- client-side QR generator, dynamically imported inside this page's chunk only -- grep: raffle-win-qr-chunk

## Files
src/pages/RaffleWin.tsx (new)
src/modules/raffle-win/model.ts (new)
src/modules/raffle-win/data.ts (new)
src/modules/raffle-win/__tests__/raffleWin.matrix.test.ts (new)
src/lib/raffleWinState.ts
src/lib/breadcrumbs/siteIa.ts
src/components/catchallClientPaths.ts
package.json

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. `model.ts` (pure, ONE table): every state -> headline, body, actions, disabled reasons; `data.ts` maps each R1 reason code (`link_expired`, `link_not_found`, `bound_to_other_account`, `spot_taken`, `night_ended`, 28000/42501) to a state.
2. `RaffleWin.tsx`: sign-in gate via `/auth?returnTo=/raffle/win/<token>` (token case kept); week strip plus 3-column tiles, tap targets >= 44px in explicit px; one tap opens the lock sheet; a double tap sends one call; locked screen with QR of `r:<qr_token>`, countdown, Add to calendar (reuse `downloadIcs`), Directions (reuse `buildDirectionsUrl`), and "Can&rsquo;t make it? Release my spot", disabled with a reason once the night has ended (London wall clock).
3. One small pinned QR generator (record size, licence, last publish in the PR body); token never in DOM text, logs or analytics; page is noindex; flag OFF renders the not-found page.
4. Route as the separate last commit `feat(raffle): R4 route /raffle/win/:token`; screenshots at 390x844 for every state in the handover folder.

## Tests
Table-driven vitest, red first: state x render (headline, actions, disabled reasons, no copy pointing at a missing control); RPC reason -> state; double-tap lock sends one call; release disabled after the night ends (BST and GMT edge); open nights x week strip (0, 1, 3 in one week, across 3 weeks, after midnight London); returnTo keeps token case; token absent from DOM text in every state; flag OFF -> not found.

## Done when
PR `feat(raffle): R4 winner page /raffle/win/:token (mockup B)` against main, every CI job step run with a per-job table, INVENTORY.md coverage count stated, bundle budget flags off and on, and a Verified / Not verified block (Not verified: RPCs on a real database, real magic-link round trip, QR scanned by a real phone). Context cap 30%; early checkpoint push; PARTIAL handover note if cut short.
