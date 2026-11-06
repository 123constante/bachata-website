# p3-gate-guard-1 walk RESULTS (390x844, mocked, tests/e2e/walk-p3-gate-guard-1.spec.ts)

13 tests, 13 passed, 0 retries. 26 pictures, every one opened (contact sheets); no error card, no blank picture.
Sweep: no P3 control under 44px on any picture (texts.jsonl `small` is empty everywhere); Details event-name field measured 44px in P1, P3a, P8.
P8 mock made honest: the status read fails ONCE (the sheet's read) and answers after. P8x keeps the old always-failing mock on purpose.

- `P1-details-1-sheet.png` - PASS: "A few details first" over the screen with the typing behind, Continue + Not now; one save sent (refused).
- `P1-details-2-checklist.png` - PASS: Continue went STRAIGHT to the checklist, no "Leave without saving?" (leave sheet count 0); same N as the sheet; "Back to your event" offered.
- `P1-details-3-kept.png` - PASS: back on the screen, "We kept your changes", typing present, still one save sent (nothing replayed).
- `P1-details-back-link-leave-sheet.png` - PASS: with typing (after Not now) this exit still shows "Leave without saving?" listing the change; Keep editing returns to the screen with the typing.
- `P1-details-events-tab-leave-sheet.png` - PASS: with typing (after Not now) this exit still shows "Leave without saving?" listing the change; Keep editing returns to the screen with the typing.
- `P1-details-phone-back-leave-sheet.png` - PASS: with typing (after Not now) this exit still shows "Leave without saving?" listing the change; Keep editing returns to the screen with the typing.
- `P1-prices-1-sheet.png` - PASS: "A few details first" over the screen with the typing behind, Continue + Not now; one save sent (refused).
- `P1-prices-2-checklist.png` - PASS: Continue went STRAIGHT to the checklist, no "Leave without saving?" (leave sheet count 0); same N as the sheet; "Back to your event" offered.
- `P1-prices-3-kept.png` - PASS: back on the screen, "We kept your changes", typing present, still one save sent (nothing replayed).
- `P1-prices-back-link-leave-sheet.png` - PASS: with typing (after Not now) this exit still shows "Leave without saving?" listing the change; Keep editing returns to the screen with the typing.
- `P1-prices-events-tab-leave-sheet.png` - PASS: with typing (after Not now) this exit still shows "Leave without saving?" listing the change; Keep editing returns to the screen with the typing.
- `P1-prices-phone-back-leave-sheet.png` - PASS: with typing (after Not now) this exit still shows "Leave without saving?" listing the change; Keep editing returns to the screen with the typing.
- `P3a-details-1-sheet.png` - PASS: "A few details first" over the screen with the typing behind, Continue + Not now; one save sent (refused).
- `P3a-details-2-checklist.png` - PASS: Continue went STRAIGHT to the checklist, no "Leave without saving?" (leave sheet count 0); same N as the sheet; "Back to your event" offered.
- `P3a-details-3-kept.png` - PASS: back on the screen, "We kept your changes", typing present, still one save sent (nothing replayed).
- `P3a-prices-1-sheet.png` - PASS: "A few details first" over the screen with the typing behind, Continue + Not now; one save sent (refused).
- `P3a-prices-2-checklist.png` - PASS: Continue went STRAIGHT to the checklist, no "Leave without saving?" (leave sheet count 0); same N as the sheet; "Back to your event" offered.
- `P3a-prices-3-kept.png` - PASS: back on the screen, "We kept your changes", typing present, still one save sent (nothing replayed).
- `P8-details-1-sheet.png` - PASS: the first status read failed: "We couldn't load your details. Try again.", no count; Continue still enabled.
- `P8-details-2-checklist.png` - PASS: Continue went STRAIGHT to the checklist, no "Leave without saving?" (leave sheet count 0); same N as the sheet; "Back to your event" offered.
- `P8-details-3-kept.png` - PASS: back on the screen, "We kept your changes", typing present, still one save sent (nothing replayed).
- `P8-prices-1-sheet.png` - PASS: the first status read failed: "We couldn't load your details. Try again.", no count; Continue still enabled.
- `P8-prices-2-checklist.png` - PASS: Continue went STRAIGHT to the checklist, no "Leave without saving?" (leave sheet count 0); same N as the sheet; "Back to your event" offered.
- `P8-prices-3-kept.png` - PASS: back on the screen, "We kept your changes", typing present, still one save sent (nothing replayed).
- `P8x-details-1-sheet.png` - PASS: the sheet says "We couldn't load your details. Try again." with no count; Continue offered.
- `P8x-details-2-checklist-readfail.png` - PASS (as decided, see handover): every status read fails, so the checklist shows its own words "We couldn't load your page. Try again." with Try again; no leave sheet; the typing is in storage (asserted).
