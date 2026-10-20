# S2a `search-v7-web` (Website repo `123constante/bachata-website`, Sonnet)

Branch: `claude/search-v7-web`, from main. Handover: `docs/handover/search-v7-web.md`.
Read `COMMON.md` first (same folder), then the Website `CLAUDE.md` and the docs it points at (UI quality bar if present).

## Task
Behind flag `searchV7` (default OFF in `src/lib/featureFlags.ts`, same pattern as `searchV6`): when ON, call `search_public_v7` and render ONE People section.
- `src/hooks/useSearchResults.ts`: pick `search_public_v7` when the flag is on (v7 carries v6's keys, so the level fields still work). Flag off = identical behaviour to today.
- `src/lib/searchRpc.ts` types: add `people` rows per the pinned interface; keep the old keys optional for the flag-off path.
- `src/lib/searchEntities.ts`: one new kind `person` (label Person / People, round avatar, `User` icon), `hrefFor('person', id)` = `/people/${id}`. Do NOT remove the teacher, dj and dancer kinds (other pages use them).
- Result row: round photo, the name, a muted line of role chips in fixed order "Teacher · DJ · Dancer" (only the roles in `roles`), nationality flag exactly as the old people rows do it. No second row for the same person in the header omnibox, the full-screen overlay or the results page.
- Click telemetry: log the old entity kind of `primary_role` (teacher / dj / dancer) so popularity ranking keeps working. No new entity_type.
- Empty state, did-you-mean and counts ("N people") use the new section. Keyboard navigation and screen-reader labels include the roles ("Carlos Mendez, Teacher, DJ, Dancer").
- Tests (table-driven, red-first against current code): the 11 role combinations from COMMON.md as fixture rows; flag off renders the old three sections unchanged; flag on renders exactly one row per person; hrefs; telemetry kind; empty state; a long name at 390px wraps without clipping.
- Walk on a PRODUCTION build (`npm run build`) with Playwright at 390x844 and 360x640, then desktop, with fixtures shaped like prod. Screenshots under `docs/screenshots/search-v7-web/`; measured numbers (tap target >= 44px, no horizontal scroll, contrast >= 4.5:1).

## Boundaries
Owns: the files above, their tests, the handover doc, screenshots. Does NOT create `/people/:id` (slice S2b owns `app/routes/people.tsx` and the person page module) and does not touch `app/routes/teachers.tsx`, `djs.tsx`, `dancers.tsx`. Until `/people/:id` merges the flag stays off, so no dead link is user-visible; say so in the PR body.
Vercel deploys are capped (about 100 a day): push ONCE; a docs-only follow-up carries `[skip preview]`. Open a bot-authored PR. Stop after the push and report.
