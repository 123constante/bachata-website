# Review r1: PR #1183, p3-prefix-b (owner with no dancer row; 0-page You tab and page editor)

Independent, read-only review (Fable; the builder was Opus). Branch `claude/p3-prefix-b-nodancer`
at `3534ac5` (3 commits, 8 files, +217/-27) against `main` at `1dc1660`. Brief:
`docs/briefs/review-1183.md`. One round, no fixes by the reviewer. Line numbers are the PR branch's.

## Verdict: FIX FIRST

The code does what the brief asks and the evidence holds: an account whose dancer read raises
`no_profile` gets one real action (the team's WhatsApp link, the same copy and URL the Welcome tap
gate uses) and no Retry, on all three person surfaces; a real read error keeps Retry; the You tab and
the P3 page editor at 0 pages say what the person can do and link to the surface's `addPage`, which is
the same screen Home already sends a 0-page login to; both links are at least 44px tall in px; the new
tests go red on main's source (7 of 103) and green on the PR (103 of 103); the whole organiser tree
passes; `perf-budgets.json` is untouched. What stops a merge is the PR body, not the diff: all three
"Verified on real data" lines are still the bot's `TO FILL` marker and the "## Phone QA" section the
UI-path guard requires is missing, so `phone-qa-section` is red and the definition of done (CLAUDE.md,
step 5) is not met. Three small cleanups below are optional.

## Findings

### Block

None.

### Should-fix (before merge)

**S1. PR body: "Verified on real data" is three `TO FILL` markers; "## Phone QA" is absent.**
PR #1183 body (GitHub) still reads `Shapes surveyed: TO FILL`, `Checks run: TO FILL`,
`NOT verified: TO FILL`. `scripts/check-pr-real-data-verified.mjs:34` treats the marker as
"pending" (reported, not failed), which is why `real-data-verified` shows green; it is not a pass.
`phone-qa-section` (job 123885797895) fails with `Section "## Phone QA" is missing` because 6 UI
paths changed. The commit message of `8f0cd1f` carries the real-data facts (prod 2026-10-30: 3 of 43
accounts have no dancer row, 2 of them admins; `my_dancer_edit_v1` and `save_my_dancer_profile_v2`
both raise `no_profile`); they belong in the body. Fix: fill the three lines in place and add
`## Phone QA` with `Sizes checked`, `Walked`, `Not verified` (format printed in the job log).

### Low (optional, same PR or a follow-up)

**L1. Stale comments and two dead constants left behind by the You-tab change.**
`src/modules/organiser/p3/you/youRows.ts:19` ("Add a page (R1 Home's add sheet; P3 has none of its
own)"), `:42` ("the no-page card above has Message us") and `:47-48` (`YOU.noPage`, `YOU.messageUs`,
now unused anywhere in `src/`, and the `NO_PAGE` import at `:3` that only feeds them);
`src/modules/organiser/shared/teamRules.ts:29` still says NO_PAGE is "for You, Team and the page
editor" when it is now Team and Hand over only. Fix: delete the two constants and the import, reword
the three comments.

**L2. The "Add a page" link lands on a screen titled "Welcome" with no Back link.**
`src/modules/organiser/p3/you/AddPageScreen.tsx:24-26`: at 0 pages `firstRun` is true, so the title is
"Welcome" and `back` is undefined. From You's card (`YouScreen.tsx:112`) and the page editor
(`page/index.tsx:58`) the link says "Add a page", the destination says "Welcome". Not a dead end: the
tab bar stays (P3Shell), and this is W4b's deliberate screen (HomeScreen.tsx:56 sends a 0-page login to
the same URL). Fix if wanted: one line, `back = organisers.length === 0 && cameFromYou ? YOU : ...`,
or accept and note it in the brief's copy table.

**L3. Team at 0 pages still carries the invite-only line.**
`src/modules/organiser/team/index.tsx:69` keeps `NO_PAGE.body` (`INVITE_REQUIRED_COPY`) with Message
us. The brief says Team is out of scope and the You hub never links there at 0 pages (`youRows.ts:67`
renders the Team row disabled with "A team belongs to a page, and you don't run one yet"), so only a
typed URL reaches it. Recorded so the next brief can decide; no change asked here.

### Checked, no finding

- **Error-class split.** `personModel.ts:190` `isNoDancer` matches `no_profile` as a whole token
  (word-boundary regex, case-sensitive, same casing as the RAISE in both RPCs); `fetchWizardDancer`
  (`wizard/dancerApi.ts:57`) rethrows `error.message` verbatim, so the string reaches the regex intact.
  `personReadFail` puts `no_dancer` ahead of `area_closed`/generic; with no dancer row nothing else on
  the person path can proceed, so the order is right.
- **Back from the no-dancer screen in the full flow** (`OnboardingFlow.tsx:219`: page `logo` with a
  page, else `welcome`) is the same target the ordinary person exit uses (`:243-246`), so the screen
  is not a special case for the Back button.
- **Welcome with no dancer row** renders (greets without a first name); no error, no no-dancer screen
  (test `Welcome / noRow`). Review renders from the server's `missing[]` and its person row opens the
  no-dancer screen (test `review / noRow`).
- **Stub row** (the auth.users trigger's empty row) is a normal step, not a no-dancer screen (test).
- **One h1 on the no-dancer screen** (asserted); `ObShell` focuses `.p3-ob-t` on screen change, and
  `NoDancerBody` has it with `tabIndex={-1}`.
- **The anchor in the foot** (`PersonFlow.tsx:124`): `a.p3-ob-btn { text-decoration: none }` lives in
  `page.css`, which `PersonFlow` does not import, but Tailwind preflight (`src/index.css:1`) already
  sets `a { text-decoration: inherit }`, so no underline appears on `/you/details` either.
- **HTML entities.** New strings use `’` escapes in TS, matching the file's existing style; no raw
  Unicode punctuation added.
- **eslint** on the eight changed files: 1 error, `OnboardingFlow.tsx:111` `react-hooks/set-state-in-effect`,
  in an untouched hunk and identical on main. Informational per CLAUDE.md. **tsc** (`tsconfig.app.json`):
  4 errors, all in `src/pages/Venue*.tsx`, `VendorPortal.tsx`, `services/venuePublicService.ts`;
  none in a changed file; present on main.

## Brief check 1: owner shape x pages x load x screen

The You tab (`YouScreen.tsx`) and the page editor (`page/index.tsx`) never read the dancer row (You
reads the team context, join requests and `my_profile_progress_v1`; the editor reads home and the
page entity), so the dancer axis is inert for them; it only bites on the person screens, listed after.

| Pages | Load | You tab | Page editor |
|---|---|---|---|
| 0 | ok | Card "You don't run a page yet" + "Find your page to claim it, or ask to join its team." + link **Add a page** -> `/account/p3/you/add` (`YouScreen.tsx:110-113`). Team row disabled with reason (`youRows.ts:67`). No Switch, no Organiser page, no Add another page rows. | EmptyState, same title/body, link **Add a page** -> surface `addPage` (`page/index.tsx:58`). |
| 1 | ok | PageCard; rows Organiser page, Team, Add another page. | Facts rows for the page. |
| several | ok | PageCard; rows Switch page (n pages), Organiser page, Team. | Facts rows for the selected page. |
| any | home read error | "Your pages did not load" + Try again -> refetches home and team (`YouScreen.tsx:88-94`); can succeed. | ErrorState "Your page did not load" + Retry -> refetches entity or home (`page/index.tsx:53-54`); can succeed. |

Person screens, by owner shape (test `noDancer.matrix.test.tsx`, 16 cases):

| Shape | `/you/details` | Onboarding person step | Review -> person row | Welcome |
|---|---|---|---|---|
| has row | step `name` | step `photo` | step `photo` | renders |
| stub row (all fields empty) | step `name` | step `photo` | step `photo` | renders |
| no row (`no_profile`) | no-dancer screen: title "Your details", `NO_PROFILE_TEXT`, one action "Message us on WhatsApp" (`NO_PROFILE_CONTACT_URL`), **no Retry**, Back -> You | same screen, Back -> page `logo` | same screen | renders (no first name) |
| read error ("Failed to fetch") | read-fail copy + Try again; Retry calls the dancer read again (asserted) | same | same | renders |

Every state names an action; the only disabled control (Team row at 0 pages) carries its reason; no
copy points at a control that is not on screen (the old "Message us" in the editor and You is gone,
and `INVITE_REQUIRED_COPY` is asserted absent in both 0-page boxes).

## Brief check 2: the Add a page link and the flags

- The link target is `P3_SURFACE.addPage` = `P3_PATHS.youAdd` = `/account/p3/you/add`
  (`p3/you/surface.tsx:61`, `p3/shell/paths.ts:29`), routed to `AddPageScreen` (`P3Routes.tsx:72`),
  which renders `OnboardingView look="p3"` (search, claim, ask to join, create). It is the same URL
  Home redirects a 0-page login to (`HomeScreen.tsx:56`) and Switch's Add a page uses
  (`switch/index.tsx:85`). The page editor now reads it from `useOrgSurface()` like every other
  surface link (commit `3534ac5`), so R1 (`/account/o/page`) keeps `Add a page from Home`.
- **organiserP3 and organiserSelfServe on:** the P3 area is mounted (`AnimatedRoutes.tsx:266-268`)
  and the link works as above.
- **organiserSelfServe off:** the whole `/account/p3/*` route is absent (same guard), so neither the
  You tab nor the P3 page editor can render, and the link cannot appear; a typed `/account/p3/you/add`
  falls to the app's catch-all. The R1 editor (`/account/o/*`) is also off without self-serve. Nothing
  points at a screen that does not exist.
- **Invite-only wording:** none left on You or the page editor for a 0-page person (asserted). It
  remains on Team by URL only (L3).

## Brief check 3: tap target at 390x844

- You card link: class `p3-btn p3-btn-link`. `.p3-theme .p3-btn { min-height: var(--tap) }` with
  `--tap: 44px` (`p3/theme/p3.css:25`, `:119-122`); `.p3-btn-link { width: 100% }` (`:252`, the later
  of two rules). 44px x card width, both px. Not re-measured in a browser (see "Not checked").
- Page editor link: `inline-flex min-h-[44px] items-center` (`page/index.tsx:58`); the Tailwind
  arbitrary value is literal px, not rem, so the 13.5px phone `html` font-size does not shrink it.
  Width is the text width of "Add a page" at 14px+ semibold, well over 44px.
- No-dancer foot anchor: `.p3-ob-btn { min-height: 52px }` (`onboarding.css:63`), 48px under the
  compact container query (`:181`) and 46px under 700px height (`page.css:41`), full width via
  `.p3-ob-foot { align-items: stretch }` (`onboarding.css:54`). All px.

## Brief check 4: do the new tests fail on the unfixed code?

Yes. A second worktree at the PR head with the six changed `src` files reset to `origin/main`
(`OnboardingFlow.tsx`, `PersonFlow.tsx`, `personModel.ts`, `YouScreen.tsx`, `page/index.tsx`,
`teamRules.ts`) and the PR's tests kept:

| Tree | noDancer.matrix | you.matrix | Total |
|---|---|---|---|
| main source + PR tests | 3 fail (`details`, `onboardingDetails`, `review` x `noRow`) | 4 fail (no-page card, editor 0-page copy, 0 pages/You, 0 pages/page editor) | 7 fail, 96 pass |
| PR | all pass | all pass | 103 pass |

The seven failures are exactly the behaviours the PR adds; the `hasRow`, `stubRow` and `readError`
rows and the Team no-page test pass on both, so they pin behaviour the PR must not change.

## Brief check 5: related and whole-tree tests; perf budgets

- `npx vitest run src/modules/organiser` on the PR head: 204 of 205 files pass, 8037 tests pass,
  2 skipped. The one failing file is `p3/door/__tests__/door.screen.test.tsx`, which fails to
  collect with `Failed to resolve import "jsqr"`; identical on main in this container (the package is
  not installed here). Environment, not the PR.
- `perf-budgets.json`: zero-byte diff against main.
- PR checks at `3534ac5`: unit (3 time zones), integrity, bundle-budget, contract-check, live-db-gate,
  build-smoke, wallclock-brand, dancer-area-isolation, bom/masking/notification checks all green;
  `e2e-smoke` was still running when read. Red: `phone-qa-section` (S1) and `phone-qa`
  (`TypeError: Cannot read properties of undefined (reading 'VITE_ENABLE_TEACHERS_DIRECTORY')` at
  `src/lib/featureFlags.ts:12` inside the Playwright run). The latter fails the same way on the last
  ten Phone QA runs across five unrelated branches (#1164, #1180, #1181, #1182, #1183), so it is a
  fleet-wide harness fault, not this diff; it is still red on the PR and someone owns it.

## Not checked

- **No browser walk at 390x844.** Tap sizes above are read from CSS, not measured in a rendered page;
  the flags were not switched on and no dev server was run.
- **No prod shape survey by me.** The "3 of 43 accounts, 2 admins" figure comes from the builder's
  commit message; I did not run a read-only SELECT to confirm it, and the PR body does not yet carry it
  (S1).
- **Live RPC messages not re-read.** That `my_dancer_edit_v1` and `save_my_dancer_profile_v2` raise
  the literal `no_profile` rests on the builder's note and on `lib/accountSettings.ts:77`, which already
  matches that code from another RPC.
- `e2e-smoke` result on the PR head (in progress when read).
- The 13.5px phone `html` font-size trap was checked only for the three new controls, not for the
  surrounding cards.
