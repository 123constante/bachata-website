# Brief: slice 2 Tickets, CONTINUATION 1 (finish Part A client)
Brief-version: 2
Lane: careful. Model: opus. Branch: claude/organiser-area-v2-tickets (PR #1520, PARTIAL at cb55d3ea).

## Why
Part A first task (Outcome B: refund and money owner-only, sales counts for managers, first name plus code) is committed. The original brief docs/briefs/organiser-area-v2-slice2-tickets.md (git show origin/brief/organiser-area-v2-tickets:docs/briefs/organiser-area-v2-slice2-tickets.md) is the contract; read it and the branch commit message. Left per the worker: the going count, the external-link line, walks, Part B.

## What main lacks
- The organiser-side going count on the Tickets screen -- grep:goingCount in src/modules/organiser/p3/tickets/
- The external-link line (tickets sold elsewhere) on the Tickets screen -- grep:externalTicket in src/modules/organiser/p3/tickets/
- A filled PR body (Shapes surveyed, Checks run, NOT verified, Phone QA sizes) -- #1520

## Task
Do the going count and external-link line exactly as the original brief says, table-driven tests screen x role (owner, manager, helper) x shape. Keep the refund refusal for managers (owner sign-off needed at merge: state it in the PR body). Walk 390x844 on prod-shaped data via preview-deploy.mjs, screenshots on the PR. Fill the PR body real sections. Part B (admin) is NOT in this brief: list it under Not verified. Push once; do not add run-ci.

## Files
src/modules/organiser/p3/tickets/TicketsEntry.tsx, src/modules/organiser/p3/tickets/SalesReport.tsx, src/modules/organiser/tickets/ticketModel.ts, src/modules/organiser/p3/tickets/__tests__/ (new tests), docs/design/1520.md (new)
