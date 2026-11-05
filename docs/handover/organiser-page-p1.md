# Handover &mdash; organiser public page P1

Branch `claude/organiser-page-p1`. Brief `docs/briefs/organiser-page-p1.md`
(branch `brief/organiser-page-p1`). Contract `docs/organiser-page/ACCEPTANCE.md`.
Design record + coverage table: `docs/design/organiser-page-p1.md`.

## What shipped

- **S1** stats strip = `organiserStats()` (merged, unchanged) in
  `src/modules/profile/OrganiserStatsStrip.tsx`; first 3 that qualify, no strip
  when none. The old 0 / `--` strip, the `sinceYear` estimate and the
  team-count stat are deleted (E10). Dead Verified badge deleted (E1). Order:
  hero, stats, Get in touch, Team, About, Next nights, Past nights.
- **S2** `src/modules/profile/OrganiserGetInTouch.tsx`: `buildContactRows()` is the
  one mapping; rows WhatsApp, Instagram, Website, Email, each a 44 px link +
  44 px Copy. No Facebook row (E2). No rows = no section. Contact RPC error
  keeps the stored-link rows and shows "Couldn&rsquo;t load WhatsApp and email.
  Try again" (E9) &mdash; via the new `fetchPublicContactOrThrow` in
  `ownershipApi.ts` (the old `fetchPublicContact` keeps its degrade contract).
  "Online" pills gone (E13).
- **S3 read** `src/modules/profile/OrganiserTeamSection.tsx` mounts
  `buildOrganiserTeam()` (merged, unchanged). `listed` = the page&rsquo;s
  existing `organiser_team_members` read (active rows only); **`access` is
  passed as `[]`** because owners/managers are not publicly readable yet
  (needs an admin RPC). No role labels; `TeamCircle` + `usePeopleBadges` use on
  this page removed (and their 4 test blocks in `w1S3Strips.test.tsx`). A person
  links to `/dancers/<dancer id>`; emits `emitProfileView` on tap. A member with
  no public name is left out (the mapping&rsquo;s rule; it used to show "Team member").
- **S5** loading skeleton unchanged (no headings, no numbers); entity read error
  shows "Couldn&rsquo;t load this organiser" + Try again, no noindex (E8); a failed
  feed gives the stats mapping no nights at all (only a real founded year can
  still show); every feed failing still renders hero + Get in touch + Team.
- **S4 copy** "No nights listed yet" / "No upcoming nights" boxes replaced by one
  quiet line "No dates announced yet." + Browse upcoming nights; past-only pages
  title the past list "Recently hosted". "elsewhere in London" removed &mdash; the
  copy names no city (E6).

## Data sources (read-only on prod `stsdtacfauprzrdebmzg`, 2026-11-05)

| Section | RPC / table | Columns | Written by |
|---|---|---|---|
| Hero, About, Running since | `organiser_profiles` (direct select, `fetchOrganiserEntity`) | name, avatar_url, bio, founded_year, city_id&rarr;cities.name, organisation_category | admin app + owner edit layer |
| Get in touch: Instagram, Website | same row | instagram / website, else socials.instagram / socials.website | admin + owner edit layer |
| Get in touch: WhatsApp, Email | `get_organiser_public_contact_v1` (reads only `organiser_profiles`) | contact_phone gated by show_phone_publicly; contact_email gated by show_email_publicly | admin (email); owner (phone + switches) |
| Next / Past nights, stats | `get_organiser_public_events_v1` (event_series_p5, event_series_organiser_p5, venues, cities) + `get_organiser_calendar_events_v1` (organiser_profiles, cities, event_series_p5 &rarr; `get_calendar_events_v2`) | occurrence start, is_cancelled, is_past | admin event editor |
| Team | `organiser_team_members` (is_active = true) + `dancer_profiles` + public-name mask | member_profile_id, sort_order, first_name, avatar_url | admin + owner Team sheet |

## Parked (each needs someone else)

- **E4 city scope, E5 365-day window** &mdash; ticket for ADMIN: `get_organiser_calendar_events_v1`
  passes the organiser&rsquo;s city slug and the default `p_to` (+365 d) to
  `get_calendar_events_v2`; 6 organisers have nights in another city, 4 have
  dates past +365 d. Needs an organiser-scoped, city-free feed (or an explicit
  horizon/count). This repo owns no migrations.
- **E7 cancelled nights** &mdash; proposed, awaiting the owner; left as on main (hidden).
- **Owners/managers on Team** &mdash; needs an admin RPC returning public names +
  dancer ids of `entity_members` owners/managers; then pass it as `access`.
- **Hide a person** (J7), **share link** (J5), **owner counts view** &mdash; later slices.
- **Tickets sold / Dancers came** stats: inputs passed as null (not read today;
  0 organisers qualify on prod).
- E12 (one past-window constant) stays with S4.

## Next steps

1. Lead: Design Gate on the design record; independent critique (one round).
2. Admin ticket for E4/E5 and the owners/managers public read.
3. Owner: confirm E7.

## PARTIAL &mdash; what is left (worker stopped at the 45% context gate)

Done and verified in the sandbox: shape survey re-run on prod 2026-11-05
(counts match ACCEPTANCE section 3 exactly: upcoming 0/1-5/6-100/100+ =
19/5/19/7; past-only 17; no nights 2; bio 4; founded 8; phone public 44; email
public 1; line-up 1 = 37, 2-3 = 13; 1 organiser with no contact row);
`organiserPage.matrix.test.tsx` 19/19 green, and **15 of 19 red on unfixed
`main`** (the 4 that pass on main: empty-rows-hidden, Copy, loading, not found
&mdash; already true there); all organiser/profile/person-page/EIP suites 211/211;
`npm run lint` exit 0; `npm run check:mojibake` clean; eslint on changed files:
1 error, pre-existing (`useAverageColor` setState-in-effect, hero code not touched).

Left for the next worker:
1. `npm run check:bundle-budget` on main and on this branch (zero bytes to /app first load).
2. `npm run pre-ship` and every applicable CI job step locally; per-job table.
3. `/code-review` round (not run &mdash; no review stamp yet).
4. Walk at 390x844 on prod: `incognito-dance` (100+ upcoming), `anna-galenda`
   (past-only), `tropicana` (no nights), `bachata-community` (2-3 team);
   screenshots, sideways scroll, clipping, taps, contrast. Vercel preview needs
   `VERCEL_TOKEN` (not checked).
5. Open the PR from the template with the Verified / Phone QA block; run both
   `check-pr-*` scripts on the body.
6. Independent critique (impeccable-finish-reviewer), one round.
7. Old `OrganiserProfileEmpty.matrix.test.tsx` still passes but tests
   `organiserEmptyState` kinds only; consider folding it into the new matrix.
