# Brief: raffle pick list Featured + organiser tick, website slice C (Website repo)

Branch: `claude/raffle-pick-featured-web`. UI only, no migration. One PR.
Size: max 5 files, 400 lines.
NEVER run `gh api` (it waits on a permission prompt forever in this repo). Read this brief with
`git fetch origin brief/raffle-pick-featured-web && git show FETCH_HEAD:docs/briefs/raffle-pick-featured-web.md`.

## Why (owner, approved mockup 2026-11-27)
Winners pick a free night from a list. Priority nights must show first with a "Featured" badge. The last screen asks for the tick
"I've never been to any event by <organiser>", and "Anyone can come" nights need no tick at all.

## Data (already LIVE on prod; each night object from the pick-list RPC, built by `_raffle_v2_night_json`)
- `featured` boolean: true only when the admin marked the night Priority, the switch is on, seats are left and the night has not passed.
  The list already arrives featured-first, then soonest. Do NOT re-sort.
- `organiser_name` string | null (collab: names joined with " & ").
- `needs_tick` boolean: false on an "Anyone can come" night when the organiser rule is on.
- `tick_organiser` boolean: coming from DB slice A4 (not live yet). Treat a missing key as false.
Update the night type where the RPC response is typed (find it from `src/modules/raffle-win/pick/PickScreen.tsx`); all four keys optional.

## Changes
1. `src/modules/raffle-win/pick/PickScreen.tsx`: a night with `featured === true` gets a small "Featured" badge (★ Featured) on its card.
   No other change to the list. No place count anywhere on the winner screens (there is none today; keep it so).
2. `src/modules/raffle-win/screens/HonestySheet.tsx`: tick label = `I've never been to any event by {organiser_name}` when
   `tick_organiser === true` and `organiser_name` is set; otherwise today's `I have never been to this event.` (unchanged).
   Use `&rsquo;` (HTML entity) in JSX, never a raw curly apostrophe.
3. When `needs_tick === false`: skip the tick. Either hide the tick row and enable the confirm button, or skip the sheet (follow what reads
   simplest in `src/pages/RaffleWin.tsx`). The lock call then sends `p_never_been: false`. The lock RPC `raffle_win_lock_v2` accepts that
   only for an 'anyone' night with the organiser switch on, which is exactly when `needs_tick` is false (read its body to confirm).
4. Nowhere else on the winner screens may the words "never been to" appear (grep and prove it in a test).
5. Tests in `src/modules/raffle-win/pick/__tests__/pick.test.tsx` and `src/modules/raffle-win/__tests__/screens.test.tsx`:
   badge on/off; tick text both ways incl. null organiser; needs_tick false = confirm enabled without a tick; collab name with " & ".

## Situations
Empty list (existing empty state); 30 nights with 3 featured; featured night now full (server already drops it); slow phone (busy state
unchanged); long organiser names (wrap, no overflow at 390px); screen reader (badge has text, tick keeps aria-checked).
Typed input is never lost on an error (the tick state survives a failed lock).

## Do not
- Touch any SQL or admin code. Add no new feature switch: every new behaviour is driven by the DB keys above, which are off/false today.

## Done means
PR open with the repo PR template, all CI green, browser walk at 390x844 with prod-shaped data (screenshots in the PR),
"Verified on real data" block and an honest "Not verified" line.
