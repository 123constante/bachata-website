# Brief: P3 W-T ticketing, PHASE B (build), Website, normal lane

Repo 123constante/bachata-website. Continue on branch `claude/p3-wt-ticketing` (Phase A already pushed: PR #1079, `docs/design/p3-wt-ticketing.md`, `mockups/p3-wt-ticketing/`). First `git fetch origin main` and merge/rebase main into the branch (other arcs keep landing; the branch is behind). Read the Phase A design record and the original brief `docs/briefs/p3-wt-ticketing.md` on `brief/p3-wt-ticketing`.

## Owner picks (clicks 2026-10-27, final)
- **Mockup C, One tall sheet**: the Tickets row on the P3 event page opens ONE full-height sheet: ticket types first, then the latest 2 orders with "See all"; orders view inside the sheet with Back. Build exactly `mockups/p3-wt-ticketing/C-tickets-sheet.html`. (The Phase A doc recommended A; the owner chose C. Do not relitigate. Handle the risk the doc named: stacked sheets, so focus return and Back must be tested: add-ticket sheet and Refund sheet open OVER the tall sheet; closing each returns focus to the control that opened it; Back never closes two layers.)
- Tickets entry on the event page; Get paid prompt on Home; full Get paid screen under You (the You tab is a placeholder today and W4a is building the You hub in parallel on another branch: mount Get paid as a route + a row component and keep the You wiring to ONE small, clearly marked file so the two merge cleanly; note it in the PR).
- P3 tokens only; no second theme file. The two copy changes in the design record are approved.

## Build
1. Prod shape survey first (Supabase MCP read-only, project stsdtacfauprzrdebmzg, counts only, no personal data): orgs with 0/1 Stripe account row, 0/2+ ticket types, paused, orders paid/free/refunded/disputed, past events, list sizes. Put the table in the PR body.
2. Reuse `ticketModel.ts` / `ticketsApi.ts` and their matrix tests unchanged. New P3 screens under `src/modules/organiser/p3/` (or `.../tickets/p3/`), behind `organiserP3` + `organiserTicketing`.
3. Fold in the defects: add-ticket draft survives re-render and refetch (red-first test); the order state tag is always shown and Refund is a separate button.
4. Table-driven consistency matrix, every screen x every surveyed shape; one shared mapping for status wording; empty states say what the person can do; disabled controls say why; untouched save sends nothing; no text pointing at a control that is not on screen.
5. Run every CI job step that applies (read `.github/workflows`), per-job table in the PR body. Lint chain, unit, e2e smoke list.
6. Do NOT delete old `/account/tickets` yet; list what deleting it touches in the handover.
7. You cannot walk it on a phone: leave the walk, the Design Gate stage 5 critique and the Verified / Not verified block to the orchestrator, but list honestly what you did not check. Leave the PR a draft.

## Do not
Touch Supabase, edge functions, migrations, the density-exempt calendar files, or the Stripe/thanks flow.
