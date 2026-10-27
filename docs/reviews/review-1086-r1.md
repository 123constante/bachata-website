# Review r1: Website PR #1086, ambassador A1 pending queue (option B) + Design Gate stage 5

Reviewer: independent model (Claude Fable 5.1), zero prior context, read-only. Branch reviewed: `claude/ambassador-a1-build` at `6240ab7` against `main` `dd8112f`. Design truth: `claude/ambassador-a1-mockups` (`docs/design/ambassador-a1.md`, `docs/design/ambassador-a1/option-b.html`). Live RPC bodies and policies read with the read-only Supabase connector (prod `stsdtacfauprzrdebmzg`; `SELECT` on `pg_proc`, `pg_policies`, `information_schema` and counts only; no personal data, no writes). Browser walk: headless Chromium (Playwright) at 390x844, deviceScaleFactor 2, network stubbed the way the PR's own spec does it; artefacts under this session's scratchpad (`walk/shots`, `walk/mock`, `walk/measurements.json`), not committed.

## Verdict: BLOCK

Two findings each stop the page working for the person it is built for:

- **F1** the access gate asks a table ambassadors are never written to, so the first real ambassador sees "No access to this queue".
- **F2** the approve/reject sheets and the toast are positioned against the route shell, not the viewport: on first open the sheet's buttons sit 106 px below the fold, the autofocus then scrolls the page by up to 492 px, and after a `self_approval_not_allowed` refusal the ambassador is left looking at a blank screen.

The rest is should-fix or minor. The code is otherwise careful (email dropped at the parse boundary, reason trimmed, decisions confirmed, no raw codes shown, dates handled on the London calendar) and both CI claims in the PR body hold, with one correction to the diagnosis.

## Findings, ranked

### F1 (BLOCK) The access gate reads the wrong authority: an ambassador gets "No access", a non-admin manager gets "Could not load the queue"

`src/modules/ambassador/ambassadorApi.ts:11` gates the whole page on `admin_get_my_city_scopes()`. The LIVE body of that function is:

```
SELECT c.id, c.name, c.slug FROM public.admin_manager_city_scopes s JOIN public.cities c ON c.id = s.city_id WHERE s.user_id = v_uid
```

`admin_manager_city_scopes` is the admin app's manager-scope table (scopes of `admin_link_managers`). The only function that writes it is `admin_update_sensitive_settings` (super-admin only, 20-character reason, re-auth window). Ambassadors are something else: rows in `entity_members` with `entity_type = 'city'` and `member_role = 'ambassador'`, written by `admin_add_entity_member_v1` (via `_entity_member_write_p5`). That is what every RPC the page then calls checks:

- `admin_list_pending_review_v1`: `EXISTS (... entity_members ... member_role = 'ambassador' AND entity_type = 'city')`, else `RAISE 'admin_only'`; rows filtered by `_is_city_ambassador(q.city_id, v_actor)`.
- `admin_approve_entity_v1` / `admin_reject_entity_v1`: same `entity_members` test, else `not_authorized`.
- `_moderate_entity`: `_is_city_ambassador(v_city, v_actor)` = `_is_entity_member('city', ..., ARRAY['ambassador'])`.

No function writes both tables. Live counts today: `admin_manager_city_scopes` has 1 row, for a user who is NOT a city ambassador; `entity_members` has 0 city ambassadors; 0 ambassadors have a scopes row.

Failing scenarios:

1. Jan is added as Bristol ambassador the A0a way (`admin_add_entity_member_v1('city', <bristol>, 'jan@...', 'ambassador')`). Jan opens `/ambassador`: scopes come back `[]`, `AmbassadorQueuePage.tsx:134` renders `NoAccessState`: "This account is not an ambassador for any city ... ask an admin to add you." The admin already did. The queue is never requested. Nothing on the page can recover.
2. The one user who has a scopes row today (a manager, not an admin, not an ambassador) opens `/ambassador`: scopes return their city, `admin_list_pending_review_v1` raises `admin_only`, and `AmbassadorQueuePage.tsx:136` shows `ErrorState`: "Could not load the queue. Check your connection and try again." Try again loops forever. A permission refusal is shown as a connection problem.
3. An admin (`admin_users`) with no scopes row sees "No access" although the RPCs would serve every city (`p_city_id` null). The PR body calls this by design; acceptable for A1, but it is the same root cause.

Why the tests did not catch it: `__tests__/harness.tsx:28` answers `admin_get_my_city_scopes` with Bristol unconditionally, so the matrix tests a contract the database does not have. The PR body's "Verified on real data" section says no live RPC was read.

Fix direction (no migration in this repo): the page needs its city list from `entity_members`. The RLS policy `entity_members_select` already allows `user_id = auth.uid()`, so a direct `from('entity_members').select('entity_id').eq('entity_type','city').eq('member_role','ambassador')` joined to `cities` works today without DDL; cleaner is a small `my_ambassador_cities_v1()` RPC authored in the admin repo. Map list errors separately from network errors (F5) so case 2 says "no access". The matrix needs a case where the scope source says yes and the list RPC says `admin_only`, and one where the scope source is empty but the user is an admin.

### F2 (BLOCK) Sheets and toast are positioned against the route shell, not the viewport

`PageTransition` animates `filter: blur(4px) -> blur(0px)` on its `motion.div.route-shell` (`src/components/PageTransition.tsx:12-17`) and framer-motion leaves `style="filter: blur(0px)"` on the element after the fade (also under `prefers-reduced-motion: reduce`). A filter other than `none` makes that element the containing block for `position: fixed` descendants. `DecisionSheets.tsx:27` (`fixed inset-0`) and the toast (`AmbassadorQueuePage.tsx:196`, `fixed bottom-24`) render inside the module, not through a portal, so "inset-0" and "bottom-24" are measured against the route shell, which starts below the site header and breadcrumb row (about 164 px) and is as tall as the page.

Measured at 390x844 (`walk/verify-fixed.json`, shots `d-approve-sheet`, `v-approve-sheet-overlay-extent`, `a1-review-needs-admin-party-note`, `g-toast-after-approve`):

- At scroll 0 the `decision-overlay` spans y 106 to 950 in an 844 px viewport: the sheet's bottom edge, where Cancel and "Yes, approve" live, is 106 px below the fold. The overlay also leaves the site header untouched above y 106.
- `autoFocus` on Cancel (`DecisionSheets.tsx:59`) and the textarea focus (`:74`) then scroll the window: 0 -> 92 on a bare-organiser review, 0 -> 492 on the series review. "Back to the list" ends at y = -291.
- After `self_approval_not_allowed` the sheet closes but scrollY stays at 492: the ambassador sees a blank area with the party note pinned at the top and the site footer below. The e2e spec passes this path because Playwright's visibility check ignores scroll position.
- Toast box y 830-868: its bottom 24 px are off-screen (`bottom-24` should put it near y 710; the mockup's sits at 720).

Every other overlay in the codebase that is rendered inside a route (`event-page/bento/EventStickyActionBar.tsx`, `StickyTicketButton.tsx`, `GalleryLightbox.tsx`, `organiser/edit-in-place/layers.tsx`) uses `createPortal` to `document.body`; the shadcn `Dialog`/`Sheet` primitives portal too. Fix: portal `SheetShell` and the toast to `document.body` (or use the existing `Sheet` primitive), drop `autoFocus` scroll side effects (`preventScroll: true`), and add a unit assertion that the overlay's bounding box equals the viewport. The mockup has none of this (plain fixed on body).

### F3 (should-fix, high) "Preview public page" leads to a 404 for every item in the queue, and the no-extras copy sends the ambassador there

`ambassadorModel.ts:165-169` links organisers to `/organisers/<targetId>`. That is a framework route: `app/routes/organiser.tsx:62` resolves the row in a server loader through `app/detailLoader.ts:41` (`getSupabase()`, the anon key, no user session). The live SELECT policy on `organiser_profiles` (`organiser_profiles_ss_select`) shows a non-live row only to admins, owner/manager members, or the city ambassador's OWN session. Every row in this queue is `pending_review`, and the server has no session, so the loader takes its "Soft 404" branch. The ambassador taps the one link the review screen offers and lands on Not found.

For a bare organiser this is the whole screen: `QueueViews.tsx:185-188` renders "No extra details were submitted. Open the public page to check it before you decide." and nothing else; the `Preview public page` link below it is the control that does not work. CLAUDE.md: copy never points at a control that cannot work; a control that cannot work is disabled with a reason.

Fix: for A1 drop the link and the sentence and show the organiser's own submitted fields in the review (the RPC does not return them today, so that is an admin-repo RPC change), or make the preview a client-side read under the ambassador's session (the RLS policy already allows it). Not exercised in a browser against prod (no ambassador exists); concluded from the policy text plus the loader's client, so PLAUSIBLE, not CONFIRMED.

### F4 (should-fix) The e2e spec passes with the whole module invisible

`tests/e2e/ambassador-queue.spec.ts:42` uses `page.clock.setFixedTime(NOW)`. A fixed clock freezes `performance.now`, so framer-motion's `PageTransition` never completes its fade and the module sits at `opacity: 0` for the entire test; Playwright's `toBeVisible` and `click` ignore opacity, so the three tests pass against a page no one could see. Measured: with `clock.setSystemTime(NOW)` (flowing clock) the page renders normally. Use `setSystemTime`, or `install({ time })` and advance it. The 44 px and scroll-restore assertions in that spec are otherwise sound and reproduced in my walk (rows 57.5 px, Back restores 650 -> 650 and 300 -> 300).

### F5 (should-fix) Error mapping vs the live error strings

Every string a non-admin ambassador can get from the decision path, from the live bodies, against `decisionError` (`ambassadorModel.ts:130-152`):

| Source | String | Mapping |
| --- | --- | --- |
| `admin_approve_entity_v1` / `admin_reject_entity_v1` | `not_authorized` | access (`not_authori`) ok |
| `admin_reject_entity_v1` | `reason_required` | reason ok; unreachable, the client refuses blanks first |
| `_moderate_entity` | `authentication_required` | **unmapped**: falls to "That did not go through ... Check your connection". A signed-out or expired session is told it is a network problem. |
| `_moderate_entity` | `unsupported_target_type` | other; unreachable from this UI |
| `_moderate_entity` | `not_authorised` (wrong city, or target missing: for a non-admin the city test runs BEFORE `target_not_found`) | access ok |
| `_moderate_entity` | `target_not_found` | gone ok (only admins ever see it) |
| `_moderate_entity` | `self_approval_not_allowed` | party ok |
| `_moderate_entity` | `not_pending_review` | gone ok |
| trigger `tg_enforce_lifecycle_transition` | `lifecycle_transition_denied: ...`, `review_required ...`, `city_required_for_review` | other; not reachable for an ambassador who passed `_moderate_entity` (same `_is_city_ambassador` and party tests) |
| PostgREST | `JWT expired` / 401 | other |

Also:

- The gone copy says "Refresh the list to see what is left" (`ambassadorModel.ts:143`) but there is no refresh control; the only refetches are the 60 s `staleTime` plus `refetchOnWindowFocus` from `src/App.tsx`. After a gone error the item stays listed and a second tap re-sends the decision. On gone, drop the item locally (as success does) or invalidate the queue, and make the sentence true.
- The LIST path (`AmbassadorQueuePage.tsx:133,136`) maps nothing: `admin_only`, `auth_required` (from `admin_get_my_city_scopes`) and a real network failure all render "Check your connection and try again. Nothing has been approved or rejected by this problem." See F1 case 2.

Self-approval, scenario-tested: approve on an item Jan is party to raises `self_approval_not_allowed` from `_moderate_entity` (after the city test, before the pending test); `onError` adds the key to `party`, closes the sheet; `ReviewView` swaps the bar for `partyNote`; the list row gains the chip. Correct, apart from the F2 scroll. `party` is component state, so a reload brings the buttons back (another tap gets the same refusal; harmless). The RPC gives the page no way to know an item is party BEFORE the tap, so the mockup's chip on first paint is not buildable until `admin_list_pending_review_v1` returns a flag; record as an A2 data gap.

Reason handling, verified in code and in the browser: `DecisionSheets.tsx:80` sends `text.trim()`, `ambassadorApi.ts:43` trims again; 15 spaces gives "Say why, so the organiser knows what to fix.", counter 0, no RPC; `"   ten chars!!   "` sends `{"p_reason":"ten chars!!"}`. The RPC's own `btrim` guard would refuse blanks anyway. The 10-character minimum is client-only (the RPC accepts one character); fine.

### F6 (should-fix) The "Your dancer profile is missing" banner draws above the queue

`src/lib/profileCompletion.ts:175` (`BANNER_HIDDEN_ON`) hides the finish-your-profile banner on `/auth`, `/account`, `/app` and `/finish-profile` but not `/ambassador`. For a signed-in user whose `_my_dancer_profile_id_v1` returns null, the banner takes 320 px of the 844 at the top of the queue (shot `x-list-with-no-dancer-profile-banner`). Whether real ambassadors have a dancer profile is unverified (none exists). Add the prefix to the list.

### F7 (should-fix, small) Sticky bar, breadcrumb link, title

- The review bar is `sticky bottom-0` inside the module. With the site footer (~800 px) below the module, scrolling past the module's end takes the bar off-screen (y -107 to -161 after `scrollTo(bottom)`); the mockup's bar stays because its page has no footer. Either portal/fix the bar or keep the review from being shorter than the viewport.
- `GlobalLayout`'s breadcrumb "Pending review" on the review and no-longer-waiting screens is the one `a[href]` to `/ambassador` outside the module (86 x 17 px, under 44). Site chrome, pre-existing pattern; noted for the "linked from nowhere" claim, which otherwise holds.
- `document.title` stays "Bachata London — Events, Classes & Parties Calendar" on every state.

### F8 (should-fix) Data shapes

- `priceText` (`ambassadorModel.ts:100-108`) always prints `£`. The RPC returns `price_currency` (upper-cased; NULL when a series mixes currencies) and the parser drops it. Live: 6 series have a priced pass, 2 of them non-GBP. A EUR 15 series reads "£15".
- Live organiser rows return `organiser_names`, `next_occurrence_dates`, `future_occurrence_count`, `has_flyer` as NULL (every `CASE WHEN rs.id IS NOT NULL` is NULL for an organiser). The parser handles NULL, but `__tests__/fixtures.ts:19` gives organisers `organiser_names: [name]`, so the "organiser with no extras" case renders an "Organiser: <its own name>" row prod never produces, and the real zero-row screen is untested.
- `QueueList` "This shows the first {items.length}. There may be more waiting." (`QueueViews.tsx:118`) counts across every scope city while `full` is per city: two cities, 100 + 30 rows, "This shows the first 130". The next `p_offset` is also sent to the exhausted city (one wasted request per page).
- Ordering: the RPC returns newest first; `sortOldestFirst` re-sorts the flattened pages, stable on ties, NULL `submitted_at` last; correct across cities and pages (the 100-row test checks it).
- Time zone: `submitted_at` goes through `parseUtcIso`; `waitingDays` compares `londonDateKey`s via `londonDaysBetweenKeys` (UTC-noon arithmetic); `dateLabel` splits the key and uses `weekdayOfKey`. No `new Date('YYYY-MM-DD')` in the module. Browser check: at 12:00Z on 27 Oct, items changed 7 x 24 h ago and 6 d 23 h ago both read "⚠ Waiting 7 days" (amber, warning mark); at 23:30 London both read "Waiting 6 days" because 7 x 24 h before that is 00:30 BST on 21 Oct, across the 25 Oct clock change. Calendar-day semantics, consistent with the age bar; fine.
- `now` is captured once at mount (`AmbassadorQueuePage.tsx:47`); a tab left open over midnight keeps yesterday's counts until reload. Minor.

### F9 (should-fix, small) Copy that points at a control that is not on screen

- No-access state (`QueueViews.tsx:65`): "Check you are signed in with the right account" with no sign-out or switch control; the mockup had "Sign in with another account". Add a sign-out link or drop the sentence.
- Gone error: "Refresh the list" (F5).
- No-extras organiser: "Open the public page to check it before you decide" (F3).

### F10 (minor) State and React Query

- After a decision `setQueryData` filters the item out of every page (`AmbassadorQueuePage.tsx:111`); nothing is invalidated. Fine for one ambassador per city; two people on the same city hit F5's gone path.
- Double tap: `busy={decide.isPending}` disables Confirm. Measured: two `click()` in the same tick send 2 approve RPCs; 30-40 ms apart send 1. A physical double tap cannot land in one tick, so this is a one-line guard (`if (decide.isPending) return`) rather than a bug.
- Offline/slow: the sheet keeps its buttons disabled with "Approving..."/"Sending..." until the RPC resolves; mutations do not retry. The `other` copy "Nothing was changed" is true only if the request never reached the server; a request that landed and timed out on the way back leaves the item listed, and the next tap gets `not_pending_review` (F5).
- `routesKey` (`AnimatedRoutes.tsx:103-107`) has one use, `key={routesKey(location.pathname)}` at line 115, and returns `pathname` unchanged for everything except `/app*` and `/ambassador*`; no other route is affected. Consequently `PageTransition` does not animate between list and review, which is intended; it also means the route shell's leftover `filter` (F2) is the same element for both screens.
- Back/Forward: `openReview` records `scrollY`; `backToList` uses `navigate(-1)` only when `state.fromList`, else replaces to `/ambassador`; the two-pass restore works (650 -> 650, 300 -> 300). Deep link then Back goes to `/ambassador` via `replace`, so the browser's own history is not polluted. Good.
- `Escape` closes a sheet unless busy; no focus trap and no return of focus to the trigger (screen-reader behaviour was unverified in the mockups and still is).

### F11 (minor) Tests and lint

- Mutation claims hold by reading: rendering the email anywhere turns test (a) red (`document.body.innerHTML` check, `queue.matrix.test.tsx:342`); lowering `MIN_REASON_LENGTH` below 10 turns the "9 of 10" assertion and test (b)'s `'123456789'` case red.
- The matrix is NOT table-driven over screens x shapes: about 33 hand-written `it` blocks plus one `it.each` of four error codes. Untested shapes: multi-city scopes, the 7-day boundary, currency, an organiser row with NULL series fields (F8), `reason_required`, `authentication_required`, the gone path's refresh sentence, `admin_only` from the list RPC (F1), any overlay geometry (F2).
- `agoIso` uses 24-hour arithmetic while the page counts London calendar days, so a run that straddles midnight can flip "today"/"1 day"; pin `now` in the harness.
- e2e: stubs at the network layer (`page.route('**/rest/v1/**')`, `**/auth/v1/**`), fakes the session in `localStorage`, asserts the RPC bodies and that `page.content()` has no email; joined `test:e2e` by name in `package.json`; 3 passed locally (1.3 min) and in CI. It covers no error state and not the 100-row page, and see F4.
- `npx eslint` on the module: 1 error, `react-hooks/static-components` at `__tests__/harness.tsx:18` (`Where` is declared inside `Page()` and rendered as a component); 5 `react-refresh/only-export-components` warnings. The repo's `eslint .` link is informational, but `scripts/pre-ship.mjs` runs eslint scoped to the changed files with `blocking: true`, so this error reds `npm run pre-ship`.
- `tsc -p tsconfig.app.json`: one new error in a PR file, `queue.matrix.test.tsx:28` (`window.scrollTo = vi.fn()` typing); the pre-ship count ratchet (baseline 106, measured 87 excluding `+types` noise) would not red on it.

### F12 (verified, with a correction) CI claims in the PR body

- **bundle-budget.** The failure is real and pre-exists the PR, but the PR body misdiagnoses it. `main`'s own Perf Budget run for the base commit `dd8112f` (run 40538380399) already fails the `bundle-budget` job; the previous main run (`4c683ce`) passed. Locally, with the workflow's env, both trees fail on the same single verdict: `dancer-app (/app/*)` first-load JS over `maxFirstLoadGzipKB`: main 374.1 KB vs 374, PR 374.5 KB vs 374. The "vendor-supabase 57.3 KB vs 43 KB baseline" line the PR body quotes is report-only in `scripts/check-bundle-budget.mjs` (the attribution report never exits 1), and `vendor-supabase` is byte-identical on both trees (same hash, 57.3 KB). The PR does add 0.3-0.4 KB to every route: `vendor-query` 13.7 -> 14.0 KB gz, because the ambassador module is the repo's first non-test consumer of `useInfiniteQuery`, and `vendor-query` is a manual chunk on every first load; plus `AnimatedRoutes` 5.9 -> 6.0 KB. The new chunk `AmbassadorQueuePage-*.js` is 7.1 KB gz, imported only dynamically, in no route's first-load graph; chunk counts (37/41/27/49/42/42/24/24/24) and puller counts are unchanged on every route; `check:first-load-requests` and `check:chunk-cycles` pass on both. So: not this PR's failure, but this PR's `useInfiniteQuery` costs every route 0.3 KB; a plain `useQuery` with a local offset state (the page already re-sorts all pages itself) would cost nothing.
- **Unit failures.** Verified identical: main and PR both fail 4 files / 15 tests (`eventViewCompat.contract`, `occurrenceProgram.contract`, `publicEventPageLineup.contract`: no live key; `integrityCouldNotRun`: sandbox precondition). The PR adds one file, 33 passing tests. CI's `unit (Europe/London, full)` on the PR head is green.
- **contract-check** is red on the PR head and red on main's last three runs of `db-contract-check.yml` (including `dd8112f`); not this PR's (it changes no contract script). The failing step was not identified here.

## Design differences (built page vs `option-b.html`)

| State / element | Mockup | Build | Deliberate? | Judgement |
| --- | --- | --- | --- | --- |
| Overlay geometry | sheets and toast fixed to the viewport | fixed to the route shell (F2) | No | Blocking. |
| Type chips | Organiser `#c4b5fd` on `#6d5bd0`, Series `#5eead4` on `#14b8a6` | white on `#333` border, same for both | Yes | Fine; type reads as a word; contrast higher. |
| Age chip, 0 days | "Waiting today" | "Waiting since today" | Not noted | Better English; keep. |
| Age chip, 7+ days | amber + `⚠` | amber `rgb(255,166,0)` text and border, weight 600, `⚠ ` | n/a | Matches. `⚠` is a raw Unicode char (`QueueViews.tsx:27`); CLAUDE.md asks for an entity (`&#9888;`). |
| Needs-an-admin chip | `#fcd34d` on `#b45309` | amber on amber border | Not noted | Fine. |
| Admin note on the bar | "An admin has to decide this one. Approve and Reject are off because you are part of it." `#fde68a` on `#2a1f0a`/`#b45309` | "You are part of this series, so an admin has to decide it. Approve and Reject are off here. Nothing for you to do." white on `#121212`, `rgba(255,166,0,.5)` border | Not noted | Build uses the mockup's shared `adminNote` wording; fine. |
| Review meta | "Submitted 9 days ago · Bristol" | "Last changed 9 days ago · Bristol" | Yes | Right: the RPC's `submitted_at` is `updated_at`. |
| Age bar on the review screen | shown | list only | Not noted | Fine; the chip carries it. |
| Back button | bordered ghost box | borderless, 134 x 44 | Not noted | Fine. |
| Approve sheet body | "... straight away. The organiser is told it was approved." | "... straight away." | Not noted | Right to drop: `_moderate_entity` writes an audit row and sends nothing. |
| Reject sheet | copy, placeholder, counter, errors | identical copy; textarea `#000`, invalid border `#ef4444`, error text `#ef4444` (4.98:1 on `#121212`) | n/a | Matches; mockup used `#f87171` (6.54:1). Still AA. |
| Decision error in the sheet | no state | "This one is no longer waiting..." + Try again | Addition | Copy issue in F5. |
| Toast | green `#14351f`/`#1f7a3a`/`#bbf7d0`, bottom 84 px | neutral card, `bottom-24`, clipped (F2) | Not noted | Colour drift harmless; position is F2. |
| Error state | Try again + "Message an admin" + `⚠` | Try again only | Yes | Right (no contact route). |
| No access | "not an ambassador for Bristol"; "Sign in with another account"; "Message an admin"; lock | "not an ambassador for any city"; "Back to the site" | Partly | Copy still points at a missing control (F9). |
| Paused | calm empty state | dropped | Yes | Right (no RPC concept). |
| All caught up | "View Bristol on the site" + `✓` | "Back to the site" to `/` | Not noted | Scope has `city_slug`; `/city/<slug>` would honour the mockup. |
| Preview public page | every item, `href="#"`, muted underlined | organisers only, amber, no underline | Yes | 404s today (F3). |
| Loading | 3 skeletons at 84 px | 3 at 57 px | Not noted | Fine. |
| 100-row page / Show more; multi-city city line; "No longer waiting" | not in mockup | added | Additions | Good; copy wrong across cities (F8). |
| Header, count pill, row (56 px min; 57.5 measured, 78.5 two-line), chevron, sticky bar (`rgba(0,0,0,.95)`, safe-area padding), sheet shell | as mockup | as mockup | n/a | Matches. |
| Site chrome | none | header + nav (106 px) + breadcrumb row (58 px) above the module | n/a | Expected; it is why F2 lands where it does. |

Word for word, text that points at a control not on screen: "Check you are signed in with the right account" (no-access), "Refresh the list to see what is left" (gone error), "Open the public page to check it before you decide" (bare organiser; link 404s).

## Measurements (headless Chromium, 390x844; observed `html` font-size 13.572 px, body bg `#0e1215`)

| State | scrollWidth/clientWidth | Min tap in module | Lowest contrast (text) |
| --- | --- | --- | --- |
| list, 12 items + needs-an-admin | 390/390 | 57.5 (rows) | 8.19 "Bristol" `#ababab` |
| review, party note | 390/390 | 44 | 8.19 |
| review, series 13 dates | 390/390 | 44 | 5.58 "Reject" `#ef4444` on `#000` |
| review, long name, £5–£12 | 390/390 | 44 | 5.58 |
| review, bare organiser | 390/390 | 44 (Preview link 369.7 x 44) | 5.58 |
| approve sheet | 390/390 | 44 | 5.58; sheet copy 8.16 |
| reject sheet, empty error | 390/390 | 44 | 4.98 "Say why, so the organiser knows what to fix." |
| reject sheet, too short | 390/390 | 44 | 4.98 |
| toast after approve | 390/390 | 57.5 | 16.1 (toast) |
| empty / error / no access / loading / no longer waiting / 100 rows / decision error | 390/390 | 44 | 8.19 (4.98 for the decision error text) |
| multi-city, 16 rows | 390/390 | 78.5 | 8.19 "Bristol and Bath" |

All text at or above WCAG AA 4.5:1; the mockup's equivalents are higher (6.54 to 9.14) because it lightened the red to `#f87171`. No sideways scroll in any state. Every tap target in the module is at least 44 px; the only smaller taps are site chrome (breadcrumb 86 x 17, footer links 14-17 px tall), pre-existing. Sticky bar: y 482-536 at the review's initial scroll (in viewport), off-screen after scrolling into the footer (F7). Toast and bar are never on screen together. Scroll restore: 650 -> open row 10 -> Back -> 650; 300 -> 300. Double tap: same tick 2 RPCs, 30-40 ms apart 1 (F10). `<meta name="robots" content="noindex,nofollow">` present on every state.

## Verified / Not verified

**Verified**
- Live bodies of `admin_approve_entity_v1`, `admin_reject_entity_v1`, `_moderate_entity`, `tg_enforce_lifecycle_transition`, `admin_get_my_city_scopes`, `admin_list_pending_review_v1`, `_is_city_ambassador`, `_self_serve_is_admin`, `is_admin`, `_actor_is_party_to_target_p5`, `_entity_member_write_p5`, `admin_update_sensitive_settings` (head); ACLs (the four public RPCs are granted to `authenticated`); the `entity_members` and `organiser_profiles` SELECT policies; counts of scopes rows, city ambassadors, pending rows (0 organisers, 0 series), series with priced and non-GBP passes; `admin_manager_city_scopes` is a table, not a view.
- Every error string reachable from the decision path, mapped against `decisionError`; reason trimming and blank refusal in the browser.
- The PR diff in full; `routesKey`'s single use; `CATCHALL_CLIENT_PATHS` consumers; `AuthGuard` redirect; `londonDate` helpers; no `/ambassador` link outside the module except the layout breadcrumb.
- Browser walk of 15 states at 390x844 with stubbed RPCs; the PR's own spec run locally (3 passed) and with a flowing clock; overlay geometry; tap sizes; contrast; scroll restore; double tap; 7-day boundary across the clock change.
- CI: `main` fails `bundle-budget` and `contract-check` at the PR's base commit; local bundle-budget on both trees with the workflow env (dancer-app 374.1 vs 374.5 KB over a 374 budget); unit suites on both trees (same 4 files / 15 tests); eslint and tsc on the PR files. PR head check runs: green `unit` x3, `e2e-smoke`, `build-smoke`, `integrity`, `phone-qa`, `phone-qa-section` (latest), `real-data-verified` (latest), `dancer-area-isolation`, `wallclock-brand`, `masking-check`, `bom-check`, `notification-check`, `live-db-gate`, `canary` x3; red `bundle-budget`, `contract-check` (both red on main); skipped `lighthouse`, `doc-weight`, `seo-*`, `og-*`, `synthetic*`, `measure` x3.

**Not verified**
- F3 in a browser against prod (no ambassador account exists; concluded from the RLS policy text and the loader's client).
- Any live RPC response for an ambassador session (none exists on prod); the dancer-profile banner (F6) on a real ambassador account.
- Real iOS Safari / Android Chrome, the ~13.5 px root font on a real phone, screen readers.
- Which step reds `contract-check` on main.
- The mockup's "13 dates + long name + price range" in one item was walked as two fixture items.
