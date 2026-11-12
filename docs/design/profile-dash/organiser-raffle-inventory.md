# Organiser Raffle: inventory (step 0, before drawing)

Brief: `docs/briefs/profile-dash-organiser-raffle-opts.md` (branch `brief/profile-dash-organiser-raffle-opts`).
Every field, state and option the admin app, the current Website and the public page support for raffles,
with where it lives, and whether the two options draw it.

**Sources and their limits.** The admin repo (`bachata-admin-11april`, `modules/raffles`) and the #1405 /
#1414 plan files under `~/.claude/plans` were **not reachable** from this cloud session (no repo access, no
plans dir). The admin side below is therefore read from (a) the generated types in this repo
(`src/integrations/supabase/types.ts`) and (b) read-only `pg_get_functiondef` of the live prod functions
(project `stsdtacfauprzrdebmzg`, 2026-11-12). Line numbers are on `origin/main` e27b2f7.

Legend: **A/B** = drawn in both options; **no (why)** = deliberately not drawn, with the reason.

## Admin app / database (Raffle v2 pool model)

| # | Field / state / option | Where | Drawn? |
|---|---|---|---|
| 1 | Series flag `event_series_p5.raffle_enabled` (53 series on) | types.ts:3510; `admin_raffle_series_set_v1` types.ts:13930 | no: stays the admin default per series; organisers see and set the per-night value only (row 3) |
| 2 | Prize preset `raffle_preset_id` -> `raffle_presets` (7 presets, 54 series linked) | types.ts:3511, 8066; `admin_assign_raffle_preset_v1` types.ts:12485 | no: prize is set by us (GAP G6) |
| 3 | Per-night override `raffle_nights(occurrence_id, enabled)` | types.ts:7983-8010; `admin_raffle_night_set_v1` types.ts:13920 | **A/B**: the per-night switch (A) / Open-Close button (B) |
| 4 | `raffle_nights.set_by`, `set_at` (who / when switched) | types.ts:7985-7988 | no: audit only; not useful on a phone (GAP G8) |
| 5 | Night-off refused when a win is `locked` (`holds_locked_win`) | prod def of `admin_raffle_night_set_v1` | **A/B** as the lock, but the brief's rule is "once anyone entered" (GAP G1) |
| 6 | Night open = effective flag AND occurrence not cancelled AND series live/paused/ended AND not ended | prod def of `raffle_night_is_open` (types.ts:16475) | **A/B**: `cancelled`, `nodraw`, `pastoff`, `draft` shapes |
| 7 | Entry close: start minus offset, default 120 min | `_raffle_cutoff_for_night_v1` types.ts:11881; useEventRaffleConfig.ts:51-55 | **A/B**: "Entries close 7pm" everywhere |
| 8 | Per-night cutoff rules `raffle_cutoff_rules` (0 rows) + `admin_set_raffle_cutoff_v1` | types.ts:7945, 14450 | no: we set it; the shown close time already reflects it |
| 9 | Pool entry `raffle_pool` (first name, phone, consent, removed_at) | types.ts:8012-8030; `raffle_join_pool_v1` types.ts:16464 | **A/B** as a COUNT only; never names or phones |
| 10 | Pool removal `admin_raffle_pool_remove_v1` | types.ts:13925 | no: ours (organiser asks us) |
| 11 | WhatsApp verify status on pool rows | types.ts:8023-8028 | no: not an organiser decision |
| 12 | Win states contacted / locked / attended / no_show / released / cancelled; name public only when locked or attended | src/lib/raffleWinState.ts:3-12 | **A/B**: `closed` (awaiting draw) and `drawn` (winner shown); intermediate win states not split out (GAP G7) |
| 13 | Draw / redraw / cancel win / relink (`admin_raffle_draw_v1`, `_redraw_v1`, `_win_cancel_v1`, `_win_relink_v1`) | types.ts:13919, 13929, 13934, 13938 | **A/B** as "We draw the winner" copy; the actions stay ours |
| 14 | Door attendance `raffle_attendance` + `admin_raffle_attendance_mark_v1`; winner QR (`raffle_wins.qr_token`) | types.ts:7851, 13915, 8250 | **A/B** as "they show their winner code at the door"; marking attended is not drawn (GAP G9) |
| 15 | Admin page read `admin_raffle_page_v1(p_days_ahead)` | types.ts:13924 | no: admin only; an organiser read is careful lane |
| 16 | Legacy v1 entries / draws (`event_raffle_entries`, `event_raffle_draws`) | types.ts:2992, 3059 | no: pre-v2 history; counts used for the `huge` shape (max 135 on one event) |

## Public page (event page, /raffles)

| # | Field / state / option | Where | Drawn? |
|---|---|---|---|
| 17 | `get_event_raffle` fields: enabled, entry_count, prize_text, cutoff_at, cutoff_passed, winner_display {first_name, drawn_at}, total_winners | src/hooks/useEventRaffleConfig.ts:39-62, :87 | **A/B**: enabled, entry count, close time, winner + draw time (prize_text: GAP G6) |
| 18 | Raffle tile hidden when not enabled | src/modules/event-page/bento/blocks/RaffleBlock.tsx:228; BentoPage.tsx:188-195, 393-395 | **A/B** in the confirm copy ("shows on the event page straight away" / "comes off it now") |
| 19 | Entries closed (`cutoff_passed`) | RaffleBlock.tsx:222 | **A/B**: `closed` shape |
| 20 | Dancer special states `admin_excluded`, `already_won` | RaffleBlock.tsx:240, 273 | no: dancer-side only |
| 21 | v2 board `raffle_public_board_v1`: pool_count, winners_this_month, nights[...winner_first_name] | src/lib/raffleBoard.ts:1-34; src/hooks/useRaffleBoard.ts:8 | **A/B**: the winner line (the examples show a made-up full name; a real read returns what row 12 allows, first name today) |
| 22 | Open raffles list `list_open_raffles_v1` (/raffles, flag `rafflesPage`) | src/hooks/useOpenRaffles.ts:5; src/lib/featureFlags.ts:21 | no: public listing; unaffected |
| 23 | Flag `raffleV2` (default off) | src/lib/featureFlags.ts:22-24; BentoPage.tsx:194 | no: rollout switch, not organiser-facing |
| 24 | v1 entry submit `submit_raffle_entry` | src/modules/event-page/bento/modals/RaffleEntryDialog.tsx:231 | no: dancer flow |

## Current Website organiser area

| # | Field / state / option | Where | Drawn? |
|---|---|---|---|
| 25 | No raffle anywhere in the organiser module | `grep -ril raffle src/modules/organiser` = 0 files | **A/B** add it, inside each night |
| 26 | Picked Events design: raffle placeholder "Coming soon. It will switch on per night, here." + Tell us | organiser-events-option-a.html:338 | **A/B** replace it |
| 27 | Night lifecycle live / draft / cancelled / past | organiser-events.md:67 | **A/B**: `normal`, `draft`, `cancelled`, `nodraw`, `drawn` |
| 28 | Seats owner / manager / contributor (contributor view-only) | organiser-team.md (role lines) | **A/B**: `contributor` shape with the reason |
| 29 | Loading / load error / save failed | organiser-events.md, organiser-team.md pattern | **A/B**: `loading`, `error`, `failed` |

## GAPs

- **G1 Lock rule differs.** Prod locks a night only when a win on it is `locked`. The brief (Raffle v2) says
  locked once ANYONE has entered. In the v2 pool, entering is global (one pool, many nights), so "entered for
  this night" needs a server definition. Careful lane 2.
- **G2 No per-night entries count.** The pool has no occurrence column; "N entered" for a night must be the
  eligible pool size for that night, and it must be SNAPSHOT at the draw so the drawn night keeps its number.
  Careful lane 3.
- **G3 No organiser-callable read or write.** Every v2 RPC calls `_raffle_v2_require_admin()`. Careful lane 1, 4.
- **G4 Schema exists, empty.** `raffle_nights` (occurrence-level) is already live with **0 rows**; the brief's
  "occurrence-level schema needed" is half done: the table exists, the organiser path does not.
- **G5 Wins carry no night.** All 16 prod `raffle_wins` have `occurrence_id` NULL, so "winner per night" cannot
  be read for existing wins. Careful lane 5.
- **G6 Prize text** is not drawn in either option (admin sets it); add a read-only "Prize" fact if the owner wants it.
- **G7 Win sub-states** (contacted vs locked vs released) are folded into "we draw soon" / "Winner". A
  released or no-show winner is our problem to solve, so the organiser view does not split them.
- **G8 Who switched it** (`set_by`, `set_at`) is not shown.
- **G9 Door check-in** of the winner by the organiser (attendance) is not drawn; today it is ours.

## Coverage count

**29 rows. 17 shown in the designs** (rows 3, 5, 6, 7, 9, 12, 13, 14, 17, 18, 19, 21, 25, 26, 27, 28, 29),
**12 deliberately not drawn, each with its reason above** (1, 2, 4, 8, 10, 11, 15, 16, 20, 22, 23, 24).
None silently omitted.
