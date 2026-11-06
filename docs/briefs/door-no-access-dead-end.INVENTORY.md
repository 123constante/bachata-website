# Inventory: Door refused card (CANNOT CHECK TICKETS)

Admin app / public page: no counterpart (door is Website-only, organiser P3). Coverage is Website only.

| # | Item | Where | Covered |
|---|------|-------|---------|
| 1 | not_allowed result row (headline, sub, detail, actions none) | src/modules/organiser/p3/door/model.ts:106-111 | yes (detail reworded) |
| 2 | Refused from list read (Scan tab) | src/modules/organiser/p3/door/DoorScreen.tsx ScanTab notAllowed | yes |
| 3 | Refused from list read (List tab) | src/modules/organiser/p3/door/DoorScreen.tsx ListTab d.result | yes |
| 4 | Refused from a typed/scanned code (shown.kind) | DoorScreen.tsx notAllowed; ListTab now also honours it | yes |
| 5 | Check again control (door-act-recheck), disabled "Checking..." | ResultCard | yes |
| 6 | Back to events link (door-notallowed-back) to P3_PATHS.events | ResultCard; shell/paths.ts:11 | yes |
| 7 | Recheck ok replaces card; refused/network error keeps it, no toast | Door recheck() | yes |
| 8 | 0 sold with refusal | matrix zero_sold | yes |
| 9 | Signed-out state (separate card) | DoorScreen.tsx door-signed-out | n/a, unchanged |

Coverage: 8 covered / 8 applicable (1 n/a).

## Handover
Done: both controls, reworded detail, matrix (10 cells, red on unfixed code), model row. door tests 93/93, tsc 0 errors on 20c9903, check:mojibake clean.
Left: 390x844 browser walk + screenshot; full pre-ship / CI-step run; /code-review round.
