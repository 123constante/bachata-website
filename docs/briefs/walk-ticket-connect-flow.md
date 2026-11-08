# Brief: Audit the ticket-setup to Stripe-connected flow (report only)
Brief-version: 2
Branch: claude/walk-ticket-connect-flow
Lane: normal, Sonnet. bachata-website, READ-ONLY audit: change no source file, test or migration; the only new file is the report.
Serves: an organiser who sets up tickets and should land on "payments connected, tickets on sale" without help (owner priority 2026-11-08: selling through us is the obvious default; an external ticket link stays possible but is never promoted).

## What main lacks
- A written, evidence-backed gap list for the whole path (Add a ticket price, Connect payments, Stripe return, Put on sale, then the ticket link field in the event editor) -- grep: docs/walk/ticket-connect-flow/RESULTS.md

## Files
docs/walk/ticket-connect-flow/RESULTS.md (new)
src/modules/organiser/events/EditorSheet.tsx (read only)
docs/arcs/organiser.md (read only)

## What to build
0. Write INVENTORY.md first: every field, state and option on this path from the admin app (read-only: do not clone it; quote what the Website reads from its RPCs), the current Website, and the public event page (the buy button and the external ticket link), each with file:line. Build only after it exists and report the coverage count (covered / total) at the end. Put it at docs/walk/ticket-connect-flow/INVENTORY.md (new).
1. Trace the path by reading code on origin/main: the Add a ticket sheet (merged #1481, inline Connect payments), the Get paid screen (#1478, #1479), the Stripe return banner and Put on sale (#1484), and where an organiser can paste an external ticket link (EditorSheet.tsx, default_ticket_url). For each step record: what the organiser sees, what happens on tap, every dead end, every state that has no next action, every place the external link is shown or offered, and any copy that points at a missing control.
2. Rank the gaps (blocker, should fix, nice) against the goal "connecting Stripe is the obvious default, the external link is a small plain text link below the Connect button and never promoted". Say which gaps are copy only, which need a screen change, and which need a database or RPC change (those go to the admin repo: name the RPC).
3. Propose at most 4 follow-up slices, each with: branch name claude/<slug>, one-line goal, files, lane, model. Do not write the briefs.
4. Walk table: for each of these states say what the screen does today and cite file:line: no Stripe account yet; Stripe started but not finished; Stripe connected but charges not enabled; connected and enabled; event with ticket link only; event with both.

## Tests
None (report only). Done = the report plus INVENTORY exist, every claim cites file:line on origin/main, no claim is from memory.

## Done when
The report is pushed on claude/walk-ticket-connect-flow, last commit ends [worker-done <ticket>], and the handover has a Verified / Not verified block (Not verified: no signed-in browser walk, no prod data).
