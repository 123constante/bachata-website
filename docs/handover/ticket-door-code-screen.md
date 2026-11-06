# Handover &mdash; door-code check-in screen (dt_b1d737ccfb4c)

Branch `claude/ticket-door-code-screen`. Brief `docs/briefs/ticket-door-code-screen.md` on
`brief/ticket-door-code-screen`. Inventory `docs/design/ticket-door-code-screen/INVENTORY.md`.
Walk pictures (390x844, dark): `docs/walk/ticket-door-code-screen/1..8`.

## Done

- Extended the existing P3 door screen (`src/modules/organiser/p3/door/*`). No new screen.
  New own flag `ticketDoorCode` (`VITE_ENABLE_TICKET_DOOR_CODE`, **OFF**), in
  `door/doorFlags.ts` rather than `src/lib/featureFlags.ts` so the change adds 0 bytes to any shared chunk.
  It only matters where `organiserTicketing` + `organiserP3` already mount the door.
- Flag ON: the code box accepts the 6-character short code (case, spaces and dashes ignored,
  as the RPC does) and calls `ticket_check_in_by_code_v1`. A long QR token or URL still goes to
  `ticket_check_in_v1`. A malformed short code is blocked with a reason and never sent, because
  it would cost one of the 20 tries.
  Every Not-in row on Tonight&rsquo;s list gets a **Check in** button (`ticket_check_in_by_id_v1`).
- ONE mapping: `RESULT_TABLE` gains `too_many_attempts`, which says to wait up to 15 minutes. Its
  one action is Open tonight&rsquo;s list, where a banner says to tap Check in.
- One check at a time across the code box and the list (no double submit). A row shows
  Checking&hellip; while pending. Other rows are aria-disabled, with a reason line.
- Flag OFF (as measured, review 1294-r1 probe P1): the r1 head had two harmless flag-off differences from main (an empty-submit reason line, and a "Checking" label on the camera-dead list code box). r2 gates both behind `shortCodes` (matrix test "F7"); the existing 82 door tests are unchanged and green. `RESULTS` still accepts `too_many_attempts` with the flag off, unreachable because `ticket_check_in_v1` never returns it (prod body read by the review).

## Evidence

- Red first: `door.shortCode.matrix.test.tsx` on the unfixed code: 168 failed / 50 passed of 218.
  Fixed: all 4 door test files, 300/300.
- Matrix: 5 roles (owner, manager, contributor, admin, off-team; prod roles are owner/manager/contributor, contributors are allowed) x 8 results x 3 shapes (empty, 1, 120)
  for typed codes, and 5 x 7 x 2 for list check-in. Also copy-to-control checks, button hygiene and flag off.
- Bundle (`check:bundle-budget`, prod flags): every route identical to main, and every built
  chunk filename (content hash) is identical too.
- `npm run lint` exit 0; `check:images` (AUDIT_STRICT=1) 0 issues; `check:integrity` ok;
  `tsc` adds no error in the touched files (the errors that remain are already on main, in other files).
- e2e `tests/e2e/ticket-door-code.spec.ts` 4/4 with flags on. It skips itself with flags off, and is NOT
  added to `test:e2e` (it would only skip there).

## Not verified / left

- Admin repo source (`20270314140000_ticket_door_short_code_v1.sql`, admin check-in tools):
  no access from this session. The RPC bodies were read from prod `pg_proc` instead.
- **Whether the buyer ever sees `short_code`** (ticket email / thanks page): not verified. The
  Website shows it nowhere. If the email does not print it, the short code cannot be used at the
  door yet. Check that before turning the flag on.
- Real phone, real staff account, real RPC: not done (no writes allowed; prod has 0 check-ins).
- Full CI jobs (unit suite, e2e gate, db-contract) were not all run locally. See PR checks.
