# Onboarding prototype (P3, design only), round 3

**Open `docs/design/onboarding-prototype.html` on a phone** (or in a desktop browser: it shows a
390x844 phone frame; the Design options drawer switches it to 360x640, 320x568 and, new in round 3,
the three BROWSER viewports a phone actually leaves after its bars: 390x664 (Safari), 360x560 (Chrome),
320x460 (Safari on an SE), and can open a simulated keyboard). One file, inline CSS and JS, no
network, no fonts, 137 KB. Nothing is saved or sent. Branch `claude/p3-onboarding-prototype`, PR #1124.
Briefs: `briefs/p3-onboarding-prototype.md` (round 1), `-r2.md` (owner picks + the no-scroll rule),
`-r3.md` (this fix round). Critiques: `docs/review/onboarding-prototype-r1.md` (11 fixes, round 1) and
`docs/review/onboarding-prototype-r2.md` (PASS with should-fix; its 10 fixes are applied here, section 7).

The owner only needs to: tap through from Welcome, try the three phone sizes and "Keyboard open" in
the drawer, and say if anything feels long. The picks from round 2 are the defaults and are marked
"Chosen" in the drawer.

---

## 1. Round-2 decisions, applied

| Owner pick | Where it landed |
|---|---|
| Corners = pill | Default `data-corners="pill"`: buttons and inputs fully rounded (999px), cards 24px, tap cards 20px, sheets 32px. Textareas use the card radius (a pill textarea looks wrong). Soft / Round stay in the drawer for comparison. |
| Text = short | Default `data-text="short"`: title + control + at most one helper line per screen. The extra sentence of each helper (`.tx-l`) and the one-line explanations on category, role, teach and WhatsApp cards show only in Explained. Level cards keep their explanation in both (round-1 brief). |
| Mood = calm | Default `data-mood="calm"`. The round-1 mood-picker screen is gone; Welcome is screen 1. Playful / Bold stay in the drawer. |
| No "Not sure yet" | Dance role = Leader, Follower, Both (stored `Lead and Follow`). Assumption 1 from round 1 is closed. |
| One question per screen | 22 onboarding screens (was 8). Every multi-question screen is split: Create = name, city. Contact = held number (one tap), phone, contact email, WhatsApp. Your page = category, link, logo. You = first name, photo, role, nationality, languages. Teaching = teach?, levels, styles, years. Then About, personal email, Review. One primary button per screen; Back on every one; optional ones (languages, about, email) have Skip. |
| Thin progress bar | 4px bar in the top strip. Round 3 (fix 8): the width counts the path actually ahead, not the 22-id list: alternatives are one step (find / create = one, held number / phone / email = one), WhatsApp drops off the email path, levels / styles / years drop off when teach = No, the page step is not on the invite path. Invite path = 17 steps, direct path 18, teach = No 14 (`aria-valuemax` follows). No visible count. |
| Nationality / languages | Search box + six popular big chips on the screen; typing filters to six matches; "All countries" / "More languages" open the full list in a sheet (the sheet scrolls internally). The chosen value shows as a pressed chip with a clear button. Styles you teach use the same pattern (14 styles did not fit as plain chips). |
| Tap cards, 2x2 | Roles 3 (three across on 390, 2x2 with Both spanning on 360/320), levels 4 (2x2), teach 2, WhatsApp 2. Category has FIVE cards: owner decision in round 3 (fix 7), five accepted; the cards are 56px tall on compact and browser-viewport heights and the screen fits with no scroll at every size (section 3). Card labels read in sentence case ("Dance school") while the stored value stays Title Case (fix 9, `catLabel`). |
| Review fits one page | "N things left", a counts line (done / to do / optional added), the single next missing item as a tappable row, and "Show all" opening the full list in a sheet. |
| No scrolling | Every onboarding screen measured at 390x844, 360x640, 320x568 AND at the browser viewports 390x664, 360x560, 320x460, at 100% and 130% text, with the keyboard open where the screen has a text field, in every state the drawer offers for the screen (normal, save failed, empty, error): 1768 of 1776 cells have no page scroll, no clipped text. The 8 exceptions are one state on one device: save failed with the keyboard STILL open on the four picker screens at 320x460 Safari (section 3). Home and Settings are not onboarding and may scroll. |

How the screens fit (what a developer builds): the stage is a CSS size container, so three
`@container` rules do the work and map 1:1 to viewport media queries in the app:

- `max-height: 700px` (360x640, 320x568): top strip 48px, 8px rhythm, title 21px, cards 64px,
  celebration tick 92px, popular chips 44px, textarea 88px. Text sizes never go below 14px.
- `max-width: 370px`: the three role cards go 2x2 with the third spanning.
- `max-height: 520px` (keyboard open: 508 / 370 / 308 px of visual viewport on the device sizes, 410 /
  290 / 244 on the browser viewports): top strip 40px, title 18px, helper lines and secondary
  links/buttons (`.kbhide`, the Skip links, About's counter and starter link, the lock card on Personal
  email) collapse, textarea 48px. The field and the primary button stay above the keyboard because the
  frame is a flex column and the keyboard is its last child.
- `max-height: 480px` (round 3, fix 1: the browser viewports WITHOUT the keyboard, 320x460 and 360x560):
  top strip 40px, title 18px, tap cards 56px (fix 7), celebration tick 72px, avatar 64px. At 320 wide
  the card label is 15px so "Community group" stays on two lines at 130%.
- `max-height: 320px` (round 3, fix 1: 320-wide phones with the keyboard up, 308 and 244 px visible):
  top strip 36px, title 16px, inputs and the primary button 48px, textarea 44px, every helper line and
  the (optional) pill go, and the disabled-button reason under Continue is not drawn (a tap on the
  disabled button still toasts it, `showWhy`); a save error still shows inline. A no-match message
  replaces the empty picker list.
- The one region allowed to scroll inside an onboarding screen is a picker list (`.scrollbox`): the
  search results on Find, the city chips, and the chip rows on nationality / languages / styles. Round 3
  (fix 2): it never shrinks below 52px (one big chip row); the search helper and the "All countries" /
  "More languages" / "More styles" buttons collapse under `max-height: 520px` before the list does.
  Section 3 lists the box height in every keyboard cell.

## 2. Screens (24) and flow

| # | id | Question | Fits by |
|---|---|---|---|
| 1 | welcome | Is this you? (invite card, signed-in line) | one card + title + two short lines |
| 2 | find | Find your page (search, claim / ask rows) | results list scrolls internally; primary = Create a page |
| 3 | create-name | Name your page | one field |
| 4 | create-city | Which city? (search + chips) | chips, max 4 |
| 5 | contact | Is this the best number? (one tap) | primary Yes; links Change number / Use an email instead |
| 5b | contact-phone | Phone number | one field |
| 5c | contact-email | Contact email (design assumption, pages with no number) | one field |
| 6 | whatsapp | Show on WhatsApp too? | 2 cards |
| 7 | cat | What kind of page? | 5 cards, 2 columns |
| 8 | link | One link | one field |
| 9 | logo | Your logo | preview + one button |
| 10 | name | Your first name | one field |
| 11 | photo | Your photo (required) | preview + two buttons |
| 12 | role | How do you dance? | 3 cards |
| 13 | nat | Nationality | search + 6 chips + All countries |
| 14 | langs | Languages (optional) | search + 6 chips + More languages, Skip |
| 15 | teach | Do you teach? | 2 cards; No skips 16 to 18 |
| 16 | levels | Which levels? | 4 cards 2x2 |
| 17 | styles | Styles you teach | search + 6 chips + More styles |
| 18 | years | Years teaching (+ More sheet) | one field |
| 19 | about | About (optional) | textarea 120 / 88 / 48 px |
| 20 | email | Personal email (optional) | one field, lock card collapses under keyboard |
| 21 | review | N things left / All set | counts + next item + Show all sheet |
| 22 | live | You're live | celebration, 3 buttons |
| 23 | home | Home with grace banner (MAY SCROLL) | not onboarding |
| (sheet) | settings | Dark mode, sign-out, page name (MAY SCROLL) | not onboarding |

Paths: invite arrival goes Welcome, Contact, ... (Find / Create skipped); direct arrival goes
Welcome, Find, then Claim (sheet, 6-digit code) or Ask to join (sheet) or Create name, city. "Use an
email instead" skips WhatsApp. Teach = No skips levels, styles, years. Back and Esc go one step back
everywhere (and close an open sheet first). Drawer states per screen: Loading, Error, Empty, Save
failed, All done (fills everything), Grace ended (Home), Already live (Live).

## 3. Checks run on the file (measured, not asserted)

Method: Playwright + Chromium, offline, 2026-10-29. The file exposes `window.__proto.audit()`
(open the console on the prototype and run it for any screen + drawer setting). A driver reloads the
page for every screen x state, then for each of the six sizes (390x844 / 360x640 / 320x568 and the
browser viewports 390x664 / 360x560 / 320x460), text scale (100% / 130%) and keyboard (only on screens
with a text field, like a real phone) shows the screen, applies the state (normal / save failed /
empty / error; a state the screen does not have is measured as normal) and records: `room` = px left
below the lowest item in the content area before the page would scroll (negative = scroll); `box` =
the height of the smallest visible picker list (round-3 fix 2: must be >= 52); clipped text;
horizontal overflow; tap targets (44x44 min); contrast (4.5 normal, 3.0 large, composited
backgrounds); smallest font; reduced motion. Developer notes off.

Summary of all 1776 cells (22 onboarding screens + Welcome + You're live, x 4 states x 6 sizes x 2
text scales x keyboard where there is a field):

| Check | Result |
|---|---|
| Page scroll on an onboarding screen | **8 of 1776**, all one case: save failed with the keyboard still open at 320x460 (iPhone SE in Safari), on create-city, nationality, languages and styles: -18 px at 100%, -34 px at 130%. Everything else, including every cell at 390x664, 360x560 and all three device sizes, is 0. (Home excluded: it may scroll.) |
| Picker list under 52px | 0 where there is a list to show. The 2 cells under 52 are create-city's "no match" state at 320x460 with the keyboard (the list is empty and the no-match line takes its place, by rule). |
| Clipped text | 0 |
| Horizontal overflow | 0 |
| Tap targets under 44x44 | 0 (sheet Close now `flex: none`, 44x44 at 130% on Review "Show all", Years "Add more" and the country sheet at 320 and 320x460) |
| Contrast, light | min 5.35 (accent text on the page background); 0 below threshold. Zoom slider thumb now `--gold-fg` (#a8461a on white = 5.9:1, was 2.9:1). |
| Contrast, dark (true black) | min 6.46; 0 below threshold |
| Smallest text | 14 px |
| Reduced motion | no slide, no pop, confetti hidden (re-checked on You're live at 320x460 / 130% / dark) |
| Progress bar | invite path: Contact 1/17, WhatsApp 2/17, Category 3/17, Teach 11/17; teach = No: About 12/14, Review 14/14; email path: Contact email 1/16; direct path: Find 1/18, Create city 1/18, Contact 2/18 |
| Click-through | 0 page errors across the 1776 cells and every sheet opened above. |

Why the 8 exceptions stay: on a real phone the Continue tap blurs the field, so the keyboard is down
when "Couldn't save" appears and the screen is at 460 px, where every save-failed cell fits (+41 px
or more). The scroll only happens if the person re-opens the keyboard with the error still showing,
on a 320-wide phone in Safari. Closing it would need the title or the 52px picker row to go, which
the brief forbids. Listed, not hidden.

Fixes made in round 3 because the browser-viewport measurement failed (each a collapse or a re-size,
never text under 14px): the `max-height: 480px` and `max-height: 320px` steps above; the helper line
inside `.live-content` (Name, Category) now collapses under the keyboard like the others; the
textarea is a fixed 44px at <= 320; the category label is 15px at 320 wide (it was breaking
"Community" mid-word into three lines, 100px cards); the disabled-button reason moves to the tap at
<= 320 (it was 44px of the 244 available).

### Table A: room left in px, worst state per screen, DEVICE sizes (negative would mean scroll; n/a = no text field, so no keyboard)

Columns: size, "kb" = keyboard open, "130%" = text at 130%. `+0` on the picker screens means the chip
region takes the remaining space by design (it is the `.scrollbox`).

| Screen (worst state) | 390 | 390 kb | 390 130% | 390 kb 130% | 360 | 360 kb | 360 130% | 360 kb 130% | 320 | 320 kb | 320 130% | 320 kb 130% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| welcome <br><small>normal</small> | +482 | n/a | +410 | n/a | +237 | n/a | +192 | n/a | +133 | n/a | +108 | n/a |
| find <br><small>normal</small> | +618 | +347 | +602 | +340 | +386 | +173 | +373 | +167 | +314 | +138 | +301 | +128 |
| create-name <br><small>savefail</small> | +572 | +306 | +545 | +287 | +346 | +135 | +297 | +119 | +274 | +102 | +225 | +86 |
| create-city <br><small>empty</small> | +593 | +298 | +573 | +281 | +365 | +128 | +326 | +91 | +293 | +102 | +254 | +84 |
| contact <br><small>savefail</small> | +444 | n/a | +376 | n/a | +226 | n/a | +203 | n/a | +154 | n/a | +73 | n/a |
| contact-phone <br><small>savefail</small> | +572 | +306 | +545 | +287 | +346 | +135 | +323 | +119 | +274 | +102 | +251 | +86 |
| contact-email <br><small>savefail</small> | +572 | +306 | +545 | +287 | +346 | +135 | +323 | +119 | +274 | +102 | +251 | +86 |
| whatsapp <br><small>savefail</small> | +550 | n/a | +482 | n/a | +334 | n/a | +278 | n/a | +262 | n/a | +206 | n/a |
| cat <br><small>savefail</small> | +378 | n/a | +335 | n/a | +186 | n/a | +142 | n/a | +114 | n/a | +70 | n/a |
| link <br><small>savefail</small> | +572 | +306 | +545 | +287 | +346 | +135 | +323 | +119 | +274 | +102 | +251 | +86 |
| logo <br><small>savefail</small> | +532 | n/a | +505 | n/a | +326 | n/a | +303 | n/a | +254 | n/a | +231 | n/a |
| name <br><small>savefail</small> | +569 | +293 | +543 | +276 | +335 | +124 | +313 | +109 | +263 | +96 | +241 | +80 |
| photo <br><small>normal</small> | +524 | n/a | +497 | n/a | +302 | n/a | +277 | n/a | +230 | n/a | +183 | n/a |
| role <br><small>savefail</small> | +564 | n/a | +530 | n/a | +282 | n/a | +253 | n/a | +210 | n/a | +181 | n/a |
| nat <br><small>normal</small> | +2 | +306 | +2 | +287 | +0 | +135 | +0 | +119 | +0 | +102 | +0 | +86 |
| langs <br><small>normal</small> | +2 | +306 | +2 | +287 | +0 | +135 | +0 | +91 | +0 | +102 | +0 | +86 |
| teach <br><small>savefail</small> | +585 | n/a | +564 | n/a | +362 | n/a | +344 | n/a | +290 | n/a | +265 | n/a |
| levels <br><small>normal</small> | +448 | n/a | +366 | n/a | +225 | n/a | +169 | n/a | +153 | n/a | +74 | n/a |
| styles <br><small>normal</small> | +2 | +306 | +2 | +287 | +0 | +135 | +0 | +119 | +0 | +102 | +0 | +86 |
| years <br><small>savefail</small> | +510 | +306 | +483 | +287 | +294 | +135 | +271 | +119 | +222 | +102 | +199 | +86 |
| about <br><small>savefail</small> | +319 | +291 | +248 | +226 | +157 | +100 | +95 | +63 | +85 | +106 | +23 | +65 |
| email <br><small>savefail</small> | +482 | +306 | +455 | +287 | +268 | +135 | +245 | +119 | +196 | +102 | +115 | +86 |
| review <br><small>normal</small> | +502 | n/a | +466 | n/a | +277 | n/a | +217 | n/a | +205 | n/a | +123 | n/a |
| live <br><small>normal</small> | +2 | n/a | +2 | n/a | +0 | n/a | +0 | n/a | +0 | n/a | +0 | n/a |

### Table B: the same at the BROWSER viewports (390x664 Safari, 360x560 Chrome, 320x460 Safari; keyboard leaves 410 / 290 / 244 px)

| Screen (worst state) | 390 Safari | 390 Safari kb | 390 Safari 130% | 390 Safari kb 130% | 360 Chrome | 360 Chrome kb | 360 Chrome 130% | 360 Chrome kb 130% | 320 Safari | 320 Safari kb | 320 Safari 130% | 320 Safari kb 130% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| welcome <br><small>normal</small> | +280 | n/a | +216 | n/a | +157 | n/a | +112 | n/a | +225 | n/a | +205 | n/a |
| find <br><small>normal</small> | +410 | +213 | +397 | +207 | +306 | +120 | +293 | +114 | +263 | +74 | +257 | +64 |
| create-name <br><small>savefail</small> | +370 | +175 | +347 | +159 | +266 | +84 | +217 | +68 | +225 | +38 | +209 | +22 |
| create-city <br><small>savefail</small> | +389 | +168 | +372 | +153 | +285 | +84 | +246 | +66 | +218 | **-18** | +181 | **-34** |
| contact <br><small>savefail</small> | +250 | n/a | +227 | n/a | +146 | n/a | +123 | n/a | +176 | n/a | +128 | n/a |
| contact-phone <br><small>savefail</small> | +370 | +175 | +347 | +159 | +266 | +84 | +243 | +68 | +225 | +38 | +209 | +22 |
| contact-email <br><small>savefail</small> | +370 | +175 | +347 | +159 | +266 | +84 | +243 | +68 | +225 | +38 | +209 | +22 |
| whatsapp <br><small>savefail</small> | +358 | n/a | +335 | n/a | +254 | n/a | +198 | n/a | +221 | n/a | +205 | n/a |
| cat <br><small>savefail</small> | +209 | n/a | +148 | n/a | +106 | n/a | +62 | n/a | +89 | n/a | +41 | n/a |
| link <br><small>savefail</small> | +370 | +175 | +347 | +159 | +266 | +84 | +243 | +68 | +225 | +38 | +209 | +22 |
| logo <br><small>savefail</small> | +350 | n/a | +327 | n/a | +246 | n/a | +223 | n/a | +213 | n/a | +197 | n/a |
| name <br><small>savefail</small> | +359 | +164 | +337 | +149 | +255 | +78 | +233 | +62 | +214 | +32 | +199 | +16 |
| photo <br><small>normal</small> | +326 | n/a | +303 | n/a | +222 | n/a | +197 | n/a | +181 | n/a | +141 | n/a |
| role <br><small>savefail</small> | +359 | n/a | +329 | n/a | +202 | n/a | +173 | n/a | +141 | n/a | +114 | n/a |
| nat <br><small>savefail</small> | +0 | +175 | +0 | +159 | +0 | +84 | +0 | +68 | +225 | **-18** | +209 | **-34** |
| langs <br><small>savefail</small> | +0 | +175 | +0 | +159 | +0 | +84 | +0 | +68 | +225 | **-18** | +181 | **-34** |
| teach <br><small>savefail</small> | +386 | n/a | +368 | n/a | +282 | n/a | +264 | n/a | +221 | n/a | +194 | n/a |
| levels <br><small>normal</small> | +263 | n/a | +184 | n/a | +145 | n/a | +89 | n/a | +113 | n/a | +64 | n/a |
| styles <br><small>savefail</small> | +0 | +175 | +0 | +159 | +0 | +84 | +0 | +68 | +225 | **-18** | +209 | **-34** |
| years <br><small>savefail</small> | +318 | +175 | +295 | +159 | +214 | +84 | +191 | +68 | +225 | +38 | +209 | +22 |
| about <br><small>savefail</small> | +181 | +162 | +119 | +103 | +77 | +88 | +15 | +72 | +190 | +42 | +153 | +1 |
| email <br><small>savefail</small> | +292 | +175 | +269 | +159 | +188 | +84 | +165 | +68 | +225 | +38 | +209 | +22 |
| review <br><small>normal</small> | +301 | n/a | +267 | n/a | +197 | n/a | +137 | n/a | +156 | n/a | +107 | n/a |
| live <br><small>normal</small> | +0 | n/a | +0 | n/a | +0 | n/a | +0 | n/a | +0 | n/a | +0 | n/a |

### Table C: the 12 tightest cells of the 1776, with the picker box height

| Cell | Room | Picker box |
|---|---:|---:|
| create-city savefail 320 Safari kb 130% | -34 | 52 |
| nat savefail 320 Safari kb 130% | -34 | 52 |
| langs savefail 320 Safari kb 130% | -34 | 52 |
| styles savefail 320 Safari kb 130% | -34 | 52 |
| create-city savefail 320 Safari kb | -18 | 52 |
| nat savefail 320 Safari kb | -18 | 52 |
| langs savefail 320 Safari kb | -18 | 52 |
| styles savefail 320 Safari kb | -18 | 52 |
| nat normal 360 | +0 | 331 |
| nat normal 360 130% | +0 | 318 |
| nat normal 320 | +0 | 259 |
| nat normal 320 130% | +0 | 246 |

### Table D: picker list height (px) with the keyboard open, smallest over the states that show a list (rule: >= 52)

| Picker screen | 390 kb | 390 kb 130% | 360 kb | 360 kb 130% | 320 kb | 320 kb 130% | 390 Safari kb | 390 Safari kb 130% | 360 Chrome kb | 360 Chrome kb 130% | 320 Safari kb | 320 Safari kb 130% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| find | 340 | 333 | 167 | 161 | 134 | 124 | 207 | 201 | 116 | 110 | 70 | 60 |
| create-city | 299 | 280 | 129 | 113 | 98 | 82 | 169 | 153 | 80 | 64 | 52 | 52 |
| nat | 299 | 280 | 129 | 113 | 98 | 82 | 169 | 153 | 80 | 64 | 52 | 52 |
| langs | 299 | 280 | 129 | 85 | 98 | 82 | 169 | 153 | 80 | 64 | 52 | 52 |
| styles | 299 | 280 | 129 | 113 | 98 | 82 | 169 | 153 | 80 | 64 | 52 | 52 |

Re-run: `node drive.js docs/design/onboarding-prototype.html audit.json` with the driver below
(kept out of the repo on purpose; the audit itself lives in the HTML):

```js
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('file://' + path.resolve(process.argv[2]));
  for (const s of await pg.evaluate(() => window.__proto.screens()))
    for (const size of ['390','360','320','390b','360b','320b']) for (const ts of ['100','130']) for (const kb of (s.field ? [false,true] : [false])) {
      await pg.reload();
      console.log(JSON.stringify(await pg.evaluate(([id,size,ts,kb]) => { const P = window.__proto; P.setCheck(size, ts, kb); P.show(id); P.applyState(state); var a = P.audit(); a.state = state; return a; }, [s.id,size,ts,kb])));
    }
  await b.close(); })();
```

## 4. Assumptions (need a decision before build)

1. **Contact by email.** The plan (A6) says the contact email is set by the team and never asked.
   "Use an email instead" is drawn for pages with no number. Decide: ask when there is no phone, or
   phone only (then drop screen 5c).
2. **Five category cards: decided.** Owner (round 3, fix 7): accept five. Cards are 56px on compact and
   browser-viewport heights and Category fits with no scroll at every size (Table A and B). Closed.
3. **Claim code.** The claim sheet shows the existing email-code proof (6 digits to the mailbox on
   the page). If the page has no mailbox the real app falls back to Ask to join; not drawn.
4. **Grace length** is drawn as 14 days from the day the screens ship (plan Q1 still open). "Last
   day" wording not drawn.
5. **Go-live in an ambassador city** (plan Q2) not drawn; the celebration would read "Sent for
   review" with the same layout.
6. **DJ question** (plan A4) not drawn separately: same two cards as Teaching, then genre chips.
7. **City** is asked on Create and not asked again; a person claiming a page keeps the page's city.
8. **Sign-in email** screen never changes the login email itself (auth flow, out of scope).
9. **Keyboard and browser heights** are simulated: keyboards 336 / 270 / 260 px on the device sizes and
   254 / 270 / 216 px on the browser viewports (so the keyboard leaves 410 / 290 / 244 px, the round-2
   critique's estimates for iPhone 14 Safari, Android Chrome, iPhone SE Safari). None is a device
   measurement. The rules that matter are the `max-height` steps on the visual viewport (section 1).
10. **Rename** is not on the category screen any more (it was "Change name" on round-1's Your page).
    It lives in Settings as today's page-name field. Fine for onboarding; flagging the move.

## 5. What a developer needs

- Tokens: light = `src/modules/organiser/p3/theme/p3.css`; dark = the TRUE BLACK block in the
  file head (one token set for every P3 surface, round-1 fix 7). Type: `--fs-body` 17px,
  `--fs-small` 14px, `--fs-title` 24px (21 on compact, 18 under the keyboard), `--fs-h2` 19px; the
  font is system-ui in the prototype (P3 uses Outfit; re-measure 320 / 130% with Outfit, see Not
  verified). Radii: `--r-ctl` / `--r-inp` 999px, `--r-card` 24px, `--r-tile` 20px, `--r-sheet` 32px.
- Layout per screen: `.scr` = flex column (`.top` 56/48/40, `.main` flex 1 with `overflow-y: auto`
  as a safety net only, `.foot` with the single primary button). Content never scrolls on the
  measured sizes; keep `overflow-y: auto` on `.main` so an unmeasured device degrades to a scroll,
  not a clip.
- Progress: `STEPS` (18 groups) and `path()` in the script; width = (step + 1) / path length, where the path drops the groups the person's answers skip (section 1). `ORDER` is still the screen order for Back.
- RPCs and tables per screen are in each screen's developer note (drawer: Developer notes):
  `searchClaimableOrganisers` + `organiser_claim_hints_v1`, `claim_organiser_v1`,
  `request_organiser_access_v1`, `create_organiser_profile_v1`, `search_cities`,
  `organiser_profile_update_p5_v1` (category, link, logo), `AvatarUpload` (photo, logo with square
  crop), `save_my_role_v1`, `levels_taught`, `organiser_onboarding_status_v1().missing[]` (Review,
  Home list, gate sheet), `complete_organiser_onboarding_v1`.
- Pickers: on-screen search filters to six chips; the sheet has the full list (nationality = ISO +
  four home nations, popular first; languages 38; styles 14). Stored as English names.
- Success feedback: tick pop + button bounce + `navigator.vibrate` (Android only; no haptics
  promised on iPhone). All motion off under `prefers-reduced-motion` or the drawer switch.
- **Shell height (fix 1): size the app shell to `100dvh`, and while a field is focused to
  `visualViewport.height`. Never `100vh`** (it is the height behind the browser bars, so the footer
  lands under them). The fit steps above are keyed to the visible height.
- **iOS keyboard (fix 5, the single biggest build risk).** `interactive-widget=resizes-content` is
  Chrome only. iOS Safari does not resize the layout viewport when the keyboard opens: it scrolls the
  page to the focused field and leaves a fixed footer behind the keyboard. Build requirement: a
  `visualViewport` `resize` (and `scroll`) listener that sets the shell height to
  `visualViewport.height` and calls `window.scrollTo(0, 0)`, so the `max-height: 520 / 320px` rules
  apply and the field + Continue sit above the keyboard. Test on a real iPhone (and one Android)
  before calling the "field and Continue above the keyboard" pick met.
- **px only, no rem (fix 10).** The public site sets `html` font-size to about 13.5px on phones
  (CLAUDE.md trap), so a rem port of these values renders about 16% small and the fit tables stop
  holding. Every size in this file is px; keep it that way. Text scale comes from the user's OS
  setting, which the prototype simulates with `--ts`.
- **Theme (fix 4): light by default with a user toggle, owner decision.** First load is light even on a
  dark-mode phone (script `proto-theme`); the Settings switch is the override and is remembered. The
  true-black dark tokens stay.
- Small a11y (fix 6): `.sheet-close { flex: none }` so Close keeps 44x44 when a sheet title wraps;
  the zoom slider's `accent-color` is `--gold-fg` (3:1+ thumb).
- Copy (fix 3): photo screen "Add a photo to continue. Dancers like to see who they're meeting.";
  Home row "Your photo: Add one to continue"; Years link "Add more (optional)".

## 6. Parked ideas (not in the brief, not built)

- "Change name" on the category screen (moved to Settings this round).
- The round-1 mood picker as a first screen (owner chose Calm).
- Instagram handle on a You screen (plan A2); more than one link.
- "Last day" / "today" wording for the grace pill; a reminder at 3 days.
- Pre-filling nationality from the device locale.
- Flag image fallback for Windows.
- The inviter seeing "Sam finished the page" on their Home.
- A "Preview my page" sheet before Go live.
- Haptics on iPhone via a native wrapper (not possible on the web).
- A visible "step n of 22" next to the bar (owner asked for the bar alone).

## 7. Round history

- Round 1: prototype + independent critique, 11 fixes applied (commit `c47a391`).
- Round 2 (commit `5e10d81`): owner picks as defaults, Not sure yet dropped, 8 screens split into 22,
  thin bar, search + chips + sheet pickers, Review with Show all, size / keyboard simulator, the
  measured no-scroll sweep above.
- Round 3 (this commit): the round-2 critique's 10 fixes. 1 browser viewports measured and two new fit
  steps (480 / 320); 2 picker list >= 52px; 3 photo copy; 4 light by default stated; 5 iOS keyboard
  build requirement; 6 sheet Close 44x44 and slider thumb; 7 five categories accepted, 56px cards;
  8 progress counts the path ahead; 9 sentence-case card labels; 10 px only. Plus the shorter Years
  link. Done: all ten, re-measured (section 3). Left: the 8 save-failed-with-keyboard cells at 320x460
  (listed above); the round-2 Not verified items. Next: owner reads section 3 and the exception; a
  build brief lifts section 5.

## Verified / Not verified

Verified: everything in section 3, on this file, in Chromium, offline, with the system-ui font: the
1776-cell sweep at six sizes (8 scroll cells, all listed, all one state); picker box >= 52 wherever a
list shows; 0 clipped, 0 horizontal overflow, 0 taps under 44, 0 contrast fails light and dark; sheet
Close 44x44 at 130% on the three sheets the critique named; slider accent #a8461a; progress values on
the invite, email, teach = No and direct paths; reduced motion; card labels sentence case with the
stored values unchanged; file size 137 KB (< 600 KB); no non-ASCII characters in the source; JS
parses; 0 page errors.

Not verified: a real phone keyboard or a real browser's visible height (all six heights are
simulated; the browser ones are the critique's estimates); the iOS `visualViewport` behaviour in
section 5 (build requirement, not prototype); the Outfit font at 320 / 130% (system-ui measured);
Safari and Firefox (container queries need Safari 16+, Firefox 110+); the sheets' own content heights
at 130% with the keyboard open; Home's content against real event data (it may scroll); the Vercel
preview (docs-only, no build impact; no Vercel token in this environment).
