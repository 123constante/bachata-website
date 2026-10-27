# Review r1: Website PR #1086, ambassador A1 pending queue (option B) + Design Gate stage 5

Reviewer: independent model (Claude Fable 5.1), zero prior context. Branch reviewed: `claude/ambassador-a1-build` at `6240ab7` against `main` `dd8112f`. Design truth: `claude/ambassador-a1-mockups` (`docs/design/ambassador-a1.md`, `docs/design/ambassador-a1/option-b.html`). Live RPC bodies read with the read-only Supabase connector (prod `stsdtacfauprzrdebmzg`, `SELECT` on `pg_proc`, `pg_policies` and counts only; no personal data, no writes).

## Verdict: BLOCK

One finding (F1) means the page cannot work for the person it is built for: its access gate reads a table that ambassadors are never written to, so the first real ambassador will see "No access to this queue". Everything else is should-fix or minor. The code is otherwise careful (email dropped at the parse boundary, reason trimmed, decisions confirmed, no raw codes shown), and the CI claims in the PR body hold.

## Findings, ranked

### F1 (BLOCK) The access gate reads the wrong authority: an ambassador gets "No access", a non-admin manager gets "Could not load the queue"

`src/modules/ambassador/ambassadorApi.ts:11` gates the whole page on `admin_get_my_city_scopes()`. The LIVE body of that function (read 2026-10-27) is:

```
SELECT c.id, c.name, c.slug FROM public.admin_manager_city_scopes s JOIN public.cities c ON c.id = s.city_id WHERE s.user_id = v_uid
```

`admin_manager_city_scopes` is the admin app's manager-scope table (`admin_link_managers` scopes). The only function that writes it is `admin_update_sensitive_settings` (super-admin only, 20-character reason, re-auth window). Ambassadors are something else entirely: rows in `entity_members` with `entity_type = 'city'` and `member_role = 'ambassador'`, written by `admin_add_entity_member_v1` (via `_entity_member_write_p5`). That is what every RPC the page then calls checks:

- `admin_list_pending_review_v1`: `EXISTS (... entity_members ... member_role = 'ambassador' AND entity_type = 'city')`, else `RAISE 'admin_only'`; rows filtered by `_is_city_ambassador(q.city_id, v_actor)`.
- `admin_approve_entity_v1` / `admin_reject_entity_v1`: same `entity_members` test, else `not_authorized`.
- `_moderate_entity`: `_is_city_ambassador(v_city, v_actor)` = `_is_entity_member('city', ..., ARRAY['ambassador'])`.

No function writes both tables. Live counts: `admin_manager_city_scopes` has 1 row, for a user who is NOT a city ambassador; `entity_members` has 0 city ambassadors; 0 ambassadors have a scopes row.

Failing scenarios:

1. Jan is added as Bristol ambassador the A0a way (`admin_add_entity_member_v1('city', <bristol>, jan@..., 'ambassador')`). Jan opens `/ambassador`: scopes come back `[]`, `AmbassadorQueuePage.tsx:134` renders `NoAccessState`: "This account is not an ambassador for any city ... ask an admin to add you." The admin already did. The queue is never requested. Nothing in the page can recover.
2. The one user who has a scopes row today (a manager, not an admin, not an ambassador) opens `/ambassador`: scopes return their city, `admin_list_pending_review_v1` raises `admin_only`, and `AmbassadorQueuePage.tsx:136` shows `ErrorState`: "Could not load the queue. Check your connection and try again." Try again loops forever. A permission refusal is shown as a connection problem.
3. An admin (`admin_users`) with no scopes row sees "No access" although the RPCs would serve every city (`p_city_id` null). The PR body calls this by design ("an admin who is not one"); acceptable for A1, but it is the same root cause.

Why the tests did not catch it: `__tests__/harness.tsx:28` answers `admin_get_my_city_scopes` with Bristol unconditionally, so the matrix tests a contract the database does not have. The PR body's "Verified on real data" section says no live RPC was read.

Fix direction (no migration in this repo): the page needs its city list from `entity_members`. The RLS policy `entity_members_select` already allows `user_id = auth.uid()`, so a direct `from('entity_members').select('entity_id').eq('entity_type','city').eq('member_role','ambassador')` joined to `cities` works today without DDL; cleaner is a small `my_ambassador_cities_v1()` RPC authored in the admin repo. Keep the `admin_only` / `not_authori` list-error mapping separate from the network-error copy (see F3) so case 2 says "no access", not "check your connection". The matrix needs a case where the scope source says yes and the list RPC says `admin_only`, and one where the scope source is empty but the user is an admin.

### F2 (should-fix, high) "Preview public page" leads to a 404 for every item in the queue, and the no-extras copy sends the ambassador there

`ambassadorModel.ts:165-169` links organisers to `/organisers/<targetId>`. That is a framework route: `app/routes/organiser.tsx:62` resolves the row in a server loader through `app/detailLoader.ts:41` (`getSupabase()`, the anon key, no user session). The live SELECT policy on `organiser_profiles` (`organiser_profiles_ss_select`) shows a non-live row only to admins, owner/manager members, or the city ambassador's OWN session. Every row in this queue is `pending_review`, and the server has no session, so the loader 404s ("Soft 404" branch, line 41-43 comments). The ambassador taps the one link the review screen offers and lands on Not found.

For a bare organiser this is the whole screen: `QueueViews.tsx:185-188` renders "No extra details were submitted. Open the public page to check it before you decide." and nothing else; the `Preview public page` link below it is the control that does not work. The CLAUDE.md rule is that copy never points at a control that cannot work and that a control that cannot work is disabled with a reason. The mockup had the same link, but as a `href="#"` sketch; the build notes do not record this as verified.

Fix: either drop the link and the sentence for A1 and show the organiser's own submitted fields in the review (name, city, contact label, description; the RPC does not return them today, so this is an admin-repo RPC change), or make the preview a client-side read under the ambassador's session (the RLS policy already allows it). Not exercised in a browser against prod (no ambassador exists); the conclusion is from the policy text plus the loader's client, so it is marked PLAUSIBLE, not CONFIRMED.

### F3 (should-fix) Error mapping vs the live error strings: one gap, one misleading sentence, and list errors not mapped at all

Every string a non-admin ambassador can get from the decision path, from the live bodies:

| Source | String | Page mapping (`ambassadorModel.ts:130-152`) |
| --- | --- | --- |
| `admin_approve_entity_v1` / `admin_reject_entity_v1` | `not_authorized` | access (matches `not_authori`) ok |
| `admin_reject_entity_v1` | `reason_required` | reason ok (unreachable: client trims and refuses blanks first) |
| `_moderate_entity` | `authentication_required` | **unmapped**, falls to other: "Check your connection and try again". A signed-out/expired session is told it is a network problem. |
| `_moderate_entity` | `unsupported_target_type` | other (unreachable from this UI) |
| `_moderate_entity` | `not_authorised` (wrong city, or target missing: for a non-admin the city test runs BEFORE `target_not_found`) | access ok |
| `_moderate_entity` | `target_not_found` | gone ok (admins only; ambassadors get `not_authorised`) |
| `_moderate_entity` | `self_approval_not_allowed` | party ok |
| `_moderate_entity` | `not_pending_review` | gone ok |
| trigger `tg_enforce_lifecycle_transition` | `lifecycle_transition_denied: ...`, `review_required ...`, `city_required_for_review` | other; not reachable for an ambassador who passed `_moderate_entity` (same `_is_city_ambassador` and party tests), left as "other" is fine |
| PostgREST | `JWT expired` / 401 | other |

Problems:

- `authentication_required` and a 401 should map to "You are signed out. Sign in again and try again", not to a connection message.
- The gone copy says "Refresh the list to see what is left" (`ambassadorModel.ts:143`) but there is no refresh control anywhere on the page; the only refetches are a 60 s `staleTime` and `refetchOnWindowFocus` from `src/App.tsx`. After a 'gone' error the item stays in the list, and tapping it again re-sends the decision. Suggest: on `gone`, remove the item locally (as success does) or invalidate the queue query, and make the sentence true ("It has been taken off your list").
- The LIST error path (`AmbassadorQueuePage.tsx:133,136`) has no mapping at all: `admin_only`, `auth_required` (from `admin_get_my_city_scopes`) and a real network failure all render "Check your connection and try again. Nothing has been approved or rejected by this problem." See F1 case 2.

Self-approval, scenario-tested by reading: approve on an item Jan is party to raises `self_approval_not_allowed` from `_moderate_entity` (after the city test, before the pending test). `onError` adds the key to `party`, closes the sheet; `ReviewView` swaps the bar for `partyNote`; the list row gains the chip. Correct. Two edge notes: `party` is component state, so a reload brings the buttons back (another tap just gets the same refusal; harmless); and the RPC gives the page no way to know an item is party BEFORE the tap, so the mockup's "needs an admin" chip on first paint is not buildable until `admin_list_pending_review_v1` returns a flag (data gap for A2, worth recording).

Reason handling, verified: `DecisionSheets.tsx:80` sends `text.trim()`, `ambassadorApi.ts:43` trims again, `checkReason` trims before measuring, so spaces-only is refused client-side as `empty` and never sent; the RPC's own `btrim` guard would refuse it anyway. The 10-character minimum is client-only (the RPC accepts one character); fine. The audit row stores the reason as sent (trimmed).

### F4 (should-fix) Access and privacy are right; two small holes

Verified: `parseQueueRow` (`ambassadorModel.ts:37-60`) has no email field, so nothing downstream can render it; the live RPC returns `submitter_email` as NULL for non-admins anyway (`CASE WHEN v_is_admin THEN u.email END`). No test id, URL or query key carries email. `useNoindexMeta(true)` sets `noindex,nofollow` client-side; `/ambassador/*` is in `CATCHALL_CLIENT_PATHS`, whose only consumers are `app/catchallGate.ts` (serves it as a client route) and the dancer-isolation allowlist, so it reaches no sitemap. No link to `/ambassador` exists outside the module (grep of `src` and `app`). Signed out: `AuthGuard` redirects to `/auth` with `returnTo` once auth resolves.

Holes:

- The noindex meta is added after hydration. The SSR shell for a catchall route carries whatever robots meta the layout gives it; if `catchallGate` returns a 200 for `/ambassador` (it classifies it `client`), a crawler that does not run JS sees no noindex. Low risk (linked from nowhere); worth a server-side `noindex` on this prefix in the catchall gate if it is cheap.
- Wrong-city reasoning: the UI only ever asks for scope cities, and the RPC re-filters by `_is_city_ambassador`, so no city-B row can be listed or decided. The one assumption the UI adds is F1 (scope table = ambassador table). A deep link to a city-B item shows "No longer waiting ... may have been decided already", which is wrong but leaks nothing.

### F5 (should-fix) Data shapes: currency ignored, organiser fixtures do not match the live shape, 100-cap copy wrong across cities

- `priceText` (`ambassadorModel.ts:100-108`) always prints `£`. The RPC returns `price_currency` (upper-cased, NULL when a series mixes currencies) and the parser drops it. Live counts: 6 series have a priced pass, 2 of them non-GBP. Scenario: a EUR 15 series in the queue reads "£15".
- Live organiser rows return `organiser_names`, `next_occurrence_dates`, `future_occurrence_count`, `has_flyer` as NULL (every `CASE WHEN rs.id IS NOT NULL` is NULL for an organiser). The parser handles NULL (`[]`, `0`, `false`), but `__tests__/fixtures.ts:19` gives organisers `organiser_names: [name]`, so the "organiser with no extras" matrix case renders an "Organiser: <its own name>" fact row that prod never produces, and the real no-extras screen (zero rows) is untested.
- `QueueList` "This shows the first {items.length}. There may be more waiting." (`QueueViews.tsx:118`) counts items across every scope city, while `full` is per city. Two cities, 100 + 30 rows: "This shows the first 130". Also the next `p_offset` is applied to every city, including the one that was already exhausted (one wasted request per page; harmless).
- Ordering: the RPC returns newest first; `sortOldestFirst` re-sorts the flattened pages, stable on ties, NULL `submitted_at` last. Correct, including across cities and across pages (the 100-row test checks the re-sort).
- Time zone: `submitted_at` goes through `parseUtcIso`; `waitingDays` compares `londonDateKey`s via `londonDaysBetweenKeys` (UTC-noon arithmetic), so the 25 Oct 2026 BST end does not shift a day. `dateLabel` splits the `YYYY-MM-DD` key itself and uses `weekdayOfKey` (UTC noon): no `new Date('YYYY-MM-DD')` anywhere in the module. Verified by reading `src/lib/londonDate.ts:186-222`.
- `now` is captured once at mount (`AmbassadorQueuePage.tsx:47`); a tab left open over midnight keeps yesterday's day counts until reload. Minor.

### F6 (should-fix, small) Copy that points at a control that is not on screen

- No-access state (`QueueViews.tsx:65`): "Check you are signed in with the right account" offers no way to do that; the only control is "Back to the site". The mockup had "Sign in with another account". Either add a sign-out link or drop the sentence.
- Gone error: "Refresh the list" (F3).
- No-extras organiser: "Open the public page to check it" (F2).

### F7 (minor) State and React Query

- Cache after a decision: `setQueryData` filters the item out of every page (`AmbassadorQueuePage.tsx:111`); nothing is invalidated, so the count and the list are local truth until `staleTime` (60 s) + focus. Good enough for one ambassador per city; two people on the same city will see F3's gone path.
- Double tap: `busy={decide.isPending}` disables Confirm; the e2e/unit tests do not exercise two taps. Browser result in the measurements section below.
- Offline/slow: the sheet stays open with the buttons disabled and "Approving..." / "Sending..." until the RPC resolves; `retry` is off for mutations by React Query default; the `other` copy says "Nothing was changed", which is true only if the request never reached the server. A request that reached the server and timed out on the way back has changed state and the item is still listed; the next tap then gets `not_pending_review`, which F3's gone copy half-handles.
- `routesKey` change (`AnimatedRoutes.tsx:103-107`): the only use is `key={routesKey(location.pathname)}` at line 115; the function returns `pathname` unchanged for everything except `/app*` and `/ambassador*`, so no other route is affected. Proven by reading; note that `PageTransition` therefore does not animate between list and review, which is intended.
- Back/Forward: `openReview` records `scrollY`, `backToList` uses `navigate(-1)` only when `state.fromList` was set, else replaces to `/ambassador`; the `useLayoutEffect` restores in two passes. Browser result below.
- `Escape` closes a sheet unless busy; there is no focus trap and no return of focus to the trigger (the mockups listed screen-reader behaviour as not verified; still so).

### F8 (minor) Tests

- Mutation claims hold by reading: rendering the email anywhere turns test (a) red (`document.body.innerHTML` check, `queue.matrix.test.tsx:342`); lowering `MIN_REASON_LENGTH` below 10 turns the "9 of 10" assertion and test (b)'s `'123456789'` case red.
- The matrix is NOT table-driven over screens x shapes: it is ~33 hand-written `it` blocks plus one `it.each` of four error codes. Shapes the mockup lists that have no test: the "Edge shapes" set as a list, multi-city scopes, the 7-day boundary (6 d 23 h vs exactly 7 d), currency, an organiser row with NULL series fields (F5), `reason_required`, `authentication_required`, the gone path's "Refresh the list", a scopes answer with `admin_only` from the list RPC (F1).
- `agoIso` in fixtures uses 24-hour arithmetic while the page counts London calendar days; at 23:30 London a fixture "ago: 9" item created 9 x 24 h earlier still keys to 9 days (same wall time), so the tests are stable, but a test run that straddles midnight could flip "today"/"1 day". Pin `now` in the harness.
- e2e: stubs at the network layer (`page.route('**/rest/v1/**')` and `**/auth/v1/**`), fakes the session in `localStorage`, pins the clock with `page.clock.setFixedTime(NOW)`, asserts the RPC bodies and `page.content()` has no email; joined `test:e2e` by name in `package.json`. Correct. The spec covers approve, reject (validation then success), self-approval, scroll restore, 44 px rows and no sideways scroll; it does not cover any error state or the 100-row page.

### F9 (verified, not a finding) CI claims in the PR body

- **bundle-budget.** `main`'s own Perf Budget run for the PR's base commit `dd8112f` (run 40538380399, 2026-10-27 16:11Z) FAILED on the same `bundle-budget` job, before this PR existed. The PR's run (job 122363565177) shows every chunk ratchet and every puller ratchet `[ok]` and `vendor-supabase: NOT in first load` on every prerendered route; the failure line is the KB budget. The diff adds no static import to any app-shell file: `AnimatedRoutes.tsx` only adds a `lazyWithRetry(() => import(...))`, and the ambassador chunk imports the supabase client the same way `src/modules/admin-organisers/adminApi.ts` does (a lazy chunk, not first load). Local comparison in the measurements section below.
- **Unit failures.** See the measurements section (local run on both `main` and the PR head).

## Design differences (built page vs `option-b.html`)

| State / element | Mockup | Build | Deliberate? | Judgement |
| --- | --- | --- | --- | --- |
| Type chips | Organiser violet (`#c4b5fd` on `#6d5bd0`), Series teal (`#5eead4` on `#14b8a6`) | Neutral border, foreground text | Yes (build notes) | Fine; type is still read as a word. Contrast higher than the mockup. |
| Age chip, 0 days | "Waiting today" | "Waiting since today" | Not noted | Better English; keep. |
| Age chip, 7+ days | amber + warning mark | same (`border-primary`, `text-primary`, `⚠ `) | n/a | Matches. The `⚠` is a raw Unicode char in `QueueViews.tsx:27`; CLAUDE.md says use an entity (`&#9888;`) to survive the cp1252 round trip. |
| Needs-an-admin chip | `#fcd34d` on `#b45309` | primary amber on `border-primary` | Not noted | Fine. |
| Admin note on the bar | "An admin has to decide this one. Approve and Reject are off because you are part of it." on `#2a1f0a` / `#b45309` / `#fde68a` | "You are part of this series, so an admin has to decide it. Approve and Reject are off here. Nothing for you to do." on card bg / `border-primary/50` | Not noted | Build text is the mockup's shared `adminNote`; fine. |
| Review meta line | "Submitted 9 days ago · Bristol" | "Last changed 9 days ago · Bristol" | Yes | Right: the RPC's `submitted_at` is `updated_at`. |
| Approve sheet body | "... straight away. The organiser is told it was approved." | "... straight away." | Not noted | Right to drop: `_moderate_entity` writes an audit row and sends nothing; the mockup's sentence was unverified. |
| Reject sheet | identical copy, placeholder, counter, errors | identical | n/a | Matches. |
| Toast | green (`#14351f` / `#1f7a3a` / `#bbf7d0`), bottom 84 px | neutral card colours, `bottom-24` (96 px) | Not noted | Accidental drift; harmless. Toast appears on the list, never over the bar. |
| Error state | Try again + "Message an admin" | Try again only | Yes | Right (no contact route). |
| No access | "not an ambassador for Bristol"; "Sign in with another account"; "Message an admin"; lock glyph | "not an ambassador for any city"; "Back to the site" | Partly | Copy still says "Check you are signed in with the right account" with no control (F6). |
| Paused | calm empty state | dropped | Yes | Right (no RPC concept). |
| All caught up | "View Bristol on the site" | "Back to the site" (`/`) | Not noted | Scope has `city_slug`; link to `/city/<slug>` would honour the mockup. |
| Empty-state glyphs | ✓ ⚠ 🔒 ⏸ | none | Not noted | Fine. |
| Preview public page | on every review, `href="#"` | organisers only, `/organisers/<id>` | Yes | Leads to a 404 today (F2). |
| Loading | 3 skeletons at 84 px | 3 at 57 px | Not noted | Fine (row height). |
| 100-row page / Show more | not in mockup | added | Addition | Good; copy wrong across cities (F5). |
| "No longer waiting" deep-link state | not in mockup | added | Addition | Good. |
| Header, count pill, age bar, row (56 px min, chevron), sticky bar (`bg-background/95`, safe-area padding), sheet shell | as mockup | as mockup | n/a | Matches. |

Word-for-word, text that points at a control not on screen: "Check you are signed in with the right account" (no-access), "Refresh the list to see what is left" (gone error), "Open the public page to check it before you decide" (bare organiser, link 404s).

## Measurements (headless Chromium, 390x844)

MEASUREMENTS_PENDING

## Local CI verification

CI_PENDING

## Verified / Not verified

**Verified**
- Live bodies of `admin_approve_entity_v1`, `admin_reject_entity_v1`, `_moderate_entity`, `tg_enforce_lifecycle_transition`, `admin_get_my_city_scopes`, `admin_list_pending_review_v1`, `_is_city_ambassador`, `_self_serve_is_admin`, `is_admin`, `_actor_is_party_to_target_p5`; their ACLs (all four public RPCs are granted to `authenticated`); the `entity_members` and `organiser_profiles` SELECT policies; counts of scopes rows, city ambassadors, pending rows (0 organisers, 0 series), series with priced and non-GBP passes.
- Every error string reachable from the decision path, mapped against `decisionError`.
- The PR diff in full; `routesKey`'s single use; `CATCHALL_CLIENT_PATHS` consumers; `AuthGuard` redirect; `londonDate` helpers used; no `/ambassador` link outside the module.
- `main`'s Perf Budget run on the base commit fails the same job.
- The matrix and e2e specs read in full; mutation claims checked by reading.

**Not verified**
- F2 in a browser against prod (no ambassador account exists; concluded from the RLS policy text and the loader's client).
- Real iOS Safari / Android Chrome, the ~13.5 px root font on a phone, screen readers.
- Any live RPC response for an ambassador session (none exists on prod).
- Items marked pending in the two sections above if they read as such: the agents that produced them did not finish.
