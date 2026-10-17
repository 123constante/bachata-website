# Signed-in walk of PR #789 (head 987a5e59), 390x844, production build, TEST accounts

**How:** `npm run build` of the #789 head against the repo's no-secret fake Supabase (`phoneqafakenotaproject`; every write refused or mocked, no real project, no real login), served the way Vercel does (`scripts/_serve-build.mjs`), driven by Playwright Chromium 390x844, deviceScaleFactor 2, isMobile + hasTouch. Signed-in sessions use the repo's own fake-session mechanism (`tests/e2e-build/helpers/journeyHarness.ts`, `tests/e2e/helpers/organiserFake.ts`, `DANCER_SHAPES` fixtures). Throw-away walk specs were not committed. Screenshots are 390 px wide JPEGs in `shots/`.

## Results: screen x shape (OK / BUG, measured)

Every cell: horizontal overflow 0 px (scrollWidth 390 = clientWidth 390); `elementFromPoint` at the centre of every in-viewport button hit that button, except where noted.

| Screen | no profile | setup unfinished | finished + upcoming | finished, past only | finished, no nights | hidden | organiser + dancer | organiser, no dancer |
|---|---|---|---|---|---|---|---|---|
| /app/home | OK text says what to do (message us), but see BUG 1 | OK 40% "Choose how you dance towards 70%." | OK | OK "No upcoming night yet. Browse events" + "Rate Mon 5 Oct" | OK 70% "Add when you started dancing towards 100%." | OK banner "Your dancer profile is hidden. Only you can see it." + "Show my profile again" | OK | OK, see Observation A |
| /app/nights | OK "No nights saved yet. Tap I'm Going or Interested on any event..." + Browse events | OK same | OK Upcoming/Past lists | OK "No upcoming nights. Browse events" + Past | OK empty state | OK | OK | OK empty state |
| /app/options | BUG 1: no Sign out, no Account settings | OK | OK | OK | OK | OK "Share my page" disabled WITH reason ("To share it, tap Show my profile again in Account settings.") | OK ("I run events") | BUG 1 (same screen as no profile) |
| /account/settings?from=app | OK "Back to Options" 107x44, hits itself, lands /app/options | OK | OK | OK | OK | OK "Show my profile again" | OK | OK "no dancer profile, nothing to hide" |
| /account/settings/delete?from=app | OK | OK | OK | OK | OK | OK | OK blocked reason lists the organiser page | OK blocked, same |
| Breadcrumbs on settings + delete | BUG 2 | BUG 2 | BUG 2 | BUG 2 | BUG 2 | BUG 2 | BUG 2 | BUG 2 |
| /account (hub) | redirects /finish-profile?returnTo=/account | /app/welcome | /app/home | /app/home | /app/home | /app/home | /account/o | /finish-profile?returnTo=/account |

## Other screens walked

| Check | Result |
|---|---|
| Sign-up step 1 role (`signup-1-role`) | OK, "Continue as Dancer" 341x44, hits itself, overflow 0 |
| City picker, "City not in the list?" (`signup-2-city-notinlist`) | OK: with no match the line "City not in the list? Message us to add your city" is shown; London picks fine |
| Clickwrap above "Email me a link" (`signup-4-email-consent`) | OK: consent row bottom 543 px, button top 556 px (above it, 13 px gap); text "By tapping Email me a link you agree to our Terms and Privacy Policy."; button 167x44 hits itself |
| Code step (`signup-5-code`) | OK: "Entering the code confirms you agree to our Terms and Privacy Policy."; overflow 0 |
| Settings "Back to Options" + `?from=app` | OK: Options -> Account settings gives `/account/settings?from=app`; Settings -> Delete keeps `?from=app`; "Back to Options" works from both and lands `/app/options` |
| Delete: control disabled with a reason | OK: finished shape: disabled, "The button works once you type DELETE in capital letters."; lowercase "delete" stays disabled; "DELETE" enables and the reason goes. Sole organiser owner: disabled, "You cannot delete your account yet. See the reason above." |
| Sign-out, server `logout` throttled to 8 s | OK: left `/app/` and landed `/city/london-gb` (Home) after 3.1 s (the cap), not after 8 s; localStorage + sessionStorage keys after: none (the seeded `auth_last_email`, `auth_form_state_v1` and the `sb-...-auth-token` session key all gone) |
| Avatar with no photo | OK in the dancer app: neutral purple circle with the initial (rgb 138,90,156), same on Home header, Home greeting, Nights, Options; no-profile person gets a person icon. See Observation B for the organiser area |
| Event page RSVP signed out (`event-rsvp-out*`) | OK: "I'm Going" opens "Save this night / Sign in / Create account / Continue browsing"; no write sent |
| Event page RSVP signed in | OK: tap turns "0 going" into "1 going"; no overflow. (Needs the fake's event to be `live`; see Not verified) |
| Profile-strength text vs rule | OK against the fake's mirror of the server rule: name+city = 40% "Choose how you dance towards 70%."; 4 fields = 70% "Add when you started dancing towards 100%."; Me screen shows the same sentence as Home |
| Saving an untouched record sends nothing | OK: `/app/me/edit` untouched: "Save" disabled ("Nothing has changed yet. Edit a field above to save."), forced click sent 0 calls |
| Text pointing at a control not on screen | None found. Options line "...Account settings" is a link on the same screen; Hidden banner's "Show my profile again" is on Home |
| Same fact worded two ways | None found for hidden profile (Home banner, Options Share reason, Settings all say "hidden... Only you can see it") and strength (Home = Me) |

## Bugs found

1. **Options (and Home) give a person with no dancer profile no way to sign out or reach Account settings.**
   Route `/app/options`; shapes: no dancer profile, organiser without a dancer side. Steps: sign in as that person, open Options (bottom tab). Expected: Sign out and "Account settings" reachable (Settings says "You can still download your data or delete your account"). Actual: the whole screen is "We could not find your dancer profile. Message us and we will sort it out." plus one "Message us on WhatsApp" button; no Sign out, no Account settings, no Back to the website (`shots/options--no-profile.jpg`). Home (`home--no-profile.jpg`) is the same. Only the header icon or typing `/account/settings` gets them out. The `app/options` empty state says what they can do (message us) but traps them.
2. **Breadcrumb links under 44 px on Account settings and Delete account** (every shape). Route `/account/settings` and `/account/settings/delete`: "Home" 49x17, "Your account" 74x17, "Account settings" 94x17 in the first viewport. Expected: 44 px tap targets (CLAUDE.md trap: use explicit px). Actual: 17 px high. (Also on the organiser Home: footer-style links "Parties 39x14", "Classes 44x14", "Festivals 49x14", "Tonight 42x14", "Venues 42x14" were reported at `/account/o` after the scroll; that area is not in #789's diff, listed for completeness.)

## Observations (not counted as bugs)

- A. The organiser without a dancer side sees "We can't find a dancer profile for you yet" on `/app/home` with no link to their organiser area (`/account/o`). It says what to do, but only "message us".
- B. The organiser area's avatar (`/account/o`, `hub--org-with-dancer.jpg`) is a grey rounded square with a black initial (rgb 171,171,171), the dancer app's is a purple circle. These look like two different identities (the organiser page vs the dancer), so likely intended; the owner should confirm that "the same avatar on every screen" means the dancer's.
- C. Sign-out on a slow server lands Home after the 3.1 s cap, not instantly; the person sees the Options sheet with a disabled "Yes, sign out" for those 3 s.

## Not verified

- Real phone keyboard (keyboard height, autofill, one-time-code fill), real photo upload/crop, a real inbox/magic link: a sandbox cannot do these.
- Anything against the real backend: all data is the repo's fake Supabase (fixtures from the 2026-10-15 survey shapes). The server's strength rule itself was not exercised, only the fake's mirror; "Delete my account" was never submitted.
- Avatar WITH a photo, and the same avatar across site header vs app (the site header shows no avatar for these accounts in the fake).
- Sign-in route (existing account) and the sign-up flow past the code step (covered by the repo's own `public-journeys.build` spec, not re-walked here).
- Event RSVP: the repo's event fixture has no `lifecycle_status`, so RSVP showed "RSVPs are closed for this event" until I added `lifecycle_status: 'live'` to the fixture locally (not committed). RSVP persistence and the server's attendance rules were not exercised.
- Viewport 360x640 and landscape; dev server (production build only).
