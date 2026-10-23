# R-C3-forward: "this and later" is stored as N one-off dates (walk find after the toast fix)

Repo: Website. Branch: `claude/er-p3-mock-c3` (no PR). Base: 912fe8e4. Lane: normal. Mockup only, no product code.
File: `docs/organiser-rebuild/p3/mockups/C3.html` (+ `C3.md`, `selfcheck/C3-probes.mjs`).

## The failure (orchestrator walk at 390x844, light + dark, 1280x800)
Owner tour step 3 (Fri 20 Nov, 8pm class, Starts 8:30pm, "This and later ones", "Save for these dates").
The toast is now right (one line, 75px). But then go Back to the Sensual Fridays page:
- The class row says "8pm to 9pm" and under it, in warning colour, **"Different on 12 dates: 6 Nov, 20 Nov,
  27 Nov, 4 Dec, 11 Dec, 18 Dec, 1 Jan 2027, 8 Jan 2027, 15 Jan 2027, 22 Jan 2027, 29 Jan 2027, 5 Feb 2027"**
  (98px of dates). A forward change reads as a wall of one-off exceptions.
- The list stops at 5 Feb 2027 (the end of the generated dates) on an event with "No end date": it tells the
  owner every later Friday still starts at 8pm.
- Every date chip from 20 Nov carries the "changed" dot, and the legend says "14 changed for that date"
  (also odd wording).

Cause: `setSessOn(e, di, sid, patch, 'later')` (around line 1329) writes a per-date override `x.so[sid]` onto
every date from `laterDates(e, di)`. Everything downstream (`ownDates`, `diffWords`, the legend, All dates
"Changed" filter, chip dots) then correctly reports N one-off changes. Same SHAPE as the toast bug: a forward
change turned into N per-date facts.

## Decision (made, do not reopen)
A "this and later" change is ONE forward change on the series session, not N per-date overrides.
1. Model: on the series session add `from: [{ d: <Date of the first changed date>, p: { ...patch } }]`, kept
   sorted by `d`. `dsess(e, x)` applies, in order: the base session, then every `from` segment with
   `seg.d <= x.d`, then the per-date `x.so[s.id]` (per-date still wins). A date inside a forward range is NOT
   "changed" (`m.chg` false, no chip dot, not counted in the legend or All dates "Changed").
2. `setSessOn(..., 'later')`: push the segment (merge into an existing segment with the same `d`); on each later
   date that already had `so[sid]`, delete the keys the patch sets (that is what the scope sheet promised:
   "had its own Class change: it changes too"), keep `cx` ("stays not running"), and drop an empty `so[sid]`
   / empty `so`. 'one' and 'all' unchanged.
3. Event page, session row: under the session add one line per segment, warning colour, e.g.
   **"From Fri 20 Nov: 8:30pm to 9pm"** (the segment's words: time, name, level, room, line-up, whatever the
   patch changed). "Different on N dates" stays for genuine per-date overrides only (here: "Different on
   1 date: 6 Nov" for the class that is not running).
4. Legend wording: "14 changed for that date" becomes **"N dates with their own changes"** (1: "1 date with its
   own changes"). Same words on All dates (line ~1032).
5. Undo after the save (`restore2(e, sn)`) must restore the segments too: check `snap2` copies `e.sess`
   deeply including `from`.

Then sweep C3.html for every OTHER writer with a 'later' scope (at least: `saveLineup` with
`data-scope="later"`, the date sheet "Move every session" if it offers later, bulk shift, any Repeat change
that writes per-date) and give each the same treatment, or say why it is already a single forward fact. List
each one in the handover with "ok" or "fixed".

## Also fix (small, found on the same walk)
- `C3.md` "Owner tour" step 5 says "Add one before" (7pm class). The class added is 8pm to 9pm (one hour before
  the 9pm party). Change the tour text to 8pm.

## The checks that would have caught it (add them, red first)
In `selfcheck/C3-probes.mjs`:
- `R-fwd-row`: tour step 3 as above, then open the Sensual Fridays page. Assert the class row has no
  "Different on" listing 20 Nov, contains "From Fri 20 Nov: 8:30pm", and the "Different on" line (if any) names
  at most the dates that had their own per-date override BEFORE the save.
- `R-fwd-legend`: the legend's changed-date count is the SAME before and after the tour-3 save.
- `R-fwd-date`: after the save, the Fri 27 Nov date sheet shows the class at 8:30pm and its chip has no dot;
  Fri 13 Nov still 8pm.
- `R-fwd-undo`: Undo on the toast returns the row to "8pm to 9pm" with no "From" line.
- `R-fwd-lineup`: line-up "This and later" from 20 Nov produces a "From Fri 20 Nov" line, not a date list.
Each `R-fwd-*` must FAIL on 912fe8e4 (`git show 912fe8e4:<path>`) and PASS after. Every earlier probe still
passes (83 today); if an old probe asserted the per-date shape, change it and say which and why.

## Gates
- `node docs/organiser-rebuild/p3/mockups/selfcheck/C3-probes.mjs docs/organiser-rebuild/p3/mockups/C3.html`: all pass.
- `node docs/organiser-rebuild/p3/mockups/selfcheck/C3-sweep.mjs docs/organiser-rebuild/p3/mockups/C3.html`: still 0
  everywhere (contrast, taps, sideways, under-bar, K1, toast in viewport, keyboard, console errors).
- Look at screenshots yourself: the Sensual Fridays page after tour 3 at 390x844 light and dark, 1280x800.
- C3.md: a "Walk find: this-and-later is one forward change" row in the fix-pass table, probe count updated.

## Output
One commit, one push to `claude/er-p3-mock-c3` (push once: Vercel budget). Handover note
`docs/session-handover-2026-10-23-er-p3-c3-forward.md`: diff summary, the 'later' writer sweep (each ok/fixed),
probe counts, red-first proof (fail on 912fe8e4, pass after), screenshots looked at.
