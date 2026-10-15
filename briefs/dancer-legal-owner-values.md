# Brief: Website: fill the owner's values into the Terms/Privacy pages (PR #762)

Repo `123constante/bachata-website`. Read the repo's `CLAUDE.md`. Plain git only, never `gh` or `gh api`.
Shell commands without variables, loops or `$(...)` where a plain command works.
Check a PRODUCTION build (`npm run build`), not only the dev server.

BRANCH: `claude/site-legal-pages` (PR #762, open, bot). Push to it. Never merge, never force-push.

## Owner's values (2026-10-15, in chat)
- Operator / legal name: **Bachata Calendar**
- Postal address: **none** ("skip postal address"). Remove the address placeholder and any sentence that needs it;
  do not invent an address. Where a contact route is needed, the e-mail is the route.
- Contact e-mail: **support@bachatacalendar.co.uk** (a real inbox, forwarding verified 2026-10-13). Make it a
  `mailto:` link. Replace the interim Instagram contact link with it (keep Instagram only if it is listed as a
  second, optional channel).

## Task
1. Replace every `[OWNER: ...]` placeholder in `src/**/LegalShell.tsx` and the /terms and /privacy pages; `git grep
   "OWNER:"` must return nothing in `src/`.
2. Update or add the unit test so it asserts: no `[OWNER:` text renders on /terms or /privacy; the name "Bachata
   Calendar" and the mailto `support@bachatacalendar.co.uk` render on both. Red first on the current head (quote it).
3. Run the PR workflow steps you can (read `.github/workflows/*`: lint, typecheck, unit, build, phone specs for
   /terms and /privacy). 390x844 shots of both pages into the PR's existing review-pack folder (or
   `docs/review-packs/site-legal-pages/`).
4. Append to that folder's HANDOVER.md: what changed, a per-job table (command, exit code), Verified / Not verified.

Owned files: the legal pages, LegalShell, their tests, the review-pack folder. Nothing else.
Stop after the push and report.
