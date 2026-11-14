# Handover: organiser Raffle inside each night (Option B), dt_1bf631ec6d61

Branch `claude/profile-dash-organiser-raffle-build`. Brief: `docs/briefs/profile-dash-organiser-raffle-build.md` (on `brief/profile-dash-organiser-raffle-build`).

## Done
- Night sheet (dash Events tab) gets a Raffle row. Flag `organiserRaffleLive` (`VITE_ENABLE_ORGANISER_RAFFLE_LIVE`, default OFF): off = "Raffle - Coming soon" card with Tell us (support links, never a dead one), no RPC call.
- Flag on: row with chip -> Raffle sheet: 4-step track (Open, Entries, Closed, Winner), status story, facts for a drawn night (entered, winner first name, drawn time), ONE button (Open a raffle / Close the raffle / Message us to cancel), confirmation sheets both ways, failed state "Nothing changed" + Try again, contributor view-only "ask an owner".
- Code in `src/modules/organiser/p3/events/raffle/`: `raffleModel.ts` (parse + every fact), `raffleApi.ts` (the two RPCs, cast locally, generated types untouched), `RaffleParts.tsx`, `RaffleSheet.tsx`.
- Hard stop: the write RPC is named only in `raffleApi.ts`, `setRaffleNight` is called once, from the confirm button; `raffleHardStop.test.ts` pins it. The Website only toggles the per-night switch; the draw stays in admin. No notice wording.
- Tests (mocked RPCs): `raffle.matrix.test.tsx` (10 shapes x row/sheet/button/track, write both ways, failure, retry, lock race, 53-night list), `raffleHardStop.test.ts`. 87/87 in `src/modules/organiser/p3/events`.

## Left / next
- Admin #1576 must be applied to prod, then set the flag in Vercel and re-walk against real data.
- Night is matched to the RPC row by date (the Events list row has no occurrence id); two same-date nights in one series would pick the first non-cancelled.
- "Entries close 7pm" is start minus 2h (default; `raffle_cutoff_rules` has 0 rows).

## Verified
- `npx vitest run src/modules/organiser/p3/events`: 6 files, 87 tests pass. `npm run check:mojibake` clean.
- `tsc -p tsconfig.app.json --noEmit`: 145 errors in the sandbox, 0 in branch files (baseline in pre-ship.mjs is 106; the rest are outside this change, likely missing generated route types).
- eslint on touched files: 3 react-refresh warnings in RaffleParts.tsx; 1 error is pre-existing in eventsModel.test.ts.

## Not verified
- No 390x844 browser walk (not done in this run); no real-data run (RPCs not applied to prod, so none exists); the wider `src/modules/organiser` suite and `pre-ship` were not run; no code-review round; CI not seen.
