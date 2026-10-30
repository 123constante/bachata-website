# Onboarding tap-through vs the approved prototype (AUDIT, read-only, 2026-10-29)

Built flow on main (`2afd8d9`, behind `organiserP3`) walked at 390x844 in Chromium with
`VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true`, every call faked by `page.route`
(no Supabase host; the walk script is kept as `onboarding-tapthrough/audit-tapthrough.spec.ts.txt`, raw
per-screen numbers in `onboarding-tapthrough/rows.json`). Prototype: `docs/design/onboarding-prototype.html`
(+ `.md`, #1124), driven with `window.__proto.show(id)` and `data-mood=playful`
(`onboarding-tapthrough/proto-rows.json`). Screenshots: `docs/audits/onboarding-tapthrough/NN-<screen>.png`
(built) and `proto-playful-<screen>.png` (prototype; full browser page with the phone frame).
No product code changed.

## Headline

The owner's three picks are only PARTLY in the build, which is why it reads calm/plain:

- **Playful: effectively absent.** The built title colour (gold, 800 weight, 24px) is what the prototype's
  *playful* mood also does, but the prototype's playful mood is almost nothing more than that plus a
  friendlier Welcome title ("Hey Sam, you made it!"). The build has no mood switch and uses the calm/plain
  Welcome copy. Everything else is the same plain question-and-card layout. There is no personality in copy,
  no emoji, no illustration, no encouragement. The only playful elements are the Live tick and confetti.
- **% on the progress bar: built.** `NN%` shows on every screen (aria `valuenow` matches). The prototype
  has NO % at all (an unlabeled 4px bar, "No visible count"), so the % is an owner addition that the build
  honours. Two oddities below (Review, Welcome).
- **Flags: built, but only on Nationality**, as real `flagcdn.com` images (prototype: emoji flags, also only
  on Nationality). Not on Languages (prototype also none). Grey boxes in my screenshots are my fake for
  flagcdn, not a bug.

## Per-screen table (built at 390x844, empty persona, invite-less direct arrival `?o=`)

Every built screen: 0 page scroll, 0 horizontal overflow, 0 tap targets under 44x44 (checked on every
button/input/card in `.p3-ob`), one question per screen, one primary button. So those columns are all
"pass" and omitted from the table; only differences are listed.

| # | Prototype screen | Built screen | Mood (playful?) | % bar | Flags | Copy differences |
|---|---|---|---|---|---|---|
| 1 | welcome | welcome | Plain. Proto playful: "Hey Sam, you made it!"; built "Welcome to Ritmo Bachata London" | 0% | no | Built: "About five minutes, once only." (proto: "the page is yours to edit"); no invite card (direct arrival, `?o=`), button "Let's go" vs "Yes, that's me" + "That's not my page" |
| 2 | find | (not walked: needs no-page persona) | n/a | n/a | n/a | see Not verified |
| 3-4 | create-name, create-city | (not walked) | n/a | n/a | n/a | see Not verified |
| 5 | contact | skipped (empty persona has no held number; shows contact-phone) | n/a | n/a | n/a | not walked, see Not verified |
| 5b | contact-phone | contact-phone | Plain | 7% | no | Built helper "Shown on your page. UK mobiles start 07; add +44 for anything else." (proto: "Shown on your page.") |
| 6 | whatsapp | whatsapp | Plain | 13% | no | same |
| 7 | cat | cat | Plain; 5 cards 2-col, Festival brand spans | 19% | no | Built shows page name above cards (proto: "<name>, in Leeds": city missing, no city on the page row) |
| 8 | link | link | Plain | 25% | no | same |
| 9 | logo | logo | Plain | 31% | no | same |
| 10 | name | name | Plain | 38% | no | same |
| 11 | photo | photo | Plain | 44% | no | Built: "Add a photo to continue. Dancers like to see who they're meeting." (proto same, plus "A clear face shot." helper, missing in built) |
| 12 | role | role | Plain | 50% | no | same |
| 13 | nat | nat | Plain | 56% | YES, 6 flag images (proto emoji) | same; "All countries" button sits at the bottom, far from the chips (empty middle) |
| 14 | langs | langs | Plain | 63% | no | same |
| 15 | teach | teach | Plain | 69% | no | helper "This shows on your teacher page." not in proto |
| 16 | levels | levels | Plain | 75% | no | same |
| 17 | styles | styles | Plain | 81% | no | same |
| 18 | years | years | Plain | 88% | no | same |
| 19 | about | about | Plain | 94% | no | same |
| 20 | email | (dropped by owner 2026-10-29) | n/a | n/a | n/a | intentional |
| 21 | review | review | Plain | **44%** (see gap 4) | no | "8 things left / 8 to do. About not added (optional)" (proto: "2 done . 8 to do . 1 of 3 optional added", "Add the 8 missing items to go live." + "Go live" button); built lists the first missing item and Show all |
| 21b | review ready | review-ready | Plain | 100% | no | "All set / Nothing left to do. About added." |
| 22 | live | live | Only playful screen: orange tick + confetti | 100% | no | Buttons "View my page" + "Go to Home"; proto has a third, "Share" (hidden here, see Not verified) |

## Gaps, ranked by how much the owner would notice

1. **No playful mood anywhere except Live.** Titles are the plain question text; helpers are neutral; no
   emoji, colour pops, or friendly reactions on picking a card; the bottom ~60% of most screens is empty
   cream (cat, link, name, role, teach: one control floating at the top). A picker for mood does not exist
   in the build, so "playful" cannot be switched on. Files: `src/modules/organiser/p3/onboarding/onboarding.css`
   (`.p3-ob-t` line 57 is the only mood-like rule), copy in `OnboardingFlow.tsx` and `PersonFlow.tsx`.
2. **Welcome copy is the flattest screen and the first one seen.** "Welcome to <name>" (`OnboardingFlow.tsx:544`,
   `titleOf`) vs the prototype's playful "Hey <first name>, you made it!" (prototype `buildWelcome`, line 934).
   First name is not used on Welcome at all in the build.
3. **Flags are grey placeholders until `flagcdn.com` loads, and appear only on Nationality.** The owner
   asked for "flags (country pickers)": the Nationality chips have them, the "All countries" sheet rows have
   them (per `walk-p3-w4b2-person.spec.ts`), but Languages shows none (prototype also none, so this is a
   possible owner expectation, not a deviation). The flag images depend on a third-party CDN with no emoji
   fallback: when the image fails the chip shows an empty box (`data-failed`, `ObShell.tsx:128`). File:
   `src/modules/organiser/p3/onboarding/ObShell.tsx:121-135`.
4. **The % goes backwards on Review.** 94% on About, then **44%** on Review with "8 things left"
   (`reviewPercent(steps, missing)`, `OnboardingFlow.tsx:810`), then 100% when all set. Looks like a bug
   to anyone walking in order (the prototype's bar goes to 17/17 on Review and never drops). Also Welcome
   shows "0%" in a coloured label. File: `OnboardingFlow.tsx:810` / `reviewPercent` in `pageModel.ts` or
   `personModel.ts` (not read to the end; trace from the call).
5. **Build omits some prototype helpers/copy**: Photo "A clear face shot."; Review's counts line ("2 done .
   8 to do . 1 of 3 optional added") and the "Add the 8 missing items to go live." footer; category screen
   lacks the "in <city>" line. Files: `OnboardingFlow.tsx`, `PersonFlow.tsx`.
6. **Live screen**: celebration matches, but confetti is a handful of dots (`.p3-ob-confetti`, `page.css:23`),
   and the third button (Share) was absent in my run.
7. **Layout, not a gap**: no scroll, tap targets and one-question-per-screen all match the prototype at
   390x844.

## Not verified

- Screens Find, Create name, Create city and the held-number "contact" screen were NOT walked (my persona
  had no number and a page already; the existing `walk-p3-w4b2-page.spec.ts` covers their geometry, not
  their mood). Welcome with an invite card (`/invite/:token`) not walked.
- Share button absence on Live may be my headless browser (no `navigator.share`) or the `organiserDetail`
  flag; not traced.
- 360x640, 320x568, 130% text, dark mode: not run (existing walk specs cover scroll/tap targets there).
- The prototype's playful mood was read from its source (`data-mood`, `buildWelcome`) and its screens
  driven at 390 with `data-mood=playful`; `buildWelcome` was not re-run after the switch, so its
  screenshot still shows "Hi Sam, welcome". The playful welcome string is from the code.
- Flags: only the CDN request was faked (grey box); real flag rendering not seen. The 44% on Review was
  seen with the faked empty persona (8 missing); a different persona may give a different number, and I did
  not trace `reviewPercent`.
- No real Supabase, no real go-live call (faked).
