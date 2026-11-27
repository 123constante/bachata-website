# Brief: R4 Cancel refund, slice C (Website screen, behind a flag)

Owner pick (DESIGN-REGISTRY rows 52-55, artifact https://claude.ai/artifact/PAT4p34rugMMJtjtJVq4G1, option B): the cancel sheet is unchanged. A CANCELLED night shows, under the numbers, `N orders to refund, GBP X` with a `Refund all` button and a per-order `Refund` button. Buttons show for owner and admin only (managers and door staff never see money or buttons). Tapping opens a confirm sheet with the amount (`Refund 10 orders, GBP 120?` / `Refund` / `Keep`) before money moves. Fee is returned to buyers (do not write 'fees kept apart' anywhere on this screen). Free tickets are not listed. Buyers get no refund promise from this screen.
Guest list gets the Refunded chip back (All / In / Not yet / Refunded) for owner and admin only; door staff keep All / In / Not yet. On a cancelled night the door list is hidden (reviewer O5).

## Backend already live (do not change)
- RPC `organiser_night_refund_summary_v1(p_event_series_id, p_occurrence_id)`: authenticated, owner/admin only (others get `not_allowed`). Returns the plan: `orders_to_refund`, `pence_to_refund`, per-order list (order_id, first_name, tickets, remaining_pence, refunded, mixed_nights), `free_orders_to_end`. Read the migration `supabase/migrations/20261119160159_ticket_night_cancel_refund_v1.sql` in repo 123constante/bachata-admin for the exact shape (`git show origin/main:<path>`).
- Edge fn `ticket-refund-night` input `{series, occurrence, expected_pence, expected_orders}`; answers 409 `changed` when totals moved (re-fetch the summary, show the new amount, ask again); returns per-order results, partial failure reported. Single-order refund uses the existing `ticket-refund` edge fn.
- Slice B (parallel, admin) adds `no_stripe_record` / `orders_without_stripe` to the plan: treat an unknown field as absent; show no row for it.

## Build (Website only; one PR; flag `VITE_ENABLE_ORGANISER_CANCEL_REFUND`, default OFF; zero migrations)
1. In `src/modules/organiser/p3/r4/R4Night.tsx` (and model `r4NightModel.ts`): when the night is cancelled and the viewer is owner/admin, fetch the summary and render the block under the numbers, in the existing R4 style. Hide the guest/door list on a cancelled night. Data code goes in a new small module beside `src/modules/organiser/p3/door/data.ts`, not in the screen.
2. Confirm sheet reuses the R4 sheet component; amount from the summary; calls `ticket-refund-night` with the expected totals; handles 409 `changed`, partial failure (list which orders failed, keep the button for retry), success (refresh summary, orders show Refunded).
3. Refunded chip in `R4GuestList.tsx`: data from `ticket_door_list_v3` has no refund field, so derive per-order refunded state from the summary list for owner/admin only; if not derivable additively, ship without the chip and list the gap.
4. Do NOT edit `R4Shell.tsx` (another window edits its header). Tap targets explicit px (phone html is ~13.5px).

## Tests
Matrix test (like `__tests__/r4Night.matrix.test.ts`): owner sees block and buttons; manager and door staff see neither; non-cancelled night shows nothing; free orders not listed; 409 path re-fetches; partial failure keeps retry; flag off renders nothing. Walk at 390x844 on prod-shaped data (seeded WALK org f2f93490-7b26-4eed-a69d-82b6ca50404e; never call the real refund endpoint on prod, mock it).

## Out of scope
Any admin/DB change, enabling the flag, Message everyone, Reminders row, Raffle.

## Rules
Never merge. Bot-authored PR. Push early, PARTIAL marker if context tight. PR body: Verified / Not verified, before/after 390x844 screenshots.
