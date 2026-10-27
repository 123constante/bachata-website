# Brief: independent review of S4 buyer checkout (PR #1063, branch claude/ticketing-checkout)

You are a reviewer, not the builder. Do not edit the builder's branch. Push ONLY your own review branch with one file `docs/review/ticketing-checkout-1063.md`, ending your commit subject with the done marker.

Read: docs/handover/ticketing-checkout.md, docs/ticketing-buyer-journey.md, src/modules/tickets/**, the BentoPage/route wiring diff (`git diff origin/main...origin/claude/ticketing-checkout`). The deployed `ticket-checkout` contract is in the handover; do not call it.

Review for, in this order:
1. Money and trust: totals shown equal what the server charges (price + 50p per paid ticket, free = no fee); quantity cap 1..20 and remaining; no price taken from the client; success/cancel URLs only on bachatacalendar.co.uk origins; no secret or PII logged; email/name never in a URL.
2. Redirect round trip: sessionStorage hand-off of the order id, thank-you page with missing/garbled `?o=`, back button / bfcache, cancel return, double-click on Buy, slow network, 401 retry as guest, offline.
3. Flag OFF means nothing renders and no route is mounted (including the lazy import).
4. Shape coverage: event series states (live, ended, paused, cancelled, past night, weekly series with per-night types), 0 ticket types, sold out, not yet open, closed, free, paid, mixed.
5. Mobile at 390x844: taps >= 44px (explicit px, html font-size is ~13.5px), no sideways scroll, focus order, labels, disabled-with-reason, empty/error states that say what the buyer can do.
6. Legal copy in legalCopy.ts is clearly DRAFT and not shown to real users while the flag is off.
7. Round-2 fixes (commit 71019a0) were never reviewed: read them closely.

Output: ordered list of findings, each with file:line, severity (blocking / should-fix / nit), the concrete failing scenario, and the fix. Say plainly if there are none. Be specific; no general advice.
