# Handover: P3 real-rules refusal check (dt_b22abe2f731c) &mdash; PARTIAL

Brief: `docs/briefs/p3-real-rules-check.md` on branch `brief/p3-real-rules-check`.
Branch: `claude/p3-real-rules-check`, PR #1389. Stopped at the owner's context gate.

## Done
- `scripts/p3-refusal-codes.json`: 71 entries (mapper x code x snake_case reason, SQLSTATE,
  doors), read 2026-11-05 from prod `pg_get_functiondef` of `apply_aggregate_write_p5`,
  `_cmd_*`, `_require_onboarding_complete_v1`, `_assert_can_edit_series_p5`,
  `remove_organiser_member_v1`, `redeem_organiser_invite_v1`, `claim_my_organisers_v1`,
  `_account_link_refusal_v1` (raises nothing). Read-only SELECT via the Supabase MCP.
- `scripts/check-p3-refusal-reasons.mjs` (+ `--self-test`, 20 cases, drives `main()`; exit 0/1/2).
  **Red-first run: 31 violations** (30 command keys, `team:redeem_not_linked`). Those 31 are
  now the shrink-only `known_gaps` ratchet in the JSON, so main stays green and each fix
  must delete its line.
- `architecture-guard.yml` static step; `package.json` scripts; `docs/ci-guard-notes.md` entry;
  `check-script-conventions` passes with no allowlist change (no `--write` needed).
- F-56: `docs/organiser-rebuild/p3/CONTRACT.md` command-error list now says
  `permission_denied` is SQLSTATE P0001, not 42501 (the only 42501 is
  `authentication_required` from `_require_onboarding_complete_v1`).

## Round 2 (dt_4147fdcb86bf, 2026-11-05) &mdash; done
1. `src/modules/organiser/shared/__tests__/refusalCodes.live.test.ts`: reads the JSON; same copy
   rule as the guard plus a next-step rule (imperative verb at sentence start / after `, ` `or `
   `then ` `please `, or "you/they can"). Shrink-only `NEXT_STEP_GAPS`: `command:past_date`,
   `team:organiser_not_found` (own copy, no next step). 82 tests green.
2. `src/modules/organiser/p3/__tests__/refusal.screenMatrix.test.tsx`: 33 rows, screen x live
   refusal through the mapping each screen calls, plus source assertions where the defect is the
   wiring. **Red first: 4 rows** (F-10 NewFlow no gate sheet; F-11 a THROWN ticket refusal reaches
   `reasonMessage(null)` = "That did not work"; F-15 `RESULT_COPY.discardFailed` blames the
   connection; F-46 declined card gated on `!orgId`). Those 4 are `KNOWN_GAPS` (shrink-only).
   Not a DOM render (the 390x844 walk is WALKLIST's).
   - Tickets (prod read): `ticket_type_upsert_v1` / `ticket_type_set_status_v1` RAISE nothing and
     return `{ok:false, reason}`; all 18 live reasons have copy in `ticketModel.ts` REASON.
   - F-40: no live door raises a ban refusal (only `auth.users.banned_until` is named). Recorded in
     the JSON `_not_raised_doc`; no row built.
3. `db-contract-check.yml` step 73 runs the canary, then `--live` only when `P3_RULES_DB_URL` is
   set; without it, one `SKIP` line and exit 0. **Not verified** live (needs the secret; lead raises it).

## Still left (out of scope here)
- Per-prose split of bare `permission_denied` (F-20 / F-52 / F-57).
- Admin-repo migration attribution per code.
- The fixes themselves: each deletes its `known_gaps` / `KNOWN_GAPS` / `NEXT_STEP_GAPS` line.

## Earlier "Left" list (round 1, kept for history)
1. `src/modules/organiser/shared/__tests__/refusalCodes.live.test.ts` (reads the JSON; same
   rule as the guard, plus "carries a next step"). Not written.
2. `src/modules/organiser/p3/__tests__/refusal.screenMatrix.test.tsx` (screen x refusal,
   red first on F-10, F-11, F-15, F-46, F-40). Not written. Note F-11 (tickets) and F-40
   (banned) do not raise from the doors scanned here: ticket writes go through
   `_assert_ticket_url_change_p5_v1` / the set_override `passes` rows (all bare
   `permission_denied: ...` prose), and no scanned door raises a ban code &mdash; find
   those doors before building their rows.
3. `--live` in `db-contract-check.yml`: needs owner &mdash; a read-only Postgres URL secret
   (`P3_RULES_DB_URL`). The local `SUPABASE_ACCESS_TOKEN` was rejected (401) by the
   Management API, so live drift was checked by hand only (MCP, 71 = 71).
4. Granularity: bare `permission_denied` (12 doors, ~120 prose variants) is ONE key. Splitting
   it per prose literal (they are listed by the LIVE_SQL with a `literal` column) is the
   F-20 / F-52 / F-57 work.
5. Source-migration attribution per code (brief step 1, admin repo) not done: the admin repo
   was not attached; live bodies were used instead (latest definition = live).
