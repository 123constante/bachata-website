# Brief: Bristol ambassador landing, continuation 1 (one failing unit test)
Brief-version: 2
Branch: claude/bristol-ambassador-landing
Lane: normal, Sonnet. CONTINUATION on the existing branch and PR #1455 (head 66995c78). Fix exactly the one red check below; change nothing else.
Serves: the shared join link landing page; it cannot merge while `unit (Europe/London, full)` is red.

## What main lacks
- CI `unit (Europe/London, full)` fails one test: src/modules/admin-organisers/join/__tests__/JoinGetPaidNext.test.tsx > "code step, next=get-paid, contributor seat > Done goes to /account/o/w..." with AssertionError: expected '/invite/cdcdcd...' to be '/invite/cdcdcd...' (the two strings differ after the visible part; read the full diff by running the test). That test passes on main, so something this branch changed alters the invite link or its returnTo/next query that the join code step builds. Run `npx vitest run src/modules/admin-organisers/join/__tests__/JoinGetPaidNext.test.tsx` on the branch and on origin/main, find the line this branch changed that moves the output, and fix the BRANCH code (not the test) unless the test expectation is provably stale; say which in the handover -- grep: JoinGetPaidNext fix

## Files
- the file(s) under src/ this branch changed that affect the invite link built by the admin join code step (find with git diff origin/main...HEAD --stat)
- docs/handover/bristol-ambassador-landing-cont1.md (new)

Push once at the end; last commit subject ends with the worker-done marker. Handover states head SHA, the exact cause and the per-job CI table.
