# R-C3-sim-fix: fix what three simulated organisers stumbled on in C3
Repo: Website. Branch: `claude/er-p3-mock-c3` (no PR). Base: be017c5a. Lane: normal. Mockup only, no product code.
Files: `docs/organiser-rebuild/p3/mockups/C3.html` (+ `C3.md`, `selfcheck/C3-probes.mjs`).
## Read first
The three reports, IN FULL, with their cited shots (fetch the branches, read with `git show`):
- `origin/claude/er-p3-c3-sim-a:docs/organiser-rebuild/p3/usability/C3-sim-A.md` (Maria, 52, careful)
- `origin/claude/er-p3-c3-sim-b:docs/organiser-rebuild/p3/usability/C3-sim-B.md` (Dee, DJ, reads only headings)
- `origin/claude/er-p3-c3-sim-c:docs/organiser-rebuild/p3/usability/C3-sim-C.md` (Sam, first social)
The orchestrator checked the shots for every major below; they are real at be017c5a.
Owner-facing summary: https://claude.ai/artifact/L2yR6oj5vkVhejgxsodLNL (same list, same decisions).
## Decisions (made, do not reopen)
### Majors (each gets a red-first probe)
- **M1 stale time after "Save for all dates" (3/3).** Tester words: "It still says 8. Did it save?" After changing the
  Fridays class to 8:30pm for all dates, the header line still reads "Every Friday, 8pm · Colab Tower" while the line
  under it says "Starts 8:30pm". Fix the CLASS: every place that summarises an event's start time (event header line,
  Home card, Events list row, Stats "By event" row, anything else you find: grep for every writer of that summary)
  derives from the same function over the current sessions, not a stored string. List each place in the handover.
- **M2 Save/Next vanishes while a field is focused (3/3).** Tester words: "Where's Save? Did I break it?" The bottom
  bar shows "Nothing changed yet", then becomes empty while typing; Save appears only after blur. Fix: the bar never
  empties; it turns into the active Save/Next on the `input` event (first keystroke), not on `change`/blur. Sweep every
  sheet and wizard step with a text/url/time field (ticket link, name, description, links, line-up search, wizard name)
  and list each ok/fixed. If the bar is hidden on purpose for an on-screen keyboard, remove that: a keyboard covering a
  bar is the phone's job, an empty bar is ours.
- **M3 new 9pm party shows "8pm" on review (3/3).** Tester words: "I said nine. Is that wrong?" With a class added
  before, the review "When" reads "Every month on the first Saturday, 8pm". Fix: when an event has more than one
  session, the summary names the main session and the earliest one: "Every month on the first Saturday · Party 9pm,
  class from 8pm" (main = the session the wizard started with / type party or social). Use the same function as M1 so
  the event header after "Put it live" says it too. Wizard step 2 heading becomes "When does the party start?" (the
  type's own word: party / social / class).
- **M4 the session time sheet only offers "all dates" (2/3).** Tester words: "I wanted 'from the next one'; nothing let
  me say that." Cancel and line-up ask "Which dates?" (this date only / this and later / every date); the session
  sheet opened from "Sessions every date" offers only "Save for all dates". Fix: the same "Which dates?" step, default
  "Every date", with "From Fri 30 Oct on" (the next date after tonight's, named) and "Just Fri 23 Oct" when tonight is
  the next date. "From" writes the forward segment from be017c5a (`from: [{d, p}]`), not per-date overrides.
### Small (fix in the same pass; one probe each where cheap)
1. Home card people line gets role words: "Teaching: Marco & Sofia · DJ: Kizzy" (all roles present; omit an empty role).
2. After "Put it live", open the new event's page (toast stays), not Home.
3. A session added with "Add a class before" is named "Class" (the type word), never "No name yet".
4. Stats big tile: "893 views" gets the words "all your events".
5. Stats sample data: the date-by-date table for an event must add up to its "By event" total (Fridays shows 300,
   visible rows add to 197). Generate one from the other. Add a probe that sums them for every event.
6. Dead taps: the event title on the Home card opens the event; the time line under the event title opens the
   session sheet (or the sessions section).
7. Toasts name what changed: "Ticket link saved. Dancers see it now."; cancel toast carries the reason:
   "Sat 31 Oct cancelled: the venue isn't available. Dancers see it now." Sweep every toast; list them.
8. After a save on the event page, return to the row that was changed (scroll it into view), not the top.
9. "Live · Pause or end it" and "Pause this event" are one row: keep "Live · Pause or end it" (opens the sheet with
   Pause / End); remove the duplicate.
10. Words: cancel sheet "Keep it" becomes "Don't cancel"; "Add one before" becomes "Add a class before"; Stats
    "Ran 52 times since 2024" becomes "52 nights since 2024".
11. The "Different on N dates: ..." line lists the date the organiser just changed first (most recent change first).
### Do NOT change
- Lookalike sample names (Sofia Ramos / Sofie Lane / Marco & Sofia): sample data, keep.
- Home "All your events" vs "This week": OPEN owner question, decided by a later real-organiser test. Leave Home's list as is.
- Stats layout/chart/metrics: waiting on an owner conversation. Only items 4, 5 and the word in 10.
- The three doors to the line-up; the word "Pause".
## Checks (add, red first)
In `selfcheck/C3-probes.mjs`, at least: `R-sim-m1-header` (after all-dates 8:30pm: header, Home card and Events row all
say 8:30pm), `R-sim-m2-bar` (focus the ticket link field, type one char: the bar shows an enabled Save; same for the
wizard name step), `R-sim-m3-review` (wizard: monthly, 9pm, add a class before: review When contains "Party 9pm" and
"class from 8pm", no bare "8pm" as the event's time), `R-sim-m4-scope` (session sheet offers three scopes; "From" leaves
tonight at 8pm and changes the next date; the class row shows a "From ..." line), `R-sim-stats-sum`, plus one per small
item where cheap. Every `R-sim-*` must FAIL on be017c5a (`git show be017c5a:<path>`) and PASS after. Every earlier
probe still passes (88 today); if one asserted old behaviour, change it and say which and why.
## Gates
- `node docs/organiser-rebuild/p3/mockups/selfcheck/C3-probes.mjs docs/organiser-rebuild/p3/mockups/C3.html`: all pass.
- `node docs/organiser-rebuild/p3/mockups/selfcheck/C3-sweep.mjs docs/organiser-rebuild/p3/mockups/C3.html`: still 0
  everywhere (contrast, taps, sideways, under-bar, toast in viewport, keyboard, console errors).
- Look at screenshots yourself, 390x844 light AND dark: event page after M1; ticket link mid-typing (M2); wizard review
  (M3); session scope step (M4); Home card; Stats. And 1280x800 dark for the event page.
- C3.md: a "Sim fix pass" row in the fix-pass table, probe count updated.
## Output
One commit, one push to `claude/er-p3-mock-c3` (push once: Vercel budget). Handover note
`docs/session-handover-2026-10-24-er-p3-c3-sim-fix.md`: per item (M1-M4, 1-11) fixed / why not, the M1 summary-place
sweep, the M2 field sweep, the toast sweep, probe counts, red-first proof (fail on be017c5a, pass after), screenshots
looked at.
