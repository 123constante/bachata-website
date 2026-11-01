# Brief: ticketing go-live READINESS AUDIT (read-only, docs only)

Repo bachata-website, branch claude/ticket-readiness-audit, lane normal, Opus. DOCS ONLY: one file `docs/review/ticket-readiness-audit.md`. No code, no flags, no env, no prod write, Supabase read-only.

Context: plans/ARC-ticketing.md (owner machine; if you cannot read it, use this brief). Stripe TEST is proven end to end. Fee removed on the Website (#1135). Old ticket screens retired (#1165). Owner wants to start the live Stripe steps soon and run ticketing in parallel with other work. Open admin PRs (repo 123constante/bachata-admin): #1131 email QR, #1132 door short code + check-in RPCs, #1134 my_tickets_v1, #1106 Stripe Accounts v2, #1068 launch plan, #1081 S1c review. Website: #1067 critique of #1060 open.

## Produce (every claim cites a file:line, PR number, or a read-only prod query result)
1. STATE TABLE: for each of #1131, #1132, #1134, #1106: head sha, mergeable state, checks (red/green, red also on main?), reviews on file (docs/review/*) and their verdict, migration present (version still placeholder 99990101000000?), applied on prod or not (read `supabase_migrations` ledger + `pg_proc` read-only), blocking items.
2. PROD READS (counts/names only, no personal data): ticket tables row counts; stripe accounts charges_enabled; ticket types on sale vs paused; flags organiserTicketing / publicTicketing state in the Website (find where they are read, and the Vercel env names, but DO NOT read secrets); list Supabase edge-function names + versions via the read-only MCP; whether secret NAMES `TICKET_BOOKING_FEE_PENCE`, `TICKET_PREVIEW_ORIGIN`, `STRIPE_WEBHOOK_SECRET_THIN` exist (names only, never values; use list tools if available, otherwise say "not verifiable").
3. GO-LIVE CHECKLIST (S6) as NUMBERED STEPS, each marked OWNER-ONLY (Stripe dashboard, live keys, Vercel env) or CLAUDE-CAN-DO, with the exact WHERE and what the person should see. Include: remove preview-origin secret, fee secret = 0 and DEFAULT in admin code, live webhook endpoint + thin destination, live secrets, flags, first real 100p purchase and refund, rollback for each step.
4. ORDERED BUILD QUEUE for remaining ticketing work (door scanner organiser screen, my-tickets buyer screen, promo codes, dispute/async webhook events, the /expire header-equality test) with lane, model, which admin PR each waits on, and what can run in parallel safely.
5. A "Not verified" list. End with the coverage count: N checklist items, N with evidence.

PR body lines `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:`, section `## Phone QA` (write "n/a docs only"). Push once, handover not needed (the doc is the handover).
