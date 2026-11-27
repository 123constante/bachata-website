# Brief: red main unit pins, part B (open problem P45)


Size: 5 files, 80 lines
Main 89b8a1c0 unit tests are red in all 4 shards; every PR inherits the red. Part B covers three tests. Part A (another worker, branch claude/red-main-pins-a) covers catchallGate, catchallClientPaths and entryPointCoverage: do not touch those.

Rule for every item: first find the commit that changed the behaviour (`git log -S`). If that change was intended (a merged PR on purpose), update the pin/list/register and name the PR in the commit message. If the test caught a real bug, fix the code instead and say so in the PR body. Never delete or weaken a test.

1. `tests/automationRegister.test.ts` (5 cases): `(b) GSC_SERVICE_ACCOUNT_KEY: measured reader seo-recheck-2026-12-25.yml is not in readers_allowed`. A new workflow `.github/workflows/seo-recheck-2026-12-25.yml` reads that secret. Add it to readers_allowed for GSC_SERVICE_ACCOUNT_KEY in the automation register (find the register file from the test), with the same note style as the other readers. The owner allowed guard-file edits by Claude (AUTHORITY 2026-11-24).
2. `app/cloudflarePurge.test.ts` "static rule seo-landing lists exactly the routes that stamp it": the rule lists `/classes`, `/parties`, `/tonight` but those routes no longer stamp seo-landing. Find the PR that changed them (site structure work). If intended, drop the 3 from the static rule; if those pages should still stamp seo-landing, restore the stamp.
3. `tests/seoSoft404Matrix.test.ts` "real city london-gb" (+ different case, trailing slash): expected 200 with canonical `https://www.bachatacalendar.co.uk/` and Cache-Control `public, max-age=0, must-revalidate`; received status 500, no headers. Find out whether this is a test-fixture/mock drift or a real 500 on `/city/london-gb` (prod smoke is green on /city/london-gb, so likely fixture). Fix the right side.

Done = those 3 test files green locally (`npx vitest run tests/automationRegister.test.ts app/cloudflarePurge.test.ts tests/seoSoft404Matrix.test.ts`), no other test newly red. One PR. In the PR body, one line per item: pin update (which PR) or real bug fixed.
