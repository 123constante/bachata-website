# Handover: free row picker (PR #1809, branch claude/free-row)

Done: summary lines for free + paid, free-only button/hand-off copy, model helpers + tests. Server check: mixed free+paid IS supported by ticket-checkout (unit 0 lines allowed; total 0 skips Stripe), so no mixing block.

Left / next: 390x844 walk on prod-shaped data (one free + one paid night; free-only night); `npm run lint`, `npm run pre-ship`; production shape survey; PR body Phone QA block is still "not verified"; Vercel preview URL not added.

tsc run on 8d3b8f0 (code commit): 0 errors in branch files.

## Continuation run (dt_2765694989aa)
Done: `npm run lint` (35/36 green; check:no-social-word red on 3 "Social" fixture strings in ticketCardFallback.test.tsx and priceSteps.matrix.test.tsx, untouched by this PR, red on main too); production shape survey (6 on-sale nights, 2 mixed free+paid, 0 free-only, 3 free types of 23); PR body filled, both body checks exit 0.
Left: `npm run pre-ship` (timed out at 10 min in the worker); 390x844 walk on the Vercel preview (mixed night + free-only; no free-only night exists in prod, so use a fixture/test event); screenshots in PR; decide who fixes the Social fixtures.
tsc run on 105970e: 0 errors in branch files (unchanged since).
