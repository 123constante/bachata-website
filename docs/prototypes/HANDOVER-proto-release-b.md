# HANDOVER: PROTO-RELEASE-B (interactive tap-through prototype)

Brief: `bachata-admin` branch `brief/people-d89`, `briefs/people-arc/PROTO-RELEASE-B.md` (sha e6ef299). Ticket dt_e80dffbd4e88.

## State: DONE (full finish, not partial)

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
