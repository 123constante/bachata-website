# Organiser rebuild -- HANDOVER (running checkpoint file)

Append a dated section per worker. Newest at the bottom. Read `ARC.md` first.

## W0 -- Foundation (2026-10-07) -- DONE

Branch `arc/organiser-rebuild` created from `origin/main` @ 79d74d5.

### What exists

- `src/modules/organiser/theme.css` -- `.org-theme` tokens (dark only), skeleton shimmer,
  two-column split CSS (>= 900px), reduced-motion kill switch.
- `src/modules/organiser/motion.ts` -- `MOTION_MS` 300, `MOTION_TRANSITION`,
  `usePrefersReducedMotion` re-exported from the old module.
- `shell/` -- `OrganiserShell`, `TabBar` (4 tabs), `paths.ts` (`ORG_PATHS`),
  `OrganiserRoutes.tsx` (AuthGuard + noindex + lazy pages).
- `ui/` -- Card, SummaryRow, SectionLabel, StatusTag, Pill, Chip, PrimaryButton,
  GhostButton, AttentionStrip, DateChip, Cover, TitleInput, SheetView, SearchField,
  PersonRow, Collapse, Skeleton/SkeletonRows, useShake, PreviewBar, EmptyState,
  ErrorState, AnnounceRegion/useAnnounce, useKeyboardInset. Usage: `ui/README.md`.
- Placeholder pages: `home/index.tsx`, `events/index.tsx`, `events/NewEventPage.tsx`,
  `events/EventEditorPage.tsx`, `events/EventListPlaceholder.tsx`, `dates/index.tsx`,
  `team/index.tsx`, `profile/index.tsx`.
- Route `/account/o/*` added to `src/components/AnimatedRoutes.tsx` (flag-gated like the
  old /account routes). Old routes untouched.
- Tests: `src/modules/organiser/__tests__/` (primitives, motion, SheetView, shell) -- 38 tests.

### Gates run

- `npm run typecheck`: 0 errors in the new files. (The repo has 95 pre-existing errors elsewhere, same count before and after this change.)
- `npm run lint`: 15/16 links PASS; `check:integrity` exits 126 only because `bin/check-integrity.sh` is not executable in a Linux checkout (mode 100644); run directly with `bash bin/check-integrity.sh` it passes (1132 files, 0 issues). `npx eslint src/modules/organiser src/components/AnimatedRoutes.tsx`: 0 problems.
- `npx vitest run src/modules/organiser/__tests__`: 38/38 pass.
- Full offline unit suite: run by the pre-push hook on the push.

### Measured in headless Chromium (Vite harness, real Tailwind config, prod build)

Keyboard simulated by replacing `window.visualViewport` with one 300px shorter than the
window. Sheet = `SheetView fullHeight` in its search view with 8 results.

| Check | 390x844 | 320x568 | 390x500 | 1280x800 |
|---|---|---|---|---|
| Visible viewport with keyboard (px) | 544 | 268 | 200 | 500 |
| Sheet top / bottom (kb) | 12 / 544 | 12 / 268 | 12 / 200 | 12 / 500 |
| Search input top-bottom (kb) | 84-132 | 72-120 | 72-120 | 84-132 |
| First result top-bottom (kb) | 141-201 | 129-189 | 129-189 | 141-201 |
| Input + first result inside visible viewport | yes | yes | yes | yes |
| Search input focused on view swap | yes | yes | yes | yes |
| Sheet footer bottom (kb) | 544 (above kb) | hidden while typing* | hidden while typing* | 500 (above kb) |
| Dialogs in the DOM | 1 | 1 | 1 | 1 |
| Sheet height without keyboard | 717 (85%) | 483 (85%) | 425 (85%) | 680 (85%) |
| Collapse: height at transitionend | 0px | 0px | 0px | 0px |
| Collapse: list shrank by / row height (incl. divider) | 53 / 53 | 53 / 53 | 53 / 53 | 53 / 53 |
| Collapse: residual gap | 0 | 0 | 0 | 0 |
| Collapse: unmounted after (ms) | 322 | 305 | 324 | 335 |
| Shell: action bar bottom / tab bar top | 783 / 783 | 507 / 507 | 439 / 439 | 739 / 739 |
| Shell: overlap tab bar vs action bar | 0 | 0 | 0 | 0 |
| Shell with keyboard: action bar bottom / visible | 544 / 544 | 268 / 268 | 200 / 200 | 500 / 500 |
| Horizontal scroll (sheet, shell, gallery) | 0, 0, 0 | 0, 0, 0 | 0, 0, 0 | 0, 0, 0 |
| Split: list visible / width | no (detail route) | no | no | yes / 300px, 1px right border |
| Remove button hit area | 32px visual, hit 6px outside: yes | yes | yes | yes |
| Page errors | 0 | 0 | 0 | 0 |

\* With the keyboard up and under 360px visible, the sheet's grabber and sticky footer step
aside so the field and first result fit. They come back when the keyboard closes. Same
idea in `PreviewBar`: while typing only its button stays (preview + note hide).

Reduced motion (Chromium `reducedMotion: 'reduce'`): Collapse removed the row on the next
frame (3 ms).

Fixes made because of these numbers: sheet height floor removed (header was at -40px at
390x500), divider border animated to 0 (Collapse ended at 1px), PreviewBar trims itself
while typing (action bar overflowed the 200px viewport by 11px).

### Contrast snippet (re-measure before adding a colour)

```js
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const lin=c=>{c/=255;return c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4};
const L=h=>{const[r,g,b]=hex(h);return .2126*lin(r)+.7152*lin(g)+.0722*lin(b)};
const ratio=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
```

### What W1..W4 must know

- Fill only your folder; the placeholder page file is yours to replace (keep its default
  export and file name -- the router imports it). Keep the `org-page-*` testid on your shell.
- Put each page inside `<OrganiserShell>`; never use `GlobalLayout` or `PageTransition` here.
- Link with `ORG_PATHS`. The new area is not linked from the old `/account` yet (W5).
- Reuse `selfServeApi.ts` / `selfServeErrors.ts` / the old models by import, unchanged.
- W2: the `events/:seriesId` route renders the list AND the editor; on wide screens both
  show (`list` + `detail`). 'Listed until <date> - Extend' must only offer end choices
  that keep the series within 30 upcoming dates; show 'Up to 30 upcoming dates'.
- W3: the old writer re-creates date-only sessions with NEW ids on save. After a save,
  re-read the schedule and key rows by content (type + start + end + name), never by an
  id cached before the save, or the sessions look empty. Reuse PR #654
  (`claude/lineup-rebuild-2026-10-07`, parked; do not merge it). Performance sessions get
  no add control. Line-up = one `SheetView` with list/search views + `PersonRow` + `Collapse`.
- W4: Instagram belongs on the organiser Profile, not the event.
- If you need a primitive changed, build a local version in your folder and note it here.

### Left for later (not W0)

- Linking the new area from the old `/account` and retiring old pages: W5.
- The harness lives outside the repo (scratchpad). A Playwright spec for the new routes
  should join `test:e2e` (explicit spec list) once the pages carry real content.

## W4 -- Team + Profile (2026-10-08) -- DONE

Owned paths only: `src/modules/organiser/team/**`, `src/modules/organiser/profile/**`.

### Files

- `team/index.tsx` -- `/account/o/team` (replaces the W0 placeholder; same default export and `org-page-team` testid).
- `profile/index.tsx` -- `/account/o/profile` (same; `org-page-profile`).
- `profile/useOrganiserChoice.ts` -- `organiser_home_v1` read (same cache key as the old /account) + which organiser is shown, kept in `?o=<id>`.
- `profile/OrganiserSwitcher.tsx` -- chip row, only when the person runs 2+ organisers (the old /account had a picker, so this mirrors it). Used by both pages.
- `profile/profileForm.ts` -- row -> edit form, Instagram handle reader.
- `team/__tests__/TeamPage.test.tsx` (14 tests), `profile/__tests__/ProfilePage.test.tsx` (10 tests).

### Team

- Members (`PersonRow` + role chip, "You" on your own row). Remove a manager / Leave: inline question in plain words ("Remove Ana? They will no longer see or edit these events." / "No, keep them" / "Yes, remove"), then the row fades and collapses (`Collapse`), then the home read refreshes. Leaving lands on `ORG_PATHS.home`.
- Requests to join: skeleton / error + retry / empty. "Add as manager" opens the confirm-as-manager question (old wording) before `resolve_organiser_access_request_v1('grant')`; "Decline" is one tap. Answered rows collapse, then the list re-reads.
- Refusals: `teamErrorMessage` copy under the question (or under the row for decline), with a shake.
- Owner vs manager: a manager sees Add/Decline DISABLED with "Only an owner can add or decline people."; the only owner sees Leave disabled with the `memberAction` note. Nothing is hidden silently except Remove on other people for a manager (same as the old panel: managers have no remove action at all).
- One question open at a time, so at most one cream `PrimaryButton` on screen.

### Profile

- Cover (logo), borderless name (`TitleInput`), About / Logo rows, Links card (Instagram, Website, Facebook) -> ONE `SheetView` whose `viewKey` is the field. Preview of the public card + ONE primary "Save profile" in `PreviewBar` (live note only when the organiser is live), disabled until something changed. Failure: bar shakes + plain message from `organiserProfileSaveErrorToast` above the button.
- Save = `saveOrganiserProfile` (`src/lib/organiserProfileUpdate.ts`, RPC `organiser_profile_update_p5_v1`) with the WHOLE form filled from the stored row, so phone / category / founded year (not shown) are re-sent unchanged; the RPC treats an unchanged value as a no-op (checked its definition, SELECT only). City is the stored `city_id`.
- Account card: signed-in email (read-only), "Organisers you help run" count, Sign out -> confirm sheet -> `useAuth().signOut()`; on 'failed' it stays and says so; otherwise `navigate('/', { replace: true })`, exactly what the old /account does today.

### Old / shared files imported (none modified)

- `src/modules/organiser-self-serve/selfServeApi.ts` (fetchOrganiserHome, organiserHomeQueryKey, ORGANISER_HOME_KEY, fetchIncomingAccessRequests, incomingAccessRequestsQueryKey, removeOrganiserMember, resolveAccessRequest, teamOf, types)
- `src/modules/organiser-self-serve/selfServeErrors.ts` (teamErrorMessage)
- `src/modules/organiser-self-serve/teamModel.ts` (ROLE_LABEL, howToAddManager, instantDateLabel, memberAction, memberLabel, types)
- `src/lib/organiserProfileUpdate.ts` (saveOrganiserProfile, organiserProfileSaveErrorToast, OrganiserProfileEditForm)
- `src/modules/profile/organiserPublicProfile.ts` (fetchOrganiserEntity, organiserEntityQueryKey -- the public page's own cache key, so a save refreshes it)
- `src/lib/organiserPublicCols.ts` (type only), `src/hooks/useAuth` (signOut only), `src/integrations/supabase/client`.

### Gaps (no RPC offers it; shipped the simpler version)

- **Change role**: no RPC. Roles are shown read-only with "Only the Bachata Calendar team can change someone's role."
- **Invite / add by email**: no RPC. Adding = granting a request (as the old flow); the "Add someone" card explains how a person asks.
- **Logo upload**: no organiser-avatar upload wrapper; the Logo sheet takes an image link (as the old public-page editor does).
- **City** is not editable here (needs the city picker + `resolveCanonicalCity` from the old page); an organiser with no city gets the server's "City is required" message.
- **Profile lifecycle** (send for review) is not on this screen; Home/W1 owns onboarding.

### Gates run (sandbox)

- `tsc -p tsconfig.app.json`: 95 errors, all pre-existing, 0 in my paths.
- `npx eslint src/modules/organiser/team src/modules/organiser/profile`: 0 problems.
- `npx vitest run src/modules/organiser/team src/modules/organiser/profile`: 24/24 pass (needs `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` placeholders, as unit-tests.yml sets).
- **Heads-up for W0/W5:** `src/modules/organiser/__tests__/shell.test.tsx` (W0's, not mine to edit) renders the REAL pages with no `QueryClientProvider`, so once a page uses react-query its "renders its placeholder" case fails ("No QueryClient set"). Team and Profile fail it now, and W1-W3's pages will too. Fix (one place): wrap `at()` in `<QueryClientProvider client={new QueryClient()}>` and mock `@/hooks/useAuth`, or assert only on `org-tab-*`.

### Measured in headless Chromium (Vite harness with stubbed RPCs, real Tailwind; long names + long emails)

| Check | 390x844 | 320x568 | 1280x800 |
|---|---|---|---|
| Horizontal scroll (document + content) | 0 / 0 | 0 / 0 | 0 / 0 |
| Elements past the right edge | 0 / 0 | 0 / 0 | 0 / 0 |
| Cream PrimaryButtons visible (team with grant question open / profile) | 1 / 1 | 1 / 1 | 1 / 1 |
| Profile action bar bottom = tab bar top | 783 = 783 | 507 = 507 | 739 = 739 |
| Field sheet: dialogs in DOM / focus in field / h-scroll | 1 / yes / 0 | 1 / yes / 0 | -- |
| Sign-out sheet: "Yes" bottom vs viewport | 817 < 844 | 541 < 568 | -- |
| Buttons under 44px tall | none | none | none |
| Page errors | 0 | 0 | 0 |

(The probe also counts the W0 `Cover` round change button as cream; it is the cover's icon button, not a PrimaryButton.)
Fixes made because of these runs: "(you)" removed from the name (it gave "D(" initials and truncated) and moved to the sublabel; the confirm buttons stack instead of wrapping "Yes, add as manager" onto two lines.

## W2 -- Events: list, name-only create, event editor (2026-10-08) -- DONE

Owned paths only: `src/modules/organiser/events/**`. `EventListPlaceholder.tsx` (W0
placeholder in my folder) is deleted; `EventList.tsx` replaces it.

### Files

| File | What |
|---|---|
| `events/index.tsx` | `/account/o/events`: list (left column on wide), 'New event' gold link in the top bar, empty state carries the screen's one PrimaryButton |
| `events/EventList.tsx` | `EventList` (rows: DateChip of next date, name, venue, StatusTag Live/Draft; Skeleton/Empty/Error) + `NewEventLink` |
| `events/NewEventPage.tsx` + `newEvent.ts` | name only; creates the draft at once and replaces the route with its editor |
| `events/EventEditorPage.tsx` | the editor (renders its own OrganiserShell so the PreviewBar can live in `actionBar`; list + detail on wide) |
| `events/EditorSheet.tsx` | the ONE SheetView; views: gallery, video, starts, repeats, until, venue, venue-search, description, ticket |
| `events/EditorRows.tsx` | Schedule card (next date's sessions, read-only, people 'Ana Ruiz, Cleo Park', opens ORG_PATHS.date) + dates list (upcoming DateChip rows, past collapsed) |
| `events/dateCap.ts` | PURE 30-upcoming-date cap: `allowedEndChoices`, `endWithinCap`, `extendStep` (batch 8), `maxRuleEnd` (server's 12-month bound) |
| `events/eventModel.ts` | PURE: parse (adds styles/gallery/videos the old parser drops), draft, `changedFields`, `conflictingFields`, `draftProblem`, `savePlan`, preview |
| `events/eventsApi.ts` | queries (own key `org-event-workspace`), `useRunCommands` (sequential series_command_p5, version chained, reloads old+new keys + home) |
| `events/media.ts` | cover/gallery upload through the old flyer pipeline |
| `events/__tests__/` | `dateCap.test.ts` (9), `eventModel.test.ts` (10), `pages.test.tsx` (24), `fixtures.ts` |

### Behaviour worth knowing

- Create = the old create's `series.upsert` (via `createSeriesCommand` + `createPayload` +
  `createDraft`, kind weekly_class -> format recurring, category class), first date today+7,
  start time 20:00 (never shown; times follow sessions), organiser city as `default_city_id`,
  then `series.set_recurrence` weekly with `until_date` = 8th date. One idempotency key per
  write, kept across retries. A refused rule still opens the editor ('Repeats' fixes it).
- The UI never sends `end: {kind: 'none'}`: a weekly event always has an `until_date` inside
  the cap. Moving 'Starts on' re-picks an end inside the cap. Hand-added upcoming dates
  count toward the 30.
- Save: ONE PrimaryButton in PreviewBar (public card preview + LIVE_NOTE for live events).
  Before writing, it re-reads the workspace; a field this screen changed that changed on the
  server meanwhile refuses the save ('Someone else changed the description...'), shakes,
  and nothing is sent. Otherwise only changed fields go (`name` always, as the handler needs).
  Failure: `useShake` + `commandErrorMessage` text above the bar. Unsaved guard on.
- Shape: 'One date' / 'Every <weekday>'. weekly -> one date = `series.stop_repeating`
  keeping the start date; one date moved = `add_date` + `remove_date`.
- Sheet footer is a GhostButton 'Done' (keeps one primary on screen).

### Old files imported (read-only, by import)

`selfServeApi.ts`, `selfServeErrors.ts`, `seriesCommands.ts`, `seriesModel.ts`,
`homeModel.ts`, `createModel.ts`, `createCity.ts`, `editorGuards.ts`, `programmeModel.ts`,
`flyerModel.ts`, `flyerUploadApi.ts`, `components/publicVenues.ts` (hook + helper, not a
component), plus `@/hooks/useUnsavedChangesGuard`, `@/hooks/useLondonToday`, `@/lib/londonDate`.
No old React component is imported.

### Gaps (no RPC offers it; shipped the simpler version)

- Organisers row is READ-ONLY (names from organiser_home_v1). No owner command changes an
  event's organisers.
- Shape change on a LIVE series to 'One date' will be refused by the server
  (`event_series_p5_format_recurrence_chk` keeps a rule on live/paused recurring series);
  the plain server message shows. 'Every week' on an old one_off series goes through
  `set_recurrence`; not verified against prod (no prod writes).
- Music styles: no server list; chips are a fixed list (Bachata, Sensual Bachata, Dominican
  Bachata, Salsa, Kizomba, Brazilian Zouk, Merengue, Reggaeton) plus any stored style.
- Video: links only (https), no upload.

### For W0/W5 -- W0's shell test now fails on real pages

`src/modules/organiser/__tests__/shell.test.tsx` renders the real pages with no
QueryClientProvider and no supabase mock, so `/account/o/events`, `/events/new` and
`/events/s1` fail there ('supabaseKey is required' / 'No QueryClient set'). Every worker
with a real page hits this. Fix belongs to W0/W5 (not my folder): wrap `at()` in a
QueryClientProvider and mock `@/integrations/supabase/client` + `@/hooks/useAuth`.

### Gates run (sandbox)

- `npx tsc -p tsconfig.app.json`: 95 errors total, 0 in `src/modules/organiser/` (W0 noted 95 pre-existing).
- `npx eslint src/modules/organiser/events`: 0 problems.
- `npx vitest run src/modules/organiser/events`: 43/43 pass.
- `npm run test:unit:offline`: 2296 pass, 8 fail in 3 files: the two known sandbox failures (useEventGuestList.cache, integrityCouldNotRun) + W0 shell.test.tsx (3, explained above).

### Measured in headless Chromium (Vite harness in scratchpad, real Tailwind, mocked RPCs, 8 series, 9 dates)

| Check | 390x844 | 320x568 | 1280x800 |
|---|---|---|---|
| Horizontal scroll (doc / content), list, new, editor | 0/0 | 0/0 | 0/0 |
| Visible PrimaryButtons: list / new / editor | 0* / 1 / 1 | 0* / 1 / 1 | 0* / 1 / 1 |
| Editor action bar bottom / tab bar top | 783 / 783 | 507 / 507 | 739 / 739 |
| List column visible on editor route | no | no | yes |
| 'Listed until' sheet: dialogs / top-bottom / h-scroll | 1 / 301-844 / 0 | 1 / 85-568 / 0 | 1 / 218-800 / 0 |
| Venue search view: dialogs / top-bottom / h-scroll | 1 / 127-844 / 0 | 1 / 85-568 / 0 | 1 / 120-800 / 0 |
| Text colours outside the token set (fg, mut, gold, btnfg, ok-fg, warn-fg, danger, ph) | none | none | none |
| Page errors | 0 | 0 | 0 |

\* The list's PrimaryButton only exists on the empty state (no events). No new colour pairs.
## W1 -- Home + onboarding/claim (2026-10-08) -- DONE

Owned paths only: `src/modules/organiser/home/**`.

### Files

- `home/index.tsx` -- `/account/o` Home (keeps default export + `org-page-home` testid). No
  organiser yet (or `?add=1`, "Add another organiser") -> onboarding. Otherwise: strips (only
  when needed), the one cream `New event` button, `Next dates` (DateChip, event name, venue,
  StatusTag; row links to `ORG_PATHS.date`). No stats. Skeleton rows / ErrorState with retry
  (offline before first answer is an error, never onboarding) / EmptyState with New event.
- `home/homeView.ts` -- pure model: `nextDates` (all organisers, soonest first, 8 max),
  `dateTag`, `runwayCandidates` / `runwayStrip` (56 days), `lacksTeacherOrDj`,
  `datesWithoutLineup`, `lineupCheckDates` (first 5 non-cancelled), `shortDate`.
- `home/useHomeData.ts` -- `useOrganiserHome` (same query keys as old /account) and
  `useHomeStrips`. A strip is hidden while its read loads or if it fails.
- `home/onboarding/OnboardingView.tsx` -- steps, organiser search (SearchField, debounced 250ms,
  SkeletonRows, ErrorState+retry, no-match -> create with the typed name), result rows
  (Claim only when the listed email is the user's; Ask to join otherwise; nothing for their own;
  'Asked' tag when a request is open), Create button (the screen's one primary), 'Waiting for an
  answer' (open requests) and 'Request declined' (`declinedRequests`, 30 days) cards.
- `home/onboarding/OrganiserSheet.tsx` -- ONE SheetView for claim / ask to join / create, with a
  `city` view (create) swapped by `viewKey`. Claim with an unproven session shows the email code
  first; a refusal with `next === 'request_access'` turns the claim into a request with the reason
  shown; a create refused with `reauth` shows the email code then retries. useShake + message on
  failure. Errors via `selfServeErrorCopy`.
- `home/onboarding/EmailCode.tsx` -- rebuilt email-code proof (same supabase.auth
  signInWithOtp / verifyOtp calls as the old EmailCodeProof; link returns to `/account/o`).
- `home/onboarding/citySearch.ts` -- `search_cities` (same RPC the shared CityPicker calls; that
  picker is a Radix popover, banned here, so the city list is a sheet view).
- `home/onboarding/onboardingModel.ts` -- `instagramProblem` / `websiteProblem` (same rules as the
  old component file, which may not be imported), `HINT_TEXT`, `rowAction`, code constants.
- Tests: `home/__tests__/HomePage.test.tsx` (12), `home/__tests__/Onboarding.test.tsx` (10).

### Old files imported (logic only, unchanged)

`selfServeApi.ts` (fetchOrganiserHome, fetchMyAccessRequests, fetchIncomingAccessRequests,
fetchSeriesWorkspace, fetchOccurrenceProgramme, searchClaimableOrganisers, claimOrganiser,
requestOrganiserAccess, createOrganiserProfile, claimHint, query keys), `selfServeErrors.ts`
(selfServeErrorCopy), `accessRequestModel.ts` (declinedRequests), `sessionProof.ts`
(isMailboxProvenToken), `seriesModel.ts` (upcomingDates), `programmeModel.ts` (toDraft),
`claimHint.ts` (type + actual in tests). No old component imported.

### Strip rules (from existing reads only)

- (a) team requests: `fetchIncomingAccessRequests` per organiser the user owns or manages; sum > 0
  -> strip -> `ORG_PATHS.team`.
- (b) runway: `organiser_home_v1` gives only `upcoming_count` + the next 3 dates. Candidates are
  `format === 'recurring'`, running (live/draft/in review/changes needed) series with 1..8
  upcoming dates. With <= 3 the last date is known from the home read; with 4..8,
  `fetchSeriesWorkspace` is read for that series only. Strip when last date - today < 56 days,
  soonest first, '+N more events also running short'. Tap -> `ORG_PATHS.event(id)` (W2's Extend).
- (c) line-up: `fetchOccurrenceProgramme` for the first 5 non-cancelled dates in the list; a date
  counts when its editable programme names nobody with role teaching/djing (no sessions also
  counts). Tap -> the first such date.

### Gaps

- (b) A series with more than 8 upcoming dates is assumed to have >= 8 weeks of runway (true at
  weekly or slower; a twice-weekly series could be missed). No RPC returns the last listed date
  cheaply; `organiser_home_v1` could add `last_date` (admin repo).
- (c) only the first 5 upcoming dates are checked (one programme read each). The home RPC has no
  per-date line-up count; an admin-side `has_lineup` on `next_dates` would make it free.
- City on the date row: `organiser_home_v1` gives the venue name only, no city name. The row shows
  the venue ('Venue not set' when none).
- Draft / in-review / 'changes needed' organiser notice and 'Send for review' (old OrganiserHome
  header) are NOT on Home (not one of the three owner strips), and W4 left it off Profile too, so
  `submitOrganiserProfile` has NO screen in the new area yet: UNOWNED, for W5 to place (Profile is
  the natural home). Until then a new draft organiser can only be sent from the old /account.
  The create confirmation says only 'saved as a draft. It is not public until the team approves it.'
- Several organisers: Home merges all their dates; there is no organiser switcher (Team/Profile
  pick the organiser -- W4).

### For W0 / W5: `src/modules/organiser/__tests__/shell.test.tsx` now fails 2 tests

The real Home imports the Supabase client and react-query, so the route test (written against
placeholders) throws `supabaseKey is required`. W2..W4 pages will do the same. I did not edit
W0's file. Verified fix (11/11 pass with it): add to the mocks

```ts
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: () => new Promise(() => {}), from: () => ({}) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }) }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
```

and wrap the `MemoryRouter` in `at()` with `<QueryClientProvider client={new QueryClient()}>`.

### Gates run

- `tsc -p tsconfig.app.json`: 95 errors, all pre-existing (same count as W0), 0 in `home/`.
- `npx eslint src/modules/organiser/home`: 0 problems.
- `npx vitest run src/modules/organiser/home`: 22/22.
- `npm run test:unit:offline`: 2275 pass; failures = the two known ones
  (useEventGuestList.cache, integrityCouldNotRun), shell.test x2 (above), and
  `tests/client/festivalClientState.test.tsx` once under full-suite load (passes 8/8 alone;
  public festival page, untouched).

### Measured in headless Chromium (prod build of a Vite harness, real Tailwind, stubbed RPCs)

Scenarios: home = 3 strips + 5 dates (long names/venues); empty = no events; onboard = search with
2 results + 1 pending request; create = create sheet open.

| Check | 390x844 | 320x568 | 1280x800 |
|---|---|---|---|
| Horizontal overflow (document / any element), all 4 scenarios | 0 / none | 0 / none | 0 / none |
| Cream primary buttons on the page (all scenarios) | 1 | 1 | 1 |
| Primary in the open create sheet | 1 (page behind keeps its 1) | 1 | 1 |
| New event button x-span (home / empty) | 14-376 / 28-362 | 14-307 / 28-292 | 336-944 / 353-927 |
| Strips / date rows (home) | 3 / 5 | 3 / 5 | 3 / 5 |
| Create sheet top-bottom | 127-844 | 85-568 | 120-800 |
| Tab bar top | 783 | 507 | 739 |
| Smallest tap target in W1 code | 44 | 44 | 44 |
| Page errors | 0 | 0 | 0 |

Under 44px, both W0 primitives: SearchField clear button (41px tall) and SheetView close
(37px) -- for W5. Colours: only `.org-theme` tokens; no new colour pair (the done line uses
--ok-fg on --ok-bg, already measured 7.93).


## W3 -- Date editor (2026-10-08) -- DONE

Page `/account/o/events/:seriesId/dates/:occurrenceId` (`src/modules/organiser/dates/`).

### Files

- `dates/index.tsx` -- the page: header (DateChip, date, series name, time span, Live/Cancelled
  tag), Where card (Venue row, city from the venue), SCHEDULE (one row per session: type
  StatusTag, name, start-end, levels, its people; Add a session; removal), This date card
  (Break this week on rule dates, Cancel / Un-cancel), PreviewBar (public preview, the ONE
  primary button "Save changes", live note, shake + message on failure), unsaved guard.
- `dates/DateSheet.tsx` -- the ONE SheetView. Views (viewKey): `session:<key>`,
  `search:<key>` (people search, Back returns to the session), `venue`, `cancel`,
  `uncancel`, `break`. No popovers, no nested dialogs.
- `dates/useDateEditor.ts` -- queries (programme, date detail, workspace), the draft, save,
  re-read after every save, commands (break / cancel) through `useOwnerCommand`.
- `dates/dateModel.ts` -- pure: people by type (`ADD_ROLE`, `pickPerson`, `setSessionType`),
  the date span (first start to last end, 08:00 rollover like `programDayRollover`), labels.
- `dates/DatePreview.tsx` -- how the date reads publicly, from the draft.
- Tests: `dates/__tests__/dateModel.test.ts` (8), `dates/__tests__/DatePage.test.tsx` (12).

### How the #653 failures are handled

- (a) Search off-screen: the search is a VIEW of the same `SheetView fullHeight`. Measured
  below with the keyboard simulated: input and first result inside the visible viewport.
- (b) 48px gap: an added person or a session added on this screen leaves through
  `Collapse` (0px at transitionend, then unmounts, then leaves the draft). A STORED person or
  session stays greyed with Undo until the save (README rule for undoable removals).
- (c) Empty line-up after save: after EVERY save (and after a refusal with `reload`) the
  programme is fetched again (`fetchQuery`, staleTime 0) and the draft re-seeded from it. The
  save result is never used to rebuild the draft. Test: a date-only session re-created under a
  NEW id keeps its teacher, and the next removal names the new id.
- (d) Contrast: only `.org-theme` tokens; no new colour pairs. Removed rows switch muted
  text to `--fg` (as PersonRow does). Measured: every text colour on the page is a token.

### PR #654 logic

#654 did NOT change `programmeModel.ts`, `selfServeApi.ts` or `selfServeErrors.ts` relative
to this branch (main already carries #653's model + `searchPeople`). Its real fix was the
ProgrammeEditor re-read after save; that LOGIC is ported into `useDateEditor.resync()`.
Nothing was copied out of the old model.

### Old files imported (read-only, unchanged)

- `organiser-self-serve/programmeModel.ts` (toDraft, buildPayload, validateProgramme,
  newSession, add/remove/undo person, labels, notEditableCopy)
- `organiser-self-serve/selfServeApi.ts` (fetch/save programme, fetchDateDetail,
  fetchSeriesWorkspace, fetchCancellationReasons, searchPeople, query keys)
- `organiser-self-serve/selfServeErrors.ts` (programmeErrorCopy, commandErrorMessage,
  isServerRefusal, OFFLINE_SAVE_MESSAGE)
- `organiser-self-serve/seriesCommands.ts` (overrideCommand, cancelCommand,
  uncancelCommand, skipDateCommand)
- `organiser-self-serve/seriesModel.ts` (dateLabel, isRuleDate)
- `organiser-self-serve/editorGuards.ts` (UNSAVED_MESSAGE, confirmCopy)
- `organiser-self-serve/components/useOwnerCommand.ts` (hook)
- `organiser-self-serve/components/publicVenues.ts` (useVenueOptions, venueName; hooks, no component)
- `src/hooks/useUnsavedChangesGuard.ts`, `src/lib/londonDate.ts` (londonTodayKey)

When W5 deletes the old module, `useOwnerCommand.ts` and `publicVenues.ts` live under
`components/` and must move, not be deleted.

### Save model

One button saves everything: the venue override first (`occurrence.set_override`), then the
programme (`organiser_set_occurrence_programme_v1`, payload = old `buildPayload`, so untouched
sessions are the reader's objects byte for byte -- parity tests in both test files), then the
re-read. Break and cancel are commands confirmed inside the sheet and are disabled while
there are unsaved changes ("Save your changes first."). Break goes back to the event page.

### Gates run

- `npm run typecheck`: 95 errors, all pre-existing (same count before; 0 in `dates/`).
- `npx eslint src/modules/organiser/dates`: 0 problems.
- `npx vitest run src/modules/organiser/dates`: 20/20 pass.
- `npm run test:unit:offline` (with the CI offline env vars): 2289 pass, 6 fail = the 5
  known `tests/integrityCouldNotRun.test.ts` failures + **`src/modules/organiser/__tests__/shell.test.tsx`
  "/account/o/events/s1/dates/o1 renders its placeholder"**. That W0 test renders the real
  pages without a `QueryClientProvider` (and without supabase env), so it fails as soon as a
  placeholder is replaced by a page that reads data -- W1/W2/W4 will hit the same. Fix for
  W0/W5 (not mine to edit): wrap `at()` in `<QueryClientProvider client={new QueryClient()}>`
  and mock `@/integrations/supabase/client`, or assert only the shell for real pages.

### Measured in headless Chromium (Vite harness, real Tailwind config, mocked supabase)

Keyboard simulated by a fake `visualViewport` 300px shorter than the window. Search view =
a class session's "Add a teacher" with 8 results.

| Check | 390x844 | 320x568 | 390x500 | 1280x800 |
|---|---|---|---|---|
| Horizontal scroll (page / sheet / search) | 0/0/0 | 0/0/0 | 0/0/0 | 0/0/0 |
| Primary buttons visible (page / sheet) | 1 / 1 | 1 / 1 | 1 / 1 | 1 / 1 |
| Visible viewport with keyboard | 544 | 268 | 200 | 500 |
| Sheet top-bottom (kb) | 12-544 | 12-268 | 12-200 | 12-500 |
| Search input top-bottom (kb) | 73-114 | 63-103 | 63-104 | 84-132 |
| First result top-bottom (kb) | 125-182 | 114-172 | 115-172 | 145-205 |
| Input + first result fully visible | yes | yes | yes | yes |
| Search focused on view swap / dialogs in DOM | yes / 1 | yes / 1 | yes / 1 | yes / 1 |
| Collapse height at transitionend | 0px | 0px | 0px | 0px |
| List shrank by / row height | 54/54 | 54/54 | 54/54 | 56/56 |
| Residual gap / unmounted after | 0 / 311ms | 0 / 312ms | 0 / 316ms | 0 / 319ms |
| Text colours off the token list | 0 | 0 | 0 | 0 |
| Page errors | 0 (one favicon 404) | 0 | 0 | 0 |

### Gaps (existing RPCs only)

- A STORED session's type cannot change (the writer echoes `type` for existing sessions);
  the sheet says "remove this session and add a new one". New sessions pick any type.
- No per-date time field: the programme RPC has no date-time override, so the date's time is
  only ever its sessions' span (the old `occurrence.set_time` was not reused on purpose).
- Removing a stored session no longer asks the old hard confirm; it greys with Undo and the
  preview shows the result before Save. W5/owner may want the confirm back.
- Remove-a-date (ad-hoc dates) and note/picture/ticket overrides from the old DateActionSheet
  are not on this page (not in the DOMAIN per-date list).
- Cover upload (listed under W3 in ARC file ownership) is not built: the DOMAIN per-date list
  has no cover. Left for the event editor / W5.
- The venue list cannot request a new venue (old VenuePicker's request flow not rebuilt).

### Local primitives

None added. `Field` (label + input + error) and `SessionRow` are local to `dates/`.


## F1 -- Profile: lifecycle + Send for review + city (2026-10-08) -- DONE

Fix-up for the W1/W4 gap: `submitOrganiserProfile` had no screen in the new area. Owned paths
only: `src/modules/organiser/profile/**` (+ this section).

### Files

- `profile/reviewModel.ts` -- pure: `reviewStatus(lifecycle, reason)` (label from
  `LIFECYCLE_LABEL`, tone, one sentence, `canSend` = draft or rejected, the same rule as the old
  `organiserStatusView` and the RPC) and `sendBlockers({ name, cityId, dirty })`.
- `profile/ReviewCard.tsx` -- "Status" card at the top of Profile (under the organiser switcher):
  StatusTag + sentence (draft: 'Only you can see this organiser until the team approves it.';
  In review: 'The team is looking at it.'; Changes needed: 'The team asked for changes: <reason>'
  from `latest_decision.reason`, or '...changes.' with none; Live: 'Live on the site.'; paused /
  ended: tag only). 'Send for review' ('... again' for changes needed) for draft / changes needed
  only, as a GhostButton (the Save bar keeps the screen's one primary). Tap -> inline confirm
  ('No, not yet' / 'Yes, send it') -> the OLD `useSendForReview` hook (logic import: same home
  cache patch + reload as old /account) -> announce 'Sent for review.' (old Account's wording).
  Refusal: shake + `selfServeErrorCopy(...).message` (role=alert), kept visible after the reload
  removes the button (as the old header did).
- `profile/CityView.tsx` -- the city search as a view (`viewKey="city"`, fullHeight) of the
  page's one field sheet: SearchField (250ms wait), SkeletonRows, plain no-match / failure lines.
- `profile/index.tsx` -- City row in the About card (shows the city or 'Add'); the chosen city
  is part of the unsaved state and is saved with the profile (`saveOrganiserProfile(..., city.id)`).
- Test: `profile/__tests__/ProfileReview.test.tsx` (17): each state's copy and button, GhostButton,
  'again', confirm + submit + announce + In review, No, known and unknown refusal copy + shake,
  disabled reasons (unsaved, missing city, model), city search -> pick -> save -> send enabled,
  no match.

### Completeness checks (read this)

The old header applied NO check before enabling the button, and `submit_organiser_profile_v1`
checks only membership and state (definition read, SELECT only). So "the same checks as the old
UI" is none; F1 adds the profile's own required fields instead, never hidden, always as plain
text under the disabled button (aria-describedby): 'Missing: Organiser name, City.' from the
STORED profile (the team reviews what is saved), and 'Save your changes first.' while edits are
unsaved. If W5 wants exact old behaviour, pass `blockers={[]}`.

### Old / shared files imported (none modified)

`selfServeApi.ts` (LIFECYCLE_LABEL, HomeOrganiser type; submitOrganiserProfile via the hook),
`selfServeErrors.ts` (selfServeErrorCopy), `components/useSendForReview.ts` (a hook, not a
component), and W1's `home/onboarding/citySearch.ts` (search_cities, the shared CityPicker's read).
`resolveCanonicalCity` / `createCity.ts` were NOT needed: search_cities already returns canonical
city ids, and `resolveCreateCityId` is for event creates (venue city -> id).

### Gaps

- The confirm is an inline question in the card (Team's pattern), not a sheet view.
- The city label is search_cities' display name ('Bristol, United Kingdom') until the entity is
  re-read; after a save the invalidated entity query brings the stored city name.
- Not measured in a browser this round (no harness run); W5's sweep should include the Status card
  at 320px (long reasons wrap with break-words).

### Gates run (sandbox)

- `tsc -p tsconfig.app.json`: 0 errors under `src/modules/organiser/` (109 elsewhere, pre-existing).
- `npx eslint src/modules/organiser/profile`: 0 problems.
- `npx vitest run src/modules/organiser/profile`: 27/27.
- `npm run test:unit:offline`: 2388 pass, 13 fail = shell.test.tsx x8 (W5) + integrityCouldNotRun x5
  (known); nothing else.
