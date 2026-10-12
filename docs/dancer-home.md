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
- `accountView(facts + dancer fact)` &mdash; for a FINISHED dancer profile
  (an unfinished one never gets this far, see the gate below):
  - `menuDancerEntry`: lands on the organiser home &rarr; the account menu
    (account icon in the organiser top bar) lists "Organiser home" and "Your
    dancer profile" (`/account/dancer`). No banner, no row.

| Person (dancer profile finished) | Icon lands on | Menu dancer entry |
|---|---|---|
| no organiser, no open request | dancer home `/account` | &ndash; |
| organiser | organiser home | yes |
| open access request only | organiser home | yes |

## Dancer first, then organiser (owner decision 2026-10-11)

Supersedes #718's skippable "Finish your dancer profile" row. Every signed-in
account, organisers included, finishes its dancer profile (all four fields of
`profile_complete_v1`: first name, city, dance role, photo) BEFORE any account
or organiser page. Order: dancer profile first, then organiser.

**The one guard**: `components/account/DancerProfileGate.tsx`, a route wrapper
mounted inside AuthGuard in each gated lazy chunk (`pages/Account.tsx`,
`modules/organiser/shell/OrganiserRoutes.tsx`,
`modules/admin-organisers/InviteRedeemPage.tsx`). It asks `dancerGate()`
(`lib/accountRouting.ts`) and replaces the page with
`/finish-profile?returnTo=<the page they wanted, query and hash kept>`.

**Gated routes** (`isDancerGatedPath`):

- `/account` (dancer home / account icon), `/account/dancer`;
- `/account/o` and everything under it (organiser home, onboarding = claim /
  request / create, events, dates, team, profile);
- the old `/account/new`, `/account/series/:id`, `/account/team/:id` (they
  redirect into `/account/o`, which is gated);
- `/invite` and `/invite/:token` (joining an organiser team);
- the public organiser page's claim card: a claim or request with an
  unfinished profile goes to `/finish-profile?returnTo=<page>?claim=1` instead
  of calling the server, and the claim runs on the way back.

**Not gated**: everything public &mdash; the calendar, event pages, RSVPs, the
rating card (it keeps its own "finish to rate" gate), profiles, search &mdash;
`/account/attendance` (the person's own RSVPs), `/finish-profile` itself,
`/auth*`, `/admin/*`. Signed out, nothing changes (AuthGuard still sends account
pages to sign-in).

**Which shapes are gated** (`dancerGate(status)`):

| Shape | Status | Gate |
|---|---|---|
| no dancer row | `no_profile` | gated; the Finish screen says "message us" (nothing to fill in) |
| archived row, no live profile | `no_profile` (`_dancer_profile_id_for_account_v1` never resolves an archived row) | gated, as no row |
| empty stub | `incomplete`, all four missing | gated, asks all four |
| partly filled | `incomplete` | gated, asks exactly the missing ones |
| complete | `complete` | never gated |
| check failed | `error` | gated (fails CLOSED onto the Finish screen's "Try again"; the banner and rating card still fail open) |
| still loading | `loading` | waits (skeleton) |

**The gated Finish screen**: `/finish-profile` is in gated mode when its
`returnTo` is a gated destination (`isDancerGatedTarget`: a gated path, or a
`?claim=1` public organiser page). It says "Finish your dancer profile first,
then you can set up your organiser page." and offers NO "Skip for now" (in the
form or the error state); with no profile to fill in it offers "Message us"
and "Back to the calendar", never a Continue that would loop. Saving the last
field sends them to `returnTo`. A plain visit (the rating card, the banner, the
post-sign-in hop to a public page) keeps Skip, exactly as before.

**Sign-in landing**: `landingPathAfterAuth` is unchanged; its organiser
destinations (`/account/o` for an organiser-intent sign-up or a known organiser,
`/account` when unknown) are gated routes, so a new organiser-intent account
goes sign-up &rarr; Finish screen (returnTo `/account/o`) &rarr; organiser
onboarding.

**Server refusal**: the separate admin PR makes the organiser create / claim /
request RPCs refuse an unfinished profile with `PROFILE_INCOMPLETE_CODE`
(`'profile_incomplete'`, one constant in `lib/accountRouting.ts`; the rating
RPC already raises the same string). `selfServeErrorCopy` maps it to
`next: 'finish_profile'`; the onboarding sheet and the public claim card then go
to the gated Finish screen with returnTo = where they were, never a raw error.

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
  sign-up goes to `/account/o`, the organiser onboarding, through the gate
  above.

## The dancer home (`src/components/account/DancerHome.tsx`)

Photo, first name, city, dance role; one completeness line (in practice "complete": an unfinished profile is
gated before it gets here); **My
attendance**; **Browse parties**; a collapsed **I organise events** that
lazy-loads the unchanged `OnboardingView` (claim / request / create); sign out.
The site-wide reminder banner is hidden on `/account` and `/account/dancer`
(the page states the same fact itself).

## One completeness fact

`completenessFact()` in `src/lib/profileCompletion.ts` writes the sentence on
the dancer home, the Finish screen, the reminder banner
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

- `src/lib/__tests__/accountRouting.test.tsx` &mdash; the mapping tables
  (`accountHome`, `accountView`, `dancerGate`, `isDancerGatedPath`,
  `isDancerGatedTarget`), the header icon.
- `src/pages/__tests__/DancerFirstGate.matrix.test.tsx` &mdash; {no row, stub,
  partial, complete, archived} x {no organiser, organiser, open request},
  through the real route entries: where `/account`, `/account/o` and
  `/account/dancer` land, the gated page explains itself, no Skip in gated
  mode, complete profiles never visit the Finish screen, returnTo round-trips,
  the same fact on the dancer home / Finish screen / rating card, the event page
  stays open; plus the sign-in landings and deep links.
- `src/modules/organiser/shared/__tests__/dancerFirst.refusal.test.tsx` &mdash;
  the `profile_incomplete` refusal on claim / request (sheet and public card),
  and the claim card's client gate.
- `src/pages/__tests__/FinishProfileToRating.test.tsx` &mdash; gated &rarr;
  finish &rarr; back on the event with tiles live.
- `src/lib/__tests__/navigateTargetsRoutable.test.ts` &mdash; links must hit a
  real route.
- `tests/e2e/dancer-home.spec.ts` &mdash; the browser walk at 390x844 / 390x600.
  `tests/e2e/helpers/organiserFake.ts` answers the gate's reads with a FINISHED
  profile by default, so organiser specs not about the gate pass through it.
