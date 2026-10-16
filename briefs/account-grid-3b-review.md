# Brief: independent review of Website slice 3b (landing, invite card, re-entry, /app/welcome, accountGate.ts) - read-only

Repo `123constante/bachata-website`. Review the CURRENT head of branch `claude/account-grid-3b` against its base
`claude/account-grid` c30e9d3 (`git diff c30e9d3 <head>`; write the head SHA in your report). Create YOUR OWN branch
`claude/account-grid-3b-review` from that head; change NO code. Commit only
`docs/review-packs/account-grid/REVIEW-3B.md`.

## Read first
- Slice brief: Website `arc/briefs-dancer-rebuild` `briefs/account-grid-3b-landing.md` (owner decisions, the PINNED
  `accountGate.ts` shape) and the worker's handover `docs/handover/account-grid-3b.md`.
- `docs/account-system/{DECISIONS,ACCOUNT-MODEL,JOURNEY-GRID}.md`, `src/pages/AuthCallback.tsx`,
  `src/lib/accountDeletion.ts`, `src/hooks/useProfileCompletion.ts`.

## Review for (blocking = a real person is stuck, misled, lands in the wrong place, or loops)
1. Landing matrix: for each of {signed-out, deleted<30d, deleted>30d, empty, dancer incomplete, dancer complete,
   organiser 1, organiser 2+, organiser-intent, admin} x {no returnTo, returnTo}, trace the code and say where the
   person lands. A deleted login must reach restore / deleted card BEFORE any area renders (the organiser session
   relies on this). An admin's routing must be unchanged (D2).
2. `accountGate.ts` matches the pinned shape EXACTLY (names, union members, `deleted` wins); `useAccountGate` and
   `fetchAccountGate` share ONE mapping (not two copies); no new RPC; no duplicate of the AuthCallback deletion check.
3. O3 team invite: bearer join, "Joining as <name>", "Not you? Sign out" works for signed-in AND signed-out.
4. D3/D4: setup uses `replace` (Back never re-enters setup); finished dancer on `/app/welcome` sees the end card;
   half-finished setup resumes at the first missing step. Any redirect loop (A -> B -> A)? Check each guard pair.
5. Every empty state says what the person CAN do; no text points at a control that is not on screen; a control that
   cannot work is disabled with a reason.
6. Files: only `accountRouting.ts`, `accountGate.ts`, landing/invite/welcome screens, tests, the auth.today snapshot,
   handover/shots. Nothing in `src/modules/organiser/**` or `src/modules/dancer-app/**` (the dancer-area isolation
   check fails the PR on ANY dancer-app file). List any one-line calls added to 3a/3c/3d files.
7. Tests: would each FAIL on the base? table-driven? any test that only asserts a mock? Snapshot update: is every
   changed line the intended 3c link-sent copy, nothing else?

## Output
`REVIEW-3B.md`: VERDICT line (CLEAN / N blocking), findings ranked blocking / should / note, each with file:line,
failure scenario, one-paragraph fix; then "Checked and fine" with the landing matrix table. Final commit subject
ending `[worker-done <ticket>]`, push YOUR branch only. Then stop.

## Rules
Plain git only, never `gh api`. Supabase READ-ONLY. Never merge/approve/`--no-verify`. Shell commands without
variables, loops or `$(...)` where a plain command works. At 25% context start nothing new; by 30% push
`PARTIAL [worker-done <ticket>]`.
