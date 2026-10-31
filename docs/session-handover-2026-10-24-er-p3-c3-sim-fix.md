# Handover 2026-10-24: ER P3 C3 sim fix (R-C3-sim-fix)

Branch `claude/er-p3-mock-c3`, base be017c5a. Mockup only: `docs/organiser-rebuild/p3/mockups/C3.html`, `C3.md`,
`selfcheck/C3-probes.mjs`, `selfcheck/C3-sweep.mjs`. No product code, no PR.

## Per item

| Item | Status | What |
|---|---|---|
| M1 stale time | fixed | One `startPhrase(sessions, fallback, long)` derives every start-time string from the current series sessions. `e.time` is only the fallback when an event has no sessions. |
| M2 bar vanishes | fixed | Removed `.phone.typing .bottombar` from the hide rule (the tab bar still hides). Every `input` handler already called `setBar()`, so the bar turns into Save/Next on the first keystroke. |
| M3 9pm shows 8pm | fixed | Long phrase names the main session (first `social`) and the earliest: "Party 9pm, class from 8pm" (event header, wizard review). Wizard time label: "When does the social/party/class start?" (the type's own word). |
| M4 only "all dates" | fixed | Saving a series session from the event page opens "Which dates?": Every date (default) / From Fri 30 Oct on / Just Fri 23 Oct (the last only when tonight is the next date). "From" writes the forward segment `from:[{d,p}]`; "Just" is a per-date override. "Every date" also drops forward-segment values for the same fields so it really is every date. |
| 1 role words | fixed | Home card: "Teaching: Marco & Sofia · DJ: Kizzy" (empty roles omitted, "DJ " prefix dropped after the role label). |
| 2 Put it live | fixed | Opens the new event page (stack events > event), toast stays. |
| 3 "Class" name | fixed | "Add a class before" session starts named "Class". |
| 4 893 tile | fixed | "views, all your events". |
| 5 stats sums | fixed | `statRows(k)` cuts the date-by-date rows from the event's own 30-day total (largest remainder). Table still drawn for Fridays only; `STATW` also holds Saturdays so the probe sums two events. |
| 6 dead taps | fixed | Home title opens the event; Home time line opens that date's sheet (`data-homedate`); the event-page time line scrolls to the Sessions heading (`data-tosess`). |
| 7 toasts | fixed | See toast sweep. |
| 8 return to row | fixed | `backTo(sel)` after saving Where / How to pay / Ticket link, Details, Prices scrolls the changed row into view. Repeat and photo saves not changed (see Not done). |
| 9 one Pause row | fixed | Removed the "Pause this event" row; "Live · Pause or end it" opens the Status sheet, which has Pause. |
| 10 words | fixed | "Don't cancel" (both cancel sheets), "Add a class before", "52 nights since 2024". Other "Keep it" buttons (remove from every date, skip a week) are not cancel sheets, left. |
| 11 order | fixed | `x.at` change counter; `ownDates` sorts latest change first (seed data has no `at`, so it stays in date order). |

Also: review "Where" row with no place read "undefined"; now "Not set yet" (pre-existing, found while taking the M3 shot).

## M1 sweep: every place a start time is summarised

All now go through `startPhrase`: (1) event page header line (`cadence(e, true)`, long form) and its
"Starts ... (from the first session)" line (already derived), (2) Events list row, (3) Home "All your events" rows,
(4) Stats "By event" rows, (5) Welcome and Invitee rows, (6) the photo screen hero (`cadence(e)`), (7) wizard review
"When" and the step hint (`whenText`). Already derived before this pass and unchanged: Home "Next up" time (`dStart`
over the date's sessions), date sheet title, preview header. Rows use the short form (earliest start, "Every Friday,
8:30pm"); the header and review use the long form.
Not derived on purpose: `e.time` writes in `goLive` / copy remain (fallback only); R4e still asserts a later-move never
rewrites `e.time`.

## M2 field sweep (one keystroke, 390x844; script run, bar visible in all)

| Field | Result |
|---|---|
| Ticket link `#tlink` | fixed: enabled "Save" |
| Wizard name `#fname` | fixed: enabled "Next" |
| Wizard festival ticket `#fticket` | fixed: "Next" |
| Details name / description | fixed: bar shows (Undo my changes, Save) |
| Prices row | fixed: "Save for all dates" |
| Copy name `#cpname` | fixed: bar shows "Pick the first date to carry on" (correct, no date yet) |
| Where search `#wsearch` | fixed: bar shows "Nothing changed yet" (typing a search changes nothing) |
| Line-up search `#psearch` | fixed: bar shows "Nothing changed yet" |
| Session name `#ssname` (sheet) | ok: sheet button already updated on input; no bar involved |
| Repeat `#rptimes/#rpuntil/#rpfirst`, `#adq`, place sheet `#pname/#paddr` | ok by code: `setBar()` on input (repeat); no bar dependence (find, place sheet) |

The tab bar still hides while typing (it is not the action bar). No keyboard-specific hiding remains. Sweep
`keyboard` check changed: bar must NOT be `display:none`, tab bar must be, and the focused field must sit above the bar.

## Toast sweep (65 `toast(` calls reviewed)

Changed: save of Where/Pay/Ticket ("Ticket link saved. Dancers see it now.", "Ticket link removed. Dancers no
longer see it."); series session save ("Time saved for every date. Dancers see it now."); cancel ("Sat 31 Oct
cancelled: the venue isn't available. Dancers see it now.", "Tonight cancelled: ...", "Those dates cancelled: ...");
WhatsApp link ("WhatsApp group link saved. ..."). Already named what changed and left: session add / remove / not
running, move, add a date, break week, reset, prices ("Prices saved..."), details, photo, invite, line-up, bulk cancel
("Dancers see Cancelled and your reason"), pause, live, draft, socials, convert, repeat, history undo, copy, festival.
Unchanged by design: generic "Undone. Nothing changed for dancers." (the undo of whatever the toast named).

## Probes

104 total: 88 earlier + 16 new `R-sim-*`. Red-first: run against `git show be017c5a:...C3.html`, 18 fail
(16 new + F13 + #10, the two that asserted old behaviour); on the new file 104 / 104 pass.
- Changed on purpose: **F13** (asserted the second "Pause this event" row; now asserts it is gone), **#10** (asserted
  both bars hide while typing; now: tab bar hides, bottom bar never does).
- `R-sim-stats-sum` fails on be017c5a by THROWING (`window.__c2.STATW` does not exist there), still a red.
- New: m1-header, m2-bar, m3-review, m3-live, m3-heading, m4-scope, m4-just, stats-sum, s1-people, s3-classname,
  s4-tile, s6-taps, s7-toasts, s8-return, s10-words, s11-order. Small 2, 5, 9 are covered by m3-live, stats-sum, F13.
- Sweep result: 113 states + 6 keyboard states, 690 runs, 0 contrast / taps / overflow / under-bar / K1 / theme / toast / keyboard, 0 console errors.
- Sweep: new states `shSessWhich` and `evMonthlyLive`; keyboard check updated (above).

## Screenshots looked at (390x844 light and dark, plus 1280x800 dark)

Event page after M1 (header "Party 9pm, class from 8:30pm", toast "Time saved for every date"), session "Which dates?"
sheet (dark), ticket link mid-typing with Save showing (light), wizard review (light), wizard step 2, Home card with
role line (dark), Stats tile and date-by-date table (light), event page at 1280x800 dark. Shots taken before the
sheet/page animation finished were retaken after a wait.

## Not verified / not done

- Real phone and the on-screen keyboard (bar covering is the phone's job, per the brief); screen reader.
- Repeat-screen and photo saves do not scroll back to their row (brief item 8 names "a save on the event page"; the
  Where / Pay / Ticket / Details / Prices rows are covered).
- "Different on N dates" order is by change recency only for changes made in this session; seed data stays in date order.
- Table for date-by-date shown for Fridays only; the other events' rows exist as data (`STATW`) and are summed in the probe.
- Not touched, per the brief: lookalike sample names, Home "All your events" vs "This week", Stats layout/metrics, the three
  line-up doors, the word "Pause".
