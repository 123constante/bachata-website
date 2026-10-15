# R1a independent review (Website, read-only on `claude/dancer-app-r1a` @ 3a6aa23)

Brief: `briefs/dancer-rebuild-r1a-review.md` (branch `arc/briefs-dancer-rebuild`, sha 406fd03). Reviewer did not
write this code and changed nothing on r1a. Method: the lead verified isolation, the live prod contract (read-only
catalog SELECTs, counts only) and the unit suites itself, and fanned the source reads out to five parallel reviewers
(API layer; gate + shell + seams; Onboarding/Home/Nights; Me/Edit/Photo/Options; the 42-shot pack). Every finding
below that is marked CONFIRMED was re-read or re-run by the lead; PLAUSIBLE means argued from the code only.

Verdict (one line): **no code BLOCKER; one verification BLOCKER (the no-photo shape, the step the rebuild hinges on,
was never walked), 13 SHOULD-FIX (mostly "same fact, same words" and diff-first), isolation of today's site holds.**

## Ranked findings

### BLOCKER

**B1. The review pack's `no-photo` shape is impossible, so the photo step is in no shot (verification, not code).**
`tests/e2e/dancer-app/review-pack.spec.ts:36` builds it as `{ ...base, avatar_url: null, complete: false }` without
`withDerived`, so `strength` stays `{pct: 70, next_step: 'started_year'}` from the four-field base. All seven
`*--no-photo.png` shots show a 70% / "You're in" / "Add the year you started dancing" profile with no photo, a state
the server can never return (`pct >= 70 <=> complete`). The 55%-to-70% photo step (onboarding photo card with the
head-oval guide, Home "Add your photo to reach 70%", Me "Add your photo to reach 70% and unlock Going and Interested",
the button to `/app/me/photo`) therefore appears in NO shot, and `tests/e2e/dancer-app/home-nights.spec.ts:150` uses
the same impossible shape. The handover's "42 shots, 7 screens x 6 shapes" verification claim is overstated for the
one shape that matters most. CONFIRMED. Scenario: owner signs off on the pack; the first real 55% person meets
untested copy and layout. Check: build every pack shape through `withDerived`, assert in the spec
`shape.profile.strength.pct >= 70 === shape.profile.complete` for each, and assert the next-step text on Home, Me and
Onboarding contains "photo" for the no-photo shape. Regenerate the pack.

### SHOULD-FIX

**S1. Edit "Try again" resends the stale delta, then wipes newer edits.** `screens/edit/EditScreen.tsx:118` stores
`lastDelta.current` at submit; the top-error Retry at `:161` sends `lastDelta.current`, and `onSuccess` at `:101`
does `setDraft(draftFromProfile(next))`. CONFIRMED. Scenario: save fails `rate_limited`; person edits the bio while
waiting; taps Try again; the OLD delta is sent and succeeds; the draft resets to the server shape and the bio edit
disappears silently. Check: a test "edit after a top error, then Retry sends the CURRENT delta and keeps unsent
input" (fix: Retry calls `submit()`, or the error card hides once the draft changes).

**S2. Same fact, different words: the strength next-step copy lives in THREE tables.**
`screens/home/homeCopy.ts:4-12` (`NEXT_STEP_COPY`: "Pick how you dance", "Add the year you started dancing", "Add your
photo to reach 70%") vs `screens/me/model.ts:48-56` (`NEXT_STEP`: "Choose how you dance" / "Choose whether you lead
or follow", "Add when you started", "Add your photo") vs Onboarding's own choice tables (`screens/onboarding/model.ts:
205-221` `ROLE_CHOICES` / `EXPERIENCE_BANDS` "1 to 3 years" -> 2 years back, "3 to 6 years" -> 4) vs Edit's
`me/model.ts:85-90` `YEAR_BANDS` ("1-2 years" -> 1, "3-5 years" -> 4). CONFIRMED. Scenario: the same 40% profile
reads "Pick how you dance" on Home and "Choose how you dance" on Me; a person picks "1 to 3 years" in onboarding and
sees "1-2 years" selected in Edit. Brief item 2 asks for ONE mapping. Check: one exported map under `api/` and a
table test asserting Home tile text == Me button text for every `StrengthStep`, and one band table shared by
Onboarding and Edit.

**S3. Nights/Home ignore `is_active` and non-RSVP statuses; the banned word "Saved" is the fallback.**
`screens/nights/nightsModel.ts:19` declares `is_active` and nothing reads it (`mapNight` :152-168); `statusLabel`
at `:53` falls back to the literal `'Saved'` for any status outside going/interested (the RPC vocabulary also has
`cancelled`, `registered`, `attended`, see `src/pages/MyAttendance.tsx:63-69`). CONFIRMED (line 53). Scenario: a
deactivated event is the Home hero "Your next night"; a `cancelled` row shows a teal "Cancelled" pill under
Upcoming; a `registered` row says "Saved", the one word the copy rule bans. Every test row hard-codes
`is_active: true` (`tests/client/dancerAppHomeNights.test.tsx:66-68`). Check: table rows with `is_active: false` and
`status: 'cancelled' | 'registered'` asserting neither hero nor count, and that no row text is "Saved".

**S4. Toggling a styles chip twice produces a real write.** `screens/me/model.ts:236-258` re-appends a toggled-off
chip at the end; `api/delta.ts:13-28` compares arrays in order, so `buildDelta(completeAllExtras, ...)` after
off/on of "Sensual" = `{favorite_styles: ['Dominican', 'Sensual']}`. CONFIRMED by probe. Scenario: Save enables, a
non-empty delta reaches the DB (rate slot consumed, `updated_at` bump, cache purge) for a no-op. Check: a "toggle a
chip twice = Nothing has changed yet" row in `tests/client/dancerAppMeEdit.test.tsx` (fix: order-insensitive compare
for chip sets, or re-insert at the original index).

**S5. `profile_strength_70` never fires on the main path.** Priority order ends with `photo`, so most people cross
70 when the Photo screen saves; `screens/photo/PhotoScreen.tsx:208` writes the cache and nothing under
`screens/photo/` calls `trackDancerEvent`. The only firing site is `screens/onboarding/OnboardingScreen.tsx:83`,
which fires only when a save made INSIDE Onboarding crosses 70; after the photo round-trip the page remounts with
`before >= 70`. `onboarding/__tests__/onboarding.test.tsx:211-217` pins the absence (`toEqual([])` after the avatar
save). CONFIRMED by grep. Scenario: emptyStub -> name, city, role, photo = 70%, funnel shows zero
`profile_strength_70`. Check: fire where the cache is written (`usePutMyDancerEdit`) so Onboarding, Photo and Edit
share it; a table test over every incomplete shape completing through the photo path expecting exactly one event.

**S6. Me/Edit re-implement the name and ignore the surname.** `screens/me/model.ts:21-22` `profileName` =
`display_name || first_name || 'No name yet'`; `screens/me/ui.tsx:321` repeats it for the initial.
`src/lib/publicName.ts` (the stated single authority, `renderPublicName`) resolves display_name, then first + surname
with the hide rule. CONFIRMED. Scenario: fourFieldComplete with surname "Lopez", no display_name,
`hide_surname_publicly = false`: the public page says "Ana Lopez", Me and Edit say "Ana". Check: table test over
hiddenSurname / surname-without-display-name comparing `profileName` with `renderPublicName` + the hide rule.

**S7. `strength.next_step` and `dance_role` are cast, not validated.** `api/rpc.ts:76` `str(s.next_step) as
StrengthStep` (and `:55` for `dance_role`); `screens/me/model.ts:68` then indexes `NEXT_STEP[step].button`.
PLAUSIBLE. Scenario: admin adds or renames one vocabulary item in `_dancer_strength_v1`; every Me and Home render
throws instead of degrading. Check: `parseMyDancerEdit({... strength: {pct: 40, next_step: 'bogus', missing:
['bogus']}})` expects `next_step === null` and `missing === []` (filter through `STRENGTH_STEPS`, `DANCE_ROLES`).

**S8. Raw Unicode punctuation in source despite the CLAUDE.md rule.** JS strings and JSX: `screens/me/model.ts:36`
(`' <middle dot> '` rendered by `roleCityLine` on Me and Edit), `:87-88` (en-dash chip labels), `:266` (ellipsis),
`screens/photo/PhotoScreen.tsx:351` (`Saving<ellipsis>` in JSX), `screens/onboarding/ui.tsx:58`, `screens/home/HomeScreen.tsx:
116,124,186` (middle dot, ellipsis, curly apostrophe), `screens/home/WhatsOn.tsx:55`, `screens/nights/nightsModel.ts:
141`. CONFIRMED by grep. Scenario: the Cowork/FUSE/cp1252 round-trip that produced mojibake on prod before hits one
of these files. Check: the grep `[\x{2014}\x{2026}\x{2018}\x{2019}\x{201C}\x{201D}\x{00B7}\x{2013}]` over
`src/modules/dancer-app` as a lint-chain link; JS strings take `'<middle dot>'`/`'<ellipsis>'` escapes, JSX takes entities.

**S9. The event route changed for every visitor and nothing pins the server HTML.**
`src/modules/event-page/bento/BentoPage.tsx:95-101,724`: `DerivedLevelBadge` and `LevelRatingPrompt` became
`lazyWithRetry` inside `<Suspense fallback={null}>` (Round-3 blessed the byte split). SSR is streaming
(`app/entry.server.tsx:127` renderToPipeableStream) and main already lazy-loads one BentoPage block, so the badge
still arrives in the stream; but no route/SSR test asserts `DANCER_LEVEL_LABEL` is in the event HTML, and if the
new shared level-rating chunk fails to load the badge vanishes (the case `lazyWithRetry` exists for). PLAUSIBLE.
Check: an `app/routes/event.tsx` render test asserting "Dancers rate:" in the HTML, plus a 390x844 before/after of
`/event/:id` on main vs branch. Verify, do not revert (reverting re-breaks the 0.5 KB rule).

**S10. The isolation guard is self-amendable and its stated source of truth does not match it.**
`scripts/check-dancer-area-isolation.mjs:65-72`: the script and `.github/workflows/unit-tests.yml` are themselves
SEAMS, and R1a added three allowances in the branch that needed them. The Round-3 brief names
`src/pages/BentoPage.tsx`, which does not exist; RULES allows `src/modules/event-page/bento/BentoPage.tsx`; nothing
checks RULES against section 5. CONFIRMED (path mismatch). Scenario: a later slice adds `src/pages/Account.tsx` to
SEAMS in its own PR and the gate stays green. Check: fix the brief path; a test that asserts `RULES.SEAMS` /
`PROTECTED` equal a committed copy of section 5; CODEOWNERS on the script.

**S11. `favorite_styles` chips duplicate for stored values outside the preset list.** `screens/edit/EditScreen.tsx:
138-143` appends stored values not in `FAVORITE_STYLE_OPTIONS` as extra selected chips. Prod survey (read-only,
counts): `dancing_role_details.favorite_styles` holds "Bachata Sensual" (2), "Bachata Influence" (2), "Bachata
Fusion" (1), "Zouk" (3), "Brazilian Zouk" (2), "Kizomba", "Tarraxo", "Urban Kiz", "Bachata" (3). The pack's 100%
fixture stores "Sensual"/"Dominican", so Edit shows "Bachata Sensual" unselected AND "Sensual" selected
(`edit--complete-extras.png`). PLAUSIBLE on prod (depends on the preset list vs those values). Check: a table test
that every prod value either matches a preset or has a declared alias; survey after each preset change.

**S12. Nationality is a free-text input showing the stored ISO code.** `screens/edit/EditScreen.tsx:207-208`
`<TextInput id="nationality" ...>`; prod `dancer_profiles.nationality` is 18 rows of two-letter ISO codes and 149
empty (read-only counts). The existing `src/components/people/nationality.ts` has `nationalityCountryName` /
`normaliseNationalityCode`. CONFIRMED. Scenario: an "ES" person sees "ES" in the field, types "Spanish", and the
public flag (which reads the code) breaks or vanishes. Check: table test over the 18-code shape rendering the country
name and saving the code; a picker or the existing normaliser on save.

**S13. The hide-surname help text and its disabled reason render ~10px on phones.**
`src/components/profile/HideSurnameSwitch.tsx:46,49` use `text-xs` (0.75rem) and the site's phone `html` font-size
is ~13.5px (`src/index.css:768`), so the required copy "Add your first name and city first, then you can choose." is
the smallest text in the app (visible in the pack crops). The file is protected; wrap it in the Edit screen with an
explicit px font-size. CONFIRMED. Check: Playwright `getComputedStyle(fontSize) >= 13px` on `#hide-surname-help` and
the reason `<p>` at 390px.

### NOTE

- N1. `api/rpc.ts:129-136`: an empty delta is still sent when the caller omits `current` (`saveMyDancerProfile({})`
  with no second arg makes a real `save_my_dancer_profile_v2({p_payload: {}})` request); no current caller does.
  Check: `saveMyDancerProfile({})` -> `expect(rpc).not.toHaveBeenCalled()`.
- N2. `api/delta.ts:33-35` vs `api/fakeBackend.ts:65-67`: an explicit `undefined` value diverges (client counts it as
  a change, JSON drops it so the DB sees `{}`, the fake raises `first_name_required`). Skip `undefined` keys in
  `diffDelta`.
- N3. `api/types.ts:94-97`: `admin_only`, `invalid_email`, `invalid_note`, `invalid_argument` are deliberately not
  mapped (they fall to the generic copy). Rationale is sound (no Website wrapper calls an admin RPC; the live
  `_member_rate_check_v1` raises `invalid_argument` only for bad constants) but it is an INTERFACE deviation not
  recorded in any handover.
- N4. Unconfirmed email (Round-2: allowed = listed AND `email_confirmed_at`) has no code: the client cannot tell
  "unconfirmed" from "unlisted"; both land on today's `/account`. Spec gap, not code; `fixtures.ts:159` models it as
  signed-out, which is the other sub-case.
- N5. Fake backend rule gaps vs the live SQL: `invalid_text`, `invalid_type`, `invalid_list`, `invalid_whatsapp`,
  `invalid_url` with DETAIL `avatar_url`, `invalid_payload`, `profile_mismatch` are not raised by the fake
  (`fakeBackend.ts:60-83`); copy is covered through the mocked-rpcLoose path only.
- N6. Photo delete (brief item 4): CORRECT in substance. `photoFlow.ts:77-87` refuses `..`, `%2e%2e`, `blob:`, a
  uid-prefix mismatch, `/images/u/<uid>/`, uppercase `/Avatars/`, empty uid; strips `?`/`#`; sends only
  `{keys: [own key]}`; `photoDelete.test.ts` calls the real function. Prod: 101 avatars, 2 on the r2.dev own-prefix
  shape (derivation matches), 99 legacy (`images/people/...`, unsplash) which are orphaned by design. Two gaps: the
  HOST is never checked (`https://other-host/avatars/u/<uid>/x.jpg` yields a key, still inside the own prefix), and
  `..%2F..%2F` passes as a literal key (harmless only if the delete function treats keys as opaque). Cheap fix: pin
  the allowed origin and refuse `%2F` / `..` segments.
- N7. `src/lib/upload-validation.ts:110,143` caps the ORIGINAL file at 5 MB although the output is a 1024px
  re-encode; a current phone JPEG is often 4-8 MB and is refused. Apply the cap to the crop output.
- N8. `screens/me/model.ts:77`: "<step> to reach 70%" is appended to every required step; at 10% adding the first
  name reaches 25%, at 40% choosing a role reaches 55%. Say "towards 70%".
- N9. `screens/home/RateNudge.tsx:24-27` + `nightsModel.ts:101`: a whole-card `<Link>` with no visible action word,
  and "Rate last night's event" for a night up to NUDGE_WINDOW_DAYS ago (the pack shows a 3-day-old night).
- N10. `screens/nights/NightsScreen.tsx:29-33`: every past occurrence mounts its own `LevelVote`, unbounded; a weekly
  series with 40 past rows shows 40 prompts (the test at `:253-265` asserts two for one series).
- N11. `screens/onboarding/OnboardingScreen.tsx:113` "Boost to 100%" while the flow never asks for `bio_social`
  (ceiling 90). Brief-dictated label; for the orchestrator.
- N12. `first_going_tap` and `first_level_vote` fire nowhere (only declared in `analytics/events.ts:19-20`);
  `LevelVote.tsx` is the obvious site. Consistent with W2-SHARED; record as a conscious 1a gap.
- N13. Disabled without a visible reason: `screens/nights/LevelVote.tsx:313` pills while saving;
  `screens/onboarding/notes.tsx:205` renders `<a href={undefined}>` until the lazy contactLinks chunk arrives.
  `useMyNights.ts:371` reads `londonTodayKey()` per render with no rollover re-render.
- N14. Error copy duplicated outside `copyFor()`: `screens/me/model.ts:203` repeats `errors.ts:69` verbatim; `:210` a
  second bio-too-long wording; `:222` a third WhatsApp wording; `PhotoScreen.tsx:129` repeats `decodeImage.ts:136`;
  `OptionsScreen.tsx:172` copies DancerHome's sign-out string (defensible: DancerHome is protected).
- N15. `gate/useDancerArea.ts:28,37` reports `ready/closed` while auth is still resolving (`user` is null); safe
  today because `DancerAreaGate` sits inside `AuthGuard`, a trap for a consumer outside it.
- N16. `public/robots.txt:78` has `Disallow: /app/` only; bare `/app` is not disallowed and its noindex meta is added
  client-side after the lazy chunk. Add `Disallow: /app` (prefix-matched) or a noindex header in the catchall.
- N17. Four copies of the `/app` prefix matcher (`shell/routes.ts:51-54`, `AnimatedRoutes.tsx:82-85`,
  `AppChrome.tsx:50-53`, `profileCompletion.ts:171-177`), deliberate for chunking; `routesKey` is the one without a
  prefix test (`/apps`, `/APP/x`).
- N18. Isolation: `tests/**` is free under the rule (`script:50`) including shared e2e helpers today's organiser
  specs use; the self-test has no case for the `docs/review-pack/` prefix.
- N19. `redirectModel.ts:35-38` is stricter than the spec letter (`no_profile` / `error` / a failed organiser read all
  stay on today's page). Fails closed; say so in the brief.
- N20. R0 `tests/regression/today/account.today.test.tsx:52-54` mounts `Account` in its own `<Routes>`, bypassing
  `RedirectIfAllowed`; the "unchanged at /account" proof rests on `dancerAppShell.test.tsx:163-192` with stubs.
- N21. R0 flakiness under load: `tests/regression/today/auth.today.test.tsx:128` failed once in a 16-file parallel run
  (the a11y tree contained the `import.meta.env.DEV` "Dev tools" block), and the lead saw
  `dancerRoute.today.test.ts` "name + city only" time out at 5 s with five reviewers on the CPU (17/17 alone). A
  timed-out snapshot test then wrote a stray "four-field complete 2" entry; the lead restored the file. The flake
  invites a `-u` that rewrites today's baseline. Stub `import.meta.env.DEV`; raise the route test's timeout.
- N22. `tests/e2e/dancer-app/reachability.spec.ts:107,115` prove "no gate request" with a 500 ms wait.
- N23. Tests that cannot fail: `tests/client/dancerAppApi.test.tsx:261` (`complete` vs `isCompleteProfile`, the fixture
  sets one from the other; `:262-263` same for `missing`/`next_step`; only `:260` cross-checks), `:184` asserts the
  mock's own value; `tests/client/dancerAppMeEditModel.test.ts:19` a constant inside a per-shape `it.each`;
  `tests/client/dancerAppMeEdit.test.tsx:55` dead ternary; `tests/client/dancerAppHomeNights.test.tsx:103`
  `expect(rows.length === 0 || ...)` always true, `:315` constant, `:130-134` 16 shapes asserting only "not
  Loading" (greeting fallback "there" untested); `tests/e2e/dancer-app/me-edit.spec.ts:81-86` titled "a teacher does"
  but opens the pure dancer; `api/errors.ts:136-146` picks the first known code found anywhere in the message.
- N24. Missing shapes in tests: `is_active: false` nights, `occurrence_date: null` ("TBC"), `city_name: null`, > 100
  rows, 30 favourite styles, `languages: []`, toggle-twice (S4), Retry-after-edit (S1), an own-prefix second replace
  in `photo.spec.ts`. Missing from the pack: a TRUE no-photo (B1), admin-made unclaimed, hidden surname ON, teacher/DJ
  (WhatsApp rows), organiser-who-dances, paused, erase-requested, nameless, bio over 280, loading / RPC error /
  rate-limited / `area_closed` states, 100+ nights, "You said: Mixed", onboarding photo and optional cards, the photo
  preview card, Edit with a dirty form, any shot with a REAL photo (the pack's image host is CSP-blocked so every
  shot shows the initial), 360x640 and 200% text.
- N25. Pack mechanics: full-page Edit shots draw the `position: fixed` tabs (`theme/dancer.css:97`) mid-page over
  Nationality (`edit--*.png`); `measure()` in `review-pack.spec.ts` skips `label.da-tap`, so the Photo screen's two
  primaries are outside the < 44px check (they look ~48px); Options' inline "Account settings" link made 44px tall
  by padding opens a double line gap; bottom-tab labels are 12px; "Coming soon" vs "Coming soon." on Home tiles;
  "Share my page" / "See my public page" enabled for a nameless stub (Me's footnote covers it, Options has nothing);
  Photo says "Your current photo stays until you save a new one." without showing it; Options "Back to the website"
  and "Browse all events" both go to `/`; the Options `Sheet` has no focus trap or Escape; HEIC from the Files app
  is refused; "Take another" after a failed save orphans the uploaded object; the consent line names Terms and
  Privacy pages that Options says are not published (known owner question 2).

## Verified by the lead (independent of the five reviewers)

- Isolation: with `origin/main` refreshed to 4a63921 (an ancestor of r1a), `git diff --name-only origin/main HEAD`
  on every protected file in INTERFACE section 5 (incl. `AuthGuard`, `DancerDashboard`, `EditProfile`,
  `EventAttendanceButtons`, `useAttendance`, `useOccurrenceRsvp`) is EMPTY. The files r1a changes outside
  `src/modules/dancer-app/`, `docs/`, `tests/`, `e2e/` are exactly the seam list plus the three Round-3 allowances
  (`BentoPage.tsx`, `playwright.config.ts`, `scripts/prove-entry-point-dispatch.mjs`).
- Live prod contract (read-only catalog SELECTs): `my_dancer_edit_v1`, `save_my_dancer_profile_v2(p_payload jsonb)`,
  `dancer_area_gate_v1`, `get_public_dancer_extras_v1(p_profile_id uuid)`, `get_my_event_attendance_v2`,
  `_dancer_area_require_v1`, `_member_rate_check_v1`, both guards: all exist with the pinned ACLs (member RPCs
  authenticated only, gate/extras anon + authenticated, internals no client grant). The RAISE names in the live
  `save_my_dancer_profile_v2` body are exactly the Round-2 member list; `api/errors.ts` maps every one of them plus
  `permission denied for function`. `my_dancer_edit_v1`'s keys match `api/types.ts` key for key.
- Unit suites on this head (`NODE_PATH=`): `tests/client/dancerApp*`, `src/modules/dancer-app`,
  `tests/catchallClientPaths.test.ts`, `tests/regression/today`: 1006/1007 under load (the one timeout is N21),
  17/17 for that file alone. Reviewers also ran their folders green (213, 83, 265, 514/515 with the N21 flake).
- Reviewer "verified correct" items the lead spot-checked: WhatsApp keys dropped in the wrapper (`api/rpc.ts:112-120`)
  and never built for a pure dancer (`me/model.ts:254-257`); diff-first `diffDelta` treats `""`/null/`[]` as equal
  and trims (`api/delta.ts:13-28`); untouched Save disabled with the exact warn line on every live shape
  (`EditScreen.tsx:116-121`, `dancerAppMeEdit.test.tsx:214-223`); organiser check IMPORTED from `accountRouting`
  (`redirectModel.ts:1,33`, same symbol as `Account.tsx:12,47`); exactly `/account`, `/account/dancer`,
  `/finish-profile` elements wrapped (`AnimatedRoutes.tsx:192,197,243`); signed-out makes no gate request; dancer.css
  fully scoped to `[data-profile="dancer"]` and imported only by the shell; no secret or private column reaches a
  public reader (`fetchPublicExtras` has no consumer yet, the fake gates `whatsapp` on eligibility and `is_active`);
  avatar fallback test fires a real `error` event.

## Not verified

- No browser walk with a real signed-in account on prod data (the pack is mocked, and see B1).
- Live-DB contract suites, preview-deploy jobs, GitHub Actions results for the branch (no `gh api`).
- The `..%2F` key behaviour of the storage delete function (admin repo).
- Whether the streamed event HTML carries the level badge in production (S9 asks for the test).
