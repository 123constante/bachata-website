# BRIEF: flag-art-missing-countries (WEBSITE; branch `claude/flag-art-missing-countries`; normal lane, no DB change)

Brief-version: 2
Owner screenshot 2026-11-05 07:51 (bachatacalendar.co.uk, organiser page, Teachers & DJs): Alexander Gogoladze (Georgia) shows a grey tile with the letters "GE" instead of a flag. Owner click: queue and fix. You never approve or merge.

## Measured cause
`src/components/people/flagArt.ts` has hand-drawn inline SVG for 61 country codes only (`FLAG_ART`). Any other valid code falls to `genericFlagArt(code)`, a grey tile with the letters, by design (file comment). Prod read-only count (dancer_profiles.nationality, 2026-11-05): 179 empty, 20 with art, 5 GB, 1 without art = `GE` (Georgia). So one real person is affected today; every picker country outside the 61 is the same bug waiting.

## What main lacks
- Artwork for `GE`, and for every country the nationality picker can offer that is not in `FLAG_ART`. grep: the picker is `src/components/ui/nationality-picker.tsx` and its country list source (find the constant it reads); `hasFlagArt` in `flagArt.ts`.

## What to do
1. List the exact picker country codes (from its source constant, not from memory) and diff them against `Object.keys(FLAG_ART)`. Put the missing list in the PR body.
2. Add simple, accurate flat artwork for each missing code in the same style as the existing entries (30x20 viewBox, helpers `rect`, `h3`, `v3`, `stripes`, `circle`, `star`). Priority order: `GE` first (white field, red cross, four small red crosses in the quarters), then the missing codes by dancer population in the community (bachata: Europe, Latin America, Caribbean, then the rest). Where a flag has a detailed emblem, draw the simple version used by the existing entries (e.g. the plain field plus a disc); do NOT leave any picker country on the generic tile unless you list it under `NOT verified:` with the reason.
3. Table-driven test over EVERY picker code: `hasFlagArt(code)` is true for all of them, and `flagArtMarkup(code)` contains no `<text`. Red first: run it on unfixed code and show the failing list. Keep the existing generic-flag test for an unknown valid code.
4. Walk at 390x844: render the badge for `GE` and three other new codes (use the existing matrix test as the pattern; no prod write, no test account needed); look at the pictures. Contrast not applicable to flags.
5. Source rules: `flagArt.ts` is over 2 KB, so edit it with `scripts/safe-edit.py` (the pre-write hook prints the invocation). No raw Unicode punctuation (use HTML entities in JSX; this file is plain ASCII anyway).
6. Run every CI job step that applies; per-job table and Verified / Not verified in the PR body, exact labels `Verified on real data:`, `- Shapes surveyed:`, `- Checks run:`, `NOT verified:`, and a `## Phone QA` section naming 390x844.
7. COMMITS: separate plain commands: `git add <files>`, `git commit -F <msgfile>`, `git push origin claude/flag-art-missing-countries`. No `&&` chains, no `-c` flags. ONE push; final subject ends with the done marker of your ticket.

## Files
- src/components/people/flagArt.ts
- src/components/people/__tests__/nationalityFlag.unit.test.ts (or a new test file next to it)
