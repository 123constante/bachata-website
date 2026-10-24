# W1 fix-up: PR #978 (claude/invite-w1-join) — make it mergeable

Repo: 123constante/bachata-website. Branch: `claude/invite-w1-join` (PR #978, head 6a805d0b, bot-authored; push to THIS branch, no new PR).
Lane: normal. This is a CI/hygiene fix-up of finished work, not a rebuild. Read `docs/design/978.md` and the PR body first.

## Why this job exists
The PR is functionally complete (tests green, A2 is now APPLIED on prod). Two CI checks are red and the branch is 14 commits behind main (it merges cleanly: verified with `git merge-tree`). Nothing else may change in the join screens.

## Tasks (in this order, one push at the end)
1. **Merge main in**: `git fetch origin main`, `git merge origin/main` (plain merge, no rebase, no force). Expect no conflicts; if there are any, stop and report which files.
2. **`real-data-verified` is red**: the check wants the exact heading `## Verified on real data`. The PR body has `## Verified on real data (required)`. Edit the PR body (`gh pr edit 978 --body-file ...`) so the heading is exact. Keep the rest of the body. While there, update "Needs the orchestrator" and "NOT verified": A2 is now applied (so person-bound shapes exist on prod; the real E2E project may still not carry A2), and record the decision in task 3.
3. **`dancer-area-isolation` is red.** Cause: the PR edits one test row under `src/modules/dancer-app/shell/__tests__/focusChrome.test.tsx` (Not now from `?returnTo=/invite/abc` now returns to the invite). That makes it a DANCER-AREA PR, so rule (a) flags every other changed file and `src/components/account/DancerProfileGate.tsx` (PROTECTED) which W1 must change for the `/invite` exemption.
   **Owner decision (2026-10-24): clear it by allowlisting, not by reverting the behaviour.** In `scripts/dancer-area-isolation-allowlist.json` only:
   - add every changed non-test file the check names as a seam (read the script's output; use the exact paths it prints; keep the existing entry format and the "reason" map style, one dated reason per entry: "W1 invite join (PR #978), owner decision 2026-10-24");
   - move `src/components/account/DancerProfileGate.tsx` out of `protected` (and into seams) with the same reason.
   - Do NOT edit `scripts/check-dancer-area-isolation.mjs`, do not weaken rules (b) or (c), do not add wildcard or prefix entries for source files.
   - Run `node scripts/check-dancer-area-isolation.mjs` and `--self-test` until both exit 0.
   - In the PR body add one line: "The source of truth for this list is `briefs/dancer-rebuild-INTERFACE.md` section 5 on branch arc/briefs-dancer-rebuild; the orchestrator mirrors this change there."
4. **A2 contract check (read-only, no code change unless it differs).** The prod `organiser_invite_preview_v1` returns, for an OPEN person-bound invite: `person = {first_name, avatar_url, city}` (no id) and `prefill = {first_name, city_id}`; a used/revoked/expired invite returns neither; `self_bound` only when the invite has an email. Redeem refusal: `{ok:false, reason:'not_linked'}` (invite stays open, seat NOT granted). Confirm `join/joinApi.ts` and `joinModel.ts` parse exactly these names and nothing else, and that a test pins each (add a small table test if a name is unpinned). A different shape = report it, do not guess.
5. **Run every CI job step** (read `.github/workflows/*.yml`), put the per-job table in the PR body. The PR's own checks must be green after the push except the standing `mergeable` red on main.

## Out of scope (list under "Follow-ups" in the PR body, do not fix)
- the toast close button with no accessible name; the site-wide "Finish your profile" banner on `/invite`.

## Boundaries
Supabase read-only (you will not need it). Never merge or approve. Never `--no-verify`. One push. If you cannot finish, push what is safe and write what is left in the PR body.

## End with
A report in the PR (comment or body): new head sha, the 3 results (merge clean?, heading fixed?, isolation check exit 0?), the per-job table, and "Verified / Not verified".
