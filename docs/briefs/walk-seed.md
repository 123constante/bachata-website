# Brief: walk-account seed script (shapes the P3 walks need) -- BUILD THE SCRIPT, DO NOT RUN IT AGAINST PROD

Repo 123constante/bachata-website. Branch `claude/walk-seed` from `main`. Lane: careful (prod-write tooling). Opus.

## Why (owner words 2026-10-27)
"You need to be able to test everything." The walk TEST account owns one empty draft ("Walk test night", no dates, no sessions), so every authenticated walk sees one empty shape. Owner approved seeding ~10 draft test events on prod, created through the app's own commands as the walk test user. YOU build the script and prove it by dry-run and unit tests. You have no prod write: Supabase is read-only for you; the orchestrator runs `--apply`.

## Deliver
1. `scripts/walk-seed.mjs` (+ `scripts/__tests__` or the repo's convention for script tests; read `docs/ci-guard-notes.md` "script conventions" and `check-script-conventions.mjs` BEFORE writing, and satisfy all six rules). Modes: `--dry-run` (default; prints every command envelope, makes NO network call), `--apply` (signs in as the walk test user, sends the commands). Credentials: read `WALK_TEST_EMAIL` / `WALK_TEST_PASSWORD` and the public `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from the file named by `--env-file` (default `C:/dev/bachata-admin-11april/.env.local`), exactly as `~/.claude/bin/walk-session.mjs` does (password grant at `/auth/v1/token?grant_type=password`). Never print a secret.
2. Send writes with the SAME builders and envelope the app uses: `src/modules/organiser/shared/seriesCommands.ts` (`envelope`, `upsertCommand`, `createSeriesCommand`, `addDateCommand`, `cancelCommand`, `skipDateCommand`, `lifecycleCommand`, programme builders in `src/modules/organiser/p3/data/sessions.ts` / `shared/` for `series.set_program`) and the RPCs `series_command_p5` / `occurrence_command_p5` (find the exact call sites in `src/modules/organiser/**/data` and copy their argument shape). Import them or mirror them with a test that fails if the mirror drifts. One idempotency key per command, derived from the shape name + step so a re-run is a no-op, not a duplicate.
3. Idempotent: before creating a shape, look for it by exact name (`WALK ...`, read via the test user's own organiser list RPC the app uses) and skip if present. Print a manifest `{ "<shape>": "<series id>" }` on `--apply` (the orchestrator pastes it into `~/.claude/walk-manifest.json`).
4. `docs/walk-seed/README.md`: the shape table, what each one is for, how to rebuild, and the rule: every seeded event is `draft` or `paused`, named `WALK <shape> (draft, do not publish)`, never live, no personal data.

## Shapes (all owned by the walk test user; use only commands the owner allowlist admits; if one cannot be made with an owner command, say so in the README and SKIP it, never work around the allowlist)
1. `weekly16` recurring weekly, 16 session items (the prod max), several with level + time, 2 room-bound if rooms can be set by an owner (else skip rooms).
2. `weekly-lineup` recurring weekly, 3 items, line-up on each (teacher, DJ) using people the walk user may search (read-only `organiser_search_people_v1`; pick by role, record ids, no personal data in the README).
3. `oneoff-untimed` one-off with one untimed session.
4. `oneoff-2dates` one-off that has 2 dates.
5. `course` course with `course_total_sessions` and 2 items.
6. `weekly-cancelled-date` weekly with 1 cancelled coming date and 1 skipped date.
7. `weekly-30dates` weekly with over 30 coming dates (over the 100 cap if cheap; otherwise say what the cap test needs).
8. `empty-sessions` weekly with 0 items (the #25 empty-session shape).
9. `nameless-session` weekly with one stored UNTITLED session (the 239-on-prod shape) if an owner command can store an empty title; if refused, SKIP and say so.
10. `festival` ONLY if an owner can make a draft one; otherwise SKIP (festival programme is read-only for owners).

## Prove
- Dry-run prints all envelopes (count per shape in the README); unit tests cover envelope building, name-skip idempotency, key stability, and that `--dry-run` never calls fetch (inject a throwing fetch).
- Read-only prod check (Supabase MCP SELECT, counts only): list `event_series_p5` names starting `WALK` to confirm nothing collides.
- Run every CI job step that applies (read `.github/workflows`), per-job table in the PR body. PR gets a "Not verified: --apply never run against prod" line.

## Done =
Push `claude/walk-seed` once; final commit subject ends with the done marker from your prompt. 50% context cap, PARTIAL marker if you hit it.
