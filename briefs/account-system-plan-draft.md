# Brief: production-grade account system, PLAN DRAFT (read-only research, docs only)

Repo: 123constante/bachata-website (and read-only: 123constante/bachata-admin for edge functions, RPCs, migrations).
Output branch: `claude/account-system-plan` (new, from `claude/journey-matrix`). Docs only: write
`docs/account-system/` files. Change nothing in `src/`, `tests/`, `supabase/`. No PR.

## Why (owner's words, 2026-10-15)
"What do I need to prompt you so we can have the most production grade flow for all of this... I feel like we are
doing bits by bits." The owner wants how professional platforms (Google, Slack, Notion, Meta Business) do accounts:
one login, many profiles, one written model that every screen and test is derived from.

## Read first
- `docs/review-packs/public-journeys/MATRIX.md` (on your base branch): the gap analysis and owner decisions.
- `docs/journeys/public-entry-journeys.md`, `docs/review-packs/public-journeys/HANDOVER.md`, `WALK.md`.
- `src/lib/accountRouting.ts`, `src/pages/Auth.tsx`, `src/pages/AuthCallback.tsx`, the gates, invite/claim modules.
- Admin repo (git fetch it read-only): the auth hook `hook_before_user_created_v2`, edge functions
  `account-erase-due`, `dancer-invite-send`, the account lifecycle / erase RPCs, `profile_complete_v1`.

## Owner decisions already made (binding)
F2 organiser-intent finished dancer -> organiser claim screen. 2+ organisers -> "Continue as" list. Team invite by a
different signed-in person -> bearer joins, card names who, "Not you? Sign out". No deletion grace period: erase now,
re-sign-up = new person. Empty account -> dancer setup. Dancer invite e-mail -> dancer link + claim. E-mail code is
tested on a Supabase branch/test project reading the OTP. Every grid row a real account can hit is tested and walked
before merge.

## Deliverables (each its own file in docs/account-system/)
1. `ACCOUNT-MODEL.md`: the one written model. Entities (account/login, dancer profile, organiser page, team
   membership, organiser request, admin), every account STATE and every TRANSITION (what triggers it, which RPC/
   screen does it, what the person sees), who may switch to what. A state diagram (mermaid). Mark each item BUILT
   (file:line), PARTIAL or NOT BUILT. Never invent a rule that contradicts a decision above; where there is no
   decision, mark DECISION NEEDED with a recommended default and the reason, citing how a professional platform does it.
2. `JOURNEY-GRID.md`: the grid DERIVED from the model (entry x state x action -> END), superseding MATRIX.md's rows,
   with a stable row id each, and a machine-readable copy `journey-grid.json` (id, entry, state, action, end,
   covered_by) shaped so a CI check can fail when a row has no test or walk. Propose (do not build) that check.
3. `GAPS.md`: what professional account systems have that we do not, each with severity, people affected (prod
   COUNTS ONLY via the Supabase connector, read-only SELECTs), and a recommended fix:
   security (OTP attempt/resend limits, link expiry/reuse, session lifetime, sign out everywhere, e-mail change,
   account takeover, rate limiting, bot protection), privacy (shared device, deletion, data export/GDPR access,
   consent records), staged rollout (feature switch, percent rollout, kill switch for sign-up), observability
   (sign-up funnel per step, redirect-loop and error alerts, Sentry tags), accessibility (keyboard, screen reader,
   focus on code entry), e-mail deliverability (SPF/DKIM/DMARC status of the sending domain if readable).
   Read what already exists before calling something missing (grep both repos).
4. `DECISIONS.md`: every DECISION NEEDED as a click question: question, 2-4 options, recommended first with the
   reason. Group so the owner can answer in at most 3 rounds of 4.
5. `PLAN.md`: PRs in merge order, each split into worker slices with NO shared files, pinned interfaces between
   slices, migrations flagged (admin repo, owner applies), what each PR changes on prod, rough size. #764 merges
   first (already in flight); the plan builds on it.

## Rules
Read-only: never write prod, never open a PR, never `gh api` (plain git). Supabase: SELECT counts only, no personal
data. Shell commands without variables, loops or `$(...)` where a plain one works. Be concrete: file:line refs.
Context: at 25% start nothing new; by 30% push what is done + a handover listing which files are left, last commit
subject ending `PARTIAL [worker-done <ticket>]`.

## Output
Push `claude/account-system-plan`; last commit subject ends `[worker-done <ticket>]`.
