# Ambassador A1: pending queue (Design Gate stages 1-2)

Mockups only. No production code, route, RPC call or migration. Files: `docs/design/ambassador-a1/{index,option-a,option-b,option-c}.html`. Open any at 390x844; the "Mockup states" strip flips between shapes. All data is invented.

## Stage 1 brief (owner clicks, 2026-10-27)

1. **Who:** a city ambassador (volunteer, phone, ~95% mobile) who approves or rejects new organiser pages and series in their city. First one: Jan, Bristol.
2. **Scope now:** the pending queue only. No invite link, tracker, history or city overview (A2/later).
3. **Each item:** approve, or reject with a required reason. Never show submitter email. An item the ambassador is party to shows "needs an admin" with no buttons (A0a refuses self-approval, `self_approval_not_allowed`).
4. **Shapes covered** (from `admin_list_pending_review_v1`): 0, 1 and 12 items; a 9-day-old item; organiser with no extra fields; series with 13 weekly dates; series with no flyer; free / priced / price range; very long name; loading; error with retry; reject sheet with empty and too-short validation; approve confirm; success after a decision (item leaves, count updates); needs-an-admin item; wrong-city (no access); paused (calm empty state).
5. **Rules:** 390x844, compact density, taps >= 44px in explicit px, contrast >= 4.5, no sideways scroll, every empty/error state says what the person can do, disabled controls say why. British English, full weekday names.

Look: matches the site's dark theme tokens (`src/index.css`): black page, `#121212` cards, amber primary `hsl(39 100% 50%)`, muted `#ababab`, border `#333`, destructive red (lightened to `#f87171` for text contrast).

Shared across all three: queue sorted oldest first; a "Waiting N days" chip that turns amber with a warning mark at 7+ days; the same reject sheet (reason required, minimum 10 characters, inline error, organiser sees the reason); the same approve confirm; the same "needs an admin" note; a toast that says what happened and how many are left.

## The three options

**A, Inbox cards.** One list of cards; the first is open, the rest collapse to name, type and age. Approve and Reject appear on an expanded card. *Trade-offs:* fastest for someone clearing a short queue and everything stays on one screen, no navigation to lose their place. But the buttons only show once a card is open, so a queue of 12 means expand, read, decide, and a long expanded series (13 dates, long name) pushes the next cards well below the fold. Easy to scroll past the 9-day-old item if it is not first (it is, because of the sort).

**B, List then review.** Compact rows (name, type, age, chevron) at 57px each, so about eleven fit in a screen. Tap opens a full review screen with a sticky Approve / Reject bar. *Trade-offs:* best overview and the clearest place to see queue age at a glance; the decision screen has room for everything and the bar is always reachable with a thumb. Costs one extra tap and a back step per item, and returning to the list after a decision needs the list to keep its position.

**C, One at a time.** A triage view with "3 of 12", previous/next, and decisions pinned at the bottom. *Trade-offs:* lowest cognitive load and the strongest nudge to actually clear the queue, good for Jan doing five minutes on the bus. Weakest overview: no list, so 12 items feels like a tunnel, a skipped item is easy to forget, and the age warning only appears per item.

## Recommendation: B

B is the best fit for a volunteer who dips in, wants to see "how long has anything been waiting" immediately, and then reads one thing properly before a decision with real consequences (it goes public; a rejection sends a reason). It keeps decisions off the list so nothing is approved by a stray tap, and the sticky bar follows the same pattern as the rest of the site's action bars. A is the cheapest to build; C is a good later "review next" shortcut on top of B (open the oldest, then step through).

## Stage 4 checks run by hand

Headless Chromium (Playwright), viewport 390x844, every state in the switcher for every option (49 state/screen combinations, including B's review screens, C's last-item and needs-admin screens). Script was throwaway and is not committed.

| Check | Result |
| --- | --- |
| Horizontal overflow | `scrollWidth` 390 = `clientWidth` 390 in every combination. |
| Tap targets (buttons and links in the product area, mockup switcher excluded) | Minimum 44x44 px everywhere; B list rows 57 px tall; no element under 44. |
| Contrast (lowest text/background ratio per screen, computed from rendered colours) | Lowest 6.54:1 (red validation message on the sheet); typical 6.8-9.1:1; all >= 4.5. |
| Page errors | None thrown. |

## Not verified

- Real device (iOS Safari, Android Chrome) and the ~13.5px root font-size trap: sizes are explicit px, but not seen on a phone.
- Contrast was computed on solid colours; amber/red chips with translucent borders and the toast over a scrolling page were not separately measured. Disabled controls (previous/next at the ends) are exempt from contrast and were skipped.
- Screen reader behaviour (sheet focus trap, announcements) is only sketched with roles and `aria-*`; not tested.
- Light theme not designed (the site is dark).
- No real data shapes were surveyed: fixtures follow the RPC fields listed in the brief, per instruction no Supabase read was made. The CLAUDE.md real-data gate applies before any build.
- Mockup copy for what the organiser is told on approve/reject is assumed, not confirmed against A0a.

## Build notes (option B, pending queue only)

Owner picked option B on 2026-10-27. Built under `src/modules/ambassador/`, route `/ambassador` and `/ambassador/review/:targetType/:targetId` (one lazy chunk, linked from nowhere; A4 links it). Mockups: `docs/design/ambassador-a1/option-b.html` on branch `claude/ambassador-a1-mockups`.

- Differences from the mockup: no "Paused" state (nothing in the RPCs says an ambassador is paused); no "Message an admin" link (no contact route exists, and copy must not point at a control that is absent); "Preview public page" shows for organisers only (series have no public page of their own yet); the type chips use the site's neutral border, not new violet/teal colours.
- Age text is "Waiting N days" from `updated_at` (the RPC's `submitted_at`), so the review screen says "Last changed N days ago", never "submitted".
- `/ambassador*` shares one `routesKey` in `AnimatedRoutes.tsx` (like `/app`), so the list stays mounted under a review and Back restores the scroll position.

## Fix round 1 (review r1 on PR #1086, verdict BLOCK)

Brief: `docs/briefs/ambassador-a1-fix1.md` (branch `brief/ambassador-a1-build`). Review: `docs/reviews/review-1086-r1.md` (branch `claude/review-1086-r1`).

- **F1 (the gate).** The city list no longer comes from `admin_get_my_city_scopes` (the manager-scope table). `fetchCityScopes(userId)` reads the user's own `entity_members` rows (`entity_type = 'city'`, `member_role = 'ambassador'`, `user_id` = the signed-in user; policy `entity_members_select` allows own rows), then `cities` by id. Two reads, because the generated types carry no `entity_members -> cities` relationship to join on. A list-RPC refusal (`admin_only`, `not_authori*`, 42501) now renders the no-access state; `authentication_required` / `JWT expired` / 401 render a signed-out state with a Sign in link; only anything else says "check your connection". `admin_get_my_city_scopes` is called nowhere in the module.
- **F2 (preview 404).** The "Preview public page" link and "Open the public page..." sentence are gone (`previewHref` deleted). A bare organiser (live shape: every series field NULL, so no fact rows) says what is known (name, city, how long it has waited) and that nothing more was submitted, so there is nothing more to show. Approve and Reject stay usable.
- **F3 (decision errors).** `authentication_required`, `JWT expired` / `PGRST301` / `PGRST303` and HTTP 401 map to "You are signed out. Sign in again, then try again." with a Sign in link to `buildSignInHref(<this screen>)`, the same helper `AuthGuard` uses. On `gone` (`target_not_found`, `not_pending_review`, ...) the item is taken off the list exactly as a success is, the sheet closes, and the toast says "It has been taken off your list."
- **F5 (data shapes).** `price_currency` is parsed: GBP/EUR/USD get their symbol, other codes print as "PLN 30", NULL (mixed) prints amounts with no symbol plus "(mixed currencies)". Organiser fixtures (unit and e2e) now carry the live shape (`organiser_names`, `next_occurrence_dates`, `future_occurrence_count`, `has_flyer`, `price_currency` all NULL). The 100-cap copy counts per city: "This shows the first 100 in Bristol." names only the cities whose last page was full. The harness pins the clock (`2026-10-27T12:00Z`) and the fixtures count ages from that pinned time.
- **F6 (copy without a control).** The no-access text drops "Check you are signed in with the right account" (no control for it); the 7-day warning mark is `&#9888;` in JSX, not a raw character.

Tests: the matrix harness answers the new source (a small PostgREST builder for `from().select().eq().in()`). New cases: Bristol member -> reads own rows, then the city, then the Bristol queue, and never calls the old RPC; no member rows -> no access, queue never requested; list RPC raises `admin_only` / `not_authorized` / `not_authorised` -> no access, no "connection" copy; list RPC says `authentication_required` / `JWT expired` -> signed-out state; two cities -> both queried, rows merged oldest first; two cities with one full page -> "first 100 in Bristol", not 130; decision 401 shapes -> signed-out copy with the Sign in link; gone -> taken off the list, not re-sent; six price/currency rows; bare organiser on the live shape. The e2e spec stubs `/rest/v1/entity_members` (only for the right filters) and `/rest/v1/cities`.

### Not done (out of scope for this round, per the brief)

- F4: server-side `noindex` for `/ambassador*` (the meta is still added client-side only).
- F7: state notes (cache only local until stale, offline/timeout half-state, no focus trap or focus return on the sheets).
- Minor items: an admin with no ambassador row still sees "No access" (the RPCs would serve them); the "needs an admin" chip cannot show before the first tap (the list RPC returns no party flag: an A2 data gap); `now` is captured at mount; the next `p_offset` is still sent to a city that was already exhausted; the toast colours drift from the mockup; "All caught up" links to `/`, not `/city/<slug>`; the pre-existing `react-hooks/static-components` lint error on the harness `Where` helper.

Fix round 1 checks (local): ambassador unit matrix 51 pass; `ambassador-queue.spec.ts` 3 pass; lint chain 21/22 green (integrity is the mode-644 script, ok under `bash`); no typecheck errors in the module. Perf Budget `vendor-supabase` and DB Contract og-render are red on `main` already.

## Fix round 2 (review r2 on PR #1086, verdict BLOCK on r1 F2)

Brief: `docs/briefs/ambassador-a1-fix2.md` (branch `brief/ambassador-a1-build`). Review: `docs/reviews/review-1086-r2.md` (branch `claude/review-1086-r2`), overlay finding r1 F2 in `docs/reviews/review-1086-r1.md`.

- **Blocker: overlay geometry (r1 F2).** `PageTransition` leaves `filter: blur(0px)` on `.route-shell`, which makes the shell the containing block for anything `fixed` inside it. `SheetShell` (`DecisionSheets.tsx`) and the success toast (`AmbassadorQueuePage.tsx`) are now `createPortal`-ed to `document.body`. The Approve sheet's `autoFocus` on Cancel became a ref plus `focus({ preventScroll: true })`; the Reject textarea's focus also passes `preventScroll`.
  - New e2e case in `tests/e2e/ambassador-queue.spec.ts`, 390x844, **flowing** clock (`page.clock.install`, not `setFixedTime`): the overlay box covers the viewport, the confirm/submit button is inside it, `scrollY` is unchanged by opening either sheet, after a `self_approval_not_allowed` refusal `scrollY` is unchanged and "Back to the list" is on screen, and after a successful approve the toast box is inside 0..844.
  - Red first against `88cfcec`: `scrollY` 0 -> 661 on opening the Approve sheet. Mutation after the fix (toast portal reverted, sheet fix kept): toast bottom at 1038 > 844, red. Both green with the fix.
- **Raw Unicode.** `Approving&hellip;`, `Sending&hellip;`, `Loading&hellip;` and the review meta `&middot;` are JSX entities; `shortName` uses `…`. No raw `…` or `·` left in the module.
- **NULL `price_currency`.** Copy is "(currency not given)": the only NULL shape prod produces today is "no priced pass names a currency".
- **`NO_ACCESS`.** The bare word `permission` is gone from the pattern, and `permission denied for table|function|...` (a grant fault, which also carries 42501) is excluded, so it falls to the generic "did not go through" / "Could not load" copy instead of "not an ambassador". A bare `42501 permission denied`, `admin_only` and `not_authori*` stay "no access".
- **100-cap copy.** Two or more full cities read "the first 100 in each of Bath and Bristol".

Fix round 2 checks (local): ambassador unit matrix 56 pass; `ambassador-queue.spec.ts` 4 pass (chromium, 390x844); `tsc -p tsconfig.app.json` no errors in the module or spec; eslint on the module and spec: the same pre-existing `react-hooks/static-components` error on the harness `Where` helper only; lint chain 21/22 green (`check:integrity` exit 126 is the mode-644 script on `main` too; `bash bin/check-integrity.sh` ok). `bundle-budget` and DB Contract Check not chased (red on `main`).

Not verified: real iOS Safari / Android Chrome (Safari's handling of `filter` containing blocks matches Chromium's per spec, but not walked on a device); a live ambassador session (none exists on prod).

## Fix round 3 (bundle-budget red on PR #1086: dancer-app 374.3 KB vs 374)

Measured with a bare `npm run build` + `npm run check:bundle-budget` on main d14a58c and on
this branch, gzip bytes per first-load file of the dancer-app row (entry.client, root,
catchall, dancer-app; the same BFS the check runs). Main: 382,904 B (373.9 KB), 49 files.

| File | main | branch before | branch after |
|---|---:|---:|---:|
| vendor-query | 14,001 | 14,290 (+289) | 13,990 (-11) |
| AnimatedRoutes | 6,065 | 6,130 (+65) | 5,783 (-282) |
| lib-event-rules | 13,894 | 13,895 | 13,824 (-70) |
| others (hash-name noise, +/-4 B each) | | +-2 to +3 | |
| **Total** | **382,904** | **383,260 (+356)** | **382,542 (-362)** |

What landed in /app's first load:

1. **vendor-query +289 B.** `AmbassadorQueuePage` was the app's ONLY `useInfiniteQuery`
   caller, so the infinite observer and its paging behaviour joined the shared
   `vendor-query` chunk that every route loads. Fix: the page pages by hand with `useQuery`
   (same `InfiniteData` cache shape, so the remove-on-decide update is unchanged; a refetch
   reloads every page already shown, as infiniteQueryBehavior does; "Show more" fetches the
   next offset through `qc.fetchQuery` with the app's query retry default, not a mutation,
   so a failure is not reported as `save_failed`). vendor-query is back to main's bytes.
2. **AnimatedRoutes +65 B** (lazy import + preload-deps entry ~25 B, the Route ~11 B,
   the routesKey branch ~14 B, gzip-measured by cutting each piece from the built chunk).
   This is the route itself and cannot be moved into the lazy module. `routesKey` now reads
   the first path segment (`/app`, `/ambassador`, same results as before for every path,
   about 8 B smaller), and the cost is offset: `OrganiserP3Area`'s `lazyWithRetry` call is
   marked `/* @__PURE__ */`, so with `flags.organiserP3` off (prod) the dead import is
   dropped with its folded route (-0.35 KB on every catchall route; unchanged when the flag
   is on). The other flag-gated lazies were measured too and left alone: Raffles re-cuts
   /event's chunks (40 vs allowance 41, the ratchet fails UNDER), tickets ones save < 20 B.
   An app-wide `#__NO_SIDE_EFFECTS__` on lazyWithRetry measured -5.5 KB but re-cuts chunks
   on every route, so it is a separate perf PR, not this one.
3. siteIa ids and `catchallClientPaths` are not in the dancer-app first load (no byte change).

No change to `perf-budgets.json`, `vite.config.ts`, ratchets or the baseline. After: every
budget `[ok]`, dancer-app 373.6 KB / 49 files / 4 pullers, every chunk ratchet at allowance.
