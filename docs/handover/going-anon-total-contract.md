# Handover: going stats total, anon-refusal contract check

Branch `claude/going-anon-total-contract`. Brief: `briefs/going-anon-total-contract.md`
on `brief/going-anon-total-contract`.

## What changed

`scripts/check-going-rpcs.mjs` only. `get_my_organiser_going_total_v1()` (admin PR #988)
is now guarded beside `get_my_event_going_v1`, mirroring it:

1. Header list of anon-refused RPCs.
2. `grade()` refusal loop: `['get_my_organiser_going_total_v1', obs.anonMyTotal]`, judged by
   the unchanged `isRefusal` (42501 or not_signed_in / anonymous_session, data null).
3. `collect()`: `anonMyTotal: await api.rpc('get_my_organiser_going_total_v1', {})` (no args).
4. `collect()` `answers` list (the infra-failure scan): entry added, so a 5xx/network failure
   on the new probe throws as could-not-measure instead of grading.
5. Self-test: the healthy fake answers 42501 for it; new mutant
   `anon get_my_organiser_going_total_v1 succeeding fails` returns `{going_total:0,nights:0,events:0}`
   and must exit 1.
6. `accountKeyPaths` / the no-account-key scan untouched (they already walk `obs`).

`db-contract-check.yml` step "Run going RPC contract check (Going P2)" already runs
`--self-test` then the live check, so no workflow edit.

## Results

- Self-test: 43 cases before, 44 after, PASS.
- Mutation proof: with the new entry removed from the refusal loop, the self-test printed
  `FAIL anon get_my_organiser_going_total_v1 succeeding fails: expected exit 1, got 0`; restored.
- Prod (read-only SELECT, `stsdtacfauprzrdebmzg`): `get_my_organiser_going_total_v1()` exists with no
  arguments, anon EXECUTE false, authenticated EXECUTE true (same as the three siblings).

## Not verified

- Live run of the check against prod: the sandbox's `VITE_SUPABASE_URL` points at a different
  project with none of the going RPCs (every going probe answers PGRST202 there, on main too).
  CI's db-contract-check runs it live with the prod secrets.
- The signed-in shape of the RPC (no signed-in test account in CI, as for the siblings).

## Left for follow-ups (out of this brief's one-file scope)

- `SIGNED_IN_SKIP` text in the script does not name `get_my_event_going_v1` or the new RPC.
- The script's header says "four" RPCs; it was already stale before this change.
- `docs/ci-guard-notes.md` inventory entry for check-going-rpcs lists only the older anon refusals.
- `docs/handover/going-stats-total-web.md` still lists this check as "not done"; it is done here.
- Review suggestions not taken: one shared table driving probe/scan/grade; Promise.all on the
  independent anon probes; a wrong-reason canary for the new RPC.
