# Fix: garbled confetti emoji on /festivals

Owner words (2026-10-24): "The Festivals page shows garbled confetti emoji." Approved: "I approve" -> all of the above.

## The defect (proved on main)
`src/pages/FestivalHub.tsx` line ~36, inside `ConfettiParticle`, the array of 10 strings is mojibake: UTF-8 emoji bytes
decoded as cp1252 and saved again. Visible symptoms: strange letters falling instead of confetti emoji.

## The fix
Replace ONLY that 10-item array with 10 real celebration emoji written as JS unicode escapes, e.g. "\u{1F389}" (party popper),
so no raw non-ASCII is in the source (CLAUDE.md: Cowork/FUSE corrupts raw Unicode). Keep `[Math.floor(Math.random() * 10)]`.
Do not touch anything else in the file. One file, about one line.

## Class fix (the check that would have caught it)
Find out why `scripts/check-mojibake.mjs` (npm script) did not flag this line. If it is a one-line pattern gap, widen it and
add a canary using this exact garbled string. If it is bigger, do NOT widen: write the cause in the PR body and stop.
Max 3 files total.

## Done when
- `rg` for mojibake sequences over src finds none left in FestivalHub.tsx.
- Unit test or check proves the 10 strings are all real emoji (no cp1252 sequences).
- Run every CI job step that applies; per-job table in the PR body. PR body has `## Phone QA` and `## Verified on real data`
  sections in the required shape (Sizes checked / Walked / Not verified; Shapes surveyed / Checks run / NOT verified).
  Real data: not applicable (no data read) - say so.
- Walk /festivals at 390x844 in your preview and look at the confetti.
