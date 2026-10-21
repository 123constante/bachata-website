VERDICT: FIX PASS NEEDED

# Independent review: Release B restyle, slice A

- Ticket: dt_d39c12970881. Brief: admin `brief/people-d89:briefs/people-arc/REVIEW-RESTYLE-A.md` (sha 8c063c3f).
- Reviewed: `claude/people-release-b-web` at **94b5c428b807416d6012ae986c031f670b5c9b88**. The restyle diff is
  `97ceede..94b5c42` (the merge of ER-UI f223403, then the restyle commit). The whole PR was checked against `origin/main` fb91b8a4.
- Target: the prototype `claude/proto-release-b` at 802005aa (v2), checked with its jump list.
- Method: code read of every file in the restyle diff, a headless walk at 390x844 and 360x640 of the real app (mocked data, the
  `restyle-a-walk` mocks) and of the prototype, and every CI job step a sandbox can run, on the head and on main.
- Screenshots (real app next to the prototype) are in `docs/people-arc/reviews/restyle-a/`.
- The reviewer changed no code.

## Findings, most severe first

### Blocking

**B1. phone-qa / build-smoke is red on the head (2 tests, deterministic; green on main 66/66).**
`tests/e2e-build/account-delete.build.spec.ts:100` ("settings: sign out of all devices is a global sign-out") and `:121`
("sign-out lands on the site home, not /auth: settings: Sign out of all devices") both fail with
`Expected "logout:global", Received []`, timing out after 15 s. GitHub's build-smoke check fails on the same 2 tests.
- Cause: D119 #4 changed `settings-signout-all` (`src/pages/AccountSettings.tsx:164`) so that it opens the confirm sheet. The two
  specs still tap only `settings-signout-all` and never tap `settings-signout-all-confirm`.
- Fix: in both specs, after tapping `settings-signout-all`, tap `getByTestId('settings-signout-all-confirm')`. Search
  `tests/e2e-build/` and `tests/e2e/` for any other `settings-signout-all` or `settings-disable-toggle` tap that now needs the
  confirm step: the Hide sheet changed the same way. Re-run `playwright.build.config.ts` after the fake-env build.

**B2. The branch is behind ER-UI (D117).** `origin/claude/er-ui-ember` moved to **4b2a357** (ER-FIX C2) after the author merged
f223403. 4b2a357 is not in 94b5c42.
- C2 adds `--gold-fg` ("--gold is for fills and borders, --gold-fg is the accent as small text") and `--warn-fg #ff9a6a`. It also
  adds the `.ember-world .org-theme` nesting selector, `--r-date`, and the `emberContrast.test.ts` WCAG table.
- D117: "If ER-UI changes before it merges, the restyle branch re-merges it."
- Fix:
  1. `git merge origin/claude/er-ui-ember` (plain merge). If it conflicts in rebuild files, stop and list them.
  2. Switch every small-text use of `text-[var(--gold)]` in slice A to `text-[var(--gold-fg)]`. These are the back link
     (`src/modules/areas/shared/AreaFrame.tsx:29`), the Try again, Sign out, settings and organiser links in
     `src/components/account/DancerHome.tsx` (lines with `text-[var(--gold)] underline`), and `settings-back-to-options`
     (`src/pages/AccountSettings.tsx:534`).
  3. Keep `--gold` for the home icon, fills and borders.
- Measured today: `#f0703a` on `--card #2a2d32` is 4.66:1, which passes but has no margin. `--gold-fg #f5865a` is 5.55:1.

**B3. The "Saved" toast cannot be read over page content.** `src/modules/areas/shared/SavedToast.tsx:139` draws a translucent pill
(`bg-[var(--ok-bg)]`, rgba(62,207,142,0.14)) with green text, fixed at the bottom. After Save at the end of the form, the page is
scrolled to the site's orange footer. The text then sits on rgb(255,166,0) at about **1.35:1**. See
`reviews/restyle-a/saved-toast-390.png` and `proto-saved-toast.png`: the prototype uses a solid green toast with dark text.
- Fix: make the pill solid, for example `bg-[var(--ok-fg)] text-[var(--btnfg)] border-transparent`. `#1d0a03` on `#7be6b4` is well
  above 4.5:1. Drop `backdrop-blur`.
- Add a unit assertion that the toast's background token is not translucent, or measure it in `restyle-a-walk`.

**B4. A blocker IS available: browser Back, header links and the other switcher entries leave a dirty form without the sheet.**
- The handover and `src/modules/areas/shared/leaveGuard.ts:1` say "BrowserRouter has no blocker". That is true only of the legacy
  `src/App.tsx` path. Production runs the framework data router (`app/root.tsx`, `react-router build`; the account and area
  routes are served by the catchall inside it).
- The rebuild already uses a router blocker on it: `useLeaveBlocker` in
  `src/modules/organiser/edit-in-place/EditInPlaceLayer.tsx:471`, built on `getBlocker`/`deleteBlocker` so that `useBlocker`'s
  code stays out of the shared chunk (perf budget).
- The brief (D119 #2) requires "browser back where the router allows a blocker", and the router does allow one.
- Today these leave dirty with no sheet:
  - browser Back and Forward
  - the site header, bottom nav and footer links (they render around `AreaFrame`)
  - the dancer and organiser switcher entries and the other ProfileSwitcher rows
- Fix:
  1. In `AreaFrame` (or `useLeaveGuard`), when a data router is present (`UNSAFE_DataRouterContext`), register a blocker the same
     way `useLeaveBlocker` does, with `shouldBlock = dirty && current.pathname !== next.pathname`.
  2. Drive the existing `DiscardSheet` from `blocker.state === 'blocked'`: Keep editing calls `reset()`, Discard calls
     `proceed()`.
  3. Keep the module store only as the fallback for `MemoryRouter` tests and the legacy BrowserRouter. Do NOT import `useBlocker`
     (the bundle budget).
  4. Test it: a table over leave paths (back link, home link, switcher teacher, switcher dancer, header link, history back) x
     (dirty, clean), red first against today's code for header link and history back.
  5. Also set `e.returnValue = ''` in the `beforeunload` handler (`leaveGuard.ts:33-35`) for Safari and older Chromium, as
     `src/hooks/useUnsavedChangesGuard.ts` does.

### Should

**S1. Rem sizes on the account screens (CLAUDE.md "about 13.5px root" trap; brief: "Px sizes, not rem").** Measured at 390:
- titles are 15.27px (`text-lg`)
- card padding is 10.18px (`p-3`)
- the surname hint is 10.18px (`text-xs`)

Files:
- `src/pages/Account.tsx` h1 `text-lg`
- `src/components/account/profiles/ContinueAsPage.tsx` h1 `text-lg`, `text-sm`, `text-base`, `p-3`. The squeezed title reads
  "Continueas…": tracking -0.61px at 15px.
- `src/pages/AccountSettings.tsx` `CARD` `p-3` and h1 `text-lg`
- `src/components/account/DancerHome.tsx` `CARD` `p-3`, `space-y-*`, `gap-*`
- `src/components/account/HideSurnameCard.tsx` `text-xs` (2 lines)

Fix: px classes such as `p-[16px]`, `text-[13px]` and `text-[15px]`. Use one title size across slice A: the same as AreaFrame's
h1, see S2.

**S2. The type scale is far from the prototype.** The prototype's page title is 28px/800 on every screen. Slice A uses 17px/700
(`AreaFrame.tsx:36`) and 15.27px on the account screens. The prototype's meter has a large number (about 40px) over
"of M details added"; the real one is 15px/600 (`RoleAreaPage.tsx` `CompletenessMeter`).
- Fix: use a 22-28px/800 title in `AreaFrame` and the account screens (one shared class, px), and give the meter the prototype's
  big-number line. Keep the D118 words exactly.
- If the 17px header bar is intended, write it in the handover's "Not built / known differences" for the owner to judge. Today it
  is not listed.

**S3. One primary per screen is broken on Account settings and can be on Account home.**
- `src/pages/AccountSettings.tsx`: the `PILL` (filled orange) is used for "Change email", even while disabled (it reads as a dim
  primary), for "Show again", and for the delete-flow pills. The prototype has outlined buttons there.
- `DancerHome.tsx`: the hidden banner "Show again" `PILL` and the "Finish your profile" `PILL` can both show.
- Fix:
  - On settings, make "Change email" `OUTLINE`.
  - On Account home, keep one filled action: when hidden, make Finish the outlined one, or the reverse; pick one rule and test it.
  - Disabled buttons should look disabled (`--card2` ground, `--mut` text) rather than `opacity-50` on orange. That is a
    rebuild-block concern for `PrimaryButton`, so list it as "asked of the rebuild".

**S4. The Account home "Your areas" row claims "Open or add a role" while loading or after an error.**
`accountAreasWords(undefined, undefined)` (`src/modules/areas/home/areaStatus.ts:98`; `home/AccountAreasRow.tsx:128`) returns
`OPEN_OR_ADD_WORDS` when `my_roles_v1` or progress has not loaded or failed. So a person with an unfinished Teacher area sees "Open
or add a role" first, or for good on an error, while Your areas says "Teacher: 3 left". Two screens then disagree (WEB-COMMON:
one fact, one wording).
- Fix: while `roles` is pending, show no sublabel (or a skeleton line). On error, show a neutral "Open Your areas" and never the
  "none unfinished" words.
- Add the shapes "roles pending" and "roles error" to `areas.statusMeter.test.tsx`.

**S5. The Hide sheet's error shows twice.** `src/pages/AccountSettings.tsx:339` (inside the sheet, `settings-disable-sheet-error`)
and `:343` (below the section, `settings-disable-error`) both render `{error}` with `role="alert"`. A screen reader reads it twice.
- Fix: render the lower one only when `!confirming`.

**S6. The sign-up roles step has no visible accent focus ring.** The role buttons (`src/pages/Auth.tsx:688-694`) get only the browser
default `outline:auto`; every other slice-A control gets the 2px Ember ring.
- Fix: add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]`, or
  the class the rebuild's blocks use.

**S7. The meter flips "No details added yet" to "0 of M details added" on load** (`RoleAreaPage.tsx`, `complete={held?.complete === true}`
while `roles` is pending). A Complete area first shows the words D118 forbids for it.
- Fix: while `roles.status === 'pending'`, render the meter's skeleton (or wait for both queries before the meter).
- Add a "roles pending" shape to the D118 test.

**S8. The PR body fails 2 PR-body checks** (code is not the cause):
- `real-data-verified`: the `## Verified on real data` heading is missing, along with the Shapes surveyed / Checks run / NOT verified
  lines. Fix: add the section per the template, written from the fix pass's own survey.
- `phone-qa-section`: the `## Phone QA` placeholder has no Sizes checked / Walked / Not verified lines. The brief gives this one to
  the orchestrator. The fix worker leaves it alone unless told otherwise.

### Nit

- **N1.** The D118 test (`src/modules/areas/__tests__/areas.statusMeter.test.tsx`) has no "held, not complete, all filled" shape.
  In that shape the meter says "All M details added" while the row may say "N left". Add the shape and pin what each surface says.
  It waits with fixed `setTimeout(r, 30)` sleeps; use `waitFor` on the final words instead.
- **N2.** Deep imports from the rebuild: `@/modules/organiser/ui/Card`, `ui/SummaryRow`, `ui/EmberWorld` and `ui/Buttons`
  (`AccountAreasRow.tsx`, `AccountShell.tsx`, `Auth.tsx`). D108 says import from `@/modules/organiser/ui`. If the barrel costs
  first-load bytes on `/auth`, keep the deep path and say why in a one-line comment.
- **N3.** The Discard sheet's "Discard" is a grey filled `GhostButton`; the prototype shows red quiet text. The sheet also adds a
  body line the prototype lacks. Both are acceptable. Matching would need a danger variant, so list it as "asked of the rebuild".
- **N4.** Account home and Settings now show three ways home: the header logo, the breadcrumb "Home" (48x17, under 44px; shared
  chrome) and the new `SiteHomeLink`. That is acceptable under D107/D120. Note it for the owner's phone look.
- **N5.** The area screens (Your areas, Teacher/DJ) also keep the site header and the orange footer, not only the account screens
  as the handover says. Add this to the handover's known differences.

## Prototype differences: intended (in the handover) and my judgement

| Difference | Judgement |
|---|---|
| Site header (GlobalLayout) stays above the Ember content | Acceptable (D107; the header is shared). It applies to the area screens too (N5). |
| `HideSurnameSwitch` keeps the site look | Acceptable as a non-owned file. Its 11.88px/10.18px text (S1) is inside `HideSurnameCard` (owned), which can pass px sizes. |
| No circular back button; a text back link instead | Acceptable. 44px, focus visible. |
| "Open" as a text link, not a filled pill per row | Acceptable (one primary rule). |
| Meter does not use "answers left = blank fields" (D118) | Required by D118; correct. |
| Browser Back cannot be blocked | **Not acceptable: the premise is wrong.** See B4. |
| Other switcher entries do not ask | **Not acceptable.** The router blocker covers them (B4). |

Unintended differences not covered above (none blocking):
- Sheets use the rebuild's `SheetView`: a centred small title with an X, against the prototype's 24px/800 left title.
- The ask sheet's "Skip for now" is a filled grey button, not a text link.
- Teacher details: the chips sit below the input and are outlined (the prototype puts them above, filled), and Save is in-flow,
  not pinned.
- Sign-up roles: a selected role is an orange outline, not a filled row. It also sits inside the site auth card, so the site amber
  (the stepper) sits next to the Ember orange.
- Account home: no section labels. Attendance and Parties are side-by-side tiles, not list rows.
- Settings: section titles sit inside the cards. Delete comes before Sign out, which is today's order and was not changed by the
  restyle.

The block-level items (SheetView title, GhostButton fill, Chip placement) belong to the rebuild's blocks. Raise them as "asked of
the rebuild"; do not restyle them locally.

## Rule checks (brief section 2 to 5)

- **Status words, one mapping:** Your areas row, switcher entry and Account row all read `areaStatus`/`accountAreasWords`. The
  meter never says "left" (`roleModel.ts:167-172`). Matching words were verified by the 18-shape test (green). The gaps are S4, S7
  and N1.
- **Text pointing at a missing control:** none found on the walked screens.
- **Empty states with one action:** Teacher/DJ "No line-ups yet" explains when line-ups appear, but has no action. That is
  acceptable because it is information, not an empty list the person can fill. Your areas always has rows. No other empty state
  changed.
- **Disabled reasons (D109):** "Nothing changed yet" (`RoleProfilePage.tsx:14`) and "Choose at least one" (Auth) are shown under
  the control. Red first is recorded in the handover.
- **Untouched Save sends nothing:** `areas.screens.test.tsx:112` asserts no RPC call. The sheet appears only when dirty
  (`areas.restyle.test.tsx:95`).
- **`leaveGuard.ts` store, checked for leaks:**
  - `dirty` is reset by the effect cleanup on unmount and on `isDirty` going false.
  - A Save remounts the form (`formKey`), which resets it.
  - `ask` is cleared only by its own owner.
  - The `beforeunload` listener is removed on clean or unmount.
  - No leak was found between routes or tests.
  - Real gaps: the missing paths (B4) and the `returnValue` nit.
- **D120:** `SiteHomeLink` is on Your areas, Teacher/DJ area and details, Account (`/account`, `/account/dancer`, loading),
  Continue as (including loading), and Settings and delete. It goes to `/`, which redirects on the server to the city home.
  Verified by `areas.restyle.test.tsx:53` and the account tests, and seen in every real screenshot. It goes through Discard when
  dirty. It is exported from `@/modules/areas`.
- **D106/D107:** Ember (`EmberWorld`) wraps only the roles step in `Auth.tsx`; the email steps are unchanged. No ProfileSwitcher
  or header file is in the restyle diff. Imports from the rebuild are `@/modules/organiser/ui` (plus deep sub-paths, N2) and
  `theme.css`. The `shared/profileProgress` import predates the restyle. Nothing under `src/modules/organiser/**` changed in the
  restyle commit, and nothing under `src/modules/dancer-app/**` changed.
- **Hard-coded colour:** no hex, `rgb(` or Tailwind palette class was added in `97ceede..94b5c42`. The amber classes at
  `src/pages/Auth.tsx:589,591` predate the restyle.

## Phone measurements (real app, 390x844 and 360x640, 14 screens)

- **Sideways scroll:** none (`scrollWidth == innerWidth` everywhere).
- **Primary button not covered:** `elementFromPoint` at the primary's centre returns it on every screen at both sizes.
- **Console errors:** none from the app.
- **Tap targets under 44px:** none in slice A content. Only shared site chrome is under 44px: footer links, the breadcrumb Home,
  the skip link.
- **Contrast:**
  - Every text pair passes 4.5:1 against its DOM background, except the toast over the footer (B3).
  - Disabled orange buttons are about 3.1:1. Disabled controls are exempt, but see S3.
  - The prototype's own "1 answer left" orange-on-`--card2` is 4.04:1, so do not copy it.
- **Focus:** a 2px Ember ring on the restyled controls, and focus stays inside the sheets. The roles step uses the browser default
  ring (S6).

## CI steps run locally: head 94b5c428 against main fb91b8a4

Sandbox: Node 22, no secrets, offline Supabase stub as CI uses when live=false, CI=1 for Playwright.

| Workflow / job | Command | Head | Main | Notes |
|---|---|---|---|---|
| architecture-guard / integrity (11 steps: integrity, legacy tables and RPCs, lint:architecture, images AUDIT_STRICT=1, image widths, plan hygiene, artifact policy, mojibake canary and guard, entry-point proof) | as in the workflow | 0 | 0 | integrity 2147 files, 0 issues |
| typecheck / wallclock-brand | `check:rpc-typing`, `check:wallclock-brand` | 0 | 0 | |
| (not a CI gate) | `npm run typecheck` | 2 | 2 | the same 99 TS errors on both |
| workflow-lint (BOM, docs-only self-test, masking, notification, no-preview prefixes) | as in the workflow | 0 | 0 | |
| unit-tests / dancer-area-isolation | self-test + check | 0 | 0 | |
| unit-tests / unit | `npm run test:unit:offline` | 1 | 1 | head 10942 pass / 5 fail / 18 skip. The 5 are `tests/integrityCouldNotRun.test.ts`, a sandbox/worktree artifact that also fails on main (main: 9 fail). |
| unit-tests / unit | `npm run test:unit` | 1 | 1 | head 10976 pass / 17 fail / 19 skip. The 17 are the same 5 plus 12 live `*.contract.test.ts` that need prod secrets. All 17 also fail on main. |
| unit-tests / timing, tz New_York, tz Sydney | as in the workflow | 0 | 0 | 65, 213 and 213 pass |
| db-contract-check (no-secret steps: live-gate self-test, migration stamps, guest-list canary, day-rollover, script conventions) | as in the workflow | 0 | 0 | |
| perf-budget / bundle-budget | 3 canaries, `npm run build` (PRODUCTION), `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0 | 0 | budgets respected, 6 routes on pins, 317 chunks with no cycle |
| (lint chain) | `npm run lint` | 0 | 0 | 20/20 links. eslint warnings are informational. |
| phone-qa / phone-qa | `playwright test --config playwright.phone.config.ts` | 1 under load, 0 re-run | 0 | `scroll-reset.phone.spec.ts:114` failed under CPU contention; 14/14 alone. It is also flaky on main. |
| **phone-qa / build-smoke** | fake-env build + `playwright.build.config.ts` | **1** | 0 | **B1**: `account-delete.build.spec.ts:100` and `:121`, deterministic. `account-edges:28` passed alone. |
| phone-qa-section | `check-pr-phone-qa.mjs` with the #897 body | 1 | n/a | S8, the placeholder (the orchestrator fills it) |
| real-data-verified | `check-pr-real-data-verified.mjs` | 1 | n/a | S8, the heading is missing |
| e2e-smoke | `npm run test:e2e` | 1 | 1 | 158 pass / 2 fail / 1 skip on BOTH (`organiser-home:55`, `organiser-layout:171`, sandbox). GitHub e2e-smoke on head is green. |
| (requested) | `playwright test tests/e2e/restyle-a-walk.spec.ts` | 0 | - | 20 pass |

GitHub check runs on 94b5c428, read through the MCP read tools: build-smoke, phone-qa-section and real-data-verified fail.
Everything else is green or skipped (phone-qa was still running when read).

**Not run here:** the secret-bearing db-contract checks (green on GitHub), the live contract unit suites, Lighthouse and doc-weight
(they need a preview and the bypass secret), types-drift (it needs `SUPABASE_ACCESS_TOKEN`), and the bot or automerge jobs.

## Verified

- Code read of every source file in `97ceede..94b5c42`.
- The leave-guard store analysis, and that a framework data router plus a working blocker pattern exist (B4).
- ER-UI 4b2a357 is not merged (B2).
- The toast over the footer: seen in the screenshot, contrast computed by hand (B3).
- build-smoke red on the head and green on main (B1).
- The CI table above.
- Both viewports on 14 screens: sideways scroll, covered primary, targets, contrast, focus.
- The words in the Hide, Sign-out-all, Ask and Discard sheets match the prototype exactly.

## Not verified

- No real-data shape survey (Supabase was not queried). The walk used the `restyle-a-walk` mock (Diego); the prototype uses
  Maria and the busy person. So these were not compared on real shapes:
  - line-up lists
  - the type-DELETE delete state (the mock returns "blocked")
  - the busy-person shapes
- No 360x640 screenshots were committed; the 360 measurements were taken.
- The prototype rendered in a fallback font (Google Fonts blocked), so the 28px title comparison is approximate.
- Contrast over gradients or stacked layers, other than the toast case.
- No real phone and no real Safari, so the `beforeunload` behaviour is unchecked.
