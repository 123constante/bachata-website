# Brief: Website slice 3b - landing, invite card, re-entry, `/app/welcome`, `accountGate.ts`

Repo `123constante/bachata-website`. Work ONLY on sub-branch `claude/account-grid-3b`, created from
`origin/claude/account-grid` (Website PR #775 "account system (Website)"; it now holds slices 3a+3d and 3c merged:
take its CURRENT head and write that SHA in your handover). You are its only writer. Do NOT open a PR and do NOT push
`claude/account-grid`: the orchestrator merges your branch into it.

## Other work (do not touch these files)
- Slices 3a+3d and 3c are DONE and merged: `src/pages/AccountSettings.tsx`, `AccountDeleted.tsx`, `AccountRestore.tsx`,
  `AuthCallback.tsx`, `Auth.tsx`, `src/lib/accountSettings.ts`, `accountDeletion.ts`, `accountDeletionCopy.ts`,
  `termsConsent.ts`, `trackAuthStep.ts`, `personScopedStorage.ts`, `src/components/MagicLinkConfirmation.tsx`.
  Read them; change them only for a one-line call into your new code, and list every such line in the handover.
- AuthCallback already runs the deletion check FIRST on every sign-in (incl. `returnTo`) and records sign-up consent.
  Do not duplicate either; your landing logic runs AFTER it.
- A separate session is planning the organiser area: never touch `src/modules/organiser/**` or organiser routes. It
  relies on you for ONE export (below) and on this rule: a soft-deleted login is routed to restore / deleted card
  BEFORE any area renders.

## You own
`src/lib/accountRouting.ts` (all of it, incl. `signInLanding` and the "Continue as" list), the landing after sign-in,
the team-invite card, re-entry, `/app/welcome`, and NEW `src/lib/accountGate.ts`.

## Pinned interface (promised to the organiser session; do not change the shape)
NEW `src/lib/accountGate.ts` exporting
`useAccountGate(): { status: 'loading'|'signed-out'|'deleted'|'incomplete'|'complete', dancerProfileId: string|null,
deletion: 'restore'|'deleted-card'|null }` - a thin composition of the existing `useProfileCompletion`
(`src/hooks/useProfileCompletion.ts`) and 3d's `fetchDeletionStatus()` / `deletionLanding()` (`src/lib/accountDeletion.ts`),
plus a non-hook `fetchAccountGate(): Promise<same shape minus 'loading'>`. `signInLanding` uses it. No new RPC.
`status: 'deleted'` whenever `deletion` is not null; it wins over every other state.

## Read first
- Admin repo `123constante/bachata-admin` branch `arc/briefs-dancer-rebuild`
  (`git fetch https://github.com/123constante/bachata-admin arc/briefs-dancer-rebuild`, then `git show FETCH_HEAD:<path>`):
  `briefs/dancer-rebuild-COMMON.md`.
- Website: `CLAUDE.md`, `docs/account-system/{DECISIONS,ACCOUNT-MODEL,JOURNEY-GRID}.md`, the grid
  (`check:journey-grid`), `docs/handover/account-grid-3ad.md`, `docs/handover/account-grid-3c.md` and
  `docs/handover/account-grid-merge-3ad-3c.md` (their "left" lists name anything waiting for 3b).

## Owner decisions (fixed, do not reopen)
- Landing after sign-in: deleted -> restore / deleted card (already done by AuthCallback; keep it first). Empty account
  (no dancer profile, no organiser page) -> `/app/welcome` dancer setup. Organiser-intent finished dancer -> organiser
  claim screen. 2+ organiser pages -> "Continue as" list. Otherwise the area they came from (`returnTo`) or home.
- O3 team invite is a BEARER link: whoever is signed in joins; the card says "Joining as <name>" with
  "Not you? Sign out". No e-mail match required.
- D2 admin as today (no change to admin routing).
- D3/D4 onboarding uses `replace` navigation (Back never returns into setup) and ends on an end card; a finished
  dancer opening `/app/welcome` sees the end card, never the setup again.
- Re-entry: a half-finished setup resumes at the first missing step, not at the start.
- Out of scope (later, separate PRs): `/join/:token` dancer invite (PR-4), dropping `erase_requested_at` (the
  dancer-area isolation guard forbids it here), Turnstile.

## Verify (definition of done)
- Table-driven unit tests over the landing matrix: {signed-out, deleted<30d, deleted>30d, empty, dancer incomplete,
  dancer complete, organiser 1, organiser 2+, organiser-intent, admin} x {no returnTo, returnTo}. `useAccountGate` and
  `fetchAccountGate` return the same answer for each row (one mapping, not two copies). Invite card for signed-in /
  signed-out. Red-first against the base branch: quote old-fails / new-passes output.
- Grid rows for these journeys get real `covered_by` refs; `check:journey-grid` green.
- Run every step of every `.github/workflows` job you can run in the sandbox (lint chain, typecheck, unit,
  `npm run build` PRODUCTION build, journey grid, bundle budget, first-load requests, axe/playwright if available).
  Put a command + exit code table in `docs/handover/account-grid-3b.md`. GitHub Actions may be refused by billing;
  your table is the fallback. Vitest: use `--pool=forks` if the default pool hangs; never `git stash` mid-run.
- A 390x844 Playwright screenshot of each changed screen state (welcome setup, end card, Continue-as list, invite
  card signed-in and signed-out, resume step) against mocked responses, under `docs/handover/shots-3b/`.
- Handover `docs/handover/account-grid-3b.md`: done / left / next steps, Verified / Not verified, the exact exported
  names in `accountGate.ts`.

## Rules
Plain git only (`git fetch`, `git show`, `git push`), never `gh api`. Supabase READ-ONLY (SELECT, counts, no personal
data). Never merge, approve or `--no-verify`. Shell commands without variables, loops or `$(...)` where a plain
command works. Push once at the end, subject ending `[worker-done <ticket>]`. Context: at 25% start nothing new; by
30% push with `PARTIAL [worker-done <ticket>]` and the handover's "left" list.
