# Brief: S4 review fixes (continuation on claude/ticketing-checkout, PR #1063)

An independent reviewer found no blockers and left findings. Read them: `git fetch origin claude/ticketing-checkout-review` then `git show FETCH_HEAD:docs/review/ticketing-checkout-1063.md`. Also read docs/handover/ticketing-checkout.md.

Fix in this order (Website only, flag stays OFF, no supabase/** or edge-function edits):
- Finding 2: thank-you heading must not claim "Payment received" without an order id (use "Thanks for your order"; keep hedged body).
- Finding 3: AbortSignal.timeout(20_000) on both checkout sends; timeout lands as reason 'network'.
- Finding 4: show the "Checkout only works on bachatacalendar.co.uk" reason BEFORE any field is filled (reorder disabledReason; update screens.matrix test).
- Finding 5: wrap quantity..Buy in a real `<form>` (onSubmit preventDefault, noValidate), Buy type=submit.
- Finding 6 (copy only): rate_limited message gains "If you cancelled a checkout just now, those tickets are held for about 30 minutes."
- Finding 7: `?o=` must match the UUID regex the function uses, otherwise treated as no order (also fold in finding 11 for free=1: only trust it together with a valid order id or leave as is, say which).
- Finding 8: map invalid_quantity and invalid_email as fix_form.
- Nits 9 (clearOrderId when ?tickets=cancelled is read), 10 (pin checkout_url to https://checkout.stripe.com/), 12 (render /privacy as a Link), 17 (useRef double-submit guard).
- Findings 1, 13, 14, 15, 16, 18: do NOT change; list them under "Left to orchestrator" in the handover. (Finding 1 is a DB/config point: the server fee is env-driven, the client pins 50p.)

Every fix gets a red-first test (run the new test against the unfixed code first and say so). Re-run the full tickets suite, `npm run lint`, `npx tsc --noEmit`, and every other CI job step that applies. Keep the PR body labels exactly: `**Shapes surveyed:**`, `**Checks run:**`, `**NOT verified:**`, `**Sizes checked:**`, `**Walked:**`, `**Not verified:**`. Update docs/handover/ticketing-checkout.md and the design record docs/design/1063.md. These fixes are unreviewed code: say so in the handover. Final commit subject ends with your done marker (not [skip preview]).
