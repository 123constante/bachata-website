# Review r3: Website PR #1086 (ambassador A1 pending queue, option B) at head `12aa2bb`

Reviewer: independent model (Fable), zero prior context, read-only on source. Diff reviewed: `git diff origin/main...origin/claude/ambassador-a1-build` (16 files, +1946/-6; merge base `d14a58c`, so #1094 is in the branch). Read in full: the six module files, `AnimatedRoutes.tsx`, `siteIa.ts`, `catchallClientPaths.ts`, `flagOff.test.ts`, the e2e spec, the matrix test case list, `PageTransition.tsx`, `ScrollToTop.tsx`, `lazyWithRetry.ts`, `useNoindexMeta.ts`, the design record and fix handovers, the r2 review and the walk. Live (read-only, prod `stsdtacfauprzrdebmzg`): bodies of `admin_list_pending_review_v1`, `_moderate_entity`, `_is_city_ambassador`, `_actor_is_party_to_target_p5`; `pg_policies` on `entity_members`; counts only. Local, on a worktree at `12aa2bb` (and on `main` where stated): unit tests, the e2e spec three times, a production build and the bundle budget on both heads, and the cold-Vite flake on both heads. Browser artefacts not committed.

This is the one independent review of this round (stopping rule from the brief). No source edits, no DB writes.

## Verdict: PASS with should-fix

Nothing blocks merge. The route is dormant on prod (0 city ambassadors, 0 pending organisers, 0 pending series, 61 `entity_members` rows all organiser-side), the gate reads the same table and three values the RPCs test, the r2 overlay BLOCK is fixed and the e2e really asserts viewport boxes, the fix-round-4 "test, not page" call is right, and the /app first load is smaller than `main`'s. Two should-fix items (F1, F2) are worth closing before the arc ends; the rest are nits.

## Findings, most severe first

### F1. A queue over 100 in one city hides the OLDEST items behind "Show more", and the "Oldest waiting" bar is wrong until they load

- Where: `src/modules/ambassador/AmbassadorQueuePage.tsx:68-82,106` and `ambassadorApi.ts:33-47`; live `admin_list_pending_review_v1` ends `ORDER BY q.submitted_at DESC NULLS LAST LIMIT ... OFFSET ...`.
- What is wrong: the RPC pages newest first; the page loads page 0 (the 100 NEWEST), then `sortOldestFirst` reorders what it has. The 101st-and-older items, the ones the age bar and the oldest-first design exist for, are on page 1 and only arrive after "Show more". The list header reads "Oldest waiting 2 days" over a queue whose oldest item has waited 30; the 100-cap copy says "This shows the first 100 in Bristol", which an ambassador reads as the oldest 100.
- Concrete failing input: 101 pending rows in Bristol, one submitted 30 days ago, the rest within 2 days. Open `/ambassador`: 100 rows, age bar "Oldest waiting 2 days", no amber chip anywhere. Tap "Show more": the 30-day item appears at the TOP and the bar jumps to 30.
- Severity: fix before arc end. Not blocking: prod has 0 pending rows and one city, and the matrix test at `queue.matrix.test.tsx:101` pins paging but not cross-page order.
- CONFIRMED by reading the live function body and the page; not run in a browser.
- Cheapest fix without touching the RPC: load pages until one is not full BEFORE rendering the list (the loop at `AmbassadorQueuePage.tsx:75` already exists; drop the `pages.length < shown` bound and the "Show more" control), or make "Show more" copy say "100 newest". The real fix is an ascending order (or `p_order`) on the RPC in the admin repo.

### F2. A target that is gone or moved city reads as "no access" and leaves the item on the list with a "Try again" that cannot succeed

- Where: `ambassadorModel.ts:157-174` (`decisionError`) against the live `_moderate_entity`: for a non-admin, `v_from IS NULL OR NOT _is_city_ambassador(v_city, v_actor)` raises `not_authorised` BEFORE `target_not_found` is reachable. So an ambassador never receives `target_not_found`; a deleted target, or one whose city was edited out of their scope after the list loaded, comes back as `not_authorised`.
- What the page does: `kind: 'access'`, sheet stays open with "You do not have access to decide this one. Ask an admin to check your city." and a "Try again" button; the row stays in the list until a refetch (60 s stale, focus) drops it.
- Concrete failing input: list loaded; an admin deletes the pending organiser profile (or the organiser moves it to Bath); ambassador taps Approve, Yes. Expected the gone path ("taken off your list"); gets "no access".
- Severity: fix before arc end (copy and list state; no data harm). CONFIRMED from the function body; not reproduced live (no ambassador session exists).
- Fix: on an `access` error for an item the list RPC served this session, treat it like `gone` but with honest copy ("This one has changed and is no longer yours to decide. It has been taken off your list."), and invalidate the queue.

### F3. A party item already decided by someone else shows "Needs an admin", not "no longer waiting"

- Where: live `_moderate_entity` checks `self_approval_not_allowed` before `not_pending_review`; the page maps party first (`ambassadorModel.ts:159`).
- Failing input: an item the ambassador is party to, approved by an admin after the list loaded; tap Approve, Yes: row turns "Needs an admin" and stays until a refetch.
- Severity: nit. CONFIRMED from the function body. Server ordering; nothing the page can tell apart.

### F4. A deep link to an item outside the ambassador's cities says "It may have been decided already"

- Where: `AmbassadorQueuePage.tsx:220-228` (`review-gone`). The list RPC filters per row by `_is_city_ambassador`, so a Bristol item is simply absent for a Bath ambassador and the copy guesses "decided".
- Severity: nit (A4 links the page; nobody types these URLs). CONFIRMED by reading. Neutral copy ("This one is not in your queue") fixes it.

### F5. A failed background refetch is silent, and ages freeze at mount

- Where: `AmbassadorQueuePage.tsx:54` (`now` captured once), `:195` (`queue.isError && items.length === 0` only). App defaults: 60 s stale, refetch on focus, one retry.
- Failing input: tab left open overnight, network drops; the list, the "Waiting N days" chips and the amber marks are yesterday's with no hint. Severity: nit (known under fix-round-1 "Not done"). CONFIRMED by reading.

### F6. Raw `·` in a test string

- `src/modules/ambassador/__tests__/queue.matrix.test.tsx:60` (`'Oldest waiting 9 days · oldest first'`). Only non-ASCII character left in the module, spec or tests; the module itself is clean (`&middot;`, `&hellip;`, `…`). Severity: nit; `check:mojibake` passes because it is UTF-8 today.

## The brief's judge items

### 1. Data source and gate: CONFIRMED

- `fetchCityScopes` (`ambassadorApi.ts:15-28`) reads `entity_members` with `entity_type = 'city'`, `member_role = 'ambassador'`, `user_id = <auth user>`, then `cities` by id. Live policy `entity_members_select`: `_self_serve_is_admin() OR user_id = auth.uid()`; `cities` is public-read. The list RPC's own gate is the identical three-column test (`EXISTS ... em.user_id = v_actor AND em.member_role = 'ambassador' AND em.entity_type = 'city'`), then `_is_city_ambassador(q.city_id, v_actor)` per row. One source of truth.
- Who sees what: a stranger (signed out) never reaches `Queue`: `AuthGuard` redirects to `/auth?mode=signin&returnTo=/ambassador`. A dancer or organiser with no ambassador row: "No access to this queue" with "ask an admin to add you" and "Back to the site"; the queue RPC is never called (matrix case `:145`). An admin with no ambassador row: the same no-access state (RLS lets them read every row, but the page filters on their own `user_id`); the RPCs would serve them (known, fine for A1). An ambassador of another city: their own city's queue only; the RPC returns no rows outside their cities whatever `p_city_id` says, and the page only asks for its own cities. The list body never renders without at least one scope row.
- Counts today: 0 ambassadors, so the page is "No access" for every account on prod.

### 2. Overlay geometry (the r2 BLOCK): CONFIRMED fixed, and the e2e asserts real viewport boxes

- `SheetShell` (`DecisionSheets.tsx:30-43`) and the toast (`AmbassadorQueuePage.tsx:255-261`) are `createPortal`-ed to `document.body`, so `.route-shell`'s `filter: blur(0px)` is no longer their containing block. Approve's Cancel focus is a ref plus `focus({ preventScroll: true })` (`:72`); the Reject textarea the same (`:96`).
- The spec's third test (`ambassador-queue.spec.ts:127-183`) runs under `page.clock.install({ time: NOW })` (flowing), and `coversViewport` asserts the overlay box has `x <= 0`, `y <= 0`, right `>= 390`, bottom `>= 844`; `fullyOnScreen` asserts `y >= 0` and bottom `<= 844` for the confirm button (twice), the reject submit, "Back to the list" after the refusal, and the toast; `scrollY` is asserted unchanged across every open and after the refusal. Those are viewport boxes, not shell boxes. The r2 mutation record (toast portal reverted: bottom 1038, red) stands.
- Local: 12 of 12 passes (`--repeat-each=3 --workers=1`, chromium 390x844).
- Not covered: the Reject sheet with the iOS keyboard open (the visual viewport shrinks; the submit button may sit under the keyboard until it is dismissed). Not a finding, a Not verified.

### 3. Actions: CONFIRMED

- `approveEntity` / `rejectEntity` send `{ p_target_type, p_target_id }` and `{ ..., p_reason: reason.trim() }` to `admin_approve_entity_v1` / `admin_reject_entity_v1`; the spec pins the exact bodies (`:107-110`).
- Reason: client refuses empty and under 10 characters without a request (`checkReason`, matrix `:356`, spec `:97-102`); the server raises `reason_required` independently.
- Double tap: both buttons are `disabled={busy}` and React flushes the `isPending` render synchronously inside the click event; a second request would hit `not_pending_review` and take the gone path anyway. Idempotent at the server (`v_from <> 'pending_review'`).
- Self-approval: `self_approval_not_allowed` adds the key to `party`, closes the sheet, the review bar swaps the buttons for the party note, the row gets the "Needs an admin" chip, and the item stays listed (matrix `:392`, spec `:114-125`).
- Refusal, network, stale: `other` keeps the sheet open with "Try again" and "Nothing was changed" (true unless the request succeeded and the response was lost, the known F7 half-state); `gone` takes the item off and says so; `auth` offers "Sign in" to `buildSignInHref(<this screen>)`. See F2 for the one mapping the server makes impossible to get right.
- Submitter email: the live RPC emits `CASE WHEN v_is_admin THEN u.email ELSE NULL END`, so an ambassador never receives it on the wire; `parseQueueRow` drops it anyway, and the spec asserts the page content never contains it. Never shown, and for the ambassador path never fetched.

### 4. Scroll after Back (fix round 4): no real-user defect found. The test-only fix is right. PLAUSIBLE on a device, CONFIRMED in Chromium

- Restore code (`AmbassadorQueuePage.tsx:116-134`): `openReview` saves `window.scrollY` on tap; entering the review scrolls to 0; leaving it restores in a layout effect plus one rAF pass. The list stays mounted under `hidden`, so its height is back in the same commit the restore runs in. `ScrollToTop` (mounted first in `AppShell`) also runs a layout `scrollTo(0, 0)` on the pathname change; it commits before `Queue`'s effect (tree order), so the restore wins the same frame, and `history.scrollRestoration = 'manual'` (`main.tsx`) means the browser does not fight it on popstate. On iOS Safari the same primitives apply (`scrollTo` in a layout effect, manual restoration); not walked on a device.
- The instrumented claim: the scroll test runs under `setFixedTime` (fakes `Date` only, so the 0.25 s framer `x: 30 -> 0` enter still plays), the stubs answer instantly, so rows exist while the row is still moving; Playwright's actionability retry then calls `scrollIntoView` with a rotating `block`, which is exactly the 0 / 357 / 643 the worker saw. No browser scrolls on a tap. A real list arrives after three sequential round trips (members, cities, RPC) and a human does not scroll-then-tap inside 250 ms of mount. Three local runs green; the mutation (restore to 0) is recorded red in the handover.
- One wrinkle, not a defect: the rAF second pass exists because "one restore landed short"; with `ScrollToTop` ordered first, I could not construct the case it rescues, so it may be covering a Playwright-only timing. Harmless.

### 5. Bundle and flag-off: CONFIRMED

Built both heads here (`npm run build`, then `check:bundle-budget`):

| | `main` d14a58c | PR 12aa2bb |
|---|---:|---:|
| dancer-app first load | 373.9 KB / 49 files | 373.6 KB / 49 files |
| `AnimatedRoutes` chunk (gzip) | 6,059 B | 5,790 B |
| `P3Routes` references in that chunk | 3 | 0 |
| `AmbassadorQueuePage` chunk | n/a | own chunk, not in the first-load graph |

Every budget and ratchet `[ok]` on both. The route itself still costs about 65 B in `AnimatedRoutes` (the worker's number; cannot be moved into the lazy module); it is paid for by the P3 drop, which is a one-off offset the next route will not have. `/* @__PURE__ */` on `lazyWithRetry(...)` is semantically safe: `lazyWithRetry` only calls `React.lazy`, the factory (and `safeDynamicImport`) runs on first render, so dropping an unused result changes nothing observable; with the flag on the result is used and kept (flag-on build not run, as the worker also says). The `flagOff.test.ts` regex accepts exactly `/* @__PURE__ */ ` as an optional group and nothing else between `=` and `lazyWithRetry`; tight. `routesKey` on the first path segment gives the same key as before for every `/app` path and `/ambassador` for the new area.

### 6. The three e2e failures at 0ba231e: CONFIRMED cold-Vite, present on `main`, unrelated to `AnimatedRoutes.tsx`

Reproduced here with `rm -rf node_modules/.vite` then `account-settings.spec.ts` + `organiser-onboarding.spec.ts` (2 workers): on the PR head and on `main` the same three tests fail the same way (`account-settings` x2, `organiser-onboarding` "offer ... Ask to join"), each run logging `[vite] Pre-transform error: The file does not exist at ".../node_modules/.vite/deps/chunk-*.js" which is in the optimize deps directory`. With a warm cache the ambassador spec passed 12 of 12. CI `e2e-smoke` at 12aa2bb is green. The `optimizeDeps.include` fix the worker proposes belongs in a separate PR, as they say.

### 7. Copy, states, 100 rows, noindex, IA, banner: CONFIRMED with F1/F4

- Every state says what to do: loading (skeleton + text), error ("Try again", "Nothing has been approved or rejected by this problem"), no access ("ask an admin to add you", "Back to the site"), signed out ("Sign in" back here), caught up ("Back to the site"), review gone ("Back to the list"), more ("Show more", "Could not load more. Try again."), party note says the buttons are off and why. No copy points at a control that is absent.
- Over 100 rows: pages by `p_offset` per city, "Show more" through `qc.fetchQuery` with the app retry; see F1 for the order problem. A city already exhausted is still asked at the next offset (returns `[]`, harmless, known).
- `noindex`: client-side `useNoindexMeta(true)` only (known gap; `/ambassador/*` is behind `AuthGuard`, so a crawler gets the redirect, never the queue).
- IA: `siteIa.ts` `ambassador` (path `/ambassador`) and `ambassador.review` (parent `ambassador`, no path); `buildBreadcrumbs(inReview ? 'ambassador.review' : 'ambassador')`; `catchallClientPaths.ts` has `/ambassador/*`; `AnimatedRoutes` route `/ambassador/*` wrapped in `PageTransition`. Breadcrumb and siteIa tests pass (44).
- Dancer-profile banner: #1094 (`profileCompletion.ts`, merged as d14a58c) is in the branch (merge base).

### 8. Known gaps: none blocks

A0b r2 S1/S2/N1/N2, the daily publish gate on review-city go-live, no decision emails, no party flag in the list RPC: with 0 ambassadors and 0 pending rows live, none bites before A4 links the page. The missing party flag is the one that shapes the ambassador's first minute (they learn "needs an admin" only after Approve, Yes); worth the A2 RPC column before go-live, not before merge.

## Gates run here

| Gate | Result |
|---|---|
| `vitest run src/modules/ambassador src/modules/organiser/p3/__tests__/flagOff.test.ts src/lib/breadcrumbs` (TZ Europe/London) | 106 passed (4 files) |
| `playwright test tests/e2e/ambassador-queue.spec.ts --workers=1 --repeat-each=3` (chromium, 390x844) | 12 passed |
| `npm run build` + `npm run check:bundle-budget` at 12aa2bb and at `main` | every budget and ratchet `[ok]`, numbers above |
| Cold-Vite e2e (two specs, both heads) | same three failures on both, see item 6 |
| CI at 12aa2bb (read 00:49 UTC) | green: `unit` x3, `e2e-smoke`, `integrity`, `bundle-budget`, `build-smoke`, `live-db-gate`, `dancer-area-isolation`, `wallclock-brand`, `masking-check`, `bom-check`, `notification-check`, `real-data-verified`, `phone-qa-section`, `no-preview-reason` x4, `open-pr`, `decide`; `phone-qa` in progress; `lighthouse`, `doc-weight`, `seo-*`, `og-*`, `synthetic*` skipped; red: `contract-check` |
| `contract-check` on `main` | red on the last four `main` runs (d14a58c, a5d4bb4, dd8112f, 4c683ce), so not this PR's |

## Not reviewed / not verified

- Which step reds `contract-check` (the job log tail shows later steps passing; the worker says the live OG-render health check with two 403s; not opened).
- A live ambassador session end to end (none exists on prod); real iOS Safari / Android Chrome, the on-screen keyboard over the Reject sheet, screen readers, reduced motion.
- A flag-on (`organiserP3`) build.
- The full `npm run lint` chain, `pre-ship`, `typecheck` and `check:mojibake` at this head (prior rounds report them; the one pre-existing `react-hooks/static-components` error on the harness `Where` helper is unchanged in the diff).
- The PR body's "Verified on real data" block and the `/code-review` rounds 3 and 4 the handover says were not run.
