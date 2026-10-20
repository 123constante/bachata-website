# W1 slice S2: dancer and DJ pages, the Also bar, Favourite songs (Website, Sonnet)

Repo: Website (123constante/bachata-website). Branch: `claude/w1-s2-rolepages`, created FROM `origin/claude/w1-base`. Handover: `docs/handover/w1-s2-rolepages.md`. You own ONLY `src/pages/DancerProfile.tsx`, `src/pages/DJProfile.tsx`, `src/pages/TeacherProfile.tsx`, `src/modules/person-page/AlsoRoles.tsx` (becomes the Also bar), `src/modules/dancer-app/public-page/*`, the DJ page's own components if they live under `src/components/dj/` EXCEPT `DjTiles.tsx` (S1 owns it), + tests.

## Owner decisions (binding), match `docs/mockups/s12/dancer-*-final.png` and `dj-*-final.png`
Separate role pages (Option 2): the dancer page and the DJ page stay separate, each with its own Share. No combined person page.
Dancer page (`/dancers/:id`):
- `gradientPalette="dancer"` (deep teal, no floating icons, no black band).
- Also bar: ONE row of equal-height chips (min 44px tall) in the page top area, aligned to the card edges, from `roleTagsFor(badge, {teacherPagesOpen, withStageName: true, exclude: 'dancer'})`. Linked chips are filled in the colour of the page they open (DJ: gold/near-black, reads "DJ · <stage name>" when set) with a small arrow; non-linked roles (Teacher while the flag is off) are plain outlined tags, same height, NOT italic, NOT faded. No bar when there are no other roles. It REPLACES the live "Also: DJ" row from PR #851.
- Favourite songs restored, INSIDE the card, styled like the Achievements block, above "Dance bachata too?". Hidden when the person has none. This changes the owner's F13 design, so a real before/after shot of a person with songs is mandatory (S11/S12 used the one prod person with songs; find them read-only).
- Hide unanswered defaults: years-dancing hidden unless > 0 (Chi-Wei: `dance_started_year` = current year, shows "0 years" today); "Newcomer" hidden when the level was never answered (null). Hide the "No public contacts yet. Use Share..." line (contacts that exist still render).
- Thin page: no DANCER label/heading on a person without the Dancer role; no empty boxes.
DJ page (`/djs/:id`):
- `gradientPalette="dj"` (near-black, no icons, no band). Stage name leads.
- Back and Share in ONE 44px header row at the top of the DJ card (same placement as the dancer page), gold styling. No floating Share button.
- Also bar as above with `exclude: 'dj'`: "Dancer" chip filled teal with arrow when they dance; Teacher plain.
- Fix: the vinyl label text is clipped on the DJ hero; the Book box shows a bare "www.instagram.com" (show a proper label/handle).
Teacher page: flag OFF on prod, so it is unreachable; only make it use the Also bar (exclude 'teacher') so it is right when the flag turns on. No other change.
Real people for the shots: Roger (dancer + DJ with gigs), Bisket / "Oreo Sensual" (DJ page, stage name differs), Javier (thin dancer page), Chi-Wei (defaults hidden), the person with songs.

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
