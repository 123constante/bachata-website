# r1b walk: 390x844 screenshots of the BUILT app (branch claude/dancer-app-r1b, head 5d27316)

Chromium headless, viewport 390x844, deviceScaleFactor 1, isMobile, viewport-only shots (not full page).
Production build (`npm run build`) served by `scripts/_serve-build.mjs`, never the dev server.

- **(a) public page:** built with the PROD project URL and its public anon key. The SSR server read prod (anon, read-only).
  Real profiles are labelled only as slug A to F. **Flag on** = prod as it is (`dancer_area_gate_v1` answers open).
  **Flag off** = the same build behind a second server whose Node preload answers `dancer_area_gate_v1` with
  `{open:false}`. The flag is read in the route loader on the server, so a browser `page.route` cannot switch it.
  The photo host (R2) is blocked by the sandbox proxy, so every photo is replaced by a grey placeholder.
- **(b) and (c):** built with the fake-Supabase build env from `playwright.build.config.ts`, plus a fake signed-in session in localStorage.
  The dancer RPCs are answered by Playwright routes. Everything else goes to `tests/e2e-phone/fakeSupabase.mjs`.
  The walk added two things the repo fake lacks: two invented festivals for `/festivals`, and `lifecycle_status: 'live'` on the fake event snapshot.
  Without the second, the event page says "RSVPs are closed" and the lock never shows.
  "Signed-in incomplete" means `profile_complete_v1` = false, and the profile row has everything except a photo.

## (a) Public page `/dancers/<slug>`, prod data
- `a1-on-nameless.png`: slug A, a nameless profile. The heading is "Dancer" with a letter placeholder, and there is no raw id or slug.
- `a2-on-photoless.png`: slug E, a photoless, unclaimed profile. The no-photo placeholder sits on the gradient and the name shows.
- `a3-on-languages.png`: slug C, the top of v2. Look at the place line, which still shows the nationality as a code ("London · DE"); the old page does the same.
- `a3b-on-languages-speaks.png`: slug C scrolled. Speaks reads "German" and "English" (stored `de`, `en`), not codes.
- `a4-on-gallery.png`: slug B, the top of v2 (photo replaced by the placeholder).
- `a4b-on-gallery-section.png`: slug B scrolled to the Gallery section with its one picture.
- `a5-on-instagram-city.png`: slug D. City, role line ("Leader · 14 years dancing") and Share are on the photo card.
- `a5b-on-instagram-city-speaks.png`: slug D scrolled. Speaks reads "Spanish" and "English" (stored `es`, `en`).
- `a6-on-archived-not-found.png`: slug F (archived) with the flag on gives HTTP 404 and the site's "Page not found".
- `a7-off-languages-old-page.png`: slug C with the flag off gives today's old page (two h1s, no Speaks section).
- `a8-off-nameless-old-page.png`: slug A with the flag off gives the old page.
- `a9-off-archived-not-found.png`: slug F with the flag off gives the same 404 page.

## (b) Going lock, fake backend
- `b1-event-locked-incomplete.png`: event page, signed in with an incomplete profile. Both buttons are disabled and the meta line says once "Add your photo to say you're going or interested." with "Finish your profile" under it.
- `b2-event-signed-out.png`: event page, signed out. The buttons are enabled and there is no lock line.
- `b3-hub-locked-incomplete.png`: festival hub, incomplete profile. The lock reason appears ONCE above the list and the per-card Going/Interested buttons are disabled. Look at the button labels: they show broken characters ("‹ I'm Going", "'€ Interested"); this is old, see below.
- `b4-hub-signed-out.png`: festival hub, signed out. There is no lock line and the buttons are enabled.

## (c) Dancer app, fake backend (shapes zero, normal, huge, error)
- `c-zero-home-top.png`: zero. The "Upcoming nights" tile says 0 and the strip shows its empty state ("Your counts start...").
- `c-zero-home-strip-partner.png`: zero, after tapping the partner button. It now says "We'll tell you".
- `c-zero-page.png`: `/app/page` at zero. Views 0, with what to do ("Share your page...").
- `c-zero-options-feedback.png`: the Options feedback sheet, empty. Send is disabled with the reason "Write a message to send it."
- `c-normal-home-top.png`: normal. The tile says 3 and the strip's Going says 3: one number.
- `c-normal-home-strip-partner.png`: normal, the strip (3 / 2 / 12 / 4) and the partner tile after the tap.
- `c-normal-page.png`: `/app/page` normal. Look at the line "It says you follower and you dance in London." The role sentence is ungrammatical (bug, see below; FIXED after this shot, the line now reads "It says you follow and you dance in London.").
- `c-huge-home-top.png`: huge. The tile says 150 and the strip says 150, although the attendance list holds 100 rows (the API cap).
- `c-huge-home-strip-partner.png`: huge. Large numbers are grouped (2,400 / 9,876,543) and nothing overflows at 390 px.
- `c-huge-page.png`: `/app/page` huge. Views 54,321, with 123,456 / 9,876,543.
- `c-error-home-top.png`: error (stats and views fail). The tile says "Could not load", and the numbers card says "We could not load your numbers. Check your connection and try again." with Try again.
- `c-error-home-strip-partner.png`: error. The partner tap fails with the plain "Something went wrong. Check your connection and try again."
- `c-error-page.png`: `/app/page` error. The views card shows the same plain error copy with a retry.
- `c-error-options-feedback.png`: a feedback send that fails. The plain error sits above Send, and the typed text is kept.

## Findings from this walk
- **Bug (new on this branch): `/app/page` role sentence.** `src/modules/dancer-app/screens/page/pageModel.ts:30` builds `you ${dance_role.toLowerCase()}`.
  This renders "It says you follower ..." or "It says you leader ...".
  Prod has 15 live Leader and 7 live Follower profiles (and 135 null), so every person with a role sees broken grammar. Only 'Lead and Follow' is special-cased. FIXED on this branch after the walk: `ROLE_PHRASE` map (you lead / you follow / you lead and follow), test `screens/page/__tests__/pageModelRole.test.ts` (4 failed on the unfixed code, then 7/7). The PNG was not re-shot.
- **Old (on origin/main since #591), not this branch: mojibake on the festival hub buttons.**
  `src/pages/FestivalHub.tsx` holds cp1252-mangled emoji in its source: "‹ I'm Going", "‘€ Interested", "“ Going", and the confetti glyph list.
  The hub buttons are 31 px tall, under 44.
- **Old: nationality shown as an ISO code** on the public page place line ("London · DE"), in both the v2 and the old page.
  It is the same class as F4 (codes shown raw), but it is not a regression.
- **Tap target:** the event page's "Finish your profile" link measures 104x43 (1 px under 44). The hub's lock link is 345x63.
- **Error shape:** when the stats read fails but the nights list loads, the hero says "Your next night · in 4 days" while the tile says "Upcoming nights: Could not load".
  The copy is plain; this is two sources by design (F7 keeps the list).
- **Disabled hub button:** a forced tap on a disabled "I'm Going" on the hub did not navigate to the card behind it (same URL). This is headless Chromium, not a phone.
- All 30 pages: scrollWidth 390 (no sideways scroll), 0 uncaught page errors. The only controls under 44 px in `<main>` were the ones listed above, plus the 404 page's "Back to the calendar" (171x37) and the old page's icon link (66x31), which are old.

## Not walked
- **Real photos on the public page.** The R2 photo host (`pub-*.r2.dev`) answers 403 from the sandbox proxy, so the walk replaced every photo with a placeholder.
  To walk it on a machine with open network, run `walk-a.mjs` (below) without the `/_vercel/image|r2.dev` placeholder route.
- **The signed-in or owner view of a real prod public page** ("Your plans", Join hidden): this needs a real session.
- **The Going lock against prod RPCs:** walked on the fake backend only, as the brief asked.
- **A real phone:** none in the sandbox.

Walk script for (a), run from a scratch dir that has `slugs.json` = `{"A":"<slug A>",...,"F":"<slug F>"}`, after this build and these servers:

```bash
VITE_SUPABASE_URL=https://stsdtacfauprzrdebmzg.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=<prod anon key> npm run build
# flag on (prod as is)
VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... NODE_ENV=production node --conditions=production scripts/_serve-build.mjs --port 4190
# flag off: a preload whose fetch answers any /rest/v1/rpc/dancer_area_gate_v1 with {"open":false,"allowed":false}
VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... NODE_ENV=production node --conditions=production --import ./gateClosedPreload.mjs scripts/_serve-build.mjs --port 4191
```

```js
// walk-a.mjs (Playwright 1.63 from the repo's node_modules)
const browser = await chromium.launch();
for (const [base, key, name] of [[ON,'A','a1'],[ON,'E','a2'],[ON,'C','a3'],[ON,'B','a4'],[ON,'D','a5'],[ON,'F','a6'],[OFF,'C','a7'],[OFF,'A','a8'],[OFF,'F','a9']]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const res = await page.goto(`${base}/dancers/${S[key]}`, { waitUntil: 'networkidle' });
  // expect: v2 = !!document.querySelector('[data-testid=dancer-page-v2]') (true on ON for A-E, false on OFF),
  // F -> res.status() === 404, the Speaks chips are language names (never /^[a-z]{2}$/), scrollWidth === 390.
  await page.screenshot({ path: `${name}.png` });
  await ctx.close();
}
```
