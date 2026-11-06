# Review -- Website PR #1455 (ambassador shared link `/join/a/:code`)

Reviewer: independent, read-only. Reviewed head `3e1bf99f` (`claude/bristol-ambassador-landing`) against `origin/main` 900a4d5. Code not run; read plus diff only. Ticket dt_0d28fd8e03a0.
Paths below are on the PR branch. `AmbassadorLinkPage.tsx` = L, `linkLandingModel.ts` = M, `linkApi.ts` = A (all in `src/modules/ambassador/link/`).

## Verdict: SAFE AFTER FIXES

Findings: 0 high, 2 medium, 4 low. No finding is a data leak by the client code. The server half (what the RPCs return for off or `admin_locked` codes) is outside this repo and is UNVERIFIED here.

## Answers

### 1. Public route safety
- An anonymous visitor can: call `get_ambassador_link_public_v1(p_code)` (A:11) and read `cities` by slug (A:24). Nothing writes on load (matrix test "never writes on render", test L119).
- Shown data: ambassador FIRST NAME (heading, M:74-77), city name. No joiner data, no other person's data: `parseLookup` (M:80-87) copies only `first_name`, `city_name`, `city_slug`. PROVEN.
- The ambassador's first name is visible to anyone who holds the code. That is by design (the heading says "Jan invited you"), but it is a disclosure to the unauthenticated, so the owner should know. PROVEN (design), see finding L3.
- Wrong, malformed or off code: `not_found` renders one fixed sentence, "switched off or wrong" (M:50-51), so it cannot tell wrong from off. Empty or >64 chars is never sent (M:105-108, L:35-38). PROVEN client side.
- Expired / switched-off / `admin_locked`: the client only knows `{status:'not_found'}`; any other status throws, which lands in the generic error state ("We could not open this link", M:48), not an existence leak (M:86). If the server returned `status:'locked'` the page would show the error state with a Try again button that can never succeed. SUSPECTED, needs the admin RPC body: confirm `admin_locked` returns `not_found`.
- RPC error state offers "Try again" (`lookup.refetch`, L:82) only; a thrown error message is never displayed. PROVEN.

### 2. Join tap
- RPC: `record_ambassador_link_join_v1` with `{ p_code: code }` (A:17, test asserts args at matrix test:144). Only from the button (L:50-55). PROVEN.
- Double tap = one call: `inFlight` ref (L:43,51) plus disabled while pending. Test covers it. PROVEN.
- Second join (idempotent): relies on the SERVER returning `already_joined`; client renders "You already joined" (M:119). The page state is local, so after a reload the Join button shows again and a tap yields `already_joined`. Works, but a returning joiner is invited to join again (finding L2). Server idempotency per design doc only, not re-read here.
- Own link: NOT detected before the tap. The viewer sees an enabled "Join" and only learns after tapping, from the raised `own_link` (M:158-160, L:47). No dead end (button disabled with a reason), but it is a wasted write attempt and a confusing first impression for the ambassador testing their own link (finding M2).
- Signed out: Create account / Sign in with `returnTo` (M:142-154). Anonymous session: same layout plus a sentence (M:148). Server `authentication_required` also maps to it (M:141). PROVEN.
- RPC error (network, unknown code): `failed` -> "Check your connection, then tap Join again", Join stays enabled (M:166, test L216). No dead end. BUT every unexpected server refusal (including a missing dancer profile, if the RPC requires one) says "check your connection", which is wrong and loops (finding M1).
- No-profile: the page is NOT behind `DancerProfileGate` (that gate only exempts `/invite`, `DancerProfileGate.tsx:24-31`, and `/join` is not a gated path), so a signed-in user without a profile reaches Join. Whether the RPC accepts them is unknown here. SUSPECTED.

### 3. Routing
- `AnimatedRoutes.tsx:293-294` adds `/join/a/:code`, lazy via `lazyWithRetry` (:65). `catchallClientPaths.ts` adds the same pattern; the PR fixed the `catchallClientPaths` test for it. No existing `/join` route on main (grep empty), so no conflict with `/invite` or `/ambassador/*`. PROVEN.
- SEO: `useNoindexMeta(true)` (L:25) plus a `no-referrer` meta (L:26-32), same as `/invite`. `public/robots.txt` and the sitemap have no `/invite` entry, so nothing to mirror. The noindex is client-set after JS runs; a crawler that does not run JS sees the SPA shell. Same as `/invite`, low (L4).
- Breadcrumbs: `buildBreadcrumbs('ambassador.link')` (L:70) with id added at `siteIa.ts` (label "Your invite", no path). Follows the rule. PROVEN.
- The referrer meta and noindex are removed on unmount; a code in the URL is not sent onward via Referer for same-tab navigations after mount. The WhatsApp "Contact us" link embeds `window.location.href` including the code (L:65), sent deliberately to the site's own WhatsApp. Acceptable.

### 4. types.ts
Diff is 5 added lines: `get_ambassador_link_public_v1` and `record_ambassador_link_join_v1`, both `{p_code: string} -> Json`, alphabetically placed in generator format. No other edits. PROVEN from the diff. Hand-written, not generated: the handover admits `types-drift` CI is red from pre-existing drift, so a regen would add more. A regen by the owner will overwrite these two lines, harmless if the signatures match (`p_code text -> jsonb`).

### 5. Design record
The 12 screenshots (01 loading, 02 signed-out named, 03 signed-out no name, 04 not found, 05 error, 06 signed-in invite, 07 joining, 08 joined, 09 already joined, 10 own link, 11 anonymous, 12 join failed) cover the `LandingKind` values and the notices. States the code can render with NO picture:
- viewer `resolving` (Join disabled, "Checking whether you are signed in...", M:160). Tested, no screenshot.
- not_found WITH the `linkGone` notice (M:134: link switched off between load and tap). Tested, no screenshot (04 is the plain one).
- signed-out via server `authentication_required` is the same layout as 11, fine.
- Chip fallback: `city.data?.name ?? view.city` (L:67) when the `cities` read fails. Untested and unpictured (finding L5).

### 6. Tests (behaviour, not snapshots)
Behavioural: the 3x4 viewer x shape matrix drives the real page against mocked RPC results and asserts state, heading, buttons, hrefs, join count. Good. Mutants:
1. Drop the own-link guard (render Join as enabled after `own_link`, i.e. drop `|| own` at M:159): CAUGHT by "own link" test, which asserts the button is disabled and shows `COPY.ownLink` (test L:177-186). If the mutation instead dropped client handling of the RAISE, same test catches it. Note: there is no pre-tap own-link state, so there is no guard to drop beyond this one.
2. Drop the `already_joined` branch (M:119, always the joined heading): CAUGHT by the already-joined matrix rows, which assert "You already joined Testville" (test L:111).
3. Show the name when absent (heading prints `undefined`/empty name, M:74-77, or `parseLookup` keeps `''`): CAUGHT for `okNoName` (heading must equal "You are invited to Testville", L:95) and the `'  '` blank case (L:228-230). A mutant that uses a name when `first_name` is NULL AND the server's `city_name` ... same tests. CAUGHT.
Weak spots: no test that the page never renders the joiner's id or email (nothing renders it, so low); no test for the chip-fallback path; the matrix mocks `GlobalLayout` and `useNoindexMeta`, so the noindex/no-referrer metas and breadcrumb id are untested.

### 7. Shell load / bundle
Route is lazy, no import from the app shell besides the route table (two lines). `catchallClientPaths.ts` and `siteIa.ts` are small string additions in modules already in the shell. No new request on normal load; the page's own requests happen only on `/join/a/*`. Bundle jump in the shell: expected negligible. NOT MEASURED here: no build was run, and `perf-budgets.json` / the puller ratchet is the enforcement; confirm CI `check:bundle-budget` is green on the PR.

## Findings, ranked

### M1 (medium, PROVEN client / SUSPECTED server) Unknown refusals show "Check your connection"
`joinRefusal` (M:98-102) maps anything but three codes to `failed`; the copy blames the connection (M:68). If the RPC raises anything else (profile required, link locked, rate limit), the person loops forever. Minimum fix: add a fallback sentence that does not blame the network on a non-network error (keep "Check your connection" only for fetch failures), and decide with admin which other codes can be raised; map each.

### M2 (medium, PROVEN) Own link only discovered after a wasted tap
Join is offered to the ambassador themselves; the own-link state (M:158) is reachable only after a server round trip. The design doc shows it as a first-class state. Minimum fix: either accept and say so in the doc, or have the public RPC return `is_own` for a signed-in caller. If the RPC cannot, leave as is and add the screenshot's caption "after tapping".

### L1 (low, SUSPECTED) `admin_locked` / unknown status
Any new `status` from the public RPC throws and becomes the generic error with a pointless Try again (M:86). Minimum fix: treat unknown `status` as `not_found`, or confirm with admin #1277 that only `ok` / `not_found` exist.

### L2 (low, PROVEN) Returning joiner is shown Join again
State is client-only; no pre-check of prior membership, so a reload invites a second tap. Server idempotency makes it safe. Minimum fix: none required; mention in handover.

### L3 (low, PROVEN) Ambassador first name is public to any code holder
By design. Minimum fix: owner confirms; no code change.

### L4 (low, PROVEN) noindex is client-side only
Same as `/invite`; robots.txt has no rule for `/join/`. Minimum fix: add `Disallow: /join/` to `public/robots.txt` if the owner wants crawler protection beyond meta.

### L5 (low, PROVEN) Untested/unpictured fallbacks
`resolving` viewer, switched-off-after-load notice, chip fallback, plus the page's metas and breadcrumb id. Minimum fix: add the two screenshots to the record and one test for the chip fallback.

## Also noted (not findings)
- Done button goes to `/app` (dancer area) while the copy says "organiser area"; the PR already flags this as an owner question (`NEXT_STEP_HREF`, M:44). Treat as blocking-for-copy, not for safety.
- `types-drift` CI red pre-exists on main per the handover; not caused by this PR.

## Not verified
Admin RPC bodies (admin repo not available here), prod data, CI results, a real build or bundle sizes, and any run of the page or tests.
