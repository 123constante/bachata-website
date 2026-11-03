# Handover &mdash; ticket-door-code-screen r2 (dt_b228bbc13101)

Fix round on PR #1294 from `docs/reviews/1294-r1.md`. Flag `ticketDoorCode` stays OFF.

## Done (red first: 4 new tests failed, then 304/304 door tests pass)
- F3: list `not_allowed` after a list Check in now shows the card, no enabled Check in rows (`notAllowed` passed to `ListTab`). Matrix case added.
- F4: list invalidated on `already_in` too.
- F5: paused banner dropped when the list failed to load.
- F6: `editor` renamed `manager` in matrix ROLES, INVENTORY, handover.
- F7: gated the `tried` reason and the "Checking" label behind `shortCodes`; handover red-first number corrected to 168 failed / 50 passed of 218.
- F1/F2: not mine (F2 red on main).

## Not verified
- Real phone / real RPC; the buyer seeing `short_code` in the ticket email (gating question before flag ON).

## Gates run locally
- Door suite 304/304; `tsc` no error in `p3/door`; `npm run lint` 24 of 24 links green.
- `check:bundle-budget`: NOT run locally (needs a full `npm run build`; no manifest). Edits are inside the lazy door chunk, unbuilt with prod flags. CI `bundle-budget` decides.
