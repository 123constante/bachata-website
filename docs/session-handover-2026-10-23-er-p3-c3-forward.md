# Handover 2026-10-23: ER P3 C3 "this and later" is one forward change

Branch `claude/er-p3-mock-c3`, base 912fe8e, brief `R-C3-forward.md`. Mockup only (no product code).

## Diff summary (`docs/organiser-rebuild/p3/mockups/`)
- `C3.html`: `dsess` applies `s.from` segments (`g.d <= x.d`) between base and per-date `so`. `setSessOn(..,'later')` pushes or merges a sorted `{d,p}` segment, drops the patched keys from later dates' `so[sid]` (empty `so[sid]`/`so` removed), keeps `cx`. New `fromWords`. Event page row shows "From Fri 20 Nov: ..." lines; "Different on N dates" now only genuine per-date overrides. Legend + All dates: "N dates with their own changes" ("1 date with its own changes"). `restore2` revives segment `Date`s (snap2's JSON clone already copies `from`).
- `C3.md`: tour step 5 now 8pm; fix-pass row; probe count 88.
- `selfcheck/C3-probes.mjs`: +R-fwd-row, R-fwd-legend, R-fwd-date, R-fwd-undo, R-fwd-lineup; S8 rewritten (it asserted the per-date shape: 20:15 on every later date's `so`; now asserts one segment from 20 Nov and zero per-date copies).

## 'later' writer sweep
- Session sheet save (`ssSave` -> `setSessOn`): fixed.
- `saveLineup` with scope later (`setSessOn`): fixed (same path). Pick-dates line-up uses 'one' per picked date: ok (genuinely per date).
- Date sheet "Move every session" (`data-` shift, line ~2123): ok, offers one date only, no later scope.
- Bulk shift: ok, same one-date path; no later scope.
- Move this and later (`applyMove`): ok, sets single `e.wd` plus moved dates, which are real per-date date facts (each date does move); not session overrides.
- Cancel this and later: ok, each date is genuinely cancelled (existing "Cancelled" state), not a session override.
- Repeat change: ok, writes `e.wd`/rule, no per-date overrides.

## Probes / red-first
- 88 pass, 0 fail (83 + 5).
- Against `git show 912fe8e:.../C3.html`: R-fwd-row, -legend (3 -> 14), -date (dot true, 13 overrides), -undo (precondition "From" line absent), -lineup all FAIL; all PASS after.
- Sweep (111 states, 6 keyboard states, 678 runs): contrast 0, taps 0, overflow 0, under-bar 0, K1 0, theme 0, toast 0, keyboard 0, console errors 0.

## Screenshots looked at
Sensual Fridays page after tour 3: 390x844 light, 390x844 dark, 1280x800 light. One "From Fri 20 Nov: 8:30pm to 9pm" line, "Different on 1 date: 6 Nov", legend "3 dates with their own changes", no chip dots from 20 Nov, toast one block.

## Not verified
Real phone; iOS keyboard; screen reader.
