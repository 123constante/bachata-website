# Review r2: pause-series acceptance contract (DRAFT 3)

Reviewer: independent cloud worker (different model from the author), 2026-11-10, ticket dt_228eb865391d. This is the second and last round allowed (two rounds for a data-integrity change).
Reviewed: `docs/design/pause-series.CONTRACT.md` (DRAFT 3) and `docs/design/pause-series.INVENTORY.md` on `brief/review-pause-series-contract-r2` (3451db5). Round 1: `docs/reviews/pause-series-contract-r1.md` on `claude/review-pause-series-contract` (e754dde).
Method: read-only. Prod Supabase `stsdtacfauprzrdebmzg`, using `pg_proc.prosrc`, `pg_trigger`, `pg_constraint`, `pg_policy`, grants and COUNT-only shape queries. No personal data was read and nothing was written.

**Access limit (stated once):** the admin repo `bachata-admin-11april` is not attached to this session. As in round 1, every admin claim below was checked against the function bodies deployed on prod, not against admin `origin/main` file:line.

## 1. Round 1 findings: status in DRAFT 3

| r1 # | Status | DRAFT 3 section | Judgement |
|---|---|---|---|
| 1 (BLOCK, auto-resume) | **PARTLY** | D3, D6, §11 | A dedicated definer function is the right shape, and skipping `organiser_publish_gate_v1` is consistent with prod: the gate returns exempt `'system'` when `p_actor IS NULL`. Written as it is, though, the function **cannot work**, for three reasons. (a) `tg_enforce_lifecycle_transition` refuses the write; DRAFT 3 left this as NOT VERIFIED and it is now verified false (N1). (b) The audit actor "text 'system:auto_resume'" cannot be stored, because `event_audit_p5.actor_id` is a uuid (N2). (c) One raise aborts the whole batch (N3). |
| 2 (BLOCK, sales leak) | **PARTLY** | D2, O6, §11 | The check runs after the permission branch. The refusal carries no count, amount or night. The helper is revoked. Dispatcher failure rows go to `event_audit_p5`, whose only SELECT policy is `phase5_admin_select`, so error text does not leak there. One leak remains and is not stated: the refusal itself tells a co-organiser that the other organiser sold at least one ticket. This contradicts O6, which says the co-organiser "must never learn" (N6). |
| 3 (O2 premise) | FIXED | P1 note, O2 | Matches prod `_assert_can_edit_series_p5` and `tg_enforce_lifecycle_transition` (owner/manager via `_is_entity_member`). |
| 4 (Resume vs daily limit) | FIXED | D9, J19, Q2 | The J19 copy is wrong (N4). |
| 5 (Undo toast, clear state) | FIXED | D1 | |
| 6 (nights passed while paused) | **PARTLY** | D10, J15, Q1 | D10 and Q1 contradict each other on the default (N7). |
| 7 (order statuses) | **PARTLY** | D2, J16 | "Disputed" has two representations on prod; `failed` and partly refunded orders are not covered; the pending TTL is not named (N5). |
| 8 (S3 blocked until S1a) | FIXED | S3 row, Q3 | |
| 9 (prod numbers) | FIXED | §5 | My re-run matches every number (§3 below). The S10 "yes" and the order wording are inexact (N8, N9). |
| 10 (resume_on validation) | FIXED | D8, J17, J18 | The boundary values are not listed as test rows (N12). Change date on an already-paused series has no allowed transition (N13). |
| 11 (DST, UTC schedule) | **PARTLY** | D7 | DST is correct (§2.3 below). A missed run can auto-resume with zero nudges sent, and the `= 7` reminder is lost if that day's run is missed (N11). |
| 12 (races) | **PARTLY** | J14, 9a | The J14 text is fixed and 9a J14 O3 is now yes. 9a J14 O7 is still R8, although J14 names the cron as a writer (N10). |
| 13 (9a codes) | FIXED | 9a, R8 | J7/J9/J13 O3 and J12 O1/O3 now carry R8, which is true. |
| 14 (9b codes) | **PARTLY** | 9b, R9 to R11 | Every r1 wrong code is fixed (J1/J2 S6 R9, J3 S1 R10, J11 S7 R1, J11 S8 yes, J14 S2 to S4b yes). Five new wrong codes appeared (N10). |
| 15 (persons) | FIXED | O5, O6, O7, D5, J21 | |
| 16 (shapes) | FIXED | S10, S11 | The S10 count overstates the pausable rows (N8). |
| 17 (GRANT list) | **PARTLY** | §11 | The list is present but misses the trigger change (N1) and the date-change command (N13). |
| 18 (anon readiness grant) | FIXED | §11 tail | Stated as do-not-copy; raised separately. |
| 19 (sequencing, S1a number) | **PARTLY** | §1(1), §7 A1 | DRAFT 3 still only says "name its admin PR number": the number is not named. It cannot be checked from here (no admin access). |
| 20 (density exclusions) | FIXED | §7 A2 | |
| C4 | FIXED | O2 | |
| C11 | FIXED | S11 (2 rows, re-verified) | |
| C14 | **PARTLY** | §1(1) | Same as 19: the admin PR number is still blank. |

Tally: FIXED 13, PARTLY 10, NOT FIXED 0.

## 2. Prod facts checked for the special-attention items

### 2.1 Auto-resume (D6)
- **`tg_enforce_lifecycle_transition`** (BEFORE UPDATE `trg_enforce_lifecycle_series`, SECURITY DEFINER). Its order: (1) `v_old = v_new`, then return. (2) `_self_serve_is_admin()` = `is_admin() OR auth.role() = 'service_role'`. Under pg_cron, `auth.uid()` is NULL, so `is_admin()` is false, and no `request.jwt` role is set, so the role is not service_role. (3) The owner arms: every `paused -> live` arm needs `v_is_owner`, and that needs a non-NULL `auth.uid()`. (4) Otherwise `RAISE 'lifecycle_transition_denied: paused -> live (kind=series, actor=anon)'`. **So a direct status write from the cron is refused on every run.** The precedent for a system write is the marker arm used by end-run (`current_setting('app.p5_end_run_series', true) = NEW.id::text`) and by onboarding go-live. The auto-resume needs the same mechanism (N1).
- **`_assert_series_publish_ready_v1`** (AFTER UPDATE, `trg_series_publish_ready_upd_v1`) re-runs `_event_publish_blocking_reason_v1` on any row that ends up `live` and RAISEs `publish_blocked`. A direct write therefore does not skip the readiness check. That is good, but it raises instead of returning, so D6 must catch it per series (N3).
- **Other triggers the direct UPDATE fires**: autoslug, recurrence validate, festival-one-date, ended coerce and shape, city-move review, category mirror, organiser junction sync, OG cover, room scoping. None is skipped by writing directly, because they are table triggers. What IS skipped is everything the dispatcher (`apply_aggregate_write_p5`) does: `version = version + 1`, the `event_audit_p5` insert, `command_idempotency_p5` and `_audit_failure_p5`. D6 says it bumps the version but must also write the audit row itself (N2).
- **`organiser_publish_gate_v1`**: `p_actor IS NULL` gives exempt `'system'`, and admin and trusted organisers are exempt too (48 trusted on prod). The count reads `event_audit_p5` rows with `actor_id = p_actor` and `command_kind = 'series.set_lifecycle'`, to `live`. So an audit row with `actor_id NULL` is charged to nobody. Skipping the gate is consistent with today's behaviour. **Today the `daily_limit_enforcement` switch is OFF on prod**, so J19 cannot be reproduced on prod.

### 2.2 Sales leak (D2)
- `ticket_orders` has RLS on, with one SELECT policy `ticket_orders_member_or_buyer_read` for authenticated and no anon SELECT. `event_audit_p5` has SELECT granted to anon and authenticated, but its only policy is `phase5_admin_select`, so failure text is admin-only.
- The `ticket_orders.status` CHECK allows `pending`, `paid`, `refunded`, `failed`, `expired` and `disputed`, and a separate `dispute_status` CHECK allows `open`, `won` and `lost`. Prod has 5 orders: expired 2, paid 2 (one partly refunded: `refunded_pence > 0`), refunded 1. None is disputed.
- A co-organiser case on prod: S2 is multi-organiser with ticket types and no paid order, so the leak needs a fixture in which the paid order's `ticket_types.organiser_id` is the OTHER organiser (N8).

### 2.3 Dates (D7)
- At 06:00 UTC the London date equals the UTC date on both sides of a change. 2027-03-28: the clocks go forward at 01:00 UTC, so 06:00 UTC is 07:00 BST on the 28th. 2027-10-31: the clocks go back at 01:00 UTC, so 06:00 UTC is 06:00 GMT on the 31st. `resume_on <= london_today` is correct.
- Catch-up and nudges: see N11. The idempotency key `(series_id, kind, resume_on, day)` is right and changes when the date changes. Problem: `day` for the reminder is undefined when the send is "when diff = 7".

### 2.4 Boundaries (D8, J17, J18)
- See N12 for the boundary rows. A course whose last night falls before `resume_on` auto-resumes to a live series with nothing upcoming: an S4c/S5b-like row, which is valid (the readiness check does not require an upcoming date for a paused-to-live move; NOT VERIFIED for every `_event_publish_blocking_reason_v1` arm).

## 3. Prod survey re-run (2026-11-10, counts only) vs §5

| Shape | §5 n | Reviewer n | Diff |
|---|---|---|---|
| total series | 766 | 766 | = |
| S1 | 32 (30 + 2 two-org) | 32 (30 + 2 two-org); max 133 nights, 56 upcoming | = |
| S2 | 1 (2 orgs, 53 up) | 1 (multi, ticket types, no paid, 53 up) | = |
| S3 | 1 (70 nights, 53 up) | 1 (70, 53) | = |
| S4a / S4b / S4c | 1 / 1 / 9 (1 all-cancelled) | 1 / 1 / 9 (6 single + 3 multi; 1 all-cancelled) | = |
| S5a / S5b | 3 (2 ran, 1 never) / 5 | 3 (2 ran, 1 never) / 5 | = |
| S7 draft / archived / ended | 8 / 13 / 23 | 8 / 13 / 23 | = |
| S8 one-off / festival live; paused one-off | 11 / 9; 1 | 11 / 9; 1 | = |
| S10 multi-org live | 6 | 6, **of which 3 are S4c (nothing upcoming, R2)**: only 3 are pausable (2 S1 + 1 S2) | wording |
| S11 paused, no date | 2 (81 nights, 53 up) | 2 (81, 53) | = |
| orders | "Paid orders 2 (expired 2, paid 2, refunded 1)" | 5 orders: expired 2, paid 2 (1 partly refunded), refunded 1; 0 disputed | wording |
| ticket types with occurrence_id | 0 | 0 | = |
| courses with no session count (live/paused) | 0 | 0 | = |
| pending_review recurring/course | (not listed) | 0 | new, fine |
| daily_limit_enforcement switch | (not listed) | OFF | new (N4) |

## 4. New findings

| # | Sev | Where | What is wrong | Exact change to the contract |
|---|---|---|---|---|
| N1 | FIX (mandatory before A1) | D6, §7 A1, §8, §11 | Verified on prod (§2.1): `tg_enforce_lifecycle_transition` refuses `paused -> live` when there is no `auth.uid()` and no service_role JWT. Under pg_cron neither exists, so D6's direct write raises `lifecycle_transition_denied` on every run. | D6: replace "must accept this role (NOT VERIFIED)" with: "A1 adds ONE trigger arm, `v_kind = 'series' AND v_old = 'paused' AND v_new = 'live' AND current_setting('app.p5_auto_resume_series', true) = NEW.id::text`, the same marker pattern as end-run (`app.p5_end_run_series`). `_p5_series_auto_resume_daily_v1` sets it with `set_config(..., true)` immediately before each series' UPDATE and resets it after. No other function sets it." Add the trigger change to §11 as its own row for the owner's yes or no. Remove it from §8. |
| N2 | FIX (mandatory) | D6 | "Audit actor is the text 'system:auto_resume'" cannot be stored, because `event_audit_p5.actor_id` is `uuid`. D6 also skips everything else the dispatcher does (audit row, idempotency row). | D6: "Writes one `event_audit_p5` row per resumed series: `actor_id NULL`, `command_kind 'series.set_lifecycle'`, `command_payload {payload:{to:'live'}, source:'system:auto_resume'}`, `before_state`/`after_state` as the dispatcher does, `outcome 'success'`. A NULL actor is charged to nobody's daily limit (the gate filters on `actor_id = p_actor`)." |
| N3 | FIX | D6, J10 | `trg_series_publish_ready_upd_v1` (AFTER) RAISEs `publish_blocked`, and the other table triggers can RAISE too. In one cron transaction, one blocked series rolls back every other series' resume and every nudge in that run. | D6: "Each series runs in its own `BEGIN ... EXCEPTION WHEN OTHERS` sub-block. On any error the series stays paused, a J10 'blocked' notice row is enqueued (idempotent per day), and the run continues." Add to J10: "a second, unblocked series in the same run still resumes". |
| N4 | FIX | D9, J19 | Today `organiser_publish_gate_v1`'s refusal text is "Saved as a draft. You can publish more tomorrow." For Resume this is false: the series stays paused, not draft. J19 says "shows the server message". The switch is also OFF on prod, so J19 can only be walked on a preview with the switch on. | J19: "If kept (Q2 = keep), the sheet maps `daily_limit` to 'Still paused. You can resume it tomorrow.' and never shows the draft text." 9c: "J19 needs `daily_limit_enforcement` on: preview only." |
| N5 | FIX | D2, J16, shapes | "A disputed order" is ambiguous: prod has `status = 'disputed'` AND `dispute_status IN ('open','won','lost')` on paid orders. `failed` is not listed. A paid order with `refunded_pence > 0` (1 on prod) is not covered. The checkout TTL is not named. | D2: "Blocks while an upcoming non-cancelled night exists AND an order on the series has `status IN ('paid','disputed')` (a partly refunded paid order still blocks) OR `dispute_status = 'open'` OR (`status = 'pending'` AND `created_at > now() - <the checkout session expiry used by the checkout function, named in A1>`). `refunded`, `expired` and `failed` never block." Add a fixture shape "partly refunded paid order" to J16. |
| N6 | FIX | D2, O6, §12 Q3 | A yes/no refusal still tells a co-organiser (O6) that the other organiser has at least one live sale on this series. O6 says O6 "must never learn the other organiser's sales". This is inherent in P4 with a series-level check, so the contract should state it, not claim zero leak. | O6: "learns only that the series has a sale that blocks pausing (one bit, no count, amount, night or organiser name); never a count or amount." Add to Q3 as an FYI: "a co-organiser learns that the other organiser has sold at least one ticket." |
| N7 | FIX | D10 vs §12 Q1 | D10 says "Until decided, no auto-change". Q1 says "Lead default: auto-cancel with reason paused". Only one can be the default. Auto-cancel also writes through `_cmd_occurrence_cancel_p5`, which may send cancel notices (P12: no follower notices in v1). | Make the default the safe, no-write one: Q1 "Default until answered: leave nights as they are (D10). Auto-cancel, if chosen, must not send any notice (P12) and is its own slice." |
| N8 | FIX | §5 S10 row, J3 | Of the 6 multi-org series, 3 are S4c (nothing upcoming), so pausing is offered on 3, not 6. The leak fixture does not say whose order it is. | S10: "6 (3 pausable: 2 S1 + 1 S2; 3 are S4c, R2)". J3: "S10 fixture: a paid order on a ticket type whose `organiser_id` is organiser A; the caller is owner of organiser B only. Assert: refusal code only; `ticket_sales_summary_v1(B)` shows nothing of A's." |
| N9 | NOTE | §5 header | "Paid orders on prod: 2 (statuses: expired 2, paid 2, refunded 1)" adds up to 5. | Change to "Orders on prod: 5 (expired 2, paid 2 of which 1 partly refunded, refunded 1, disputed 0)". |
| N10 | FIX | 9a, 9b | Codes that are FALSE for their cell: **9a J14 O7 = R8**, but J14 names the cron as a writer, so it should be yes. **9b J7 S9 = R7**, but S9 is paused WITH a date, so R7 ("needs paused / a date") is false; the reminder is already in the past, so it needs a new code or yes. **9b J16 S6, J16 S9, J16 S11 = R7**: these are already paused, so the code should be R9. **9b J21 S10 = yes**, but S10 is live and J21 needs a paused series, so it should be R7 (as S1 is). R6 is defined but never used, while S6, S9, the J3 S10 cell and the J16 S3 cell (refunding a REAL order) can only be walked on a fixture. | Change the 6 cells as stated. Add R12 "date already past: reminder not due". Mark fixture-only cells `yes (R6 fixture)`: J16 S3 must never refund the real prod order. Re-tally. |
| N11 | FIX | D7, J9 | (a) "Due = resume_on <= London today", with nudges on days 1 to 3 and then auto-resume. If the cron misses 4 or more days, catch-up auto-resumes with 0 nudges sent, which breaks P9. (b) "Reminder when resume_on - today = 7" is lost for good if that day's run is missed, and is never sent if the pause is set fewer than 7 days ahead (say which is intended). | D7: "Auto-resume only when 3 nudges have been SENT (outbox rows) and the last was at least 1 London day ago; at most one nudge per series per run. Reminder when `0 < resume_on - today <= 7` and no reminder row exists for (series, resume_on). A pause set fewer than 7 days ahead gets no reminder; the sheet says so." |
| N12 | FIX | D8, J17, J18 | The boundaries are stated but not listed as test rows. | J17 rows: today refused; today+1 accepted; today+365 accepted; today+366 refused; NULL means open-ended; a non-date string gives `invalid_payload: resume_on`. J18 rows: on a course, resume_on later than the last night gives the warning, and auto-resume then yields a live series with nothing upcoming (asserted). |
| N13 | FIX | J4, J5, J20, §7 A1, §11 | Change date and Make open-ended act on an already-paused series. The owner allowlist (`_owner_lifecycle_transition_allowed_p5`, prod) has no `('paused','paused')` pair, so `{to:'paused', resume_on}` from paused is not an allowed owner transition. The contract never names the command these journeys send. | A1: "Change date and Make open-ended use a new dispatcher command `series.set_resume_on {resume_on|null}`: paused series only (else `invalid_state`), `_assert_can_edit_series_p5`, D8 validation, resets the nudge state, no lifecycle change." Add its handler to §11 as postgres/service_role only, reached through `series_command_p5`. |
| N14 | NOTE | §1(1), §7 A1 | The admin PR number for S1a is still not named (r1 19 / C14). | Fill it in before A1 is dispatched; until then §1(1) is unmet. |

## 5. Contradictions checked (brief item 4)
- D1 vs D9: consistent. D1's "gates in D6" are the readiness and course-session checks. D9's daily limit is separate and has its own default.
- D2 vs the S3 row: consistent (S3 is blocked until S1a; Q3 FYI).
- §7 vs §11: §11 lacks the trigger arm (N1) and the date-change command (N13). The page RPC exposing `resume_on` to anon is mentioned in both, and is consistent.
- D10 vs Q1: contradiction (N7).
- O6 vs D2: contradiction on what a co-organiser learns (N6).

VERDICT: PASS WITH FIXES

No new owner decision is needed to apply the fixes. Each one is an exact text change above. N1, N2, N3, N11 and N13 are mandatory before A1 is dispatched: without N1 the auto-resume never runs, and without N13 Change date has no command. If the lead prefers a third written round, treat N1 and N13 as BLOCK-equivalent.

## 6. Matrix tallies (my own count, by script over the DRAFT 3 tables)

**9a** (21 journeys x 7 persons = 147 cells): yes 65, coded 82 (R3 43, R8 34, R5 5), GAP 0. **Matches the contract's claim.** Wrong code: 1 (J14 O7, N10). Should-be-yes but coded: J14 O7. Coded-yes that should be coded: none found. The R3 cells are true for O2 (owner/manager only), O4 (anon has no `series_command_p5` grant) and O5 (no membership). The R8 cells for O3 on the notice journeys are true (an admin is not a recipient).

**9b** (20 journeys x 14 shapes = 280 cells): yes 89, coded 191 (R7 85, R2 40, R1 20, R4 19, R10 11, R9 9, R11 7), GAP 0. **Matches the contract's claim.** Wrong code: 5 (J7 S9, J16 S6, J16 S9, J16 S11, and J21 S10, which is yes and should be R7). Fixture-only cells marked plain yes: J3 S10, J16 S3, and every S6 and S9 yes (9c covers S6/S9 in prose, but R6 is unused).

Per row, yes count (9b): J1 6, J2 6, J3 2, J4 3, J5 2, J6 3, J7 1, J8 2, J9 2, J10 2, J11 10, J13 9, J14 9, J15 3, J16 1, J17 9, J18 9, J19 3, J20 3, J21 4.

## Not verified
- Admin `origin/main` file:line for every function cited (no access); prod bodies were used.
- The admin S1a PR number and whether `courses-owner-set-recurrence` is merged.
- That `_event_publish_blocking_reason_v1` never requires an upcoming night (§2.4).
- The checkout session expiry value (N5).
- Whether `_cmd_occurrence_cancel_p5` sends notices (N7).
- No browser or phone walk: this is a docs-only review.
