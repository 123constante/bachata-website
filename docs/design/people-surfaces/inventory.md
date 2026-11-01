# People surfaces inventory (read-only audit, 2026-10-20)

Production build (`npm run build` + `scripts/_serve-build.mjs`), built against the **prod** Supabase project with public anon key, screenshotted at 390x844 full page. Shots are in `shots/`. Pickers use ids only, no names, emails or phones are written in this doc.

**How to read the "flag" caveat:** `teachersDirectory`, `teacherDetail`, `organisersDirectory`, `organiserDetail` default to **off** (`src/lib/featureFlags.ts`, `VITE_ENABLE_*`). I could not read the live Vercel env (site unreachable from the sandbox), so I shot both: flag-default build (`teachers-*`, `organisers-*`) and flag-on build (`FLAGSON-*`). Which is live is **not verified**.

**Big limit:** the image host (`*.r2.dev`) is blocked by the sandbox network, so **no real photo loads in any shot**. Every photo shows as initials, a dark circle or a broken-image icon. The "teal ID card with photo" and "DJ vinyl with portrait" looks are therefore seen only with their no-photo fallback. See Not verified.

## 1. Data shapes (counts only, prod, read-only)

"Active" = the site's own rule: `COALESCE(is_active,true) AND archived_at IS NULL` on `dancer_profiles`. (Only 80 rows have `is_active = true` explicitly; 84 more have it NULL and are treated active. Anyone counting with `is_active = true` gets 80, not 164.)

| Fact | Count |
|---|---|
| Active people (dancer_profiles) | 164 |
| with photo | 110 |
| with bio (bio or description) | 8 |
| with gallery | 1 |
| with songs (`favorite_songs`) | 2 |
| with instagram | 15 |
| `show_contact_publicly` = true | 0 |
| `hide_surname_publicly` = true | 0 |
| Role `dancing` | 92 |
| Role `djing` (= DJs, matches `list_public_djs_v1` = 40) | 40 |
| DJs with upcoming gigs (via `get_profile_event_timeline_v2`, what the page uses) | 17 of 40 |
| DJs with any gig ever | 23 of 40 |
| DJs whose DB `dj_role_details.upcoming_events` is filled | 0 (the column is dead; the page reads the timeline RPC) |
| Role `teaching` | 124 |
| Teachers the public teacher list/detail will show (needs photo + city + first name) | 59 |
| Teachers with a `teacher_role_details` row | 19 |
| Teacher-only people (only role = teaching) | 62 (42 of them have no photo) |
| DJ-only | 4; dancer-only 21; no role at all 4 |
| People with 2 roles | 45 |
| People with 3+ roles | 27 (25 are exactly dancer + DJ + teacher) |
| DJs whose DJ name differs from first name | 11 |
| Roles `organising` 4, `performing` 2, `filming` 0 | |
| Videographers (active) | 0 |
| Organisers (active) | 5, all `live` |
| Organisers with an active team member | 4 |
| Of the teachers the RPC lists: phone stored / email stored / whatsapp stored | 30 / 2 / 1 |

## 2. People picked

All chosen by read-only SELECT on prod. The id is the `dancer_profiles.id` (also the person id).

| Shape | Id (first 8) | How picked |
|---|---|---|
| Rich dancer (bio + instagram + nationality, 3 roles) | c273ebd9 | bio and photo set and instagram+nationality set; first of 5 with bio+photo |
| Three-role, with gallery, flag, achievements | 39ad405f | roles dancing+djing+teaching, only person with a gallery. **Looks like a test/proof record** (see problems) |
| Thin dancer, no photo, no bio (dancer-only) | e9d494b1 | dancer-only role, no avatar |
| Thin dancer, photo but no bio | bdd57723 | dancer-only, photo set, no bio |
| DJ with upcoming gigs | 076e6e97 (4 gigs); a86aaa95 (1) | timeline RPC with `event_start_time >= now` |
| DJ with no gigs | 28d444d1 | timeline RPC empty |
| DJ-only (no dancer role) | 59150b2d | only role djing (has 1 gig) |
| Three-role person | 39ad405f, a86aaa95 (dancer+DJ) | person_roles |
| Teacher-only | 8a773f05 (no photo) | only role teaching |
| Teacher with `teacher_role_details` row | a61e7b72 | row exists; also a DJ and organiser |
| Dancer name differs from DJ name | a86aaa95 | `dj_name` differs from first name; teal page and gold page show two different names |
| Organiser with a team | 4c92f6bd | 1 active team member, 103 upcoming dates |
| Organiser, no team, thin | 5c3943c2 | no avatar/bio/phone, no team, no events |
| Event with a lineup of several people | none publicly reachable. The 3 series with the most programme people (21, 11, 10) return nothing to an anonymous viewer (`event_view_p5` = null; one is `archived`), so `/event/<id>` is a 404 (shots `event-lineup-*`). Used a live event with one teacher instead (`event-page-edition-3`) |

## 3. Surface table

Looks: **teal** = dancer ID card; **gold** = DJ near-black + gold vinyl; **dark-purple generic** = site default dark (teachers).

| Surface (route) | File | Role shown | Look | Name source | Contact shown / toggles | Primary action | Links go to | Thin-data behaviour |
|---|---|---|---|---|---|---|---|---|
| `/dancers` | `src/pages/Dancers.tsx` | all active people (164 incl. teachers-only and DJs) | generic tile grid, round initials/photo | tile name from `dancer_profiles` first name / display name | none | open card | `/dancers/<id>` (id redirects to slug) | initials tile; includes test and one-letter placeholder names |
| `/dancers/:id` | `app/routes/dancers.tsx` → `PublicDancerPageV2.tsx` / `DancerProfile.tsx` | **always labelled DANCER**, even for teacher-only people | teal | `dancer_profiles` display name (first + optional surname; `hide_surname_publicly` honoured) | instagram/facebook/website/whatsapp/email list with Copy. `show_contact_publicly` is false for all 164 yet the 3-role page still shows instagram, facebook and website: those are treated as links, not as contact. Whatsapp has its own `show_whatsapp_publicly` | Share, Back, "Get your own card" | share/back, external links | "No public contacts yet. Use Share to send this page to a friend." (OK); shows "DANCING 0 years / LEVEL Newcomer" for a person who never answered (a default shown as a fact) |
| `/djs` | `src/pages/DJs.tsx`, `components/dj/DjTiles.tsx` | DJs (40) | dark tiles, initials, flag | `list_public_djs_v1.display_name` = DJ name first, else first+surname | none | open | `/djs/<id>` | initials tile; flag if nationality |
| `/djs/:id` | `app/routes/djs.tsx` → `src/pages/DJProfile.tsx` | DJ only; **no hint the person is also a dancer/teacher** | gold vinyl | DJ stage name first (`_public_person_name_v1`) | Instagram/website/facebook buttons under "Book <name>", soundcloud/mixcloud. No phone/email. No toggle read (none needed, links only) | open links, "Details" per gig | external; gig "Details" → `/event/<id>` | page without gigs: only "Book" box (or nothing) + permanent "guestbook, coming soon" card; vinyl centre shows the **name as text** where a portrait should go |
| `/teachers` | `src/pages/Teachers.tsx` | teachers (59) | generic list, tile + city | `get_public_teachers_list_v1` | none | open | `/teachers/<id>` | **Flag closed: a "Coming soon, under construction, drop your details" listing-request form** (about events, not teachers) |
| `/teachers/:id` | `app/routes/teachers.tsx` | teacher | dark-purple generic, graduation-cap emoji, big "Name **Teacher**" title | `get_public_teacher_detail_v1` first+surname | **raw `email` and `phone` returned with no `show_*` check** (RPC has none; 30 of 59 listed teachers have a phone stored while `show_contact_publicly` is false for all). Page shows a Connect card with call button | call / website | external | **404 for 3 of 4 teachers because the RPC requires photo + city + first name**; 42 of 62 teacher-only people have no photo, so most teachers have no teacher page. Flag closed: the "Coming soon" form |
| `/organisers` | `src/pages/Organisers.tsx` | organisers (cards with next-date chip) | generic cards | `organiser_profiles.name` | none | open | `/organisers/<id>` | flag closed → "Coming soon" form |
| `/organisers/:id` | `app/routes/organiser.tsx`, `src/pages/OrganiserProfile.tsx` | organiser + "Teachers & DJs" team strip | gold/serif dark (third look) | `organiser_profiles.name`; team member name from the person, shown as "<first> <surname>" | WhatsApp number shown when `show_phone_publicly`; email gated by `show_email_publicly` (looks respected: the shot shows phone not email) | open event, WhatsApp, Instagram/Facebook | event pages, team member card links (not checked) | empty org: "No nights listed yet", button "Browse upcoming nights" (OK). **A test organiser (slug test-org) is live and listed** |
| `/videographers` | `src/pages/Videographers.tsx` | videographers | generic | `videographers.business_name` | n/a | n/a | n/a | **0 active rows: empty page** (see shot) |
| `/all-profiles` | `src/pages/AllProfiles.tsx` | mixed people | generic | per row | none | open | by role | not inspected in depth |
| `/people/:id` | **no route** | n/a | n/a | n/a | n/a | n/a | n/a | **404 for every person** (shots `people-route-*`). Nothing links to it in the code either; the brief assumed it existed |
| `/search`, `/city/:slug/search` person rows | `src/pages/SearchResults.tsx` | Teachers / DJs / Dancers sections, organisers section | square tile + flag, orange first name | `personName(d)`: DJ name for DJs, first+surname otherwise | none | open | **teacher row → `/teachers/<id>`** (404 or Coming soon for teacher-only, see below), DJ row → `/djs/<id>`, dancer → `/dancers/<id>` | three rows for one person (see problems) |
| Event page `/event/:id` lineup / organiser block | `src/modules/event-page/BentoPage.tsx`, `bento/blocks/schedule/PersonChip.tsx` | organiser (initials circle, name), teacher/DJ chip per programme slot ("Simon, TEACHER") | green event bento | chip name = first name only | none | tap chip | chip → `/dancers|djs|teachers/<id>` (not checked per chip) | "Other organisers you might like" circles with broken images |
| Festival `/festival/:id`, `/festivals` | `FestivalDetail.tsx` | lineup, DJs, teachers | festival bento | per chip | none | — | — | the 3 largest lineups are on non-public series; `/festival/<id>` = 404 for them; the public festival I found (`Any Body Can Dance`) was not given its own shot, **not verified** |
| Home / `/tonight` / `/classes` | `src/pages/Index` etc. | event cards, organiser name | event cards | organiser name | none | open event | `/event/<id>` | no person tiles seen |

## 4. Problems, in plain words

1. **`/people/:id` does not exist.** Every person returns 404. Any design that treats it as the calling card starts from zero.
2. **A person has up to 4 faces and 3 names, none linked.** The three-role person has a dancer page (teal, one name), a DJ page (gold, another name), a teacher page (generic purple), plus search shows them as three separate rows. For the dancer/DJ-name-differs person the dancer page says only the first name and the DJ page says the stage name; neither page mentions the other role, and the DJ page does not link to the dancer page.
3. **Search finds the stage name only partly.** Searching the first name finds the DJ; searching the stage name ("lobo", "dj lobo") returns **no results** for the same person.
4. **Search row for a teacher-only person goes to a dead end.** The row links to `/teachers/<id>`. With the flag off it shows "Coming soon / drop your event details"; with the flag on it is a 404 (no photo or no city, so the RPC returns nothing). The `/dancers/<id>` page for the same person works, but is labelled "DANCER" for someone with no dancer role.
5. **Most teachers have no teacher page.** 124 people hold the teaching role; 59 pass the RPC; 19 have a teacher detail row; 42 of 62 teacher-only people have no photo.
6. **Teacher detail returns phone and email without checking the public toggles.** `show_contact_publicly` is false for all 164 people, yet `get_public_teacher_detail_v1` returns `email` and `phone` to anyone, and 30 of the 59 listed teachers have a phone stored. It is only hidden if the page flag is off; the RPC is open either way. This needs the owner's decision.
7. **Two looks per role, three for organisers.** DJ: gold vinyl page vs plain tile in lists and search. Teacher: its own purple page vs the generic grid. Dancer: teal card vs generic tile.
8. **"Dancer" label is hard-coded** on the teal card, so a DJ-only or teacher-only person who has a `/dancers/<id>` page is called "DANCER".
9. **A default is shown as a fact:** "DANCING 0 years, LEVEL Newcomer" on a person who never filled it in.
10. **Missing photo handling is inconsistent.** Teal card: grey circle + initial; DJ page: vinyl with the **name printed in the centre** and (when a gallery image URL fails) a broken-image icon with alt text; search tiles: broken-image icon with alt text over a dark tile; organiser "you might like" circles: broken images. (Partly because the image host is unreachable from my sandbox; fallbacks are what I could observe.)
11. **Copy pointing at a missing control / not working:** the DJ page has a permanent "The guestbook / Coming soon" card on every DJ; the teachers/organisers gates say "Ricky will call you to add it" about events on a page about a teacher or organiser; the teacher page "Connect" card showed an empty card with two buttons while the "Website" card below shows `instagram.com`.
12. **Test/junk data on live pages.** On `/dancers` several tiles have test-style or placeholder names (including a one-letter name, a "Test"-style name and a generic word); the 3-role picked person has an instagram handle field starting `proof_dancer_rebuild_`, an achievements field with a placeholder competition string and a facebook field set to a stub; a `test-org` organiser is live (`lifecycle_status` live) and listed on `/organisers`.
13. **Lineups with many people are not public.** The 3 series with the biggest programme lineups (21, 11, 10 people) return nothing to an anonymous viewer, so the multi-person lineup design cannot be seen on a live page today.
14. **DJ "upcoming gigs" source is split:** `dj_role_details.upcoming_events` is empty for all 40 DJs; the page uses `get_profile_event_timeline_v2`. Anyone designing from the column would find zero.
15. **`/videographers` is an empty directory** (0 active videographer rows).
16. **Counting trap:** "active" is 164 by the site's rule but 80 if you filter `is_active = true`; 84 rows have NULL.
