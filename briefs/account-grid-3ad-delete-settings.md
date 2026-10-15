# Brief: Website slice 3a + 3d - sign-out, settings, delete = hide, restore (account system Website PR)

Repo `123constante/bachata-website`. Work ONLY on sub-branch `claude/account-grid-3ad`, created from
`origin/claude/account-grid` (head b58f39d, Website PR #775 "account system (Website)"). You are its only writer.
Do NOT open a PR and do NOT push `claude/account-grid`: the orchestrator merges your branch into it.

## Read first
- Admin repo `123constante/bachata-admin` branch `arc/briefs-dancer-rebuild` (`git fetch https://github.com/123constante/bachata-admin arc/briefs-dancer-rebuild`
  then `git show FETCH_HEAD:<path>`): `briefs/dancer-rebuild-COMMON.md`, `briefs/account-system-pr2.md`.
- Admin repo branch `claude/account-system-db` (admin PR #820, NOT applied to prod yet): `docs/review-packs/account-system-db/PR-BODY.md`
  ("Before apply (owner)" step 0 is YOUR contract), `docs/runbooks/account-delete-hide.md`, and the SQL of
  `my_account_delete_v1`, `my_account_restore_v1`, `my_account_deletion_status_v1`, `my_account_erase_check_v1`
  in `supabase/migrations/2026112[12]*` (grep `CREATE OR REPLACE FUNCTION public.my_account_`; the LAST file that
  defines a function wins). Also `supabase/functions/account-erase/index.ts` there (response codes).
- Website: `CLAUDE.md`, the journey grid (`check:journey-grid`, rows `ac.delete.hide`, `ac.delete.restore-30`,
  `ac.delete.after-30`, `ac.delete.refused-sole-owner`, `ac.delete.admin-erase`), `src/pages/AccountSettings.tsx`,
  `src/pages/AccountDeleted.tsx`, `src/lib/accountSettings.ts`, `src/lib/accountRouting.ts`.

## Owner decisions (fixed, do not reopen)
- Delete = the person is HIDDEN from everyone at once. Signing in within 30 days RESTORES it. After 30 days it stays
  hidden and is KEPT, never auto-erased. A full erase (GDPR) is by request to the contact address `/privacy` names.
- An admin archive wins: restore never un-hides an admin-archived profile.
- D1 sign-out clears all person-scoped keys (localStorage/sessionStorage/query cache). D6 sign-out = this device, plus
  "Sign out of all devices" in settings (`supabase.auth.signOut({ scope: 'global' })`).

## Build
3a. Sign-out (D1) + settings "Sign out of all devices" (D6).
3d. New `src/lib/accountDeletion.ts` exporting (PINNED, slice 3b will import it):
    `deletionLanding(status) -> 'restore' | 'deleted-card' | null` where `status` is the parsed result of
    `my_account_deletion_status_v1` (`none` -> null; `pending` (restore_until) -> 'restore'; `expired` (deleted_at) ->
    'deleted-card'). Plus `fetchDeletionStatus()`, `restoreAccount()` wrappers.
    - Delete screen under `/account/settings/delete`: copy says "Your profile is hidden now. Sign in within 30 days to
      undo. After that it stays hidden; ask us at <contact> for a full erase." Never "erased", "permanent", "cannot be
      undone", "photos are gone". Rewrite `AccountSettings.tsx` lines ~313 and ~398-402 and `AccountDeleted.tsx` 13-15
      to match. `accountSettings.ts` (~77-92) must stop treating `ok:true` as erased.
    - Error mapping, each with its own human message: `admin_account` (403), `sole_organiser_owner` (409, list the
      blockers), `already_archived` (409), `rate_limited` (429), unknown -> generic with retry.
    - Restore banner after sign-in: one call site in `accountRouting.ts` (`signInLanding`) calls `deletionLanding()`;
      'restore' -> call `restoreAccount()` and show "Welcome back, your account is restored"; restore code
      `admin_archived` -> "An admin has hidden this profile; contact us"; 'deleted-card' -> card "This account was
      deleted on <date>" with two actions (ask us to restore / ask us to erase), both to the `/privacy` contact.
    - Drop `erase_requested_at` from the dancer-app types.
    Slice 3b (later, another worker) owns the rest of `accountRouting.ts`; keep your edit there to that one call.

## Verify (definition of done)
- Unit tests, table-driven over every status x code shape (none, pending, expired, each refusal code, restore
  admin_archived, network error), red-first against the base branch: quote old-fails / new-passes output.
- Contract test pinning the RPC names and JSON keys you read from the #820 SQL (cite file + line), so a renamed key
  fails CI.
- Grid rows `ac.delete.*` gain real `covered_by` refs; `check:journey-grid` green.
- Every step of every `.github/workflows` job you can run in the sandbox (lint chain, typecheck, unit, `npm run build`
  production build, journey grid, axe/playwright if available): command + exit code table in
  `docs/handover/account-grid-3ad.md`. GitHub Actions may be refused by billing; your table is the fallback.
- A phone-size (390x844) Playwright screenshot of each changed screen against mocked RPC responses, saved under
  `docs/handover/shots-3ad/` (real-DB check is the orchestrator's, after #820 is on a branch DB).
- Handover `docs/handover/account-grid-3ad.md`: done / left / next steps, Verified / Not verified.

## Rules
Plain git only (`git fetch`, `git show`, `git push`), never `gh api`. Supabase READ-ONLY (SELECT, counts, no personal
data). Never merge, approve or `--no-verify`. Shell commands without variables, loops or `$(...)` where a plain
command works. Push once at the end, subject ending `[worker-done <ticket>]`. Context: at 25% start nothing new; by
30% push with `PARTIAL [worker-done <ticket>]` and the handover's "left" list.
