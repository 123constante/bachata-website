# Brief: #762 /privacy wording must match the owner's deletion decision

Repo: 123constante/bachata-website. Branch: `claude/site-legal-pages` (PR #762). Push to it only.
Read first: `docs/review-packs/site-legal-pages/HANDOVER.md` and `PR-BODY.md` on the branch, and `src/pages/Privacy.tsx`
(plus `src/pages/Terms.tsx` and any version constant the PR added).

## Owner decision (2026-10-15, binding; supersedes any earlier "erased immediately" / "no grace period")
When a person deletes their account:
- it is HIDDEN from everyone at once (profile, name, photo no longer shown anywhere public);
- signing in again within 30 days RESTORES it;
- after 30 days it stays hidden and the data is KEPT (not erased automatically);
- a person who wants their data permanently erased asks for it (UK GDPR / GDPR Art. 17 right to erasure) at the contact
  address the page already gives; the site team erases it by hand and confirms.

## Task
1. Rewrite every sentence in /privacy (and /terms, if it mentions deletion or retention) so it says exactly the above, in
   plain words a dancer understands. Remove any "erased immediately", "permanently deleted when you delete", or a fixed
   erase period. Keep the retention section honest: account data is kept until the person asks for erasure.
2. If the PR has a policy version / "last updated" constant, bump it (the wording changed).
3. A unit test that fails on the old text: render /privacy and assert it contains "30 days" and the erasure-request
   sentence, and does NOT contain "immediately" next to delete/erase. Paste the red on the unfixed text.
4. New 390x844 screenshot of the changed section into `docs/review-packs/site-legal-pages/`.
5. Update `PR-BODY.md` (keep the sections "## Phone QA" and "## Verified on real data" valid for
   `scripts/check-pr-phone-qa.mjs` and the real-data check) and `HANDOVER.md`.

## Gates (CI without paying GitHub)
Billing annotations ("payments have failed / spending limit") are not code failures. Run every pull_request job step in
`.github/workflows/` your sandbox can run (unit tests in the 3 timezones, typecheck, lint, isolation, integrity, phone-qa,
`npm run build` PRODUCTION build) and put a per-job table (command, exit code) in HANDOVER.md.

## Rules
- Plain git for read and push. NEVER `gh api`, never `gh pr edit` (the orchestrator copies PR-BODY.md into the PR).
- Shell commands without variables, loops or `$(...)` where a plain command works.
- Never merge or approve. Never `--no-verify`. Supabase READ-ONLY.
- Touch only the legal pages, their tests and the review-pack folder. Other workers own #761 and #765 and #764.
- Context: at 25% start nothing new; by 30% push + handover with `PARTIAL [worker-done <ticket>]`.
