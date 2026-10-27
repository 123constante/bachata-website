# Brief: replan P3 (the new organiser area) as an ARC -- READ-ONLY planning, docs only

Lane: normal. Repo 123constante/bachata-website, base `main`. Branch `claude/p3-arc-plan`. You write ONE file: `docs/plans/ARC-p3.md`. No source, no tests, no migrations, no DB write. Supabase is read-only (counts only, no personal data).

Owner decisions (fixed, do not reopen): slice order is W0 (merged) -> W1 (merged) -> W2a event page + Status sheet (merged, PR #1057) -> W2c cancel the event on a one-off (building, branch `claude/p3-cancel-one-off`) -> W2b dates -> W2d sessions / line-up -> W3 later. P3 sits behind the `organiserP3` flag (OFF). Replan the DETAIL of each remaining slice, not the order.

## Read first (narrow reads: grep/headings before whole files)
- The merged P3 code under `src/modules/organiser/p3/` and `docs/design/1057.md`, `docs/handover/p3-w2a-walk` (names only).
- The P3 contract and mockups the W2a brief names: ask the file `BRIEF-p3-w2a-event-page-status.md` content via the repo's `docs/` copies if present (`git grep -il "CONTRACT" docs | head`); if the contract is not in the repo, say so and list what you could not read.
- The W2c brief `docs/briefs/p3-cancel-one-off.md` on branch `brief/p3-cancel-one-off`.
- Admin repo facts only through the Supabase read-only connector (RPC names, `series_command_p5` / `command_dispatch_p5` kinds) and the repo docs; never edit the admin repo.

## Produce `docs/plans/ARC-p3.md` with
1. Goal and the done-state of P3 in 5 lines, including what turning `organiserP3` ON requires (who sees it first, rollback).
2. A table, one row per remaining slice (W2c, W2b, W2d, W3): scope in/out, screens, commands used (name each server command and whether prod already admits it), test matrix shape (the real prod data shapes to survey), design-record stages needed (Design Gate), risks, which slices can run in parallel on disjoint files and which must be serial, and the model/effort per slice (Opus builds logic, Sonnet docs and screens, Fable reviews guard/RPC/migration only).
3. Dependencies on the admin repo (anything needing a migration or an RPC change is a separate careful-lane item: list it, do not plan to build it here).
4. Stopping points: the earliest slice after which P3 is usable behind the flag, and what would be left.
5. Open questions only the owner can answer, each with a recommended answer.
6. A "Not verified" list: what you could not read or check.

## Do NOT
Touch any file except `docs/plans/ARC-p3.md`. Do not reorder the slices. Do not invent server commands: if a command is not in prod, say so. No raw unicode punctuation in the file (use plain hyphens and quotes). Do not run the full test suite: nothing here needs it.

## Done =
Push `claude/p3-arc-plan` once with `docs/plans/ARC-p3.md`; final commit subject ends with the done marker from your prompt. Stop at 30% context with a PARTIAL marker. Docs-only: the PR will carry the `automerge-ok` label per your prompt only if under 400 lines; otherwise leave it for the orchestrator.
