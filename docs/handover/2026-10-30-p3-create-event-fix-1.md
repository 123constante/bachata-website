# Handover 2026-10-30: P3 create-event fix round 1 (PR #1208)

Brief: `brief/p3-create-event-fix-1:docs/briefs/p3-create-event-fix-1.md`. Branch `claude/p3-create-event-build`.

## Done

1. **Red unit job (R2-2, `review2.test.tsx` l.191).**
   - Root cause: React Router 7's `MemoryRouter`/`BrowserRouter` write the location inside `React.startTransition`. The partial card's `setState` is urgent, so under CI load it paints before the `?sid=` URL commits. The test read `where()` in that same tick.
   - It was not leaked storage: `beforeEach` clears sessionStorage.
   - Red: reproduced locally with 4 CPU hogs, 1 of 3 runs failed with "expected '/account/p3/create?at=form&kind=one_d...' to contain 'sid=...'".
   - Fix: `await waitFor(...)` for the URL before reading it.
   - Green: 6 of 6 runs passed under the same load, and `npx vitest run src/modules/organiser` passed (222 files).
   - Production safety: `landed()` calls `rememberCreated` synchronously before `navigate`. A reload in the few-ms gap boots with no sid, so a blank form, and the draft stays on the server, listed in Events. No second create can be sent. No production change was needed.
2. **PR body** is in `docs/handovers/p3-create-event-pr-body.md`; the lead applies it. Both `check-pr-real-data-verified.mjs` and `check-pr-phone-qa.mjs` pass on it locally.
3. **Coverage line** added to the end of `docs/design/p3-create-event/BUILD-INVENTORY.md`. The verdict column was counted: 30 built, 18 slice-2, 12 needs-admin, 11 excluded = 71.

## Local full offline suite

- 689 of 691 files passed.
- `tests/integrityCouldNotRun.test.ts` and `tests/ogBrandedCardLayout.test.ts` fail locally both with and without this change. That is environment-only: the precondition "typescript must not resolve in a temp repo" breaks here. Both pass on CI.

## Left / next

- Apply the PR body to #1208 and re-run the checks.
- `/code-review` of this round was not run (no reviewer in a cloud worker). The diff is test-only plus docs.
- The fixes to round-2 findings are still unreviewed (carried over).
