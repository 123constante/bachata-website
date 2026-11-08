# Flyer read screen: design record

Brief: `docs/briefs/flyer-read-screen.md`. Inventory: [`flyer-read-screen-inventory.md`](flyer-read-screen-inventory.md)
(42 of 50 covered). Code: `src/modules/organiser/p3/new/FlyerStart.tsx`, `useFlyerRead.ts`, `CreateFlow.tsx`.
Behind `flags.organiserFlyerReader` AND `organiserP3` AND `organiserSelfServe` (all three must be on).

## The screen

The P3 New event kind step gets ONE extra full-width row under the nine tiles: **Start from a flyer**
("Pick a photo of your flyer and we fill in what it says"), with a dashed gold border so it reads as
a different way in, not a tenth kind. Tapping it swaps the tiles for the flyer card in the same frame
(same top bar, same Back). "Fill it in yourself" on every flyer card swaps the tiles back: the blank
form is one tile away.

| State | Title | Ways forward |
|---|---|---|
| choose | Start from a flyer: what it reads; "Nothing is saved until you save." | Pick a flyer photo / Fill it in yourself |
| reading | Reading your flyer&hellip; | Cancel (pick is disabled, with its reason) |
| read ok | (goes straight to the form) | |
| not enough | Not enough on this flyer to fill the date and venue + what we found | Use what we found / Try another photo / Fill it in yourself |
| failed, bad image, error | Couldn&rsquo;t read that one | Try another photo / Fill it in yourself |
| photo problem | That photo won&rsquo;t work + `FLYER_PROBLEM_COPY` | Try another photo / Fill it in yourself |
| daily limit | You&rsquo;ve used today&rsquo;s 5 flyer reads; Back Monday 09:00 (London) | Fill it in yourself |
| attempts limit | Too many tries in a row | Fill it in yourself |
| switched off | Flyer reading is paused for now | Fill it in yourself |
| not an organiser | Flyer reading is for organisers | Fill it in yourself |
| unauthorised | Your sign-in has run out | Fill it in yourself |
| offline | You&rsquo;re offline | Try another photo / Fill it in yourself |

The form (unchanged otherwise): a "From your flyer" card of notes at the top; a gold **Check this**
tag under each doubtful field, cleared the first time that field changes; "Flyer says: ..." under
Where when no venue matched; a tick list under Sessions (only ticked ones are in the draft; it hides
once the Sessions sheet changes them); the flyer is already the picked cover photo.

## Alternatives (the lead picks; recorded)

1. **Entry as a tenth tile** in the 3-column grid. Fewer pixels, but it reads as an event kind and
   breaks the 3x3 grid. Not chosen.
2. **Full-width row under the tiles** (chosen). Clear that it is another way to start, keeps the grid.
3. **Its own route (`?at=flyer`)**. Back/refresh would land on the flyer card; needs `model.ts`
   (`parseAt`), which slice 2 owns. Not chosen: the card lives inside the kind step instead.
4. **Marks as a coloured field border** instead of a tag. Colour alone fails for colour-blind
   organisers and needs a new token. Not chosen: an existing `p3-tag` with words.
5. **Session choices applied silently**, edit in the sheet. Hides what came from the flyer. Not chosen.

## Decisions worth knowing

- **Kind:** from the flyer, never a tile. Course and festival cannot be built yet (`model.ts` deferred),
  so they start as Weekly / Other dates / One date with a note saying so.
- **Ticket link:** a read ticket link also ticks "Ticket link" as a way to pay, or the field would be
  hidden in the Price sheet.
- **Cover:** the flyer File is the form's cover state; the normal save uploads it through
  `uploadEventPicture` -> `uploadFlyer` (re-encoded, metadata stripped). Before save nothing is
  uploaded, so leaving deletes nothing; the hand-off is forgotten on Cancel / Leave without saving.
- **Reload:** the draft survives (same `DRAFT_STORE_KEY` as today); the marks, notes, tick list and
  photo are memory only and do not.
- **Measure:** on save, `trackAnalyticsEvent('flyer_read_saved', { flyer_read_filled, flyer_read_changed })`,
  field names only. The event is not in the typed event map (`src/lib/analytics.ts` is outside this
  slice's files), so the call is cast; add it to the map in a follow-up.
- **Wire:** `supabase.functions.invoke('event-flyer-read')` with `Authorization: Bearer <session token>`;
  no session = the unauthorised card and nothing is sent. The answer may be the read itself or
  `{ read }`; a refusal is a known word in `error` / `reason` / `code`.
- Taps: the entry row 56px, tick rows 44px, all in px.

## Handover (worker, 2026-11-08)

- **Done:** flag, entry, `useFlyerRead`, `FlyerStart` (all states), form hand-off (marks, notes, Flyer says,
  tick list, flyer as cover, forgotten on leave), save measurement, 41 table-driven tests, inventory, this record.
  PR #1498. tsc run on the final branch head: 0 errors in branch files.
- **Left / next:** the orchestrator's 390x844 walk (the list is in the PR body); add `flyer_read_saved` to
  the typed map in `src/lib/analytics.ts`; confirm the live refusal body shape (`error` / `reason` / `code`,
  `resets_at`) against the deployed `event-flyer-read`; then the owner turns the flag on for Ritmo Latino.
- **Not verified:** the live reader, the deploy, the flag on in prod, any browser render.
