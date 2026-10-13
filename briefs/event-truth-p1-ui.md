# Brief: event-truth P1 -- Website UI/tests slice (prove and finish commit a8efae3c)

Repo 123constante/bachata-website (PUBLIC repo: never put a secret in a commit or a doc). Zero-context
cloud worker. Never merge, never approve, never --no-verify. Class: BUILD-visual (organiser screens).
BRANCH: `arc/event-truth-p1p3-ui`, created FROM `main`. Push only this branch.
STEP 0 (before anything else): the P1 Website commit a8efae3c exists only as a patch. Fetch it and apply it
as your FIRST commit, unchanged:
`gh api "repos/123constante/bachata-website/contents/briefs/a8efae3c.patch?ref=arc/briefs-event-truth" -q .content | base64 -d > /tmp/a8efae3c.patch && git am /tmp/a8efae3c.patch`
(keeps the original message and author). KNOWN FROM THE ORCHESTRATOR'S FULL RUN (Node 22, 5787 tests): that commit
reds 29 snapshot cases in `src/modules/organiser/events/__tests__/editorOrder.matrix.test.tsx` ("(3) same sections
shown and hidden, same reasons and lock text as before the reorder", every shape) -- the Type row text changed.
Fixing that is YOUR task 4 (read the diff: regenerate the snapshot ONLY if the new text is the intended label,
otherwise fix the code). Known flaky under full-suite load, pass alone: DancerFirstGate.matrix "returnTo
round-trips" x2 and organiser shell "/account/o renders". Never --no-verify: fix the snapshot, then push. Do NOT open a PR (the orchestrator merges into `feat/event-truth-p1p3` and opens
ONE PR). A parallel guard worker is on `arc/event-truth-p1p3-guard` and owns `scripts/check-event-truth-v1.mjs`,
`event-truth-baseline.json`, `docs/event-truth-table.md`, `scripts/fixtures/event-truth-parity.json`,
`src/lib/__tests__/eventCategory.parity.test.ts` and the workflow file: never touch those.

## Read first
CLAUDE.md (definition of done, density rules, HTML entities), `.claude/rules/*.md`,
`src/modules/organiser/CLAUDE.md` if present, docs/testing-doctrine.md, and the diff of a8efae3c
(`git show a8efae3c --stat`, then each file). That commit is UNREVIEWED: it is your job to review it,
prove it, and fix what you find.

## What a8efae3c did (owner decisions 2026-10-12/13, do not undo)
- `src/lib/eventCategory.ts`: the canonical rule. BYTE-PINNED (admin holds the same bytes, sha256 of the
  LF file starts a8d972e7; CI checks parity). NEVER edit it. Its test `src/lib/__tests__/eventCategory.test.ts`
  is yours to extend.
- Organiser New event: the Class / Party / Workshop chips SEED the first session (on the first UPCOMING
  date; `seedSessions` never seeds twice); no `category` is sent anywhere (createPayload, upsertCommand,
  createModel KIND_CATEGORY removed). The DB derives category from sessions; a sent value is ignored.
- Type row (EventEditorPage) and `runNoun` (event page ended line) read `wordForStored(format, stored)`:
  a stored `workshop` reads "class". Labels: Night / Class / Masterclass / Course / Festival / Not set.
- WORD vs SET, never mixed: single-word surfaces show `categoryLabelFor(format, stored)`; the SET
  (`deriveCategories`) is only for tabs/filters (a night with a class is under Parties AND Classes).

## Files you OWN
`src/**` (except the byte-pinned lib and the guard worker's two files), the organiser test suites,
`docs/handover/event-truth-p1-ui.md` (YOUR handover; create; update before every stop).

## Tasks
1. Review a8efae3c as a reviewer would (correctness, the density rules, copy pointing at controls that
   exist, HTML entities not raw Unicode). Fix findings in place; list each finding + fix in the handover.
2. Mutation proof, run against the UNFIXED code first: (a) `seedSessions` -> returns null / seeds nothing
   must red the seed tests (name them); (b) a `wordForStored` consumer swapped back to the raw stored
   value must red the Type-row and runNoun label tests (stored `workshop` must read "Class", never
   "Workshop"); (c) `createPayload` sending `category` again must red a test. Add the tests that are
   missing so each mutant dies. Record mutant -> red tests in the handover.
3. Consistency matrix (table-driven vitest): for every shape (format one_off / recurring / course /
   festival x stored party / class / workshop / masterclass / null x has upcoming date or not), the
   organiser Type row, the event page ended noun and the calendar tab membership read from the ONE
   mapping; no screen keeps its own copy (grep for 'workshop' / 'party' string literals in
   src/modules/organiser and src/modules/event-page and justify each survivor). Every empty state says what
   the person can do; a chip that cannot seed (no upcoming date) is disabled WITH a reason; saving an
   untouched record sends no command.
4. Snapshot: `src/modules/organiser/events/__tests__/__snapshots__/editorOrder.matrix.test.tsx.snap` may
   need an update after the Type-row change -- run the suite, commit the regenerated snapshot only if a
   test asked for it, and say why in the commit.
5. Every CI job step that applies (read .github/workflows: unit full under Node 22, e2e smoke list, lint
   chain, typecheck, the `integrity` job incl. `check:images` with `AUDIT_STRICT=1` and
   `prove-entry-point-dispatch`, `npm run pre-ship`). List each with its result.
6. 390x844 walk: the organiser flow needs a login and prod data, which this environment lacks -- do NOT
   fake it; write the walk SCRIPT (steps, what to tap, what should show) in the handover so the
   orchestrator walks it on prod-shaped data.

## Done means
Commit, push, update the handover (findings, mutants, matrix shapes, checks, walk script, Verified /
Not verified). Report: head SHA, checks per job, Not verified.
