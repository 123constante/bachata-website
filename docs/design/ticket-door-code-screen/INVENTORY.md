# INVENTORY &mdash; door-code check-in screen (dt_b1d737ccfb4c)

Step 0 of `docs/briefs/ticket-door-code-screen.md` (branch `brief/ticket-door-code-screen`).
Sources: this repo on `origin/main` 7748023; prod `stsdtacfauprzrdebmzg`, read-only `SELECT`s of
`pg_proc` / `information_schema` / `supabase_migrations` on 2026-11-03.

## 1. Existing door / scan screens in the Website

| # | What | Where (file:line on main) | Notes |
|---|---|---|---|
| 1 | Door screen route `/account/p3/events/:seriesId/door` | `src/modules/organiser/p3/shell/P3Routes.tsx:81` | behind `flags.organiserTicketing` (OFF in prod) |
| 2 | Entry row "Scan tickets" on the P3 event page | `src/modules/organiser/p3/screens/EventPage.tsx:256` | same flag |
| 3 | Door screen (Scan tab, code box, Tonight&rsquo;s list tab) | `src/modules/organiser/p3/door/DoorScreen.tsx` | list was READ-ONLY (main `:27-31`, `:336`) |
| 4 | Result mapping (ONE table) | `src/modules/organiser/p3/door/model.ts:70` `RESULT_TABLE` | 6 RPC results + `no_signal` |
| 5 | RPC calls | `src/modules/organiser/p3/door/data.ts:41` (`ticket_check_in_v1`), `:84` (`ticket_door_list_v1`) | 42501 &rarr; signed-out card |
| 6 | Camera | `src/modules/organiser/p3/door/camera.ts` | untouched |
| 7 | `/door` raffle scanner brief | `docs/briefs/raffle-r5-door-scanner.md` | separate screen; ticket branch stubbed, not touched |
| 8 | `src/pages/Tonight.tsx` | dancer &ldquo;tonight&rdquo; listing | NOT a door list; unrelated |
| 9 | Old `src/modules/organiser/tickets/*` | retired (redirects to P3) | untouched |

No Website code called `ticket_check_in_by_id_v1` or `ticket_check_in_by_code_v1` before this
branch (`grep -rn "check_in_by" src` empty on main).

## 2. Admin check-in tools

Not verified from source: this session cannot read `bachata-admin-11april` (`add_repo` denied:
no access). What prod proves instead: the migration ledger has
`20270314140000 ticket_door_short_code_v1` (applied; the brief&rsquo;s admin #1132), and
`20261029181607 ticket_check_in_v1`. The admin repo&rsquo;s own check-in UI and whether the
ticket email prints `short_code` are **Not verified**.

## 3. The RPCs (bodies read from prod `pg_proc`)

Both: `SECURITY DEFINER`, `RETURNS jsonb`, `EXECUTE` granted to `authenticated`, not `anon`.
Reply shape = `_ticket_door_shape_v1` (`result`, `ticket_type_name`, `first_name`, `quantity`,
`checked_in_at`, `checked_in_by_first_name`, `in_count`, `total_count`), same as
`ticket_check_in_v1`, so `parseCheckIn` (`data.ts:24`) reads both unchanged.

### `ticket_check_in_by_code_v1(p_code text, p_event_series_id uuid)`

| Result | When (body order) |
|---|---|
| ERROR 42501 | `auth.uid()` null |
| `not_allowed` | caller is not admin / owner / manager / contributor of any organiser selling this series (`_ticket_door_orgs_v1`) |
| `too_many_attempts` | &ge; 20 rows in `ticket_door_code_attempts` for this user in the last 15 minutes (checked BEFORE the lookup: even a right code is refused) |
| `unknown_code` | normalised code (upper, spaces and dashes stripped) is not `^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$`, or no ticket of THIS series has it; inserts one attempt row |
| core &rarr; `ok` / `already_in` / `not_valid` / `unknown_code` / `wrong_event` | see core below; a right code never counts as an attempt |

A code from ANOTHER series answers `unknown_code` (the lookup is series-scoped), never `wrong_event`.

### `ticket_check_in_by_id_v1(p_ticket_id uuid, p_event_series_id uuid)`

| Result | When |
|---|---|
| ERROR 42501 | not signed in |
| `not_allowed` | as above |
| core results | `_ticket_check_in_core_v1` |

No rate limit: this is the fallback while typed codes are paused.

### `_ticket_check_in_core_v1` (shared)

`ok` (the UPDATE matched: valid, not in, paid, this series) &middot; `unknown_code` (no such ticket,
or caller not on that ticket&rsquo;s organiser team) &middot; `wrong_event` &middot; `not_valid`
(void or order not paid; also a concurrent change, fail closed) &middot; `already_in`.

## 4. Data source for `short_code`

- `public.tickets.short_code text NOT NULL DEFAULT _ticket_short_code_new_v1()` (prod
  `information_schema.columns`).
- Writer: the column DEFAULT only; no trigger on `tickets` (`pg_trigger` empty, non-internal).
  `_ticket_short_code_new_v1()` draws 6 chars from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` with
  rejection sampling and retries until unused (max 50); `EXECUTE` not granted to
  `authenticated`/`anon`.
- Reader: `ticket_check_in_by_code_v1` and `ticket_door_list_v1` (rows carry `short_code`).
- Prod shape (counts only): 6 tickets, 6 with a code, all length 6; 1 series has tickets (max 6
  per series); 0 checked in; 0 rows in `ticket_door_code_attempts`.

## 5. Every result code &rarr; this branch

| Result | Source | Mapping row | Next action |
|---|---|---|---|
| ok | all 3 RPCs | `RESULT_TABLE.ok` | Scan next |
| already_in | all 3 | `already_in` | Scan next |
| wrong_event | all 3 (by-code: only via core) | `wrong_event` | Scan next |
| not_valid | all 3 | `not_valid` | Scan next |
| unknown_code | all 3 | `unknown_code` | Type code / Scan next |
| not_allowed | all 3 | `not_allowed` | none (ask the organiser) |
| too_many_attempts | by-code only | `too_many_attempts` (new) | Open tonight&rsquo;s list &rarr; Check in |
| no_signal (network) | client | `no_signal` | Open tonight&rsquo;s list |
| 42501 signed out | all 3 | signed-out card | Sign in again |

## COVERAGE COUNT

RPC result codes: by-code 7 + 42501, by-id 6 + 42501, core 5. Distinct codes 7 + client
`no_signal` + 42501 = **9 / 9 mapped** (8 in `RESULT_TABLE`, 42501 in `isSignedOut`).
Door screens inventoried: 1 live (flagged) + 1 brief-only (`/door`). Admin tools: 0 read (no access).
