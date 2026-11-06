# Brief: Raffle v2 shared door scanner /door/:occurrenceId (offline list + sync queue)
Brief-version: 2
Branch: claude/raffle-r5-door-scanner
Lane: careful, Opus. Website (123constante/bachata-website); must not touch anything under the P3 organiser module (import only), onboarding files, R3/R4 files, calendar density-exclusion files, the shared dialog primitive, generated Supabase types, any SQL or admin file, or add a scanner dependency.
Serves: door staff of a raffle night, who scan winners' QR codes, see the name first, and keep working with no signal.

Full spec (11 numbered items, decisions D5/D7/D8/D14, reuse list, tests, Done block): `docs/briefs/raffle-r5-door-scanner.md` on origin/main. Read it first. Differences now: base is `main` (`src/lib/raffleWinState.ts` is on main; Website PR #1165 has merged so the route commit is allowed); the R1 RPCs `door_list_v1` and `door_scan_v1` are NOT yet applied, so build against mocked RPCs shaped by `origin/brief/raffle-r1-rpcs:docs/briefs/raffle-r1-rpcs.md` section C (admin repo) and list "RPCs on a real database" under Not verified. Reuse `camera.ts` and `model.ts` from `the ticket door module` by import, unchanged.

## What main lacks
- extends: `door` flag (VITE_ENABLE_DOOR, default OFF) beside the other flags -- src/lib/featureFlags.ts
- extends: door column on the win-state table (valid / used / void) -- src/lib/raffleWinState.ts
- extends: `/door` listed as a client path -- src/components/catchallClientPaths.ts
- payload parser for `r:` raffle and `t:` ticket tokens, case kept for raffle -- grep: decodeDoorPayload
- IndexedDB saved list scoped per user and occurrence, and the offline sync queue -- grep: door_list_v1_saved
- the Door page with the name-first card, offline badge and "Type the name instead" search -- grep: door-offline-badge

## Files
src/pages/Door.tsx (new)
src/modules/door/model.ts (new)
src/modules/door/data.ts (new)
src/modules/door/offlineStore.ts (new)
src/modules/door/syncQueue.ts (new)
src/modules/door/__tests__/reuse.contract.test.ts (new)
src/lib/featureFlags.ts
src/lib/raffleWinState.ts
src/components/catchallClientPaths.ts

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. `model.ts` (pure, ONE table, mockup S3): result -> band, name-first headline, vibration, keep-scanning, actions, for admitted, already_used, voided, unknown, ticket_not_built, not_allowed, no_signal and offline_admitted / offline_used / offline_voided; plus `decodeDoorPayload` and `data.ts` wrapping the two RPCs via `rpcLoose` (refusal -> not_allowed, signed out -> sign-in link, other failure -> offline path).
2. `offlineStore.ts` and `syncQueue.ts`: "Save tonight's list" stores the reply with `savedAt` and user id (another account sees nothing; IndexedDB unavailable -> disabled with a reason); offline scans resolve against it, mark the row used locally, queue the payload, replay in order on `online` and on mount; `already_used` after an offline admit counts as synced; voided or unknown on replay -> a visible "needs a look" list; counters for saved, pending, synced.
3. `Door.tsx`: full-screen, offline badge, S3 card, Scan next, "Type the name instead" over saved names (accent-insensitive prefix, confirm before admitting), camera dead opens the list; a ticket payload shows the `ticket_not_built` card and never calls `ticket_check_in_v1`; tap targets >= 44px.
4. `reuse.contract.test.ts` importing every reused symbol; route as the separate last commit `feat(raffle): R5 route /door/:occurrenceId` with a noindex entry; screenshots at 390x844 in the handover folder.

## Tests
Table-driven vitest, red first: result x card; payload parsing with real-shaped fake tokens (base64url mixed case, 64 hex, URL forms, spaces, uppercase hex, hex-only base64url stays raffle only with `r:`); online scan; offline save -> scan -> offline_admitted -> scan again offline_used -> online replay -> synced; voided on replay -> needs a look; IndexedDB unavailable; other user sees no list; name search; camera dead x3; tracks stopped on unmount; flag OFF -> not found.

## Done when
PR `feat(raffle): R5 shared door scanner /door/:occurrenceId` against main, every CI job step run with a per-job table, INVENTORY.md coverage count stated, and a Verified / Not verified block (Not verified: RPCs on a real database, a real phone camera scan, a real offline airplane-mode run). Context cap 30%; early checkpoint push; PARTIAL handover note if cut short.
