# fix-main-red-e2e-welcome-declined

## Cause (deterministic)
`.p3-ob-scr[data-dir="fwd"]` slides in with `translateX(40px)` over `--dur`. `inViewport` measured
`p3-ob-declined` before that finished (only `check()` waited), so on a loaded CI runner the right edge read
x+40px past 390.5. Hypothesis (a) confirmed; (b) ruled out (long note/name test passes: `overflow-wrap: anywhere`);
(c) not needed.

## Evidence
- Unfixed spec, slide-in slowed to 1500 ms: `Expected <= 390.5, Received 406.23` (red).
- Unfixed spec, warm local machine: 40/40 pass (20 repeats x light/dark of the note test), i.e. not reproducible
  without load. The CI failure rate was not measurable here.
- Fixed spec: whole file x4 repeats = 72/72 pass (includes the new slow-slide and longest-shape tests).

## Fix
Test-side only: `settle()` awaits finite animations inside `inViewport`. No CSS change (the card cannot overflow).
Added tests: slow slide-in, and "declined card never wider than the phone" (500-char note + 60-char unbroken token + long name).

## Not done
The 20-repeat run of the single test on the fixed spec timed out in this sandbox (dev server is slow); 4 repeats of everything done instead.
