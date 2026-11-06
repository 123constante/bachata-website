# Brief: walk pictures pinned to a head and void after any push
Brief-version: 2
Branch: claude/walk-pictures-pinned-to-head
Lane: careful, Opus. 123constante/bachata-website, new scripts/lib/walk-pictures-pin.mjs, its test and one TARGETS line in scripts/prove-entry-point-dispatch.mjs only; no .github/**, no workflow, no package.json, no src/**; nothing is armed or run.
Serves: the owner and lead (a walk picture set from an older commit can never count for a newer head).

## What main lacks
- Contract 11 item 3 needs walk pictures pinned to the head they were taken at and invalidated by a push; the judge only checks each picture's sha256 shape, not that the set belongs to the live head -- grep: pinPictureSet
- No check that every picture a verdict cites is in the pinned set with the same sha256 -- grep: picturesMatchVerdict

## Files
scripts/lib/walk-pictures-pin.mjs (new)
tests/walkPicturesPin.test.ts (new)
scripts/prove-entry-point-dispatch.mjs
scripts/lib/walk-judge.mjs

## What to build
1. `pinPictureSet(headSha, pictures)` returns a frozen record `{ headSha, pictures: [{ path, sha256 }], count }`; throws on a non-40-hex head, an empty list, a duplicate path or a malformed sha256.
2. `pictureSetValid(record, liveHeadSha)` returns `{ valid, reasons[] }`; any head other than the pinned one is invalid (reason names both heads); never throws.
3. `picturesMatchVerdict(record, input)` is true only when every picture the judge input lists is in the pinned set with an equal sha256 and none is missing.
4. A CLI `--record <file> --head <sha>`: exit 0 valid, 1 invalid or unreadable, 2 usage; register in TARGETS in scripts/prove-entry-point-dispatch.mjs.

## Tests
Table-driven, red first: head (same, one hex char different, short, missing) x pictures (matching, one changed sha256, one missing, one extra, duplicate path, empty). Mutants: compare only the first 7 characters of the head; ignore a changed sha256. Each must turn the suite red.

## Done when
Tests green; entry-point coverage passes; check-script-conventions passes unchanged. PR body carries Verified / Not verified (Not verified: no workflow calls it yet, Part C/E).
