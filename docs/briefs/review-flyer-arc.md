# Brief: whole-arc independent review of the flyer reader (report only)
Brief-version: 2
Branch: claude/review-flyer-arc
Lane: normal, Opus, REPORT ONLY (no product code). Output: docs/review/flyer-arc-whole.md on this branch; no PR.
Serves: owner hold on the organiserFlyerReader flag until a whole-arc review passes (owner 2026-11-08).

## What main lacks
- A single reviewer verdict, row by row, on contract rows R1-R20 across the merged slices (admin event-flyer-read function #1328/#1330, Website mapping #1494, screen #1498, dark behind flag organiserFlyerReader) -- grep: docs/review/flyer-arc-whole.md

## Files
- docs/review/flyer-arc-whole.md (new)

## How
Read origin/main of this repo for the mapping (src/modules/organiser/p3/new, flyerToDraft) and screen, and the contract text pasted below by the lead if present at docs/briefs/flyer-arc-contract.md (new, copy of ARC-flyer-reader-contract.md). For each row R1-R20 write PASS / FAIL / NOT VERIFIABLE FROM CODE with the file:line or test name. Findings that were parked earlier (D3, D4, D6, D8) are re-listed with a severity. Verify every "missing" claim with git grep on origin/main before writing it. Do not edit code. End with: ready-to-turn-on yes/no and the exact blockers. Push once; last commit subject ends with the worker-done marker.
