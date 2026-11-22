# Slice 17c handover (cleanup, un-fixme X-09)

Branch claude/editor-v2-s1c. Flag organiserEditorV2 OFF. No migrations, no PR (per brief).

## Tap table (button | destination | prototype/OLD)
| button | destination | built |
|---|---|---|
| Every card Price fact | "£10 / Pay at the door" when no link and a door price; link and priced series unchanged | prototype (same rule as night card) |

## Done
- tsc: 0 errors on this branch head (the eventPage.proto.test.ts error named in the brief did not reproduce, so that file is untouched).
- V2Sheet.tsx: ref update moved into an effect (react-hooks/refs error gone), no behaviour change.
- EveryBody.tsx passes doorPrice to priceLabel (EveryBody.tsx ~87).
- e2e X-09 door row: fixme removed. 83.1 fixme untouched (UNBUILT).
- New slice17c.test.tsx pins the Every-card label rule.

## UNBUILT
- End Undo (83.1) as in 17b.

## Verified / Not verified
Verified: `npx vitest run src/modules/organiser/p3/v2` 368 pass; tsc 0 errors; eslint 0 errors on v2; check:mojibake clean.
Not verified: the X-09 e2e row was NOT run (no Playwright run here); slice17c test mirrors the rule rather than rendering EveryBody; 390x844 walk; real-data survey; CI jobs; tsc run on branch head before the final commit.
