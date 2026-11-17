# Organiser slice 3 handover: read-only sheets (Who is in / Who came)

Branch `claude/organiser-slice3-sheets`, brief `brief/organiser-slice3-sheets:docs/briefs/organiser-slice3-sheets.md`.
Ticket dt_dc05a97e1418.

## Done
- `p3/sheets/sheetsModel.ts`: pure models `whoIsInOf` / `whoCameOf` built from ONE `ticket_door_list_v3`
  answer (rows carry `first_name` = buyer's first name, `checked_in_at`). No name = "Guest". Counts but no
  rows = "Names are not available yet." Server cap (500 rows) = says the headline is the full count.
  Zero is never a big headline; the list's empty sentence says it. Link rules (`whoIsInLinkOf`,
  `whoCameLinkOf`, `eventWhoIsInLinkOf`): no link for draft, cancelled, ended, archived, or no night to come.
- `p3/sheets/WhoSheets.tsx`: routes `events/:seriesId/in` (occurrence null = tonight, the server picks the
  night) and `events/:seriesId/came/:occurrenceId`, lazy, behind `organiserDash`. Pushed: tab bar hidden in
  both shells. `?from=home|compare|event` sets back; anything else goes back to the event page.
- Reader: `fetchDoorNight` in `p3/dash/pastNights.ts` (the existing count read now goes through it; 42501 maps
  to SignedOutError). `PastNight.occurrenceId` added.
- Entry points: Home night hero "See who is in", Home day-after big number "See who came", Compare nights rows
  with a door count, and the event page "Who is in" row.
- No `p3/tickets/*` or `p3/door/*` file changed (read-only imports only). No calendar density file touched.
- Tests: `p3/sheets/__tests__/sheets.matrix.test.tsx` (night/after x zero/some/many(150) x seat, null name,
  names missing, cap, cancelled, draft, 13 weekly dates, pushed, back). Red on `main` (module missing).

## Not done / next
- Not walked live with a signed-in organiser (cloud has no auth). Needs a laptop walk with
  VITE_ENABLE_ORGANISER_P3, _DASH, _SELF_SERVE (and _SHELL_V2 for the V2 frame).
- With `organiserShellV2` on, Home is not a tab (V2Home goes to Events), so in V2 the only entry is the
  event page row. That is slice 1/2 behaviour, unchanged here.
- The sheet and Door screen keep separate caches of the same RPC (sheet stale up to 30s after a Door scan).
- Rows are per ticket: a 3-ticket order shows the buyer's name 3 times (the server sends no order id).

## Status
- PR: #1759 (bot-opened from the first push; title and body updated, both body checkers exit 0).
- tsc run on 003030b: 0 errors in branch files (`tsc --noEmit -p .` 0 total; `tsconfig.app.json` 136 = origin/main's 136).
- pre-ship: every gate PASS except test:unit (sandbox-only network contract + integrityCouldNotRun, same on main)
  and the typecheck ratchet (stale baseline 106; main is 136 too). e2e was skipped by pre-ship as a result.
- Not verified: live signed-in walk (needs a laptop walk with the flags), PR CI checks (no gh access here).
