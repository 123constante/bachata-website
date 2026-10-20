# S7-mockups: three REAL arrangements of the combined person page (prototype, NO PR)

Repo: Website. Work on your own branch `claude/s7-mockups` (off main). Read and push with PLAIN git (never `gh api`). Write shell commands without variables/loops/`$(...)` where a plain command works. Check a PRODUCTION build (`npm run build`), not only the dev server. Push ONCE at the end (the commit subject ends `[worker-done <ticket>]`; if past 30% context push earlier with `PARTIAL [worker-done <ticket>]` and write a handover). Never merge, never open a PR, Supabase read-only.
CI rule: GitHub Actions billing may refuse jobs; this branch is a prototype and opens no PR, so no CI step is needed.

## Why
The owner (not technical) must choose HOW one person with several roles (dancer / DJ / teacher / organiser-lead) is shown on the combined page `/people/:id` (`src/modules/person-page/PersonPage.tsx`). Today it is a third look next to the owner's teal dancer ID card (`src/pages/DancerProfile.tsx`, design doc `docs/handover/dancer-page-f13-design.md`) and the near-black / gold vinyl-portrait DJ page (`src/pages/DJProfile.tsx`). The owner asked: "Show me mockups". Earlier DRAWN mockups misrepresented the DJ look and were rejected. These mockups MUST be real components rendering real data, not drawings.

## Owner decisions already made (do not re-ask)
- Scope: the combined person page only. Old role pages stay as they are.
- Restore on the dancer page ONLY "Favourite songs". Not bio, gallery, Practice Buddy details.
- Lead role = the role with something happening (a DJ with upcoming gigs leads with gigs, else dancing leads).
- Roles cannot be hidden (everyone's roles are always public).
- Organiser = ONE LINE "Leads: <organiser>" (a link), not a tab. Data RPC `get_public_person_organisers_v1` may not be applied yet: render that line from a hard-coded fixture and label it fixture in your handover.
- Card = the ID of a PERSON: photo, name, city, flag, languages, contact, Share once.

## The three arrangements (build ALL three, reusing the real role bodies)
1. **Role stamps on the card**: ONE person card (teal dancer-ID look as the base), role STAMPS (small chips) on the card; tapping a stamp expands that role's section below, lead role open by default.
2. **Stacked sections**: one card, then every role's section stacked one after another (lead role first), each with a section header.
3. **Tabs**: one card, a tab bar (lead role first), only the active role's body shown.

Reuse the REAL pieces: the real dancer ID card pieces / DancerProfile body, the real DJ profile body (near-black + gold vinyl portrait must look like the live DJ page; if a DJ section sits inside a teal page, show it as a dark/gold panel exactly as the DJ page draws it, do not restyle it), the real teacher body where data exists. If a body only renders as a full page, extract nothing destructive: wrap it with the existing `embedded` prop (`EmbeddedProfileContext`).

## Where
Add a prototype route `/__mock/person/:arrangement/:fixture` (arrangement = stamps|stacked|tabs; fixture = roger|gatica|threerole|djonly) behind `import.meta.env.DEV || VITE_MOCKS=true`, in a new folder `src/modules/person-page/mockups/`. It may use real read RPCs against prod READ-ONLY (people are public) so the data is real: Roger and Gatica (DJ+Dancing, both known to have DJ and Dancing tabs), one three-role person (find one: a person with dancer + DJ + teacher rows, via the public person snapshot RPC), one DJ-only person (Gatica is DJ-only per the handover walk, confirm). If a person is missing, pick another real one and say so. Do NOT hard-code fake people.

## Output (the owner will look at these on a phone)
1. For each arrangement x person (3 x 4 = 12): a 390x844 full-page screenshot from the PRODUCTION build (playwright, `npm run build` + preview). Save under `docs/mockups/search-v7/<arrangement>-<fixture>.png`.
2. A single `docs/mockups/search-v7/index.html`: one phone-width page, a section per arrangement, the 4 screenshots side by side (scroll sideways inside a strip only, no page h-scroll), short plain-English caption of what the arrangement does. No jargon.
3. Also screenshots of the REAL current dancer page and DJ page of the same people (390x844) as "today" references.
4. Handover `docs/handover/s7-mockups.md`: what was reused vs new, fixture-vs-real per line, what is NOT done (real phone, keyboard), the exact commit sha.
Verified / Not verified block in the handover. Stop after the push and report.
