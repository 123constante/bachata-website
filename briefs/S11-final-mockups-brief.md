# S11 FINAL mockups: exactly what will be built, today vs final (prototype, NO PR)

Repo: Website. Your branch: `claude/s11-final-mockups`, created FROM `origin/claude/s10-mockups`. Read first, on that branch: `docs/handover/s8-mockups.md`, `docs/handover/s9-mockups.md`, `docs/handover/s10-mockups.md` (routes `/__mock/s8|s9|s10/...`, code in `src/modules/person-page/mockups/`). Plain git only (never `gh api`). Commands without variables/loops/`$(...)` where a plain command works. PRODUCTION build (`VITE_MOCKS=true npm run build` + preview; `NODE_OPTIONS=--max-old-space-size=3072` if needed; override the shell's `VITE_SUPABASE_*` with the prod values in `.env.local` as S8/S9 did). Push ONCE; final subject ends `[worker-done <ticket>]`; 30% context rule (`PARTIAL [worker-done <ticket>]` + handover). Never merge, approve or open a PR. Supabase READ-ONLY. Prototype files only (`src/modules/person-page/mockups/`, the dev-only route, docs). Never change a live page.

## ALL owner decisions (final; apply every one, do not re-ask)
1. Option 2: separate dancer / DJ / teacher pages, each in its own look (dancer = teal ID card `PublicDancerPageV2`; DJ = near-black + gold vinyl; teacher = its own look), each with its own Share. A small "Also:" bar at the top links the person's OTHER role pages (it replaces today's live "Also: DJ" row from `AlsoRoles.tsx`). No combined person page.
2. Name rule: stage (DJ) name on DJ things (DJ list, DJ page, lineups, DJ link in the Also bar, DJ search label); real name everywhere else.
3. Search: one row per person with role labels.
4. Thin pages: hide empty parts. No "coming soon", no empty boxes, no defaults shown as facts, no DANCER label on someone who does not dance.
5. Lead role = role with something happening (DJ with an upcoming gig leads, else dancing).
6. Dancer page: restore ONLY "Favourite songs" (the model already builds `songs` from `favoriteSongs`, `src/modules/dancer-app/public-page/model.ts`; the page does not draw it). Nothing else is restored (no bio, gallery, Practice Buddy details).
7. TEACHER LIST AND TEACHER PAGES STAY OFF: nothing links to `/teachers/...` anywhere; "Teaches" is plain text only; the Also bar shows no teacher link.
8. /dancers: only people with the dancing role; small "DJ" / "Teaches" labels.
9. /djs: gold/near-black look; DJs with an upcoming gig first, with a "Playing soon" mark; the small DJ label ALWAYS shows (even on names starting "DJ").
10. Organiser team strip and event lineup: name by the name rule; link = DJ page if they DJ, else dancer page if they dance, else no link. Never a dead end.

## Screens: each as TODAY (the real live component, prod data) and FINAL (mock), 390x844 full page
1. `dancer-roger-{today,final}.png` and `dancer-javier-{today,final}.png` (thin dancer). Also `dancer-songs-{today,final}.png` for a real public person who HAS favourite songs (find by read-only count; if the only one is not publicly visible, say so and use a clearly labelled sample list on Roger instead).
2. `dj-roger-{today,final}.png` (with gigs) and `dj-oreo-{today,final}.png` (Bisket's DJ page as Oreo Sensual, Also bar shows "Dances").
3. `teacheronly-{today,final}.png`: what a visitor reaches for a teacher-only person today (likely `/dancers/<id>` labelled DANCER, or "Teacher not found") vs final (say exactly what they reach, and that it is not a dead end; if the honest answer is "no page", show where they appear instead).
4. `dancers-list-{today,final}.png`, 5. `djs-list-{today,final}.png`, 6. `organiser-{today,final}.png` (Unidos Flow, whole page today, strip changed in final), 7. `lineup-{today,final}.png`: a PUBLIC event with a DJ and a teacher. The site opens events by the LEGACY id (`event_series_p5.legacy_event_id`), not the P5 id (S9 used the P5 id and wrongly saw 404s); "Pura Nights, Ealing" (legacy `4ec7a3d5-02bb-4e80-9439-9db4766b00b2`) loads, check its programme first. 8. `search-{today,final}.png` for a 3-role person.

## Photos
Try r2.dev first. If blocked, try the site's image proxy at `https://www.bachatacalendar.co.uk/_vercel/image?url=...&w=256&q=75` for the same URL. If both are blocked, say so in the first line of the handover; never invent photos.

## Output
`docs/mockups/s11/*.png` as above and `docs/handover/s11-final-mockups.md`: per screen, 1-2 plain lines on what changes vs today and which decision number causes it; fixture vs real per screen; anything a decision could NOT be applied to; what is NOT verified. Stop after the push.
