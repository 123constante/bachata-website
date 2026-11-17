# Review: PR #1753 post-pay read-only ticket teaser (`claude/ticket-teaser-readonly` @ 0217adf89cf50a79018dec322242c389f713d7ec)

Head 0217adf89cf50a79018dec322242c389f713d7ec has the same tree as 5f54316a4. Independent read-only review:
no code was changed on the PR branch. ONE round, risky classes only (gate/guard, read path and RPC contract,
money copy, tap targets). Prod reads were catalogue reads only (`pg_proc` source, one flag row, one count);
no personal data, no writes.

## Verdict: PASS WITH NITS

Safe to merge behind the flag: with `VITE_ENABLE_TICKET_TEASER` unset nothing a person sees changes, the read
path uses only existing own-row RPCs and the teaser writes nothing. But the feature does NOT work as built if
the flag is turned on (finding 1). That must be fixed before the flag goes on, not before merge.

## Hard-tier: PASS

Reason: the gate change is additive and flag-guarded (`admitsViewOnly(..., teaserOn = false)`; existing
callers and the flag-off test keep the old answer), the server stays the authority (`_dancer_area_require_v1`
in every member RPC), and the teaser twins call only `my_tickets_v1` / `my_ticket_order_qr_v1`, which are
SECURITY DEFINER, keyed on `auth.uid()`, and already used by the live Tickets tab. No new RPC, table or column.

## Findings (most severe first)

1. **The teaser is keyed on the wrong condition, and its Continue leads to a dead end (must fix before flag
   on).** `teaserActive` needs `viewOnly`, and `viewOnly` is true only when `dancer_area_gate_v1` says
   `allowed: false`. On prod `_dancer_area_allowed_v1()` = `dancer_area_open` (currently **true**) OR the
   email is on `dancer_area_access`, so every signed-in person is allowed and the teaser never shows. The
   comment in `teaser/teaserGate.ts` ("view-only (an unfinished profile)") is wrong: view-only means "area
   closed to you", not "profile unfinished" (that is `noProfile` / `profileIncomplete` in `DancerAppShell`).
   And in the one case where it would show (area closed, person unlisted), the sheet's Continue goes to
   `/app/welcome`, which this PR now admits; onboarding calls `my_dancer_edit_v1` and
   `save_my_dancer_profile_v2`, both of which run `_dancer_area_require_v1` first and raise `42501
   area_closed`. The handover already notes the onboarding saves were never tested for this person; on prod
   they cannot succeed. Fix: key the teaser on an unfinished profile (`noProfile` / `profileIncomplete`) for
   an allowed person, and drop the `/app/welcome` exception from `admitsViewOnly` (an allowed person already
   reaches it).
2. **Money copy is unconditional (should fix).** `TeaserHome` always shows "Your ticket is bought. Next step:
   tell us what you are." even when `useTicketCard` reports no ticket, an order still `checking` /
   `processing`, or `failed`. For a failed or pending order this tells the person they have paid when they
   have not. "Bought" is also wrong for a free ticket. Fix: show that line only when `view.kind === 'tickets'`
   (and say "Your ticket is booked" or similar to cover free ones); otherwise a neutral line.
3. **Home consumes the stored order id (nit).** `TeaserHome` calls `useTicketCard`, which runs
   `clearOrderId()` and rewrites `?o=` on `/app/home`. The "Your ticket" link goes to `/app/nights` without
   `?o=`, so Nights falls back to `my_tickets_v1` (upcoming list) instead of the order just paid. Safe, but the
   order states (checking, processing) are lost on Nights. Fix: carry `?o=` on the link, or read the order on
   Nights only.
4. **Gate-error path widens with the flag on (nit).** With the teaser flag on and a failed gate read
   (`status: 'error'`), `/app/home|nights|me|options|welcome` are now admitted with `viewOnly = false`, so the
   REAL screens render and their member RPCs may fail, where today the person goes to `/account`. Not a data
   risk (server enforces), but an untested state. Fix: admit the teaser paths only when `status === 'ready'`.
5. **Stale handover (nit).** `docs/handover/ticket-teaser-readonly.md` "Done" says the gate never admits
   welcome; fix round 1 and the code admit it. One of the two should change (see finding 1).

## Checked and fine

- Flag default OFF: `TICKET_TEASER_ENABLED = import.meta.env.VITE_ENABLE_TICKET_TEASER === 'true'`; no env
  file in the repo sets it. Flag off: `teaser` is false in `DancerAppShell` (tabs, five-tab class and locks
  exactly as on main), `ScreenOrTeaser` returns the real screen, `admitsViewOnly` unchanged (test covers it).
  The only flag-off differences are structural: `TicketsScreen` is now lazy behind `Suspense fallback={null}`,
  and pure helpers moved to `tickets/profileIncomplete.ts`, `tickets/roleChips.ts`, `teaser/teaserGate.ts`
  with re-exports from the old modules (same exports, same logic, byte-for-byte moves).
- Read path: no writes anywhere in `screens/teaser/`. Greeting reads `user_metadata.first_name` from the
  session only. QR token stays inside the existing `TicketCard`.
- Contract: no generated-type changes needed; RPC names match the existing `myTicketsApi.ts` calls.
- Bundle: `perf-budgets.json` tightens the /app chunk allowance 48 -> 47 with a dated reason row.
- Tap targets: explicit px throughout (`.tz-btn` 50px, `.tz-row` 68px, `.tz-tkt` 76px, lock chip 30px
  inside a full-row button). Sign out reuses `SignOutControl` (`testId` prop already exists on main).
- Copy: no raw Unicode punctuation in JSX; the `·` is in a TS string.

## Not verified

- No live walk (the PR's screenshots come from a harness without auth). No CI read. No mutation run.
