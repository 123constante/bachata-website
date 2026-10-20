# W1 slice S3: organiser team strip, event lineup chip, search person row (Website, Sonnet)

Repo: Website (123constante/bachata-website). Branch: `claude/w1-s3-strips`, created FROM `origin/claude/w1-base`. Handover: `docs/handover/w1-s3-strips.md`. You own ONLY the team strip in `src/pages/OrganiserProfile.tsx` (nothing else in that file), `src/modules/event-page/bento/blocks/schedule/PersonChip.tsx` and the code that feeds it people (`PeopleStack.tsx` / `ScheduleBlock.tsx` only where the person data is built), `src/pages/SearchResults.tsx` person rows and the search row helpers in `src/lib/searchEntities.ts` / `src/lib/searchRpc.ts` (do NOT change `ROLE_LABEL`/`ROLE_ORDER` values or `hrefFor`), + tests. Note: open PR #850 (`claude/search-v7-web`, idle since 2026-10-20 09:24Z) also touches `SearchResults.tsx`; build on main's version and say in the handover how the two would conflict.

## Owner decisions (binding), match `docs/mockups/s12/organiser-final.png`, `lineup-final.png`, `search-final.png`, `teacheronly-final.png`
Organiser team strip (`/organisers/:id`; check whether the route is flag-gated on prod and test with the flag on in your build if it is):
- Name by the name rule (`nameFor`: stage name only where the member is shown as a DJ; else real name), names 14px.
- Labels from `roleTagsFor` (12px, readable contrast; state the ratio); link from `linkFor` (DJ page, else dancer page, else no link). Teacher-only member: no link, never a dead end. Prod has 8 organisers with teams; Unidos Flow is the reference.
Event lineup chip (`PersonChip`, bento event page `/event/:id`; the site passes the LEGACY event id, e.g. Pura Nights Ealing /event/4ec7a3d5...; P5 series ids 404):
- Role text at least 12px (today 9px), name 13px. DJ slots show the stage name. Link from `linkFor`; a teacher-only person has no link.
Search (`/search` and the header overlay if it shares the row helper):
- ONE full-width row per person (not a half-width card). 48px initials circle when there is no photo, never an empty grey box.
- Tags from `roleTagsFor(badge, {teacherPagesOpen, withStageName: true})`: Dancer / "DJ · <stage name>" / Teacher. Roles are always public: the Teacher tag SHOWS (plain) even while teacher pages are off (today `visibleRoles` hides it; change the person row to the mapping, keep `visibleRoles` for anything else that uses it).
- Row link from `linkFor` (check what the row links to today: `/people/:id` has no route; it must never dead-end).
Real people for the shots: Unidos Flow team strip; Pura Nights Ealing lineup (a DJ chip + a teacher chip); search for "Roger", "Oreo" and a teacher-only person.

## Shared base (read first)
Your branch starts FROM `origin/claude/w1-base` (= S0 + S4 merged). Read on it: `docs/handover/w1-s0-badges.md` (the ONE mapping in `src/modules/person-page/badges.ts`: `usePeopleBadges`, `roleTagsFor`, `nameFor`, `linkFor`, `hrefForRole`, `leadRole`; prod survey counts) and `docs/handover/w1-s4-graphite.md` (`gradientPalette` now takes `'dancer'` (teal #06191F) and `'dj'` (near-black #0A080B): static, no floating icons, no black band; `'default'` is now calm graphite). The approved look is mockup round S12: branch `claude/s12-mockups`, `docs/handover/s12-mockups.md`, code `src/modules/person-page/mockups/S12Mock.tsx`, shots `docs/mockups/s12/*-final.png`. Match those shots; mockup code is a reference, never import it.
Rules of the mapping (binding): labels/links/names come ONLY from `badges.ts` (never write "Dancer"/"DJ"/"Teacher" or a `/djs/` `/dancers/` `/teachers/` href yourself on these surfaces); `teacherPagesOpen` = `flags.teacherDetail` (`src/lib/featureFlags.ts`), OFF on prod, so the Teacher tag is plain text and nothing links to `/teachers/`. Stage name leads on DJ things only. Never a dead end. Thin pages: hide empty parts, no "coming soon", no defaults shown as facts. Role labels at least 12px. Owner-out-of-scope: test-looking names on /dancers, teacher flags, teacher contact.
Other slices (do NOT touch their files): S1 lists = `src/pages/Dancers.tsx`, `src/pages/DJs.tsx`, `src/components/dj/DjTiles.tsx`; S2 role pages = `src/pages/DancerProfile.tsx`, `src/pages/DJProfile.tsx`, `src/pages/TeacherProfile.tsx`, `src/modules/person-page/AlsoRoles.tsx`, `src/modules/dancer-app/public-page/*`; S3 strips = `src/pages/OrganiserProfile.tsx` (team strip), `src/modules/event-page/bento/blocks/schedule/PersonChip.tsx` + its feeder, `src/pages/SearchResults.tsx` person rows (+ search row helpers). `badges.ts`, `GlobalLayout.tsx`, `pageGrounds.ts` are FROZEN: if you need a change there, say so in the handover instead.

## Proof (Definition of done)
- Prod shapes (read-only, counts, no personal data in files): use the S0 survey; add the shapes your surfaces meet. Fixtures alone are not evidence.
- Table-driven test per surface over the S0 shapes x teacher flag off/on: label set and link equal the mapping's answer; no `/teachers/` href while off; name rule per context. Show it RED on `origin/main` (or on the unfixed component) first, then GREEN; put commands + results in the handover.
- A phone-size (390x844 and 360x640) e2e or DOM check that fails on the old code where practical.
- PRODUCTION build (`npm run build`, then serve; `NODE_OPTIONS=--max-old-space-size=3072` if needed) against the prod project with the public anon key (read-only). Before/after PNGs at 390x844 in `docs/mockups/w1-<slice>/`, real people (names below). If a route is not prerendered, serve with a proper SPA fallback to `index.html` and CHECK each shot shows the right page (S4's shots all showed the /parties shell: do not repeat that). Measured: no horizontal scroll, tap heights, label px, contrast, `elementFromPoint` on each link.
- Try photos via r2.dev and the `_vercel/image` proxy once; if blocked say so on line 1 of the handover.

## Gates (run ALL; per-job table, command + exit code, in the handover)
Read `.github/workflows/*.yml` and run every job step your sandbox can run (full lint chain, typecheck vs main's baseline count, full unit suite with failures attributed vs main, production build, phone e2e you can run). A GitHub "payments have failed / spending limit" annotation is billing, not code; your table is the evidence. Docker / local Supabase / real phone: NOT RUN with the reason.

## Rules
- Plain git only (`git fetch`, `git show`, `git push`); NEVER `gh api`. Commands without variables, loops or `$(...)` where a plain command works.
- Supabase READ-ONLY (SELECT only). Never touch `.github/workflows`, `.env*`, secrets.
- Push ONCE at the end (Vercel deploy cap). Last commit subject ends `[worker-done <ticket>]`.
- 30% context rule: at 25% start nothing new; by 30% push + handover, last subject ending `PARTIAL [worker-done <ticket>]`. A continuation worker on the same branch reads your handover; that is planned and normal (this slice is planned as author + optional continuation + review + one fix pass).
- Never merge, approve, or open a PR (sub-branch of the W1 PR; the orchestrator merges locally). Stop after the push.

PR BATCHING (docs/pr-batching-policy.md, adapted: sub-branch, no PR)
- ONE branch for this job. Push ONCE when finished. Fix your own mistakes on this branch.
- UI change: follow docs/ui-quality-bar.md; the handover has a ## Phone QA section (viewports, measured overlap / tap size / contrast numbers, or NOT RUN with the reason).
- Never merge or approve. Stop after the push and report.
