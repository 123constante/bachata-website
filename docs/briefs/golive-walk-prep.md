# Brief: ticketing go-live walk prep (read-only, docs only)
Brief-version: 1. Lane: normal (docs only). Model: sonnet. Branch: claude/ticket-golive-walk-prep. Repo: Website (123constante/bachata-website).

Read ~/.claude plans are NOT available to you; everything you need is in the repo and the committed docs. Read docs/ and briefs mentioning ticketing, `src/modules/tickets/`, `src/modules/organiser/tickets/`, and any docs/review/ticketing-*.md.

Deliver ONE docs file: `docs/ticketing/golive-walk-checklist.md` containing:
1. A numbered walk the owner can do on a phone at 390x844 on a private Vercel preview with `publicTicketing` and `organiserTicketing` ON and the live site OFF: organiser sets up a ticket type, buyer checks out with a Stripe test card, promo code path, thank-you page and My tickets, door scan, refund. For each step: the screen, the exact thing to tap, what they should see, and what a failure looks like.
2. Every state each screen can be in (no ticket types, sold out, on sale paused, free event, promo expired, payment failed, webhook late), with the copy that must show.
3. A table of what is verified by code/tests today versus Not verified (needs the Stripe sandbox or a real phone). Derive it from the repo tests, do not invent.
No source changes, no tests, no workflow edits, no secrets, no Stripe calls.

Done: one push, docs-only PR, final commit subject ends with the worker-done marker from the dispatch prompt.
