# Dancer home and account routing (layout D)

Added 2026-10-11. Owner decision (layout D): the account is a **person with
roles**, not either/or. Organisers keep their organiser home exactly as
before; the dancer side is added around it.

**Dancer-first hard gate** (owner decision 2026-10-11, supersedes the
skippable organiser-home row of #718): every signed-in account, organisers
included, finishes the dancer profile (all four fields: first name, city,
dance role, photo) **before** reaching any account page. Dancer profile
first, then organiser.

## The gate

One route wrapper, `src/components/account/DancerProfileGate.tsx`, deciding
with `dancerGate()` in `src/lib/accountRouting.ts`. It sits inside AuthGuard
and inside each lazy chunk (`Account.tsx`, `MyAttendance.tsx`,
`OrganiserRoutes.tsx`), so it adds nothing to a public first load.

**Gated routes** (`isDancerGatedPath` = every `/account*` path):

| Route | What it is |
|---|---|
| `/account` | the account icon's page (dancer home, or on to the organiser home) |
| `/account/dancer` | the dancer home |
| `/account/attendance` | My attendance |
| `/account/o` and every `/account/o/*` | organiser home, its onboarding (claim / request / create), events, dates, team, profile |
| `/account/new`, `/account/series/:id`, `/account/team/:id?`, `/account?add=\|o=\|from=\|claim=` | old links: they redirect into `/account/o*`, which is gated |

**Not gated:** everything public, signed out or signed in with an unfinished
profile: the calendar, parties, classes, event pages (RSVP and its counts),
festivals, profiles, organiser pages, search, `/auth*`, `/finish-profile`
itself. The rating card keeps its own gate (it was already server-enforced).
`/invite/:token` (an admin invite to join a team) is not gated itself; the
organiser home it leads to is.

**Who passes:** only `profile_complete_v1` = true. Decided explicitly:

| Shape | Gate |
|---|---|
| no dancer row | finish first (the Finish screen offers the WhatsApp contact: nothing to fill in) |
| empty stub | finish first (asks all four fields) |
| partly filled | finish first (asks exactly the missing fields) |
| complete | passes, never gated |
| archived row | **gated, as "no dancer profile"**: an archived row never resolves (`_dancer_profile_id_for_account_v1`), so there is no live profile to finish; the contact is the way on |
| completeness check failed | **passes** (fail open, like every completeness surface): a failed read proves nothing, and an organiser must not lose tonight's event to a timeout. The server refuses the organiser writes (claim / request / create) for an unfinished profile anyway |
| still loading | waits (skeleton), then decides; once a page is let through, a read back in flight never takes it away (only a definite "unfinished" does) |
| anonymous session | passes (AuthGuard decides sign-in; as in #718) |

**The gated Finish screen** (`/finish-profile?gate=organiser&returnTo=<page>`):
`finishProfileHref()` marks any link whose returnTo is a gated page, whoever
builds it (the gate, the post-sign-in hop). It says *"Finish your dancer
profile first, then you can set up your organiser page."*, offers **no Skip
for now**, and with no live profile offers no Continue (it would lead
straight back into the gate). After a save completes the profile, returnTo
lands the person where they were going. A plain `/finish-profile` visit (the
rating card, the reminder banner on a public page) keeps Skip, as before.

**Sign-in landing:** `landingPathAfterAuth` is unchanged: organiser intent
lands on `/account/o`, a known organiser too, an unknown lookup on
`/account`. All of those are gated pages, so an unfinished profile goes
through `/finish-profile` with returnTo = that landing (the organiser intent
is remembered in returnTo) and continues to the organiser onboarding after.

**Server enforcement** comes from a separate admin PR: `claim_organiser_v1`,
`request_organiser_access_v1` and `create_organiser_profile_v1` refuse an
unfinished profile with `PROFILE_INCOMPLETE_CODE` = `'profile_incomplete'`
(defined once, `src/modules/organiser/shared/selfServeErrors.ts`; the admin
PR must raise that exact bare string). The onboarding sheet and the public
"Is this you?" claim card answer it with `useProfileIncompleteRedirect`: the
gated Finish screen, then back. The public card also checks the completeness
AppChrome already publishes before sending a claim or request (known
unfinished: Finish first; still loading: a claim intent waits; failed: the
server decides).

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
  - (#718's `unfinishedRow` is gone: the gate makes an unfinished profile on
    the organiser home unreachable.)
  - `menuDancerEntry`: lands on the organiser home **and** the dancer profile
    is finished &rarr; the account menu (account icon in the organiser top
    bar; the public header is under the organiser frame there) lists
    "Organiser home" and "Your dancer profile" (`/account/dancer`). No banner.

| Person | Icon lands on | Menu dancer entry |
|---|---|---|
| profile not complete (any role, any shape above) | `/finish-profile` (gated) | &ndash; |
| complete, no organiser, no open request | dancer home `/account` | &ndash; |
| complete, organiser | organiser home | yes |
| complete, open access request only | organiser home | yes |

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
  sign-up goes to `/account/o`, the organiser onboarding, as before; a
  role-less sign-in that manages an organiser goes to `/account`, which
  forwards it. Both pass the gate first (above).

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

- `src/lib/__tests__/accountRouting.test.tsx` &mdash; the mapping tables, the
  header icon.
- `src/pages/__tests__/AccountLayoutD.matrix.test.tsx` &mdash; {no row, stub,
  partial, complete, archived} x {no organiser, organiser, open request},
  through the real route components (guards included): where `/account`,
  `/account/o`, a deep organiser link, `/account/dancer` and the
  organiser-intent sign-in landing end up; the gated Finish screen explains
  itself with no Skip; complete is never gated; returnTo round-trips; the same
  fact on the ungated Finish screen and the rating card; no copy naming a
  missing control.
- `src/modules/organiser/shared/__tests__/profileIncompleteRefusal.test.tsx`
  &mdash; the server's `profile_incomplete` refusal (and the public card's
  pre-check) lands on the gated Finish screen with returnTo.
- `tests/e2e/dancer-home.spec.ts` &mdash; the browser walk at 390x844.
- `src/pages/__tests__/FinishProfileToRating.test.tsx` &mdash; gated &rarr;
  finish &rarr; back on the event with tiles live.
- `src/lib/__tests__/navigateTargetsRoutable.test.ts` &mdash; links (`to`,
  `href`, `backHref`) as well as `navigate()` must hit a real route; the
  account path constants are table-checked against the router.
