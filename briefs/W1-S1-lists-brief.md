# W1 slice S1: /dancers and /djs lists (Website, Sonnet)

Repo: Website (123constante/bachata-website). Branch: `claude/w1-s1-lists`, created FROM `origin/claude/w1-base`. Handover: `docs/handover/w1-s1-lists.md`. You own ONLY `src/pages/Dancers.tsx`, `src/pages/DJs.tsx`, `src/components/dj/DjTiles.tsx` (+ their tests, + new files under `src/components/dj/` or a new `src/components/dancers/` folder if needed).

## Owner decisions (binding)
/dancers:
- Shows only people who have the Dancer role (via `usePeopleBadges` on the ids the page already loads). Today it shows every dancer_profiles row (S9 counted 92 of 164 dance; check today's number).
- Each tile: name (real name), and on a fixed-height 26px label row pinned to the tile bottom the OTHER roles via `roleTagsFor(badge, {teacherPagesOpen, exclude: 'dancer'})`: "DJ", "Teacher" (Teacher plain text). Labels 12px. 3 columns at 390px, names wrap whole (no cut-off).
- Tile links to the dancer page (unchanged).
- Fix the "??" mojibake in the hero widgets (find the broken characters; replace with the intended symbol or plain text).
- Keeps the default palette (now graphite, from S4).
/djs:
- `gradientPalette="dj"` (near-black, no floating icons, no rounded box around the grid; match `docs/mockups/s12/djs-list-final.png`).
- DJs with an upcoming gig first (by `next_gig_date` ascending; then the rest in today's order), marked "Playing soon" (at least 12px). Use `has_upcoming_gig` / `next_gig_date` from `list_public_djs_v1` (prod: 40 DJs, 17 upcoming).
- Name = `nameFor('dj', ...)` (stage name leads). The "DJ" label ALWAYS shows, even when the name starts with "DJ" (owner choice A).
Real people for the shots: /dancers top + a tile with DJ+Teacher labels; /djs top showing Playing soon tiles, a "DJ ..." name, and Oreo Sensual if listed.

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
