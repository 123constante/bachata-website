# Ambassador A1 follow-up: what the person sees change

Follow-up to `ambassador-a1-build.md` (#1086), closing F1-F6 of the Fable r3 review (`docs/reviews/review-1086-r3.md` on `claude/review-1086-r3`). Same screens, same layout, same overlay geometry. No RPC or DB change.

## F1: the whole queue loads before the list shows

The list RPC pages NEWEST first. Before, the page showed the 100 newest and hid the rest behind "Show more", so the oldest items (the ones the oldest-first design is for) were the hidden ones.

| | Before | After |
|---|---|---|
| 101 waiting in Bristol, one for 30 days | 100 rows; bar "Oldest waiting **2 days** &middot; oldest first"; "This shows the first 100 in Bristol. There may be more waiting." + **Show more**; the 30-day item appears on top only after the tap | skeleton while both pages load (two requests), then 101 rows; the 30-day item on top with its amber chip; bar "Oldest waiting **30 days** &middot; oldest first"; no Show more |
| 12 waiting (the usual case) | one request, list | one request, list (unchanged) |
| exactly 100 | "may be more" + Show more | one extra, empty request, then 100 rows; no claim of more |
| 1000 or more in one city (cap) | n/a | 10 requests, stops; bar says "Oldest **loaded** N days"; note under it: "At least 1000 are waiting in Bristol. Only the 1000 most recent are here, so any older ones are not shown. Ask an admin to clear the rest." |

Cities page in parallel, each on its own (a 30-row city is asked once, not again at offset 100).

## F2: an item that changed under the person

`_moderate_entity` raises `not_authorised` before `target_not_found` for a non-admin, so a deleted item, or one moved to another city, came back as "no access".

- Before: sheet stays open, "You do not have access to decide this one. Ask an admin to check your city." and a **Try again** that can never work; the row stays.
- After: sheet closes, back on the list, toast "This one has changed and is no longer yours to decide. It has been taken off your list.", the row is gone and the list is refetched.

## Nits

- **F3** After a "needs an admin" refusal the list is refetched, so a party item someone else already decided drops off instead of sitting there as "Needs an admin". No new copy.
- **F4** Deep link to an item that is not in the list: title "Not in your queue", text "This one is not in your queue. Go back to the list to see what is waiting for you." (was "No longer waiting ... It may have been decided already").
- **F5** The age chips and bar recount every minute. If a background refresh fails while rows are on screen, a small line above the bar says "Could not refresh. Showing the last list." with a 44px **Try again**; it goes when a refresh succeeds.
- **F6** Test file is ASCII only (a backslash-u00b7 escape).
