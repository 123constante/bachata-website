# Walk seed: the shapes the authenticated P3 walks need

`scripts/walk-seed.mjs` creates a fixed set of draft test events on prod, owned by
the walk TEST user, through the app's own owner commands (`series_command_p5` /
`occurrence_command_p5`, the envelope from `shared/seriesCommands.ts`). The server's
owner allowlist judges every command exactly as it judges the organiser screens; the
script never works around a refusal.

## The rule

- Every seeded event is `draft` (the script sends no lifecycle command) or, later, `paused`. **Never live.**
- Every name is `WALK <shape> (draft, do not publish)`.
- No personal data: session titles are generic, line-up people are picked by role from
  `organiser_search_people_v1` at run time and recorded by id only (in the manifest, not here).

## Shapes

Command counts are what `--dry-run` prints (pinned by `tests/walkSeed.test.ts`). Every shape
starts with a create (`series.upsert` with the organiser key, start date = today + 7, 19:00,
240 min, Europe/London); every weekly shape then sends `series.set_recurrence` (weekly, one
weekday, open-ended).

| Shape | Commands | What it is for |
|---|---|---|
| `weekly16` | 3 | 16 sessions (the prod max seen): 12 classes (levels on 10, times on 8), 2 parties, 2 performances; untimed rows; 2 sessions carry a free-text `room` (Studio A / B). `venue_room_id` is NOT set: it needs a venue with rooms, which the walk user does not have. |
| `weekly-lineup` | 3 | 3 sessions with a teacher on the 2 classes and a DJ on the party (line-up rendering). |
| `oneoff-untimed` | 2 | One-off with one party session that has no time. |
| `oneoff-2dates` | 2 | One-off with a second date (`series.add_date`, start + 7). |
| `course` | 4 | Weekly, then `series.upsert {format: course, course_total_sessions: 8}`, 2 classes. The server's A2 arm admits both keys for an owner (seen in `apply_aggregate_write_p5`); not yet proven by an `--apply`. |
| `weekly-cancelled-date` | 4 | Weekly; coming date #1 cancelled (`occurrence.cancel` with the first `cancellation_reasons` label), date #2 taken off (`series.skip_date`). |
| `weekly-30dates` | 2 | Weekly, open-ended: the server materialises about a year (prod today: max 57, median 41 coming dates per series), so over 30. **Over the 100-row cap is not reachable** by an owner: the weekly rule is the only one an owner may set (interval 1, at most 12 months), so ~52 is the ceiling; a 100+ shape needs an admin-made series. |
| `empty-sessions` | 2 | Weekly with 0 sessions (the #25 empty-session shape). |
| `nameless-session` | 3 | Weekly with one stored session whose title is `''` (the 239-on-prod shape). `_owner_program_problem_p5` requires a STRING title of at most 200 characters on one line, so `''` is admitted; the app's own editor refuses it client-side, the server does not. |
| `festival` | SKIPPED | An owner cannot create a festival series, and `_owner_program_problem_p5` refuses festival programmes (`festival programmes are admin-only`). |

Total: 25 commands across 9 shapes.

## Run it

```bash
node scripts/walk-seed.mjs                          # dry run: prints every envelope, no network
node scripts/walk-seed.mjs --only weekly16          # one shape
node scripts/walk-seed.mjs --apply [--env-file <path>]
```

`--apply` reads `WALK_TEST_EMAIL`, `WALK_TEST_PASSWORD`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` from the env file (default
`C:/dev/bachata-admin-11april/.env.local`), signs in with the password grant
(`/auth/v1/token?grant_type=password`), reads `organiser_home_v1` for the user's owned
organiser page and every series name, and creates only the shapes whose exact name is
absent. It prints the manifest `{ "<shape>": "<series id>" }` for
`~/.claude/walk-manifest.json`. Exit 0 done, 1 a shape failed (the others still ran), 2
cannot run. Nothing secret is printed.

## Idempotency and rebuilding

- A shape whose exact name is already in the walk user's list is skipped (`present`).
- Every command's idempotency key is derived from `shape + step`, and each create claims a
  series id derived from the shape, so a replayed command is the server's no-op, never a
  duplicate.
- A shape that FAILED part-way stays under its name and is then skipped as present. To
  rebuild one: archive it from the organiser screens and rename it (which frees the name),
  then run `--apply --only <shape> --salt <new word>`. The salt changes the derived series
  id and every key, so the rebuild never replays onto the old series.
