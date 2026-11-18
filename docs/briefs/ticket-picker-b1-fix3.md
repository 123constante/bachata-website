# Brief: ticket picker B1 matches the picked prototype exactly (fix 3)
Class: BUILD-visual. Flag `ticketPickerB1` (already ON in prod). One branch, one PR, small. Website only, zero migrations.
Owner words 2026-11-18 (phone screenshot of the live picker): "It needs to look exactly like the prototype." Prototype = PICKED B1 v4, artifact https://claude.ai/artifact/DKY4qjDFkGPsBdKLtcNpfD (design registry row "Ticket picker page"). Never read the artifact HTML whole (large): grep it by class name, or read the diff list below.

## Owner decisions (click answers 2026-11-18, binding)
- Header: the site header must not show over the picker.
- Terms tick box and the "Tickets go to ... Not you?" line MOVE OUT of the bottom bar INTO the centred email card (shown after Continue). The bar is then exactly: total row, Continue, trust line. Continue on the bar stays disabled until a ticket is chosen; the terms box gates "Continue to Stripe" in the email card instead. Keep the terms/legal behaviour and its tests working (move them, do not drop them).
- Stepper buttons exactly 36x36 (prototype value), accepted despite the 44px tap rule. Use explicit px.
- Skip the grey description line under the ticket name (no data). Skip "for the night" / "party free" sub-lines (no data). Keep the existing green "a class" line.

## Changes (all in `src/modules/tickets/TicketPickerB1.tsx` unless stated; line numbers at origin/main)
1. Header over picker: picker is `fixed inset-0 z-50` (T:301); `GlobalHeader.tsx:107` is `fixed top-0 z-[60]`. Raise the picker above it (check FocusHeader z-60 and the sticky tabs row stay below) OR hide the header while open. Verify at 390x844 that nothing of the site header shows.
2. Last row cut off by the bar: bar was ~230px, prototype ~128px. After moving terms out the bar shrinks; also give the scroll area (T:306) at least 24px bottom padding. Verify the last row's stepper is fully visible when scrolled to the end.
3. Nav row: add "Step 1 of 2" on the right of the Back row (prototype padding 14/18/6, sub colour).
4. Fonts: prototype uses Space Grotesk (headings, names, prices, buttons) + Inter (body). Use them only if the site already ships them; otherwise do NOT add a new font load, and say so in the PR.
5. Sizes to the prototype: header title 17px/600 (opening screen 18px/600); date/venue 13px; venue shows NAME only (no address; BentoPage.tsx:808 joins name + address: pass name only for the picker); ticket name 14px/600; per-class line 12px brand, mt 4; price 16px/600 lh 1.2; stepper count width 26, 14px/600; promo label 12px/600 mb 6; promo button 13px/600 px16; promo message 12px; bar total 16px/600, struck old total 13px; keep the promo input at 16px (stops iOS zoom).
6. Applied-code stub: build it as the prototype: filled stub bg #e8f3ee, radius 12, notched circles at the tear, vertical 2px dashed #b7d6c9 divider; left = code (15px/700, letter-spacing .08em) + a "10% off your tickets" style line (12px; show the real discount description only if the validation result already carries it, else omit); right 92px column = "-GBP amount" 18px/700 + "Remove" 12px underline; unfold animation .38s. Hide the promo label while applied. "Checking..." state per registry row. Old total crossed out with the 0.45s roll animation (respect prefers-reduced-motion).
7. Email card: summary row "N tickets · CODE" + total (code only when applied); card text 13px, error 12px, "Back to tickets" 13px min-h 40 (owner explicit px rule: keep tap area >= 40).
8. Do not touch the classic (flag-off) page.

## Checks
`npm run test:unit` for src/modules/tickets; `npm run pre-ship`. 390x844 walk (recipe: memory reference_account_link_walk_recipe.md; use `--env VITE_ENABLE_TICKET_PICKER_B1=true --env VITE_ENABLE_TICKET_PRICE_STEPS=true --env VITE_ENABLE_PUBLIC_TICKETING=true --env VITE_ENABLE_BUYER_ONBOARDING=true`, path `/event/c530d694-6e43-40aa-b4c4-d9b7462b2ce1?walkSteps=click.Buy-tickets~shot~shot~shot`; a fresh session file per walk): screenshots of picker top, scrolled end, one ticket chosen, applied promo if reachable, email card. Put the screenshots in the PR. Compare each against the prototype screen, not against memory.
