# Dancer home and account routing (layout D)

Added 2026-10-11. Owner decision (layout D): the account is a **person with
roles**, not either/or. Organisers keep their organiser home exactly as
before; the dancer side is added around it.

## The one mapping: `src/lib/accountRouting.ts`

Nothing else decides where an account goes. It is import-free because the
header (first load on every page) imports it.

- `accountHome(facts)` &mdash; where the account icon lands:
  - owns or manages an organiser, **or** has an OPEN access request &rarr;
    the organiser home `/account/o` (unchanged);
  - everyone else &rarr; the dancer home `/account`;
  - an old `/account?add=|o=|from=` or `#hash` link &rarr; the organiser area,
    as `LegacyAccountRedirect` did;
  - a failed organiser read cannot prove anyone is an organiser &rarr; the
    dancer home, with a line naming the organiser area and linking to it.
- `accountView(facts + dancer fact)` &mdash; per person:
  - `unfinishedRow`: has organisers **and** the dancer profile is unfinished
    &rarr; ONE small row on the organiser home ("Finish your dancer profile",
    names the missing fields, links to `/finish-profile?returnTo=<this page>`,
    "Skip for now" hides it for the browser session). Nothing else about
    dancing on the organiser side.
  - `menuDancerEntry`: lands on the organiser home **and** the dancer profile
    is finished &rarr; the account menu (account icon in the organiser top
    bar; the public header is under the organiser frame there) lists
    "Organiser home" and "Your dancer profile" (`/account/dancer`). No banner.
  - no dancer profile at all (no row, or an archived one &mdash; an archived
    row never resolves, see `_dancer_profile_id_for_account_v1`) &rarr;
    neither.

| Person | Icon lands on | Organiser-home row | Menu dancer entry |
|---|---|---|---|
| no organiser, no open request | dancer home `/account` | &ndash; | &ndash; |
| organiser, profile unfinished | organiser home | yes | no |
| organiser, profile finished | organiser home | no | yes |
| organiser, no dancer profile / archived | organiser home | no | no |
| open access request only | organiser home | no | yes if finished |

## Routes

- `/account` &mdash; `src/pages/Account.tsx` (lazy chunk): resolves, then the
  dancer home or `<Navigate>` to `/account/o`. Reads `organiser_home_v1` and
  the person's own access requests with the organiser area's own keys and
  fetchers, so `/account/o` opens from the cache.
- `/account/dancer` &mdash; the same page, always the dancer home (an
  organiser reaches it from the account menu; it shows "Back to your organiser
  home" instead of "I organise events").
- `/account/attendance` &mdash; `src/pages/MyAttendance.tsx`, routed by this
  change (it existed with no route). A past night links to that event's own
  rating card (`/event/:id#level-rating`); the card is not embedded, so
  `LevelRatingPrompt` stays in the `/event/:id` chunk. Its back link and breadcrumb go to
  `/account/dancer`, which works for organisers too.
- Sign-in landing (`landingPathAfterAuth`): a non-dancer (organiser-intent)
  sign-up goes straight to `/account/o`, the organiser onboarding, as before;
  a role-less sign-in that manages an organiser goes to `/account`, which
  forwards it.

## The dancer home (`src/components/account/DancerHome.tsx`)

Photo, first name, city, dance role; one completeness line naming exactly the
missing fields of the four (first name, city, dance role, photo) with a
**Finish your profile** button (`/finish-profile?returnTo=<this page>`); **My
attendance**; **Browse parties**; a collapsed **I organise events** that
lazy-loads the unchanged `OnboardingView` (claim / request / create); sign out.
The site-wide reminder banner is hidden on `/account` and `/account/dancer`
(the page states the same fact itself).

## One completeness fact

`completenessFact()` in `src/lib/profileCompletion.ts` writes the sentence on
the dancer home, the organiser-home row, the Finish screen, the reminder banner
and the rating card's gate reason (`ratingGate`). The definition stays the
server's (`profile_complete_v1`).

## Finish &rarr; rate

`/finish-profile` sends only the fields it asked for that were filled in; an
untouched form sends nothing (Save is disabled with the reason). After a save
it refetches `profile-completion` (the cache the rating card's gate is
published from) and invalidates `my-dancer-summary`, so `returnTo` (the event
at `#level-rating`) opens with the tiles live. The server gate and RPCs are
unchanged. The page has no opaque 70vh block over the page wash any more.

## Tests

- `src/lib/__tests__/accountRouting.test.tsx` &mdash; the mapping tables, the
  header icon.
- `src/pages/__tests__/AccountLayoutD.matrix.test.tsx` &mdash; {no row, stub,
  partial, complete, archived} x {no organiser, organiser, open request}:
  landing, row, menu entry, the same fact on four surfaces, no copy naming a
  missing control.
- `src/pages/__tests__/FinishProfileToRating.test.tsx` &mdash; gated &rarr;
  finish &rarr; back on the event with tiles live.
- `src/lib/__tests__/navigateTargetsRoutable.test.ts` &mdash; links (`to`,
  `href`, `backHref`) as well as `navigate()` must hit a real route; the
  account path constants are table-checked against the router.
