# Handover: free row picker (PR #1809, branch claude/free-row)

Done: summary lines for free + paid, free-only button/hand-off copy, model helpers + tests. Server check: mixed free+paid IS supported by ticket-checkout (unit 0 lines allowed; total 0 skips Stripe), so no mixing block.

Left / next: 390x844 walk on prod-shaped data (one free + one paid night; free-only night); `npm run lint`, `npm run pre-ship`; production shape survey; PR body Phone QA block is still "not verified"; Vercel preview URL not added.

tsc run on 8d3b8f0 (code commit): 0 errors in branch files.

## Continuation run (dt_2765694989aa)
Done: `npm run lint` (35/36 green; check:no-social-word red on 3 "Social" fixture strings in ticketCardFallback.test.tsx and priceSteps.matrix.test.tsx, untouched by this PR, red on main too); production shape survey (6 on-sale nights, 2 mixed free+paid, 0 free-only, 3 free types of 23); PR body filled, both body checks exit 0.
Left: `npm run pre-ship` (timed out at 10 min in the worker); 390x844 walk on the Vercel preview (mixed night + free-only; no free-only night exists in prod, so use a fixture/test event); screenshots in PR; decide who fixes the Social fixtures.
tsc run on 105970e: 0 errors in branch files (unchanged since).

## Continuation 3 (dt_1a315b1b02de)
Done: `npm run pre-ship` run to the end on f2c8093 (code unchanged since 105970e). Reds: check:no-social-word (known, red on main), test:unit (cacheTags, eventViewCompat.contract, integrityCouldNotRun: none touch tickets; sandbox-shaped, not re-run on main), typecheck ratchet 139 vs 106 (the one error in a branch file, TicketPickerB1.tsx:158 `PromoState.key`, is on a line this PR did not change; the rest are in untouched files). Nothing fixed: out of scope.
390x844 walk: the flag is a build-time env and previews are walled, so I walked a local vite dev server with VITE_ENABLE_TICKET_PICKER_B1=true and the ticket RPC stubbed (temporary route, removed). Screenshots: docs/briefs/free-row-walk/. Mixed night (GBP10 + Free): both rows, per-line summary, total GBP10. Free-only night (two free types): summary lines both Free, total Free.
Not seen: the free-only Continue/"Get my free tickets" button text (needs a signed-in user and the prod origin; button is disabled on localhost), and the real Vercel preview.
Left: owner decision on the pre-existing reds.
