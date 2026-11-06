# Handover: walk pictures pinned to a head (dt_697727d8afb5)

Brief: `brief/walk-pictures-pinned-to-head:docs/briefs/walk-pictures-pinned-to-head.md` (v2).
Branch: `claude/walk-pictures-pinned-to-head`.

## Done
- `scripts/lib/walk-pictures-pin.mjs` (new): `pinPictureSet`, `pictureSetValid`,
  `picturesMatchVerdict`, CLI `--record <file> --head <sha>` (0 valid / 1 invalid
  or unreadable / 2 usage). Pure; full 40-char head compare; never throws except
  `pinPictureSet`, which throws on bad input as the brief asks.
- `picturesMatchVerdict` accepts a picture list or a walk-report-shaped object
  (`{ headSha?, pictures: [{ name|path, sha256 }] }`); a present `headSha` must
  equal the pinned head.
- `tests/walkPicturesPin.test.ts` (new): 37 table-driven cases.
- `scripts/prove-entry-point-dispatch.mjs`: one TARGETS line.
- `scripts/lib/walk-judge.mjs`: read for the report shape, NOT changed (lane is
  new lib + test + one TARGETS line).

## Verified
- Red first: an accept-everything stub turns 34 of 37 red.
- Mutant "compare only first 7 chars of head": 4 red. Mutant "ignore changed
  sha256": 2 red. Restored: 37/37 green.
- `prove:entry-point` full run PASS (77 entry points incl. this one);
  `--coverage-only` PASS; `check-script-conventions` passes, allowlist unchanged;
  `check:mojibake` clean; `tsc --noEmit -p .` 0 errors.

## Not verified / left
- No workflow calls it yet (Part C/E). The judge does not call
  `picturesMatchVerdict` yet; wiring it into `walk-judge.mjs` is a later part.

PR: #1444. CI per job: not read from this session (no gh api); see the PR checks tab.
