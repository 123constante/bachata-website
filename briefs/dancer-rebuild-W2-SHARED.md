# Dancer Rebuild wave 2 (W2a-W2e): SHARED rules + the mockup v8 spec in words

Read with your own `dancer-rebuild-w2*.md` brief. INTERFACE wins on names; COMMON binds on process.

## How wave 2 fits together
- Base = `claude/dancer-app-r1a` at the SHA the dispatch prompt names (W1 foundation + R0 regression
  baseline merged by the orchestrator). W1 left one placeholder component per route under
  `src/modules/dancer-app/screens/<name>/`; you REPLACE the placeholder in YOUR folder only. Read
  `src/modules/dancer-app/README.md` (W1's folder contract) before writing a line.
- You import from W1: `shell/renderInShell` (tests), `gate/useDancerArea`, `api/rpc` (`fetchMyDancerEdit`,
  `saveMyDancerProfile`, `fetchPublicExtras`), `api/types`, `api/errors` (`copyFor`), `api/fakeBackend`
  (`setFakeBackend`, named fixtures per plan section-3 shape), `analytics/events` (`trackDancerEvent`),
  `theme/tokens`. You never edit those files. A needed change = handover "INTERFACE deviations" + a
  `// ORCHESTRATOR:` comment at the call site; the orchestrator applies it once for everyone.
- Data loading: one `useMyDancerEdit()` react-query hook is exported by W1's `api/` (key
  `['my-dancer-edit', userId]`); every screen reads from it and `saveMyDancerProfile` writes the returned
  shape back into the cache (`setQueryData`), so Me, Home, Edit and Onboarding show the same strength
  and fields with no second fetch. If W1 did not export it, write it in your folder, name it exactly
  `useMyDancerEdit`, and flag the duplicate in the handover.
- Navigation inside the app uses the shell's bottom tabs (W1); leaving the app uses plain links to the
  normal site (`/`, `/events/...`, `/account/settings`, `/account/o`).
- No new RPC. No new table. Release 1a reads: gate, `my_dancer_edit_v1`, `get_my_event_attendance_v2`,
  the level-vote RPCs through the existing hook, the public events read the calendar uses. Writes:
  `save_my_dancer_profile_v2`, the existing level-vote RPC through the existing hook, the existing
  photo presign/delete functions, `HideSurnameSwitch`'s own write.
- Copy rules: British English; "Going" and "Interested" (never "Save"/"Saved" for events); the person
  is "you"; first name where the mockup shows "Sofia"; every empty state ends with what the person CAN
  do; every disabled control carries its reason in visible text (not only a tooltip). HTML entities for
  typographic characters in JSX as the repo's `CLAUDE.md` says.
- Density and quality: `docs/ui-quality-bar.md` and `.claude/rules/design-density.md` on `origin/main`;
  44px targets; 390x844 first, 360x640 checked; 200% text; long names wrap; dark theme only in 1a.
- Tests: vitest + testing-library through `renderInShell`; table-driven over the named fixtures; the same
  fact asserted on every screen that shows it; red-first for every bug-shaped test (quote the failure in
  the handover); one Playwright spec per slice at 390x844 against the dev server with `page.route` on the
  RPC URL (or NOT RUN with the reason).
- Funnel events (C23c) through `trackDancerEvent`, never for signed-out visitors: W2a `onboarding_step`,
  `profile_strength_70`; W2b `dancer_app_entered`; W2e nothing in 1a (feedback inbox is 1b).

## The mockup v8 in words (private artifact 8T7Zgf5VRcDt2M1UzECr6S; workers cannot open it)
Frame: dark plum background (`#15101C`), cards `#211A2B` / `#2B2237`, lines `#3A2F49`, ink `#F4EEF8`,
muted `#A99DB8`, accent coral `#FF7A5C` (ink on accent `#1A0F0B`), teal `#4FD1B5` for progress/pills,
warn `#F2B84B`, bad `#FF8C8C`. Display font Bricolage Grotesque 700, body DM Sans 400/500/600, 15px
body. Cards 16px radius, 14px padding; main button 48px tall, 12px radius, coral; ghost button bordered.
Bold gradient cards: plum-to-coral `linear-gradient(145deg,#6B2FA8 0%,#B8427A 100%)` for the "You're in"
card and the strength tile; coral-to-purple `linear-gradient(135deg,var(--acc) 0%,#9B5DE5 140%)` for the
next-night hero. Options screen is calm (no gradients). W1 ships these as tokens; you use the tokens.
Header (W1): "Bachata Calendar" logo top-left (to the main site), "Events" top-right; under it the
profile-type pill "Dancer" and the person's first name. Bottom tabs: Home ⌂, Options ⚙, Nights ★, Me ☺
(active = accent).

Onboarding: strength label + percent + thin progress bar at the top; one card per question with a
"1 of 6" tag and a 30px question; big single-select chips (56px) for city/role/years; multi chips for
styles; photo card shows the dashed head-oval + shoulders guide over the camera area with "Head and
shoulders inside the outline. This is how people find you." and two buttons; "You're in" card: tag
"70% · you're past the line", "You're in, <name>", "Your page is live and Going and Interested are
unlocked. Two quick questions take you to 90%.", buttons "Boost to 100%" / "Go to Home"; optional cards
tagged "Optional · +10%" with Continue + Skip; final "Nice work, <name>" / "Your profile is at 100% for
now. Add a bio and links any time from Me." / "Go to Home".

Home: greeting row (round photo 52px, "Good evening", name 20px); hero card (tag "Your next night · in
4 days", event name 24px, "Sat 18 Oct · Camden · 21:00 · 48 going", button "See event"); 2x2 tiles
112px min height: Profile strength (ring 74px with percent inside, sub "Add your photo to reach 70%"),
Views this month (1a: "Coming soon"), Going / Interested (big number, "Next: Fri 24 Oct"), Practice
partners (dashed, "Coming soon."); "What's on this week" card with a date block (day / month / number,
gradient) per row + name + "Soho · 20:00" and a "Browse all events ↗" link.

Nights: one card listing rows with the date block, event name, "Camden · 21:00", and a teal pill
"Going" / "Interested"; past rows carry the level-vote prompt or "You said: Mixed".

Me: card with photo 64px, display name 20px, "Leader · London", strength label + percent + bar,
"Add your photo to reach 70% and unlock Going and Interested.", main button for the next step; then
ghost buttons "Edit my profile" and "See my public page".

Edit: card with top coral border; photo row with "Change photo"; labelled inputs 48px (Display name
"(shown on your page)", First name, Surname "(optional, not shown if you set a display name)" with the
hide-surname switch under it, City, "I dance as" chips, Nationality, Languages, "Dancing since" chips,
Favourite styles chips, Favourite songs, Achievements, "About me 44/280" textarea, Instagram, Facebook,
WhatsApp "(Number with country code)", Website "https://"); below the card a full-width "Save changes"
button disabled with the warn-coloured line "Nothing has changed yet. Edit a field above to save."

Photo: preview card (square 50% width, "This is how people will see you." in a teal message box,
"Use this photo", ghost "Take another").

Options: one card of ghost buttons (Switch profile, Share my page (copy link), Send feedback: what's
missing?, Add to my phone's home screen, Help and message us, Terms and privacy policy, Sign out); a
second card ("← Back to the Bachata Calendar website", "Browse all events").
