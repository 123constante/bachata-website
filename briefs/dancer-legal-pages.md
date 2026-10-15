# Brief: Terms + Privacy pages (Website)

Repo `123constante/bachata-website`. Read `briefs/dancer-rebuild-COMMON.md` and `briefs/dancer-rebuild-INTERFACE.md`
on `arc/briefs-dancer-rebuild` first (`git fetch origin arc/briefs-dancer-rebuild` then `git show FETCH_HEAD:<path>`).
Plain git only, never `gh api`. Shell commands without variables, loops or `$(...)` where a plain command works.
Check a PRODUCTION build (`npm run build`), not only the dev server, before saying a page works.

BRANCH: `claude/site-legal-pages` from `origin/main` (you are its only worker). Open ONE bot PR at the end
(bot token as COMMON says, `gh pr create` is allowed; `gh api` is not).

## Why
The owner opened the dancer area (/app, sign-up, profiles) to the public on 2026-10-15. The site has no Terms of use
or Privacy page. The owner said: "Yes, draft both". The owner reads the text in the review pack before it goes live.

## Other workers right now (do NOT touch their files)
- `claude/dancer-app-routing` owns the account header icon/menu, `accountRouting`, the "Continue as" chooser and the
  switch-profile sheet.
- `claude/site-nav-top` owns `BottomNav.tsx` and the AppChrome spacer.
You own: two NEW page files + their route registration, `src/components/layout/FooterLinks.tsx` /
`GlobalFooter.tsx` (one link each to the new pages), an optional small "By continuing you agree to the Terms and
Privacy" line on the sign-up / onboarding screen ONLY if that file is not one of the files above, tests, and
`docs/handover/site-legal-pages.md`.

## Task
1. `/privacy` and `/terms` pages, plain English, short sections, readable at 390x844, same look as other static pages.
2. Write the Privacy text FROM WHAT THE CODE AND DATABASE REALLY DO (read the Website code and, read-only via the
   Supabase MCP, the table/column names; no personal data, counts only). Cover at least: what an account stores
   (e-mail, dancer profile fields, photo, optional WhatsApp/Facebook and the show-publicly switches, hide surname),
   what is public vs private, profile view counts, nights going/interested, feedback messages, feature-interest
   sign-ups, photo flags, consent records, rate-limit records (kept 30 days), analytics/cookies the site really sets
   (check: Vercel analytics, Sentry, Supabase auth storage), how to download your data and how to delete your account
   (request, 30-day grace, cancel link, then erased), who to contact. Link the real screens (/account/settings or /app
   Options, whichever the code uses today).
3. Terms text: what the site is (a community calendar for bachata in the UK), accounts (one person per account,
   accurate info), acceptable use (no harassment, no impersonation, no spam, photos must be of you), organisers are
   responsible for their events, the site can remove content/accounts that break the rules, no guarantee events
   happen as listed, changes to the terms, contact.
4. Anything you cannot know (legal operator name, postal address, a contact e-mail if none exists in the code) goes in
   as a clearly marked placeholder `[OWNER: ...]` AND is listed in the PR body under "Owner must fill". Never invent a
   company name or address.
5. Version constant: export `TERMS_VERSION` and `PRIVACY_VERSION` (e.g. `2026-10-15`) from one module, matching the
   `accept_terms_v1` version format `^[0-9A-Za-z._-]{1,32}$`. Do NOT call `accept_terms_v1` yet (consent recording is
   release 1b); just show "Last updated <date>" from the same constant.

## Gates (run every CI job step from `.github/workflows/*` in your sandbox)
- Red-first: a route test that /privacy and /terms render their heading and that the footer links to both (paste the
  failing line before your change).
- Placeholder test: every `[OWNER:` placeholder in the pages is listed in the PR body (state count).
- `npm run test` (or the unit suite the workflow runs), `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- GitHub Actions may be refused for billing: put a per-job table (command, exit code) in the PR body.
- 390x844 screenshots of both pages and the footer committed under `docs/handover/legal-shots/`.

## Boundaries
Never merge or approve; read-only prod via MCP; never `--no-verify`; never `gh api`; no migration; no Vercel login.

## Output
PR body + `docs/handover/site-legal-pages.md`: files changed, the full list of data categories you found and where
(table/column or code path), "Owner must fill" list, per-gate table, Verified / Not verified. Last commit subject ends
`[worker-done <ticket>]`.
