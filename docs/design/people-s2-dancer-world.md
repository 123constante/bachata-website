# People arc S2 -- the dancer world (design record)

Brief: `briefs/PEOPLE-S2-dancer-world-brief.md` on `brief/people-arc` (sha 548a2b8c). Reference: branch
`claude/people-arc-worlds`, `docs/people-arc/worlds/` (`src/worlds.js` dancer world, `shots/magda-dancer-*`,
`shots/ramiro-dancer-f2-*`). Behind `flags.personWorlds` (`VITE_ENABLE_PERSON_WORLDS=true`); OFF = today's page.

## What the page is (flag ON, `/dancers/:id`, not the embedded Dancing tab of `/people/:id`)

1. Site header (unchanged), then S1's `PersonFrame`: Back (left, `backHref="/dancers"`, label "Back") and Share
   (right), then `RoleTabs` (Teacher, DJ, Dancer; Dancer filled teal; nothing for a one-role person). D1', D9.
2. The teal card (`WORLD.dancer`): kicker DANCER, `Avatar` 112px (photo through the image CDN at 2x, else
   initials) with the `NationalityFlag` sticker, the name (`worldNames(...).big`), "Leader &middot; London"
   (`dance_role` + `cityLabel`), then a rule + SPEAKS + `languageLine` only when there are languages.
3. Contact rows (the public page's existing contact list: Instagram, Facebook, Website, Email, and WhatsApp only
   when the dancer made it public), one 52px row each, kicker + value + chevron.
4. The lower half (D6):
   - another world (teacher / DJ) with a date that has not started yet -> "Coming up" with one preview per
     dated world: role pill, "Next class Thursday 29 October" / "Next gig Friday 6 November", event &middot;
     venue, linking to `/teachers|/djs/<slug>`;
   - otherwise "Socials in <city> this week" (London, and the copy says "in London", when there is no city):
     the calendar's parties for 7 London days from today (festival days left out), grouped under full
     day names, at most 6 rows, then "All socials this week" (`/parties`).
   - empty: "No socials listed in <city> this week yet. See every party on the calendar." + "See all parties".
     Error: "This week's socials did not load. You can still see every party on the calendar." + the same
     button. Loading: three 52px placeholder rows (`aria-busy`). The whole lower half shows one placeholder
     until the roles and dates are read, so it never flips from socials to a preview.
5. Self view only: the owner's "Your plans" block (unchanged from today).
6. D8: "Dance bachata too?" + a 44px teal button "Get your own card" -> `joinHref(path)`, the site's
   existing sign-up entry (`buildSignInHref(path, 'signup')`, the same link today's page uses). Shown on every
   shape to signed-out and anonymous viewers (today's rule); a signed-in viewer already has an account.

## Facts: where each comes from (the world formats nothing itself)

| Fact | Source |
|---|---|
| Name | `facts.worldNames({ name }, 'dancer').big` ("Dancer" when nameless, as today's v2 page) |
| City | `facts.cityLabel` (postcode cut) |
| Languages | `facts.languageLine(extras.languages)` (raw stored values) |
| Flag | `facts.flagCode` -> `NationalityFlag` (never printed) |
| Dates | `facts.dateLabel` / `facts.londonDayOf` ("Friday 23 October") |
| Event links | `eventHref` (the site's one rule) |
| Festival test | `isFestivalByFormat` (the site's one rule) |
| Avatar | `frame.Avatar` |

## Design Gate 4 (self-checks)

Run by `docs/people-arc/s2/capture.mjs` on a production build pointed at prod (read-only anon), 11 shapes x
390x844 and 360x800; results in `docs/people-arc/s2/checks.json`, shots in `docs/people-arc/s2/shots/`.

| Check | Result |
|---|---|
| Contrast >= 4.5 (worst gradient stop) | lowest 5.06 on every shape |
| Taps >= 44px | every link/button in the world >= 44 (rows 52, previews 64, buttons 44) |
| No clipping | 0 clipped text nodes |
| No sideways scroll | none at 360 or 390 |
| Empty / loading / error states actionable | yes (copy names a button that is on screen; matrix test) |
| Every real shape | 11 prod shapes (table in `docs/people-arc/s2/HANDOVER.md`) |
| Tabs at the same y | 166px on every two-role shape at both widths |

## Not in the world (decisions for the owner)

- Bio: 2 live dancers have one. The reference card has no place for it, so it is not shown (brief step 4).
- The rest of today's v2 page is not in the reference and is not shown with the flag ON: gallery, practice
  stamp / goal, achievements, favourite songs and styles, "Going next". The reference is the approved design;
  say if any should come back (most likely the gallery: 1 live dancer has one).
- The DJ preview's name font is DM Serif Display; this page does not load it (S3's `useDjPageFonts`), so it falls
  back to Georgia. Needs S3/frame.
- ~~Socials rows have no time~~: done in S2b (`facts.timeLabel`).

## S2b (2026-10-23): one shell with the DJ world, wall-clock gig dates, socials times

- **Shell.** `DancerWorldPage` renders through `frame/WorldPage` (ground, `px-3 pb-6 pt-2`, `max-w-xl`, no min
  height) in every flag-ON state: loading (`dancer-world-loading`), not found (`dancer-world-missing`, "Back to
  Dancers" 44px), full. Its own `max-w-xl px-4 pb-10 pt-3` wrapper and ground div are gone.
- **Frame box, measured** (same build, `capture.mjs`, prod data): Back **L10 T113**, bar **370** at 390 / **340**
  at 360 on all 11 shapes, equal to the DJ reference (`papacito`) in the same build and to the S3 handover. Tabs
  at y 163 on every two-role shape (was 166: the shell's `pt-2`). Content to footer **54px** everywhere (D13).
- **Next gig / next class** read the stored London wall clock (`facts.wallDayOf` / `gigDateLabel`; "not started"
  through `londonWallClockToInstant`): a 23:30 summer gig stays on its own day.
- **Socials rows** lead with `facts.timeLabel` ("21:00", accent, bold); a midnight stamp shows no time.
- **Empty state (D11/D12)**: muted line, then the DJ world's one button "Find a party" -> `/parties`, read from
  `djWorldView` (one source; a shared constant in `facts/` would be cleaner: "needs frame").
- **D8' invite**: on every shape (signed out), unchanged.

Gate 4 re-run on this build: lowest contrast 5.06, no tap under 44px, 0 clipped, no sideways scroll at 360 or 390.
