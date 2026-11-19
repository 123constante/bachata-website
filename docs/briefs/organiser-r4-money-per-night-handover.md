# Handover: organiser R4 slice (b), money per night

Branch `feat/organiser-r4-money-per-night`. Brief: `docs/briefs/organiser-r4-money-per-night.md` (branch `brief/feat/organiser-r4-money-per-night`). Flag `organiserR4` stays off; money reads also need `organiserTicketing`.

## Done
- `src/modules/organiser/p3/r4/r4MoneyModel.ts`: parse `ticket_sales_by_night_v1` (prod shape read from pg_proc: nights carry `occurrence_id`, `occurrence_date`; `ok:false` with `not_authorised` / `wrong_night` = no money view, drawn as nothing; anything else throws = read error with retry). `moneyTileOf` (net as the main number, "Money in"), `moneyQuietOf` (refunds, full refunds, disputes, booking fees kept apart), `gbp` (writes 0 as GBP 0, never "Free").
- `r4MoneyApi.ts`: the untyped RPC call (types.ts not touched). One query per event, key `['r4-night-money', user, series]`, shared by the three screens.
- R4Night: money tile for the next night (matched by date), quiet line, error + Try again.
- R4Home: money tile for the night in focus (last night by occurrence id after it, else the next night by date), via `r4HomeOf({ money })`.
- R4Compare: the board's People / Money switch (44px), Money ranks past nights by net; truncated and no_night pool named in the foot line, never added to a night. Switch hidden for a seat with no money view.
- Matrix tests: `__tests__/r4Money.matrix.test.ts` (no sales, paid, part refund, full refund, disputed only, fees, truncated, no_night pool, read error / refused, occurrence vs date). Walk: `tests/e2e/walk-r4-money.spec.ts` (manual list).

## Left / next steps
- Owner phone test with the flag on against a real ticketed event (prod has 2 paid orders on 3 ticketed series, so most real nights show no tile).
- Booking fees never seen in prod yet (0 orders with a fee): the quiet line for fees is fixture-only.

## Status
- PR #1803. tsc run on the final head: 0 errors in branch files (139 total = origin/main).
- Not verified: signed-in prod walk, 360x640, real phone, Vercel preview (needs owner: Vercel token).
