# Brief: fix the 8 should-fix items from the independent review of the buyer checkout (S4)

Branch: `claude/ticketing-checkout-fixes` (new, from current Website `main`). Normal lane, Website only, no DB, no edge function change. Flag `publicTicketing` stays OFF; this PR must not change any flag default.

Source of truth: `docs/review/ticketing-checkout-1063.md` on branch `claude/ticketing-checkout-review` (PR #1065). Read the 8 should-fix items there first; the code is `src/modules/tickets/` (checkout block, thanks page, `legalCopy.ts`, `ticketCheckoutModel.ts`). Merged PR for context: #1063.

## Fix, with a table-driven test for each (red first, then green; prove each guard by mutation)
1. Thank-you page must not claim payment without evidence. Show "paid" wording only when the server confirms the order; otherwise a neutral "checking your order" state with what the person can do.
2. Timeout on the checkout POST (use AbortController, about 20 s). On timeout show a retry state; no double order on retry (keep the existing idempotency behaviour, test it).
3. Wrap the form in a real `<form>` so the keyboard Go/Enter key submits. Submit stays disabled with an attached reason until valid.
4. Preview/origin reason is shown first, not last.
5. Rate-limit copy must be correct after a cancel return.
6. `?o=` must not be trusted verbatim: validate/allowlist before use.
7. Map every server `reason` to copy; an unmapped reason gets a safe generic message (one shared mapping, no per-screen copies).
8. Booking fee: remove the three client-side hard-coded 50p pins; read one shared constant, with a comment that the server value is env `TICKET_BOOKING_FEE_PENCE` (keep it unset, default 50p). Behaviour unchanged.

## Rules
- Definition of Done: shapes covered by the matrix test (free, paid, sold out, capacity left 0/1/many, big numbers 2,022, empty, error, cancel, timeout). Run every CI job step that applies (read `.github/workflows`), put the per-job table in the PR body, and fill the PR body "Verified on real data" and "Phone QA" sections with text on the SAME line as each label (or the checks fail).
- Use HTML entities, no raw Unicode punctuation. Files over 2 KB via `scripts/safe-edit.py` or `scripts/safe-write.py`.
- Do not change legal copy wording, layout beyond what each item needs, or touch edge functions. Do not merge or approve.

## Output
Push `claude/ticketing-checkout-fixes`, last commit subject ending `[worker-done dt_<ticket>]`; report head SHA, red-first output, mutation results, per-job table, Verified / Not verified.
