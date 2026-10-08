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
