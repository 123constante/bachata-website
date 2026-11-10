# Review: S1a Website side (PR #1523, `claude/ticket-night-aware-website`)

Reviewed head: `7532b82ed983900fe7c4af148a9ac58a1263c02b` against `main` (merge-base `4bebd94`).
Brief: `docs/briefs/review-ticket-night-aware-website.md` (`brief/review-ticket-night-aware-website`, sha 02d741a).
Reviewer: zero-context cloud worker, ticket dt_e2ee5a55d96e. Read-only on prod (counts and catalog only); no source edited.

## Verdict: FIX

Three items to fix before merge, in order of weight. Everything else checked passes or is a note.

### FIX-1 (blocking): every night control points at a tile that no ticket-selling page renders
- Where: `src/modules/event-page/bento/EventStickyActionBar.tsx:221`, `src/modules/tickets/EventTicketsPage.tsx:125-128` (`seeDates`), `src/modules/tickets/TicketsBlock.tsx:64-68` (`scrollToDates`), and the copy in `src/modules/tickets/ticketCheckoutModel.ts:329-333` ("... on the dates list").
- All three controls do `document.querySelector('[data-block-id="dates"]')?.scrollIntoView(...)`. BentoPage hides the `dates` block unless `isMultiDateType` (`eventFormat === 'course'`, `BentoPage.tsx:343-345`) and the series has more than one occurrence (`BentoPage.tsx:407`) and is not paused (`:411`). The comment there says it: "Only format='course' earns the date list."
- Prod (read-only, 2026-11-10): the live series that have live ticket types are 1 x `format=festival` (12 types) and 1 x `format=recurring, type=party` (3 types). Zero `course`. So on every page that sells tickets today the dates tile does not exist.
- Failing input: Coco Loco page, after the edge deploy, a 409 `night_ended` (or any of the five). Buyer taps "Choose another night".
- Wrong output: `onWayForward` clears the error and calls `chooseNight` -> `seeDates` closes the Tickets page, the selector returns null, nothing scrolls. The buyer lands on the event page with no dates list anywhere on it, having read "Choose another night on the dates list". Same dead end for the sticky bar's "Choose a night" (`buy-choose-night`) and the block's "See the dates". The only night links on the page are in `DatesBlock.tsx:37` and `WeeksLadderBlock.tsx:83`, both inside the hidden tile; weekly series have no in-page night control at all.
- This breaks the CLAUDE.md rule "No copy that points at a control that is not on screen" and the brief's "the control exists and goes somewhere real".
- Fix: give these states a real target. Simplest: have `seeDates`/`chooseNight` navigate to the next future night (`?occurrenceId=<snapshot.occurrences next>`), or render a small night list (from `snapshot.occurrences`, already loaded by BentoPage) inside the Tickets page for the no-night and refusal states, and reword the copy to match what is on screen. Add a test that the control reaches a real element or a navigation, not just that a callback fired.

### FIX-2 (medium): the block's own quiet bar shows a disabled "Choose a night" button
- Where: `src/modules/tickets/TicketsBlock.tsx:301-318`. For `needs_night`, `quietBar()` returns `button: 'Choose a night'`, rendered as `<button type="button" disabled ...>`.
- Failing input: no night on screen, per-night rows (`remaining` NULL). Wrong output: a fixed bottom bar with a greyed, labelled control that cannot be tapped, while the sticky bar in `EventStickyActionBar.tsx:217-229` renders the same label as a WORKING button. Bar and block disagree on the one state the brief singles out. (The "See the dates" link above it does work, subject to FIX-1.)
- Fix: in the `needs_night` case wire the quiet-bar button to `chooseNight` (or drop the quiet bar when `needsNight`, since the block already carries the control).

### FIX-3 (tests): the sticky-bar probe is not covered; a night-blind probe passes every test
- Mutant: `InSiteTicketProbe.tsx` keyed and fetching with `publicTicketKeys.types(seriesId, null)` / `fetchPublicTicketTypes(seriesId, null)`. Result: `vitest run src/modules/tickets src/modules/event-page` 1091/1091 green. Nothing asserts the probe (or `BentoPage -> EventStickyActionBar`) passes the night, so the bar could silently read series-wide rows (remaining NULL -> "Choose a night" on every weekly page) while the block reads the night's rows.
- Fix: a jsdom test rendering `InSiteTicketProbe` with `occurrenceId="n1"` asserting `fetchPublicTicketTypes` was called with `('e1', 'n1')`, and one for `EventStickyActionBar` forwarding `occurrenceId`.

## Checks, in the brief's order

### 1. Wire vs prod: PASS
Read back with `pg_get_function_arguments/result` and `pg_get_functiondef` (read-only):
- `ticket_types_public_v2(p_event_series_id uuid, p_occurrence_id uuid DEFAULT NULL)` returns `id, occurrence_id, name, price_pence, currency, status, remaining, sold_out, sales_open_at, sales_close_at, effective_close_at, kind, valid_from (date), valid_to (date)`. The call in `ticketCheckoutApi.ts:51-54` uses exactly `p_event_series_id`, `p_occurrence_id`; `parsePublicTypes` reads exactly those column names.
- `ticket_promo_preview_v2(p_series, p_ticket_type, p_quantity integer, p_code text, p_occurrence_id uuid)` returns jsonb; the call in `ticketCheckoutApi.ts:66-72` matches.
- Function body: `remaining` is NULL only when the type is per-night AND no night (`per_night AND night IS NULL`), else `greatest(capacity - held, 0)`; `sold_out` = (`manual_sold_out OR rem = 0`); per-night types report status `on_sale` unless sold out; a night that `_ticket_night_refusal_v1` refuses (past, cancelled, wrong night) yields no rows; `effective_close_at` is per night. `needsNight: remaining === null && status === 'on_sale'` therefore matches the server. `kind` is read as a free string; `valid_from/to` arrive as `YYYY-MM-DD`, which `longDate` expects.
- Catalog counts: 17 ticket types, all `kind='night'`, all series-wide (`occurrence_id` NULL); live types: 15 `on_sale`, 2 `paused`. No course, no own-night, no sold-out row exists, so those shapes are covered by tests only (the PR says so too).

### 2. Money path: PASS on the code, two notes
- `buildCheckoutBody` adds `occurrence_id` iff `occurrenceId` truthy (`ticketCheckoutModel.ts:270`). `TicketsBlock` passes its own `occurrenceId` prop (`TicketsBlock.tsx:195`), the same value used for the query key (`:75`) and for `previewPromo` (`:134`). The prop comes from `EventTicketsPage`, which gets `occurrenceId ?? snapshot?.occurrenceId ?? null` from BentoPage (`BentoPage.tsx:787`). The preview prices the night the checkout sends.
- A series-wide night type can only post without `occurrence_id` when the page has no night; then v2 answers `remaining` NULL -> `needs_night` -> `maxQuantity` 0 -> no Buy, no form (`TicketsBlock.tsx:102-106`, tested). The Tickets page itself is only mounted from the sticky bar's Buy, which is suppressed in that state.
- Night change while the page is open: the Tickets page is a full-screen portal, so the only way to change `?occurrenceId` underneath it is browser back. Then the prop, key and body all follow the new URL together. Back from Stripe cancel keeps `?occurrenceId` via `cancelReturnPath` (`:249-253`).
- Note N1 (low): when the URL carries no `?occurrenceId` and the page used the snapshot's night, the cancel URL has no night either; on return the snapshot resolves the next night again. Same night unless the night rolled over during Stripe. Consider writing the resolved night into the cancel path.
- Note N2 (low): `promoKey(typeId, qty)` excludes the night. If the night changes under an open page (browser back), an applied preview from night A stays shown for night B until re-applied. The edge re-validates, so the charge is right or refused; only the preview could be stale.

### 3. Five refusals: FIX-1
Each of `wrong_night`, `night_required`, `night_cancelled`, `night_ended`, `not_course_night` has its own `REASON_COPY` entry, says "You have not been charged", names a next step, and renders a 44px "Choose another night" button (tested per reason). But the button and the copy point at the dates list, which is absent on every selling page today (FIX-1). Until that is fixed the five refusals end in a dead end.

### 4. Sticky bar and block agree: FIX-1, FIX-2, rest PASS by reading
| Shape | Sticky bar (`siteBarState`/`quietBarButton`) | Block | Agree |
|---|---|---|---|
| no night (remaining NULL) | quiet, working "Choose a night" button | "Choose a night to buy tickets." + "See the dates"; quiet bar with a DISABLED "Choose a night" | FIX-2; both targets dead (FIX-1) |
| sold-out night (`sold_out` true) | quiet "Sold out" | rows "Sold out", quiet bar "Sold out", no Buy | yes |
| past night | v2 returns no rows -> bar `none` (external link only) | block not reachable; would render nothing | yes |
| cancelled night | BentoPage suppresses bar and page (`!occurrence?.isCancelled`); v2 would answer no rows | same | yes |
| course ticket | buyable -> Buy | row + "Valid every Tuesday from Tuesday 3 November 2026 to Tuesday 15 December 2026, once each night." | yes (shape exists only in tests) |
| mixed list | Buy (one buyable) | buyable row + the dates control | yes, but see N4 |
- Read, not measured: sticky button `h-[48px]`, way-forward and "See the dates" `min-h-[44px]`, quiet-bar button `h-[48px]`; no new fixed widths, so no new sideways-scroll source at 390. Weekday and month names are full and ICU-independent (`WEEKDAYS`/`MONTHS` tables). The diff adds no raw Unicode punctuation; `npm run check:mojibake` clean on the target. Not measured: contrast, actual layout at 390x844 (no browser walk).
- Note N3 (pre-existing on main): `siteBarState` reads all rows while the block uses `typesForNight`. With a night, v2 already drops wrong-night own-night rows, so they agree; with no night, an own-night row would make the bar say Buy and the block say unavailable. Prod has no own-night types today.
- Note N4: the "mixed" test shape (an own-night row plus a `remaining` NULL row in one read) cannot come from v2 with a night, since `night = coalesce(t.occurrence_id, p_occurrence_id)` is never NULL then. Harmless, but it tests a shape prod cannot produce.
- Note N5: a per-night type with `manual_sold_out` read with no night comes back `sold_out` with `remaining` NULL; the parser shows "Sold out" for the type, not "Choose a night". Acceptable.

### 5. Gap safety (old edge ignores `occurrence_id`): PASS
Both v2 reads are already live on prod, so the read side changes behaviour on merge regardless of the edge: a past or cancelled night now shows no tickets (correct), and no-night pages show no Buy. The body only gains an optional key the old edge ignores; nothing else in the body changed, so a buyer with a night buys exactly as today. Night refusals cannot occur before the deploy. Nothing here breaks a buyer in the gap, apart from the dead control in FIX-1, which exists in the gap too (no-night page).

### 6. Tests vs mutants: PASS for the block, FIX-3 for the bar
Run in a worktree at 7532b82 (`npx vitest run`):
| Run | Result |
|---|---|
| baseline `src/modules/tickets` | 21 files, 776/776 pass |
| drop `occurrence_id` from `buildCheckoutBody` | 3 fail (body test, night A screen, course screen) |
| query key back to `[.., seriesId]` | 1 fail (key test) |
| `ticket_types_public_v1` + `ticket_promo_preview_v1` again | 2 fail (types read, promo preview) |
| `TicketsBlock` omits `occurrenceId` from the body | 2 fail (night A, course) |
| `InSiteTicketProbe` keyed/fetched with `null` night | 0 fail of 1091 (`tickets` + `event-page`) -- FIX-3 |

## PR #1523 checks at 7532b82 (read via GitHub API, 2026-11-10 ~14:55 UTC)
success: contract-check, live-db-gate, wallclock-brand, phone-qa (1,2,3), phone-qa-section, build-smoke, dancer-area-isolation, unit x3 (Europe/London full, America/New_York, Australia/Sydney), integrity, notification-check, masking-check, no-preview-reason, bundle-budget, bom-check, bom-check-routed, route, decide. skipped: lighthouse, doc-weight, synthetic, synthetic-preview, og-check, og-preview, seo-check, seo-preview. e2e-smoke: success (completed 14:59:38 UTC). All 28 non-skipped checks green.
`mergeable_state`: blocked (review required).
tsc (`tsc --noEmit -p tsconfig.app.json`) on 7532b82: errors in `BentoPage.tsx`, `EventTicketsPage.tsx` and others are the same set as main (no new error from the diff).

## Verified / Not verified
- Verified: prod signatures and function body read back; catalog counts (kinds, own-night, status, series format); vitest baseline and five mutants; tsc on the target; mojibake check; PR check runs; every finding traced to file:line by reading the branch.
- Not verified: browser walk at 390x844 (no deploy walked); contrast; real Stripe; the edge deploy and live 409s; `ticket_types_public_v2` called with live rows for a past/cancelled/sold-out night (none exist in prod); main-branch baseline for the 15 failing `tests/` files the PR body mentions.
