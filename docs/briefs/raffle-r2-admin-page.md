# Brief R2 -- Raffle v2 admin page rebuild to mockup A (admin, normal lane, Sonnet)

Context cap 30%. Push an early checkpoint commit as soon as the new page renders; push again before every pause. If you reach 30% before Done, commit what you have with subject ending `PARTIAL [worker-done raffle-r2]` and a "what is left" list in `docs/handover/raffle-r2-admin-page.md`. Supabase READ-ONLY (never apply, never write). Never `gh api`, never `--no-verify`, never print a secret. You NEVER merge or approve.

- **Repo:** `123constante/bachata-admin`
- **Branch:** `claude/raffle-r2-admin-page`, **based on `claude/raffle-r1-rpcs`** (R1 defines every RPC this page calls). PR base `claude/raffle-r1-rpcs`; the orchestrator retargets to `main` once R0/R1 merge.
- **Model / lane:** Sonnet, Normal lane (UI only; no SQL, no edge fn).
- **This brief lives in the WEBSITE repo**: in a plain clone of `123constante/bachata-website`, `git fetch origin claude/raffle-briefs && git show FETCH_HEAD:docs/briefs/raffle-r2-admin-page.md`.

## Owner decisions that bind this slice (2026-10-30, plan `brief/raffle-v2-plan` in the Website repo)
- **D11** One page, pool-first: (1) pool summary + **Draw** + drawn-person card (Contacted, open WhatsApp); (2) winners grouped by state with **Cancel** and a manual **Attended** tick; (3) upcoming nights with raffle on/off switch, spot holder, applicant count = pool eligible count. The per-night entries panel, cutoffs, presets and per-night contacted/won marks are REMOVED.
- **D12** Build to **mockup A: single column** (strip + draw card, winners grouped by state, nights table with switches): https://claude.ai/artifact/6etRLTgKVcdtYYT2nntH94 . Design Gate stage 2 is DONE; no new mockups.
- **D13** WhatsApp: primary button = `buildWaHref(phone, message)` (wa.me, opens WhatsApp pre-filled, admin presses Send). Drawing already marks the win `contacted` (R1 `admin_raffle_draw_v1` inserts it as `contacted`), so the tap only opens WhatsApp. Secondary = **Copy message**. No automatic template send.
- **D14 / S5** A `contacted` row turns red after **3 days** (`stale` flag from `admin_raffle_page_v1`, computed server side from `contacted_at`); it shows **Message again** (re-opens the same wa.me link with the row's `link`) and **Release and redraw** (= `admin_raffle_redraw_v1(win_id)`, one call).
- **D15 / A1** Nights table carries a **series switch** (`admin_raffle_series_set_v1`) and the **per-night switch** (`admin_raffle_night_set_v1`, `null` = clear the override). **A2** row button **New link** (`admin_raffle_win_relink_v1`) on `contacted` rows; links expire 7 days after contact.
- **D6** Public winner name is first name only; `show_winner_publicly` is retired (do not render a toggle for it).
- Kept from the old module: `winnerContact.ts` (`buildWaHref`), `formatPhone.ts`, `WaVerifyBadge.tsx`.

## Read first
1. The plan: in the Website repo, `git fetch origin brief/raffle-v2-plan && git show FETCH_HEAD:docs/briefs/raffle-v2-plan.md` (sections "Admin (rebuilt page, D11)" and "Slices").
2. R1 brief `git show origin/brief/raffle-r1-rpcs:docs/briefs/raffle-r1-rpcs.md`, section B -- the exact JSON shape of `admin_raffle_page_v1(p_days_ahead)`, and the R1 migration on your base branch (`supabase/migrations/99990102000000_raffle_v2_rpcs_v1.sql`; the number may have been renumbered -- find it by name `raffle_v2_rpcs_v1`). The shapes in the migration win over this brief.
3. R0 handover `git show origin/claude/raffle-r0-schema:docs/handover/raffle-r0-schema.md`: the 766 backfilled attendance rows, 20 backfilled `contacted` wins with a fresh 7-day link, 48 removed `erased:` tombstone pool rows named `(unknown)`, and `total_winners` counting (pool row, night) pairs.
4. The current page and its imports: `pages/RafflesPage.tsx`, `App.tsx` (the `raffles` and `raffle_contacts` routes), every file in `modules/raffles/`, and the admin `CLAUDE.md` + `.claude/rules/*` that match the files you touch.
5. The mockup A artifact above (read it with the Artifact tool's `read` action, not a web fetch).

## Do (numbered, each testable)
1. **Data hook** `modules/raffles/v2/useRafflePageV2.ts`: one React Query read of `admin_raffle_page_v1({p_days_ahead})`, plus one mutation helper per write RPC (`admin_raffle_draw_v1`, `admin_raffle_redraw_v1`, `admin_raffle_win_relink_v1`, `admin_raffle_win_cancel_v1`, `admin_raffle_series_set_v1`, `admin_raffle_night_set_v1`, `admin_raffle_attendance_mark_v1`, `admin_raffle_pool_remove_v1`) that invalidates the page read on success. Every `{ok:false, reason}` maps to one sentence through one table (`raffleV2Reasons.ts`, covering at least `pool_empty`, `holds_locked_win`, `link_expired`, and an unknown-reason fallback); test: every reason the R1 migration can return has a row (grep the migration text in the test, as `raffleReasonCodeContract.test.ts` does today).
2. **One state mapping** `modules/raffles/v2/raffleWinState.ts`: win `state` (+ `stale`) -> group heading, tag label, tag colour token, which row actions show, and the disabled reason for any action that cannot work. Groups in this order: Waiting to choose (`contacted`), Locked (`locked`), Attended, No-show, Released, Cancelled. Nothing else on the page spells these words.
3. **Pool strip** (top of page): eligible / holding a night / waiting / removed counts from `pool.*`; **Draw** button. Draw with an empty pool is not possible: when `pool.eligible = 0` the button is disabled with the reason "Nobody is eligible to draw".
4. **Drawn-person card** shown after a draw: first name, formatted phone (`formatPhone.ts`), `WaVerifyBadge`, **Open WhatsApp** (primary, `buildWaHref(phone_e164, message)` with the `message` the RPC returned -- do NOT build the text client side; R1 holds the one template constant), **Copy message**, **Cancel** (= `admin_raffle_win_cancel_v1`). No other button on the card (D11).
5. **Winners** grouped by state from item 2. Per row: first name, phone, night (title + London date, display `start_local` as stored), timestamps. Actions per item 2: `contacted` -> Open WhatsApp / Copy / **New link** / Cancel; stale `contacted` -> red row + **Message again** + **Release and redraw**; `locked` -> Cancel + **Attended** tick; `no_show` -> **Attended** tick. The Attended tick opens a night picker (default = the row's night) and calls `admin_raffle_attendance_mark_v1(pool_id, occurrence_id)`. Confirm before Cancel and before Release and redraw.
6. **Nights** table: every row of `nights[]`; days-ahead control (keep today's control and its default); columns: night (title, date, venue), series switch (`series_raffle_enabled`), per-night switch showing the effective state `is_open` with the override marked ("forced on" / "forced off" / "from series") and a "Use series setting" action that sends `p_enabled: null`; spot holder first name; applicant count = `pool.eligible` (same number on every row, per D11). A switch that would turn off a night or series holding a locked win is disabled with the reason "A winner holds this night" (`can_disable = false`).
7. **Wire the page**: `App.tsx`'s `raffles` route renders the new page (name it `pages/RafflesPage.tsx` rewritten in place or `pages/RafflePageV2.tsx` swapped in; your call, one route, no flag -- the admin is internal and R0/R1 apply before this merges).
8. **Delete the dead files**: after item 7, delete every `modules/raffles/*` file that nothing imports any more (prove each with `grep -rn "<basename>" --include=*.ts --include=*.tsx . | grep -v node_modules`), plus their now-orphaned tests. **Do NOT delete** anything still imported by `pages/GuestListPage.tsx` or `pages/RaffleContactsPage.tsx` (the guest-list feature and the contacts page are not in this arc; `GuestList*`, `guestList*`, `StandingListPanel`, `AddEventToGuestListDialog`, `useRaffleContacts`, `raffleContactsCsvExport`, `EntrantPhoneHistory` etc. stay if imported). List every deleted file in the PR body.
9. **Tests (vitest)**: (a) table-driven matrix: every win state x (stale true/false) x row rendering -> heading, tag, visible actions, disabled reasons, from `raffleWinState.ts`; (b) drawn card uses the RPC `message` verbatim in the wa.me href (assert `encodeURIComponent(message)` is in the href) and Copy copies the same text; (c) nights: `can_disable=false` -> switch disabled with the reason; override null/true/false -> the three labels; (d) empty states: no wins -> "Nobody has been drawn yet. Press Draw to pick a winner."; no nights in range -> "No upcoming nights in the next N days. Widen the range or switch a series on."; empty pool -> Draw disabled with reason; (e) untouched page sends no write RPC (render, interact with nothing, assert no mutation call); (f) `(unknown)` tombstone names and a null night render without crashing.

## Must NOT touch
- Any `supabase/migrations/*`, `supabase/functions/*`, SQL or edge fn (R0/R1 own them). If an RPC shape is wrong, stop and write it under Open questions in the handover.
- `pages/GuestListPage.tsx`, `pages/RaffleContactsPage.tsx` and every file they still import.
- The Website repo.
- `buildWaHref` / `formatPhone` behaviour (reuse, do not change).

## Design gate (visible change)
1. Stage 1-2: DONE (D12, mockup A). Build to it; where the build must differ (a control the RPC cannot back), say so in the PR body with the reason.
2. Stage 3: use the admin's existing tokens/components; no new colours except the S5 red row, which must use an existing danger token.
3. Stage 4: screenshots at 390x844 AND 1280x800 in `docs/handover/raffle-r2-admin-page/`: pool strip + drawn card, every winner group (with one stale row), nights table with a disabled switch, each empty state. Put mockup-vs-build notes next to them.
4. Stage 5 critique and stage 6 walk are the orchestrator's (R6). Do not mark them done.

## Done =
- PR (bot-authored, normal path) titled `feat(raffle): R2 admin raffle page rebuilt pool-first (mockup A)`, base `claude/raffle-r1-rpcs`, body with:
  - **Verified on real data**: *Shapes surveyed* (read-only counts on prod `stsdtacfauprzrdebmzg`, run against the OLD tables because R0/R1 are not applied: live entry phones (531), backfilled contacted wins expected (20), tombstones (48), raffle-on series (53), upcoming nights on them; state in one line how each shape is covered by the matrix); *Checks run* (every step of every admin CI job that applies to the PR -- read `.github/workflows/*.yml` -- as a per-job table, plus the vitest matrix); *NOT verified* (at least: the page against applied R0/R1 on a real database, since nothing is applied; real WhatsApp open on a phone).
  - **Phone QA**: Sizes checked (390x844, 360x640), Walked, Not verified.
  - The deleted-files list and the mockup deviations.
- Handover `docs/handover/raffle-r2-admin-page.md` (Done / Measured / Not done / Next).
- Final commit subject ends `[worker-done raffle-r2]` (or `PARTIAL [worker-done raffle-r2]`).

## Open questions for the owner (plan is silent; do not decide in code -- build the default named here only if it is reversible, and list it in the PR)
1. **Message text source.** The plan names a client file `raffleWinnerMessage.ts`; R1 builds the text in SQL and returns it as `message`. This brief uses the RPC's text (one copy). Owner to confirm.
2. **Remove from pool** (`admin_raffle_pool_remove_v1`) is an RPC but D11 lists no control for it. Default: no control on this page; confirm whether the owner wants a row action and with which reasons.
3. **Days-ahead default** for the nights table: keep today's value (what is it?) or the RPC default 30.
4. **Cancelled / released history window**: R1 returns terminal wins from the last 30 days. Show all of them, or collapse terminal groups by default?
5. **CSV export** of winners: the old page had exports; D11 removes them. Confirm nothing replaces them.
