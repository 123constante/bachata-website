# Review brief R-AW1b -- round-2 independent review of the AW1 FIX pass (admin PR #838, head bdddaa5a)

Repo `123constante/bachata-admin`, PR #838, branch `claude/org-r1-parity-aw1`. You are the REVIEWER, a different worker from both the author and the fix worker. Work on branch `claude/org-r1-review-AW1b` (create from `claude/org-r1-parity-aw1`); commit ONLY `docs/organiser-rebuild/reviews/REVIEW-AW1b.md`. Plain git (no `gh api`); shell commands without variables, loops or `$(...)`. Supabase connector READ-ONLY on prod (`stsdtacfauprzrdebmzg`): SELECT only, counts only, no personal data.

Read: `docs/organiser-rebuild/handovers/AW1-fix.md` (the fix pass), `AW1.md`, the round-1 review `docs/organiser-rebuild/reviews/REVIEW-AW1.md` on `claude/org-r1-review-AW1`, and the addendum `AW1-addendum-B1.md` on Website repo branch `arc/briefs-organiser-r1` (fetch https://github.com/123constante/bachata-website.git that branch). Diff to review: `git diff 934a76e0 bdddaa5a`.

## Effort and stopping rule
Opus, xhigh. This is ROUND 2 and the LAST review round: findings go to ONE finishing worker; no round 3. Severity BLOCKING / SHOULD / NOTE. Stay under 30% context; at 25% start nothing new; final commit subject ends `[worker-done <ticket>]` (PARTIAL if cut short). ONE push.

## Focus: the rewritten `_cmd_series_set_program_p5` (highest blast radius; admin AND owner use it)
1. **Data-loss and integrity.** Prove with tests/mutants that an untouched re-save from each shape of prod data loses nothing: series with 0/1/many items, with per-date overrides (past only, future), with people, with `legacy_program_item_id` set, multi-section, multi-day festival (admin only). The "parked on out-of-range keys" reorder trick: can a failure halfway leave rows parked (rollback is whole-statement? confirm it is one transaction), can two concurrent saves interleave (the series row lock)?
2. **The transition hazard the author flagged:** until the admin build carrying the converter change is deployed, an admin save sends NO ids, so the new handler treats every stored row as absent and deletes them (= today's wipe). Is there a safe guard the handler can add (e.g. a payload with no ids at all for a series that has stored rows AND overrides is refused for admins unless a `force`/`replace_all` flag)? Rule on it and recommend one option. Same for the Website path before FIX-SW1 merges.
3. **Id scoping:** foreign, duplicate, wrong-level (a section id used as an item id), moved-between-parents ids; an id of a row deleted concurrently; ids on a payload for a series the caller does not own.
4. **Owner-refusal of deletes with overrides:** text uses the stored title; no payload text leaks; an owner may still re-order/rename; an owner payload that deletes a day that contains an item with an override (cascade through sections) is refused too?
5. **B-2 add restriction** (`230000`): added ids need owner/manager of that page; kept ids pass; an owner of ZERO linked pages cannot be left with none (self-removal rule still holds); admins unaffected. Four copies of the check: are all four identical? Mutate each copy.
6. **Cast rows (S-1):** one row per (profile_id, profile_type); anon refused; no personal data.
7. **Pins/fixtures:** after-md5s in both files equal the replayed bodies; before-pins equal prod (re-read prod md5s); `migration:prove --write` leaves no diff.
8. **Converter** `lib/programTreeP5Converters.ts`: sends stored ids only for saved rows; none for new; does the admin editor ever reuse a client-generated temp id as a real id (would trip the foreign-id refusal)? Read the editor save path in `useEditorV2Workspace.ts`.
9. Mutate at least: id-ownership check, duplicate check, delete-with-override refusal, per-item people replace, created_at preservation, the B-2 check (each of 4 copies); a mutant that stays green is BLOCKING.
10. CI: GitHub checks on #838 are green (prove, rpc-body-snapshots, ledger-sync...). Say which jobs you additionally ran and what could not run.

## Output
`docs/organiser-rebuild/reviews/REVIEW-AW1b.md`: verdict (CLEAN / n BLOCKING / n SHOULD / n NOTE), ruling on the transition hazard first, findings with file:line, why and the one-sentence fix, mutation table, Verified / Not verified.
