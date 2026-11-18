# Review: PR 1770 (claude/onb-c-types), regenerated Supabase types

Reviewed head `da99a9f5b2c85902af6485de8a7899a7532ca0ea` against `origin/main` `f01315f`.
Brief: `docs/briefs/review-onb-c-types-1770.md` (blob 887b8be). ONE round, read-only. No code changed.

## Verdict: PASS WITH NITS

## Hard-tier: n/a

Generated types only (no migration, RPC/ACL, money, saves, routing or cache change in this repo).

## Method

- `git diff origin/main...origin/claude/onb-c-types`: 1 file, +67 / -0.
- I could not read the admin repo `bachata-admin-11april`. This session has no access to it (`add_repo` refused). So I checked shapes against the live prod catalog (project `stsdtacfauprzrdebmzg`) with read-only SELECTs on `information_schema.columns`, `pg_proc` (`pg_get_function_arguments`/`_result`, `prosecdef`, `has_function_privilege`), `pg_constraint` and `pg_class`. I made no writes.
- I read CI check runs for PR 1770 at the head SHA.

## Findings

### 1. Additive only: PASS
Every hunk is an insertion. No existing type was changed or removed.

### 2. Shapes match prod: PASS
`src/integrations/supabase/types.ts` at the PR head:

| Line | Type | Prod |
|---|---|---|
| 680-717 | `buyer_onboarding_reminders` Row/Insert/Update | `order_id uuid NOT NULL` (PK, FK -> `ticket_orders.id` ON DELETE CASCADE, so `isOneToOne: true` is right); `reminder_status text NOT NULL`, no default (required on Insert, right); `skip_reason text NULL`; `attempts int NOT NULL DEFAULT 0` (optional on Insert, right); `claimed_at`, `reminder_sent_at timestamptz NULL`; `updated_at timestamptz NOT NULL DEFAULT now()`. All 7 columns match. |
| 15239 | `buyer_onboarding_reminder_claim_v1` `{p_limit?: number; p_now?: string} -> Json` | `(p_limit integer DEFAULT 25, p_now timestamptz DEFAULT now()) -> jsonb`. Match. |
| 15243 | `buyer_onboarding_reminder_set_v1` `{p_order_id; p_skip_reason?; p_status} -> boolean` | `(p_order_id uuid, p_status text, p_skip_reason text DEFAULT NULL) -> boolean`. Match. |

### 3. Nothing exposed that should not be: PASS
- `buyer_onboarding_reminders` has RLS on, with no SELECT for `anon` or `authenticated`. Its columns are statuses and timestamps, with no personal data.
- `claim_v1` and `set_v1` are SECURITY DEFINER with no EXECUTE for `anon` or `authenticated`, so only the service role can call them. Their names appearing in generated types grants nothing. The generator lists every function in `public`, as it already does for existing service-only functions such as `ticket_orders_sweep_v1`.
- The diff contains no secrets, keys, emails or personal values.

### 4. CI `types-drift` at head: PASS
`types-drift` job 134503469851 completed with `success` on `da99a9f`. All 48 check runs on the head are `success` or `skipped`. `mergeable_state: clean`.

## Nits

- **N1. Scope is wider than the title and brief say.** The regen also brings in types from earlier migrations. Each one is additive and matches prod:
  - `dancer_profiles.buyer_roles: string[]` at lines 1262/1300/1338. Prod is `text[] NOT NULL DEFAULT '{}'`, so it is required on Row and optional on Insert/Update.
  - `ensure_my_dancer_profile_v1` (15495, `() -> jsonb`, authenticated only).
  - `set_my_buyer_roles_v1` (17630, `(text[]) -> text[]`, authenticated only).
  - `_buyer_roles_for_order_v1` (11051, `(p_status text, p_buyer_user_id uuid) -> jsonb`, service only).
  - `_ticket_pace_days_to_go_v1` (12848, `(date, timestamptz) -> integer`, service only).
  - `ticket_pace_v1` (17972, `(p_organiser_id uuid, p_event_series_id uuid = NULL, p_occurrence_id uuid = NULL) -> jsonb`, authenticated only).

  `main` already calls `ensure_my_dancer_profile_v1`, `set_my_buyer_roles_v1` and `buyer_roles` (slices A and B), so this regen closes real drift. Suggest the title or commit body say "plus slice A/B and ticket_pace types".
- **N2. The PR 1770 body still has every `TO FILL` placeholder.** The PR changes no UI path (`.ts` only), so the `## Phone QA` section should be deleted. The `## Verified on real data` lines still need filling before merge, or auto-merge will refuse.
- **N3 (informational).** `reminder_status` and `skip_reason` are typed `string`, not unions. The values are limited by CHECK constraints (`queued|sent|skipped|failed`; `profile_complete|order_not_paid|night_cancelled|no_ticket_codes`) that the generator does not reflect. Any website code that reads these should narrow them itself. Today no website code reads them.

## Not verified

- I did not read the admin migration file `20261118003850_buyer_onboarding_reminder_v1.sql` itself, because the admin repo is not reachable from this session. I checked the deployed catalog instead, which is the source `types-drift` compares against.
- I did not regenerate the types locally. That job is covered by the green `types-drift` run.
