# Review brief R-AW1 -- independent review of admin branch claude/org-r1-parity-aw1 (AW1: owners may save the programme, line-up and co-organisers)

Repo `123constante/bachata-admin`, branch `claude/org-r1-parity-aw1` (head 934a76e0, no PR yet; base main a12a21a6). You are the REVIEWER, not the author. Work on branch `claude/org-r1-review-AW1` (create it from `claude/org-r1-parity-aw1`); you commit ONLY `docs/organiser-rebuild/reviews/REVIEW-AW1.md` there and change no other file. Plain git only (no `gh api`); write shell commands without variables, loops or `$(...)`. Supabase connector is READ-ONLY on prod (`stsdtacfauprzrdebmzg`): SELECT only, counts only, no personal data. Do not write to E2E either.

Read first: the author's handover `docs/organiser-rebuild/handovers/AW1.md` on the branch; the briefs `AW1-admin-widen.md` and `AW1-addendum-B1.md` on `123constante/bachata-website` branch `arc/briefs-organiser-r1` (`docs/organiser-rebuild/briefs/`; `git fetch` that branch into a scratch dir and use `git show`); `reviews/REVIEW-SW1.md` on `claude/org-r1-review-SW1` of the Website repo (the origin of addendum B1); the admin repo `CLAUDE.md` (migration conventions, md5 pins).

## Effort and stopping rule
Opus, xhigh, correctness first (SQL and ACL: highest blast radius). ONE pass; findings go to ONE continuation/fix worker on the SAME branch. Severity: BLOCKING / SHOULD / NOTE. Stay under 30% context; at 25% start nothing new; final commit subject ends `[worker-done <ticket>]` (`PARTIAL` if cut short). ONE push.

## The question to answer first: B1 (data-loss blocker)
Addendum B1 required `series.set_program` to UPSERT days/sections/items by `id`, delete only rows absent from the payload, keep `legacy_program_item_id` and `created_at`, replace people by position, never rewrite `profile_type`, and keep per-date overrides on kept items. The author did NOT do that: the handover says the owner path is REFUSED while any per-date override exists (delete+reinsert still cascades through `event_occurrence_session_override_p5.program_item_id`). Rule on it:
1. Is the refusal airtight? Read the live body of `_cmd_series_set_program_p5` in the migration. Any path (admin, owner, manager, festival, empty payload, concurrent write between the check and the DELETE) that reaches the DELETE with overrides present? Prove with a test or a mutant.
2. What does the refusal do to real owners? Prod (counts): of the 20 owner/manager series, how many have overrides (author says 6), and what does the owner then see? Is the refusal text actionable? Is a Website save of an untouched programme on those 6 refused (it must not silently "work" and must not wipe)?
3. Does the ADMIN path (unchanged, delete+reinsert) wipe overrides TODAY on prod? Read `lib/programTreeP5Converters.ts` and the admin editor save path: does it send item ids? Report plainly under "ADMIN EDITOR DATA LOSS TODAY?" (89 overrides on 19 series exist; 81 are past dates).
4. Recommendation (one): fix B1 properly now (upsert by id) in the continuation worker, or accept the refusal for this wave. State the risk of each.

## Also verify (command + output for each)
1. Files: only the two migrations, two db tests, 8 regenerated fixtures, guard-script retargets, handover. `git diff --name-only origin/main...`.
2. `set_program` for owners/managers: manager allowed, plain member refused, non-owner of THIS series refused, ended series refused, festival / more than one day refused for owners, caps (256 KiB, 60 sessions, 300 people, field lengths) enforced BEFORE any write, whitespace and null shapes (the review-low fix), person visibility rule, re-save of an existing (profile_id, profile_type, role) never refused.
3. `set_organisers`: owner-only (manager refused), added organiser must be live and active, kept ones pass, empty list refused, no self-removal. Rule on the OPEN consent question (an owner can attach ANY live organiser page and thereby make that organiser's owners series owners; trigger `trg_sync_series_organiser_junction`): recommend restrict-to-callers-organisers or invite flow or accept; state who is affected on prod (46 organisers).
4. `organiser_series_cast_v1`: authenticated only, anon refused, a caller who owns nothing gets nothing, no personal data in `recent_people`, rows carry `profile_type`.
5. Pins: `check_owner_command_allowlist_v1` and `check_self_serve_contract_v1` re-pinned correctly; prod body md5s still equal the pins in 20261126220000 (re-read prod, SELECT only); `prove-w0` N2 / `prove-w1` D5 retargets are real (run with `--baseline`).
6. E2E ledger risk: E2E has 20261126180000 / 190000 with no file on main; say whether the pin chain breaks when A1 lands, and what the continuation must re-pin.
7. Tests that can fail: run both db tests, then MUTATE and paste each red, reverting after each: (a) drop the override-exists refusal; (b) drop the series-owner check in the handler gate; (c) allow manager in set_organisers; (d) drop the festival refusal; (e) drop the added-organiser live/active check; (f) drop the self-removal rule. A mutant that stays green is BLOCKING.
8. CI: read `.github/workflows` of the admin repo; run what the sandbox can (migration:prove, check:* the branch touches, tsc, integrity); a GitHub payments annotation is not a code failure; state what could not run.

## Output
`docs/organiser-rebuild/reviews/REVIEW-AW1.md`: verdict (CLEAN / n BLOCKING / n SHOULD / n NOTE), the B1 ruling first, findings with file:line, why and the one-sentence fix, mutation evidence, CI table, Verified / Not verified.
