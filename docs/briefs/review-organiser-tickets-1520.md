# Independent review: Website PR #1520 (organiser tickets, slice 2 Part A)

Brief-version: 1
Repo: Website (123constante/bachata-website). PR #1520, branch claude/organiser-area-v2-tickets, head 7debc56. Reviewer: Fable, READ-ONLY. Do not edit, push, comment on the PR, merge or approve; return findings to the lead as text. Lane: careful (money display, permissions). Review a fixed head: run `gh pr view 1520 --json headRefOid` first; if it is not 7debc56, say so and review the new head.

## Why
Part A makes money and refund owner-only in the client and gives managers counts. It is only honest if it matches what the server does. Part B (admin brief `ticket-owner-only-money-partb`, branch claude/ticket-owner-only-money-partb) closes the server side. Until Part B ships, a manager can still refund through `ticket-refund` and read pence by RPC/RLS (INVENTORY.md section 1 on the PR branch). Judge the client against the Part B target and name the gap.

## Read first
`git show origin/claude/organiser-area-v2-tickets:INVENTORY.md`, the PR body, `docs/briefs/organiser-area-v2-slice2-tickets.md` (branch brief/organiser-area-v2-tickets), then the diff vs main.

## Checks (PASS / FAIL / NOT VERIFIED each, with file:line)
1. **Split matches server reality.** Every owner-only gate (`TicketsEntry.tsx` refund `owner &&`, `GetPaid.tsx` `canGo`, MoneySoFar, the refund sheet) against the Part B target: owner full, manager counts only. State what a manager gets from the server TODAY at each spot and confirm the client never requests what Part B will remove.
2. **Role x shape table.** Roles: owner, manager, legacy contributor, platform admin, buyer-only/anon. Shapes: no ticket types; all paused; on_sale; sold out; paid order; partly refunded; fully refunded; expired; 100+ orders (API cap); payouts not connected; payouts connected. For each row say what renders and whether it is right; cite or demand a test per row.
3. **Copy never points at a missing control.** Every "Ask the owner ..." line (`tix-refund-ask-owner`, `NOT_MANAGER_REFUND`, `PAYOUTS_ASK_OWNER`, `NOT_OWNER_REFUND`) appears only where the owner really has that control; disabled controls say why; empty states say what to do. `not_allowed` maps to the owner copy (`ticketModel.ts:662`) and is in `DEFINITE_REFUND_REASONS`; confirm the old `not_authorised` (what the server sends today) still maps sensibly.
4. **No pence requested for managers (network shape).** Trace each fetch for a manager session: does it call `ticket_sales_summary_v1` or select `ticket_orders` money columns, `buyer_email`, `buyer_name`? Counts must come from a count-only source. If the client still requests money and only hides it, that is a FAIL on network shape (the data is in the response); name the call. Check react-query cache keys and any log leak.
5. **Going count RPC.** Which RPC supplies the Going count, its argument, gate and shape (prod had 7 event_attendance rows); does a manager get it; empty and huge cases.
6. **External-link line.** The line for events that sell through an external `ticket_url` (columns live on `event_series_p5` and `event_occurrence_override_p5`, not `event_series`): right source column, no dead link, right copy when no URL.
7. **Flag off = no change.** With the organiser-area-v2 flag off, confirm old behaviour in the touched files; list any change that leaks outside the flag.
8. **Rules.** No raw Unicode punctuation in JSX (use entities), full weekday names, explicit px tap targets >= 44, no sideways scroll at 390x844 (by reading CSS), no density change to the calendar files in CLAUDE.md, no `supabase/**`.
9. **Tests and mutants.** Run `npm run test:unit` for the touched specs (one job; laptop-safe.mjs if on the PC). Then 4 mutants in a scratch worktree (`C:/dev/fast-review-1520`; remove any node_modules junction with PowerShell and confirm `Test-Path` False before `git worktree remove`): (a) change `owner &&` to `manager &&` on the refund button; (b) show the money block to a manager; (c) remove the `not_allowed` mapping; (d) drop the Ask-the-owner line. Each must turn a test red; a mutant that stays green is a finding. Report the table; delete the worktree.
10. **Could not verify.** List plainly: no 390x844 walk, no signed-in manager session on prod, no real Stripe refund, Part B not built so server behaviour comes from INVENTORY.md reads only, any CI job you did not run.

## Output
Ordered findings (blocker / should-fix / note), each with file:line and a one-line fix; then the role x shape table; the mutant table; Verified / Not verified. End with one line: SHIP, SHIP-AFTER-FIXES, or HOLD. Say explicitly whether the PR may merge before Part B and what a manager can still do in the gap.

## Limits
Read-only on the repo, prod and GitHub. Prod reads only to recheck a fact (project stsdtacfauprzrdebmzg, SELECT counts, no personal data, never a write).
