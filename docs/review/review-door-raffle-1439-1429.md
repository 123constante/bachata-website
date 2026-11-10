# Review: PR #1439 (door refused card) and PR #1429 (raffle board screens)

grep: review-door-raffle-1439-1429

Independent, read-only review. No code changed, nothing approved or merged.
Reviewed 2026-11-10 against `origin/main` f0f3b291.

| PR | Head reviewed | Base in PR | Merges into current main | Verdict |
|----|---------------|------------|--------------------------|---------|
| #1439 | `746fa2cb9198e9af061788dc524f15f5c4216825` | 81318f36 (main is 53 commits ahead) | clean (test merge) | **PASS-with-fixes** |
| #1429 | `27f0356575a3b2cf82c55ce899a1ca3c6d0cd766` | 502dddfe (main is 32 commits ahead) | clean (test merge) | **BLOCK** (safe while `VITE_ENABLE_RAFFLE_V2` is off; must not flip the flag) |

---

## PR #1439: refused door card gets Check again and Back to events

Real change (ignoring line endings): `DoorScreen.tsx` +31/-9, `model.ts` copy line, `door.css`
one rule, two new tests. `git diff --stat` shows 936 lines on DoorScreen.tsx because the whole
file flipped from LF to CRLF (see fix 2).

### States a door worker can reach (read from code + tests)

| State | What the screen says | What it offers |
|-------|----------------------|----------------|
| Refused from the list read (scan tab) | CANNOT CHECK TICKETS / You're not on this event's team / "...then tap Check again." | Check again, Back to events |
| Refused from the list read (list tab) | same | same |
| Refused from a typed or scanned code while the list read was ok | same | same; Check again reads the list (ok) and clears the card |
| Check again -> still refused | card stays, button re-enables, no toast | same |
| Check again -> offline / network error | card stays, no toast, no "offline" message | same |
| Check again -> ok | card replaced by the normal scan / list | normal controls |
| Refused + nothing sold (`totalCount: 0`) | refused card wins over the empty state | same |
| Already scanned, expired, too many attempts | unchanged by this PR (`RESULT_TABLE`) | unchanged |

Copy check: the old detail "open this screen again" pointed at no control; the new detail
"tap Check again" names a button that is on screen in every branch that renders the card
(`ScanTab` and `ListTab` both pass `recheck`). The matrix test asserts both controls in 10
tab x shape cells. Good.

### 390x844 (by numbers, no browser)
`.p3-door-big` min-height 56px (px, not rem, so the 13.5px root font trap does not apply).
Two controls share `.p3-door-acts` (flex, gap 8px, `flex: 1`), so each is roughly 170px wide
at 390px; "Back to events" at 18px bold is about 140px. Fits, no sideways scroll expected.
NOT measured in a browser.

### Prod data shape
`tickets`: 4 rows, 3 checked in; `ticket_night_check_ins`: 0 rows. There is essentially no
real door traffic yet, so prod cannot exercise the refused card; the shapes are covered only
by the PR's table tests.

### Guard / exempt lists
Touches nothing under the calendar density-exempt list, `supabase/**`, workflows, or scripts.
`.p3-door-big` is used only in `DoorScreen.tsx` (3 call sites), so the `inline-flex` change
also reaches the existing result-card action buttons (line 314); inside the flex
`.p3-door-acts` row that is harmless.

### Checks run
- Test merge of the PR head into current main: clean.
- `vitest run src/modules/organiser/p3/door tests/doorRefusedCardCentring.test.ts` on the merge: 7 files, 405 tests pass.
- `npm run check:integrity` on the merge: ok, 0 issues.

### Fixes (ordered by severity)
1. **Offline recheck is silent.** `src/modules/organiser/p3/door/DoorScreen.tsx:130-139`:
   when `list.refetch()` fails (no signal at the door), the button goes Checking... then back to
   Check again with no message, so the worker cannot tell "still refused" from "no signal".
   Claim: a network failure on Check again shows a one-line "No signal, try again" under the
   button. Check that would catch it: the `then_network` cell in
   `door.noAccess.matrix.test.tsx`, which today asserts *no* alert, should assert the message.
   Note that React Query's `refetch()` resolves with `isError` rather than throwing by default,
   so the `catch` branch is likely dead; the check should read `r.isError`.
2. **Mixed line endings, including two bare CRs inside JSX.** `DoorScreen.tsx:186` and `:190`
   at the PR head contain a lone `\r` mid-line (`openList={() => setTab('list')}\r recheck=...`),
   and the file mixes 474 CRLF with 4 bare LF lines. TypeScript tolerates it and
   `check:integrity` passes, but it makes the whole file show as changed and any later
   line-based guard or `split('\n')` test (like `tests/doorRefusedCardCentring.test.ts`) can
   misread those lines. Claim: re-save the file with one consistent ending through
   `scripts/safe-write.py`. Check: `git diff --ignore-cr-at-eol --stat` equals plain `--stat`,
   and `python3 -c` count of bare `\r` is 0.
3. **Check again can falsely clear a typed-code refusal.** When the list read is ok but the
   scan/typed check-in says `not_allowed` (list and check-in RPCs authorise separately), Check
   again reads only the list, gets ok, and clears the card; the next scan is refused again.
   The matrix test's `typed` shape asserts this clearing as correct. Low impact (worker just
   sees the refusal again), but the copy promises it will fix things. Claim: for a refusal
   that came from a check-in, Check again should not clear unless the list read and the
   seat lookup agree; or keep it and accept the loop. Owner call.

---

## PR #1429: raffle board screens on the tile and /raffles (R3b-2)

Flag-gated on `flags.raffleV2` (`VITE_ENABLE_RAFFLE_V2 === 'true'`, default off). With the flag
off, `RaffleBlock` and `/raffles` render the legacy components and BentoPage keeps the old
config read, so merging alone changes nothing for users.

### BLOCKER: the board parser reads keys the real RPC does not send

`raffle_public_board_v1()` **is now live on prod** (anon has EXECUTE). Its definition
returns each night as:

```
occurrence_id, public_event_id, title, start_local, venue_name, winner_first_name
```

The parser this PR builds on reads `start` and `venue`:
- `src/lib/raffleBoard.ts:45` `const start = str(raw.start);`, and a night without `start` is dropped.
- `src/lib/raffleBoard.ts:52` `venue: str(raw.venue)`.
- The fixtures copy the wrong keys: `src/lib/__tests__/raffleBoardFixtures.ts:5`.

Proved on the merged head: `parseRaffleBoard` fed one night with the real keys returns
`nights.length === 0` (throwaway vitest, not committed). Result for real users once the flag
is on:
- Every event tile says **"Win a free night elsewhere"**, even for the 21 events with open raffle nights.
- No tile ever shows a winner strip.
- /raffles shows **Nights open 0** and "No winners yet this week" whatever happens.

All 20 PR tests stay green because the fixtures use the same wrong keys. `raffleBoard.ts`
itself came from R3a (already on main), but these screens are its first consumer, so this is
where it bites.

Fix: parse `start_local` and `venue_name` (keep `start`/`venue` as fallbacks if desired) and
switch the fixtures to the real keys. Check that would catch it: a fixture built from the
prod function's `jsonb_build_object` key list, plus a contract test that greps the admin
migration's key names (the "one shared mapping" rule).

### Other fixes (ordered by severity)

2. **`start_local` is a UTC wall clock with no zone.** The RPC formats
   `materialised_start_utc AT TIME ZONE 'UTC'` without an offset. `londonKeyOf`
   (`raffleBoard.ts:89-97`) treats an unzoned string as a *London* wall clock, so in BST a
   night starting 23:30-00:00 London lands on the wrong day in "This week's winners", and
   `fmtNight` (`src/pages/Raffles.tsx`) can print the previous day. Claim: treat
   `start_local` as UTC (append `Z`) or ask admin to return a zoned instant. Check: a
   table test with a BST night at 23:30 London.
3. **Loading and error look like "not in the raffle".**
   `src/modules/event-page/bento/blocks/RaffleBlock.tsx:453` `const elsewhere = !state?.inRaffle;`
   is true while the board loads and when it errors, so every event in the raffle flashes (or,
   on error, permanently shows) "Win a free night elsewhere". Claim: render the elsewhere
   heading only when `board` has loaded. Check: add `loading` and `error` cells to
   `RaffleBlock.board.test.tsx` asserting no elsewhere heading; today the `board error`
   fixture expects the heading (`tileInRaffle: false`).
4. **"Winners so far" will read about 766 on prod.** The RPC's `total_winners` counts
   `raffle_attendance` pairs UNION locked/attended wins. Prod: 766 attendance pairs, 16 wins
   (all `contacted`). `src/pages/Raffles.tsx:91` labels it "Winners so far". Either the
   label or the admin count is wrong. Owner/admin call before the flag flips.
5. **Earliest night may be yesterday.** The board includes nights from `today - 1`;
   `boardForEvent` (`raffleBoard.ts:77`) picks the earliest, despite its comment saying
   "upcoming". 20 of 21 board events have several nights (max 9). On the day after a night,
   the tile tracks yesterday's night (and its winner, "won this night") instead of the next
   one. Claim: prefer the earliest night whose London date is today or later. Check: a fixture
   with yesterday + next week.
6. **"See who won" always shows** (`RaffleBlock.tsx:497`), including on an empty board,
   where /raffles then says "No winners yet this week". Mild copy mismatch. Claim: label it
   "See the raffle" when there are no winners, or hide it. Check: the `empty` shape cell.
7. **"You're in" is sessionStorage only** (`src/lib/raffleSession.ts:48-54`). Next visit,
   the lever and "Free to enter" come back for someone already in the pool; a second entry
   goes to `raffle_join_pool_v1` (its de-dupe behaviour was not checked). Note, not a block.

### Data shape (prod, read-only counts, no personal data)
- `raffle_pool`: 595 rows, 521 eligible (board `pool_count` would be 521).
- `raffle_wins`: 16 rows, all `contacted`, so no night has `winner_first_name` today: the winner
  strip and "This week's winners" are empty on real data right now.
- Open raffle nights in the board window (today-1 .. today+60): 151, across 21 public events,
  20 with more than one night, max 9 per event; 0 nights without a venue.
- The reply is one `jsonb` value, so the 100-row API cap does not apply; 151 nights is fine
  for the tile (one linear scan) and /raffles (counts only, no night list).
- `raffle_public_board_v1` calls `raffle_sweep_no_shows_v1()` (a write) on every anonymous
  read. That is admin-side and out of scope, but every event page view with the flag on would
  run the sweep. Flagging for the admin owner.
- I did **not** call the RPC itself, because it writes.

### 390x844 (by numbers, no browser)
"See who won" link: `min-height: 44px; line-height: 44px` (px). /raffles "Try again" and
"Enter the raffle": `min-h-[44px]` (px). The counters are a 3-column grid (`grid-cols-3`,
`p-3`), in line with the density rule. Nothing found that would scroll sideways; NOT measured
in a browser.

### Guard / exempt lists
Touches `src/modules/event-page/bento/BentoPage.tsx` (the real `/event/:id` render) in two
flag-gated lines; no calendar density-exempt file, no `supabase/**`, workflows or scripts.
JSX uses entities (`&rsquo;`, `&rarr;`, `&mdash;`); the emoji is a `\u{1F389}` escape.

### Checks run
- Test merge into current main: clean.
- On the merge: `RaffleBlock.board.test.tsx`, `Raffles.board.test.tsx`, `useRaffleBoard.test.ts`: 20 pass.
- Throwaway real-key parser test: **fails** (0 nights parsed), confirming the blocker.

---

## Not verified
- No browser walk at 390x844 for either PR; tap sizes are read from CSS, not measured.
- No real phone.
- No CI per job re-run for either PR; no `pre-ship`; no `npx tsc` on the PR heads.
- #1439: live refused door state on prod (only 4 tickets exist); whether `ticket_door_list_v2`
  and the check-in RPCs authorise the same set of people (fix 3 rests on reading the client,
  not the SQL).
- #1429: that BentoPage's `eventId` equals the board's `public_event_id` (the legacy raffle read
  used the same id, so likely, but not proven); what `raffle_attendance` means (fix 4);
  `raffle_join_pool_v1` de-dupe on a second entry.
