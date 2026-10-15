# Brief: Dancer Rebuild W1-finish (run the remaining gates, apply the review's error codes) -- PR B1a sub-branch

Repo `123constante/bachata-website` (PUBLIC: no secret or email in any commit). Model Opus 5.5.
NEVER run `gh api` in this repo; read other branches with `git fetch origin <branch>` + `git show FETCH_HEAD:<path>`.
Read `briefs/dancer-rebuild-COMMON.md`, `briefs/dancer-rebuild-INTERFACE.md` (section "Round-2 additions" at the
end is new) and `briefs/dancer-rebuild-w1-foundation.md` on `arc/briefs-dancer-rebuild` FIRST.

BRANCH: `arc/dancer-app-w1` ALREADY EXISTS (head `2794f071`, pushed by the previous W1 worker, which stopped at its
context gate). Check it out and CONTINUE on it; never recreate it; push only this branch. Do NOT open a PR. Read
`docs/handover/dancer-rebuild-w1.md` on that branch in full first. Its "What is left" section is your job, plus:

1. **Error map (from the independent DB review of PR A1)**: `src/modules/dancer-app/api/errors.ts` must give plain
   copy for EVERY code in INTERFACE "Round-2 additions" (gate/admin: `area_closed`, `not_signed_in`; member:
   `no_profile`, `profile_mismatch`, `rate_limited`, `whatsapp_not_allowed`, `invalid_payload`, `unknown_key`,
   `invalid_type`, `first_name_required`, `city_required`, `photo_required`, `invalid_display_name`,
   `invalid_text`, `invalid_role`, `invalid_year`, `bio_too_long`, `bio_has_link`, `invalid_handle`, `invalid_url`,
   `invalid_whatsapp`, `invalid_list`, plus PostgreSQL's `permission denied for function` (42501) -> signed-out
   copy). Where the DB sends a DETAIL naming the field, the copy names the field in plain words. A table-driven
   test asserts every code has copy and none falls through to the generic sentence.
2. **Save wrapper (R6)**: `saveMyDancerProfile` must DROP `whatsapp` and `show_whatsapp_publicly` from the delta
   when the person's `other_roles` is empty (the DB refuses their mere presence with `whatsapp_not_allowed`).
   Red-first test against the unfixed wrapper; mirror the rule in `fakeBackend.ts` so the fake refuses like the DB.
3. The remaining gates, with R0's files present: `git fetch origin arc/dancer-app-r0` and run R0's isolation
   script `scripts/check-dancer-area-isolation.mjs` (from that branch, via `git show FETCH_HEAD:...` into a temp
   path, never committed here) against this branch; `npm run test:unit` (name the pre-existing environment reds by
   comparing with a clean `origin/main` checkout), `npm run lint`, `npm run check:wallclock-brand`,
   `npm run check:first-load-requests`, `AUDIT_STRICT=1 npm run check:images`, `prove-entry-point-dispatch` (see the
   integrity job), `npm run pre-ship`, `npm run test:e2e`, `npm run build` + `npm run check:bundle-budget`. Then read
   every `.github/workflows/*.yml` and run any job step not yet in the table.
4. Fix anything red that is yours; do not touch protected files or any file outside the seam list.
5. Update the handover in place: CI table complete, Verified / Not verified, Status COMPLETE (or exactly what is
   still missing and why).

Done means: error map + R6 wrapper with red-first proof, every gate tabled, handover updated. Commit, push ONCE with
the last subject ending `[worker-done <ticket>]`, report head SHA. Stop after the push.
