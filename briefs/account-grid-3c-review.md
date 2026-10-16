# Brief: independent review of Website slice 3c (auth code screens, consent, funnel) - read-only

Repo `123constante/bachata-website`. Review branch `claude/account-grid-3c` head dd1fe33c against its base
`claude/account-grid` b58f39d (`git diff b58f39d dd1fe33c`). Create YOUR OWN branch `claude/account-grid-3c-review`
from dd1fe33c; change NO code. Commit only `docs/review-packs/account-grid/REVIEW-3C.md`.

## Read first
- Slice brief: Website `arc/briefs-dancer-rebuild` `briefs/briefs-web/account-grid-3c-auth-screens.md` (owner decisions D7,
  D8, funnel, a11y) and the worker's handover `docs/handover/account-grid-3c.md` (its Left 1-5).
- Admin repo `123constante/bachata-admin`: branch `claude/account-system-db` (PR #820) last migration defining
  `record_auth_funnel_step_v1`; `origin/main` `supabase/migrations/20261121150000_member_consents_export_extras_v1.sql`
  (`accept_terms_v1`) and whatever defines `_dancer_area_require_v1`.

## Review for (blocking = a real person is stuck, misled, or a sign-in is slowed/blocked)
1. D7: reload within 10 min keeps the code box; after 10 min it does not; 5 wrong -> locked + "Send a new code"; resend
   resets. The sessionStorage key is person-scoped AND cleared by sign-out (3a's clear-list lives on branch
   `claude/account-grid-3ad`, `src/lib` sign-out code): name the key and say whether 3ad's clear covers it. If not,
   that is a cross-slice SHOULD with the exact line to add.
2. D8: clickwrap only at sign-UP; `accept_terms_v1` called once, on success only, with the right argument names/
   version; the one-tap accept card for existing unaccepted accounts. Left 4: when the dancer area is closed for that
   person, `accept_terms_v1` refuses, so does the card reappear on EVERY sign-in with a button that can never work?
   (owner rule: a control that cannot work is disabled WITH a reason, or not shown). Rate this.
3. Funnel: only pinned step/outcome values; a missing or erroring RPC never blocks or delays sign-in (check awaits and
   timeouts); no e-mail or personal data sent.
4. a11y: one-time-code autocomplete, numeric inputmode, label, aria-live errors, focus after send.
5. Files touched: only the auth screens + new files; nothing in 3ad's files, `accountRouting.ts` or
   `src/modules/organiser/**`.
6. Tests: would each FAIL on the base? table-driven? any test that only asserts a mock?
7. `TERMS_VERSION` vs the version constants in Website PR #762 (branch `claude/site-legal-pages`): equal?

## Output
`REVIEW-3C.md`: VERDICT line (CLEAN / N blocking), findings ranked blocking / should / note, each with file:line,
failure scenario, one-paragraph fix; then "Checked and fine". Final commit subject ending `[worker-done <ticket>]`,
push YOUR branch only. Then stop.

## Rules
Plain git only, never `gh api`. Supabase READ-ONLY. Never merge/approve/`--no-verify`. Shell commands without
variables, loops or `$(...)` where a plain command works. At 25% context start nothing new; by 30% push
`PARTIAL [worker-done <ticket>]`.
