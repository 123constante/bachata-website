# Continuation 1: organiser Tickets option A (branch feat/organiser-tickets-a, PR #1734)

Read first: docs/briefs/organiser-tickets-option-a.md (full brief + boards) and docs/briefs/organiser-tickets-option-a-handover.md on the branch. Continue on the SAME branch and PR. Do not rewrite what exists.

## What is left (from the handover)
1. Exit bar: under flag `organiserTicketsA`, "Back to bachatacalendar.co.uk" as a separate 44px white bar ABOVE the 48px header (12px 500 #464646, chevron), on every organiser screen the V2 shell frames. Flag off = unchanged.
2. A6: "Open now" control beside the "opens by itself" sentence (wire to existing ticket status RPC if one fits, else a disabled stub in the Coming-soon list). A4 Money sheet: payout copy as board (placeholder date NOT shown as fact: use "Coming soon" for payout date/amount).
3. Match board spacing: A1-A3 must fit 390x844 with no scroll (44 bar + 48 header + 64 tab bar). Check A1/A2/A3 against the board HTML in the brief.
4. CHECK: run the app with flag on, walk 390x844 on prod-shaped data (read-only counts), put screenshots in the PR, fix in the same PR. Run npm run pre-ship, lint, test:unit, check:mojibake.
5. PR body: use the exact "## Verified on real data" and "## Phone QA" labels (see worker prompt), list every stub, then run both body checkers.
