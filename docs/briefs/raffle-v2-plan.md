# ARC -- Raffle v2: one general pool, winner picks a night, QR door check

Plan written 2026-10-30 by session website-04 (Fable 5.1). Lane: **Careful** (migrations, RPC/ACL, public routes). Owner's click answers are all recorded below; nothing here is open. Board: row + `claude/raffle-*` claim granted by the program lead (website-ad) 2026-10-30, with two conditions folded in below: the door scanner is ONE screen shared with the ticketing arc's planned door scan, and this arc stays out of `p3/*` and onboarding files (reads `teamModel.ts` only).

## Context

Today every raffle is per event night: `event_raffle_entries` is keyed to an occurrence, winners are marked per night (`outreach_state` contacted/won, `raffle_winners` ledger), the admin assigns raffle presets per event and messages winners by hand. The owner wants ONE general raffle: enter once from anywhere, the admin draws from a single eligible pool, the winner signs in and picks the night they want, a single-use QR is issued automatically, organisers scan it at the door (offline-capable), and no-shows fall back into the pool with no admin work. The admin raffle page is REBUILT around the pool (owner 2026-10-30: "we need a rebuild of that"); the only thing kept from it is the idea of a nights list with an applicant count.

Prod shapes (read-only, 2026-10-30): 1,180 live entries = 531 distinct phones; 766 winner rows = 447 distinct phones; 515 `contacted`, 361 `won` marks; 53 series carry a raffle preset; 933 upcoming non-cancelled occurrences on those series; 0 WhatsApp-failed entries; `tickets.qr_token text` already exists for the ticketing door scan.

## Owner decisions (click answers, 2026-10-30)

| # | Question | Answer |
|---|---|---|
| D1 | Linking a phone entry to an account | **Link token binds whoever signs in** (one-time token in the WhatsApp link; first account to sign in is bound to that win + phone; email/Google sign-in, no phone OTP) |
| D2 | Entry lifetime | **Never expires**; re-entering just says "you're in" |
| D3 | Nights offered to a winner | **Upcoming raffle-enabled nights**, minus taken, minus nights they attended. Raffle-enabled = the per-night on/off toggle on the rebuilt admin page (D11); the migration turns it ON for every upcoming night of a series that has a preset today, so nothing goes dark |
| D4 | QR delivery | **WhatsApp via the existing `raffle-send-confirmation` edge-fn path** (new template); also shown on the winner page |
| D5 | Scanner location | **Public site, signed-in organiser** |
| D6 | Public winner name | **Always first name once locked**; released = removed; `show_winner_publicly` retired |
| D7 | Scanner access | **Event's organiser team (owner/manager/contributor) + site admins**; own flag, independent of `organiserP3` |
| D8 | "Night ended" / no-show flip | **Occurrence end, London wall clock** (same rule as `set_my_occurrence_attendance_p5_v1`); evaluated lazily on read, no cron |
| D9 | Old entries | **One pool row per distinct live phone** (earliest name/consent); old per-event tables kept read-only (history), no longer read by any screen |
| D10 | Where the admin draws | Superseded by D11 |
| D11 | Admin raffle page | **One page, pool-first**: pool summary + Draw + drawn-person card (Contacted, Copy WhatsApp); winners by state with Cancel + manual Attended tick; upcoming nights with raffle on/off toggle, spot holder, applicant count = pool size. Per-night entries panel, cutoffs, presets and per-night contacted/won marks are REMOVED |
| D12 | Mockups picked (Design Gate stage 2 DONE, https://claude.ai/artifact/6etRLTgKVcdtYYT2nntH94) | Winner page = **B: week strip + 3-column tiles, lock sheet at the bottom**, plus the five shared states (sign-in gate, locked with QR + Release, spot just taken, night passed, released). Admin page = **A: single column** (strip + draw card, winners grouped by state, nights table with switches). R2 and R4 build to these; no new mockups |
| D13 | WhatsApp winner message | **Open WhatsApp pre-filled, admin presses Send** (primary button = `buildWaHref(phone, message)` via wa.me, marks the win `contacted` on tap; secondary = Copy message). Fully automatic template send is PARKED |
| D14 | Suggested UX changes (mockup page section 3) | ALL FOUR accepted: **S1** event page tile = one-raffle copy, "<name> won this night" line, persistent "You're in" (sessionStorage for anonymous, `raffle_my_wins_v1`/pool binding for signed-in); **S2** raffle page = winners board (in the draw / nights open / winners so far, this week's winners) replacing per-event cards; **S3** door scanner name-first big green/red card, offline badge, saved-list + sync counters, "Type the name instead" fallback (searches the saved list); **S4** locked state = countdown pill, Add to calendar (.ics), Directions (maps link), Release copy "Can't make it? Release my spot"; **S5** admin waiting rows turn red after **3 days** (`contacted_at`), "Message again" + "Release and redraw" (= cancel + draw in one RPC call `admin_raffle_redraw_v1(win_id)`). S1/S2 land in R3, S3 in R5, S4 in R4, S5 in R1+R2 |
| D15 | Amendments (owner click) | ACCEPTED: **A1** series-level raffle switch (`event_series_p5.raffle_enabled bool`, backfilled TRUE where `raffle_preset_id IS NOT NULL`) auto-includes new nights; `raffle_nights` becomes the per-night OVERRIDE (row present = forced on/off); admin page gets a series switch in the nights table and the per-night switch stays. **A2** `raffle_wins.link_expires_at = contacted_at + 7 days`; expired link -> "ask the organiser for a new link" screen; admin row button **New link** (`admin_raffle_win_relink_v1`, rotates the token, old one dead). **A3** the WhatsApp confirm/verify state machine (`raffle_wa_claim_send_v1`, `raffle_wa_record_send_result_v1`, the `whatsapp-webhook` + `raffle-send-confirmation` edge fns, `get_raffle_entry_wa_status_v1`) is rekeyed to `pool_id` as its own R1 item with tests. DECLINED: privacy path for the never-expiring pool (erase/export pages + RPCs over `raffle_pool`/`raffle_attendance`, consent copy); listed under PARKED as a known gap |
| D16 | Event page block + raffle page (owner click) | **Event block**: KEEP the Lucky Reels slot machine (`RaffleBlock.tsx` + `.css`); only the copy changes (marquee "Win a free night", "<name> won this night" strip, persistent You're in inside the cabinet, "See who won" link to /raffles). Shown on EVERY event page: on a night not in the raffle it is entry-only, "Win a free night elsewhere", no winner line. **Raffle page** `/raffles` GOES LIVE with this arc (`rafflesPage` flag flipped ON in prod at R3 merge), linked from the block and the footer; no bottom-nav slot. Both read `raffle_public_board_v1` |

## Data model (admin repo owns all DDL)

New tables (all RLS on, anon has NO table grants; every access through SECURITY DEFINER RPCs with the repo's ACL posture, `revoke ... from public, anon` by name):

- `raffle_pool` -- one row per person. `id`, `phone_e164 UNIQUE`, `first_name`, `consent_version`, `consent_at`, `user_id uuid NULL` (bound on first winner sign-in, D1), `wa_verify_status`, `entered_at`, `removed_at`, `removed_reason`.
- `raffle_nights` -- which nights are in the raffle (D11 toggle). `occurrence_id PK FK event_occurrence_p5`, `enabled bool`, `set_by`, `set_at`. Backfill: enabled for every upcoming non-cancelled occurrence of a series with `raffle_preset_id` (933 rows today). Per D15/A1 this table is the per-night OVERRIDE: a night is in the raffle when `COALESCE(raffle_nights.enabled, event_series_p5.raffle_enabled)` is true, so new nights of a raffle-on series are in by default and one night can be pulled out.
- `raffle_wins` -- the state machine. `id`, `pool_id FK`, `state` CHECK IN (`contacted`, `locked`, `attended`, `no_show`, `released`, `cancelled`), `link_token text UNIQUE` (random 32 bytes, base64url), `occurrence_id FK NULL`, `qr_token text UNIQUE NULL` (same shape as `tickets.qr_token`, QR payload `r:<token>`; tickets use `t:<token>` so one scanner reads both), `qr_void_at`, `contacted_at`, `locked_at`, `scanned_at`, `released_at`, `drawn_by`, `note`. **Partial unique index** `(occurrence_id) WHERE state = 'locked'` is the one-winner-per-night guarantee.
- `raffle_attendance` -- per-person history. `pool_id`, `occurrence_id`, `source` CHECK IN (`scan`, `manual`, `backfill`), `recorded_at`, `recorded_by`, `win_id NULL`. UNIQUE `(pool_id, occurrence_id)`.

Eligibility (`raffle_pool_is_eligible(pool_id)`): live pool row, `wa_verify_status <> 'failed'`, and NO win in state `contacted`, or `locked` on an occurrence that has not ended. A `locked` win whose occurrence HAS ended with no scan is a no-show: readers flip it to `no_show` lazily (D8) inside the draw/summary RPCs.

Migration of the past (D9 + PAST WINNERS): collapse live entries by phone into `raffle_pool`; `raffle_winners` rows on ended occurrences -> `raffle_attendance(source='backfill')` (attended, back in pool); on upcoming occurrences -> `raffle_wins(state='locked')` with a fresh qr_token (stays blocked, scannable). `outreach_state='contacted'` on upcoming nights -> `contacted` wins. Old tables untouched; `raffle_presets` left in place but no longer read.

## RPCs (admin repo; names final)

Public (anon-callable, rate-limited like `submit_raffle_entry`):
- `raffle_join_pool_v1(first_name, phone, consent_version, session_id, honeypot)` -> `{ok, pool_id, already_in}`; starts the existing WhatsApp confirmation path; replaces `submit_raffle_entry` on both entry surfaces.
- `raffle_public_board_v1()` -> `{pool_count, winners_this_month, total_winners, nights: [{occurrence_id, public_event_id, title, start, venue, winner_first_name|null}]}` -- THE shared source for raffle page + event page. Event page filters by its public_event_id client-side.

Winner (authenticated, non-anonymous JWT, same check as the attendance RPCs):
- `raffle_win_claim_link_v1(link_token)` -> binds `pool.user_id = auth.uid()` if NULL; refuses if bound to another user; returns the win + open nights.
- `raffle_win_open_nights_v1(win_id)` -> enabled upcoming non-cancelled `raffle_nights`, minus occurrences with a `locked` win, minus the caller's `raffle_attendance`.
- `raffle_win_lock_v1(win_id, occurrence_id)` -> `contacted -> locked`, sets qr_token, re-checks under `FOR UPDATE` + the partial unique index (loser gets `spot_taken`), enqueues the QR WhatsApp send (D4).
- `raffle_win_release_v1(win_id)` -> `locked -> released`, `qr_void_at = now()`; eligible again at once.
- `raffle_my_wins_v1()` -> the caller's wins.

Admin (is_admin):
- `admin_raffle_page_v1()` -> ONE read for the rebuilt page: pool summary (eligible/blocked/removed), wins by state, upcoming nights with enabled flag + spot holder (lazy no-show flip runs here).
- `admin_raffle_draw_v1()` -> one random eligible pool row -> `raffle_wins(state='contacted', link_token)`, returns `{win_id, first_name, phone, link}`. Draw + contacted are one click.
- `admin_raffle_night_set_v1(occurrence_id, enabled)` (the toggle; refuses to disable a night holding a `locked` win), `admin_raffle_win_cancel_v1(win_id)`, `admin_raffle_attendance_mark_v1(pool_id, occurrence_id)` (manual tick), `admin_raffle_pool_remove_v1(pool_id, reason)`.

Door (organiser team of the occurrence's series, or admin; D7):
- `door_list_v1(occurrence_id)` -> `[{kind:'raffle'|'ticket', qr_token, first_name, state}]` for the night (pre-save for offline). Raffle rows now; ticket rows added by the ticketing arc on the same RPC.
- `door_scan_v1(payload)` -> parses `r:`/`t:`; raffle: `locked + unused -> attended` (+ `raffle_attendance(source='scan')`); returns `admitted|already_used|voided|unknown` + first name; idempotent so offline replays are safe. Ticket branch stubbed `unknown` until the ticketing arc fills it.

Edge fn: extend `raffle-send-confirmation` with `kind: 'qr'` (template `raffle_winner_qr`, link to the signed-in page which shows the QR). Degrades to `skipped` like today.

## Website

- `src/hooks/useRaffleBoard.ts` replaces `useOpenRaffles`/`useRaffleStats` with `raffle_public_board_v1`; `RaffleBlock` and `pages/Raffles.tsx` both consume it; a vitest asserts both render from one mapping.
- `RaffleEntryDialog.tsx`: calls `raffle_join_pool_v1`, drops `eventId`; keeps the WhatsApp verify flow (`raffleWaVerify.ts` untouched).
- New `src/pages/RaffleWin.tsx` at `/raffle/win/:token` (sign-in gate reusing `Auth.tsx`'s `returnTo`): open nights as 3-col compact cards (explicit px tap targets), one tap locks (confirm sheet), then QR + "Release my spot" (disabled with reason once the night has ended). Breadcrumb id in `siteIa.ts`.
- New `src/pages/Door.tsx` at `/door/:occurrenceId` behind `flags.door` (`VITE_ENABLE_DOOR`): the ONE door scanner for raffle + tickets. Camera via `@zxing/browser` (lazy chunk); "Save tonight's list" stores `door_list_v1` in IndexedDB; offline scans resolve against it and show the name; a queue replays `door_scan_v1` on `online`. Access refusal comes from the RPC. Lives outside `p3/*`.
- Flags: `raffleV2` (entry RPC + winner page + board), `door` (scanner). Both OFF in prod until applied and walked.

## Admin (rebuilt page, D11)

`modules/raffles/` is rewritten; files not listed are deleted once nothing imports them (the per-night entries table, side panel, cutoff editor, presets strip/dialogs, outreach control, CSV exports). Kept: `winnerContact.ts` (`buildWaHref`), `formatPhone.ts`, `WaVerifyBadge.tsx`.
- `RafflePage.tsx` -- one page from `admin_raffle_page_v1`:
  1. **Pool strip**: eligible / blocked (holding a night) / removed; **Draw** -> drawn-person card (first name, phone, WA badge, **Copy WhatsApp message** from `raffleWinnerMessage.ts` + the link, Cancel).
  2. **Winners** grouped by state: waiting to choose, locked (night + QR issued), attended, no-show, released; per row Cancel and the manual **Attended** tick (night picker -> `admin_raffle_attendance_mark_v1`).
  3. **Nights**: every upcoming occurrence (days-ahead control kept), raffle on/off toggle, spot holder's first name, applicant count = pool eligible count; disabled toggle with reason when a night holds a locked win.
- Tests: one table-driven matrix over win state x row rendering; message text test.

## Slices (one branch = one PR = one worker, via dispatch-worker + claude.ai/code UI; branch family `claude/raffle-*`; max 2 live workers across all branches)

| Slice | Repo | Lane | Model | Content |
|---|---|---|---|---|
| R0 | admin | Careful | Opus | Migration: tables, `event_series_p5.raffle_enabled`, eligibility fn, backfills, public board + join RPCs, ACL; **cut-over shim**: `submit_raffle_entry` also upserts `raffle_pool` by phone (old Website + new DB coexist until R3 is live; shim removed in a later Fast PR); self-verify fixture (lock race, no-show flip, release, override refusal, shim) + in-file mutants |
| R1 | admin | Careful | Opus | Winner, door and admin RPCs (incl. relink, redraw); WA verify rekey to pool_id (D15/A3) with tests; edge-fn `kind:'qr'`; Website contract-check scripts (`scripts/check-raffle-v2-*.mjs`) |
| R2 | admin | Normal | Sonnet | Rebuilt raffle page to mockup A (D12) + S5 nudge + series/night switches; deletion of the dead per-night module files |
| R3 | Website | Normal | Sonnet | Shared board hook, entry dialog on the pool, slot-machine copy (D16), raffle page winners board (S2), `rafflesPage` flag ON |
| R4 | Website | Normal | Sonnet | `/raffle/win/:token` page to mockup B (D12) + S4 locked state + expired-link screen |
| R5 | Website | Careful | Opus | `/door/:occurrenceId` shared scanner (S3) with offline list + sync queue (ticketing arc reuses it) |
| R6 | both | -- | Fable | One independent review per PR, replay proof, apply R0/R1 via MCP (read-before/show-after), flags ON, packs, merges |

Order: R0 -> R1 (applied) -> R2, R3, R4, R5 two at a time -> R6 per PR. Nothing public is reachable until flags flip.

**Release 1 = R0-R4**: a working raffle end to end (enter, draw, WhatsApp, pick a night, QR); the door runs on the admin page's Attended tick until the scanner lands. **Release 2 = R5** scanner. Design Gate stage 2 is already done for R2 and R4 (D12); R5 builds to the S3 mockup.

PARKED via the program lead (touches P3, another row): organisers see the free-entry winner in their own Going/Tickets list.

## Verification (definition of done)

1. Shape survey: done above; re-run before R0 apply (counts only).
2. Consistency matrix (vitest): win state x screen (winner page, event page, raffle page, admin page, door) -- one `raffleWinState.ts` mapping per repo; every empty state names the action; lock/release/toggle disabled with a reason when impossible.
3. Migration self-verify: two concurrent locks on one night -> exactly one succeeds; release re-opens; ended + unscanned -> eligible; scan twice -> `already_used`; voided -> `voided`; disabling a locked night refused; backfill counts = survey (531 pool rows, 933 nights enabled, 447 winner phones split past/upcoming).
4. Every CI job per workflow file run by the worker; PR checks green (seo-preview red = known).
5. Walk at 390x844 on the preview as the test account: enter -> admin draw -> link -> sign in -> pick night -> QR -> second account cannot pick it -> release -> night back -> door saves list, goes offline, scans, name shown, back online syncs; admin page toggle + manual tick.
6. Verified / Not verified block per pack; owner phone check once at the end: enter from an event page, receive the WhatsApp, pick a night, scan at a real door.

## Queued upgrades (owner click 2026-10-30; follow-up slices AFTER Release 1, not in this arc)
- **U1 Weighted draw**: never-won (no `attended` win) rows drawn with higher odds in `admin_raffle_draw_v1`; rule stated on the admin strip. Admin Careful (RPC change) + one admin copy line.
- **U2 24-hour reminder**: Meta template `raffle_night_reminder` sent the day before a `locked` night with the release link; scheduled function (pg_cron or edge cron) + webhook outcome logged. Admin Careful.
- **U4 Winners story card**: branded "This week's winners" image via the OG card pipeline, one-tap download/share on the admin page. Admin Normal.
- Declined: U3 scheduled auto-draw (stays parked with D13), U5 organiser self opt-in (P3 row), U6 Wallet pass.

## Not in scope (PARKED)
- Phone-OTP sign-in; door-staff role; cron no-show sweeps; multi-winner nights; dropping the old per-event tables and `raffle_presets`; the ticket branch of `door_scan_v1` (ticketing arc); automatic WhatsApp winner template (D13).
- KNOWN GAP (owner declined 2026-10-30, D15): erase/export of `raffle_pool` + `raffle_attendance` and the "until you ask to be removed" consent copy. Raise again before the pool is opened publicly.
