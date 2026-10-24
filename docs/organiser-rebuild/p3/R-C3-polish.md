# R-C3-polish: walk finds after the sim fix + the owner's "fix them too"
Repo: Website. Branch: `claude/er-p3-mock-c3` (no PR). Base: 276ada3. Lane: normal. Mockup only, no product code.
Files: `docs/organiser-rebuild/p3/mockups/C3.html` (+ `C3.md`, `selfcheck/C3-probes.mjs`, `selfcheck/C3-sweep.mjs`).
Context: read `docs/session-handover-2026-10-24-er-p3-c3-sim-fix.md` (previous pass) first.
## A. Orchestrator walk finds at 276ada3 (390x844 light/dark, 1280x800 dark)
- **W1 header ignores a forward change.** Sensual Fridays, class row, Starts 8:30pm, Save, "From Fri 30 Oct on". The
  class row says "From Fri 30 Oct: 8:30pm to 9pm" but the header still reads "Every Friday · Party 9pm, class from 8pm"
  and Events/Home rows say 8pm. Same doubt the testers had ("did it save?"). Fix: `startPhrase` gets the event and
  reads the sessions as they apply to the NEXT live date (base + `from` segments with d <= that date); when a later
  segment changes a start time, the header adds it: "Every Friday · Party 9pm, class from 8pm (8:30pm from Fri 30 Oct)".
  Short rows (Events, Home, Stats) show the next date's time. Probe `R-pol-w1`.
- **W2 the session sheet button promises before it asks.** It says "Save for all dates", then opens "Which dates?".
  Fix: the sheet button says "Save" when the "Which dates?" step will follow. Probe `R-pol-w2`.
- **W3 duplicate start line.** Header line 2 now names the times; line 3 "Starts 8pm (from the first session), ends
  1am the next day" repeats it. Keep only "Ends 1am the next day" (or "Ends 11pm") on line 3. Probe `R-pol-w3`.
## B. Owner decision 2026-10-24: fix the three things the last pass left alone
- **B1 lookalike names.** Every sample person's FIRST name is unique across all events. Rename "Sofie Lane" (extra
  masterclass, 30 Oct) to "Lena Ortiz" and the teacher pair "Marco & Sofia" to "Marco & Elena". "Sofia Ramos" stays
  (task 4 of the usability test adds her). Update C3.md (tour + any text) and every probe that names them. Probe
  `R-pol-names`: no two distinct people in the data share a first name.
- **B2 one way to change a line-up.** Today three doors (event "Line-up · N people", date sheet "Change line-up",
  a session row's line-up) can open different first screens. First list every door in the handover. Decision: one
  flow, one label "Change line-up" on every door, every door opens the SAME first sheet ("Change the line-up for which
  dates?"), pre-set to where you came from (a date: "Just Fri 30 Oct"; the event: "Every date"). Remove a door only if
  it would duplicate another on the same screen. Probe `R-pol-lineup`: each door opens the same sheet id.
- **B3 "Pause" becomes "Hide".** Testers read "Pause" as unclear for "hide it". Status row: "Live · Hide or end it".
  Action: "Hide from the calendar", sub "Dancers can't see it until you show it again. Dates kept." Confirm sheet
  button "Hide it". State label "Hidden · dancers can't see it". Undo/turn back on: "Show it again". Toasts likewise.
  Sweep every "Pause/Paused/pause" string (UI, toasts, Needs-you items, Events list chip, C3.md tour) and list them.
  Probe `R-pol-hide`: no visible "Pause" word on any screen state the sweep renders.
## Do NOT change
Home "All your events" vs "This week" (open owner question). Stats layout/metrics (a new "seen in lists" count is
being planned separately). Anything else that passes today.
## Gates
- Every `R-pol-*` FAILS on 276ada3 (`git show 276ada3:<path>`) and PASSES after; the 104 earlier probes still pass (if
  one asserted old wording/names, change it and say which and why).
- `C3-probes.mjs` all pass; `C3-sweep.mjs` 0 everywhere (contrast, taps, sideways, under-bar, toast, keyboard, console).
- Look at screenshots yourself, 390x844 light AND dark: Fridays header after "From Fri 30 Oct on"; the line-up first
  sheet from each door; the Hide sheet and the Hidden event page; the date sheet for 30 Oct (names). 1280x800 dark: event page.
- C3.md: a "Polish pass" row in the fix-pass table; probe count updated.
## Output
One commit, one push to `claude/er-p3-mock-c3` (push once: Vercel budget). Handover
`docs/session-handover-2026-10-24-er-p3-c3-polish.md`: per item fixed / why not, the line-up door list, the Pause
string sweep, probe counts, red-first proof, screenshots looked at.
