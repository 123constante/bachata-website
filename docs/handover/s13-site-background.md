# S13: site-wide background review + 3 options (prototype, no PR, nothing live)

Branch `claude/s13-site-background` (from `claude/s12-mockups`). Flag: add `?s13=A|B|C` to any real URL on a build made with `VITE_MOCKS=true` (or dev). Without the flag, or in a normal build, GlobalLayout renders exactly as before. Code: `src/components/layout/s13Background.tsx` (new) + ~10 lines in `GlobalLayout.tsx`; only the `default` palette is affected (role worlds, bento event page, brass venues, organiser wash untouched).
Shots: `docs/mockups/s13/{today,A,B,C}-{home,events,event,venues,venue,organisers,organiser,dancers,search,faq}.png`, 390x844 viewport, PRODUCTION build against the prod project (public anon key, read-only), real names/events. `impeccable` skill is NOT available here, so the fallback review checklist from the brief was used.

## Inventory (who renders which wash)
- `palette=default` (purple/amber wash + 20 floating icons): Parties, Classes, Discounts, PracticePartners, Videographers, Choreography, Dancers, DJs (list), AllProfiles, Cities, Vendors, VendorDetail, SearchResults, Faq + all `pages/seo/*` (london guide, learn, parties-london, style, weekday), legal shells, NotFound, Account, MyAttendance, Onboarding, Profile pages, Admin pages, ComingSoonGate placeholders (Venue-entity, Organisers, Organiser profile, Teachers, DJs when gated), Teachers (icons 15).
- `bento` (event page, `floatingCount=0`): /event/:id, /festival.
- `brass` (no icons): /venues. `organiser` (no icons): organiser directory when un-gated. `velvet`: defined, no live user found.
- `showGradientBg=false` (page paints its own ground): Home `/city/:slug` (own navy), Tonight, CityMap, FestivalHub, VenueEntity, OrganiserProfile, DJProfile, Raffles, Auth*, FinishProfile, Account*(Settings/Deleted/Restore).
- Role pages (dancer/DJ) use the S12 teal / near-black worlds, outside this change.
- In production TODAY /venue-entity/:id, /organisers, /organisers/:id are flag-gated and show the "Coming soon" form on the default purple wash, so the "venue", "organisers", "organiser" shots show that real state (not the real directory pages).

## Ranked findings (today's look)
1. **Icons sit on top of text.** 20 big outlined icons drift over copy: /parties hero paragraph 37,500 px² overlap with 33 text runs; /faq 60,900 px² / 33 runs (text partly unreadable in the screenshot); the gated form on a WHITE card shows orange icons through the labels (17,900 px² / 17 runs).
2. **Dead black band** above the footer: `<body>` is pure black, the wash is `fixed` (paints only the first viewport), so long pages go black below the fold and a black strip shows above the footer.
3. **Purple does not belong next to the role worlds.** Teal (dancers) and near-black/gold (DJs) are calm and flat; the amber-purple-pink wash with moving icons feels like a different site.
4. **Tiny labels.** Every default page has runs under 12px (min 8px on home, 9px on dancers/event; 53 runs <12px on /parties, 67 on home, 32 on search, 28 on dancers). Not fixed by a background; needs a separate pass.
5. Moving wash (10s infinite `backgroundPosition` animation) is constant paint work on phones.
Contrast is NOT a problem today (see numbers).

## Three options (same 10 pages via the flag; pages not on the default palette are unchanged and so look identical to today)
- **A - purple refined:** keeps the purple, a deeper ground (`#0A0610`) that also fills the strip above the footer, wash is now static, icons cut from 20 to 4 and dimmed to a quarter. Fixes findings 1 (partly) and 2.
- **B - calm graphite (my pick):** cool graphite `#0E1215` with a faint top light, NO floating icons, static. Sits between the dancer teal `#06191F` and DJ near-black `#0A080B` without competing. Fixes 1, 2, 3, 5.
- **C - bold night-club:** indigo-black `#0B0614` with an orange glow top-left and a magenta glow top-right, no icons. Fixes 1, 2, 5, keeps a party mood but is the loudest next to the role worlds.
Pages changed in all three: events/parties, venue (gated form), organisers, organiser (gated form), dancers, search, faq. Unchanged by design: home (own navy), event (bento), venues (brass).

## Recommendation
**B.** It is the only option that fixes the clash with the role worlds (finding 3) as well as the overlap and the black band, and it makes the amber headings and buttons the only colour on the page. A is the safe fallback if the owner wants to keep purple.

## Measured (production build, 390x844, flag on)
Text on base, WCAG ratio (white / muted #ababab / amber #ffa500), at the plain base and at the brightest point of the wash:
- Today black 21.0 / 9.1 / 10.6; today wash peak 15.5 / 6.7 / 7.8.
- A base 20.1 / 8.7 / 10.2; peak 17.1 / 7.4 / 8.6.
- B base 18.8 / 8.2 / 9.5; peak 16.3 / 7.1 / 8.3.
- C base 20.0 / 8.7 / 10.1; peak 11.7 / 5.1 / 5.9 (lowest of all; still above 4.5).
Icon px² over text in the first viewport (today -> A -> B/C): parties 37,496 -> 21,228 -> 0; venue(gated) 17,887 -> 14,183 -> 0; organisers 17,590 -> 14,293 -> 0; dancers 5,458 -> 4,608 -> 0; search 8,290 -> 4,827 -> 0; faq 60,942 -> 19,194 -> 0. A is therefore only a partial fix of finding 1. Icons: 20 today, 4 in A, 0 in B/C. (The 4 small hero icons on /parties come from the page's own hero, not the layout, and stay in all options; the event page keeps its 4 as well.) Body background: today rgb(0,0,0), A 10,6,16, B 14,18,21, C 11,6,20. Text runs under 12px are unchanged in every option (e.g. parties 53, search 32, dancers 28).

## Verified / Not verified
Verified: production build (`VITE_MOCKS=true`, prod project anon key), 40 PNGs shot, numbers above from the browser; flag-off path unchanged by construction (all three hooks return null / unchanged branch). I looked at today home/venue/parties and A/B/C parties; the other PNGs were measured but not individually eyeballed.
Not verified: no real phone, no tests/lint/CI (prototype), no PR, no browser pass at >390px, scroll below the first viewport not shot (body colour is measured instead), real organiser/venue directory pages (gated in prod), small-label fix not attempted, the `A` icon overlap is reduced but not removed.
Next steps if picked: promote the chosen option into `GlobalLayout` as the default palette, delete the flag, and open a separate ticket for labels under 12px.
