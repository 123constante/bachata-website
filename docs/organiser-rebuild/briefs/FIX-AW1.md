# Fix brief FIX-AW1 -- one fix/continuation pass on claude/org-r1-parity-aw1 (admin)

Repo `123constante/bachata-admin`. Push ONLY `claude/org-r1-parity-aw1` (head 934a76e0; the author worker is DONE, you are the only one on it). ONE push at the end (plus a PARTIAL push if cut short). Plain git, never `gh api`; shell commands without variables, loops or `$(...)`. Opus, xhigh. Stay under 30% context: at 25% start nothing new; by 30% push + handover `docs/organiser-rebuild/handovers/AW1-fix.md` with last subject ending `PARTIAL [worker-done <ticket>]`. A continuation worker per slice is normal. Supabase connector READ-ONLY (SELECT, counts only). Do not run CI on the owner's PC; run every CI job step you can in your sandbox and put the per-job table (command + exit) in the handover (GitHub Actions may be refused for billing; that is not a code failure). Final commit subject ends `[worker-done <ticket>]`.

Read first: `docs/organiser-rebuild/handovers/AW1.md` on the branch; the review `docs/organiser-rebuild/reviews/REVIEW-AW1.md` on branch `claude/org-r1-review-AW1`; `AW1-addendum-B1.md` and `AW1-admin-widen.md` on Website repo branch `arc/briefs-organiser-r1` (`docs/organiser-rebuild/briefs/`; fetch https://github.com/123constante/bachata-website.git that branch, then `git show`). The Website's FIX-SW1 sends stored `id` on days, sections and items, none on people.

Migrations: do NOT add new files if you can edit the two unapplied files `20261126220000` and `20261126230000` in place (they are on no DB that matters; prod matches their before-pins). Keep their versions.

## Required (the review's findings, in order)

### B-1 (BLOCKING) Implement addendum B1 properly
Rewrite `_cmd_series_set_program_p5` to UPSERT days/sections/items by `id`, scoped to THIS series:
1. Payload rule `_owner_program_problem_p5` admits an optional `id` (uuid) on days, sections, items. An id that does not belong to this series, or a duplicate id, is refused with fixed text. Rows with no id are inserted with new ids.
2. Delete ONLY rows whose ids are absent from the payload (cascade from a deleted item to its overrides is intended). Kept rows keep `created_at` and `legacy_program_item_id`.
3. People: when a person row carries no id, replace that item's people by position (delete that item's people, re-insert). NEVER rewrite `profile_type`; keep exactly what is sent.
4. Remove the lock-time "any override exists" refusal for owners. Replace it with: refuse only when the payload would DELETE an item that an override references AND the caller is not an admin, with text naming the affected session (review N-2). (Admin deleting such an item cascades, as the Website confirm copy says.) Keep festival and multi-day refusals for owners.
5. The ADMIN path gets the same upsert (the admin wipe is live on prod today: 4 series already lost overrides). Update `lib/programTreeP5Converters.ts` `buildP5ProgramTreePayload` so the admin editor sends stored ids, with its unit test. Put a plain heading "ADMIN EDITOR DATA LOSS TODAY?" in the handover with the answer and the prod audit evidence.
6. Tests, RED first against the unfixed code (paste the reds): override on item X; untouched save keeps the override with the same item id; rename X keeps it; delete X removes it (owner refused with the session-naming text, admin allowed); add an item gets a new id; a foreign series' id is refused; a duplicate id is refused; `created_at` and `legacy_program_item_id` kept; `profile_type` kept as sent; people replaced by position. Update/delete the old "refused while overrides exist" test to the new rule. Regenerate the 8 fixtures (`migration:prove --write`).

### B-2 (BLOCKING) set_organisers consent -- owner-delegated decision, logged
Restrict ADDED organiser ids to organisers the caller owns or manages (`_is_entity_member('organiser', id, auth.uid(), ARRAY['owner','manager'])`). Kept ids pass unchanged; admins unaffected. Refusal text tells the owner to ask an admin to add a page they do not manage. Tests RED first, plus a mutant that drops the check goes red. Record in the handover under Decisions: owner decision pending (Claude defaulted to restrict; 41 of 48 live organiser pages have no owner/manager, so unrestricted adds would list events on third parties' pages).

### S-1 cast rows carry `profile_type`
`organiser_series_cast_v1`: group by (profile_id, profile_type); emit `profile_type` in both `cast` and `recent_people`; test it, including one person under two types.

### S-2 behaviour tests for roster-only access
Add "contributor refused" and "legacy roster-only member (`organiser_team_members`) refused" cases for `series.set_program` in the programme db test; show mutant b2 (drop `set_program` from the owner/manager membership arm) now fails a BEHAVIOUR test, not only the md5 guard.

### S-3 dead retarget
`prove-w1-owner-save-p5.mjs` D5a/D5b never run (exit 2, STALE since D3). Drop them and cite the db test instead (or move into prove-w0 if trivially safe); fix prove-w0 N2m demoting only `organiser_ids[0]` if the owner also owns another organiser on S1. Correct the handover claim.

### S-4 A1 pin chain (do last, only if cheap)
Do NOT rebase now. Write in the handover the exact list of pins/fixtures to re-pin once A1 (`claude/org-r1-admin`) merges (review S-4 has it), and the required merge order (A1 first, then AW1).

## Also
- Update the handover Verified / Not verified; rerun `migration:prove` (exit 0), tsc, `check:integrity`, both db tests, vitest for the converter.
- Do not touch unrelated files. No UI in this PR beyond the converter.
