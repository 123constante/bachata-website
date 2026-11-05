# Handover: foundations-web (Website, slice 2 of full automation)

Branch `claude/foundations-web`, off origin/main `0b8762c` (slice 1, PR #1361,
present: `scripts/lib/automation-pause.mjs` exists). HARD-TIER guard-class
change: needs the OWNER's Approve at head. Nothing ships armed: `arming.json`
mirrors today's effective state and `audit_escalation` is `false`.

Operator doc: `docs/automation-foundations.md`. Pointer line added to
`docs/automerge.md`.

Note for the orchestrator: this handover and the operator doc contain the word
`tickets`, which is a whole-word money-set hit (see "Money set" below), so this
PR is money as well as guard. It is owner-merged either way.

---

## Built, per part

### PART 1 -- required jobs (A17, A17b)
- `.github/automation/required-jobs.json`: `pr_head` = the 7 ruleset contexts;
  `conditional` = `phone-qa`, `build-smoke`, `types-drift`;
  `post_merge_audits` = `Owner approval audit`.
- `scripts/lib/required-jobs.mjs` (`parseRequiredJobs`, `checkRequiredJobs`).
- `mergeVerdict` refuses on `facts.requiredJobs` (absent = refuse);
  `autopilot-step.mjs` `mergePr` re-reads check-runs at the pinned head AFTER the
  pause re-read and immediately before the PUT.
- `scripts/check-required-jobs.mjs` (A17b, matrix expansion) and
  `scripts/check-ruleset-vs-required-jobs.mjs` (`compareRuleset`, fixture
  `tests/fixtures/ruleset-main-checks.json`).
- Extra files for repo rules: `scripts/pre-ship.mjs` (CHECKS mirrors LINKS; stale
  band count corrected), `scripts/prove-entry-point-dispatch.mjs` (TARGETS).

### PART 2 -- money set and isMoney (A16)
- `.github/automation/money-set.json`, `scripts/lib/is-money.mjs`,
  `scripts/automation-money-check.mjs` (Dependabot lane CLI).
- Wired: lane (`mergeVerdict` fact `money`, files API at the pinned head, fail
  closed), `automerge-classify.mjs` (`moneyCheck`), `dependabot-automerge.yml`
  (step after `Decide`; Enable needs `money == 'false'`).

### PART 3 -- arming file (A30)
- `.github/automation/arming.json`, `scripts/lib/arming.mjs`,
  `scripts/automation-arming.mjs`.
- `autopilot.yml` new `arming` job (outputs + drift notices);
  `bot-automerge.yml` / `dependabot-automerge.yml` gate every later step on the
  reader output; `autopilot-step.mjs` merge mode comes from the arming value.
  `vars.*` survive only as `ARMING_VAR_<NAME>` drift input.

### PART 4 -- secrets register, identity, expiry, log grep (A36, A34 static, A22, 6.2(1))
- `.github/automation/secrets-register.json` (26 entries),
  `scripts/check-secrets-register.mjs` (rules a-f),
  `scripts/check-identity-register.mjs` (+ `--offline` for the lint chain),
  `isOwnerAction(login, register)`,
  `.github/workflows/automation-identity-check.yml` (NEW),
  `.github/workflows/automation-token-expiry.yml` (NEW),
  `scripts/check-workflow-log-secrets.mjs` (matcher + `--logs` runner, NOT
  scheduled). Inert-text (A23) tests for both new workflows.

### PART 5 -- guard paths (A18)
- `.github/automation/guard-paths.json`, `scripts/lib/guard-paths.mjs`
  (imports `GOVERNANCE` + `isAgentInstructionPath`, no fork).
- Wired: lane (`mergeVerdict` 3a, additive), `automerge-classify.mjs`
  (`guardCheck` over `filename` + `previous_filename`), Dependabot lane
  (`automation-money-check.mjs` writes `guard=`/`guard_reason=`; read failure =
  guard=true).
- Layer 2: `decideAudit({ escalation })`; off = byte-identical verdicts (tested);
  on = guard paths hard + `escalateRed` (pause label + ONE notice
  `audit-red:<sha>`).
- Commit `4b2f6f1` added the Part 4/6 scripts and `component-sha.mjs` to the
  guard list.

### PART 6 -- components and drill records (A32)
- `.github/automation/components.json`, `scripts/lib/component-sha.mjs`,
  `scripts/check-drill-records.mjs` (`--components-only` in the lint chain,
  `--require-all` for slice 15), `scripts/write-drill-record.mjs`.

### PART 7 -- docs (this commit)
- `docs/automation-foundations.md`, pointer in `docs/automerge.md`, this file.

---

## Red-then-green record (from the worker notes)

| Part | RED | GREEN |
|---|---|---|
| 1 | `tests/automationFoundations.test.ts`: 1 file failed, "Failed to load url ../scripts/lib/required-jobs.mjs" (nothing collected). Existing harnesses after injection: 13 files / 743 tests passed. | 70/70; wider set 17 files / 987 tests passed. |
| 2 | `tests/automationMoney.test.ts`: 1 file failed, "Failed to load url ../scripts/lib/is-money.mjs". Every existing test passed. | 68/68; wider set 19 files / 1127 passed. |
| 3 | 3 files failed, 7 tests failed / 874 passed: `tests/automationArming.test.ts` cannot load `arming.mjs`; the 7 = three EXISTING assertions rewritten to the arming contract. | `automationArming` 45/45; wider set 20 files / 1172 passed. One harness fix after red (lane fake needed green check-runs), no assertion changed. |
| 4 | `tests/automationRegister.test.ts`: cannot import `check-secrets-register.mjs`. | 73/73; +1 `--offline` test added after green (NOT red-first): 74. |
| 5 | `tests/automationGuardPaths.test.ts`: "Failed to load url ../scripts/lib/guard-paths.mjs"; 16 files / 926 tests passed. | 106/106; wider set 22 files / 1285 passed. |
| 6 | `tests/automationDrillRecords.test.ts`: cannot import `component-sha.mjs`. | 33/33. One FIXTURE fix (strict parser needs all ten components), no assertion changed. |

Mutants proven red: lane step without the money fact merges case 2; `classify()`
without `moneyCheck` qualifies case 2; money CLI without `isMoney` writes
money=false; Enable step without `money == 'false'` fails the structure test;
`mergePr` without the required-jobs re-read merges the A17 head; a reader that
reads the variable instead of the file (A30); a lane copy with the
`isGuardPath` call string-removed is still caught by `decideAudit` (A18).

### Existing assertions REWRITTEN (Part 3; orchestrator to confirm)
The brief mandates moving readers off `vars.*`, and three existing assertions
encoded the old variable contract. They were rewritten to the arming contract
with the same strictness (exact strings):
1. `tests/autopilotWorkflow.test.ts`: `AUTOPILOT_MERGE_MODE` env ->
   `ARMING_VAR_AUTOPILOT_MERGE_MODE`, and `AUTOPILOT_MERGE_MODE` must be undefined.
2. `tests/autopilotWorkflow.test.ts`: `DRY_RUN` exact string now uses
   `needs.arming.outputs.autopilot_live`; `announce-failure` needs
   `[arming, autopilot]` and its `if` reads `needs.arming`.
3. `tests/automergeClassify.test.ts`: the `vars` gate string -> the
   `arming --gate` step, and the old `vars` string must be ABSENT.

Harness injection is through ONE shared helper (`tests/autopilotTable.ts`
`FOUNDATIONS_OK`: `opts.foundations.arming`, `armingOpts`, `classify.moneyCheck`,
`classify.guardCheck`). `guardCheck = () => []` is needed because the existing
"docs-only merges" row uses `docs/automerge.md`, which is GOVERNANCE prose and
now a guard path.

---

## required-jobs.json: every job considered

`pr_head` is exactly the 7 ruleset contexts (fact 1). Adding anything else
there would make `check-ruleset-vs-required-jobs` red until the owner edits the
ruleset (contract 9.3 wants the lists equal).

Included:
- `integrity` (architecture-guard.yml) -- pr_head, ruleset context.
- `bundle-budget` (perf-budget.yml) -- pr_head, ruleset context.
- `e2e-smoke` (e2e-smoke.yml) -- pr_head, ruleset context.
- `wallclock-brand` (typecheck.yml) -- pr_head, ruleset context.
- `masking-check`, `bom-check` (workflow-lint.yml) -- pr_head, ruleset contexts.
- `unit (Europe/London, full)` (unit-tests.yml matrix leg) -- pr_head, ruleset
  context, resolved by matrix expansion.
- `phone-qa`, `build-smoke` (phone-qa.yml) -- conditional: workflow-level
  `paths:` filter.
- `types-drift` (types-drift.yml) -- conditional: `paths:` filter (types.ts).
- `Owner approval audit` (owner-approval.yml) -- post_merge_audits (fact 2).

Excluded, and why:
- `unit (America/New_York, tz-sensitive)`, `unit (Australia/Sydney, tz-sensitive)`
  -- always present but not ruleset contexts; adding = ruleset diff. Owner decision.
- `dancer-area-isolation` (unit-tests.yml) -- always present, not a ruleset
  context. Owner decision.
- `notification-check` (workflow-lint.yml) -- always present, not a ruleset
  context. Owner decision.
- `live-db-gate`, `contract-check` (db-contract-check.yml) -- `contract-check` is
  a live-prod-DB check that can be red from prod state, not from the PR (the
  lane's red-on-main rule handles it); not in the ruleset.
- `phone-qa-section`, `real-data-verified` -- PR-body checks re-run on `edited`;
  not ruleset contexts. Owner decision whether to require.
- `no-preview-reason`, `og-preview`, `seo-preview`, `synthetic-preview`,
  `lighthouse`, `doc-weight`, `og-check`, `seo-check`, `synthetic` --
  preview/branch-conditional or non-PR jobs (`claude/*` gets no preview);
  informational.
- `decide` (bot-automerge.yml), `enable` (dependabot-automerge.yml) -- the
  automation's own jobs, not gates.

## Wrong premise: owner-approval (fact 2)

Contract section 9 items 3-4 assume `owner-approval` is a check-run at the PR
head and must be in the ruleset's required list. It is not:
`.github/workflows/owner-approval.yml` ("Owner approval audit") triggers on
`push` to main and `workflow_dispatch` only and calls itself "AUDIT ALARM, not
a gate". No check-run of that name ever exists at a PR head, so requiring it at
head would block every merge. It is listed under `post_merge_audits`
(existence-checked by A17b, never re-read at head). Orchestrator: the contract
text needs correcting, or a real PR-head approval check needs building (that
would be a new slice).

## bot-automerge / Dependabot and required jobs

They arm `gh pr merge --auto`; GitHub merges later. No code re-read is
possible. The ruleset is their gate; jobs in `required-jobs.json` but not in
the ruleset are NOT enforced on them; the lane enforces the full list. Today
`pr_head` equals the ruleset contexts, so there is no gap, but the owner must
keep them equal.

---

## Money set

Seeded from fact 6. Derived entries beyond the seed:
- paths: `.github/automation/money-set.json` (A16 case 7),
  `src/modules/organiser/p3/door/**` (ticket door check-in,
  `VITE_ENABLE_TICKET_DOOR_CODE`), `src/**/*ticket*` and `app/**/*ticket*`
  (catch-all outside the seed dirs), the five admin edge-function dirs under
  `supabase/functions/` (names a diff can carry), `**/*stripe*`, `**/*payout*`,
  `**/*refund*`.
- keys: `STRIPE_CHECKOUT_PREFIX`, `STRIPE_MODE` (GetPaid.tsx),
  `BOOKING_FEE_PENCE` (src/lib/ticketBookingFee.ts), the price-id regex
  `^price_(?=[A-Za-z0-9]*[0-9])[A-Za-z0-9]{14,}$` (hits a real price id; does not
  hit `price_currency`, `price_display`, `price_12`).
- flags: `VITE_ENABLE_TICKET_DOOR_CODE`.
- env: `STRIPE_WEBHOOK_SECRET_THIN`, `VITE_TICKET_PREVIEW_ORIGIN`.
- Deliberately NOT included: `src/modules/organiser/p3/data/prices.ts`,
  `PricesScreen.tsx`, `PriceCard.tsx` (door-price display, no payment path),
  `STRIPE_COPY` (UI copy; its file is path-covered), admin `FrontDoor*`.

**Over-match concern (`tickets`).** The table name `tickets` is a whole-word
hit, so ANY changed line containing the word "tickets" -- e.g. a docs line --
counts as money, and the PR becomes owner-merged. Kept on purpose (a false
"money" costs one owner merge). The orchestrator may prefer to drop it or to
scope it to SQL-ish contexts.

### A16 case coverage

Cases 1, 2, 5, 6, 7 are proven END TO END on the three auto paths that exist
(lane, bot-automerge classifier, Dependabot CLI), each as a bot PR labelled
`automerge-ok` + `review-passed`:

| case | lane | bot-automerge | dependabot |
|---|---|---|---|
| 1 price id in `docs/config/plans.json` | refused `money set: price_1NqLzX2eZvKYlo2C8hKk3sTq` | refused | refused |
| 2 docs mention `my_tickets_v1` | refused `money set: my_tickets_v1` | refused | refused |
| 5 `supabase/functions/stripe-webhook/index.ts` | refused `money set: supabase/functions/stripe-webhook/**` | refused | refused |
| 6 content hit in a path-classified file | refused | refused | refused |
| 7 adds a name to `money-set.json` | refused `money set: .github/automation/money-set.json` (+ guard path) | refused (+ guard) | refused (+ guard) |

Case 6 note: Website has NO soft-app class (`SOFT_APP_ALLOW` is empty), so the
content-overrides-path-class proof uses the docs class.

Cases 3, 4, 8 are FUNCTION-LEVEL only (`isMoney` with fixtures), because this
repo has no migrations, no queue, no approver, no canary-revert and no flag-off
path:
- 3 migration renames a payments column -> `money set: ticket_orders`;
- 4 migration adds a set table -> `money set: ticket_promo_redemptions`;
- 8 canary revert of a money commit (revert-diff fixture) ->
  `money set: src/modules/tickets/**`.

---

## Secrets register

### Grandfathered readers (OWNER REVIEW; not fixed; dated 2026-11-04)

Reader beyond the contract minimum:
- `BOT_PR_TOKEN` read by `autopilot.yml` (passed as `BOT_TOKEN` so label/update
  writes fire CI) and `bot-automerge.yml` (arms `gh pr merge --auto` with it; the
  contract names `AUTOMERGE_TOKEN` for bot-automerge). Contract: `bot-pr.yml` only.
- `BOT_PR_TOKEN` in `bot-pr.yml` on `push` to `claude/**` and `ccr-*` -- the
  contract's own design, BUT a push runs the pushed branch's definition; the
  cloud proxy pushes with the owner's (workflow-scoped) credential, so a branch
  could edit `bot-pr.yml` and read the token. A34 live half not run.

Untrusted-trigger readers (rule c):
- `pull_request`: `db-contract-check`, `unit-tests` (`VITE_SUPABASE_*`,
  publishable); `og-image-check`, `seo-check` (`CI_BYPASS_HEADER`,
  `VERCEL_AUTOMATION_BYPASS_SECRET`); `perf-budget`, `synthetic-ssr-monitor`
  (`VERCEL_AUTOMATION_BYPASS_SECRET`); `synthetic-ssr-monitor`
  (`SLACK_WEBHOOK_URL`); `types-drift` (`SUPABASE_ACCESS_TOKEN` -- HIGH VALUE:
  the Supabase management token on a same-repo PR).
- `push` with `paths:` only (= any branch, the branch's own definition):
  `ci-budget-guard` (`CI_BUDGET_GITHUB_TOKEN`), `deployment-storage-check` and
  `firewall-drift-check` (`VERCEL_TOKEN`), `gsc-health-check` (GSC key).
- `push: [main, master]` (master is not main): `db-contract-check`,
  `unit-tests`, `perf-budget`, `io-health-guard` (`IO_HEALTH_SECRET`).
- Not checked (outside the brief's trigger list): `deployment_status`
  workflows (`og-image-check`, `seo-check`, `prod-smoke`,
  `post-merge-prod-alarm`, `cloudflare-purge`) run the definition at the
  deployment's sha, which for a preview is a PR branch.

Self-hosted runners: 0 (measured, 61 jobs).

### Unrecorded logins (6.1a risk, owner review)
`CI_BUDGET_GITHUB_TOKEN` (account billing read: possibly the owner's login),
`TYPES_BOT_TOKEN`, `ADMIN_READ_TOKEN`. Their `acts_as` is `to record`.

### Identity check: likely RED on first live run
6.1a says `BOT_PR_TOKEN` and `AUTOMERGE_TOKEN` both act as `kiki-claude-bot`
(inferred), and also that author vs merge-token must resolve to different
logins. The register keeps all three pairs in `separate_roles`, so the first
live run of `automation-identity-check.yml` (after merge, on the push that
touches the register) will be RED with "roles author (BOT_PR_TOKEN) and merge
(AUTOMERGE_TOKEN) resolve to one login kiki-claude-bot" if the inference is
right. Owner decides: a separate merge-bot account, or drop `["author","merge"]`
from `separate_roles`.

---

## Design choices to know about

- `setPauseLabel` lives in `scripts/automation-pause.mjs` (not the lib, as the
  brief words it): the slice 1 tripwire (`tests/automationPauseGuard.test.ts`)
  allows only that file to ADD the pause label. One-function addition, guard
  path. `owner-approval-audit.mjs` imports it.
- Drift notices are posted ONLY from `autopilot.yml`'s `arming` job (it already
  holds `issues: write`). `bot-automerge` / Dependabot have `issues: read` and
  log drift (`::notice::` + summary) without posting. No permission widened.
- With arming off, `bot-automerge` and `dependabot-automerge` now RUN (checkout
  of main + setup-node + reader, green, `::notice::`) where before the job was
  skipped; nothing else runs.
- `bot-automerge` Disable step `if` is `always() && enabled && !(<Enable if>)`
  (redundant `enabled`) because `tests/automationPauseWorkflows.test.ts` pins
  Disable = !(Enable).
- `isAgentInstructionPath` over-blocks by design (`docs/agents-overview.md`,
  `docs/claude-code-notes.md`); with GOVERNANCE docs these are the "a docs path
  can be a guard path" exception. A plain docs PR (`docs/handover/**`,
  `docs/design/**`) still qualifies (tested).
- `owner-approval.yml` unchanged (not in the Files list; key ships off).
- `components.json` paths are LITERAL (git ls-tree does not expand globs;
  `:(glob)` refused), deviating from the contract's "path globs" wording.
- `write-drill-record.mjs` records an extra `head_sha` field (the checker needs
  it to match the run's head sha; the contract's field list does not name it).
- `approver` has no repo variable here, so it has no drift input.
- `scripts/check-workflow-log-secrets.mjs` is not in `guard-paths.json`; add it
  if the owner wants it guarded.

---

## OPEN (owner-gated)

- Scheduling `check-ruleset-vs-required-jobs` (needs administration read;
  `GITHUB_TOKEN` cannot). Slice 2b.
- Ruleset additions for the excluded always-present jobs (owner decision; both
  lists change together).
- Slice 2b: PAUSE token + baby-step sheet, M1 variables-scope check, the
  variable half of the pause switch (`AUTOMATION_PAUSED`,
  `automation-pause.yml`, `automation-resume.yml`, A33), deleting the old
  arming variables, creating the pinned issues `DRILL RECORDS` and
  `AUTOMATION PAUSE SWITCH`, Website CODEOWNERS (plan support not verified).
- `separate_roles` vs both PATs as `kiki-claude-bot` (above).
- Adding the two new workflows (and the three changed ones) to
  `scripts/data/automation-workflow-allowlist.json` is the owner's call (list
  ships empty; see the Local CI record).

## Left (not built)

- Revert PR by `BOT_PR_TOKEN` on an escalated audit RED: DESIGN ONLY
  (`docs/automation-foundations.md`, "audit_escalation: next step").
- A22 scheduled log runner (matcher + `--logs` runner built and tested).
- Live A34 drill (needs the live token).
- Drill workflows named in `components.json` (later slices); today
  `check-drill-records` default mode would list them missing.

## Not verified

Live behaviour of any workflow; the live ruleset and its required list; whether
`BOT_PR_TOKEN` / `AUTOMERGE_TOKEN` resolve to `kiki-claude-bot`; real GitHub
response shapes beyond fixtures; whether the Dependabot `github.token` can read
PR files (a 403 fails closed); drill A34.

---

## Local CI record

Run on the final tree (HEAD `4b2f6f1` + these docs), 2026-11-05. Baseline =
origin/main `0b8762c` in a separate worktree with the same node_modules.

| Step | Result |
|---|---|
| `npx vitest run tests/automation tests/autopilot tests/automergeClassify` | PASS: 19 files, 1139 tests |
| `npm run test:unit` (first run, stale node_modules) | 7 files / 15 tests failed, 774 files / 23770 tests passed, 31 skipped. The SAME 7 files / 15 tests fail on origin/main. |
| after `npm ci` (node_modules lacked `qrcode-generator`) | the 3 `src/modules/tickets/__tests__` files PASS; still failing, identical on main: `tests/eventViewCompat.contract`, `tests/occurrenceProgram.contract`, `tests/publicEventPageLineup.contract` (live DB, no key here), `tests/integrityCouldNotRun` (5 tests, sandbox). None attributable to this branch. |
| snapshot files rewritten by the run | 13 `__snapshots__` files, restored with `git checkout` (not committed) |
| `npm run typecheck` | 110 `error TS` before `npm ci`, 109 after; origin/main identical (110 / 109). None in a touched file. |
| `npm run lint` | PASS, 34 of 34 links green (eslint tail informational WARN) |
| `check:required-jobs` / `:self-test` | PASS, 11 names, 0 phantom / PASS 10 cases |
| `check:ruleset-vs-required-jobs:self-test`; CLI on `tests/fixtures/ruleset-main-checks.json` | PASS 9 cases; 7 contexts, 0 differences |
| `check:secrets-register` / `:self-test` | PASS (38 workflows, 61 jobs, 21 secrets read, 26 entries, 0 self-hosted) / PASS 18 |
| `check:identity-register` (offline) / `:self-test` | PASS (26 entries, 25 acts_as still to record) / PASS 11 |
| `check:workflow-log-secrets` / `:self-test` | PASS (38 sources) / PASS 11 |
| `check:drill-records` / `:self-test`; `drill-record:self-test` | PASS (2 built, 8 not built) / PASS 10; PASS 6 |
| `check:script-conventions` / `:self-test` | PASS (84 known, none new) / PASS 86 |
| `node scripts/lint-workflow-masking.mjs` | PASS, 38 files |
| `node scripts/lint-workflow-notification.mjs` | PASS, 38 files |
| BOM check (workflow-lint.yml logic) over `.github/workflows/*` | PASS, no BOM |
| `check:workflow-artifact-policy` / `:self-test` | PASS (38 files, 61 jobs, 395 steps, 7 uploads) / PASS 393 |
| `check:automation-workflow-allowlist:self-test` | PASS 20 |
| `check:automation-workflow-allowlist` | EXPECTED FAIL (exit 1), list ships empty and only the owner edits it; output below |
| `bin/check-integrity.sh` | PASS, 3312 files, 0 issues |
| `check:mojibake` (+ `:self-test`, + the workflow `git grep`) | PASS, 5029 files / PASS 11 / no hit |
| integrity job (architecture-guard.yml) other steps: `check:legacy-tables`, `check:legacy-program-rpcs`, `check:onboarding-write-doors` (+self-test), `lint:architecture`, `AUDIT_STRICT=1 check:images`, `check:image-widths` (+self-test), `check:plan-hygiene:self-test`, `check:p3-specs-not-skipped` (+self-test), `prove:entry-point` (+self-test, 68 entry points), `check:going-legacy-rpcs` (+self-test) | all PASS |
| typecheck.yml: `check:rpc-typing`, `check:wallclock-brand` | PASS |
| unit-tests.yml: `check:dancer-area-isolation` (+self-test) | PASS |
| perf-budget.yml (after `npm ci`): bundle-budget / first-load-requests / chunk-cycles canaries, `build:ship`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | all PASS |
| `node scripts/pre-ship.mjs` | Ran offline, no review stamp needed. FAILED (rc 1) on the first run: `test:unit` (above), `build:ship` + the three build-dependent perf checks (missing `qrcode-generator` before `npm ci`; all PASS after it), and `typecheck (count ratchet) -- 110 errors vs a baseline of 106`: origin/main has the same count, so the ratchet baseline is stale on main, not raised here. 37 checks PASS; eslint and test:e2e SKIPPED (no lintable / app files in the diff). |
| e2e-smoke | Not run (no app code in the diff; pre-ship skips it on the same rule) |

`check:automation-workflow-allowlist` exact output:

    automation-workflow-allowlist: FAIL -- loop branch claude/foundations-web changes workflow file(s) not on scripts/data/automation-workflow-allowlist.json:
      - .github/workflows/automation-identity-check.yml
      - .github/workflows/automation-token-expiry.yml
      - .github/workflows/autopilot.yml
      - .github/workflows/bot-automerge.yml
      - .github/workflows/dependabot-automerge.yml
    An automated change may only edit a listed workflow. Only the owner adds a name (owner Approve); see docs/ci-guard-notes.md#automation-workflow-allow-list.

No behaviour code was changed in Part 7.

## Review round (stopping rule: one round, guard-class)

`/code-review low` covered only 2 KB of the 250 KB diff, so an independent agent reviewed `scripts/`, `.github/`, `package.json` in full.
- CONFIRMED + FIXED (32a354d): the lane's guard-path check saw only the NEW filename; a bot PR renaming `CLAUDE.md` / `.claude/hooks/*` / `scripts/lib/guard-paths.mjs` to `docs/moved.md` would be merged. `run()` now passes `previousFiles`; `mergeVerdict` checks them. 3 run-level rename tests red on unfixed code, green after.
- Checked, no bug: arming output names / `'true'` comparisons / step `if:`s match main with the shipped `arming.json`; fail-closed in isMoney, required-jobs, arming, guard paths; pagination + head-sha pinning; no PR text in `run:`; every `node scripts/...` invocation in workflows exists.
- OPEN for the owner: (1) identity check likely red on first run (author/merge both inferred `kiki-claude-bot` vs the separate-roles rule; the contract contradicts itself); (2) whole-word `tickets` in the money set refuses any docs/tests bot PR whose diff says "tickets" (by design under 8.3 case 2, but it is a new refusal on docs PRs; drop the entry if unwanted); (3) pre-existing on main: the lane classifies a renamed file by its new name only (`src/x.ts` -> `docs/x.md` = docs); guard/money checks now catch some but not all of these.
- Final suite after the fix: `npx vitest run tests/automation tests/autopilot tests/automergeClassify` 1143/1143; `npm run lint` 34/34 links.

## Fix round fix-1370-r1 (review-1370-r1 findings; brief/fix-1370-r1)

Review: `docs/review/review-1370-r1.md` on `claude/review-1370-r1` (verdict PASS-with-fixes at `3194f6d`).
Every finding in scope got a test first; behaviour fixes were RED on the unfixed code (19 tests in 3
files), test-gap findings were proven by re-running the review's surviving mutants.

| Finding | What changed | Test |
|---|---|---|
| F1 | none (test gap) | `tests/automationMoney.test.ts` row: `file('docs/a.md', [], ['call my_tickets_v1'])` (live patch shape, removed lines only) -> `money set: my_tickets_v1` |
| F3 | `is-money.mjs`: names are case-INsensitive for `statements` only (Postgres folds unquoted identifiers); paths and lines stay case-sensitive | rows: `ALTER TABLE Ticket_Orders` hit, `TICKET_PROMO_X` hit, `Ticket_Orders_x` not; `TICKET_ORDERS` line and `docs/TICKET_ORDERS.md` path still NOT hits |
| F4 | `money-set.json`: `src/**/*ticket*/**`, `**/*stripe*/**`, `**/*payout*/**`, `**/*refund*/**` | one row each (`src/Stripe/Client.ts`, `lib/payouts/run.ts`, `app/refunds/run.ts`, `src/modules/ticketing/List.tsx`) |
| F5 | none (test gap) | row: `src/modules/organiser/p3/door/scan/Camera.tsx` -> `money set: src/modules/organiser/p3/door/**` |
| F6 | `is-money.mjs`: `--- `/`+++ ` lines BEFORE the first `@@` are headers, not changed lines; a removed `---` rule inside a hunk still counts | full unified diff row (fails closed as truncated, 1 of 3) + in-hunk `----` row |
| F7 | `guard-paths.json` + `scripts/lib/entry-point.mjs` | `tests/automationGuardPaths.test.ts` YES list |
| F9 | `automation-money-check.mjs` requires `HEAD_SHA` (40 hex; else exit 2, money=true, no API call) and refuses `money set: unreadable (PR head moved: event <12>, now <12>)`; `dependabot-automerge.yml` money step passes `HEAD_SHA: ${{ github.event.pull_request.head.sha }}` (env only, never in `run:`) | `tests/automationMoneyCli.test.ts` (moved head, same head, missing / bad HEAD_SHA) + workflow structure rule and its mutant in `tests/automationMoney.test.ts` |
| F13 | `automation-money-check.mjs` exports `moneyOutput(v)` (the one money-line builder `emit` uses) | `tests/automationMoneyCli.test.ts`: 100 then 50 with `changed_files: 150` (both pages asked, money=false), a hit on page 2, 100 then HTTP 502, 151 said / 150 read -> `money set: unreadable (file list incomplete (150 read, PR says 151))`, `moneyOutput` table |
| F14 | none (test gap) | `tests/automationDrillRecords.test.ts`: table of 10 bad `buildRecord` inputs; a PR titled `DRILL RECORDS` is skipped and the real issue (#2) gets the post |
| F15 | none (test gap) | `paths` and `keys` of the live `money-set.json` pinned with `toEqual` |
| F2, F8 | docs only: `docs/automation-foundations.md` (Money set base rate; Arming: the pause label disarms an already-armed PR, `arming.json` does not) | n/a |
| F10, F11, F12 | skipped (informational, per brief) | n/a |

**F2, `tickets` base rate (owner's call, NOT narrowed).** Reviewer: 17 of the last 50 merges are money,
`tickets` the first or only hit in 15; 4 of 8 docs-only merges refused. My re-run (2026-11-05, the
then-latest 50 first-parent merges on main, pull-file objects rebuilt from `git show -M`): 18 money, 3 of
7 docs-only refused, and this round's set changes NO verdict or reason against the PR-head set. Narrowing
`tickets` (e.g. `public.tickets`, `from('tickets')`) is the owner's later guard change.

**F8.** The pause label on the pinned `AUTOMATION PAUSE SWITCH` issue is the disarming control for an
already-armed PR; turning a gate off in `arming.json` skips the Disable steps too.

**F7, owner judgement (NOT done).** `scripts/run-lint-chain.mjs`, `scripts/pre-ship.mjs` and the
`package.json` script entries are still not guard paths; a bot PR could remove a chain link. Left for
the owner, per brief.

### Mutants re-run (one at a time, restored after; suite `npx vitest run tests/automation tests/autopilot tests/automergeClassify tests/realDataVerified`)

| id | mutant | result | killed by |
|---|---|---|---|
| IM09 | removed lines not scanned in a patch | KILLED | `a REMOVED line in a GitHub patch (live shape)` |
| IM15 | bare `**` matches one segment | KILLED | `a two-level path under a ** glob` |
| MS02 | drop `**/*stripe*` | KILLED | `the live paths and keys lists are pinned` |
| MS09 | drop `BOOKING_FEE_PENCE` | KILLED | same |
| MC01 | `changed_files` count check dropped | KILLED | `a count that disagrees with changed_files` |
| MC02 | money line from a truthy test | KILLED | `moneyOutput` table (undefined / null) |
| MC05 | stop after page 1 | KILLED | `150 files over two pages` |
| WD02 | `pass` may be non-boolean | KILLED | `buildRecord refuses: pass is the STRING true` |
| WD03 | `component_sha` any hex length | KILLED | `buildRecord refuses: component_sha is 40 hex` |
| WD04 | pull requests count as the issue | KILLED | `a PULL REQUEST titled DRILL RECORDS is not the issue` |
| new F3 / F6 / F9 / F7 | each fix reverted alone | KILLED (each) | the rows above |
