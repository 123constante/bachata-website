# Ambassador A1: the "dancer profile is missing" banner (Design Gate stage 2)

Mockups only: `docs/design/ambassador-a1-banner/{index,option-a,option-b,option-c}.html`. Static HTML, invented data, 390x844, dark tokens copied from `docs/design/ambassador-a1/option-b.html` (branch `claude/ambassador-a1-mockups`). Each mockup has a state strip: account (no dancer profile / has dancer profile / banner dismissed), screen (queue list / review screen) and page (/ambassador / another page). No source changes, nothing built.

## Brief (5 lines)

1. **Who:** a signed-in account with no dancer profile that reviews the pending queue at `/ambassador` (Jan, Bristol, will be one).
2. **Problem:** a global banner about 190 px tall (owner's screenshots) pushes the queue down on the list and sits above the review screen.
3. **Goal:** the queue is the first thing on screen; the missing profile is still findable.
4. **Out of scope:** the banner's behaviour on every other page; the dancer profile setup itself.
5. **Rules:** 390x844, taps >= 44 px, contrast >= 4.5, no sideways scroll, every empty state says what the person can do.

## What the banner is today

- **Component:** `src/components/profile/ProfileCompletionChrome.tsx`, lazy-loaded by `AppChrome.tsx` (once a user exists), rendered above the routes on every page. Copy and rule: `bannerModel()` in `src/lib/profileCompletion.ts` (title "Your dancer profile is missing", body from `completenessFact`, button "Message us on WhatsApp" = `NO_PROFILE_CONTACT_URL`).
- **Keys on:** `useProfileCompletion().status === "no_profile"` (via `needsFinishing`: `incomplete` or `no_profile`). It does NOT look at roles, so an ambassador is treated like any dancer.
- **Hidden on** (`BANNER_HIDDEN_ON`): `/finish-profile`, `/auth*`, `/account*`, `/app*`. `/ambassador` is not in that list (it is not under `/account`), which is why it shows there.
- **Who else sees it:** every signed-in account with no dancer profile or an incomplete one, on every public page not listed above. The `incomplete` variant is "Finish your profile" with a link button; only `no_profile` has the WhatsApp button.
- **Dismissed / remembered:** the X hides it for THIS page view only (`dismissedKey === location.key`, React state). The next navigation shows it again; nothing is stored. It disappears for good only once a profile exists.

## Measured (headless Chromium, 390x844, the mockups)

| | Today (mock of current) | A | B | C |
| --- | --- | --- | --- | --- |
| Height added above the first queue row (list) | 152 px | 0 | 45 px | 0 |
| Height added above the review content | 152 px | 0 | 45 px | 0 |
| Banner reachable | always | not on /ambassador | strip, tap = WhatsApp | below the 8 rows on the list; not on review |
| Remembered dismissal | no | n/a | yes (this device) | no (as today) |

The mock banner is 152 px, not the owner's ~190 px (their screenshot is the real thing at the site's 13.5 px root and real wrapping); the saving is therefore at least what the table says.

## Options

**A, hidden on /ambassador\*.** Nothing above the queue. Cost in code: one line in `BANNER_HIDDEN_ON` (`pathname === "/ambassador" || startsWith("/ambassador/")`) plus a row in the existing banner tests; no UI. Trade-off: the person is never told on this page they have no dancer profile (they are told everywhere else, and an ambassador does not need one to review).

**B, slim strip.** 44 px line "Dancer profile missing. Message us", whole strip is the WhatsApp link, X remembers the choice. Full banner elsewhere. Cost: a second render path in `ProfileCompletionChrome` (route-aware), a localStorage key with try/catch (new behaviour: today nothing outlives a navigation), new copy to approve, tests for the 3 states. Trade-off: most code, keeps the nudge, 45 px still above the queue until dismissed.

**C, banner below the queue, off the review screen.** Queue first on the list; review screen has none. Cost: highest. The banner lives in global chrome above the routes, so it needs a slot/portal or the page rendering it itself, and hiding it only on the review screen means the chrome must know the screen. Trade-off: the banner sits under 8+ rows, effectively invisible for a long queue and still 152 px of scroll at the bottom.

## Recommendation: A

The queue is the job on this page; reviewing needs no dancer profile; the banner is still shown on every other page, and the dancer home states the fact itself. It is the smallest change (one line, one test) and cannot regress other pages. Choose B only if Ricky wants Jan nudged on this page. C costs the most for the least visibility.

## Hand checks (by script, throwaway, not committed)

All 3 options x 3 account states x 2 screens x 2 pages = 36 combinations, 390x844:

- **Sideways scroll:** `scrollWidth` 390 = `clientWidth` 390 in every combination.
- **Taps:** every button and link in the product area (mockup strip excluded) is >= 44x44: banner X 44x44, WhatsApp pill 44 tall, strip 45 tall, list rows 56+, Approve/Reject 44.
- **Contrast** (computed from the tokens): muted #ababab on card #121212 8.16:1, on black 9.14; white on card 18.73; amber on card 9.49; black on amber 10.63; red #f87171 on black 7.59; chip violet 11.38, teal 14.2. All >= 4.5.
- **Page errors:** none.

## Not verified

- The real component and the real banner height (190 px) were not rendered; numbers come from the mock and the owner's screenshots. I did not open the walk screenshots (branch `claude/walk-1086`).
- No `/ambassador` route exists in `src` on `main` yet (grep), so "keys on pathname `/ambassador*`" is assumed from the brief.
- No real phone, no WhatsApp tap, no dark/light device settings, no iOS Safari. The localStorage dismissal in B was only checked in Chromium.
- Contrast was computed from CSS tokens, not measured on rendered pixels. No real-data shape survey (not applicable: no data-reading code).
