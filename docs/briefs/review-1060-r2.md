# Brief: independent review round 2 of Website PR #1060 (organiser ticketing screens, design B)

Repo: 123constante/bachata-website. Review branch `claude/ticketing-organiser-ui` at head 5dd9e40 (the fix round). Read-only review: do NOT edit that branch.

## Context
- S3 organiser screens behind flag `organiserTicketing` (off). Design B (compact). Earlier critique: PR #1067 (docs/review on `claude/ticketing-organiser-ui-critique`). The fix worker (dt_1ddc6e8c89ca) answered it in 5dd9e40. Fixes to findings are unreviewed code: that is what you review.
- Owner rule: a bug the owner finds on a phone that this list would have caught is a process failure. Real data: prod has 0 ticket rows, so shapes come from fixtures (`screens.matrix.test.tsx`, 12 shapes).

## Do
1. Read the #1067 critique findings; for each, confirm in code at 5dd9e40 that it is fixed (cite file:line) or still open.
2. Look for NEW defects the fixes introduced: money display (pence to pounds, commas, free vs paid, booking fee 50p), refund sheet (full vs partial, who can refund), stale cache after save, disabled controls with a reason, empty states that say what the person CAN do, copy that points at a control that is not on screen, flag-off = zero visible change, route guards (owner/manager only), double-submit.
3. Check the tests are table-driven across every screen x shape and would fail on the unfixed code (mutate one fix away and confirm a test goes red).
4. Run nothing against prod (Supabase read-only if needed).

## Output
Write `docs/review/ticketing-organiser-ui-1060-r2.md` on new branch `claude/review-1060-r2`: verdict (PASS / PASS with should-fix / BLOCK), per-finding table (fixed / open / new), each new finding with a failing scenario. Push and stop. Do not merge, approve or edit PR #1060.
