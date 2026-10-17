# Review of B1b (Website): `claude/dancer-app-r1b` at d9828bda

Reviewed against `origin/main` c36fbafd. This is a read-only review: no product code was changed.

Everything here was checked against the code, a real build, and prod (read-only SELECTs, counts only). Dancers are named only as "slug A..F"; no personal data appears in this doc.

**Verdict: NOT ready to merge.** Three CI jobs go red on the merged head: dancer-area isolation, bundle budget and e2e-smoke. The integrity job also fails one image check. One real-data bug shows raw language codes ("es", "en") on the public page, and that page goes live to everyone the moment this merges.

## Findings

| ID | Severity | Where | What is wrong | How to fix (one sentence) |
|---|---|---|---|---|
| F1 | BLOCKER | `scripts/dancer-area-isolation-allowlist.json:274-275` | `npm run check:dancer-area-isolation` exits 1 with 7 violations. **(a)** Protected files were changed: `src/pages/DancerProfile.tsx`, `app/routes/dancers.tsx`, `src/pages/FestivalHub.tsx`. **(c)** Four imports come from non-seam files: dancers.tsx→`public-page/loadPublicPage`, DancerProfile.tsx→`public-page/PublicDancerPageV2` + `public-page/model`, FestivalHub.tsx→`gate/useGoingLock`. So it is not only FestivalHub: the two S2 files fail too. | Apply the exact allowlist edit under "Q4" below, and record a B1b round in `INTERFACE.md`, which still lists all three files as protected. |
| F2 | BLOCKER | `src/modules/dancer-app/gate/useGoingLock.ts` (build graph), `vite.chunks.ts` | `check:bundle-budget` exits 1 on the merged head and on S1 alone (0c63351). The chunk ratchet is auth 34 > 33 and dancer-app 59 > 57; the puller ratchet is auth 3 > 2 and dancer-app 4 > 3. Cause: `useGoingLock` is imported from the RsvpBlock and festival chunks, so rollup splits `useDancerArea` into its own chunk, and the routes shell gains a static `vendor-supabase` import. The size (KB) budgets all pass. | Pin `gate/useDancerArea.ts` and `gate/useGoingLock.ts` into an existing manual chunk group in `vite.chunks.ts`, then re-measure; do not just raise the allowances. |
| F3 | BLOCKER | `tests/e2e/dancer-app/home-nights.spec.ts:67-68` vs `screens/home/PartnerTile.tsx:5` | S3's "Partner search: coming soon" tile, which its brief asks for, trips the older L12 assertion `getByText('Coming soon')` count 0. `npm run test:e2e` has 4 failures, all at this line. S3's handover says it never ran e2e. | Update the spec so it expects the partner tile and the new numbers tiles; the brief decided on the tile, so the text stays. |
| F4 | MAJOR | `public-page/model.ts:137`, `PublicDancerPageV2.tsx:185-186` | The new "Speaks" section prints raw stored values. On prod, `dancer_profiles.languages` holds ISO codes (en=11, es=9, it=1, de=1, across 12 live profiles). Rendered prod pages for slugs B, C and D literally show chips reading "es" and "en". The tests miss it because every fixture uses full names (`__tests__/shapes.ts:31-32`: 'English', 'Spanish'). | Map codes to names in the model with `new Intl.DisplayNames(['en'], {type: 'language'})`, and add an `en`/`es` shape to `shapes.ts` (red-first). |
| F5 | MAJOR | `src/modules/dancer-app/gate/useGoingLock.ts:12-18` (comment) and the S1 handover | The comment says "the server already refuses them with `profile_incomplete`". That is not true on prod: neither `set_my_occurrence_attendance_p5_v1` (the event block) nor `set_attendance` (the festival hub) checks completeness. Only `rate_series_level_p5_v1` and the organiser functions do. So the lock exists only in the browser: "unlocked when unsure" (loading or error) lets the RSVP through, and so does a direct call. | Tell the owner the lock is browser-only and fix the comment; if a real lock is wanted, add the refusal in an admin-repo migration. |
| F6 | MAJOR | `PublicDancerPageV2.tsx:123` | The portrait `<img>` has no `loading` attribute, so `AUDIT_STRICT=1 npm run check:images` fails (integrity job). The S2 handover's "0 missing" claim is wrong at the merged head. | Add `loading="eager"`, since it is the image at the top of the page. |
| F7 | MAJOR | `screens/home/HomeScreen.tsx:153-156` vs `screens/home/NumbersTiles.tsx:142` | Home shows "going" counts from two different sources. The "Upcoming nights" tile uses `countCommitted(nights.upcoming)`, which is `get_my_event_attendance_v2` filtered on series `lifecycle_status='live'` with no check for a cancelled night. The new strip uses `my_dancer_stats_v1`, which counts occurrence `lifecycle_status='scheduled'` with no series check. A person going to a cancelled night (prod has 138 cancelled occurrences) or to an ended series sees two different numbers on one screen. Today's 5 prod attendance rows do not trigger it yet, but the shapes exist. | Take the tile's number from `numbersFrom`, or put both on one predicate, and add a test that the tile equals the strip. |
| F8 | MAJOR | `screens/page/PageScreen.tsx:98-99` | The "Edit my profile" and "Account settings" fix links have no `minHeight` or `da-tap`, so they are inline 14px text, well under a 44px tap target. They are the only way forward when View and Share are disabled. | Add `className="da-tap"` (or `minHeight: 44`). |
| F9 | MINOR | `RsvpBlock.tsx:122-127` | When the person is locked AND their RSVP status read fails (`status` = null), both buttons are disabled. The existing "Couldn't load your RSVP" retry in `onTap` (around :137-140) can then never run, so an old RSVP cannot be removed until a reload. Real shape: the one locked person with RSVPs holds 2 going and 1 interested. | When locked and the status is unknown, leave the buttons tappable so the retry path runs. |
| F10 | MINOR | `useGoingLock.ts:55-60`, `RsvpBlock.tsx:189`, `FestivalHub.tsx:549` | Interested is locked too, but the reason says only "…to say you're going". In RsvpBlock the lock line replaces the going-count line. On FestivalHub the same sentence repeats under every festival card. | Say "to say you're going or interested" (or "to RSVP"), and show the hub's lock once, above the list. |
| F11 | MINOR | `useGoingLock.ts:46-49` | `missingFromGate` works out the missing fields by matching the rating card's reason text. If that copy changes, it silently falls back to the general reason. | Read the missing fields from the gate's data, not from display text. |
| F12 | MINOR | `NumbersTiles.tsx:159-162`, `PageScreen.tsx:68-70` | When numbers fail (including `no_profile` and `area_closed`), both screens say only "Check your connection…". `/app/page` also says "try again" but has no Try again button (Home has one at NumbersTiles.tsx:164). | Show `toDancerError(error).message`, and add the same refetch button on `/app/page`. |
| F13 | MINOR | `feedbackModel.ts:16` | `FEEDBACK_CLOSED` points at "Help and message us", but that row sits on the Options screen behind the open sheet. | Put a message-us link inside the error, or say "close this and use Help and message us". |
| F14 | MINOR | `feedbackModel.ts:25`, `FeedbackSheet.tsx:88-94` | While sending, "Sending…" shows twice: on the button and as the disabled reason. `aria-describedby="feedback-why"` stays on the button after the reason element is gone. | Return no reason while sending, and set `aria-describedby` only when a reason shows. |
| F15 | MINOR | `api/errors.ts:20`, `PartnerTile.tsx:14,23,27` | PartnerTile reuses the shared `rate_limited` copy ("Wait a few minutes"), but that function's limit is 1 per 30 days. The `invalid_feature` copy says "Try again later" for something the person cannot change. The button is disabled with no reason while its status loads. | Give PartnerTile its own rate and invalid messages, and label the button "Loading…" while it waits. |
| F16 | MINOR | `public-page/model.ts` `whatsappHref` | A number with no "+" and no leading 0 (e.g. "7700900123"), or one written "+44 (0)7700…", builds a wrong wa.me link. Prod has 0 public WhatsApp numbers today. | Drop a "(0)" after the country code, and hide the button for numbers it cannot normalise. |
| F17 | MINOR | `app/routes/dancers.tsx:38,68`, `loadPublicPage.ts:37-40` | WhatsApp, bio and languages now ride in the edge-cached HTML (s-maxage 3600 + swr 86400). `save_my_dancer_profile_v2` purges on save. But WhatsApp eligibility also depends on the person's OTHER profiles (`_dancer_whatsapp_eligible_v1`), and nothing purges when those change. Separately, extras are fetched on every cache miss even when the flag is closed, then thrown away. | Emit the dancer purge when an eligibility-giving profile changes, and fetch extras only after the gate says open. |
| F18 | MINOR | `PublicDancerPageV2.tsx:151` | A nameless profile (2 live on prod) shares as "Dancer on Bachata Calendar". It is not wrong, but the owner may want different wording. | Use a neutral share title when there is no display name. |
| F19 | MINOR | `/dancers/:id` first load | One more first-party chunk is preloaded: `lib-account`, 5.3 KB (48 → 49 modulepreloads). The route has no budget in `perf-budgets.json`, so no gate notices. | Accept it and note it, or budget the route. |
| F20 | MINOR | `perf-budgets.json` (`//dancer-app-2026-10-17-b1b-s3`) | The dancer-app KB budget was loosened from 363 to 368, measured on S3 alone. The merged head is 367.0 KB, and the note describes S3, not the merge. | Re-measure after F2 and rewrite the note. |
| F21 | MINOR | `gate/__tests__/goingLock.test.tsx:96,99` | New TypeScript errors TS2322 and TS2352 (typecheck is not a CI gate). | Type the mock as `ProfileGateValue` and fix the occurrence fixture's type. |
| F22 | MINOR | `api/rpc.ts` (`rpcLoose`), `src/integrations/supabase/types.ts` | None of the 5 new functions are in the generated types, and no `scripts/check-*` contract covers them, so a rename on the database side would not fail the build. | Regenerate the types, or add a contract check. |

## Answers to the brief's questions

### Q1. Public page v2, old vs new
- **How:** both builds were rendered for real against prod (anon) and the server HTML compared. Old = `origin/main` build; new = a clean `git archive d9828bda` build.
- **Slugs:** 6, by shape: A nameless; B gallery + practice + languages; C photo + languages + claimed; D instagram + city + languages; E photoless, unclaimed, admin-made; F archived.
- **`<head>`:** identical in all 6 once the port is normalised (title, description, og:\*, twitter:\*, canonical, robots).
  - A has `noindex,nofollow` in both builds; B to E have no robots tag in both.
  - Neither build emits JSON-LD.
  - F returns 404 with the same head in both.
  - Cache headers and `vercel-cache-tag` match.
- **Body:** the set of links (hrefs) is identical. Gallery, Event appearances, Connect links, place line, role and years are all present. Differences: only one h1 now (old had two), the new "Speaks" section (F4), and one extra chunk (F19).
- **Paused/hidden/archived:** the anon RLS policy `dancer_profiles_select_anon` and `get_public_dancer_extras_v1` use the same predicate (read from prod `pg_policies` / `pg_proc`), so the anon loader 404s before v2 renders, as before.
- **Shape counts (prod, live = 157 of 172; 15 archived, 0 inactive):** photoless 53, unclaimed 152, nameless 2, hide_surname 0, longest name 23 chars (0 over 25), bio 0, languages 12, public WhatsApp 0, gallery 1, website 55, instagram 15, facebook 2.

### Q2. Going lock
- **Who gets locked:** only someone signed in, not organiser-type, with the dancer area `ready` and `allowed`, and an `incomplete` profile (`useGoingLock.ts:69-74`). Loading, error, organiser, `no_profile` and `complete` all stay unlocked.
- **Linked profiles:** they resolve through `_my_dancer_profile_id_v1`, which prefers the linked row.
- **Prod (counts):** 22 real users.
  - Non-organisers: 9 complete, **5 incomplete (these get locked)**, 2 with no profile.
  - Organisers: 5 complete, 1 incomplete (unlocked).
  - Linked to a different, admin-made profile: 0. Accounts with several claimed profiles: 0.
- **Removing an old RSVP while locked:** allowed. `goingTapLocked` only blocks a change to a *new* status (`useGoingLock.ts:81-82`). The exception is F9.
- **Visible reason:** yes. Buttons are disabled, with a reason and a "Finish your profile" link to `/app/welcome?returnTo=…`.
- **Bundle:** event route first load is 377.8 KB gz / 47 files on main and 377.9 KB / 47 files on the branch, so **+0.1 KB, inside the 0.5 KB limit**. The chunk ratchets fail, though (F2).
- **Tests:** S1 tests 147/147 pass; `tests/regression/today` plus S1, 456/456.

### Q3. S3 RPCs
- **Parameter names match prod `pg_proc` exactly:** `submit_feedback_v1(p_body, p_kind, p_page)`, `register_feature_interest_v1(p_feature)`, `get_public_dancer_extras_v1(p_profile_id uuid)`; `my_dancer_stats_v1`, `my_profile_views_v1` and `my_feature_interest_v1` take no parameters.
- **Returned fields match the function bodies:**
  - stats: `profile_id`, `member_since`, `nights_going_upcoming`, `nights_went`, `interested_upcoming`, `level_votes`, `views_30_days`, `views_total`
  - views: `total`, `last_7_days`, `last_30_days`, `previous_30_days`, `last_viewed_at`
  - feedback: `id`, `kind`, `created_at`
  - register: `already_registered`
  - interest: `features[].feature`
  - extras: `bio`, `languages`, `whatsapp`, or NULL
- **Error codes prod raises:** `area_closed`, `not_signed_in`, `no_profile`, `rate_limited`, `invalid_body`, `invalid_kind`, `invalid_page`, `invalid_feature`. Each has plain-words copy (`errors.ts:15-43`, matched as a whole word). Feedback has its own wording for `rate_limited` and offline.
- **Feedback sends nothing when it should not:**
  - Empty or whitespace-only: Send is disabled with a reason.
  - Too long: disabled with a reason; the client's 2000-character limit equals the server's.
  - Offline: returns early, sends nothing, keeps the text.
  - Double tap: a probe clicked twice and 1 request was sent, but no committed test covers it.
- **Home and `/app/page`:** both use `useMyNumbers` → `numbersFrom`, with the same query key. That is one mapping, apart from F7's separate nights tile.
- **Tests:** dancer-app + api + shell tests 897/898. The 1 failure is a 5 s timeout in `public-page/__tests__/route.test.ts` under load; it passes alone (21/21).

### Q4. Isolation: exact allowlist edit (not applied; the orchestrator decides)
All three files are in `protected`, so adding them to `seams` alone still fails (a). They must also leave `protected`. In `scripts/dancer-area-isolation-allowlist.json`:
- `protected`: remove `"src/pages/DancerProfile.tsx"`, `"app/routes/dancers.tsx"` and `"src/pages/FestivalHub.tsx"`, so the list ends at `"app/routes/sitemap.tsx"`.
- `seams`: append `"src/pages/FestivalHub.tsx", "src/pages/DancerProfile.tsx", "app/routes/dancers.tsx"`.
- `seamNotes`: add
  ```json
  "src/pages/FestivalHub.tsx": "B1b S1 Going lock (brief dancer-rebuild-b1b-s1-lock.md, orchestrator 2026-10-17): setAttendanceRpc path uses gate/useGoingLock",
  "src/pages/DancerProfile.tsx": "B1b S2 public page v2 (brief dancer-rebuild-b1b-s2-public.md, orchestrator 2026-10-17): renders PublicDancerPageV2 when open",
  "app/routes/dancers.tsx": "B1b S2 public page v2 (brief dancer-rebuild-b1b-s2-public.md, orchestrator 2026-10-17): loader reads the open flag + extras"
  ```
- `tests/client/dancerAppReviewFixes.test.ts:151` pins `RULES.PROTECTED` to the JSON, so it follows the edit.

Files touched outside `src/modules/dancer-app/`, `docs/` and `tests/` (7):
- the 3 protected files above, each allowed by its slice brief;
- `RsvpBlock.tsx`, `RsvpBlockPlaceholder.tsx`, `src/components/catchallClientPaths.ts` and `perf-budgets.json`, which are already seams.

**No unexpected file was touched.**

### Q5. Privacy
- **No new leak found.**
- `get_public_dancer_extras_v1` is SECURITY DEFINER. It returns NULL for paused, hidden or archived profiles. It returns WhatsApp only when `show_whatsapp_publicly`, the number is non-empty, and the person is eligible. It never returns email or surname.
- anon cannot SELECT `whatsapp`, `bio` or `email`. The name shown everywhere comes from the existing masked `displayName`. `DANCER_PUBLIC_COLS` has no email.
- **New requests from a signed-out visitor:** only two, both server-side in the SSR loader (`dancer_area_gate_v1` and `get_public_dancer_extras_v1`, with a 2.5 s deadline, once per cache miss). There is no new browser request on `/dancers/*`.
- On the event page and FestivalHub, `useDancerArea` is `enabled: signedIn`, so signed-out visitors make no new request. No second view recorder was added.
- The caching gap is F17.

### Q6. On a phone
- Wording and tap-target problems: F8, F10, F12-F16, F18.
- No jargon in visible text: internal codes appear only in developer errors, which are mapped to plain words.
- No raw Unicode punctuation on added lines.
- Every disabled control except PartnerTile while it loads (F15) shows a visible reason.
- Empty states say what to do ("Share your page…", "Add a photo…", "Your counts start when you say you are going to a night.").

## CI, run locally on the merged head d9828bda

| Job | Command | Exit | Result |
|---|---|---|---|
| unit-tests / dancer-area-isolation | self-test; `check:dancer-area-isolation` | 0; 1 | **RED**: F1 |
| unit-tests / unit | `test:unit:offline`; `test:unit:timing` | 1; 0 | 9320 pass. 5 fail, all in `tests/integrityCouldNotRun.test.ts`, caused by this sandbox's `NODE_PATH` and not by the branch |
| architecture-guard / integrity | integrity, legacy-tables/-rpcs, lint:architecture, image-widths, plan-hygiene, workflow-artifact-policy, mojibake, prove:entry-point | 0 | green |
| architecture-guard / integrity | `AUDIT_STRICT=1 check:images` | 1 | **RED**: F6 |
| typecheck | `check:rpc-typing`; `check:wallclock-brand` | 0 | green |
| perf-budget | self-tests; build; `check:bundle-budget`; first-load-requests; chunk-cycles | 0; 0; 1; 0; 0 | **RED**: F2 (KB budgets OK) |
| e2e-smoke | `test:e2e` | 1 | **RED**: F3 (4 failures); 2 flaky |
| phone-qa / phone-qa | playwright phone config | 0 | 272 pass, 74 skipped |
| phone-qa / build-smoke | fake-Supabase build + build config | 0 | 66 pass |
| workflow-lint | masking, notification, no-preview-prefixes | 0 | green |
| db-contract-check | migration-stamps; script-conventions | 0 | green; the other contract checks need secrets, so not run |
| Lighthouse / og / seo / synthetic | needs a Vercel preview | n/a | not run (no preview on `claude/*`) |
| real-data-verified, phone-qa-section, owner-approval | read the PR body | n/a | no PR yet |

`npm run lint` exits 1 locally only because `bin/*.sh` is mode 644 (CI runs chmod first); run directly, it is green.

## Checked and fine
- SEO and `<head>` unchanged for every live shape (Q1).
- Not-found behaviour for archived profiles unchanged.
- No new privacy exposure (Q5).
- Event-route weight within 0.5 KB (Q2).
- No one who should be able to say Going is locked, on prod shapes (Q2).
- RPC parameter names, returned fields and error codes match prod (Q3).
- Feedback sends nothing on empty, offline or double-tap (Q3).
- Home and `/app/page` use one numbers mapping (Q3).
- No unexpected non-seam file was touched (Q4).
- No raw Unicode punctuation (Q6).

## Not checked
- **390x844 browser walk and screenshots:** not done. The subagents did not run one, and this review did not either.
- **Signed-in and owner views of the public page** ("Your plans", Join hidden): need a real session.
- **Real phone:** not available in the sandbox.
- **Red-first claims in the slice handovers** (for example S1's "35 failed when reverted"): not re-run.
- **Live cache behaviour:** the edge-cache bound on a degraded gate answer was not exercised live.
- **The app-side Cloudflare purge emitter** for profile changes.
- **Contract checks needing secrets**, and the NY/Sydney timezone unit runs.
- **A disabled FestivalHub button in Chrome:** whether a tap on it falls through to the clickable card behind it.
