# Brief: Website FIX-6b worker (checks only)

Branch `arc/event-truth-p1p3-fix6` (continue it; head 4198ffda; the first fix-6 worker stopped at its context gate before its checks).
Never use `gh api` in this repo: read with git. Open NO PR.
**Keep your session context under 35% (owner rule): read only what you must, never dump whole files or full logs (tail the last 40 lines),
commit and push the table after EACH group of steps, and stop cleanly before 30%. If you run out, push what you have and say which steps are left.**

Section 5 of `docs/handover/event-truth-p1p3-fix6.md` says NOT RUN. GitHub Actions is unavailable (billing): you run the steps.
1. Run every no-secret step of every `pull_request` workflow as fix-4's handover section 5 table (`docs/handover/event-truth-p1p3-fix4.md`):
   unit legs incl. the NY/Sydney 9-file legs, typecheck jobs, full `npm run test:e2e` with the workflow env, architecture-guard integrity
   steps (`chmod +x bin/*.sh` first, restore modes), perf-budget (self-tests, build, `check:bundle-budget`, `check:first-load-requests`),
   `npm run lint`, eslint on changed files, db-contract-check no-secret steps incl. `check-script-conventions.mjs` and
   `check-event-truth-v1.mjs --self-test`, then `npm run pre-ship`. Node 22.
2. Write each step's command and exit code into section 5. Env-only reds are named against the fix-4 baseline (10 live-DB `*.contract.test.ts`
   under the offline stub; e2e `dancer-home.spec.ts:105`). The expected red `check-event-truth-v1` live run must carry the "admin #780 ... applied first" sentence.
3. Change NO source or test unless a step shows a NEW red caused by `git diff origin/arc/event-truth-p1p3-fix4..HEAD`; if so, stop, push the table so far, report it.
4. Commit, push `arc/event-truth-p1p3-fix6` only, report the head SHA and the table.
