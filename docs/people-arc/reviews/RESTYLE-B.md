VERDICT: FIX PASS NEEDED

# Independent review: slice B, the dancer app in the Ember look (PR #925)

- Reviewed: `claude/dancer-app-ember` at **1fe6d51d34e008dc29e1976d94d3bcb95874d929** (PR #925, "feat(dancer-app): Ember look for the signed-in dancer app (D115)").
- Against: `origin/main` 817a4dd (whole PR) and `origin/claude/er-ui-ember` 4b2a357 (restyle commits d5c548b, b39d756, 3d3de0e, merge 1fe6d51).
- Target: prototype v3, `docs/prototypes/release-b-prototype.html` on `claude/proto-release-b`, jump group "Dancer app".
- Brief: `briefs/people-arc/REVIEW-RESTYLE-B.md` (admin `brief/people-d89`, blob 03da24a2). Reviewer did not write this code. Read-only: this branch adds only this file and `reviews/restyle-b/*.png`.
- Method: three independent passes (CI re-run on HEAD and main; a browser walk of 16 states x 2 viewports, 390x844 and 360x640, against the prototype on mocked data using the `ember-walk.spec.ts` mocks; a code and rules read). Every blocking finding below was re-checked by hand.

## Blocking

### B1. `bundle-budget` is red: /app/* loads 59 first-load chunks, allowance 56
- **Where:** `perf-budgets.json`, the `chunkRatchet` line `"dancer-app (/app/*, lazy chunk via catchall)": 56` and its `//dancer-app-2026-10-21-ember-restyle` note.
- **What happens:** `npm run build && npm run check:bundle-budget` prints `[OVER] chunk ratchet: dancer-app (/app/*, lazy chunk via catchall) -- 59 first-load chunk(s), allowance 56`. GitHub's own `bundle-budget` check on PR #925 is also **failure**. KB is fine (367.1 of 368 KB). Main measures 55.
- **Chunk diff vs main build:** new on /app/* first load: `Card-*`, `Chip-*`, `Field-*`, `SearchField-*`, `Skeleton-*`, `States-*`, `SummaryRow-*`, `useKeyboardInset-*` (plus one replacement). Gone: `eventRpcs-*`, `format-*`, `wallClock-*`, `useCalendarEventsRpc-*`. Net +4. The note's "measured 56" does not match this tree: it was likely measured before 3d3de0e rebuilt the other screens out of more blocks.
- **Fix:** two options; prefer the first.
  1. Cut the chunk count. Add a first-party group in `vite.chunks.ts` that puts the organiser `ui/` blocks /app/* loads (Card, Chip, Field, SearchField, Skeleton, States, SummaryRow, useKeyboardInset) into ONE chunk. The organiser routes already load all of them, so they pay nothing new. Re-measure every route; keep 55 or 56.
  2. Raise the allowance to the measured number (59). Rewrite the note with the real count and the named chunks, as the `//chunkRatchet` block's own rules ask.
- Either way, re-run `npm run check:bundle-budget` and `npm run check:first-load-requests` and paste the numbers into the note.

### B2. `dancer-area-isolation` is red: 70 changed files outside the allowed paths
- **Where:** `scripts/check-dancer-area-isolation.mjs` (rule a), allowlist `scripts/dancer-area-isolation-allowlist.json`. Workflow `.github/workflows/unit-tests.yml:188` job `dancer-area-isolation`. GitHub's check on PR #925 is **failure**. It passes on main.
- **What happens:** every violation is type (a) "changed file is neither inside src/modules/dancer-app/, nor a test, nor a seam":
  - 17 under `src/modules/organiser/**` (the ER-UI merge: `ui/*.tsx`, `ui/ember.css`, `theme.css`, `ui/index.ts`, `__tests__/ember*.test.ts(x)`)
  - 49 PNGs under `docs/people-arc/restyle-b/`
  - `docs/people-arc/HANDOVER-restyle-b.md`
  - 3 under `docs/organiser-rebuild/er/**`
- **Fix:** the check's own header says adding a seam is an orchestrator decision, never a code edit, so do NOT edit the allowlist in the fix pass.
  - The ER-UI files disappear from the diff once #902 (ER-UI) merges to main. That is the documented merge order: merge `origin/main` into the branch after #902 lands.
  - The `docs/people-arc/**` files need either an orchestrator allowlist entry for `docs/people-arc/**` or moving out of the PR. The check's self-test says "a handover doc may be added", so check which path it allows and move the handover and shots there if that path exists.
  - Record the remaining cause in the handover. See parked question Q2.

### B3. White text on the ember primary links: 2.96:1, needs 4.5:1
- **Where:**
  - `src/modules/dancer-app/screens/blocks.tsx:13`. `LINK_BASE` includes the class `da-tap`.
  - `src/modules/dancer-app/theme/dancer.css:54-61`. `[data-profile="dancer"] .da-tap { color: inherit; display: inline-flex; ... }` has specificity 0,2,0, so it beats Tailwind's `text-[var(--btnfg)]` (0,1,0).
- **What happens:** `me-main-action` (Me), `page-view` (Page), `onboarding-add-photo` (Onboarding photo step) and "Take photo" (Photo) render `#fff` on `#f0703a`, measured **2.96:1**. The real `PrimaryButton` (Save changes) correctly renders `#1d0a03`. The prototype uses dark text. Screenshot: `restyle-b/me-white-on-ember.png`. Same at 390x844 and 360x640.
- **Same root cause, second symptom:** `.da-tap` forces `display:inline-flex` on `RateNudge` (`screens/home/RateNudge.tsx:31`), so its title and body sit side by side and "Rate Monday 5 Oct" wraps (S4).
- **Fix:**
  - Lower the rule's specificity: `:where([data-profile="dancer"]) .da-tap { ... }`, or drop `color: inherit` and `display` from it.
  - Or remove `da-tap` from `LINK_BASE` and `TEXT_ACTION`; both already set min-height.
  - Add a vitest that renders `LINK_PRIMARY` inside `[data-profile="dancer"]` and asserts the computed colour is `var(--btnfg)`, or add an e2e contrast assertion on `me-main-action` in `ember-walk.spec.ts`.

## Should

### S1. The leave guard misses some ways out of Edit
- **Where:** `src/modules/dancer-app/screens/edit/EditScreen.tsx:215`. The "Change photo"/"Add photo" `<Link to={`${PHOTO_PATH}?return=/app/me/edit`}>` has no `onClick={leave(...)}`. Compare lines 195 and 375, which have it.
- **What happens:** the person types a bio, taps Change photo, and the Edit form unmounts. They come back through `return=/app/me/edit` with the draft reset and the bio lost. No sheet appeared.
- **Also unguarded:**
  - The profile switcher rows (`src/components/account/profiles/ProfileSwitcher.tsx:115,133`, shown for people with 2+ profiles).
  - Browser or iOS swipe back. No blocker, `popstate` or `beforeunload` exists under `src/modules/dancer-app`.
- **Fix:**
  - Add `onClick={leave(`${PHOTO_PATH}?return=/app/me/edit`)}` at line 215.
  - For the switcher, which lives in slice A's files and must not be edited here: use an `onClickCapture` on the shell's switcher container in `shell/DancerAppShell.tsx` that runs the guard and calls `preventDefault` when dirty.
  - For browser back: add a `beforeunload` listener while dirty, and a history blocker in the pattern of `src/modules/organiser/edit-in-place/EditInPlaceLayer.tsx:464`. Or record browser back as a known gap in the handover; see Q3.
  - Extend `__tests__/emberRestyle.test.tsx:166-197` with Change photo and the switcher.

### S2. The Home next-night card has no action when loading fails
- **Where:** `src/modules/dancer-app/screens/home/HomeScreen.tsx:139-145`.
- **What happens:** when `isError`, the card shows only "We couldn't load your nights." with no retry, and the "Find one with..." line is hidden for errors. On main this branch had Browse events; D130 removed it and put nothing in its place, which breaks "every empty or failure state has one action".
- **Fix:** when `isError`, render a `TEXT_ACTION` "Try again" button that calls the nights query's `refetch`. Expose `refetch` from `useMyNights` if needed. Add a test.

### S3. Lineup rows do not call `emitProfileView` and reload the whole page
- **Where:** `src/modules/dancer-app/screens/home/LineupPeople.tsx:60`, `<a key={p.profile_id} href={p.public_path} ...>`.
- **What happens:** a tap on a teacher or DJ is never counted as a profile view, which `.claude/rules/data-contracts.md` mandates for clickable profiles. The plain `<a>` also does a full document reload out of the SPA.
- **Fix:** use `<Link to={p.public_path} onClick={() => emitProfileView({ ... })}>` following an existing caller (for example `src/modules/event-page/sections/EventHeroMetaBlock.tsx:169`). Add a chevron (S7). Add a test that a click emits once.

### S4. Home layout differs from the prototype in three places
Screenshot: `restyle-b/home-nudge-strength-hero.png`. Both viewports.
- **Rate nudge** (`screens/home/RateNudge.tsx:31`): title and body side by side; no tick tile and no chevron. Fix with B3, then lay it out as icon tile, stacked text and chevron.
- **Strength tile** (`HomeScreen.tsx:152`): a 2-column grid with one child, so the tile is about 178px wide with the right half empty. Fix: one column (`grid-column: 1 / -1`), using the prototype's full-width "Profile strength" row (ring, subline, chevron).
- **Hero "See event"** (`HomeScreen.tsx:133`): 99x48px at 15px; the prototype has a full-width pill about 56px tall at 18px. It also uses inline `'#fff'`/`'#1A0F0B'` (S8). Fix: full width, 52px or more, token colours.

### S5. Two filled primaries on Home
- **Where:** `screens/home/PartnerTile.tsx:34-39`.
- **What happens:** "Tell me when it's ready" uses the filled ember `buttonStyle` while the hero "See event" is already the primary. The rule is one primary per screen, and the prototype makes the partner action a ghost.
- **Fix:** use the ghost look (`LINK_GHOST` or `GhostButton`).

### S6. No single page-title style
- **Measured:**
  - Me and Edit `h1`: 14px/700, muted (`screens/me/MeScreen.tsx:25`, `screens/edit/EditScreen.tsx:198`).
  - Options and My page: 18px/800 (`screens/options/OptionsScreen.tsx:42,53,62,101`, `screens/page/PageScreen.tsx:29,50`).
  - Nights: 20px/800 (`screens/nights/NightsScreen.tsx:71`).
  - Onboarding: 30px (`screens/onboarding/ui.tsx:47`).
- **Prototype:** `.title` is 28px/800 on every screen. Screenshot: `restyle-b/nights-titles.png`.
- **Fix:** one `ScreenTitle` in `screens/blocks.tsx` (28px/800, `letter-spacing: -.025em`), used by every screen.

### S7. City picker and "Hide my surname" switch are off-palette on Edit
- **Where:** `screens/edit/EditScreen.tsx:236` (`CityPicker`) and `:70` (`HideSurnameSwitch`).
- **What happens:** both use the site shadcn tokens.
  - The picker renders a black (`rgb(0,0,0)`) field with a `#333` border and 11.88px text, from rem shrink at the phone's 13.57px html font-size.
  - The switch has a `#333` track and a black 38px knob on a dark card, so it reads as a hole. The prototype has a light knob.
- Screenshot: `restyle-b/edit-offpalette.png`.
- **Fix:** do not edit the shared components; `HideSurnameSwitch` is a protected file for the isolation check.
  - Pass `className` overrides (`bg-[var(--card2)] text-[16px] border-[var(--line)]`).
  - Or map `--background`, `--input`, `--primary` and `--ring` to Ember tokens inside the dancer wrapper (`[data-profile="dancer"]` in `theme/dancer-color.css`).

### S8. Lineup rows: no chevron, and section-label style differs
- **Where:** `screens/home/LineupPeople.tsx:60` (inline-styled row, no chevron).
- **What happens:** the rows don't read as tappable.
  - Section labels (`SectionLabel`) are UPPERCASE muted 13px; the prototype uses sentence-case 15px/700.
  - The same applies to Nights "UPCOMING/PAST" and Me "MY PROFILE".
- **Fix:** add `ChevronRight` and move the inline styles to classes. Pick one label style for the app; the prototype's is the default.

### S9. "Find a night" copy written three ways
- **Where:**
  - `screens/home/HomeScreen.tsx:143` ("Find one with...")
  - `screens/nights/NightsScreen.tsx:18` (`NO_NIGHTS_FIND`)
  - `screens/home/LineupPeople.tsx` empty state ("Find your next night with...")
- **What happens:** the same fact is worded three ways, which breaks "one shared mapping per fact".
- **Fix:** one exported constant (for example in `copy/sharedCopy.ts`), used by all three.

### S10. "Your areas" goes to the 404 page until #897 merges
- **Where:** `screens/options/optionsModel.ts:39,97` link to `/account/areas`. `src/components/AnimatedRoutes.tsx` has no such route on HEAD, so it falls to `path="*"` NotFound.
- **Mitigation already in place:** the PR #925 body says: "**Merge order: AFTER admin #910 (...), Website #902 (ER-UI; ...) and #897 (slice A; "Your areas" links `/account/areas`).**"
- **Fix:** none needed if that order holds. A belt-and-braces option is to gate the row on the route existing. Re-check after #897.

## Nit

- **N1.** Confetti can fire twice on onboarding.
  - **Where:** `api/useMyDancerEdit.ts:42` fires on crossing 70%; `screens/onboarding/OnboardingScreen.tsx:77` fires again on `stage === 'in'`.
  - **What happens:** two bursts overlap.
  - **Fix:** skip the crossing burst while onboarding, or de-dupe within 1.2s.
  - Also, the `daConfetti` import sits above the react imports in `OnboardingScreen.tsx:1`.
- **N2.** `LineupPeople.tsx:34`: `q.isError || !q.data` shows the error state, with a retry that does nothing, while the query is merely disabled (no `user`). Render the skeleton or nothing while `!user`.
- **N3.** `api/lineupPeople.ts`: no de-duplication by `profile_id`. A duplicate collides on the React key at `LineupPeople.tsx:60`. `total` is parsed but never shown. Dedupe in the parser; show "and N more" only if the RPC caps the list.
- **N4.** Leftovers:
  - `.da-hero--flyer` (`theme/dancer-color.css:36`) has no user.
  - `NotesArt` (`screens/art.tsx:27`) has no importer.
  - `shortDate` is now only an alias of `fullDate` (`screens/nights/nightsModel.ts:157`; callers `RateNudge.tsx:14` and tests).
  - `.da-card` is already gone, and every other class in `dancer.css`/`dancer-color.css` has a user.
- **N5.** Hard-coded colours outside the token files:
  - `shell/confetti.ts:1` (6 hex)
  - `screens/art.tsx` (14 stroke hex)
  - `PhotoScreen.tsx:44,45,299,332` (`#fff`/`#000`)
  - `var(--gold-fg,#f5865a)` fallbacks in `blocks.tsx:23`, `nights/LevelVote.tsx:82`, `options/OptionsScreen.tsx:121`
  - `HomeScreen.tsx:133` (already on main)
  - **Fix:** move them into `theme/tokens.ts` / `dancer-color.css` variables.
- **N6.** Focus rings are uneven.
  - `.da-tap` gets the 2px `#FFC2B8` ring. `SummaryRow`/`Chip` buttons and the hero, lineup and nights links fall back to the browser's `auto 1px`. Inputs show only a 1px border change (`FIELD_CLASS` `outline-none`).
  - Nothing is invisible, but it is weak.
  - **Fix:** one `:focus-visible` outline rule on the Ember root.
- **N7.** Edit discard sheet: "Discard" is a grey ghost with a grab handle and an X. The prototype pattern (the teacher-details sheet; there is no dancer one) has "Discard" as quiet red danger text and no X. The behaviour is correct. Screenshot: `restyle-b/edit-discard-sheet-360.png`.
- **N8.** Placement:
  - Page and Photo put their buttons in the content flow; the prototype pins them at the bottom.
  - Page's checklist uses dots, not tick discs.
  - The header shows a "Dancer" badge that is in neither the prototype nor the handover (Q4).
- **N9.** `tests/client/dancerAppTheme.test.ts` passes (39/39), and what it asserts is still true of `dancer.css`. But the screens now mostly use the Ember variables (`--mut` x33, `--card2` x12, `--fg` x11) rather than `--da-*` (about 6 uses), so its contrast pairs cover little of what renders. Add the Ember pairs, including `--btnfg` on `--btn`, which would have caught B3.
- **N10.** The PR #925 body still says Nights/Me/Page/Options/Onboarding/Photo are "not yet rebuilt out of blocks". Commit 3d3de0e and the handover "Continuation" say they were rebuilt. Update the body.
- **N11.** Note only: `shell/SiteHomeLink.tsx` is a local stand-in for slice A's shared one, and its doc comment says so. This is fine until both slices land; then switch to the shared one.

## Intended differences judged acceptable
- D131: the Events button is removed.
- D129: the avatar and switcher appear only with 2+ profiles.
- D130: no "Browse events"; empty states point at the home link, which is on screen.
- Date block: 3-letter weekday, with the full name in `aria-label`.
- Outlined level-vote buttons.
- Status tags without dots.
- The no-photo disc is grey (`#717684`, white initial, inside the sunset ring) instead of ember-soft. This is a pinned contrast pair, and the disc renders correctly on Me and in the lineup rows.
- Me's "My profile" label.
- Onboarding answers kept as radios.
- Edit's back control in the header.
- The prototype's own lineup avatars render as stretched ellipses, so that part of the prototype is unreliable as a target.

## Verified OK
- **Untouched Save sends nothing.** `submit()` returns early when nothing changed (`EditScreen.tsx:151-152`). `tests/client/dancerAppMeEdit.test.tsx:92-101` counts 0 saves and 0 writes. Hide surname saves on its own switch.
- **Leave sheet appears only when dirty** (delta has keys, `EditScreen.tsx:132`). It is wired to header back, Back to Me, the home link (`DancerAppShell.tsx:70`) and the tab bar (`DancerAppShell.tsx:110`). Gaps are listed in S1.
- **Status words come from one mapping** (`HIDDEN_STATE_LINE`/`HIDDEN_STATE_WORD`/`SHOW_AGAIN_LABEL` via `copy/sharedCopy` -> `lib/accountRouting`) on Home, Me, Options, Page and Onboarding.
- **Disabled controls say why:** Save, the WhatsApp switch and Me's public page row.
- **D123:** `WhatsOn.tsx` and `useBrowseHref.ts` are deleted, with no importer left.
- **D130/D131:** no Browse events or Events control in dancer-app.
- **D129:** `SwitcherGate.tsx` renders null unless the status is ready and there are 2+ items. Seen live with 2 profiles, and it fits at 360.
- **Lineup parser:** follows the pinned RPC shape strictly; on an error it shows ErrorState with a retry.
- **Confetti respects reduced motion** (JS and CSS).
- **Toast timer** is cleaned up on unmount.
- **No raw Unicode punctuation** in changed `.ts`/`.tsx`.
- **Tap targets:** no visible control under 44x44 CSS px on any of 32 renders (16 states x 2 viewports).
- **No horizontal scroll** on any render.
- **Contrast:** B3 is the only text below 4.5:1. The disabled Save is 3.23:1, which is exempt.
- **File scope:** outside the slice's paths there is only the ER-UI merge (`src/modules/organiser/**`, `docs/organiser-rebuild/er/**`, matching `origin/claude/er-ui-ember`). Nothing in `src/modules/areas/**` or the account pages. The `tests/e2e-build/account-edges.build.spec.ts` change is justified by D129: sign-out moves to Options for a one-profile dancer.

## CI re-run (local, HEAD 1fe6d51 vs origin/main 817a4dd)

| Command | Exit (HEAD) | HEAD counts | main | Note |
|---|---|---|---|---|
| integrity job, 14 steps incl. `check:images` with `AUDIT_STRICT=1` | 0 | - | - | |
| script-conventions, migration-stamps, day-rollover, guest-list and live-db-gate self-tests | 0 | - | - | |
| typecheck job (`check:rpc-typing`, `check:wallclock-brand`) | 0 | - | - | |
| workflow-lint job (BOM, masking, notification, no-preview-prefixes, docs-only self-test) | 0 | - | - | |
| perf canaries (bundle, first-load, chunk-cycles self-tests) | 0 | - | - | |
| og / seo / phone-qa-section self-tests | 0 | - | - | |
| **`check:dancer-area-isolation`** (its self-test passes) | **1** | 70 violations | 0 | **new; B2** |
| `npm run build` (production, perf-budget env) | 0 | - | 0 | |
| **`check:bundle-budget`** | **1** | 59 chunks, allowance 56 | 0 (55 of 55) | **new; B1** |
| `check:first-load-requests`, `check:chunk-cycles` | 0 | - | 0 | |
| `test:unit` (Europe/London) | 1 | 11010 passed / 15 failed / 19 skipped (486 files) | 1: 10858 / 15 / 19 (481 files) | the same 15 fail on main too (sandbox only, see below) |
| `test:unit:timing` | 0 | 65 / 0 | - | |
| tz legs, America/New_York and Australia/Sydney | 0 | 213 / 0 each | - | |
| `npm run lint` | 0 | 20 links pass; eslint 519 problems (informational) | 0; 517 | exits 126 until `chmod +x bin/*.sh`, which CI also does |
| `test:e2e` (smoke gate, includes the 6 gated dancer-app specs) | 0 | 156 passed, 2 flaky, 3 skipped | not run | |
| dancer-app `ember-walk` + `review-pack` | 0 | 34 passed, 50 skipped | - | review-pack runs only with `REVIEW_PACK_DIR` |
| phone suite (`playwright.phone.config.ts`) | 0 | 272 passed, 74 skipped | - | |
| fake-Supabase build + `playwright.build.config.ts` | 0 | 66 passed | - | includes dancer-app-routing and account-edges |

- **The 15 unit failures** fail identically on main and are sandbox-only:
  - The contract tests (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup`) fail with `Invalid API key` because the sandbox has no valid Supabase key.
  - `integrityCouldNotRun` (5) fails because of the sandbox's `NODE_PATH`; with `NODE_PATH=` it passes (67/14 skipped).
- **e2e flakes** (both passed on retry):
  - `dancer-home.spec.ts:168` (`toHaveURL`, first attempt)
  - `organiser-onboarding.spec.ts:143` (`toBeVisible`, first attempt)
- **GitHub checks on PR #925 head 1fe6d51:**
  - **failure:** `bundle-budget`, `dancer-area-isolation`
  - **success:** contract-check, e2e-smoke, phone-qa, phone-qa-section, integrity, unit (London full, New York, Sydney), build-smoke, wallclock-brand, live-db-gate, masking-check, real-data-verified, bom-check, notification-check, no-preview-reason x4, decide, open-pr
  - **skipped (no preview):** lighthouse, doc-weight, og/seo/synthetic and their previews, enable
- **Not run (secrets, a deploy or PR context needed):** the db-contract-check live scripts, `types-drift`, lighthouse, doc-weight, og/seo/synthetic preview guards, `check-pr-phone-qa.mjs` and `check-pr-real-data-verified.mjs` (only their self-tests ran).

## Verified
- Both CI gate failures, reproduced locally and confirmed on GitHub.
- The B3 contrast measured in a browser (2.96:1) and its CSS cause read in source.
- The S1 unguarded Change photo link (source, `EditScreen.tsx:215`).
- The S3 plain `<a>` with no `emitProfileView` (source).
- All 16 states compared with prototype v3 at 390x844 and 360x640.
- 44px targets, horizontal scroll and the no-photo disc.
- The PR body's #897 merge order.

## Not verified
- **Real data and a real phone.** The browser walk used mocked data. The lineup RPC `my_nights_lineup_people_v1` is not on prod until admin #910, so the D126 section was not run against prod-shaped data.
- **Onboarding step 1 (name):** the fixture went straight to the photo step, so only that step was compared.
- **No Ember prototype exists** for the dancer Edit discard sheet or the switcher sheet contents; they were compared against the nearest prototype patterns.
- **Contrast on the gradients** (hero, tiles) was checked by eye, not by pixel sampling.
- **Focus inside sheets** (trap, Escape) and photo crop/preview were not walked.
- **The e2e smoke on main**, so the two flakes are not compared against main.
- **Live-DB contract scripts** (no valid key in this sandbox). GitHub's `contract-check` and `live-db-gate` are green.

## Parked questions

- **Q1.** The brief names `briefs/people-arc/COMMON.md` and `WEB-COMMON.md` as the UI checklist, but neither exists on `brief/people-d89` (1af769dd).
  - **Default used:** the rules restated in the brief's check 2, plus this repo's CLAUDE.md "Definition of done".
  - **Options:** (a) as done; (b) re-review once the files are published.
  - **Cost if wrong:** small.
  - **Where:** `REVIEW-RESTYLE-B.md` "Read first".
- **Q2.** The isolation check counts `docs/people-arc/**` and the ER-UI merge as violations (B2).
  - **Default used:** this is an orchestrator allowlist decision, so the fix pass does NOT edit `scripts/dancer-area-isolation-allowlist.json`. The ER-UI part clears when #902 merges and main is merged in.
  - **Options:** (a) orchestrator adds `docs/people-arc/**` to the allowlist; (b) move the shots and handover to a path the check allows; (c) accept a red check until #902 merges.
  - **Cost if wrong:** small.
  - **Where:** `scripts/check-dancer-area-isolation.mjs:20-23`.
- **Q3.** Should browser and swipe back be guarded on Edit (S1)?
  - **Default used:** yes for `beforeunload` (cheap); the history blocker is optional and may be recorded as a known gap.
  - **Options:** a full blocker, or `beforeunload` only.
  - **Cost if wrong:** small (lost draft text).
  - **Where:** `screens/edit/EditScreen.tsx:138`.
- **Q4.** The header shows a "Dancer" badge that is in neither the prototype nor the handover.
  - **Default used:** keep it (it exists on main), and ask the owner.
  - **Options:** keep or remove.
  - **Cost if wrong:** small.
  - **Where:** `shell/DancerAppShell.tsx` header.
- **Q5.** B1, cut the chunks or raise the allowance?
  - **Default used:** cut, with a first-party group in `vite.chunks.ts` for the shared organiser `ui/` blocks; raise to the measured number only if grouping moves weight onto other routes.
  - **Options:** group, or raise to 59.
  - **Cost if wrong:** small.
  - **Where:** `perf-budgets.json`, `vite.chunks.ts`.
