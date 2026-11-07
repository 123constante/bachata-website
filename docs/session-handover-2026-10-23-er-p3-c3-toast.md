# Handover: ER P3 C3 this-and-later toast (dt_5313c85afd03)

Branch `claude/er-p3-mock-c3`, base 494b2db. No PR (mockup only, none requested).

## Diff
- `C3.html` `ssSave()`: toast message built BEFORE `setSessOn`; 'later' uses `laterLine(e, ss.di, what)` (one sentence), 'one'/'all' text unchanged.
- `selfcheck/C3-probes.mjs`: probes `R-toast` (tour step 3 at 390x844: no "had its own", contains "Changes from Fri 20 Nov onwards", toast <= 120px) and `R-notrun` (this-and-later across Fri 6 Nov lists "stays not running" on the scope sheet before the tap).
- `C3.md`: fix-pass table row "Walk find", probe count 81 -> 83.

## Sweep (post-write messages)
saveLineup: ok (laterLine is date-only, no state read) | doCancel: ok | applyMove: ok (msg built before the move) | dodtime: ok ("now runs" describes the new state on purpose) | dobulkcancel: ok | bulk shift: ok | ssSave: fixed.

## Proof
- Red first: on `git show 494b2db:.../C3.html` R-toast FAILS (h=495, lists Fri 27 Nov ... notes); R-notrun passes on both (a guard, not a regression catch).
- After: probes 83/83 PASS; sweep all 0 (taps, overflow, under, k1, theme, toast, keyboard, console errors).

## Not verified
Real phone / iOS; screen reader. Only the Playwright Chromium walk at 390x844.
