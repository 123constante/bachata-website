# Handover: festival-day-tickets-slice2b

Status: DONE (code), PR #1741 open against main (title/body updated). Supersedes the earlier BLOCKED note: on
2026-11-17 the live v3 door functions gained a NULL-occurrence branch (server picks the
series' earliest night that has not ended), so the screen sends `p_occurrence_id: null`.

## What changed
- `src/modules/organiser/p3/door/data.ts`: ticket_check_in_v3 / _by_code_v3 / _by_id_v3 and
  ticket_door_list_v3, all with `p_occurrence_id: null` (no night picker added).
  parseCheckIn knows wrong_night, wrong_day, add_on_not_admission, unclassified_festival_type;
  v3's `refunded` / `void` show as NOT VALID; any other unknown value -> CODE NOT RECOGNISED
  (the existing generic refusal, never LET IN). parseDoorList accepts list `wrong_night`.
- `model.ts`: four new RESULT_TABLE rows (brief copy; wrong_night had no door wording before,
  so it uses "This ticket is for a different night", same idea as the guest-list scan copy).
  Festival pass already used on this door day: v3 answers `already_in` -> existing ALREADY IN.
- `DoorScreen.tsx`: list answer wrong_night (series has no night left) -> "No night of this
  event is on now" card with Back to scanning, instead of a load error.
- `types.ts`: v3 entries added only. door_scan_v1 is not called by the Website (types only).
- e2e route mocks renamed v1 -> v3; tests: door.v3.matrix (names+args, every refusal,
  refunded/void, unknown fallback), door.listShape wrong_night shape.

## Not verified
- No live walk against prod data (no festival door session); e2e specs not run locally.
- door_day / valid_day are parsed by nothing yet (no UI asked for them).

## Checks
- tsc 0 errors; door vitest 429/429; check:mojibake clean; e2e ticket-door-scanner 13/13,
  ticket-door-code pass (door code flag on). npm run lint red on main already (check:no-social-word,
  priceSteps.matrix.test.tsx, untouched). CI per job: not read here (no gh api); see PR #1741.
