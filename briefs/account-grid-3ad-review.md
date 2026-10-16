# Brief: independent review of Website slice 3a+3d (read-only)

Repo `123constante/bachata-website`. Review branch `claude/account-grid-3ad` head 1e2dfb03 against its base
`claude/account-grid` b58f39d (`git diff b58f39d 1e2dfb03`). Create YOUR OWN branch `claude/account-grid-3ad-review`
from 1e2dfb03; change NO code. Commit only `docs/review-packs/account-grid/REVIEW-3AD.md`.

## Read first
- The slice brief: Website `arc/briefs-dancer-rebuild` `briefs/account-grid-3ad-delete-settings.md` (decisions + pinned
  interface), and the worker's handover `docs/handover/account-grid-3ad.md` on the slice branch (its Left 1-6).
- Admin repo `123constante/bachata-admin` branch `claude/account-system-db` (PR #820): the LAST migration defining
  `my_account_delete_v1`, `my_account_restore_v1`, `my_account_deletion_status_v1`, `my_account_erase_check_v1`, and
  `supabase/functions/account-erase/index.ts`. The client must read EXACTLY the keys and codes these return.

## Review for (blocking = a real person sees something wrong or loses data)
1. Every status x code shape maps to the right screen and copy: none / pending / expired; refusals admin_account,
   sole_organiser_owner (blockers listed), already_archived, rate_limited, unknown; restore codes incl.
   admin_archived, restore_window_closed, no_self_delete; network error. Copy never says erased / permanent / cannot
   be undone / photos are gone.
2. Key/code names vs the SQL and edge function (cite both file:line). A renamed key = blocking.
3. D1 sign-out clears every person-scoped key (localStorage, sessionStorage, query cache); D6 global sign-out; the
   `signed-out-locally` path (Left 4) - is the person told other devices may still be signed in?
4. Only ONE edit in `src/lib/accountRouting.ts` (signInLanding); no other slice's files touched.
5. Tests: would each one FAIL on the base? Table-driven over every shape? Any test asserting a mock, not behaviour?
6. Every empty/disabled state says why and what the person CAN do; untouched save sends nothing.
7. The contact address: `src/lib/accountDeletionCopy.ts` `ACCOUNT_CONTACT_EMAIL` is a placeholder
   `privacy@bachatacalendar.co.uk`. The orchestrator decided it must be `support@bachatacalendar.co.uk` (the address
   the /privacy page in Website PR #762 names). Record it as a SHOULD with the exact line.

## Output
`REVIEW-3AD.md`: VERDICT line (CLEAN / N blocking), findings ranked blocking / should / note, each with file:line,
failure scenario and a one-paragraph fix; then "Checked and fine" (one line each). Final commit subject ending
`[worker-done <ticket>]`, push YOUR branch only. Then stop.

## Rules
Plain git only, never `gh api`. Supabase READ-ONLY. Never merge/approve/`--no-verify`. Shell commands without
variables, loops or `$(...)` where a plain command works. At 25% context start nothing new; by 30% push
`PARTIAL [worker-done <ticket>]`.
