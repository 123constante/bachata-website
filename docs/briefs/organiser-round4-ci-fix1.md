# Organiser R4: fix 2 red unit tests on PR #1790 (continuation, same branch claude/organiser-r4)

CI `unit (Europe/London, full)` at b8ca2d154 fails 2 tests in src/modules/organiser/__tests__/consistency.matrix.test.tsx (read it, lines ~200 and ~289). Owner rule: full weekday and month names in UI copy; no raw Unicode punctuation (use \u escapes).

Fix ONLY these, nothing else:
1. "no short weekday or month names anywhere in the module source": p3/r4/R4Tickets.tsx:23 and p3/r4/r4DoorInviteModel.ts:48 use weekday/month 'short'; p3/r4/r4EventsModel.ts:24-25 has DAYS/MONTHS short arrays. Switch to full names ('long', or the module's shared instantDateLabel/full-name helper, e.g. "Friday 23 October"). Update the matrix tests under p3/r4/__tests__ that assert the old short strings. Check the board in docs/design/organiser-round4-md/ for those rows: if a board truly shows a short chip, keep the chip box glyph via ui/londonDate.ts (the test's CHIP_BOX exception) and say so in the handover; the label must be full.
2. "no non-test source ... raw Unicode punctuation": r4NightModel.ts:64-65 (\u2018 \u2019 around Cancelled, didn\u2019t), r4TeamModel.ts:83 (Adding\u2026). Replace with \u escapes.

Then run `npx vitest run src/modules/organiser` and `npx tsc --noEmit -p .`: both green. Push to claude/organiser-r4, handover line, commit subject ends [worker-done <ticket>].
