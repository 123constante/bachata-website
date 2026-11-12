# Events tab: fix round on the picked option (owner picked Option A)

Docs-only continuation on the existing branch claude/profile-dash-organiser-events-opts (PR 1580). Read your own handover and organiser-events.md first.
Owner picked **Option A**. Keep A as the single design; remove B from the main path (keep B file, mark "not picked" in organiser-events.md). Fake people only. Plain-English why notes.

## Fixes (from the independent critique), do all
1. Pinned "Needs you" card takes too much room. Replace with one pinned line "N things need you" that opens the full list; never more than ~48px pinned.
2. 100+ nights: fold repeating series (4 weekly series x 52 dates). Add a "Group repeating events" switch, default on from ~30 upcoming nights, series row shows "Nov: 3 of 52". Draw it (shot).
3. Bulk cancel silently drops drafts / cancelled / past nights. Show what is skipped and why, or disable Cancel with a reason. Draw the bulk-cancel confirmation (nights listed, total going, what happens if some fail).
4. Cancel for recurring nights: add scope step ("this night" / "this and every one after" / "whole series") and "select this series" in bulk.
5. Drafts: add Delete draft with a confirm sheet.
6. Fix contradictory copy: pick ONE story for a cancelled night (stays on the calendar marked Cancelled) and make cancel sheet, row text and Needs-you text agree.
7. Draft sheet copy must name what is actually missing (date/place), not a fixed line. "Tell us" needs a drawn sent state. Contributor view of Needs you reads "Maria needs to finish this" (view-only), not "Needs you" with a disabled Finish.
8. Add missing shots: bulk-cancel confirmation, cancelled-night sheet, past-night sheet, screen after a cancel. Give the scope sheet visible radio marks.
Re-run your checks (contrast >=4.5, taps >=44px, no sideways scroll, 390x844), update organiser-events-checks.json and the handover. Docs-only: no Phone QA section in the PR body.
