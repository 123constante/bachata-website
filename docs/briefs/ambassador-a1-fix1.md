# A1 fix round 1: PR #1086 (branch claude/ambassador-a1-build)

Continue on the SAME branch. Read first: `docs/reviews/review-1086-r1.md` on branch `claude/review-1086-r1` (fetch it; it is the independent review, verdict BLOCK). Also `docs/design/ambassador-a1.md` (mockup B is the design truth). Website repo: no migrations, no `supabase/**`.

Lane: normal. Model: Opus. Fix ONLY the items below, nothing else. Add a "Fix round 1" section to `docs/design/ambassador-a1-build.md`.

## Must fix
1. **F1 (BLOCK).** The page gates on `admin_get_my_city_scopes()`, which reads `admin_manager_city_scopes`. Ambassadors live in `entity_members` (entity_type 'city', member_role 'ambassador'). Prod re-read by the orchestrator: scopes table 1 row (not an ambassador), 0 ambassadors. Replace the scope source with a direct read under the user's session: `from('entity_members').select('entity_id, cities(id,name,slug)')` filtered `entity_type='city'`, `member_role='ambassador'`, `user_id = auth user id` (policy `entity_members_select` allows own rows). Check the real column names of `entity_members` and the join from the generated types/other call sites in `src` before writing it; if the join does not work, do two reads (members, then cities by id). Never call `admin_get_my_city_scopes` again.
   - A permission refusal from the list RPC (`admin_only`, `not_authori*`) must render the NO-ACCESS state, not "Could not load the queue / check your connection".
   - Harness (`__tests__/harness.tsx`) must answer the NEW source, and add cases: member of Bristol -> queue; empty member list -> no access; list RPC raises `admin_only` -> no access; two cities -> both queried.
2. **F2.** `/organisers/<id>` 404s for a pending row (server loader has no session). Remove the "Preview public page" link and the sentence "Open the public page to check it before you decide". The bare-organiser review must say what IS known (name, city, waiting time) and that there is nothing more to show; keep Approve/Reject usable.
3. **F3.** Map `authentication_required` and 401/`JWT expired` to a "You are signed out. Sign in again" message (with a Sign in link to `/auth?returnTo=...` using whatever the AuthGuard uses). On `gone`, remove the item locally as success does and make the sentence true ("It has been taken off your list."). Add the table-driven test rows for these.
4. **F5.** Show the currency from `price_currency` (parse it; NULL means mixed: show no symbol amount, say "mixed currencies"). Fix the organiser fixture to the live shape (`organiser_names` null, `next_occurrence_dates` null, `future_occurrence_count` null, `has_flyer` null) and test the real no-extras screen. The "first N" 100-cap copy must count per city, not across cities. Pin `now` in the harness.
5. **F6.** Remove or make true each copy that points at a missing control: no-access "Check you are signed in with the right account" (add a working Sign out link, or drop the sentence). Replace the raw `⚠` in `QueueViews.tsx` with an HTML entity / JSX escape per the repo's mojibake rule.

## Do not do
Do not touch the DB or admin repo. Do not change the queue ordering, the reason rules, or the routing. Skip F4 noindex, F7 and the minor items; list them under "Not done" in the design record.

## Gates
Run the ambassador unit tests and the e2e spec (`tests/e2e/ambassador-queue.spec.ts`; update its stubs to the new scope read), lint, typecheck. Push to the branch (one push). The vendor-supabase bundle-budget red and the DB Contract Check og-render red already fail on `main`: do not chase them; say so in the PR body table.
