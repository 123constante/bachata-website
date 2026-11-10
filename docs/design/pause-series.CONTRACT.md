# ACCEPTANCE CONTRACT: pause a series from the website (DRAFT 2, 2026-11-10, website-50)

Status: DRAFT 2. Not yet reviewed (review of DRAFT 2 is next). No slice dispatched. Inventory: pause-series.INVENTORY.md. Owner answers: ~/.claude/plans/buzzing-sauteeing-beacon.md.

## 1. Lead constraints (website-8e, 2026-11-10)
(1) Admin migration sequences AFTER courses-owner-set-recurrence merges and cites its signatures. (2) Sold-ticket rule: night-aware tickets (#1352 S1a) not merged; state the count and mark NOT VERIFIED. (3) Cover rule-less series. (4) Careful lane, access-focused review, one GRANT list to the owner. No dispatch before the lead sees this.

## 2. Owner decisions (binding)
P1 any team organiser pauses. P2 "Pause series" in the event's status area. P3 two choices: until I resume / until a date (calendar). P4 block while upcoming nights have tickets sold. P5 confirm sheet. P6 after pausing: Change date / Resume now / Make open-ended. P7 organiser banner "Paused until D". P8 reminder 7 days before. P9 on the date ask the organiser to confirm; no confirm: nudge daily 3 days, then auto-resume. P10 public banner "Back on D" or "On a break. Follow the organiser for news." P11 page stays, hidden from calendar/search/new lists. P12 no follower notices in v1. P13 all recurring events incl. courses. P14 success = organisers pause/resume without asking the team.

## 3. Lead design choices (logged, reversible)
- D1 Website "Hide" (one tap, = paused today, eventPage.ts:293-296) is replaced by "Pause series" with the confirm sheet; "Show" becomes "Resume now". One-off events keep Hide wording? NO: one-offs are not series pauses; keep their current Hide/Show unchanged (scope = recurring formats: recurring, course; one_off excluded).
- D2 Sold-ticket block counts PAID orders on the series with at least one non-cancelled upcoming occurrence, series-level, until S1a lands (NOT VERIFIED per-night). Message names the series, not nights, until then. Pause is refused by the database function, not only the screen.
- D3 Auto-resume runs through the same publish-readiness gate. If the gate blocks, the series stays paused and the organiser is told why (nudge copy), never silently live and never silently stuck.
- D4 Never-ran series (no past date) 404s while paused (existing rule, 830000). The sheet says so: "Not run yet: its page is offline while paused."
- D5 Reminder/nudge channel: email to the organiser team owners via a new outbox row + edge function (pattern 20261109660000 / todo-deadline-email on origin/main). In-app to-do card if the to-do machinery exists at slice time (NOT VERIFIED).

## 4. Person types
O1 owner/manager of the page; O2 contributor/roster editor (can edit, cannot pause: `_assert_can_edit_series_p5` allows them, but P1 says team organiser; DEFAULT: owner+manager only, matches series.set_lifecycle permission_denied text); O3 admin; O4 dancer on public page; O5 organiser with no membership (refused).

## 5. Data shapes (series) with PROD counts (read-only, project stsdtacfauprzrdebmzg, 2026-11-10)
Total series 766. Live recurring+course 55. Paid orders on prod: 2 (statuses seen: expired, paid, refunded). Max scheduled nights in one series 125 (over the 100-row API cap: night lists must page); max upcoming in a LIVE series 56. Live series 55 (under the cap).

| Shape | Description | Prod n | Pause offered? |
|---|---|---|---|
| S1 | live recurring, has rule, ran, upcoming nights, no ticket types | 34 | yes |
| S2 | live recurring, rule, NEVER ran, upcoming, ticket types, no paid | 1 | yes (page offline while paused, D4) |
| S3 | live recurring, rule, ran, ticket types, PAID sale | 1 | blocked (D2) |
| S4a | live recurring, NO rule, ran, upcoming | 1 | yes |
| S4b | live recurring, NO rule, never ran, upcoming | 1 | yes (page offline while paused) |
| S4c | live recurring, NO rule, ran, NOTHING upcoming | 9 | no: nothing to pause (R2) |
| S5a | live course, rule, upcoming | 3 (2 ran, 1 never ran) | yes |
| S5b | live course, finished, NOTHING upcoming | 5 | no (R2) |
| S6 | already paused recurring/course | 0 (fixture needed) | shows Change date / Resume now / Open-ended |
| S7 | draft / archived / ended recurring or course | draft 8, archived 13, ended 23 | no (R1) |
| S8 | one-off or festival (live 11 / 9) | 20 live | no: not a series pause (R4); one-off keeps Hide/Show |
| S9 | resume date reached while the publish gate blocks | 0 (fixture) | n/a data state |
Rule-less live recurring = 11 (S4a+S4b+S4c) which matches website-81. One paused row exists today: a never-ran one-off (404 by the 830000 rule).
Rows the sold-ticket block affects on prod today: 1 series (S3). Per-night counts: NOT VERIFIED until S1a (#1352) lands; ticket_types already has occurrence_id on prod, ticket_orders does not.

## 6. Journeys (each cell tested, screen x shape)
J1 pause until date (S1-S4). J2 pause open-ended. J3 pause refused for sold tickets (S3,S6) with next step. J4 change date. J5 make open-ended. J6 resume now (gate pass/block). J7 reminder at -7 days. J8 resume-day confirm; J9 no-confirm nudges days 1-3 then auto-resume; J10 auto-resume blocked by gate; J11 public page while paused with/without date, with/without past date; J12 refused for O2/O4/O5; J13 untouched sheet sends nothing; J14 double-tap / two organisers pausing at once.

## 7. Slices (sequenced)
- A0 docs (this contract, inventory).
- A1 ADMIN DB (careful): add `resume_on date` + `resume_confirmed_at`/nudge state to event_series_p5 (or side table); extend set_lifecycle payload `{to, resume_on?}`; sold-ticket refusal; clear on non-paused; daily SQL job auto-resume (London date); snapshot exposes resume_on; reminder/nudge outbox. Sequenced after courses-owner-set-recurrence merges and after migration numbering is re-read from origin/main. GRANT list to owner once.
- A2 Website screens: Pause sheet (confirm), paused card with Change date / Resume now / Open-ended, resume-day confirm card, public banner copy. Behind existing flag state; no change for one-offs.
- A3 notices: reminder email + nudges (edge function).
- A4 independent walk at 390x844 on prod-shaped data.

## 8. Not verified
Per-night ticket counts (S1a). Prod shape counts. To-do machinery presence. Whether `_event_publish_blocking_reason_v1` can block a previously-live series. Real-phone check.

## 9. Coverage matrix (DRAFT 2)
Reason codes for N/A: R1 lifecycle not live/paused so no pause control; R2 nothing upcoming to pause; R3 role not permitted (database refuses); R4 not a recurring/course series; R5 public-only journey; R6 shape needs a fixture (0 on prod); R7 journey needs the series to be paused first.

### 9a. Person x journey
| Journey | O1 owner/manager | O2 contributor | O3 admin | O4 dancer | O5 no membership |
|---|---|---|---|---|---|
| J1 pause until date | yes | R3 | yes (admin app, unchanged) | R3 | R3 |
| J2 pause open-ended | yes | R3 | yes | R3 | R3 |
| J3 refused: paid sales | yes | R3 | yes (same DB refusal) | R3 | R3 |
| J4 change date | yes | R3 | yes | R3 | R3 |
| J5 make open-ended | yes | R3 | yes | R3 | R3 |
| J6 resume now | yes | R3 | yes | R3 | R3 |
| J7 reminder -7d | yes (receives) | R3 | n/a (no email) | R3 | R3 |
| J8 resume-day confirm | yes | R3 | yes | R3 | R3 |
| J9 nudges then auto | yes | R3 | R3 | R3 | R3 |
| J10 auto-resume gate blocked | yes (told why) | R3 | yes | R3 | R3 |
| J11 public page while paused | n/a (R5) | R5 | R5 | yes | R5 |
| J12 refused role | n/a | yes (must be refused) | n/a | yes (refused) | yes (refused) |
| J13 untouched sheet sends nothing | yes | R3 | R3 | R3 | R3 |
| J14 two organisers at once | yes | R3 | R3 | R3 | R3 |
Cell totals: NOT TALLIED by script yet. The reviewer counts them and every non-"yes" cell must carry a reason code.

### 9b. Journey x data shape (O1 unless noted)
| Journey | S1 | S2 | S3 | S4a | S4b | S4c | S5a | S5b | S6 | S7 | S8 | S9 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| J1 | yes | yes | blocked (=J3) | yes | yes | R2 | yes | R2 | R7 | R1 | R4 | R7 |
| J2 | yes | yes | blocked | yes | yes | R2 | yes | R2 | R7 | R1 | R4 | R7 |
| J3 | R6 note: no paid except S3 | no paid | yes | no paid | no paid | R2 | no paid | R2 | R7 | R1 | R4 | R7 |
| J4 | R7 | R7 | R7 | R7 | R7 | R7 | R7 | R7 | yes | R1 | R4 | yes |
| J5 | R7 | R7 | R7 | R7 | R7 | R7 | R7 | R7 | yes | R1 | R4 | yes |
| J6 | R7 | R7 | R7 | R7 | R7 | R7 | R7 | R7 | yes | R1 | R4 | yes (gate) |
| J7 | after J1 | after J1 | R3 | after J1 | after J1 | R2 | after J1 | R2 | yes | R1 | R4 | R7 |
| J8 | R7 | R7 | R7 | R7 | R7 | R7 | R7 | R7 | yes | R1 | R4 | yes |
| J9 | R7 | R7 | R7 | R7 | R7 | R7 | R7 | R7 | yes | R1 | R4 | yes |
| J10 | R7 | R7 | R7 | R7 | R7 | R7 | R7 | R7 | R6 | R1 | R4 | yes |
| J11 | yes | yes (404) | n/a blocked | yes | yes (404) | R2 | yes | R2 | yes | R5 | R4 | R6 |
| J13 | yes | yes | yes | yes | yes | R2 | yes | R2 | yes | R1 | R4 | R6 |
| J14 | yes | R6 | R6 | R6 | R6 | R2 | yes | R2 | yes | R1 | R4 | R6 |
Tested cells are the "yes" cells; every other cell should carry a reason code. 13 journeys x 12 shapes = 156 cells. Counts of tested / N/A / GAP are NOT TALLIED yet: the reviewer tallies them and lists any cell without a code as a GAP. J3 row for shapes with no paid sales is a note, not a code: reviewer to rule.

### 9c. What cannot be walked on prod
S6 and S9 have no prod rows (R6): the walk uses a fixture made on a preview, never a prod write. The sold-ticket refusal walks on S3 (1 real row, read-only) plus a fixture for per-night when S1a lands (NOT VERIFIED).

## 10. DRAFT 2 changes vs DRAFT 1
Prod survey and both matrices added. S5b/S4c (14 live series with nothing upcoming) get NO pause control. Night lists page past 100 rows (125 on prod).
