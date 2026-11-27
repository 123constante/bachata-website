# BRIEF: review-1370-r1 (Website; independent REVIEW of PR #1370; Opus; careful lane; read-only on the PR branch)

Brief-version: 2
Review of 123constante/bachata-website PR #1370, branch `claude/foundations-web`, head `3194f6d` (slice 2 web half, "foundations": money set + isMoney A16, Parts 1-6 guards). You do NOT edit that branch. You write ONE review file and push it on your own branch `claude/review-1370-r1`. You never approve or merge. Brief of the build: branch `brief/foundations-web`, file `docs/briefs/foundations-web.md` (read Part 2 and section 8 first).

## What main lacks
- A recorded independent review verdict for PR #1370 at head 3194f6d, with mutants run -- grep: review-1370 in docs/review (absent on main)

## What to do (in order)
1. Clone fresh with `npm ci` in YOUR OWN directory. Do NOT create node_modules junctions or symlinks (a junction cleanup once emptied a real node_modules).
2. Run the PR's own tests and every new check with its --self-test; record exit codes.
3. Mutants (>= 40, record each as killed/survived): is-money.mjs and `.github/automation/money-set.json` (drop each key/glob/regex, flip fail-closed returns to false, drop truncated-patch check, case handling, boundary characters), each new guard script in Parts 1-6 (`automation-arming.mjs`, `automation-money-check.mjs`, `automation-pause.mjs`, `check-workflow-log-secrets.mjs`, `write-drill-record.mjs`).
4. Check wiring: every new check is in `run-lint-chain.mjs`, `package.json`, `scripts/prove-entry-point-dispatch.mjs` (all entry points proven) and CI where the brief says; `scripts/pre-ship.mjs` change is only what the brief allows; no workflow permission widening; no secrets; protected calendar files untouched; diff scope vs the brief's Files list (flag anything outside it).
5. Probe isMoney boundaries on real shapes: `Ticket_Orders` / `TICKET_ORDERS`, hyphenated `ticket-orders`, `price_<short test id>`, patch lines starting `+++`/`---`, renamed files (previous_filename), huge diffs (truncated patch), binary files.

## Findings already raised by a partial first read (website-18, NOT executed; verify or refute each)
- Money-set scope is narrow: keys lack pence, amount, price_pence, booking_fee, refund, payout, currency, payment_intent; content matching covers only BOOKING_FEE_PENCE, STRIPE_* and a `price_<alnum>` regex; tables/functions/flags only fire when a diff mentions the exact names. A path-vs-content probe on src|app|supabase/functions found 88 money-ish files, 31 not covered, mostly display-only; check `src/integrations/supabase/eventRpcs.ts` (currency) and `src/modules/organiser/p3/screens/PriceCard.tsx` for any route into checkout/fee maths. Decide: gap or intended per the brief's seed list.
- Name matching is case-sensitive; `-` and `.` count as boundaries; the price_ regex needs 14+ alphanumerics incl. a digit; +++/--- lines counted as changed lines.
- Scope: the PR adds scripts beyond the first Files list; confirm each is explained by Parts 3-6.
- Not verified by the first reader: pre-ship.mjs, prove-entry-point-dispatch.mjs, realDataVerified.test.ts, automationPause.test.ts, autopilotWorkflow.test.ts changes.

## Output
`docs/review/review-1370-r1.md`: verdict PASS / PASS-with-fixes / BLOCK; numbered findings (severity, file:line, how reproduced); mutant table (id, what changed, killed/survived, which test); per-job CI table for the PR head; Verified / Not verified. End your final commit subject with the done marker for your ticket.

## Files
- `docs/review/review-1370-r1.md`
