# Review r1: pause-series acceptance contract (DRAFT 2)

Reviewer: independent cloud worker (different model from the author), 2026-11-10, ticket dt_e76f93917335.
Reviewed: `docs/design/pause-series.CONTRACT.md` and `docs/design/pause-series.INVENTORY.md` on `brief/review-pause-series-contract` (brief sha 5f444a8).
Method: read-only. Prod Supabase `stsdtacfauprzrdebmzg`: `pg_get_functiondef`, `aclexplode` grants and COUNT-only shape queries; no personal data read, no writes. Website: `origin/main` at 4bebd94.

**Access limit (read first):** this session could NOT read the admin repo `123constante/bachata-admin-11april` (add_repo: "you don't have access"). So every admin-repo `file:line` in the inventory is **NOT FOUND (no access)**. Instead each claim was checked against the function as it is **deployed on prod** (`pg_get_functiondef`). Prod can be ahead of or behind admin `origin/main`. The re-check against admin `origin/main` file:line is left for the slice author (see "Not verified").

## 1. Inventory claims checked

| # | Claim (inventory / contract) | Verdict | Evidence |
|---|---|---|---|
| C1 | `_cmd_series_set_lifecycle_p5(p_series_id, p_payload, p_actor)`, payload `{to}` only | CONFIRMED (prod) | Prod def reads only `p_payload->>'to'`. SECURITY DEFINER; ACL = postgres, service_role (NOT authenticated, NOT anon). Admin file:line `20261108130000...:95-185` NOT FOUND (no access). |
| C2 | Owner allowlist `_owner_lifecycle_transition_allowed_p5`: live>paused, paused>live, paused>archived | CONFIRMED (prod) | Those arms are present, plus draft/rejected arms. IMMUTABLE; ACL postgres, service_role. |
| C3 | Paused uses `_assert_can_edit_series_p5` | CONFIRMED (prod) | It is the ELSE branch for every target other than ended or archived. |
| C4 | Contract §4 O2: "`_assert_can_edit_series_p5` allows [contributors/roster]" | **WRONG** | Prod def: `is_admin()` returns early; otherwise it requires `_is_entity_member('series', id, actor, ARRAY['owner','manager'])`. Comments: "A06 (20261109490000): a contributor ... may not edit"; "A-DB2 (20261129180000): ... the legacy roster arm is gone". So contributors and the roster are ALREADY refused by the database. The stale comment inside `_cmd_series_set_lifecycle_p5`'s archived branch ("also admits contributors and the roster") is what misled the inventory. |
| C5 | paused>live runs `_event_publish_blocking_reason_v1` | CONFIRMED, INCOMPLETE | It also runs (a) `organiser_publish_gate_v1` (the daily publish limit, with an advisory lock) on ANY entry into live, paused>live included, and (b) the course `course_total_sessions IS NULL` refusal for to IN (live, paused, ended). The contract does not mention (a) or (b). |
| C6 | 830000 paused rule: page stays only with a past date; upcoming hidden by `_p5_paused_hides_occurrence_v1`; listings use `_p5_series_public_visibility_v1` = live only | CONFIRMED (prod, the 2 helpers) | Hides `occurrence_date >= (now() AT TIME ZONE 'Europe/London')::date` and NULL dates; visibility is `lifecycle_status = 'live'`. The page-200/404 rule itself was not re-read (it lives in the page RPC); NOT VERIFIED. |
| C7 | ticket_types / ticket_orders / tickets: "no occurrence_id yet" | **WRONG on prod** (the contract §5 already says so) | Prod `ticket_types.occurrence_id` exists; `ticket_orders` has no occurrence_id. 0 ticket types on prod have occurrence_id set. |
| C8 | `ticket_sales_summary_v1(p_organiser_id)` | CONFIRMED (prod) | SECURITY DEFINER, granted to authenticated; gated by `is_admin() OR _is_entity_owner_or_editor('organiser', ...)`. Exposes `orders_pending` and `orders_disputed` as well: there is a PENDING order state (see F7). |
| C9 | Cron patterns: horizon nightly, digest via net.http_post, to-do deadline | CONFIRMED (prod cron.job) | Jobs `nightly-series-horizon-topup`, `organiser-edit-digest`, `organiser-todo-deadline-5m` exist. |
| C10 | Contract §8: "To-do machinery presence NOT VERIFIED" | RESOLVED: present on prod | `organiser-todo-deadline-5m` cron is live. The table name was not re-read. |
| C11 | Contract §5: "One paused row exists today: a never-ran one-off"; S6 = 0 | **WRONG today** | Prod now has 3 paused series: 1 one-off and **2 recurring** (rule, ran, upcoming, up to 81 nights, 53 upcoming). S6 has prod rows; it does not need a fixture. |
| C12 | Website "Hide" = one-tap paused, `eventPage.ts:255-296` | CONFIRMED | `src/modules/organiser/p3/data/eventPage.ts:279` (hide/show row), `:292-296` ONE_TAP: hide = `lifecycleCommand('paused')`, **undo = `lifecycleCommand('live')`**. |
| C13 | Dispatcher concurrency | CONFIRMED (prod) | `apply_aggregate_write_p5` takes `event_series_p5 ... FOR UPDATE` and raises `version_conflict: expected %, got %`. `series_command_p5` (authenticated, service_role) is the front door; `apply_aggregate_write_p5` is postgres/service_role only. |
| C14 | "S1a (#1352)" | AMBIGUOUS | Website PR #1352 is an unrelated docs commit ("docs: land docs/review/1342-r3.md"). The S1a PR must be in the admin repo; NOT VERIFIED (no access). |

## 2. Findings

| # | Sev | Where | What is wrong | Exact change to the contract |
|---|---|---|---|---|
| 1 | **BLOCK** | §3 D3, §7 A1 | Auto-resume cannot run "through the same gate" as written. `_cmd_series_set_lifecycle_p5` with no actor reaches `_assert_can_edit_series_p5`, which checks `is_admin()` (NOT service_role) and raises `permission_denied: no actor`. Passing the owner's uuid as actor would be impersonation, and it would also put the cron under that owner's daily publish limit. | Add D6: "Auto-resume is a dedicated `_p5_series_auto_resume_daily_v1()` (SECURITY DEFINER, owner postgres, called only by pg_cron). It takes `FOR UPDATE` on each due series, re-checks `lifecycle_status='paused' AND resume_on <= london_today`, then explicitly calls `_event_publish_blocking_reason_v1` and the course-sessions check. It does NOT call `organiser_publish_gate_v1` (daily limit exempt: a resume is not a new publish, which matches the service_role exemption). It writes the status itself and bumps `version`. Audit actor = 'system:auto_resume'." State the same rule for the tg_enforce_lifecycle_transition trigger (it must accept the cron's role). |
| 2 | **BLOCK** | §3 D2, §4 | The sold-ticket refusal can leak another organiser's sales. 6 live recurring/course series have 2 organisers. S2 has 2 organisers AND ticket types. An owner of organiser A may pause a series co-run with B; a refusal that names a count or an amount discloses B's sales. Neither D2 nor the GRANT list says where the check sits or what the message contains. | D2 append: "The check runs AFTER the permission branch (as the R5 quota does: a caller who may not edit learns nothing). The refusal is `pause_blocked: tickets_sold` with NO count, amount or night list. The screen may show the count only from `ticket_sales_summary_v1` for organisers the viewer is owner/editor of. The helper `_p5_series_has_upcoming_paid_orders_v1(uuid)` is REVOKEd from PUBLIC, anon and authenticated, so it is not a sales oracle." |
| 3 | FIX | §4 O2, §9a | The O2 premise is WRONG (C4): the database already refuses contributors and the roster. The default (owner + manager only) is right, but the reason is wrong, and P1 "any team organiser" must be reconciled with the owner. | §4 O2 -> "contributor/roster: refused by `_assert_can_edit_series_p5` (owner/manager only since A06/A-DB2, prod-verified). P1 'any team organiser' = owner or manager of ANY organiser on the series (includes co-organisers)." Flag P1 wording to the owner as a NOTE, not a new decision. |
| 4 | FIX | §3 D1/J6 | "Resume now" (paused>live) runs `organiser_publish_gate_v1` (daily publish limit) and, for a course, the sessions check. An organiser can be refused `daily_limit:` on Resume. The contract does not list this refusal. | Add to J6: "Resume refused by daily_limit shows the server message; covered by a matrix cell." Decide (owner): exempt paused>live from the daily limit or keep it. |
| 5 | FIX | §3 D1, eventPage.ts:292-296 | Today Hide's toast Undo = `lifecycleCommand('live')`. After the confirm sheet, Undo and Show bypass the sheet and run the gates in finding 4. The payload `{to:'live'}` must also clear `resume_on` and the nudge state server-side. | D1 append: "The pause sheet has no one-tap Undo; Resume now is the undo. Server: every non-paused target clears resume_on and the nudge state in the same UPDATE (as ended_on is cleared)." |
| 6 | FIX | §6, §9 | Nights inside the pause window are neither cancelled nor skipped. After resume they are past, not-cancelled dates. They can read as "ran" (last-run date, history on the public page, course sessions used). Nothing in the contract says what happens to them. | Add journey J15 "resume after nights passed while paused" and an owner decision: auto-cancel each night that passes while paused (reason 'paused'), or leave it. A course part-way through (S5a ran=2) is the sharpest case. |
| 7 | FIX | §3 D2 | Prod order statuses include pending (`orders_pending` in the summary), refunded (1 row), disputed, expired. "PAID orders" ignores a checkout opened before the pause that completes after it. It also leaves open whether a refunded or disputed order still blocks. | D2 -> "Blocks on status IN ('paid') OR (pending AND created within the checkout TTL). Refunded / expired never block. A disputed order blocks." Add fixture shapes for pending and refunded (1 refunded exists on prod). Add journey J16 "paid order refunded after pause -> no change; pause stays". |
| 8 | FIX | §3 D2 | "Series-level until S1a": S3 sells series-level ticket types (no occurrence_id) on a 70-night series, 53 of them upcoming. A series-level paid order cannot be tied to a night, so S3 is blocked until S1a lands, even if every order was for a past night. | State it: "S3-type series cannot pause until S1a; the refusal's next step is 'ask the team'." This contradicts P14 for that shape; flag it to the owner. |
| 9 | FIX | §5 | Prod survey differs (see §3 below): S1 is 32, not 34; S6 is 2, not 0; max nights is 133, not 125; "Live 55" counts the 2 paused rows. | Replace the §5 numbers with §3 below. Re-run the survey on the day A1 is dispatched. |
| 10 | FIX | §6/§7 A1 | Resume-date validation is missing: a past date, today, a date before the next night, a date after the last scheduled night (course finishes while paused), and a date beyond the horizon. | A1: "`resume_on` must be > London today and <= today + 365 (else `invalid_payload: resume_on`). A date after the last upcoming night is accepted but the sheet warns 'no dates after this; add dates or end it'." Add journeys J17 (past/today date refused), J18 (date after last night). |
| 11 | FIX | §7 A1, DST | The London date is right in `_p5_paused_hides_occurrence_v1`, but cron schedules are UTC. A job at 23:xx UTC runs on the NEXT London day in BST. | A1: "Cron at 06:00 UTC (07:00 BST / 06:00 GMT); the job computes `(now() AT TIME ZONE 'Europe/London')::date` inside; `resume_on <= london_today` (catch-up for missed runs); nudge day N = london_today - resume_on; reminder when resume_on - london_today = 7; every send is idempotent on (series_id, kind, resume_on, day)." Test the dates either side of 2027-03-28 and 2027-10-31. |
| 12 | FIX | §6 J14, §9 | Races: the dispatcher locks and version-checks (C13), so two organisers cannot double-pause. But the cron vs an organiser "Change date"/"Resume now" at the boundary is safe only if the cron takes the same row lock. Admin pause vs organiser resume is also uncovered (9a J14 O3 = R3 is false). | J14 append: "cron takes FOR UPDATE + re-reads status and resume_on; an organiser write in flight wins or the cron skips". Matrix 9a J14 O3 -> yes. |
| 13 | FIX | §9a | Wrong reason codes: J9 O3, J13 O3 and J14 O3 use R3 ("database refuses"), but an admin passes `is_admin()`. Three cells carry no code: J7 O3 "n/a (no email)", J12 O1 "n/a", J12 O3 "n/a". | Add R8 "not a recipient / not a refusal subject". J9 O3, J13 O3, J7 O3, J12 O1 and J12 O3 -> R8. J14 O3 -> yes (finding 12). |
| 14 | FIX | §9b | 12 cells carry no code (§4 below). 11 cells carry a wrong code: J1/J2 S6 use R7 for "already paused" (should be a new code R9 "already paused: see J4-J6"); J7 S3 R3 should be "blocked = J3"; J11 S7 R5 should be R1; J11 S8 R4 is wrong because a paused one-off exists on prod and EventPausedBanner is shared, so the banner copy change reaches one-offs; J14 S2/S3/S4a/S4b R6 is false (they have prod rows; a race needs two sessions, not a fixture); J3 S1 R6 is really "no paid sales". | Add R9 (already paused) and R10 (no paid sales on this shape: refusal walked on S3 + fixture). Turn "blocked", "after J1" and "no paid" into codes or yes. J11 S8 -> yes (the one-off banner must keep "On hiatus" or get the same copy: decide). |
| 15 | FIX | §4, §9 | Missing persons: a co-organiser (owner of the second organiser); cron/system; a team member removed while the series is paused (reminder recipients must be re-read at send time, never cached at pause time); an organiser of ANOTHER page (O5 covers it only if "no membership" includes "member of a different organiser"). | Add O6 co-organiser, O7 system (cron). O5 text: "includes owner of an unrelated organiser". J7/J9: "recipients = current owner/manager emails at send time". |
| 16 | FIX | §5/§9 | Missing shapes: multi-organiser (6 live); all upcoming nights cancelled (1 live, inside S4c, so R2 holds); series paused by an admin, then the organiser changes the date (the S6 rows on prod have no resume_on, so the open-ended display must handle a legacy pause with no row in the side table); a course part-way through (S5a ran). | Add S10 multi-org, S11 legacy pause (no resume_on). J4 on S11 must work. |
| 17 | FIX | §7 A1 | No GRANT list is written yet; lead constraint (4) needs one. | Insert §11 GRANT LIST (below, §5). |
| 18 | NOTE | prod | `event_publish_readiness_v1` and `_event_publish_blocking_reason_v1` are granted to anon and authenticated, so anyone can read any series' blocking reason by id. This predates the feature. The new helpers must NOT copy that pattern. | None to this contract; raise separately. |
| 19 | NOTE | §1(1), §7 | Sequencing claims could not be checked (no admin access). On prod, both sides touch `apply_aggregate_write_p5(jsonb)` (the dispatcher, ~92 KB) and `_cmd_series_set_lifecycle_p5(uuid, jsonb, uuid)`. S1a touches `ticket_orders`/`ticket_types`, which D2's helper reads. | §1(1): name the admin PR number for S1a explicitly ("admin #1352"); website #1352 is unrelated. A1 must re-read both function bodies from admin origin/main at slice time. |
| 20 | NOTE | Website density exclusions | The planned Website files are p3 `StatusSheet.tsx`, `EventPage.tsx`, `data/eventPage.ts`, `EventPausedBanner.tsx`, `BentoPage.tsx`, `lifecycleBanner.ts`, `buildEventPageModel.ts`. None is in the CLAUDE.md exclusion list. Calendar files need no change: paused series are already excluded by `_p5_series_public_visibility_v1`. | Add to §7 A2: "touches no density-excluded file". |

VERDICT: BLOCK

Two blockers, both fixable in a DRAFT 3 without new owner decisions. Finding 1: the auto-resume path does not exist as written, because cron has no actor and `_assert_can_edit_series_p5` refuses it. Finding 2: the refusal can leak a co-organiser's sales. The rest are FIX or NOTE.

## 3. Prod survey re-run (2026-11-10, counts only; recurring + course, live or paused)

| Shape | Contract n | Reviewer n | Diff |
|---|---|---|---|
| S1 live, rule, ran, upcoming, no ticket types | 34 | 32 (30 single-org + 2 two-org) | -2 |
| S2 live, rule, never ran, ticket types, no paid | 1 | 1 (2 organisers, 53 upcoming) | = |
| S3 live, rule, ran, paid | 1 | 1 (70 nights, 53 upcoming) | = |
| S4a / S4b / S4c | 1 / 1 / 9 | 1 / 1 / 9 (one has every upcoming night cancelled) | = |
| S5a / S5b | 3 / 5 | 3 (2 ran, 1 never) / 5 | = |
| S6 already paused | 0 | **2** (rule, ran, upcoming; max 81 nights) | +2 |
| S7 draft / archived / ended | 8 / 13 / 23 | 8 / 13 / 23 | = |
| total series / paid orders | 766 / 2 | 766 / 2 (statuses: expired 2, paid 2, refunded 1) | = |
| max nights in a series / max upcoming | 125 / 56 | 133 / 56 | +8 |
| course with no session count | (not surveyed) | 0 | new |
| ticket types with occurrence_id | (not surveyed) | 0 | new |
| multi-organiser live recurring/course | (not surveyed) | 6 | new |
| paused one-off | 1 | 1 | = |

London date: hides use `(now() AT TIME ZONE 'Europe/London')::date`, which is correct across DST. The resume-day job needs finding 11.

## 4. Matrix tallies

**9a person x journey** (14 x 5 = 70 cells): yes 24, coded 43, GAP (no code) 3 = J7 O3, J12 O1, J12 O3. Wrong code 3 = J9 O3, J13 O3, J14 O3. The O2 R3 cells are TRUE on prod (C4). The O4 R3 cells are true: anon has no grant on `series_command_p5`.

**9b journey x shape** (13 x 12 = 156 cells): yes 39, coded 105, GAP 12.
- GAP cells: J1 S3, J2 S3 ("blocked"); J3 S2, S4a, S4b, S5a ("no paid"); J7 S1, S2, S4a, S4b, S5a ("after J1"); J11 S3 ("n/a blocked").
- Wrong code 11: J1 S6, J2 S6, J3 S1, J7 S3, J11 S7, J11 S8, J14 S2, J14 S3, J14 S4a, J14 S4b, plus J11 S4c (R2 does not apply if the series was paused before its last night passed; a legacy S6-type row can reach it).
- Per row (yes/coded/gap): J1 5/6/1, J2 5/6/1, J3 1/7/4, J4 2/10/0, J5 2/10/0, J6 2/10/0, J7 1/6/5, J8 2/10/0, J9 2/10/0, J10 1/11/0, J11 6/5/1, J13 7/5/0, J14 3/9/0.
- J12 has no 9b row; this is acceptable, because it is person-only.

Missing journeys (add): J15 nights passed while paused; J16 refund or dispute after pause; J17 resume date past or today; J18 resume date after the last night; J19 Resume refused by daily limit; J20 admin pauses, organiser changes the date; J21 organiser removed from the team while paused (no reminder to them).

## 5. GRANT list the contract should carry (proposed, for the owner)

| Object | Grant to | Must NOT be granted |
|---|---|---|
| `series_command_p5(jsonb)` (unchanged front door) | authenticated, service_role | anon, PUBLIC |
| `_cmd_series_set_lifecycle_p5(uuid,jsonb,uuid)` (extended payload `{to, resume_on?}`) | none beyond the owner postgres (+ service_role as today) | authenticated, anon, PUBLIC |
| new `_p5_series_has_upcoming_paid_orders_v1(uuid)` | none (called inside definer functions) | authenticated, anon, PUBLIC |
| new `_p5_series_auto_resume_daily_v1()` + nudge/reminder enqueue | none (pg_cron runs as postgres) | service_role, authenticated, anon, PUBLIC |
| new resume/nudge columns or side table | read through the snapshot/page RPC only; the public page RPC may expose `resume_on` (banner shows it) | direct table SELECT/INSERT/UPDATE for anon and authenticated (RLS on, no policies for them) |
| new outbox table | service_role (edge function) | anon, authenticated |
| edge function | cron auth header, as in the digest pattern | public invocation |

Each new function: `REVOKE ALL ... FROM PUBLIC, anon, authenticated` explicitly, because Supabase default privileges grant EXECUTE to anon and authenticated.

## Not verified
- Every admin-repo file:line: no access to `bachata-admin-11april` from this session. Checked against deployed prod function bodies instead.
- Whether `claude/courses-owner-set-recurrence` and admin S1a are still unmerged, and their exact signatures.
- The page-RPC 200/404 rule for paused series (830000), which was not re-read.
- The to-do table name and shape (only its cron job was seen).
- `tg_enforce_lifecycle_transition`'s behaviour for a cron (postgres) actor.
- No browser or phone walk: this is a docs-only review.
