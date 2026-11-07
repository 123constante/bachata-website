# Brief: refresh the stale ticketing go-live walk checklist

Brief-version: 2

Repo 123constante/bachata-website. Branch `claude/ticket-golive-checklist-refresh`. NORMAL lane, Sonnet, DOCS ONLY (no src, no tests, no workflow).

## What main lacks
- docs/ticketing/golive-walk-checklist.md section 0 item 1 says promo codes are not in the Website, but they are built -- grep: promo-codes-built-2026-11
- Section 0 item 2 says there is no "My tickets" screen, but it exists -- grep: my-tickets-built-2026-11
- The door steps (D2) say no QR image exists and tell the walker to paste a 64-char code, but the buyer now has a short code and an emailed QR; DoorScreen reads short codes -- grep: short-code-door-step-2026-11
- No step covers the organiser sales report card or the partial refund option -- grep: sales-report-walk-step-2026-11
- The fee wording and verification table still treat the 50p fee as open; fee is 0 on main and in orders since 11-05 -- grep: fee-zero-confirmed-2026-11
- The flags section predates the go-live flag detail; docs/scoping/go-live-flags-checklist.md holds it and must be linked, not copied -- grep: flags-link-go-live-flags-checklist

## Files
- extends: docs/ticketing/golive-walk-checklist.md
- extends: docs/arcs/ticketing.md (only the lines that still list the sales report and the partial refund as in flight; re-read first and change nothing else)

## Build
- Re-read origin/main first. Every changed claim cites its source file or PR in the row, as the file already does.
- Section 0: replace items 1 and 2 with the real state. Promo codes: built (admin A#1125, Website #1366/#1372/#1387). My tickets: built (#1334/#1359). Keep item 3 (preview origin) and item 5 (test mode).
- Fee (item 6): fee is 0 in code and in the newest orders; the edge secret TICKET_BOOKING_FEE_PENCE must be confirmed as 0 explicitly. State "value not read from the repo".
- Flags: list the four with their Vercel env names from src/lib/featureFlags.ts (organiserTicketing, organiserP3, organiserSelfServe, publicTicketing), say which routes need which (door needs organiserTicketing + organiserP3 + organiserSelfServe), and link docs/scoping/go-live-flags-checklist.md. Do not state live values; say "read the Production env, not verified here".
- Edge functions: add a row "ticket-checkout, ticket-email, stripe-webhook, ticket-refund, stripe-connect-onboard: the deployed version must equal admin main; compare the Supabase function list with admin git log for supabase/functions". Say the walk must not start on a stale stripe-webhook (partial refunds depend on it).
- New walk steps with Screen / Tap / Should see / Failure looks like, read from the code, not invented: E promo code (field on the buyer block, bad and good code); F My tickets and the QR; G short code (buyer sees it in the email and on My tickets, door accepts it typed); H organiser sales report card and guest list CSV; I partial refund (RefundSheet amount option; ticket stays valid, place count unchanged) then full refund (ticket NOT VALID, place reopens); J real-phone door scan, iOS Safari and Android, marked OWNER-ONLY and NOT VERIFIED.
- Verified/Not verified table (section 3): replace the two "Nothing: not built" rows with the real test files (find them with git ls-tree and grep, name only files that exist) and keep every "Not verified" that still holds.
- Add a short "Before live" list at the end: remove the TICKET_PREVIEW_ORIGIN secret, clean test orders and test Stripe rows (owner names the delete), live Stripe keys and webhooks are owner-only. No secret values.
- Plain ASCII in .md (no smart quotes); keep the file's existing table style.

## Tests (table-driven, red first)
Docs only, so no new tests. Checks to run and report:
| check | how | expect |
|---|---|---|
| every path or test file named exists on the branch | git ls-tree for each named path | all found |
| stale claims gone | grep the checklist | no "NOT built", no "no My tickets", no open 50p wording |
| lint chain | npm run lint | no new red versus main |
| docs only | git diff --stat | only the two docs |

## Hard limits
- Docs only: max 2 files. No src, no supabase/, no workflow, no .env. No Stripe or prod calls, no secret values, no flag values claimed as read.
- Never merge or approve; never `--no-verify`; bot-authored PR; plain git, no `gh api`; no shell variables or loops. One push only (Vercel cap). Supabase read-only.
- PR body: "## Verified on real data" with an honest Not verified (live flags, deployed function bytes, real phone).
- Early checkpoint push, then push once. Stop at 40% context with a PARTIAL marker. Final commit subject ends [worker-done ticket-golive-checklist-refresh].
