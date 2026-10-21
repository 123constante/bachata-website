# HANDOVER: dancer app Ember restyle (slice B, D115)

Branch `claude/dancer-app-ember` (cut from `origin/main` 66d65517, then `git merge origin/claude/er-ui-ember`, which merged clean).
Ticket dt_0d20a6bc484f. Brief: admin `brief/people-d89` `briefs/people-arc/RESTYLE-DANCER-APP.md` (e6747191).
Merges AFTER admin #910 (the RPC), Website #902 (ER-UI) and #897 (slice A).

## Done (each behaviour red-first, test named)
| # | Behaviour | Where | Test |
|---|-----------|-------|------|
| 1 | Edit: header back button + "Discard changes?" (Keep editing / Discard) through every way out (back, Back to Me, tabs, home link) | `screens/edit/EditScreen.tsx`, `shell/leaveGuard.tsx` | `__tests__/emberRestyle.test.tsx` "D119 Edit" |
| 2 | Full weekday names in written dates (`fullDate`, `shortDate` is now an alias) | `screens/nights/nightsModel.ts` | emberRestyle "D119 full weekday names" |
| 3 | "Saved" toast after a photo saves (shell-level, outlives the screen) | `shell/shellToast.tsx`, `PhotoScreen.tsx` | `screens/photo/__tests__/photoSavedToast.test.tsx` |
| 4 | D120 home link, local `SiteHomeLink` (props `onBeforeLeave`) on every /app/* route incl. setup focus chrome | `shell/SiteHomeLink.tsx` | emberRestyle "D120" (route-table, all 8 routes) |
| 5 | D121 colour layer: tokens, hero, rings, tinted tiles/tags/date blocks, vote, tab marker, confetti, line-art | `theme/dancer-color.css`, `shell/confetti.ts`, `screens/art.tsx` | `tests/client/dancerAppColor.test.ts`, `shell/__tests__/confetti.test.tsx` |
| 6 | D123 "What's on this week" removed (WhatsOn.tsx and useBrowseHref.ts deleted: nothing else used them) | `screens/home` | emberRestyle "D123/D124" |
| 7 | D124/D126 "Teachers and DJs from your nights": `my_nights_lineup_people_v1()` no args, strict pinned-shape parser, filled / empty (no button) / error + retry | `api/lineupPeople.ts`, `screens/home/LineupPeople.tsx` | emberRestyle (filled, empty, rpc error, malformed) |
| 8 | D129 switcher only with 2+ profiles (`shell/SwitcherGate.tsx`, own lazy chunk); "Your areas" row in Options | `shell/`, `optionsModel.ts` | emberRestyle "D129" |
| 9 | D130 no "Browse events" in /app/* | Home, Nights, `homeCopy.ts` | emberRestyle "D130" + homeAudit/nightsAudit |
| 10 | D131 top-bar Events button removed | `DancerAppShell.tsx` | emberRestyle D120, shellHeader, focusChrome, dancerAppShell |

Look: the shell is wrapped in `EmberWorld`; `theme/dancer.css` KEEPS the `--da-*` names (the shared ProfileSwitcher / PersonAvatar read them and are
slice A's files) but their VALUES are now the Ember palette (graphite ground, ember accent, `--da-gradient-*` = the sunset stops with the prototype scrim
already applied). New blocks used: `EmberWorld`, `SheetView`, `PrimaryButton`, `GhostButton`, `Card`, `SectionLabel`, `EmptyState`, `ErrorState`, `SkeletonRows`.

## Left (honest)
- **Not every screen was rebuilt out of blocks.** Home, the new section, Edit's leave sheet and the shell use the blocks; Nights, Me, Page, Options, Onboarding, the
  Edit form fields and Photo are still the existing screens carrying inline styles, re-skinned through the `--da-*` token values + the colour layer classes. Next
  worker: replace the `da-card` / inline-style groups with `Card` + `SummaryRow` (Options and Me rows), `Field` (Edit), `Chip` (onboarding), `StatusTag` where a tone exists,
  and delete `.da-card`, `.da-tap`, `.da-header` rules from `dancer.css` once nothing uses them. `tests/client/dancerAppTheme.test.ts` pins `dancer.css` (scoped, no at-rules, token parity).
- Date blocks keep a 3-letter weekday in the 48px tile (full name is in its `aria-label`; every written date is full). See Parked questions.
- Photo `crop frame` and date block were NOT moved into shared blocks ("asked of the rebuild": a tab bar, a date block with tones, a crop frame).
- `SiteHomeLink` is LOCAL (`shell/SiteHomeLink.tsx`): the orchestrator points it at slice A's shared one when both land (same props).
- The brief says `src/modules/dancer-app/dancer.css`; the real file is `theme/dancer.css` (kept; the colour layer is the new `theme/dancer-color.css`, a second sheet because
  `dancer.css` is pinned "no at-rules" and the confetti needs `@keyframes` and a reduced-motion query).

## Asked of the rebuild / other slices
- A shared tab bar, tone-coloured date block and crop frame block (`organiser/ui`).
- `/account/areas` must be in `catchallClientPaths.ts` (slice A / #897 adds it): `OptionsScreen.test.tsx` excludes `AREAS_PATH` from its "every href is routable" check until then.
- `dancer-area-isolation` check fails on this branch ONLY because it diffs against `origin/main` and the merged ER-UI branch brings `organiser/ui/**`, `organiser/theme.css`
  and two organiser tests into the diff (rule a). It goes green once #902 is on `main`. No file outside `src/modules/dancer-app/**`, tests, `perf-budgets.json` is changed by this branch itself.
- `perf-budgets.json`: dancer-app chunk allowance 55 -> 56 (the organiser/ui blocks are shared chunks); note `//dancer-app-2026-10-21-ember-restyle`. KB budget unchanged (365.3 / 368).

## Gates (command, exit code) -- sandbox run, GitHub Actions not consulted
| Step | Command | Exit |
|------|---------|------|
| unit (dancer slice) | `npx vitest run src/modules/dancer-app tests/client/dancerApp*` | 0 (47 files, 1524 tests; 1 pre-existing 5 s timeout flake in `public-page/__tests__/route.test.ts` on the very first baseline run, not touched, green on re-runs) |
| unit (all) | `npm run test:unit` | 1 -- 15 of 17 failures are PRE-EXISTING live-DB / typescript-resolution suites (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup` contracts, `integrityCouldNotRun`): the same 15 fail on unmodified `origin/main`; the other 2 (`avatarSurfaces`, `dancerAppReviewFixes` S3) were mine and are fixed (re-run green) |
| typecheck | `npm run typecheck` | 2 -- PRE-EXISTING: 101 errors on unmodified `origin/main` in this sandbox (`app/**`, resizable, calendarUtils ...), 99 with this branch; none in `dancer-app/**` or my tests |
| rpc typing / wallclock | `npm run check:rpc-typing`, `check:wallclock-brand` | 0 / 0 |
| dancer isolation self-test / check | `node scripts/check-dancer-area-isolation.mjs --self-test` / `npm run check:dancer-area-isolation` | 0 / 1 (see above, expected until #902 merges) |
| architecture | `lint:architecture`, `check:legacy-tables`, `check:legacy-program-rpcs` | 0 / 0 / 0 |
| images (strict) | `AUDIT_STRICT=1 npm run check:images` | 0 |
| mojibake | `npm run check:mojibake` | 0 |
| integrity | `bash bin/check-integrity.sh` (CI runs it after `chmod +x`; direct exec is 126 here) | 0 |
| lint chain | `npm run lint` | 1 only because `check:integrity` is 126 (not executable in the sandbox); the other 19 links PASS; `eslint .` skipped by the chain; eslint on changed files: 0 new errors (1 pre-existing `react-hooks/refs` in EditScreen `draftRef`) |
| production build | `npm run build` | 0 |
| bundle budget | `npm run check:bundle-budget` | 1 before the allowance change, 0 after (dancer-app 365.3 KB / 56 chunks) |
| first-load requests, chunk cycles | `npm run check:first-load-requests`, `check:chunk-cycles` | 0 / 0 |
| headless walk | `npx playwright test tests/e2e/dancer-app/ember-walk.spec.ts --project=chromium` | 0 (34 visits: 17 states x 390x844 and 1280x800) |

Cannot run in the sandbox: Lighthouse, `phone-qa` (`playwright.phone.config.ts` and `.build.config.ts`, need browser installs / long builds), live-DB contract checks, Vercel preview.

## Verified on real data / Not verified
- Verified: unit + headless walk on MOCKED data only (the RPC is not on prod, so the section was mocked as the brief says). Screenshots at 390x844: `docs/people-arc/restyle-b/*.png`.
  Walk checks per visit: zero console errors (the deliberate failed-read states may log react-query's "Query error:", allowed there only; the dev server's own
  "Extra attributes from the server: nonce" hydration warning is ignored on every page), `scrollWidth <= innerWidth`, the primary control not covered
  (`elementFromPoint` at its centre), the last content row not under the tab bar.
- NOT verified: the shape survey of production data (read-only SELECT via the Supabase connector was NOT run: this restyle adds no data read except the unreleased RPC; the brief's
  "real data" list for the existing screens was not re-surveyed); a real phone; Outfit loading (fonts stubbed/blocked in the headless run); the prototype-vs-code side by side
  (screenshots are of the code only, the prototype file is on `claude/proto-release-b`); `phone-qa`; the `/app/*` e2e specs in `test:e2e` (`reachability.spec.ts` was edited for D120/D131 but not run here);
  the RPC against the real database (admin #910 is not merged).

## Parked questions
- Q: Setup focus chrome (the "Not now" frame) hid every link out of the app so one tap could not abandon setup. D120 says the home link is on EVERY /app/* screen. Default used: the home link shows in focus chrome too. Options: hide it in focus mode. Cost if wrong: small. Where: `shell/DancerAppShell.tsx` (SiteHomeLink in the header).
- Q: "Full weekday names everywhere": the 48px date block shows the 3-letter weekday. Default used: block keeps 3 letters with the full name in its aria-label, every written date is full ("Saturday 24 Oct"). Options: a wider block or a stacked layout. Cost if wrong: small. Where: `screens/nights/nightsUi.tsx` DateBlock.
- Q: Empty states used to link "Browse events"; D130 removes it. Default used: words that point at the "Bachata Calendar" link top left ("Find a night with the Bachata Calendar link at the top left."). Cost if wrong: small. Where: `NightsScreen.tsx` NO_NIGHTS_FIND, `HomeScreen.tsx`, `LineupPeople.tsx`.
- Q: `--da-avatar` vs `--da-surface` contrast (the pinned pair, `avatarSurfaces.test.tsx`, slice A's file). The Ember surface is lighter, so the no-photo disc cannot hold 3:1 against it AND keep an AA letter with Ember's `#f1f2f4`. Default used: `--da-text` is pure `#ffffff` and `--da-avatar` is `#717684` (3.04 on the surface, 4.54 white on the disc, 3.51 on the ground); no pinned test changed. Options: relax the pair or ring the disc. Cost if wrong: small. Where: `theme/tokens.ts`.
- Q: "Your areas" href. Default used: `/account/areas` (slice A's route on `claude/people-release-b-web`, not on `main`). Cost if wrong: medium until #897 merges (the row would 404 on a main-only deploy, so merge order #897 first matters). Where: `screens/options/optionsModel.ts` AREAS_PATH.
- Q: The SwitcherGate hides the "Switch profile" button for a one-profile dancer, but its sheet also held Account settings and Sign out; both stay in Options. Default used: yes. Cost if wrong: small. Where: `shell/SwitcherGate.tsx`.

## Next steps for a continuation worker
1. Run the real-data shape survey (read-only) for Options / Nights / Me shapes; add the consistency matrix rows for any new shape.
2. Rebuild the remaining screens out of the blocks (see Left), then retire dead `dancer.css` rules.
3. Re-merge `origin/claude/er-ui-ember` if #902 changed; point `SiteHomeLink` at slice A's shared component.
4. Run `phone-qa` and the `test:e2e` dancer specs where a browser build is available.

## Continuation (RESTYLE-DANCER-APP-CONT, ticket dt_1cc76452e03b)

Merged `origin/claude/er-ui-ember` first: 4b2a3576 (D117) was already an ancestor of the branch head (d5c548b1), so the merge was a no-op.

### Done
| Screen | Now built from | Notes |
|---|---|---|
| Nights | `Card` (padded) + `SectionLabel`, `EmptyState` (empty), `GhostButton` (retry); date block and tags use Tailwind px classes over the colour layer | `nights-empty` testid now on the `EmptyState` itself |
| Me | `Card`, `SectionLabel`, `LinkRow` (Edit / My page / public page), `DisabledRow` (hidden profile, reason under the row) | |
| Page | `Card`, `SectionLabel`, `PrimaryButton`/`GhostButton`, link buttons | |
| Options | `Card` of `SummaryRow` / `LinkRow` / `DisabledRow`; sheets (`Sheet`) are now `SheetView` | header X is named "Dismiss" so it never collides with the body's "Close" |
| Onboarding | `Card`, block `Field`, `PrimaryButton`, `GhostButton`; the "You're in" card is `.da-hero` | options keep radio / checkbox roles (see Parked) |
| Edit form fields | block `Field` (label + wrapper), `FIELD_CLASS` inputs, block `Chip` | error / note ids and test ids kept (`<id>-error`, `error-<id>`, `note-<id>`) |
| Photo | `Card`, `PrimaryButton`/`GhostButton`, link-buttons for the two file labels | crop frame and preview frame stay bespoke |
| Home leftovers, `PlaceholderScreen` | every remaining `da-card` became `Card` or the tile classes | |

- New local file `screens/blocks.tsx`: `LINK_PRIMARY` / `LINK_GHOST` / `LINK_GHOST_SM` / `TEXT_ACTION` / `TILE_CLASS` (the blocks' tokens on a `<Link>` or `<a>`), `LinkRow` (a `SummaryRow` that navigates), `DisabledRow`. Reason: `PrimaryButton`, `GhostButton`, `Card` and `SummaryRow` render only a button or div.
- `dancer.css`: deleted `.da-card` (nothing uses it) and `.da-events` (dead since D131). KEPT `.da-tap` and `.da-header`: the shell itself (header, tab bar, "Not now", home link) and 9 screen files still use them, so "once nothing uses them" has not happened. `dancerAppTheme.test.ts` and `dancerAppColor.test.ts` pass.
- Tests edited because they asserted inline styles that are now classes: `b1bFinishFixes` (F8 44px link), `onboarding.test` (wrap, 44px, 56px chips), `OptionsScreen.test` (install sheet selector matched the sheet's own `opt-install-sheet-*` test ids). No behaviour assertion was weakened.
- Side by side: `docs/people-arc/restyle-b/compare/*.png` (left app, right prototype), the halves are `restyle-b/*.png` and `restyle-b/prototype/*.png`. Prototype shots are of `release-b-prototype.html` jump "Dancer app" at 390x844 (the `#frame` element).
  Prototype states with no app screenshot: edit-discard-sheet has no prototype jump; welcome and edit show the first state only.

### Gates (command: result)
| Step | Result |
|---|---|
| `npx vitest run tests/client src/modules/dancer-app` | 1635 passed, 10 skipped, 0 failed |
| `npm run build` | exit 0 |
| `npx playwright test tests/e2e/dancer-app --project=chromium` (390x844 and 1280x800 walk + the 6 specs) | first run 76 passed, 5 failed: `options` sheets (my "Close sheet" label matched `name: 'Close'`, FIXED: now "Dismiss"), and 4 cold-start timeouts (`home-filled` and `home-empty` at 390x844, the two `/account` redirect tests in `reachability.spec.ts`). Re-run of exactly those 7: 7 passed. I did not find why the first four were slow; they passed on the second run without a code change |
| `npm run lint` | every link PASS except `check:integrity` = exit 126 (`bin/check-integrity.sh` is not executable in this checkout, fails identically on the untouched branch). `bash bin/check-integrity.sh`: ok, 2139 files, 0 issues. `lint:eslint` is skipped by the chain when a link is red, so it was not run |
| `AUDIT_STRICT=1 npm run check:images` | exit 0 |
| phone-qa (`playwright.phone.config.ts`, 390x844 + 360x640) | 258 passed, 14 failed, 74 skipped. 2 failures were MINE (`keyboard.phone` dancer setup: Continue fell under the keyboard once the card got 16px padding and a 52px button): FIXED (onboarding card `p-[12px]`, 48px buttons), then all 16 dancer keyboard rows passed on re-run. The other 12 (scroll-reset, small-queue-gaps on public pages, organiser Save bar) touch no dancer-app file; NOT confirmed against the untouched branch, so unverified as pre-existing |

### Still left / Not verified
- Not verified: production data shape survey (the Supabase connector was not used; no data read changed in this slice); a real phone; Outfit loading (fonts blocked in the headless run); `pre-ship` and `phone-qa-section` as CI jobs; GitHub Actions.
- Known look differences from the prototype (small): level-vote buttons are outlined, the prototype's are filled `card2`; status tags have no leading dot; prototype date blocks spell the weekday in full (parked, D119).
- `StatusTag` was not used: its tones are live / draft / party / neutral, none is "Going / Interested / Went". The weekday and status colours stay on the colour layer (`da-tone-*`).
- `nightsStyles.ts` (`linkStyle`, `buttonStyle`, `gradientBg`) is still used by Home's hero and tiles; Home's inline-styled hero/tile internals were not converted.

### Asked of the rebuild (additions)
- `PrimaryButton` / `GhostButton` / `Card` with an `asChild` or `href` variant, and `SummaryRow` with `href` / `to` (every dancer row that navigates needed `LinkRow`).
- A radio / checkbox `Chip` variant (stacked 56px answers in onboarding).
- `SheetView` close label that does not contain the word "Close" collides in e2e `getByRole`: consider naming it "Dismiss" globally.

### Parked questions (continuation)
- Q: Onboarding answers (role, years, styles) are block-styled but kept as radio / checkbox buttons, not the pill `Chip`. Default used: keep roles (tests and screen readers rely on them). Options: switch to pills with `aria-pressed`. Cost if wrong: small. Where: `screens/onboarding/ui.tsx` Chip.
- Q: `.da-tap` / `.da-header` rules kept in `dancer.css`. Default used: keep (shell uses them). Options: move the shell to blocks. Cost if wrong: small. Where: `theme/dancer.css`.
- Q: Me's "My profile" section label is new (prototype has the three rows in one card under no label). Default used: keep the label. Cost if wrong: small. Where: `screens/me/MeScreen.tsx`.

## Fix pass (FIX-RESTYLE-B, job card jc-0022, ticket dt_94f9f5c6cf50)

Brief: admin `brief/people-d89` `briefs/people-arc/FIX-RESTYLE-B.md` (blob 3494f9e6). Review: `origin/claude/review-restyle-b`
`docs/people-arc/reviews/RESTYLE-B.md` (at 1fe6d51d). Decisions D138-D140 applied. ER-UI files untouched; nothing under
`src/modules/areas/**`, `src/pages/Account*.tsx`, `src/components/account/**`, `src/modules/organiser/**`.

### Findings: what was done (test names; "red" = seen failing on 1fe6d51d first)

| Id | Fixed how | Test |
|---|---|---|
| B3 | `theme/dancer.css`: `[data-profile="dancer"] .da-tap` now sets ONLY the 44px target, radius and no underline (no `color`, `display`, `align-items`, `justify-content`); `.da-tab`, `.da-not-now`, `.da-home-link` carry their own inline-flex; Edit back link and level-vote buttons got `inline-flex items-center justify-center`. LINK_PRIMARY renders `--btnfg` (#1d0a03) on `--btn`; RateNudge is a block tile again | `tests/client/dancerAppTheme.test.ts` ".da-tap never beats a block's own colour or layout (review B3)" (red); e2e `ember-walk.spec.ts` "ember fills under 4.5:1" on every state + explicit `contrast` on `me-main-action` (red on `me` and `page`, 2.96:1) |
| B1 (D139) | `vite.chunks.ts`: new first-party group `lib-org-ui` (Card, Chip, Field, SearchField, Skeleton, States, SummaryRow, useKeyboardInset); `src/lib/utils.ts` pinned to `lib-event-rules` (without it the group swallowed `cn` + tailwind-merge and every budgeted route measured +1 chunk). `perf-budgets.json`: /app/* chunk allowance 56 -> 53 (measured), note `//dancer-app-2026-10-21-fix-pass` | `tests/client/dancerAppChunks.test.ts`; `tests/chunkClassifier.test.ts` lib-event-rules list +1 line (the pinned list test) |
| B2 (D138) | `scripts/dancer-area-isolation-allowlist.json`: `docs/people-arc/` added to `docPrefixes`, seamNote "docPrefixes entry: docs only; orchestrator decision D138 2026-10-21". Nothing else added | `npm run check:dancer-area-isolation`: 70 -> 20 violations, ALL ER-UI (`src/modules/organiser/**` 17, `docs/organiser-rebuild/er/**` 3); they clear when main (with #902/#897) is merged in by the orchestrator |
| S1 (D140) | Change photo/Add photo goes through `leave()`; the shell's switcher container has an `onClickCapture` that runs the dirty guard (preventDefault, the sheet opens, Discard then follows the row's href); `beforeunload` while dirty | `emberRestyle.test.tsx` "S1: Change photo goes through the sheet...", "S1: a profile-switcher row goes through the sheet...", "S1: ... switches straight away when nothing changed", "S1: closing the tab or reloading asks the browser to confirm only while there are unsaved edits" (red) |
| S1 gap | History blocker NOT built: `/app/*` runs under a plain `<BrowserRouter>` (`src/App.tsx:151`), no data router, so a getBlocker hook would be a no-op. KNOWN GAP: browser/iOS swipe back loses an unsaved Edit draft (comment at `EditScreen.tsx` beforeunload effect) | - |
| S2 | Home next-night card error state: TEXT_ACTION "Try again" -> nights `retry` | `homeFixPass.test.tsx` "S2 ..." (red) |
| S3 | Lineup rows: router `<Link>`, chevron, `emitProfileView({personId, profileType: roles[0], context: 'dancer-app:home-lineup'})` loaded on tap | `homeFixPass.test.tsx` "a tap emits ONE profile view ... router link", "a DJ-only row emits type dj" (red). Cost: /event puller 2 -> 3, see Parked F1 |
| S4 | RateNudge: icon tile + stacked text + chevron; strength: one full-width "Profile strength" row (ring, subline, chevron); hero "See event": full width, 52px, 18px/800 pill, token colours (`.da-hero-cta`, ~19:1) | `homeFixPass.test.tsx` S4a/S4b/S4c (red) |
| S5 | Partner button is the ghost look (card2, fg, line border) | `homeFixPass.test.tsx` S5 (red) |
| S6 | `ScreenTitle` (h1 28px/800, -0.025em, `--fg`) in `screens/blocks.tsx`, used on Me, Edit, Options, My page, Nights, Photo, Onboarding | `screenTitles.test.tsx` "S6: every dancer screen titles itself through ScreenTitle" (red) |
| S7 | CityPicker gets an Ember className (card2, line-strong border, 16px, 48px); the hide-surname switch box maps the shadcn vars to Ember HSL (light knob, ember on-track) in `theme/dancer-color.css`. Shared components not edited | `screens/edit/__tests__/editPalette.test.tsx` (red). Not covered: the picker's popover list is portalled outside the dancer wrapper |
| S8 | `SectionTitle` (sentence case 15px/700 `--fg`) on Home lineup, Nights Upcoming/Past, Me "My profile", Page "How your page looks"; lineup chevron (S3) | `screenTitles.test.tsx` "S8: ..." (red) |
| S9 | ONE `FIND_A_NIGHT` in `copy/sharedCopy.ts` ("Find a night with the Bachata Calendar link at the top left."), used by Home, Nights (`NO_NIGHTS_FIND`) and the lineup empty state | `homeFixPass.test.tsx` S9 x4 (red) |
| S10 | Left as is: clears with the merge order (#897 adds `/account/areas`) | - |
| N1 | `shell/confetti.ts`: one burst at a time (a live `.da-confetti` layer blocks a second); import order fixed in `useMyDancerEdit.ts` | `shell/__tests__/confetti.test.tsx` "review N1 ..." (red) |
| N2 | Lineup renders nothing while there is no user | `homeFixPass.test.tsx` N2 (red) |
| N3 | Parser dedupes by profile_id (first wins, total reduced); "and N more" only when total > rows | `homeFixPass.test.tsx` N3 x3 (red) |
| N4 | `NotesArt` deleted; `.da-hero--flyer` and the `.da-ticks` rules (unused after N8) removed. `shortDate` KEPT: RateNudge and `homeAudit.test.tsx` still import it | cleanup, no red |
| N5 | New `--da-pop-*`/`--da-photo-well` tokens (tokens.ts = dancer.css); confetti, art strokes, PhotoScreen, Home hero use variables; the `,#f5865a` fallbacks dropped | `homeFixPass.test.tsx` no-raw-hex in `screens/home/**` (red); theme hex test |
| N6 | One `:focus-visible` 2px `--da-focus` ring for a, button, input, select, textarea, role=button/radio/switch (a plain selector list: the theme test splits on commas) | `dancerAppTheme.test.ts` "one focus ring for every control (review N6)" (red) |
| N7 | Discard is quiet danger text (`--danger`, 44px). The X stays: `SheetView` always renders `Dialog.Close` (organiser file) -- Parked F3 | `emberRestyle.test.tsx` "N7: ..." (red) |
| N8 | `StickyActions` (sticky above the tab bar) on Page and Photo; Page checklist uses 20px tick discs (`lookLines` -> `{text, done}`); "Dancer" badge kept (Q4) | `screenTitles.test.tsx` "N8: ..." x3 (red), `pageModelRole.test.ts` |
| N9 | Ember pairs added to the contrast test (btnfg/btn, fg/mut/gold-fg on bg/card/card2, danger/card) | `dancerAppTheme.test.ts` "contrast of the Ember pairs ..." |
| N10 | PR body updated (no "not yet rebuilt" line) | - |
| N11 | Stays (switch to slice A's SiteHomeLink after #897) | - |
| Same fact | PARKED (F2) | - |

### Gates (sandbox, this head; command: exit)

| Job / step | Command | Result |
|---|---|---|
| perf-budget | `npm run build` (perf-budget.yml env) | 0 |
| | `npm run check:bundle-budget` | 0: dancer-app 366.6 KB / 53 chunks / 4 pullers; every other route at its chunk allowance; /event 3 pullers (allowance raised, F1) |
| | `npm run check:first-load-requests` | 0 (six pins unchanged) |
| | `npm run check:chunk-cycles` | 0 |
| | all 87 client entries, static closure vs 1fe6d51d | none gained a chunk; 19 lost 1-6 |
| dancer-area-isolation | `npm run check:dancer-area-isolation` | 1: 20 violations, all ER-UI (B2) |
| lint | `npm run lint` | 0 (20 of 20 links) |
| unit | `TZ=Europe/London npx vitest run` | 1: 11162 passed / 15 failed / 19 skipped: the SAME 15 the review saw on main (live-DB contracts: no valid key; `integrityCouldNotRun` x5: sandbox `NODE_PATH`, 67/14 skipped with `NODE_PATH=`) |
| unit slice | `npx vitest run src/modules/dancer-app tests/client` | 0 (65 files, 1729 tests) |
| typecheck | `npm run typecheck` | 2: 100 errors, 0 in dancer-app (pre-existing sandbox errors, review measured 99-101) |
| e2e-smoke | `npm run test:e2e` | 1: 159 passed, 1 failed, 1 skipped; the failure is `dancer-home.spec.ts:168` toHaveURL on /account/o, the flake the review recorded on 1fe6d51d; re-run alone: passed |
| walk | `npx playwright test tests/e2e/dancer-app/ember-walk.spec.ts --project=chromium` | 0: 51 passed (17 states x 390x844, 360x640, 1280x800): contrast >= 4.5 on every ember fill, primary not covered, no sideways scroll, tab bar off the last row, zero console errors; 390x844 shots refreshed in `docs/people-arc/restyle-b/` |
| phone-qa | `npx playwright test --config playwright.phone.config.ts` (390x844 + 360x640) | 0: 272 passed, 74 skipped |
| build-smoke | fake-Supabase `npm run build` + `npx playwright test --config playwright.build.config.ts` | 0 / 0: 66 passed |
| integrity | `AUDIT_STRICT=1 npm run check:images` | 0 |

### Verified on real data / Not verified
- Shape survey (prod `stsdtacfauprzrdebmzg`, read-only counts): 6 claimed, non-archived dancer profiles; 0 without avatar, 0 inactive, 0 without city, 6 without bio; longest display name 16 chars; 0 people with 2+ dancer profiles (the switcher capture is exercised by tests only); `my_nights_lineup_people_v1` now EXISTS on prod (admin #910 landed).
- Not verified: a real phone; the lineup RPC called as a real user (auth-scoped, mocked in tests and the walk); gradient-surface contrast by pixel sampling (the e2e skips gradient backgrounds); focus trap inside sheets; Onboarding step 1; GitHub Actions on this head (not consulted from the sandbox); Vercel preview (no VERCEL_TOKEN check run).

### Parked questions (fix pass)
- **F1. /event puller 2 -> 3 from S3.** Question: accept the extra vendor-supabase puller on /event, or fix profileViewEmit? Default used: allowance raised with a note (`perf-budgets.json` `//dancer-app-2026-10-21-fix-pass`); /event chunks and KB unchanged. Options: (a) keep; (b) change `src/lib/profileViewEmit.ts` to use `getSupabase()` (outside this slice's files) and tighten back to 2; (c) drop the telemetry from the lineup rows. Cost if wrong: small. Where: `src/modules/dancer-app/screens/home/LineupPeople.tsx` (tap handler), `perf-budgets.json` pullerRatchet.
- **F2. Same fact, same words (Home ring vs slice A "N answers left").** Default used: parked; Home keeps `nextStepLine`. Why: slice A's count is `my_profile_progress_v1.required_left`; Home's ring is `my_dancer_edit_v1.strength.missing` (includes optional steps), so at 70% Home would say "0 answers left"; importing `profileProgress` also pulls the eager Supabase client into /app/*. Options: leave; Home calls the progress RPC lazily; add `required_left` to `my_dancer_edit_v1` (admin). Cost if wrong: small. Where: `screens/home/HomeScreen.tsx` strength row.
- **F3. N7 close X on the discard sheet.** Default used: keep the X. Options: a `hideClose` prop on organiser `SheetView` (organiser slice), or a dancer-local sheet. Cost if wrong: small (cosmetic). Where: `src/modules/organiser/ui/SheetView.tsx:166`.
- **F4. S1 browser back.** Default used: `beforeunload` only, history blocker recorded as a known gap (no data router). Options: accept; a popstate re-push guard (fragile on iOS); move /app/* to a data router. Cost if wrong: small (a lost unsaved draft). Where: `screens/edit/EditScreen.tsx` beforeunload effect.
- **F5. tests/chunkClassifier.test.ts** is outside the brief's file list; it pins the lib-event-rules list exactly, so D139's `utils.ts` pin needed one line there. Default used: changed. Cost if wrong: small.

### Next steps
- Orchestrator: merge `origin/main` after #897 (and #902) land; re-run `check:dancer-area-isolation` (expect 0) and `check:bundle-budget` (the merge may move the counts).
- Decide F1-F5.

## Merge main + N11 (MERGE-925, ticket dt_286ce6e8b3c2)

`origin/main` (5955daf, #897) merged into `claude/dancer-app-ember` with a plain `git merge`, conflict-free. One push.

| Gate | Command | Result |
|---|---|---|
| dancer-area-isolation | `npm run check:dancer-area-isolation` | exit 0 ("rules a+b+c: OK", base 5955daf) -- the 20 ER-UI files clear |
| bundle-budget | `npm run check:bundle-budget` | exit 0; `/app/*` chunk ratchet 53/53, nothing moved, **no allowance change** |
| production build | `npm run build` | exit 0 |
| unit | `npm run test:unit` | 4 files / 15 tests red, **the same 4 files fail on main 5955daf** (3 live-DB `*.contract.test.ts`, `integrityCouldNotRun`; `festivalClientState` is listed in the failures here but passed on main in isolation -- treat as load-sensitive, unconfirmed) |
| typecheck | `npm run typecheck` | exit 2; same `src/` error set as main, EXCEPT one the merge introduced (below, fixed) |
| lint chain | `npm run lint` | `check:integrity` exit 126 (`bin/check-integrity.sh` not executable here; same on main); other links PASS; eslint link skipped by the chain |
| e2e dancer-app (7 specs incl. ember-walk at 390x844, 360x640, 1280x800) | `npx playwright test tests/e2e/dancer-app/*.spec.ts --project=chromium` | 95 pass / 3 fail in the full parallel run; the 3 (ember-walk home-filled, home-empty, reachability `/account`) **pass re-run alone** (load timeouts) |

Merge fallout fixed: main's `signOutEntryPoints.test.tsx` passed `buttonStyle` to the dancer-app `SignOutConfirm`, a prop this branch removed in the restyle. The test no longer passes it (8/8 green).

### N11 -- shared SiteHomeLink: NOT switched (parked)
The isolation rules (a/b/c) do not forbid `dancer-app` importing `src/modules/areas/shared/SiteHomeLink.tsx`, but the two are not drop-in: the shared one has no `onBeforeLeave` prop and uses areas' own `leaveGuard` (`isLeaveDirty`/`requestLeave`), which the dancer shell's `guardRef` Discard sheet does not feed, so a swap would silently drop the dancer Discard prompt. It also renders different markup (Tailwind classes, `Home` icon, no `da-home-chip`), which `emberRestyle`, `shellHeader`, `focusChrome` and the ember-walk spec assert. Local copy kept.

### Parked questions (merge)
- **M1. Unify SiteHomeLink.** Default used: keep the local copy. Option: add `onBeforeLeave` and a chip slot to the shared component (in `src/modules/areas/**`, off-limits to this slice) and have the dancer shell pass its guard. Cost if wrong: low. Where: `src/modules/dancer-app/shell/SiteHomeLink.tsx`.
- **M2. Could not run in the sandbox:** `check:integrity` (exec bit), the live-DB contract tests, phone-qa and build-smoke (need PR context / a live deploy). GitHub Actions is the source of truth for those.
- **M3. Test run rewrote tracked screenshots/snapshots** (`docs/handover/**` PNGs); they were deliberately NOT committed.
