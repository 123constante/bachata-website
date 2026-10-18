# Brief: fix-going-isolation (Website, one SMALL fix worker, ONE push, no new PR)

Branch `claude/going-hidden` (PR #836 exists, head 634f2c0f; do NOT open another). Plain git only, never `gh api`. No variables/loops/`$(...)` in shell.
Never merge/approve, never `--no-verify`, Supabase read-only. Push ONCE. Stop after the push.

## Failure the orchestrator saw (red on #836, run 39104714650)
`dancer-area-isolation` fails with 4 violations, all rule (a) "changed file is neither inside src/modules/dancer-app/, nor a test, nor a seam":
- `src/lib/__tests__/goingHidden.test.tsx`
- `src/lib/goingCheckin.ts`
- `src/pages/MyAttendance.tsx`
- `src/pages/__tests__/MyAttendance.test.tsx`
(Everything else, including the event-page, FestivalHub and dancer-app files, is already allowed.) The check that would have caught it: run `npm run check:dancer-area-isolation` before pushing.

## Owner/orchestrator decision (do not re-open)
1. Tests: `git mv` both test files into `tests/client/` (names `goingHidden.test.tsx`, `myAttendance.test.tsx`), fix their relative imports; the check treats `tests/**` as tests. Make sure they still run (`npx vitest run tests/client/goingHidden.test.tsx tests/client/myAttendance.test.tsx`).
2. Seams: add `src/lib/goingCheckin.ts` and `src/pages/MyAttendance.tsx` to the `seams` list in `scripts/dancer-area-isolation-allowlist.json`, each with a short `seamNotes` entry (read how the existing FestivalHub seam note is written and match it): "owner 2026-10-18: single switch hiding Going/Interested from visitors until it does something visible" and "MyAttendance empty-state sentence pointed at the hidden control". Do NOT edit `scripts/check-dancer-area-isolation.mjs`.
   If a test (`tests/client/dancerAppReviewFixes.test.ts` or similar) pins the allow-list against `briefs/dancer-rebuild-INTERFACE.md` and fails because the doc is on another branch, do NOT touch that doc; list the failure in your handover and the orchestrator updates the doc.
3. Run `npm run check:dancer-area-isolation` against base origin/main: show before (4 violations) and after (OK). Also `--self-test`, and re-run the unit tests you moved plus `tests/client/dancerAppReviewFixes.test.ts`. Run the other CI job steps that this touches (doc/allow-list/integrity) and list exit codes.
4. Append a short "isolation fix" section to `docs/handover/going-hidden.md` with the before/after lines. One commit, subject ending `[worker-done <your ticket>]`, ONE push.
