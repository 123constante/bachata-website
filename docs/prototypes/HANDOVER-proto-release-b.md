# HANDOVER: PROTO-RELEASE-B (interactive tap-through prototype)

Brief: `bachata-admin` branch `brief/people-d89`, `briefs/people-arc/PROTO-RELEASE-B.md` (sha e6ef299). Ticket dt_e80dffbd4e88.

## State: v3 DONE (FIX-PROTO-RELEASE-B-V3, ticket dt_536d1baf548f, full finish). v2 and v1 notes below still hold, except the week list (removed in v3).

See **v2 changes** at the end: home link on every signed-in screen (D120) and the dancer app colour layer (D121).

## v1 state: DONE (full finish, not partial)

Output: `docs/prototypes/release-b-prototype.html`, one self-contained file, **151,299 bytes** (under 400 KB). Inline SVG
icons only, no external scripts, one Google Fonts link (Outfit). No product code changed; nothing in `src/` touched. No PR.

Top bar: title, **Who am I?** (Maria Lopez = dancer + teacher with 7 teacher answers left; Alex Moreno = busy person,
Dancer Complete / Organiser 2 answers left / Teacher 3 answers left / DJ You said no; New dancer = no profile, lands on
onboarding), Phone/Computer toggle, Start again. Jump `<select>` on phones, side index at >= 1100px. 390x844 phone frame,
1280x800 computer frame scaled to fit. CSS = the approved mockup's `<style>` block (tokens byte-equal) plus a small
prototype layer. `window.PROTO` exposes `checks()`, `jump(i)`, `JUMPS`, `S` for the console.

## Self-check results (headless Chromium, Playwright)

1. **Sweep**: every jump entry (106) visited at 390x844 and at 1280x800 = 212 visits. **0 console errors**,
   `documentElement.scrollWidth <= innerWidth` on every one, no element wider than its frame, `checks()` clean.
2. **Fuzz**: random taps/inputs on enabled controls of the top layer, switching person (~0.4%/step), screen size (1%) and
   jumps (0.2%). Runs: 12,000 actions (seed 7), 10,000 (seed 11), 10,000 (seed 23) = **32,000 actions, 0 failures**.
   Invariants checked after EVERY action:
   - status words for each role identical on the visible screen, Your areas, the switcher sheet and Account home's row
     (all render from the single `statusOf()` mapping), and the Teacher/DJ area meter agrees (`M - N` = answers left,
     Complete iff `N = M`);
   - every `data-save` button is disabled iff its form is not dirty (draft deep-compared to the loaded values);
   - no dead end (top layer always has an enabled action);
   - at most one `.primary` in the top layer, and every disabled primary is followed by a `.reason`.
3. **Fuzz can fail (mutation proof)**:
   - Mutant 1 (Teacher/DJ Save always enabled): sweep 8 failures, fuzz failed at action #42
     (`save teacherDetails disabled=false dirty=false`).
   - Mutant 2 (meter over-counts by one for the busy person): sweep 74 failures, fuzz failed at action #254
     (`meter teacher 5/7 vs 3 answers left`).
   - Code restored; the clean build above is the shipped file (rebuilt from unmutated sources, re-run clean).
4. **Size**: 151,299 bytes.

Not verified: a real phone (owner's tap-through is the test); Outfit font loading (fonts were stubbed in headless runs);
publishing as an Artifact (D116 says publish; this worker has no Artifact hand-off, orchestrator to publish).

## Where the prototype differs from the real code (deliberate, per brief/mockup, or simplified)

Release B (`origin/claude/people-release-b-web`):
- Disabled reasons use D109's short forms: "Nothing changed yet" (code: "Nothing has changed yet, so there is nothing to
  save.") and "Choose at least one" (code: "Choose at least one to continue.").
- The ask sheet uses the mockup's Yes / Skip for now (code's Your areas panel shows Yes / No chips); Skip records
  "You said no" like the code's No. Yes opens the details form (code opens the area page); back goes to the area.
- "Saved" is a visible green toast (code: screen-reader announcement only), per brief.
- "Discard changes?" sheet (Keep editing / Discard) when leaving a form with edits; the code has no leave prompt.
- Line-up heading uses the code's words "Where you're on the line-up" (the brief/mockup say "Your line-ups").
- Teacher/DJ status: answers left = fields not yet filled, Complete when all filled. (Code: a held teacher/DJ is
  "Complete" from the server; "N answers left" only for intent-only.) Chosen so meter and status agree as the brief asks.
- Line-up rows are not tappable (they open the public event page, out of scope).
- Organiser Open/Add goes to a stub "Organiser area (rebuild)" screen.
- Sign-up step shows a one-line prototype note about D106 instead of the email steps.

Account (`origin/main`):
- Hide profile and Sign out of all devices confirm in sheets (mockup/brief); code swaps buttons inline and signs out of
  all devices with no confirm. Delete keeps the code's separate delete view with the typed-DELETE rule; its red
  `.primary.danger` button carries the real reason text (longer than 4 words).
- "Your areas" row on Account home is new (D112): "<Role>: N answers left" for the first unfinished area in Your areas
  order; "Open or add a role" when none is unfinished (no code copy exists yet).
- Surname Save is an outlined button (not a pill) so the screen keeps one primary ("Finish your profile").
- "Finish your profile" goes to the app's Photo screen when only the photo is missing, else Edit (code: /finish-profile).
- Links leaving the prototype (WhatsApp, Browse parties, event pages) show a toast "Opens ...".
- Signed out / Account deleted are stub screens with a way forward.

Dancer app (`origin/main`, D115; built by a sub-worker):
1. Edit has a "Discard changes?" prompt and a header back button (real app: neither; "Back to Me" at the bottom).
2. Full weekday names ("Saturday 24 Oct"); real app writes "Sat 24 Oct".
3. External destinations toast "Opens ..."; Sign out toasts and stays.
4. Photo success toasts "Saved" (real: none). Edit uses the real "Your changes are live."
5. `FORMS.dancerEdit.dirty` = changed AND no field errors (matches the real disabled-on-error Save).
6. City/country pickers are plain selects (8 cities, 10 countries); real ones are searchable.
7. `?focus=` field is not scrolled into view.
8. Organiser links go to the organiser stub.
9. Onboarding "Not now" goes to Account home (real: return page or site home).
10. Share sheet simulated ("Link copied", manual-copy field via a jump).
11. Header avatar always says "Switch profile" (real: "Your account" with one profile).
12. Hero/tiles use `.state`/`.grp` blocks instead of the gradient cards. Features off on main (GOING_CHECKIN_ENABLED)
    stay hidden.

## How it was built (for a continuation)

Sources were split into modules then concatenated by a small build script (not committed; the brief allows one file):
core (state machine, `statusOf`, invariants `checks()`), areas, account, dancer. To change the file, edit it directly:
search for `/* ===== AREAS`, `/* ===== ACCOUNT`, and the dancer module below them. Each module registers
`SCREENS`, `SHEETS`, `ACT`, `INP`, `FORMS`, `JUMPS` (contract in the comment at the top of the core script).
Re-run the self-checks with Playwright: for every `PROTO.JUMPS` index call `PROTO.jump(i)` then `PROTO.checks()`.

## Next steps

- Orchestrator: publish the file as an Artifact (D116) and hand the owner the link.
- Owner: tap through on a phone; decisions to confirm: the Teacher/DJ status rule above, sheets vs inline confirms on
  Account settings, and the "Open or add a role" copy.

## Jump entries

**Sign-up and areas**

- Sign-up: What do you do? (Dancer pre-ticked)
- Sign-up: three ticked
- Sign-up: nothing ticked (Continue disabled)
- Your areas: Maria (teacher, 7 answers left)
- Your areas: busy person
- Your areas: new dancer after sign-up (Teacher + DJ ticked)
- Ask sheet: Do you DJ?
- Ask sheet: Do you teach bachata?
- Your areas: after Skip for now (DJ: You said no)
- Organiser area stub
- Profile menu: Maria
- Profile menu: busy person
- Teacher area: no details, no line-ups (Maria)
- Teacher area: 4 of 7 with line-ups (busy)
- Teacher area: all 7 details added
- DJ area: 3 of 5 (after Yes)
- Teacher details: opened, nothing changed
- Teacher details: changed (Save on)
- Teacher details: list full (20 items)
- Teacher details: duplicate item note
- Teacher details: years out of range (error)
- Teacher details: Discard changes? sheet
- DJ details: opened
- DJ details: bad link (error)

**Computer width**

- Computer: Your areas + teacher details
- Computer: Your areas (nothing open)
- Computer: DJ area

**Account**

- Account home: Maria (Your areas row: Teacher)
- Account home: busy person
- Account home: no dancer profile
- Account home: profile hidden banner
- Account home: surname switch changed
- Account home: sign-out confirm
- Continue as… (organiser + dancer)
- Account settings
- Account settings: email change pending
- Account settings: profile hidden
- Account settings: no dancer profile
- Confirm sheet: hide profile
- Confirm sheet: sign out of all devices
- Delete account: type DELETE
- Delete account: DELETE typed (red button on)
- Delete account: blocked (only organiser owner)
- Signed out

**Dancer app**

- Home: Maria (1 answer left)
- Home: Alex (complete, busy)
- Home: profile hidden
- Home: profile linked by the team
- Home: new dancer after setup (no nights, zero numbers)
- Home: numbers failed to load
- Home: partner search, asked already
- Home: partner search, limit reached
- Home: week list failed to load
- Home: could not load
- Home: no dancer profile found
- Nights: Alex (upcoming + past, level votes)
- Nights: from the rate nudge (focused)
- Nights: Maria rates before finishing (answer held)
- Nights: vote failed
- Nights: empty (newbie after setup)
- Nights: could not load
- Me: Maria
- Me: Alex (complete)
- Me: profile hidden
- Me: no dancer profile found
- Edit: Maria (WhatsApp block: also teaches)
- Edit: Alex
- Edit: fields marked
- Edit: saved ("Your changes are live.")
- Edit: save failed (too many saves)
- Edit: city not set yet (hide surname off)
- Onboarding step 1: name
- Onboarding step 1: linked profile note
- Onboarding step 2: city
- Onboarding step 3: role
- Onboarding step 4: photo
- Onboarding: photo step from setup (focus)
- Onboarding: You’re in
- Onboarding: Maria resumes on photo
- Onboarding: years (optional)
- Onboarding: styles (optional)
- Onboarding: Nice work
- Photo: choose (Maria)
- Photo: crop
- Photo: preview
- Photo: upload failed (connection)
- Photo: upload failed (other)
- Photo: uploaded but not saved
- Photo: session expired
- Photo: offline
- Photo: photo too small
- Options: Alex
- Options: profile hidden (share off)
- Options: copying not available
- Options: send feedback
- Options: feedback sent
- Options: feedback limit reached
- Options: add to home screen
- Options: sign out confirm
- Options: sign out failed
- Options: no dancer profile found
- Page: Maria (not public yet)
- Page: Alex
- Page: profile hidden
- Page: no visitors yet (newbie after setup)
- Page: no dancer profile found

## v2 changes (FIX-PROTO-RELEASE-B, D120 + D121)

Brief: `bachata-admin` branch `brief/people-d89`, `briefs/people-arc/FIX-PROTO-RELEASE-B.md` (sha 6a72a5b). One file changed
(`release-b-prototype.html`, now **162,448 bytes**) plus this handover. No product code, no PR.

### 1. Home link (D120)
- Core helper `homeLink()` renders a "Bachata Calendar" button with an inline house icon (`#i-house`), `data-home`,
  min 44x44 px. `ACT.siteHome` = `leave(() => toast('Opens the site home'))`, so a dirty form goes through "Discard changes?"
  first (verified: Teacher details changed -> home -> Discard sheet -> Discard -> toast).
- Placed by the core `frameHTML()` on every screen except `signup`, `signedOut`, `acctDeleted` (`NO_HOME`):
  - nav row = `[back button][home link] ... [right-side controls]`. With the home link present the visible back-label text is
    dropped (the back button keeps `aria-label="Back to X"`); the screen title carries the context. Screens with no back
    button get the link in the empty left side; `nav:false` screens (Continue as...) get a nav row with only the link.
  - Computer split (Your areas + area/details): the link sits at the top of the LEFT column, right of its back button; the
    right column has none.
  - Dancer app: the old brand text is now the link. The "Dancer" tag shows next to it at computer width only (no room at
    390 px). On dancer screens with a back button (Edit, My page) the Events button is icon-only at phone width
    (`aria-label="Events"`) so the row fits 390 px.
- Plain Ember look outside the dancer app (ember-soft icon chip); in the dancer app the chip is the sunset gradient.
- New invariant in `checks()` (#5): when no sheet is open and the screen is in scope, the top layer must contain an enabled
  `[data-home]`.

### 2. Dancer app colour layer (D121), scoped to `.layer.da` (screen ids `app*` only)
Tokens added in a second `:root` block (existing tokens untouched):

| Token | Value |
| --- | --- |
| `--sun` | `linear-gradient(120deg,#f0703a 0%,#e8487f 52%,#8a4dff 100%)` |
| `--sun-scrim` | `linear-gradient(rgba(18,8,30,.4),rgba(18,8,30,.4))` (layered over `--sun` wherever text sits on it) |
| `--rose` / `--rose-soft` | `#ff9cc0` / `rgba(255,156,192,.14)` |
| `--violet` / `--violet-soft` | `#c9adff` / `rgba(201,173,255,.14)` |
| `--teal` / `--teal-soft` | `#4fe0cf` / `rgba(79,224,207,.14)` |
| `--gold` / `--gold-soft` | `#ffcf66` / `rgba(255,207,102,.14)` |

Per screen:
- **Wrapper**: faint violet/ember glow in the top corners of the graphite ground.
- **Home**: "Your next night" = full-bleed gradient card (event flyer gradient when the night has one, `fly` field; Alex's
  Soho Bachata Social has a teal->violet flyer, Maria's shows the sunset) with white text and an inverted white "See event"
  primary (still one primary). Error / no-night versions of the card stay plain. Greeting avatar in a gradient ring.
  Profile strength = conic gradient ring with the % in the middle. Page views tile teal, Nights been to violet, Levels rated
  gold. Partner search card rose-tinted with a rose edge and a heart-sparkle icon.
- **Nights**: status tags coloured (Going teal, Interested gold, Went violet, Was interested rose; Not going / others grey).
  Date blocks tinted by weekday (Sun/Sat violet, Mon/Thu teal, Tue/Wed gold, Fri rose). Selected level vote filled with the
  scrimmed gradient, white text.
- **Me**: gradient ring on the 64 px avatar; strength shown as a 64 px gradient ring plus the gradient bar.
- **My page**: "How your page looks" list with coloured round ticks (teal, violet, gold, rose); a missing item gets a hollow
  grey circle. No-visitors state shows the music-notes art.
- **Tab bar**: active tab has a gradient pill on its top edge and a soft glow on its icon.
- **Onboarding**: step tag (`.tag.own`) and meter use the gradient; selected chips/options gradient-filled.
- **Celebration**: `daConfetti()` (36 small CSS-animated pieces, 0.9 s + up to 0.2 s delay, removed at 1.15 s, no library)
  fires on entering "You're in" and when profile strength crosses 70% or reaches 100% (e.g. "Use this photo" 55% -> 80%).
  It returns before creating anything when `prefers-reduced-motion: reduce` matches (CSS also hides `.confetti`).
- **Empty states**: inline line-art SVGs in the accents: moon + notes (no nights, 443 B), music notes (no visitors, 536 B),
  dancing couple (no dancer profile found on Home / Nights / Me / Edit / Options / My page, 558 B).
- Disabled options/chips inside the dancer app are forced grey (`.da .opt[disabled]`, `.da .tog[disabled]`); disabled
  primaries keep the Ember grey.
- Account, Your areas, Teacher/DJ, organiser stub and sign-up are untouched (plain Ember).

### Contrast (WCAG ratio, computed from the token values over the real backgrounds)
| Pair | Ratio |
| --- | --- |
| White on `#f0703a` + scrim (gradient light end) | 6.47 |
| White on `#e8487f` + scrim | 7.59 |
| White on `#8a4dff` + scrim | 8.66 |
| White on flyer `#13877d` / `#5b3fd6` + scrim | 8.61 / 11.04 |
| White at 85% on `#f0703a` + scrim (worst small text) | 5.17 |
| Ink `#1d0a03` on white (inverted hero button) | 19.14 |
| Teal on teal-soft over card / card-2 | 6.16 / 5.39 |
| Gold on gold-soft over card / card-2 | 6.67 / 5.84 |
| Violet on violet-soft over card / card-2 | 5.34 / 4.68 |
| Rose on rose-soft over card / card-2 | 5.33 / 4.67 |
| Text `#f1f2f4` on any soft accent (worst: gold-soft/card-2) | 7.62 |
| Mute `#a3a9b3` on the tinted empty-state card (violet / ember end) | 5.25 / 5.41 |
| Mute on the wrapper glow (violet / ember) | 5.95 / 5.89 |
| Text on card-2 (% inside the ring) | 10.68 |

All >= 4.5:1. Mute grey is never placed on a soft accent (tile labels use the accent colour instead). Note, pre-existing
and unchanged: Ember `--acc` on `--acc-soft` over card-2 is 3.38 (v1 `.da-date`/`.tag.own`); in the dancer app those now
use the accents/gradient above.

### v2 self-check results (headless Chromium, Playwright; Outfit stubbed)
1. **Sweep**: 106 jump entries x (390x844, 1280x800) = 212 visits: **0 console errors, 0 failures** (`checks()` incl. the
   new home-link invariant, no page overflow, no nav/tabs/foot/grp/row inner overflow, no control outside the frame, home
   link >= 44 px tall).
2. **Fuzz** with the home-link invariant: seed 7 x 12,000, seed 11 x 10,000, seed 23 x 10,000 = **32,000 actions,
   0 failures, 0 console errors** (home link tapped 3,252 times).
3. **Invariant can fail (mutation)**: home link removed on `acctSettings` only: sweep 8 failures
   (`no home link at acctSettings`), fuzz failed at action #112 (seed 7), #117 (seed 11), #36 (seed 23). Mutant was a
   scratch copy; the shipped file is unmutated and is the one the clean runs above used.
4. **Reduced motion**: emulated `reduce`, 26 onboarding/photo/edit jumps + "You're in" + a real 55% -> 80% photo save:
   **0 confetti elements created** (MutationObserver + direct count). Normal motion: 1 created on each trigger, gone
   after 1.3 s.
5. **Size** 162,448 bytes; inline SVG only; 0 external scripts; 1 Google Fonts link (Outfit).

Not verified: a real phone; Outfit rendering (stubbed, so the measured 390 px header used a wider fallback font, which
leaves Outfit more room); colour feel is for the owner's tap-through.

### For slice B (the real code)
- Home link: one shared component in the signed-in shell; the leave guard should reuse the form dirty state.
- Colour layer: add the tokens above, scope the overrides to the dancer-app wrapper, keep `--sun-scrim` under any text.

## v3 changes (FIX-PROTO-RELEASE-B-V3, D123 + D124)

Brief: `bachata-admin` branch `brief/people-d89`, `briefs/people-arc/FIX-PROTO-RELEASE-B-V3.md` (sha 7335390). Two files
changed (`release-b-prototype.html`, this handover). No product code, no PR.

1. **D123**: "What's on this week" removed from dancer Home: the section, `daWeek()`, the `DA_WEEK` data and the
   "Home: week list failed to load" jump. `grep daWeek` = 0 hits. (The `stats.week` page-views number is a different thing and stays.)
2. **D124**: "Teachers and DJs from your nights" sits where the week list was.
   - Data: `DA_LINEUP[person][night id]` (public fields only: id, name, roles, optional gradient avatar). `daPeopleList()` keeps
     nights with attendance going and a past date, one row per person (most recent night wins), newest night first.
   - Row (`daPRow`): initials avatar (gradient for some), name, role tags (Teacher violet, DJ teal; Lena Ortiz has both = one row, two
     tags), "On the line-up at <night>, <d Mon>"; tap toasts "Opens <name>'s page". At most 6 rows, then "See all (N)" opens
     `SHEETS.dPeople` with the full list. Maria has 8 people (so See all shows); Maria gained three past "going" nights
     (Sensual Sundays 18 Oct, Brixton 3 Oct, Old Kent Road 26 Sep), which also shows in her Nights list.
   - Empty (newbie after setup, and Alex whose past line-ups were empty): line-art headphones + star in the accents, the brief's copy, ONE
     secondary "Browse events" action (toast "Opens events"; it is not a `.primary`, because Home's next-night card can already hold the screen's one primary).
   - Error: "Couldn't load teachers and DJs." + "Try again" (retry succeeds; the generic `dRetry`).
   - Jumps added: filled (8 people), See all sheet, empty (line-ups were empty), empty (no past nights), failed to load.
   - Invariant #6 in `checks()`: on `appHome` the section exists exactly once (zero when the profile row is missing or Home failed to load),
     in exactly one of filled / empty / error; filled has 1 to 6 rows; empty has an enabled action; error has an enabled retry; every
     `[data-pr]` row (Home and the sheet) is an enabled button with an action.
3. Small fix: `<symbol id="i-areas" viewBox=` space restored.

### v3 self-check results (headless Chromium, Playwright; Outfit stubbed)
1. **Sweep**: 110 jump entries x (390x844, 1280x800) = 220 visits: **0 failures, 0 console errors** (`checks()` clean, no page overflow,
   every people row / See all / action `offsetHeight` >= 44, nothing outside the frame, no row overflow).
2. **Fuzz**: seed 7 x 12,000, seed 11 x 10,000, seed 23 x 10,000: **32,000 actions, 0 failures, 0 console errors** (seed 7: 12,000; seed 11: 10,000; seed 23: 10,000). Filled and empty states were both visited by the fuzz (hundreds of times); the error state is covered by the sweep.
3. **Invariant can fail (mutation)**: one row's link removed (`a: null` in `daPRow`) in a scratch copy: sweep 14 failures
   (`people row without enabled link`), fuzz failed within the first actions. Shipped file unmutated.
4. **Contrast** (new pairs, computed from the token values):

| Pair | Ratio |
| --- | --- |
| Teacher tag: violet on violet-soft over card-2 (row) / card | 4.65 / 5.34 |
| DJ tag: teal on teal-soft over card-2 / card | 5.37 / 6.17 |
| Name text `#f1f2f4` on card-2 (also initials) | 10.68 |
| Mute "On the line-up" line on card-2 | 5.06 |
| White initials on gradient avatar + scrim (worst, light end) | 6.50 |
| Empty card: text / mute on the violet-tinted card | 11.04 / 5.23 |
| "See all" ember link on card | 4.66 |

5. **Size** 166,838 bytes (under 400 KB); inline SVG only; no external scripts; one Google Fonts link (Outfit).

Not verified: a real phone; Outfit rendering (stubbed); the real data (D126: no read returns this today; the section is built
against the pinned `my_nights_lineup_people_v1()` shape: person id, public slug, display name, avatar, roles, last night name + date).

## Parked questions
- Q: Should a night the dancer marked "going" but that the organiser later cancelled still count as "went"? Default used: yes, any past going night with a line-up counts (the prototype has no cancelled past night). Cost if wrong: small. Where: release-b-prototype.html `daPeopleList`.
- Q: Empty-state "Browse events" is a secondary button, not primary. Default used: secondary, so the screen keeps one primary (Home's next-night card). Cost if wrong: small. Where: release-b-prototype.html `daPeople`.
