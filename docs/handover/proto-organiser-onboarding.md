# Handover: organiser onboarding prototype (v8, owner-approved 2026-10-21)

Branch `claude/proto-organiser-onboarding`. Design only: no `src/` change, no Supabase write. Open `docs/prototypes/organiser-onboarding-prototype.html` in a browser (Phone / Computer toggle, jump list to every state).

## Flow (real order on the site: dancer first, then organiser)
1. Invite landing, signed out (names the organiser page, "you will be an owner").
2. Create account / sign in with an email code.
3. Dancer profile, 4 required steps, no skip (the profile gate): first name, city (chips, search, "Can't find it? Tell us your city" request), lead or follow (Leader / Follower / Lead and Follow), photo.
4. Confirm join.
5. Home: "No events yet", plus a "Finish to go live: 10 quick questions" card.
6. New event, one question per screen: what, name (draft saved), venue, first date, time, photo, Go live.
7. Go live with questions left: "Almost live" bridge, then 10 quick questions one per screen (5 about you: country, languages, Instagram, WhatsApp, year started; 5 about the page: logo, kind, year founded, Instagram, contact phone), "All set", Go live, event Live.

## Facts this is built on (read from production and the code, 2026-10-21)
- Profile gate: first name, city, dance role, photo. Go live (non-admin) also needs 5 more dancer fields and 7 organiser fields (name, city, logo, category, founded year, Instagram, contact phone). Source: `profile_complete_v1`, `_profile_fields_p5`, `_series_go_live_check_p5`.
- Organisation kinds: Dance School, Event Brand, Community Group, Promoter, Festival Brand.

## Proposals, not facts (check before the build)
- Country, language and year choices are example lists; the real wizard uses typed lists and server vocabularies.
- "Not found city": request saved, person picks the nearest city for now. `city_requests` exists; whether the request flag is on in production and who adds cities are not decided.
- The "Almost live" bridge and its wording are a design proposal; the real Go live list is the server's.
- "10 left" assumes the admin sets the organisation's name and city.

## Checks run (headless Chromium, local)
`flow2.mjs`: every state at 390x844 and 1280x800: 0 console errors, no horizontal scroll, tap targets >= 44 px, exactly one primary per screen, every disabled primary followed by a reason; plus a full walk invite to Live. CLEAN.

## Not verified
Real phone, real keyboard and one-time-code autofill, real upload, screen readers, the Vercel preview, PR checks on GitHub.
