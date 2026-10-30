# Review r2: Website PR #1086 after fix round 1 (branch `claude/ambassador-a1-build`, head `88cfcec`)

Reviewer: independent model, zero prior context, read-only on source. Diff reviewed: `git diff 6240ab7 88cfcec` (10 files, +398/-109) against the round-1 review (`docs/reviews/review-1086-r1.md`, branch `claude/review-1086-r1`), the fix brief (`docs/briefs/ambassador-a1-fix1.md`, branch `brief/ambassador-a1-build`) and the "Fix round 1" section of `docs/design/ambassador-a1-build.md`. Live checks with the read-only Supabase connector (prod `stsdtacfauprzrdebmzg`; `SELECT` on `pg_policies`, `pg_proc`, `information_schema`, `pg_class` and counts only; no personal data, no writes). Local gates run on a worktree at `88cfcec`. Browser probe: headless Chromium (Playwright) at 390x844 with the PR's own network stubs; artefacts not committed.

This is the last review round (stopping rule from the brief).

## Verdict: BLOCK

Every item the fix brief asked for is done and done correctly (checks 1 to 5 below all pass, with two should-fix notes). The block is one finding that round 1 raised as BLOCK (its F2) and that the fix brief never listed, so nothing in `c673631` touches it: the approve/reject sheets and the success toast are still positioned against the route shell, not the viewport. Reproduced at `88cfcec` with a flowing clock: after an approval the toast sits entirely below the fold (y 1000 to 1038 in an 844 px viewport), and after a `self_approval_not_allowed` refusal the ambassador is left scrolled 661 px down with "Back to the list" 291 px above the top of the screen. That is a phone bug Ricky would find on the first approve. The fix is small (portal the sheet shell and the toast to `document.body`, `preventScroll` on the autofocus) and touches nothing the fix round changed, so the rest of this review stands as written once it lands.

Note on numbering: round 1 on the branch numbers its findings F1 gate, F2 overlay geometry, F3 preview 404, F4 e2e fixed clock, F5 error mapping, F6 profile banner, F7 sticky bar, F8 data shapes, F9 copy, F10 state, F11 tests, F12 CI. The fix brief and the design record use F1 gate, F2 preview 404, F3 decision errors, F4 noindex, F5 data shapes, F6 copy, F7 state notes. The overlay finding (r1 F2) fell between the two lists. Below, "r1 Fn" means the review's numbering.

## The brief's checks

### 1. F1 fixed for real: the gate reads the right table, and the live policies let it

**Verified live.** `fetchCityScopes(userId)` (`ambassadorApi.ts:14-27`) reads `entity_members` with `entity_type = 'city'`, `member_role = 'ambassador'`, `user_id = <auth user>`, then `cities` by id. Against prod:

- `entity_members` columns: `id`, `entity_type text`, `entity_id uuid`, `user_id uuid`, `member_role text`, `is_primary boolean`, `joined_at`, `created_by`. No `status`, `active`, `revoked` or similar column: nothing the RPCs filter on that the page does not. RLS on, not forced.
- `entity_members_select` (SELECT, role `authenticated`, PERMISSIVE): `(SELECT _self_serve_is_admin()) OR (user_id = (SELECT auth.uid()))`. Table grant: `authenticated` has SELECT. An ambassador's own session reads its own rows.
- `cities`: RLS on; policy "Public read" (SELECT, role `public`, `qual = true`); `authenticated` has SELECT. The second read works for anyone signed in.
- What A0a writes: `admin_add_entity_member_v1('city', <city>, <email>, 'ambassador')` passes `p_member_role = 'ambassador'` (whitelist `owner/manager/contributor/ambassador`; `ambassador` only on `city`), resolves the email to a confirmed account, then `_entity_member_write_p5(..., 'admin')` does `INSERT INTO entity_members (entity_type, entity_id, user_id, member_role, is_primary, created_by) VALUES ('city', <city>, <user>, 'ambassador', false, auth.uid())`. The owner path inserts the same row with `is_primary = false`. Exactly the three values the page filters on; the same three values `admin_list_pending_review_v1`, `admin_approve_entity_v1`, `admin_reject_entity_v1` and `_is_city_ambassador -> _is_entity_member('city', ..., ARRAY['ambassador'])` test. One source of truth now.
- `admin_get_my_city_scopes` is referenced nowhere in `src/` or `tests/` except the generated types and the test that asserts it is never called.
- `useAuth().user?.id` gates the query (`enabled: !!userId`); `AuthGuard` returns `null` until `authStatus === 'ready'` and a user exists, so the page never sits on a disabled query.

Counts today: 0 city ambassadors (61 `entity_members` rows, all `organiser` owner/manager), 1 manager-scope row, 0 pending organisers, 0 pending series, 319 cities. So the A0a-created ambassador's page would work: own rows via the policy, cities via public read, queue via the RPC's identical test. A live ambassador session still cannot be exercised (none exists).

Small note: an admin with no ambassador row still sees "No access" although the RPCs would serve them (the design record lists it under Not done; fine for A1).

### 2. Error handling against the live function bodies

Every string reachable from the list and decision paths (live bodies read), against `loadErrorKind` / `decisionError` (`ambassadorModel.ts:143-193`):

| Source | String | List path (`loadErrorKind`) | Decision path (`decisionError`) |
| --- | --- | --- | --- |
| `admin_list_pending_review_v1` | `admin_only` | access -> `NoAccessState` | n/a |
| `admin_approve_entity_v1` / `admin_reject_entity_v1` | `not_authorized` | n/a | access |
| `admin_reject_entity_v1` | `reason_required` | n/a | reason (client refuses blanks first) |
| `_moderate_entity` | `authentication_required` | auth -> `SignedOutState` | auth, with Sign in link |
| `_moderate_entity` | `not_authorised` (wrong city or hidden target) | n/a | access |
| `_moderate_entity` | `target_not_found`, `not_pending_review` | n/a | gone -> item removed |
| `_moderate_entity` | `self_approval_not_allowed` | n/a | party |
| `_moderate_entity` | `unsupported_target_type` | n/a | other (unreachable from this UI) |
| PostgREST | `JWT expired` / `PGRST301` / `PGRST303` / status 401 | auth | auth |
| Postgres | `42501 permission denied` | access | access |
| fetch | `Failed to fetch` | other -> "Check your connection" | other |

No permission refusal reaches the "connection" copy on either path: `SIGNED_OUT` is tested before `gone`, `NO_ACCESS` after `reason`, and `admin_only` / `not_authori` / `42501` are all in `NO_ACCESS`. The scope read's own failure goes through the same `failed()` helper (`AmbassadorQueuePage.tsx:131-136`), so a 401 on `entity_members` is "signed out", not "no access".

Sign-in link: the page builds `buildSignInHref(`${location.pathname}${location.search}`)`, the same call `AuthGuard.tsx:147` makes; `buildSignInHref` sanitises the return path and yields `/auth?mode=signin&returnTo=%2Fambassador...`. The tests pin that exact href on both the list state and the in-sheet error. Correct.

Should-fix (small): `NO_ACCESS` also matches the word `permission`, so a `permission denied for table entity_members` (a grant regression, not a membership fact) would read "This account is not an ambassador for any city". Low likelihood; worth a distinct sentence only if cheap.

### 3. Gone path and success path

`takeOff(item)` (`AmbassadorQueuePage.tsx:111-117`) filters the item out of every cached page, closes the sheet and, from a review, goes back to the list; `onSuccess` calls it and then sets the toast exactly as before (the only change is extraction into the helper; the toast still counts `items.length - 1`). `onError` with `kind === 'gone'` calls the same helper and shows the gone message, which now ends "It has been taken off your list." and is true. The matrix case for `target_not_found` and `not_pending_review` asserts one decision RPC, one row left, no dialog, no review view. No re-send possible: the item is no longer in `items`, so `sheetItem` resolves to null.

### 4. Currency, fixtures, 100-cap copy, raw Unicode

- `priceText` reads `priceCurrency` (`str(r.price_currency)?.trim().toUpperCase()`); GBP/EUR/USD get symbols, other codes print `PLN 30`, NULL prints the amounts plus "(mixed currencies)". Six table rows cover it, including `[null, 0, 0] -> Free`. **Should-fix (copy):** the live RPC sets `price_currency` to NULL whenever the priced passes do not share exactly one currency, which includes "no pass names a currency". Live today: 6 series with a priced pass, 4 in one currency (GBP and EUR), 0 mixed, 2 where no priced pass has a currency at all. So the only NULL shape prod produces reads "8 (mixed currencies)" when the truth is "currency not given". Make the NULL copy neutral, e.g. amounts plus "(currency not given)", or key "mixed" off `price_min`/`price_max` disagreeing across passes only if the RPC ever exposes that. Not blocking: none of those series is pending.
- Organiser fixtures (unit and e2e) now carry the live shape (`organiser_names`, `next_occurrence_dates`, `future_occurrence_count`, `has_flyer`, `price_currency` all NULL), asserted in the bare-organiser test; `dt` count 0; no "Organiser:" row.
- 100-cap copy: `fetchQueuePage` returns `fullCityIds`; `moreText(offset, names)` says "This shows the first 100 in Bristol." naming only the cities whose page was full; the two-city test asserts "first 100 in Bristol" and not "130". Correct. Nit: with two full cities it reads "the first 100 in Bath and Bristol", which a reader takes as 100 in total; "the first 100 in each of Bath and Bristol" would be exact.
- Raw Unicode: the warning mark is `&#9888;` in JSX; the money symbols and the dash are `\u` escapes in TS strings; the test file uses escapes. Still raw in the module, unchanged since `6240ab7` and not flagged in round 1: `…` in `'Approving…'`, `'Sending…'` (`DecisionSheets.tsx:76,126`), `'Loading…'` (`QueueViews.tsx:131`), `shortName` (`ambassadorModel.ts:119`), and `·` in the review meta line (`QueueViews.tsx:183`). CLAUDE.md's rule is "never paste Unicode punctuation directly into source files"; the mojibake guard only detects cp1252 damage after the fact (it passes). **Should-fix:** `&hellip;` / `&middot;` in the JSX, `…` / `·` in the TS string.

### 5. No regression: gates at `88cfcec`

| Gate | Result |
| --- | --- |
| `npx vitest run src/modules/ambassador` | 51 passed (1 file) |
| `npx eslint src/modules/ambassador tests/e2e/ambassador-queue.spec.ts` | 1 error, 9 warnings: the pre-existing `react-hooks/static-components` on the harness `Where` helper (`harness.tsx:51`), unchanged line; `scripts/pre-ship.mjs` runs eslint on changed files with `blocking: true`, so `npm run pre-ship` still reds on it |
| `npx tsc -p tsconfig.app.json` | 0 errors in `src/modules/ambassador` and the spec |
| `npm run lint` (22 links) | 21 green; `check:integrity` exit 126 because `bin/check-integrity.sh` is mode 100644 in git on the PR and on `main` alike (`bash bin/check-integrity.sh`: ok, 2732 files, 0 issues) |
| `npm run check:mojibake` | 2142 files, no cp1252 corruption |
| Playwright `tests/e2e/ambassador-queue.spec.ts` (390x844, chromium) | 3 passed; also 3 passed on a copy with a flowing clock |

CI on the PR head `88cfcec` (read at 18:44 UTC): green `unit` x3, `e2e-smoke`, `integrity`, `live-db-gate`, `dancer-area-isolation`, `wallclock-brand`, `masking-check`, `bom-check`, `notification-check`, `no-preview-reason`, `open-pr`, `decide`; `real-data-verified` and `phone-qa-section` failed at 18:33 and passed on the 18:35 re-run (PR body edit); red `bundle-budget` and `contract-check`; `build-smoke` and `phone-qa` still in progress; `lighthouse`, `doc-weight`, `seo-*`, `og-*`, `synthetic*` skipped.

Both reds exist on `main`: Perf Budget failed on the base commit `dd8112f` (push run, 16:11 UTC) and DB Contract Check's latest `main` run (`4c683ce`, 16:05 UTC, dispatch) failed. Not this PR's. The PR body's "vendor-supabase KB budget" diagnosis is still the one round 1 corrected (the failing verdict is the `dancer-app` first-load total; `vendor-supabase` is report-only), but the claim that matters, red on `main`, holds.

### 6. Newly broken by the fixes

Nothing found. Specifically checked: `SCOPES_KEY` has no remaining consumer (removed, tsc clean); the query key now carries the user id, so a sign-out/sign-in as another account does not reuse the first account's cities; `getNextPageParam` still keys off `full`, and `fullCityIds` is only used for copy; the `gone` branch returns before `setSheetError`, so no stale error is shown on a closed sheet; the success toast text and count are unchanged; `backToList` is reached from `takeOff` only when a review is open; the e2e stubs answer `entity_members` only when all three filters are present, so a regression to a broader read would fail the spec.

## Carried over from round 1, unaddressed (not in the fix brief)

- **r1 F2 (BLOCK, still present).** `SheetShell` is `fixed inset-0` rendered inside the module (`DecisionSheets.tsx:28`), the toast is `fixed bottom-24` (`AmbassadorQueuePage.tsx:220`), and `PageTransition` leaves `filter: blur(0px)` on `.route-shell`, which makes the shell the containing block for both. Measured at `88cfcec`, 390x844, flowing clock, stubs as in the PR's spec: shell `filter: blur(0px)`, shell top y 275 at scroll 0. Open row 1, tap Approve: `autoFocus` on Cancel scrolls the window from 0 to 661; the overlay spans y -386 to 458, leaving the bottom 386 px of the viewport uncovered (the confirm button lands at y 400-444 only because of that scroll). Confirm on a party item: `self_approval_not_allowed`, sheet closes, scrollY stays 661, party note at y 28, "Back to the list" at y -291. Back, open row 2, approve: toast at y 1000-1038 in an 844 px viewport, fully off-screen; the ambassador gets no confirmation beyond the row vanishing. Fix as round 1 said: `createPortal` the sheet shell and the toast to `document.body` (every other in-route overlay in the codebase does), `focus({ preventScroll: true })` instead of `autoFocus`, and a unit assertion that the overlay's box equals the viewport.
- **r1 F4 (e2e under a fixed clock) did not reproduce here.** Under `page.clock.setFixedTime(NOW)` the route shell reads `opacity: 1`, `filter: blur(0px)` after 1.5 s, so the PR's spec is exercising a visible page. Treat r1 F4 as withdrawn.
- r1 F6 (profile banner on `/ambassador`), F7 (sticky bar off-screen past the footer, breadcrumb tap size, `document.title`) and the r1 F10/F11 minor items stand as written; none is blocking.

## Verified / Not verified

**Verified**
- Live: `pg_policies` for `entity_members` and `cities`, table grants for `anon`/`authenticated`, RLS flags, `entity_members` column list; bodies of `admin_add_entity_member_v1`, `_entity_member_write_p5`, `_is_city_ambassador`, `_is_entity_member`, `admin_list_pending_review_v1`, `admin_approve_entity_v1`, `admin_reject_entity_v1`, `_moderate_entity`; counts (ambassadors, member roles, pending rows, priced series by currency shape, scopes rows). Counts only, no writes.
- The full diff `6240ab7..88cfcec`; `buildSignInHref` and its use in `AuthGuard`; `useAuth`/`AuthGuard` gating; no remaining `admin_get_my_city_scopes` call; the lint chain's guards.
- Local gates in the table above, all at `88cfcec`.
- Browser: the PR's spec (3 passed), the same with a flowing clock (3 passed), and the overlay/toast/scroll measurements above.
- CI runs on the PR head and the `main` runs for Perf Budget and DB Contract Check.

**Not verified**
- Any live response for a real ambassador session (none exists on prod); the page end to end against prod.
- Real iOS Safari / Android Chrome; screen readers.
- Which step reds `contract-check` and whether its red on `main` is the same step as on the PR (not opened).
- `build-smoke` and `phone-qa` on the PR head were still running when this was written.
