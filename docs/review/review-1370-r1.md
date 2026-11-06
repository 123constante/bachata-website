# Review 1370-r1 -- independent review of PR #1370 (`claude/foundations-web` @ `3194f6d`)

Brief: `docs/briefs/review-1370-r1.md` (brief/review-1370-r1 @ 2d56b90). Build brief: `docs/briefs/foundations-web.md` (brief/foundations-web).
Reviewer: zero-context cloud worker, read-only on the PR branch. Fresh worktree at `3194f6d805f1169f313d111ce1f1670f980d8eb8`, `npm ci` (751 packages), no symlinks or junctions.
Date: 2026-11-05.

## Verdict: PASS-with-fixes

The slice does what the brief says, in the order the brief says, and every refusal path I probed fails closed. The lane re-reads the required jobs at the pinned head after slice 1's pause re-read and before the merge PUT; `isMoney` and `isGuardPath` sit on all three auto paths; the arming readers are off the variables with the variables kept only as drift input; the two new workflows are least-privilege, `ref: main`, `persist-credentials: false`, token by `env:` only, and read no event text. 45 of 55 mutants were killed. Nothing here blocks the owner's Approve.

Every surviving mutant is a TEST gap, not a behaviour bug: the live (patch-parsing) branch of `isMoney` (F1, F5), the Dependabot CLI's file-list completeness checks (F13), the drill-record writer's field validation (F14) and two entries of the live money set that no test pins (F15). The one thing the owner should decide with eyes open is F2: on real main history the money set refuses about a third of recent merges, mostly on the bare table name `tickets`.

## Findings (severity, file:line, how reproduced)

1. **F1 Medium (test gap).** `scripts/lib/is-money.mjs:110` -- the `-` (removed) branch of the PATCH parser is untested. Mutant IM09 (`(l.startsWith('+') || l.startsWith('-'))` -> `l.startsWith('+')`) survives the whole suite. `tests/automationMoney.test.ts:62` ("a REMOVED line counts too") uses the `{added, removed}` ARRAY form, which the live callers never send (both read GitHub pull-file objects, which carry only `patch`). On the live shape the mutant still returns `money: true`, but with reason `money set: unreadable (truncated patch ... 0 of 1 changed lines)` instead of the A16 reason `money set: <name>`. Fix: one table row built with the `file()` helper and removed lines only, e.g. `file('docs/a.md', [], ['call my_tickets_v1'])` expecting `money set: my_tickets_v1`.
2. **F2 Medium (real-data / operational; decide, no code change required).** `.github/automation/money-set.json` `tables: ["tickets", ...]`. Running the PR's `isMoney` over the last 50 squash merges on `origin/main` (pull-file objects rebuilt from `git show -M`): 17 of 50 are money, 33 clean, 0 unreadable; `tickets` is the first or only hit in 15 of the 17 (e.g. #1324 "one message on a save conflict", #1327 "auto-walk picture helper", and docs-only #1204, #1228, #1297, #1299). Of the 8 docs-only merges in that window, 4 would be refused. The entry comes from the contract's seed (fact 6: table `tickets`) and the refusal is fail-closed, so this is INTENDED per the brief; but the hard limit "no new refusal fires on a legitimate docs-only PR" will be met only for docs that never say the word `tickets`. Recommendation: say this base rate in `docs/automation-foundations.md` and the handover so the owner chooses between keeping the contract list verbatim and narrowing `tickets` (e.g. `public.tickets`, `from('tickets')`) in a later guard change. Everything else in the frequency list is a genuine ticketing name.
3. **F3 Low (documented decision, revisit for `statements`).** `scripts/lib/is-money.mjs:70` -- names are case-sensitive. Probes: `Ticket_Orders`, `TICKET_ORDERS`, `Tickets` (capitalised prose) and the statement `ALTER TABLE Ticket_Orders RENAME COLUMN x TO y` are NOT hits; `ticket_orders.id`, `("ticket_orders")`, `public.ticket_orders` are. The rule is written in the file header and tested both sides (`tests/automationMoney.test.ts:64-66`), so not a bug. But Postgres folds unquoted identifiers to lower case, so for the `statements` input (cases 3 and 4, which the admin repo will reuse) a case-insensitive match is the correct reading of "the same table". Suggest `i` on names for `statements` at least, with the opposite-side test kept for paths/lines if wanted.
4. **F4 Low.** `money-set.json` globs `**/*stripe*`, `**/*payout*`, `**/*refund*`, `src/**/*ticket*` match the FILE NAME segment only (`is-money.mjs:58-67`: `**/` then `[^/]*stripe[^/]*` anchored). Probe `src/Stripe/Client.ts` -> no path hit; a new `src/stripe/` or `src/.../ticketing/` directory with plain file names is covered only by content. Add the `**/*stripe*/**` (etc.) forms.
5. **F5 Low (test gap).** Mutant IM15 (bare `**` -> one segment) survives: no test puts a NESTED file under a `**`-terminated glob of the real set. On the live set `src/modules/organiser/p3/door/scan/Camera.tsx` becomes a non-hit under the mutant. Real nested files exist (`src/modules/tickets/__tests__/*`). Fix: one row with a two-level path under `src/modules/tickets/**` or `src/modules/organiser/p3/door/**`.
6. **F6 Low/Info.** `is-money.mjs:110` counts any `+`/`-`-prefixed line, so `+++ b/...` / `--- a/...` headers would count as changed lines if a caller ever passes a FULL unified diff (probe: `changes: 3`, one real line plus two headers -> accepted as complete, `money: false`). Both live callers use the GitHub `patch` field, which starts at `@@`, so no live effect; a `startsWith('+++')`/`('---')` exclusion or a comment pinning the GitHub shape would close it.
7. **F7 Low.** `.github/automation/guard-paths.json` does not list `scripts/lib/entry-point.mjs`. Every new guard CLI dispatches through `isEntryPoint(import.meta.url)` from that file; a change there could make every check a silent no-op. `scripts/run-lint-chain.mjs`, `scripts/pre-ship.mjs` and the `package.json` script entries are likewise unguarded (a bot PR can remove a chain link). `entry-point.mjs` is the one worth adding now; the others are a judgement for the owner.
8. **F8 Info (behaviour note, not a regression).** `bot-automerge.yml` / `dependabot-automerge.yml`: when the arming gate is OFF the "Disable auto-merge" steps are skipped too (`if: ... steps.arming.outputs.enabled == 'true' && ...`). A PR armed while ON keeps GitHub auto-merge when the file is later turned OFF. Today's `vars` gate behaved the same (the job did not run), so no regression; the pause label is the disarming control, not `arming.json`. Worth one line in `docs/automation-foundations.md`.
9. **F9 Info.** `scripts/automation-money-check.mjs:37-46` reads `/pulls/N/files` at the PR's CURRENT head, not the event's `github.event.pull_request.head.sha`. A push between the event and the step is re-run by `synchronize`, so the window is small, and the `changed_files` count is checked in code (but untested: F13). Cheap hardening: pass the event sha and refuse when `pr.head.sha` differs.
10. **F10 Info (scope vs the brief's Files list).** Files touched but not listed: `scripts/automation-arming.mjs` (Part 3.3 "first step that reads the file and prints outputs"), `scripts/automation-money-check.mjs` (Part 2.3 "small CLI over isMoney"), `scripts/automation-pause.mjs` (+`setPauseLabel`, keeps slice 1 as the ONE label-adding site for Part 5.3), `scripts/check-workflow-log-secrets.mjs` (Part 4.5), `scripts/write-drill-record.mjs` (Part 6.4), `scripts/pre-ship.mjs` (comment + 10 `CHECKS` rows; the first 34 `CHECKS` equal `LINKS` exactly, verified by import), `scripts/prove-entry-point-dispatch.mjs` (TARGETS for the 9 new entry points; required by the convention check), `tests/automationFakeGitHub.ts`, `tests/automationDrillRecords.test.ts`, `tests/automationGuardPaths.test.ts` (allowed splits), `tests/fixtures/ruleset-main-checks.json` (Part 1.4 fixture), `tests/realDataVerified.test.ts` / `tests/automationPause.test.ts` / `tests/autopilotWorkflow.test.ts` / `tests/automergeClassify.test.ts` / `tests/autopilotMerge.test.ts` (harness injection through the ONE helper `FOUNDATIONS_OK` in `tests/autopilotTable.ts`; the workflow assertions were moved from `vars.*` to the arming step/outputs, none loosened). All explained by Parts 2-6; nothing outside the brief's intent.
11. **F11 Info.** `write-drill-record.mjs --self-test` exists (`npm run drill-record:self-test`) but is not a lint-chain link; the brief did not require one.
12. **F12 Info.** `npm run typecheck` exits 2 with 109 errors at the PR head AND 109 identical errors on `origin/main` (second worktree, own `npm ci`; the only diff is line numbers in `app/routes/api.og.card.tsx`). Pre-existing, not attributable. CI's `wallclock-brand` (the typecheck job) is green at the head because its docs-only gate skipped the compile for a PR with no `src/`/`app/` change.
13. **F13 Medium (test gap).** `scripts/automation-money-check.mjs:39-45` -- the Dependabot CLI's completeness checks are untested: MC01 (drop the `changed_files !== files.length` refusal), MC05 (stop paginating after page 1) and MC02 (`money=` output derived from a truthy test instead of `=== false`) all survive. The brief requires "a mutant that proves each new reader CAN fail" for the isMoney wiring on each of the three auto paths; the Dependabot path's wiring test covers the workflow text and `isMoney` itself, not this CLI's file read. Fix: a `main(env, { fetch })` test with a fake `/pulls/N` saying `changed_files: 150` and (a) a files API that returns 100 then 50 (expect `money=false` only when both pages are read), (b) one that returns 100 then an error, (c) a mismatching count -> `money=true` with `money set: unreadable (file list incomplete ...)`.
14. **F14 Low (test gap).** `scripts/write-drill-record.mjs:13-18, 33` -- `buildRecord` field validation and the `pull_request` filter on the issue search are untested: WD02 (non-boolean `pass` accepted), WD03 (`component_sha` of any hex length accepted), WD04 (a PR titled `DRILL RECORDS` counts as the issue) survive; the self-test's bad-input cases cover `--pass` and `--drill` only. The helper never runs live in this slice, so Low; one table of bad `buildRecord` inputs closes it.
15. **F15 Low (test gap).** `.github/automation/money-set.json` -- dropping `"**/*stripe*"` (MS02) or `"BOOKING_FEE_PENCE"` (MS09) from the LIVE file is not caught; dropping any of the other nine probed entries is (`tests/automationMoney.test.ts:37` pins the tables, and the A16 end-to-end cases pin the flags, env names, functions and the ticket globs). Pin the `paths` and `keys` lists the same way the tables are pinned.

Refuted / confirmed from the partial first read (website-18):
- "Money-set scope is narrow (pence, amount, price_pence, booking_fee, refund, payout, currency, payment_intent missing)": CONFIRMED as fact, judged INTENDED. The brief seeds from fact 6 plus names the worker derives; `BOOKING_FEE_PENCE`, `**/*refund*`, `**/*payout*`, `STRIPE_*` are present. `src/integrations/supabase/eventRpcs.ts` (`price`, `currency`, `price_from`, `ticket_url` on event rows) and `src/modules/organiser/p3/screens/PriceCard.tsx` (imports `CURRENCIES`/`PriceRow` from `events/seriesExtras`, labels only) are event-listing DISPLAY fields with no route into checkout or fee maths: not money paths. F2 shows the live set is, if anything, broad.
- "Case-sensitive; `-` and `.` are boundaries; price_ regex needs 14+ alphanumerics with a digit": CONFIRMED (probes: `price_test123` no, `price_1OabcDEFghijkLMNopqr` yes, `price_1234567890ABCD` yes, `price_abcdefghijklmn` no, `price_display`/`price_currency` no). Real Stripe ids are 24+ chars after the prefix, so short "test ids" are a fixture concern only. See F3.
- "+++/--- lines counted as changed lines": CONFIRMED for a full unified diff, NOT reachable from either live caller (F6).
- "Scripts beyond the first Files list": all explained (F10).
- "Not verified by the first reader: pre-ship, prove-entry-point-dispatch, realDataVerified, automationPause, autopilotWorkflow": now verified (F10, F12).

## Boundary probes on real shapes (PR's `isMoney` + live `money-set.json`)

| Input | Result |
|---|---|
| `Ticket_Orders` / `TICKET_ORDERS` / `Tickets` in a changed line | no hit (F3) |
| `ticket-orders` (hyphen) | no hit (`-` is a boundary; `ticket-checkout` etc. are listed as names) |
| `ticket_orders_x`, `xticket_orders` | no hit (whole identifier) |
| `ticket_orders.id`, `from("ticket_orders")`, `public.ticket_orders` | `money set: ticket_orders` |
| statement `CREATE TABLE ticket_orders (...)` | `money set: ticket_orders`; `ALTER TABLE Ticket_Orders ...` no hit (F3) |
| rename `src/lib/ticketBookingFee.ts` -> `src/lib/fees.ts`, no content | `money set: src/lib/ticketBookingFee.ts` (old name scanned) |
| rename into `src/modules/tickets/x.ts` | `money set: src/modules/tickets/**` |
| big file, `patch` omitted, `changes: 5000` | `money set: unreadable (no patch for ...)` |
| empty `patch`, `changes: 2` | `money set: unreadable (truncated patch ...: 0 of 2 changed lines)` |
| binary (`changes: 0`, no patch) outside / inside a money path | no hit / `money set: src/modules/tickets/**` |
| `patch` present, `changes` undefined (fake shape) | scanned, no truncation check (fixtures only) |
| `-STRIPE_WEBHOOK_SECRET` removed line | `money set: STRIPE_WEBHOOK_SECRET` |
| ` STRIPE_WEBHOOK_SECRET` context line only | no hit (context is not a change) |
| `src/Stripe/Client.ts` | no path hit (F4) |
| `src\modules\tickets\x.ts` (backslash) | hit via the name `tickets` only; `isGuardPath` refuses backslashes outright |
| prose "Buy tickets at the door" in `docs/faq.md` | `money set: tickets` (F2) |

## Mutants (55 run; one exact-string change each, full suite `npx vitest run tests/automation tests/autopilot tests/automergeClassify tests/realDataVerified` plus the script's `--self-test` where it has one; restored after each)

**45 killed, 10 survived, 55 total.** Per target: `lib/is-money.mjs` 16/18; `money-set.json` 9/11; `automation-arming.mjs` 4/4; `lib/arming.mjs` 4/4; `automation-money-check.mjs` 3/6; `automation-pause.mjs` 2/2; `check-workflow-log-secrets.mjs` 5/5; `write-drill-record.mjs` 2/5. Survivors: IM09, IM15, MS02, MS09, MC01, MC02, MC05, WD02, WD03, WD04 (findings F1, F5, F13, F14, F15).

| id | file | what changed | result | killed by |
|---|---|---|---|---|
| IM01 | `lib/is-money.mjs` | drop LEFT identifier boundary in nameRe | killed | 1 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason whole identif" |
| IM02 | `lib/is-money.mjs` | drop RIGHT identifier boundary in nameRe | killed | 1 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason whole identif" |
| IM03 | `lib/is-money.mjs` | path globs become case-SENSITIVE | killed | 17 test(s) in tests/automationArming.test.ts, tests/automationFoundations.test.ts, tests/automationGuardPaths.test.ts, tests/automationMoney.test.ts, tests/automationPause.test.ts, tests/automergeClassify.test.ts, tests/autopilotMerge.test.ts, tests/autopilotMutants.test.ts, tests/autopilotR2.test.ts, tests/autopilotR3.test.ts, tests/autopilotR4b.test.ts, tests/autopilotR4c.test.ts, tests/realDataVerified.test.ts; e.g. " r4b merge-lane mutants the unmutated copy passes every r4b row (the harness is honest)" / " r4b merge-lane mutants catches: drop the agent-instruction refusal" |
| IM04 | `lib/is-money.mjs` | names become case-INsensitive | killed | 1 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason names are cas" |
| IM05 | `lib/is-money.mjs` | no files -> money:false (fail OPEN) | killed | 1 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason no files" |
| IM06 | `lib/is-money.mjs` | unreadable set -> money:false (fail OPEN) | killed | 1 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason an unreadable" |
| IM07 | `lib/is-money.mjs` | drop truncated-patch check | killed | 1 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason a truncated p" |
| IM08 | `lib/is-money.mjs` | missing patch -> no lines (fail OPEN) | killed | 1 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason no patch and " |
| IM09 | `lib/is-money.mjs` | REMOVED lines not scanned | **SURVIVED** |  |
| IM10 | `lib/is-money.mjs` | previous_filename (rename old name) not scanned | killed | 1 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason a previous_fi" |
| IM11 | `lib/is-money.mjs` | statements not scanned | killed | 2 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason statements (c" / " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason statements (c" |
| IM12 | `lib/is-money.mjs` | broken file with no other hit -> money:false | killed | 3 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason no patch and " / " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason a truncated p" |
| IM13 | `lib/is-money.mjs` | keys regex anchoring not validated | killed | 1 test(s) in tests/automationMoney.test.ts; e.g. " money-set.json (PART 2.1) parseMoneySet fails closed: an unanchored key regex" |
| IM14 | `lib/is-money.mjs` | '*' inside a name becomes literal (no wildcard) | killed | 2 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason a * entry: ti" / " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason statements (c" |
| IM15 | `lib/is-money.mjs` | bare '**' in a glob matches one segment only | **SURVIVED** |  |
| IM16 | `lib/is-money.mjs` | path-glob hits dropped (content only) | killed | 11 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason a path under " / " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason a path glob i" |
| IM17 | `lib/is-money.mjs` | keys regex entries never fire | killed | 5 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason price id rege" / " A16: every (case, auto path) pair is refused with 'money set: <name>' lane (autopilot mer" |
| IM18 | `lib/is-money.mjs` | changes===0 shortcut widened: any missing patch -> no lines | killed | 1 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason no patch and " |
| MS01 | `money-set.json` | drop path glob src/modules/tickets/** | killed | 5 test(s) in tests/automationMoney.test.ts; e.g. " money-set.json (PART 2.1) seeded from fact 6: flags, env names, the seed paths, the admin" / " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason a path under " |
| MS02 | `money-set.json` | drop path glob **/*stripe* | **SURVIVED** |  |
| MS03 | `money-set.json` | drop path .github/automation/money-set.json (case 7) | killed | 5 test(s) in tests/automationMoney.test.ts; e.g. " money-set.json (PART 2.1) seeded from fact 6: flags, env names, the seed paths, the admin" / " A16: every (case, auto path) pair is refused with 'money set: <name>' lane (autopilot mer" |
| MS04 | `money-set.json` | drop table ticket_orders | killed | 7 test(s) in tests/automationMoney.test.ts; e.g. " money-set.json (PART 2.1) seeded from fact 6: flags, env names, the seed paths, the admin" / " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason a docs path w" |
| MS05 | `money-set.json` | drop function stripe-webhook | killed | 2 test(s) in tests/automationMoney.test.ts; e.g. " money-set.json (PART 2.1) seeded from fact 6: flags, env names, the seed paths, the admin" / " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason edge function" |
| MS06 | `money-set.json` | drop the price_ regex entry | killed | 5 test(s) in tests/automationMoney.test.ts; e.g. " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason price id rege" / " A16: every (case, auto path) pair is refused with 'money set: <name>' lane (autopilot mer" |
| MS07 | `money-set.json` | drop flag organiserTicketing | killed | 3 test(s) in tests/automationMoney.test.ts; e.g. " money-set.json (PART 2.1) seeded from fact 6: flags, env names, the seed paths, the admin" / " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason flag name" |
| MS08 | `money-set.json` | drop env STRIPE_WEBHOOK_SECRET | killed | 2 test(s) in tests/automationMoney.test.ts; e.g. " money-set.json (PART 2.1) seeded from fact 6: flags, env names, the seed paths, the admin" / " isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason env name" |
| MS09 | `money-set.json` | drop key BOOKING_FEE_PENCE | **SURVIVED** |  |
| MS10 | `money-set.json` | version 1 -> 2 (file becomes unreadable) | killed | 7 test(s) in tests/automationFoundations.test.ts, tests/automationGuardPaths.test.ts, tests/automationMoney.test.ts; e.g. " run(): mergePr re-reads the pinned head check-runs immediately before the PUT (A17) every" / " run(): mergePr re-reads the pinned head check-runs immediately before the PUT (A17) A17: " |
| MS11 | `money-set.json` | price regex loses its ^ anchor | killed | 7 test(s) in tests/automationFoundations.test.ts, tests/automationGuardPaths.test.ts, tests/automationMoney.test.ts; e.g. " run(): mergePr re-reads the pinned head check-runs immediately before the PUT (A17) every" / " run(): mergePr re-reads the pinned head check-runs immediately before the PUT (A17) A17: " |
| AR01 | `automation-arming.mjs` | gate reads the VARIABLES instead of the file | killed | 2 test(s) in tests/automationArming.test.ts; e.g. " scripts/automation-arming.mjs: the workflows' reader A30: the outputs are the FILE's valu" / " scripts/automation-arming.mjs: the workflows' reader an unreadable file: enabled=false, a" |
| AR02 | `automation-arming.mjs` | usage error writes enabled=true | killed | 1 test(s) in tests/automationArming.test.ts; e.g. " scripts/automation-arming.mjs: the workflows' reader an unknown gate key is a usage error" |
| AR03 | `automation-arming.mjs` | drift notice lines dropped from the log | killed | 2 test(s) in tests/automationArming.test.ts; e.g. " scripts/automation-arming.mjs: the workflows' reader A30: the outputs are the FILE's valu" / " scripts/automation-arming.mjs: the workflows' reader an unreadable file: enabled=false, a" |
| AR04 | `automation-arming.mjs` | gate always ON | killed | 3 test(s) in tests/automationArming.test.ts; e.g. " scripts/automation-arming.mjs: the workflows' reader A30: the outputs are the FILE's valu" / " scripts/automation-arming.mjs: the workflows' reader off: a visible ::notice:: that the j" |
| AR05 | `lib/arming.mjs` | SAFE_ARMING.autopilot_live defaults true | killed | 4 test(s) in tests/automationArming.test.ts; e.g. " readArming(text): strict; anything missing / unreadable / unknown = the SAFE value and a " / " readArming(text): strict; anything missing / unreadable / unknown = the SAFE value and a " |
| AR06 | `lib/arming.mjs` | variable == file comparison always silent (no drift) | killed | 6 test(s) in tests/automationArming.test.ts; e.g. " effectiveArming({file, vars}) (PART 3.2): the file decides, a disagreeing variable is a d" / " effectiveArming({file, vars}) (PART 3.2): the file decides, a disagreeing variable is a d" |
| AR07 | `lib/arming.mjs` | version check dropped | killed | 1 test(s) in tests/automationArming.test.ts; e.g. " readArming(text): strict; anything missing / unreadable / unknown = the SAFE value and a " |
| AR08 | `lib/arming.mjs` | non-boolean value accepted as truthy | killed | 10 test(s) in tests/automationArming.test.ts, tests/automationGuardPaths.test.ts; e.g. " arming.json (PART 3.1): mirrors TODAY's effective state, so merging this changes no behav" / " arming.json (PART 3.1): mirrors TODAY's effective state, so merging this changes no behav" |
| MC01 | `automation-money-check.mjs` | changed_files count mismatch not checked | **SURVIVED** |  |
| MC02 | `automation-money-check.mjs` | money output defaults to false when verdict undefined | **SURVIVED** |  |
| MC03 | `automation-money-check.mjs` | files read failure -> money=false (fail OPEN) | killed | 2 test(s) in tests/automationMoney.test.ts; e.g. " Dependabot CLI fails closed a files read failure = money=true, exit 0 (no auto-merge, not" / " Dependabot CLI fails closed a file count that disagrees with the PR = unreadable" |
| MC04 | `automation-money-check.mjs` | guard-path check dropped | killed | 10 test(s) in tests/automationGuardPaths.test.ts; e.g. " A18: each guard-path edit is refused by layer (1) on every auto path AND flagged RED by l" / " A18: each guard-path edit is refused by layer (1) on every auto path AND flagged RED by l" |
| MC05 | `automation-money-check.mjs` | pagination stops after page 1 | **SURVIVED** |  |
| MC06 | `automation-money-check.mjs` | missing GH_TOKEN/REPO/PR_NUMBER -> money=false | killed | 1 test(s) in tests/automationMoney.test.ts; e.g. " Dependabot CLI fails closed missing config = exit 2 and money=true" |
| AP01 | `automation-pause.mjs` | setPauseLabel posts an EMPTY label list | killed | 1 test(s) in tests/automationGuardPaths.test.ts; e.g. " escalateRed: sets the pause label on THE pinned issue and posts ONE notice naming the sha" |
| AP02 | `automation-pause.mjs` | setPauseLabel never POSTs | killed | 1 test(s) in tests/automationGuardPaths.test.ts; e.g. " escalateRed: sets the pause label on THE pinned issue and posts ONE notice naming the sha" |
| LS01 | `check-workflow-log-secrets.mjs` | ghp_ shape dropped | killed | 3 test(s) in tests/automationRegister.test.ts; e.g. " A22: log secret matcher (dummy echo drill, fixtures only) a deliberate echo of each dummy" / " A22: log secret matcher (dummy echo drill, fixtures only) main over an injected leaking t"; also ; scripts/check-workflow-log-secrets.mjs --self-test exit 1 |
| LS02 | `check-workflow-log-secrets.mjs` | whsec_ shape dropped | killed | 1 test(s) in tests/automationRegister.test.ts; e.g. " A22: log secret matcher (dummy echo drill, fixtures only) a deliberate echo of each dummy" |
| LS03 | `check-workflow-log-secrets.mjs` | a leak exits 0 | killed | 2 test(s) in tests/automationRegister.test.ts; e.g. " A22: log secret matcher (dummy echo drill, fixtures only) main over an injected leaking t" / " A22: log secret matcher (dummy echo drill, fixtures only) --self-test passes"; also ; scripts/check-workflow-log-secrets.mjs --self-test exit 1 |
| LS04 | `check-workflow-log-secrets.mjs` | sk_live_ shape dropped | killed | 1 test(s) in tests/automationRegister.test.ts; e.g. " A22: log secret matcher (dummy echo drill, fixtures only) a deliberate echo of each dummy" |
| LS05 | `check-workflow-log-secrets.mjs` | github_pat_ length 82 -> 90 (real PATs missed) | killed | 1 test(s) in tests/automationRegister.test.ts; e.g. " A22: log secret matcher (dummy echo drill, fixtures only) a deliberate echo of each dummy" |
| WD01 | `write-drill-record.mjs` | non-unique DRILL RECORDS issue accepted | killed | 1 test(s) in tests/automationDrillRecords.test.ts; e.g. " write-drill-record (helper for later drill workflows; fake fetch, never live) no issue / " |
| WD02 | `write-drill-record.mjs` | pass may be a non-boolean | **SURVIVED** |  |
| WD03 | `write-drill-record.mjs` | component_sha accepts any hex length | **SURVIVED** |  |
| WD04 | `write-drill-record.mjs` | pull requests count as the DRILL RECORDS issue | **SURVIVED** |  |
| WD05 | `write-drill-record.mjs` | record posted even when post says not posted | killed | 2 test(s) in tests/automationDrillRecords.test.ts; e.g. " write-drill-record (helper for later drill workflows; fake fetch, never live) the CLI bui" / " write-drill-record (helper for later drill workflows; fake fetch, never live) --self-test"; also ; scripts/write-drill-record.mjs --self-test exit 1 |

## Wiring checks

- Lint chain: 10 new links in `scripts/run-lint-chain.mjs` LINKS (self-test ahead of each check), matching 10 `package.json` entries (+`check:ruleset-vs-required-jobs[:self-test]`, not chained: needs the ruleset JSON, slice 2b; +`drill-record:self-test`, F11). `npm run lint`: 34 of 34 links green. `pre-ship.mjs` CHECKS: first 34 equal LINKS (verified by import).
- `scripts/prove-entry-point-dispatch.mjs`: all 9 new entry points listed; `check:script-conventions` + self-test green.
- Every new check's `--self-test` exits 0: check-required-jobs (10 cases), check-secrets-register (18), check-identity-register (11), check-drill-records (10), check-ruleset-vs-required-jobs (9), check-workflow-log-secrets (11); live runs exit 0; `check-ruleset-vs-required-jobs --ruleset-json tests/fixtures/ruleset-main-checks.json`: 7 contexts, 0 differences.
- Workflows: `vars.*` remains only as `ARMING_VAR_*` env (drift input) and in the untouched `cloudflare-purge-on-deploy.yml`. Permissions: `autopilot.yml` new job `arming` has `contents: read, issues: write` (the autopilot job already holds `issues: write`); `bot-automerge.yml`, `dependabot-automerge.yml` permission blocks unchanged (`contents: write` on the Dependabot job is pre-existing on main); new workflows `contents: read` and `contents: read, issues: write`. No `actions: write`, no `workflows`. No `github.event.pull_request.*`/`head_ref` in either new workflow. No BOM. No secret-shaped literal in the diff (the one regex hit is a base64 `vercel.json` fixture).
- `secrets-register.json`: 26 entries; `acts_as` null (25) or `github-actions[bot]` (1); `owner-pc-gh-session` acting as `123constante` lives under `owner_credentials` (documented, not an automation entry; rule (d) checks `entries`). 26 `grandfathered` annotations present and listed in the handover.
- Protected files untouched: calendar density-exclusion files, `vite.config.ts`, `perf-budgets.json`, `supabase/` (nothing under it in the diff stat).
- `check:automation-workflow-allowlist` (`--local`): CANNOT RUN on a detached worktree (`HEAD_REF`/`PR_FILES` route also reports detached); the PR body records the expected flag of the 5 new/changed workflows, list not edited. Not re-proven here.

## CI at the PR head `3194f6d` (check-runs API, 35 runs, all completed)

| Job (check-run) | Conclusion | Role |
|---|---|---|
| integrity | success | required (ruleset + pr_head) |
| bundle-budget | success | required |
| e2e-smoke | success | required |
| wallclock-brand | success | required (typecheck job; docs-only gate skipped the compile, F12) |
| masking-check | success | required |
| bom-check | success | required |
| unit (Europe/London, full) | success | required |
| phone-qa, build-smoke | success | conditional (present, OK) |
| unit (America/New_York, tz-sensitive), unit (Australia/Sydney, tz-sensitive) | success | |
| contract-check, live-db-gate, dancer-area-isolation, notification-check | success | |
| real-data-verified x2, phone-qa-section x2, decide x2, open-pr, no-preview-reason x4 | success | |
| enable (Dependabot lane), doc-weight, lighthouse, seo-preview, og-preview, og-check, synthetic, synthetic-preview, seo-check | skipped | |
| types-drift | absent | conditional (not demanded) |

`mergeable_state: clean`; PR is open, not draft, author `kiki-claude-bot`.

## Local CI steps run on the head (fresh worktree)

| Step | Result |
|---|---|
| `npx vitest run tests/automation tests/autopilot tests/automergeClassify tests/realDataVerified` | 20 files, 1215 tests, exit 0 |
| `npm run typecheck` | exit 2, 109 errors; identical 109 on `origin/main` (F12) |
| `npm run lint` | exit 0, 34/34 links |
| `check:script-conventions` + `:self-test` | 0 / 0 |
| `node scripts/lint-workflow-masking.mjs`, `lint-workflow-notification.mjs` | 0 / 0 |
| BOM scan of `.github/workflows/*.yml` | none |
| `check:workflow-artifact-policy` + `:self-test` | 0 / 0 |
| `check:automation-workflow-allowlist:self-test` / `--local` | 0 / 2 (cannot run detached; see above) |
| `check:mojibake`, `bin/check-integrity.sh` | 0 / 0 (3314 files, 0 issues) |
| every new `check:*` and `:self-test` | all 0 (counts above) |

## Verified / Not verified

Verified: everything in the tables above, on a fresh clone of `3194f6d` with its own `npm ci`; the mutant table; the real-shape probe over 50 `origin/main` merges; the per-job CI state at the head via the GitHub check-runs API; the typecheck comparison against `origin/main` in a second worktree.

Not verified: live behaviour of any workflow (no run was triggered); the live ruleset; whether `BOT_PR_TOKEN`/`AUTOMERGE_TOKEN` resolve to `kiki-claude-bot`; real GitHub response shapes beyond fixtures and the git-rebuilt pull-file objects used in the probe; whether the Dependabot `GITHUB_TOKEN` can read PR files; drill A34; `check:automation-workflow-allowlist --local` on a named branch; `npm run test:unit` in full (the PR body reports 7 files failing identically on main, not re-run here); the browser (no UI path in the PR).
