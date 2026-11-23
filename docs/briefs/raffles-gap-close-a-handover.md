# Handover: raffles gap-close A

Done: every checklist line built in RaffleRedesignA.tsx/.css and raffleBoard.ts (winners "This week's winners", trophy discs not links, "Maya R." names, footer Rules+Contact+one-liner, glow ring, entered bar with tick, count-up orbs). Parser accepts winners with only first_name (profile_slug / last_initial optional). Tests: raffleBoard.test.ts (+1), new components/raffles/__tests__/RaffleRedesignA.test.tsx.
Left: browser walk at 390x844 (not done).
Notice, not changed: sticky-bar not-entered subline "One phone number" differs from prototype "One number, every night" (brief says leave).

## TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| Winner discs | none (not tappable) | prototype |
| Rules | /terms | prototype (brief) |
| Contact | mailto | prototype |
| Enter the raffle (bar) | entry dialog | prototype |
| Carousel enter / arrows | unchanged part B1 | unchanged |
| Reset | removed | prototype |
