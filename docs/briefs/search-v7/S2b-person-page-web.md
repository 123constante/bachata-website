# S2b `person-page-web` (Website repo `123constante/bachata-website`, Sonnet)

Branch: `claude/person-page-web`, from main. Handover: `docs/handover/person-page-web.md`.
Read `COMMON.md` first (same folder) and the Website `CLAUDE.md`.

## Task
New public page `/people/:id` (framework route `app/routes/people.tsx`, registered the same way as `app/routes/teachers.tsx`; read how those three routes load data on the server and mirror it). The id is the persona id (the same ids the old teacher, DJ and dancer pages take).
- Layout at 390px: back arrow; round photo; the name once (display name; the existing reads already apply the privacy helpers); a line of role chips ("Teacher · DJ · Dancer") from the roles the person actually has; city and Instagram as the existing pages show them; then TABS, one per role, in the order Teaching, DJ, Dancing (only roles the person has). The first tab is the strongest role (teacher, else dj, else dancer). Tab state lives in the URL hash (`#teaching`, `#dj`, `#dancing`) so a link opens the right tab.
- Tab content REUSES the existing public reads and components of `/teachers/:id`, `/djs/:id` and `/dancers/:id` (find them; do not duplicate queries or render logic; extract shared components if needed, with a minimal diff to the old pages). Each tab ends with a small link "Open full teacher page" (or DJ, dancer) to the old URL.
- A person with ONE role works too (single tab, no tab bar). An unknown or non-public id shows the same not-found treatment as the old pages. The old role pages of a person with more roles gain a small "Also: DJ · Dancer" link row pointing at `/people/:id#...` (this is the only change to the old pages).
- SEO: `/people/:id` is `noindex` and its canonical points to the person's strongest role page, until the owner approves otherwise; it is in no sitemap. Title and meta use the person's name.
- Tests (table-driven, red-first): the 11 role combinations in COMMON.md; single role; hash opens the right tab; unknown id; hidden surname; archived person; tab order; links.
- Walk on a PRODUCTION build at 390x844 and 360x640, then desktop, with fixtures shaped like prod (a 4-role person, a teacher-only, a dancer-only, long names). Screenshots in `docs/screenshots/person-page-web/`; measured numbers (tap target >= 44px, no horizontal scroll, contrast >= 4.5:1).

## Boundaries
Owns: `app/routes/people.tsx`, a person-page module, shared extractions, tests, handover, screenshots. Does NOT touch the search files (`searchEntities.ts`, `useSearchResults.ts`, `searchRpc.ts`, `featureFlags.ts`): slice S2a owns them. Needs no database change (reuses existing reads).
Vercel deploys are capped: push ONCE. Open a bot-authored PR. Stop after the push and report.
