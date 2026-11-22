# Editor v2 slice 6 handover (Guest list row and sheet)

## Built
- `v2/GuestSheet.tsx` (new): `GuestRow` (one-line button, pill "On &middot; n names" / "Off") and `GuestSheet` (V2Sheet: switch, names with +N, link box, Copy link).
- `v2/NightHub.tsx`: `<GuestRow/>` renders before the Raffle row (+4 lines); the long date comes from `raffleNight.dayLabel` (no year, same as the Night card), link is the Share sheet's `shareLink`.
- `v2/copy.ts` (+13), `guestListModel.ts`: `GuestEntry.plusOnes` from `plus_ones` (default 0). `guestListModel.test.ts` expectation gained `plusOnes: 0`.
- `v2/v2.css` (+9): `.swrow`, `.sw`, `.sw.on` and card-row border were missing, so appended (brief allowed max 20 lines).
- `__tests__/guest.test.tsx` (14 tests).

## Assumptions
- Gate: copied from the old `GuestListRow`/`GuestListSheet`: `flags.organiserGuestListLive` off hides the row (the old row showed Coming soon instead; the brief says hide).
- Hidden also on `night_not_found` / `not_on_team`. Loading or other error: row with no pill.
- Names come from the first PAGE (50) read; "Showing n of total." appears beyond that.
- Switch is disabled unless the read says `canEdit` (covers past, cancelled, view_only) and shows `READ_ONLY_WORDS[readOnly]`.
- The editor sheet does NOT offer check-in, scan, add name, places, closing time or removing names (prototype has none). `setNight` passes the night's existing places and closing time unchanged.

## TAP TABLE
| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 17 | Guest list [On &middot; n names / Off] | Sheet "Guest list" with real names and link | prototype |
| 66 | Copy link | toast "Link copied"; blocked: "Select the link to copy it" | prototype |
| 67 | Guest list (switch) | same sheet redrawn; toast "Guest list on" / "Guest list off", no Undo | prototype |

## Verified / Not verified
- Verified: `npx vitest run src/modules/organiser/p3/v2 src/modules/organiser/p3/guestlist`: 13 files, 168 tests pass.
- `tsc -p tsconfig.app.json`: 0 errors in files I touched (remaining errors are pre-existing: GuestListSheet.tsx narrowing, eventPage.proto.test.ts). Run on the commit below.
- Not verified: 390x844 browser walk, prod shape survey, pixel match, `pre-ship`, `/code-review`. Flag stays OFF; no PR opened (per brief).
