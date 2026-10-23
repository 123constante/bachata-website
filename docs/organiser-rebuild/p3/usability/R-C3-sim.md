# R-C3-sim: simulated first-time organisers on mockup C3 (method, shared by personas A, B, C)

Repo: Website. Mockup: `docs/organiser-rebuild/p3/mockups/C3.html` on branch `claude/er-p3-mock-c3` at **be017c5a**
(`git fetch origin claude/er-p3-mock-c3` then `git show be017c5a:docs/organiser-rebuild/p3/mockups/C3.html > /tmp/c3/C3.html`).
Lane: normal. **Read-only on the mockup: you change NOTHING in C3.html, C3.md or selfcheck/.** You write one report.

## Who you are (by your branch; play ONLY your persona)
- `claude/er-p3-c3-sim-a` = **A, Maria, 52.** Runs one weekly social for six years; WhatsApp and Facebook only. Reads
  slowly, taps the first thing that looks roughly right. "Session", "scope", "series" mean nothing; "class", "party",
  "night" do. Afraid a wrong tap tells 300 dancers something false: no clear "saved" sign makes her go back and check.
- `claude/er-p3-c3-sim-b` = **B, Dee, 34, a DJ running three events.** Between sets, impatient, thumb only. Reads
  headings and button words, never grey helper lines. Taps a roughly-right button at once; expects Instagram or
  Eventbrite habits. Two screens without progress and Dee goes back to the start.
- `claude/er-p3-c3-sim-c` = **C, Sam, 27, new organiser.** First social next month, first time here. Reads every word,
  but does not yet know how a repeating event, one date and a class within the night relate; keeps asking "every
  week or just this one?" and says so whenever the screen does not answer it.

## Why
The owner asked whether C3 is intuitive. No tool measures that; real organisers will test next. This run removes
the obvious stumbles first, cheaply. An AI reads every word and gets lost less than a person, so treat every
hesitation you notice as real and report it; never explain a stumble away.

## Set-up
- Serve the file: `python3 -m http.server 8740 --directory /tmp/c3` and drive it with Playwright Chromium (the
  selfcheck scripts in `selfcheck/` show the set-up; stub Google Fonts the same way). Viewport **390x844**, light
  theme, a fresh page load (no localStorage) for EVERY task.
- Start each task on the welcome screen, tap "Show me my week" (that is what a real invitee does), then begin.
- **You may only act on what a person sees:** a screenshot plus the accessibility snapshot of the current screen.
  Never read the page source, `window.__c2`, or the selfcheck scripts to find your way. Never use the "Tour" link.
- Tap like a person: pick the visible control whose words best match your goal, in reading order. Scroll only if
  nothing on screen fits. One action at a time; take a screenshot after every action and LOOK at it.
- Give up a task after 4 wrong taps (a tap that leads away from the goal, or a Back to undo one) or 2 returns to
  the start screen. A give-up is a finding, not a failure of yours.

## The 8 tasks (give them in this order, as plain goals; do not search for the words in them)
1. Tonight's Sensual Fridays: who is teaching, and how many people are going?
2. From now on, the Friday class starts at 8:30pm instead of 8pm (every Friday from the next one).
3. Sensual Saturdays is not happening on Sat 31 Oct: the venue is closed. Cancel it and tell dancers why.
4. Sofia Ramos teaches the Friday class on Fri 30 Oct only. Add her for that date.
5. The ticket link for Sensual Saturdays changed to https://tickets.example/sat-new. Change it.
6. Mambo City x LLB is taking a break for a few months. Hide it from the calendar without deleting it.
7. Make a new monthly social: first Saturday of every month, 9pm, at Studio 68, a class before the party.
8. How many people looked at Sensual Fridays in the last 30 days?
After each task, check the result is really there (the page shows it) and say whether you would trust that
dancers now see it.

## For every task record
- Outcome: done / done with trouble / gave up. Taps used vs the shortest path you found AFTERWARDS (state that path).
- Every wrong tap: the screen, what you tapped, its exact words, why those words pulled you there.
- Every stall: the screen and what you were looking for and could not see (words you expected).
- Words you did not understand or had to guess at (quote them exactly).
- Anything that made you unsure the change saved, or whether dancers see it.
- Screenshot paths for each wrong tap and each stall.

## Report (your only output)
`docs/organiser-rebuild/p3/usability/C3-sim-<A|B|C>.md`:
1. A table: task | outcome | taps used / shortest | wrong taps | stalls.
2. Friction list, worst first: where, what happened, the persona's words, a severity
   (blocker = gave up or wrong result; major = 2+ wrong taps or unsure it saved; minor = a pause or a guessed word).
   Say what the screen made you expect; do NOT design the fix.
3. What worked without any thought (so nobody "fixes" it).
4. Honest limits of this run.
Screenshots under `docs/organiser-rebuild/p3/usability/shots-<A|B|C>/` (PNG, 390x844, only the ones the report cites).

## Output
One commit, one push to your branch (named in your dispatch prompt). Push once. No PR. Report head SHA and the table.
