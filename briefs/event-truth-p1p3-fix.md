# Brief: FIX worker, Website event-truth P1+P3 (bundle ratchets, e2e, integration)

Branch `arc/event-truth-p1p3-fix`, created FROM `origin/arc/event-truth-p1p3-ui-b` (03fff9cf). First commit:
`git merge origin/arc/event-truth-p1p3-guard-b` (d956c90e; disjoint files, expect no conflict; both carry the
identical `src/lib/eventCategory.ts`, byte pin `a8d972e7`, never edit it). The orchestrator merges your branch
into the PR branch locally and opens the ONE Website PR; open NO PR. Never `gh api` in this repo (it is behind an
ask rule): read briefs with `git fetch origin arc/briefs-event-truth && git show origin/arc/briefs-event-truth:<path>`.

Read first: `docs/handover/event-truth-p1-ui.md` and `docs/handover/event-truth-p3-guard.md` (on the two
branches), then `briefs/event-truth-p1-ui.md` and `briefs/event-truth-p3-guard.md` on `arc/briefs-event-truth`.

## Fixes

1. **Bundle ratchets (OPEN from the UI handover, pre-ship RED).** `check:bundle-budget`: event route 380.7 KB
   vs 380 KB; `check:first-load-requests`: +2 requests on /parties, /classes, /faq and the three landing pages.
   Cause found so far: this tree builds a SECOND root chunk (`root-CNfoH7Y2` beside `root-DoWiNfNR`) that
   statically imports `accountRouting` and `authRouting`; main has one root chunk. Suspect: the new
   `src/lib/eventCategory.ts` imported from both `endedRun.ts` (event page) and `eventType.ts` (organiser) and
   now from the e2e fake / calendar paths, changing Rollup's shared-graph split. Find the real cause with
   `npm run build` + the manifest diff against a clean `origin/main` worktree. Fix without moving packages
   between the `vendor-ui*` lists (vite.config.ts explains why) and without raising either budget. Acceptable
   shapes: a manual chunk for the lib, or breaking the import edge that pulled the auth/account routers into the
   root graph. Prove: `npm run check:bundle-budget` and `npm run check:first-load-requests` green on your tree,
   and the same two numbers on `origin/main` for the record.
2. **e2e full list.** `npm run test:e2e` red on `tests/e2e/dancer-home.spec.ts` x2 under full-list load. Run that
   spec alone first; if green alone, run the full list once more with the workflow's env (e2e-smoke.yml) and
   record both; if red alone, bisect against bc47fff7 and fix the cause (this branch touches the organiser
   create flow, dancer-first gate round-trips are the known flake class).
3. **Merged-tree checks.** On the merged tree run EVERY step of every PR workflow in `.github/workflows`
   (unit-tests incl. timing + both timezones, typecheck.yml's two steps, e2e-smoke list, architecture-guard
   integrity job incl. `AUDIT_STRICT=1 check:images`, lint chain, `check-event-truth-v1 --self-test`,
   `check:script-conventions`, `prove:entry-point`, db-contract-check steps that need no secret) and
   `npm run pre-ship`. Record each with its exit code. The guard's live run against prod exits 2 until admin
   #780 applies (designed fail-closed; say so, do not weaken it).
4. **Handover** `docs/handover/event-truth-p1p3-fix.md`: cause of the second root chunk, before/after numbers,
   e2e results, the full check table, Verified / Not verified. Leave the calendar masterclass/social `it.todo`
   as is (ask-Ricky file).

Rules: no edits under `src/components/calendar/**` or `src/components/EventCalendar.tsx` (CLAUDE.md ask-first
list); HTML entities over raw Unicode; compact density; `scripts/safe-edit.py` / `safe-write.py` for source
files over 2 KB (the hook tells you the exact command). Push, then stop.
