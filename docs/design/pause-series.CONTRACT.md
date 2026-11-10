# ACCEPTANCE CONTRACT: pause a series from the website (DRAFT 3, 2026-11-10, website-50)

Status: DRAFT 3 = DRAFT 2 + review r1 (docs/reviews/pause-series-contract-r1.md, verdict BLOCK, 2 blockers) applied. Round 2 review is next (data-integrity change: two rounds). No slice dispatched. Inventory: pause-series.INVENTORY.md. Owner answers: ~/.claude/plans/buzzing-sauteeing-beacon.md.

## 1. Lead constraints (website-8e, 2026-11-10)
(1) Admin migration sequences AFTER courses-owner-set-recurrence merges and cites its signatures; the ADMIN PR number of night-aware tickets S1a must be named (website #1352 is an unrelated docs commit, review C14). (2) Sold-ticket rule until S1a lands: state the count, mark per-night NOT VERIFIED. (3) Cover rule-less series. (4) Careful lane, access-focused review, one GRANT list to the owner (section 11). No dispatch before the lead sees the reviewed contract.

## 2. Owner decisions (binding)
P1 any team organiser pauses (NOTE: in the database this means owner or manager of ANY organiser on the series, including co-organisers; contributors and the roster are already refused, see O2). P2 "Pause series" in the event's status area. P3 two choices: until I resume / until a date (calendar). P4 block while upcoming nights have tickets sold. P5 confirm sheet. P6 after pausing: Change date / Resume now / Make open-ended. P7 organiser banner "Paused until D". P8 reminder 7 days before. P9 on the date ask the organiser to confirm; no confirm: nudge daily 3 days, then auto-resume. P10 public banner "Back on D" or "On a break. Follow the organiser for news." P11 page stays, hidden from calendar/search/new lists. P12 no follower notices in v1. P13 all recurring events incl. courses. P14 success = organisers pause/resume without asking the team.

## 3. Lead design choices (logged, reversible)
- D1 Website "Hide" (one tap, = paused today, eventPage.ts:279 and :292-296, whose Undo runs lifecycleCommand('live')) is replaced by "Pause series" with the confirm sheet for recurring and course series only. One-offs keep Hide/Show unchanged. The pause sheet has NO one-tap Undo toast: "Resume now" is the undo, so it cannot bypass the gates in D6. Server side, every non-paused target clears resume_on and all nudge state in the same UPDATE (as ended_on is cleared).
- D2 Sold-ticket block (review findings 2, 7). Blocks while the series has an upcoming (non-cancelled) night and an order with status paid, or a pending order created inside the checkout time-to-live, or a disputed order. Refunded and expired orders never block. Series-level until S1a lands (per-night NOT VERIFIED). The check runs AFTER the permission branch, so a caller who may not edit learns nothing. The refusal is the code pause_blocked: tickets_sold with NO count, amount or night list. The screen may show a count only via ticket_sales_summary_v1 for organisers the viewer owns or edits. The helper _p5_series_has_upcoming_paid_orders_v1(uuid) is REVOKEd from PUBLIC, anon and authenticated (not a sales oracle). Refusal is in the database function, not only the screen.
- D3 Auto-resume never impersonates anyone (review finding 1). See D6.
- D4 Never-ran series (no past date) 404s while paused (existing 830000 rule). The sheet says so: "Not run yet: its page is offline while paused."
- D5 Reminder/nudge channel: email to the team's CURRENT owners and managers via a new outbox row plus edge function (pattern 20261109660000 / todo-deadline-email on origin/main). Recipients are re-read at send time, never cached at pause time. In-app to-do card if the to-do machinery is used at slice time (the organiser-todo-deadline-5m cron exists on prod; table not re-read: NOT VERIFIED).
- D6 Auto-resume is a dedicated function _p5_series_auto_resume_daily_v1() (SECURITY DEFINER, owner postgres, called only by pg_cron). Per due series it takes FOR UPDATE, re-checks lifecycle_status = 'paused' and resume_on <= London today, then explicitly calls _event_publish_blocking_reason_v1 and the course session-count refusal, writes the status itself and bumps version. It does NOT call organiser_publish_gate_v1 (a resume is not a new publish; same exemption as service_role). Audit actor is the text 'system:auto_resume', never an owner uuid. If a gate blocks, the series stays paused and the team is told why (J10), never silently live and never silently stuck. The tg_enforce_lifecycle_transition trigger must accept this role (NOT VERIFIED: read it at slice time).
- D7 Resume schedule. Cron at 06:00 UTC; the job computes (now() AT TIME ZONE 'Europe/London')::date inside. Due = resume_on <= London today (catch-up for missed runs). Reminder when resume_on - London today = 7. Nudge day N = London today - resume_on (days 1 to 3), then auto-resume. Every send is idempotent on (series_id, kind, resume_on, day). Tests straddle 2027-03-28 and 2027-10-31.
- D8 resume_on validation: must be > London today and <= today + 365, else invalid_payload: resume_on. A date after the last upcoming night is accepted and the sheet warns "No dates after this. Add dates or end it." (J17, J18).
- D9 Resume now (paused to live) still passes organiser_publish_gate_v1 today, so it can be refused with daily_limit. DEFAULT (lead, reversible, flagged): exempt paused to live from the daily limit in the same slice; if kept, J19 shows the server message. Needs owner/lead confirmation (see section 12).
- D10 Nights inside the pause window. OPEN OWNER DECISION (section 12). Until decided, no auto-change: nights that pass while paused stay as they are and the contract's J15 test asserts what the page, history and course session count show after resume.

## 4. Person types
O1 owner or manager of the page. O2 contributor or roster editor: refused by _assert_can_edit_series_p5 (owner and manager only since A06 and A-DB2, prod-verified in review C4; the stale comment in _cmd_series_set_lifecycle_p5's archived branch that says contributors are admitted is wrong). O3 admin (is_admin() passes). O4 dancer on the public page. O5 organiser with no membership on this series, including an owner of an unrelated organiser (refused). O6 co-organiser: owner or manager of the SECOND organiser on a multi-organiser series (6 live on prod); acts as O1 but must never learn the other organiser's sales. O7 system (pg_cron): no person, runs D6.

## 5. Data shapes (series) with PROD counts (read-only, project stsdtacfauprzrdebmzg, re-run by the reviewer 2026-11-10; re-run again on the day A1 is dispatched)
Total series 766. Live or paused recurring and course: counts below (S1 to S6, S10, S11). Paid orders on prod: 2 (statuses: expired 2, paid 2, refunded 1). Max scheduled nights in one series 133 (over the 100-row API cap: night lists must page); max upcoming in one series 56. Ticket types with occurrence_id: 0. Courses with no session count: 0. Multi-organiser live recurring or course: 6.

| Shape | Description | Prod n | Pause offered? |
|---|---|---|---|
| S1 | live recurring, has rule, ran, upcoming, no ticket types | 32 (30 single-organiser, 2 two-organiser) | yes |
| S2 | live recurring, rule, NEVER ran, ticket types, no paid (2 organisers, 53 upcoming) | 1 | yes (page offline while paused, D4) |
| S3 | live recurring, rule, ran, series-level ticket types, PAID sale (70 nights, 53 upcoming) | 1 | blocked (D2) until S1a: cannot be tied to a night. Contradicts P14 for this shape: owner FYI (section 12) |
| S4a | live recurring, NO rule, ran, upcoming | 1 | yes |
| S4b | live recurring, NO rule, never ran, upcoming | 1 | yes (page offline while paused) |
| S4c | live recurring, NO rule, ran, NOTHING upcoming (one has every upcoming night cancelled) | 9 | no: nothing to pause (R2) |
| S5a | live course, rule, upcoming (a course part-way through is the sharpest J15 case) | 3 (2 ran, 1 never ran) | yes |
| S5b | live course, finished, NOTHING upcoming | 5 | no (R2) |
| S6 | paused WITH a resume date | 0 (fixture on a preview, never a prod write) | Change date / Resume now / Open-ended |
| S7 | draft / archived / ended recurring or course | draft 8, archived 13, ended 23 | no (R1) |
| S8 | one-off or festival (live 11 / 9); 1 paused one-off exists | 20 live | no pause control (R4); the shared EventPausedBanner copy still reaches it (J11 yes) |
| S9 | resume date reached while the publish gate blocks | 0 (fixture) | data state |
| S10 | live multi-organiser recurring or course (includes S1 and S2 rows) | 6 | yes; leak test J3 on a fixture with a paid order |
| S11 | paused WITHOUT a resume date (paused by an admin or legacy) | 2 (recurring, rule, ran, up to 81 nights, 53 upcoming) | Change date / Resume now / Open-ended; display must cope with no row in the side table |
Rule-less live recurring = 11 (S4a + S4b + S4c) which matches website-81. Rows the sold-ticket block affects on prod today: 1 series (S3). Per-night counts NOT VERIFIED until S1a lands.

## 6. Journeys (each cell tested, screen x shape)
J1 pause until a date (S1, S2, S4a, S4b, S5a, S10). J2 pause open-ended. J3 pause refused for sold tickets with the next step "ask the team" (S3; S10 leak fixture). J4 change date. J5 make open-ended. J6 resume now (gate pass or block). J7 reminder at -7 days (recipients read at send time). J8 resume-day confirm. J9 no confirm: nudges days 1 to 3, then auto-resume. J10 auto-resume blocked by the gate: team told why, stays paused. J11 public page while paused, with and without a date, with and without a past date; the one-off banner keeps its copy. J12 refused for O2, O4, O5 (database, not only the screen). J13 untouched sheet sends nothing. J14 two writers at once: two organisers, organiser vs cron at the boundary (cron takes FOR UPDATE; the organiser write wins or the cron skips), admin vs organiser. J15 nights pass while paused, then resume: what the page, history and course session count show. J16 a paid order is refunded, then the pause is allowed; an order that completes after the pause is not a blocker. J17 resume date past, today or beyond 365 days refused. J18 resume date after the last night: warning, accepted. J19 Resume refused by the daily publish limit (D9). J20 admin pauses, organiser changes the date. J21 team member removed while paused: they get no reminder.

## 7. Slices (sequenced)
- A0 docs (this contract, inventory, review r1).
- A1 ADMIN DB (careful): resume_on date plus nudge state (side table or columns; RLS on, no policies for anon or authenticated); extend set_lifecycle payload to {to, resume_on?}; D2 refusal helper; clear-on-non-paused (D1); D6 auto-resume function and D7 schedule; snapshot and page RPC expose resume_on; outbox for reminders and nudges. Sequenced AFTER claude/courses-owner-set-recurrence (admin dt_ad58737fd31f) and after admin S1a (name its admin PR number); both touch apply_aggregate_write_p5(jsonb) and _cmd_series_set_lifecycle_p5(uuid, jsonb, uuid): re-read both bodies and the migration numbering from admin origin/main at slice time (the admin checkout here is behind). One GRANT list to the owner (section 11).
- A2 Website screens: Pause sheet, paused card (Change date / Resume now / Open-ended), resume-day confirm card, public banner copy. Files: p3 StatusSheet.tsx, EventPage.tsx, data/eventPage.ts, EventPausedBanner.tsx, BentoPage.tsx, lifecycleBanner.ts, buildEventPageModel.ts. Touches NO density-excluded file (calendar files need no change: paused series are already excluded by _p5_series_public_visibility_v1). Hide-to-confirm-sheet stays out of the first PR if it would touch a calendar-protected file.
- A3 notices: reminder email plus nudges (edge function, cron auth header like the digest pattern).
- A4 independent walk at 390x844 on prod-shaped data, then ONE owner phone checklist at the end of the arc.

## 8. Not verified (carried into the slices)
Every admin-repo file:line (the reviewer had no access to bachata-admin-11april; claims were checked against deployed prod function bodies). Whether courses-owner-set-recurrence and admin S1a are merged and their signatures. The page-RPC 200/404 rule for paused series. The to-do table name. tg_enforce_lifecycle_transition for a cron actor. Per-night ticket counts. Real-phone check.

## 9. Coverage matrix (DRAFT 3, generated and tallied by script; every cell carries a code)
Reason codes: R1 lifecycle not live or paused so no pause control; R2 nothing upcoming to pause; R3 role not permitted (the database refuses; verified on prod for O2, O4 and O5); R4 not a recurring or course series; R5 public-only journey; R6 prod has no rows: fixture on a preview, never a prod write; R7 needs the series to be paused first (or needs a resume date); R8 not a recipient and not a refusal subject; R9 already paused, see J4 to J6; R10 no paid sales on this shape, so the refusal cannot be walked here (walked on S3 and the S10 fixture); R11 refused, covered by J3.

### 9a. Person x journey
| Journey | O1 | O2 | O3 | O4 | O5 | O6 | O7 |
|---|---|---|---|---|---|---|---|
| J1 pause until a date | yes | R3 | yes | R3 | R3 | yes | R8 |
| J2 pause open-ended | yes | R3 | yes | R3 | R3 | yes | R8 |
| J3 pause refused: paid sales | yes | R3 | yes | R3 | R3 | yes | R8 |
| J4 change date | yes | R3 | yes | R3 | R3 | yes | R8 |
| J5 make open-ended | yes | R3 | yes | R3 | R3 | yes | R8 |
| J6 resume now | yes | R3 | yes | R3 | R3 | yes | R8 |
| J7 reminder at -7 days | yes | R8 | R8 | R8 | R8 | yes | yes |
| J8 resume-day confirm | yes | R3 | yes | R3 | R3 | yes | R8 |
| J9 no confirm: nudges, then auto-resume | yes | R8 | R8 | R8 | R8 | yes | yes |
| J10 auto-resume blocked by the gate | yes | R8 | R8 | R8 | R8 | yes | yes |
| J11 public page while paused | R5 | R5 | R5 | yes | yes | R5 | R5 |
| J12 role refused | R8 | yes | R8 | yes | yes | R8 | R8 |
| J13 untouched sheet sends nothing | yes | R3 | yes | R3 | R3 | yes | R8 |
| J14 two writers at once (people, cron, admin) | yes | R3 | yes | R3 | R3 | yes | R8 |
| J15 nights pass while paused, then resume | yes | R3 | yes | yes | R3 | yes | yes |
| J16 order refunded after the refusal | yes | R3 | yes | R8 | R3 | yes | R8 |
| J17 resume date past, today or too far | yes | R3 | yes | R3 | R3 | yes | R8 |
| J18 resume date after the last night | yes | R3 | yes | R3 | R3 | yes | R8 |
| J19 Resume refused by the daily publish limit | yes | R3 | yes | R3 | R3 | yes | R8 |
| J20 admin paused, organiser changes the date | yes | R3 | yes | R3 | R3 | yes | R8 |
| J21 team member removed while paused | yes | R8 | R8 | R8 | yes | yes | yes |

7 persons x 21 journeys = 147 cells: yes 65, coded 82, GAP 0. Codes used: R3, R5, R8, yes.

### 9b. Journey x data shape (O1 unless noted)
| Journey | S1 | S2 | S3 | S4a | S4b | S4c | S5a | S5b | S6 | S7 | S8 | S9 | S10 | S11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| J1 pause until a date | yes | yes | R11 | yes | yes | R2 | yes | R2 | R9 | R1 | R4 | R9 | yes | R9 |
| J2 pause open-ended | yes | yes | R11 | yes | yes | R2 | yes | R2 | R9 | R1 | R4 | R9 | yes | R9 |
| J3 pause refused: paid sales | R10 | R10 | yes | R10 | R10 | R2 | R10 | R2 | R9 | R1 | R4 | R9 | yes | R9 |
| J4 change date | R7 | R7 | R7 | R7 | R7 | R2 | R7 | R2 | yes | R1 | R4 | yes | R7 | yes |
| J5 make open-ended | R7 | R7 | R7 | R7 | R7 | R2 | R7 | R2 | yes | R1 | R4 | yes | R7 | R7 |
| J6 resume now | R7 | R7 | R7 | R7 | R7 | R2 | R7 | R2 | yes | R1 | R4 | yes | R7 | yes |
| J7 reminder at -7 days | R7 | R7 | R7 | R7 | R7 | R2 | R7 | R2 | yes | R1 | R4 | R7 | R7 | R7 |
| J8 resume-day confirm | R7 | R7 | R7 | R7 | R7 | R2 | R7 | R2 | yes | R1 | R4 | yes | R7 | R7 |
| J9 no confirm: nudges, then auto-resume | R7 | R7 | R7 | R7 | R7 | R2 | R7 | R2 | yes | R1 | R4 | yes | R7 | R7 |
| J10 auto-resume blocked by the gate | R7 | R7 | R7 | R7 | R7 | R2 | R7 | R2 | yes | R1 | R4 | yes | R7 | R7 |
| J11 public page while paused | yes | yes | R11 | yes | yes | R2 | yes | R2 | yes | R1 | yes | yes | yes | yes |
| J13 untouched sheet sends nothing | yes | yes | R11 | yes | yes | R2 | yes | R2 | yes | R1 | R4 | yes | yes | yes |
| J14 two writers at once (people, cron, admin) | yes | yes | R11 | yes | yes | R2 | yes | R2 | yes | R1 | R4 | yes | yes | yes |
| J15 nights pass while paused, then resume | R7 | R7 | R7 | R7 | R7 | R2 | R7 | R2 | yes | R1 | R4 | yes | R7 | yes |
| J16 order refunded after the refusal | R10 | R10 | yes | R10 | R10 | R2 | R10 | R2 | R7 | R1 | R4 | R7 | R10 | R7 |
| J17 resume date past, today or too far | yes | yes | R11 | yes | yes | R2 | yes | R2 | yes | R1 | R4 | yes | yes | yes |
| J18 resume date after the last night | yes | yes | R11 | yes | yes | R2 | yes | R2 | yes | R1 | R4 | yes | yes | yes |
| J19 Resume refused by the daily publish limit | R7 | R7 | R7 | R7 | R7 | R2 | R7 | R2 | yes | R1 | R4 | yes | R7 | yes |
| J20 admin paused, organiser changes the date | R7 | R7 | R7 | R7 | R7 | R2 | R7 | R2 | yes | R1 | R4 | yes | R7 | yes |
| J21 team member removed while paused | R7 | R7 | R7 | R7 | R7 | R2 | R7 | R2 | yes | R1 | R4 | yes | yes | yes |

20 journeys x 14 shapes = 280 cells: yes 89, coded 191, GAP 0. Codes used: R1, R10, R11, R2, R4, R7, R9, yes. J12 is person-only (9a).

### 9c. What cannot be walked on prod
S6 and S9 have no prod rows (R6): the walk uses a fixture made on a preview, never a prod write. S11 has 2 prod rows and is walked read-only. The sold-ticket refusal walks on S3 (1 real row, read-only) plus the S10 leak fixture; per-night waits for S1a.

## 10. Changes vs DRAFT 2 (review r1 findings)
1 auto-resume made a dedicated function (D6, blocker). 2 refusal leaks no sales and runs after the permission check (D2, blocker). 3 O2 premise corrected to prod fact. 4 and 19 Resume daily-limit (D9, J19). 5 no Undo toast, clear state on non-paused (D1). 6 nights passing while paused (D10, J15). 7 order statuses (D2, J16). 8 S3 is blocked until S1a (S3 row, section 12). 9 prod numbers replaced by the reviewer's survey (S1 32, S6 split into S6 and S11 with 2 prod rows, max nights 133). 10 resume_on validation (D8, J17, J18). 11 DST and UTC schedule (D7). 12 races (J14). 13 and 14 reason codes R8 to R11 and generated matrices with no gaps. 15 O6 and O7 persons, recipients re-read. 16 shapes S10 and S11. 17 GRANT list (section 11). 20 density exclusions stated.

## 11. GRANT list for the owner (proposed; ONE yes/no)
| Object | Grant to | Must NOT be granted |
|---|---|---|
| series_command_p5(jsonb) (unchanged front door) | authenticated, service_role | anon, PUBLIC |
| _cmd_series_set_lifecycle_p5(uuid, jsonb, uuid), payload {to, resume_on?} | as today (postgres, service_role) | authenticated, anon, PUBLIC |
| new _p5_series_has_upcoming_paid_orders_v1(uuid) | none (called inside definer functions) | authenticated, anon, PUBLIC |
| new _p5_series_auto_resume_daily_v1() and nudge/reminder enqueue | none (pg_cron runs as postgres) | service_role, authenticated, anon, PUBLIC |
| new resume/nudge columns or side table | read through the snapshot and page RPC only; the page RPC may expose resume_on | direct SELECT, INSERT or UPDATE for anon and authenticated (RLS on, no policies for them) |
| new outbox table | service_role (edge function) | anon, authenticated |
| edge function | cron auth header, as the digest | public invocation |
Each new function: REVOKE ALL ... FROM PUBLIC, anon, authenticated explicitly (Supabase default privileges grant EXECUTE to anon and authenticated). The new helpers must NOT copy the anon grant that event_publish_readiness_v1 and _event_publish_blocking_reason_v1 carry (review note 18; raise that older issue separately).

## 12. Owner decisions still open (go to the lead; click questions)
Q1 Nights that pass while a series is paused (D10): auto-mark them cancelled with reason "paused" (history stays honest, a part-way course keeps its true session count), or leave them as they are. Lead default: auto-cancel with reason paused.
Q2 Resume now and the daily publish limit (D9): exempt a resume from the limit (lead default), or keep it.
Q3 FYI to the owner, not a decision: the one live series with a paid sale (S3) cannot be paused until night-aware tickets land, which contradicts P14 for that shape. Its refusal says "ask the team".
