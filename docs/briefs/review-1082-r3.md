# Brief: ROUND 3 (Fable) review of PR #1082 (P3 W3a Name and details + Prices, one save model) -- READ-ONLY, findings doc only

Repo 123constante/bachata-website. Review `claude/p3-w3a-details` at head 70b1c75 (main merged in, includes #1092) against `main`. You did not build it (Opus built, Sonnet reviewed twice, Opus fixed twice). You write ONE file on branch `claude/review-1082-r3`: `docs/reviews/1082-r3.md`. No source edits, no DB write (Supabase read-only: function bodies and counts only, no personal data).

## Context
Prior reviews: `docs/reviews/1082-r1.md` (branch claude/review-1082-r1) and `docs/reviews/1082-r2.md` (claude/review-1082-r2); fix tables in `docs/design/1082.md` on the PR branch. Brief it was built from: `docs/briefs/p3-w3a-details.md` on `brief/p3-w3a-details`. Read those first, then do NOT re-verify what they already traced unless the code changed: look for what two Sonnet rounds could miss.

## Judge (fresh eyes on the whole save path)
1. End to end for Details and Prices: what exact `series_command_p5` envelope is sent (read `_cmd_series_upsert_p5`, `apply_aggregate_write_p5`, `series.set_group_chat`, `_snapshot_series_p5`, read-only). Can ANY edit sequence (edit, undo, edit, refused stale save, Start again, retry, two-step save with step 2 failing, tab switch, double tap on Save) send a payload that overwrites a field the person did not change, drops data (price lists incl. the 7 team-shaped prod lists, passes, music, venue/city, cover, chat), or double-applies?
2. Idempotency: key lifecycle across retry, stale refusal, version change, restart; the server replays on `(actor_id, idempotency_key)` only (no body hash): can the client ever reuse a key with a different body? Same for SessionSheet (nit A fix) and the date path.
3. Version model: `useEditForm` opened / landed / own versions; races between refetch and save; can a person ever save over someone else's change without a `version_conflict`?
4. Leave guard and Undo: every exit path; dirty detection vs the plan (a dirty tray with an empty plan, or a clean tray hiding a real change: clear a field, remove the last price, "It's free" off, music cleared).
5. Authority and gates: owner vs team/manager permissions on the upsert arm; ended / archived / festival / draft locks match the server (read the permission block), not just the client; the group-chat command admitted for owners (`check_owner_command_allowlist_v1`) and mirrored in `OWNER_COMMAND_KINDS` + both mirror tests.
6. Old-area parity and drift: rules called not copied (paymentModel, linkRules, venueOverride, seriesExtras); anything the old area validates that P3 lets through (length caps music 300 / tickets 500 / Instagram 300 are known and unfixed: say if you think it blocks).
7. Scope and flag-OFF: no P3 import in an always-loaded route; `/account/o` untouched; bundle: `/app` first load under its pin (main is green at a5d4bb4 with 22 B margin; does this PR spend any?). Check the CI `bundle-budget` result at the PR head.

## Output
Findings ranked most severe first: file:line, what is wrong, a concrete failing input, severity (blocks merge / fix before arc end / nit), CONFIRMED or PLAUSIBLE. End with "Not reviewed". Zero findings is valid if you say what you checked. Stop at 30% context with a PARTIAL marker; final commit subject ends with the done marker from your prompt.
