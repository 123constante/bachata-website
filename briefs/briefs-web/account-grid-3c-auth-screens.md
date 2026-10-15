# Brief: Website slice 3c - auth screens (D7 code persistence + 5-wrong cap, D8 consent, funnel, a11y)

Repo `123constante/bachata-website`. Work ONLY on sub-branch `claude/account-grid-3c`, created from
`origin/claude/account-grid` (head b58f39d, Website PR #775 "account system (Website)"). You are its only writer.
Do NOT open a PR and do NOT push `claude/account-grid`: the orchestrator merges your branch into it.

## Other workers (do not touch their files)
- Slice 3a+3d (running now, branch `claude/account-grid-3ad`): `src/pages/AccountSettings.tsx`,
  `src/pages/AccountDeleted.tsx`, `src/lib/accountSettings.ts`, new `src/lib/accountDeletion.ts`, sign-out code,
  and ONE call in `src/lib/accountRouting.ts` (`signInLanding`).
- Slice 3b (later): owns the rest of `src/lib/accountRouting.ts`, landing / invite card / re-entry, `/app/welcome`.
- You own ONLY the sign-in / sign-up code-entry screens and their helpers (find them: grep `signInWithOtp`,
  `verifyOtp` under `src/`), plus new files you create. If a needed change sits in a file above, STOP and write it
  in the handover's "left" list instead.
- A separate session is planning the organiser area: never touch `src/modules/organiser/**` or organiser routes.

## Read first
- Admin repo `123constante/bachata-admin` branch `arc/briefs-dancer-rebuild`
  (`git fetch https://github.com/123constante/bachata-admin arc/briefs-dancer-rebuild`, then `git show FETCH_HEAD:<path>`):
  `briefs/dancer-rebuild-COMMON.md`.
- Admin repo branch `claude/account-system-db` (admin PR #820, NOT applied to prod yet): the LAST migration defining
  `record_auth_funnel_step_v1` (grep `supabase/migrations/2026112*` for `FUNCTION public.record_auth_funnel_step_v1`;
  files 20261122190000, 250000, 330000 touch it) - its pinned step and outcome lists are YOUR contract. And
  `docs/handover/account-system-2c.md`.
- Admin `origin/main` `supabase/migrations/20261121150000_member_consents_export_extras_v1.sql`: `accept_terms_v1`
  (LIVE on prod) - argument names and return keys.
- Website: `CLAUDE.md`, `docs/account-system/{DECISIONS,JOURNEY-GRID}.md`, the journey grid (`check:journey-grid`),
  `src/modules/dancer-app/screens/onboarding/notes.tsx` (the `TODO(1b): accept_terms_v1` line).

## Owner decisions (fixed, do not reopen)
- D7: the code box survives a page reload for 10 minutes (store e-mail + sent-at in sessionStorage, person-scoped key
  that the D1 sign-out clear also removes - name the key so 3a's clear-list can include it, and write the key name in
  the handover). After 5 wrong codes the box locks and shows "Send a new code"; sending a new code resets the count.
- D8: one-line clickwrap under the code box at sign-UP ("By continuing you agree to the Terms and Privacy Policy",
  both linked); on success call `accept_terms_v1`. Existing accounts with no acceptance get a one-tap accept card on
  next sign-in (one button, no scroll wall). Resolve the notes.tsx TODO.
- Funnel: new `src/lib/trackAuthStep.ts` calling `record_auth_funnel_step_v1` with ONLY the pinned step/outcome
  values (a typed union generated from the SQL list, plus a contract test that fails if the SQL list and the union
  differ). Fire-and-forget: a failed or missing RPC (it is not on prod until #820 is applied) must NEVER block or
  slow sign-in; swallow and move on. No e-mail or personal data in the call.
- a11y: code input `autocomplete="one-time-code"`, `inputmode="numeric"`, label, errors in an `aria-live` region,
  focus moves to the code box after send; axe clean on each screen.

## Verify (definition of done)
- Unit tests, table-driven: reload within / after 10 min, wrong 1..5 then locked, resend resets, consent called once
  on sign-up only, existing-unaccepted shows the card, funnel RPC missing / erroring / ok never blocks. Red-first
  against the base branch: quote old-fails / new-passes output.
- Grid rows for these journeys gain real `covered_by` refs; `check:journey-grid` green.
- Every step of every `.github/workflows` job you can run in the sandbox (lint chain, typecheck, unit,
  `npm run build` PRODUCTION build, journey grid, bundle budget, axe/playwright if available): command + exit code
  table in `docs/handover/account-grid-3c.md`. GitHub Actions may be refused by billing; your table is the fallback.
- A 390x844 Playwright screenshot of each changed screen state (send, code, wrong x5 locked, consent line,
  one-tap accept card) against mocked responses, saved under `docs/handover/shots-3c/`.
- Handover `docs/handover/account-grid-3c.md`: done / left / next steps, Verified / Not verified.

## Rules
Plain git only (`git fetch`, `git show`, `git push`), never `gh api`. Supabase READ-ONLY (SELECT, counts, no personal
data). Never merge, approve or `--no-verify`. Shell commands without variables, loops or `$(...)` where a plain
command works. Push once at the end, subject ending `[worker-done <ticket>]`. Context: at 25% start nothing new; by
30% push with `PARTIAL [worker-done <ticket>]` and the handover's "left" list.
