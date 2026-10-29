# Onboarding prototype (P3, design only), round 2

**Open `docs/design/onboarding-prototype.html` on a phone** (or in a desktop browser: it shows a
390x844 phone frame; the Design options drawer switches it to 360x640 and 320x568 and can open a
simulated keyboard). One file, inline CSS and JS, no network, no fonts, 132 KB. Nothing is saved or
sent. Branch `claude/p3-onboarding-prototype`, PR #1124. Briefs: `briefs/p3-onboarding-prototype.md`
(round 1) and `briefs/p3-onboarding-prototype-r2.md` (round 2, owner picks + the no-scroll rule).
Round-1 critique: `docs/review/onboarding-prototype-r1.md` (all 11 fixes applied in round 1; the
list is in section 8 of the previous version of this file, `git show c47a391:docs/design/onboarding-prototype.md`).

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
| Thin progress bar | 4px bar in the top strip, width = position in the 22-screen order (`aria-valuenow`, "Step n of 22" for screen readers). No visible count, so 22 screens still read as quick. |
| Nationality / languages | Search box + six popular big chips on the screen; typing filters to six matches; "All countries" / "More languages" open the full list in a sheet (the sheet scrolls internally). The chosen value shows as a pressed chip with a clear button. Styles you teach use the same pattern (14 styles did not fit as plain chips). |
| Tap cards, max 4, 2x2 | Roles 3 (three across on 390, 2x2 with Both spanning on 360/320), levels 4 (2x2), teach 2, WhatsApp 2. Category has FIVE cards because `CATEGORY_OPTIONS` has five values; measured to fit on every size in Short text (see section 3). Merging two values is a product call (Parked). |
| Review fits one page | "N things left", a counts line (done / to do / optional added), the single next missing item as a tappable row, and "Show all" opening the full list in a sheet. |
| No scrolling | Every onboarding screen measured at 390x844, 360x640, 320x568, at 100% and 130% text, and with the keyboard open where the screen has a text field: no page scroll, no clipped text (section 3). Home and Settings are not onboarding and may scroll; both say so in their developer note. |

How the screens fit (what a developer builds): the stage is a CSS size container, so three
`@container` rules do the work and map 1:1 to viewport media queries in the app:

- `max-height: 700px` (360x640, 320x568): top strip 48px, 8px rhythm, title 21px, cards 64px,
  celebration tick 92px, popular chips 44px, textarea 88px. Text sizes never go below 14px.
- `max-width: 370px`: the three role cards go 2x2 with the third spanning.
- `max-height: 520px` (keyboard open: 508 / 370 / 308 px of visual viewport): top strip 40px, title
  18px, helper lines and secondary links/buttons (`.kbhide`, the Skip links, About's counter and
  starter link, the lock card on Personal email) collapse, textarea 48px. The field and the primary
  button stay above the keyboard because the frame is a flex column and the keyboard is its last
  child. On a real phone this is `visualViewport.height`; iOS needs `interactive-widget=resizes-content`
  or a `visualViewport` resize listener.
- The one region allowed to scroll inside an onboarding screen is a picker list (`.scrollbox`): the
  search results on Find, the city chips, and the chip rows on nationality / languages / styles. They
  only need to when the keyboard is open (section 3 lists exactly when).

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
(open the console on the prototype and run it for any screen + drawer setting). A driver reloads
the page for every screen x state, sets size (390x844 / 360x640 / 320x568), text scale (100% /
130%), keyboard (only on screens with a text field, like a real phone) and theme, shows the screen
and records: `room` = px left below the lowest item in the content area before the page would scroll
(negative = scroll); clipped text (any text box that leaves its clipping ancestor, or whose own box
overflows when it clips); horizontal overflow; tap targets (every visible button / link / input,
44x44 min); contrast (every visible text node and every placeholder against its composited
background, 4.5 for normal text, 3.0 for large); smallest font size; reduced motion (with
`data-rm`: no screen animation, confetti hidden). Developer notes off (they add height when on).

Summary of all 748 audits (24 screens x their states x 12 size/text/keyboard combos, plus dark
theme at 390):

| Check | Result |
|---|---|
| Page scroll on an onboarding screen | 0 of 748 (Home excluded: it may scroll, worst -1209 px at 320 / 130%) |
| Clipped text | 0 |
| Horizontal overflow | 0 |
| Tap targets under 44x44 | 0 |
| Contrast, light | min 5.35 (accent text on the page background); 0 below threshold |
| Contrast, dark (true black) | min 6.46 (button text on the accent); 0 below threshold |
| Smallest text | 14 px (tab labels on Home raised from 12) |
| Reduced motion | 24 of 24 screens: no slide, no pop, confetti hidden |
| Explained text at 320 / 130% | cat would scroll by 107 px (five cards with their explanations). Explained is not the chosen variant; in Short it fits with +64 px to spare. |
| Click-through | Welcome to Home on the invite path, teach = No path, direct path with Claim, Ask and Create, Change number and Use an email paths; 25 distinct screens reached by taps; Back and Esc work; a disabled Continue does not move; 0 page errors. |

Fixes made because the measurement failed (each a re-split or a collapse, never text under 14 px):
About overflowed at 320 / 130% (textarea 88 px on compact phones) and with a two-line save error
under the keyboard (textarea 48 px, counter and starter link collapse); the six nationality chips
did not fit at 320 (popular chips 44 px, 6 px gaps on compact phones).

### Table: room left in px, worst state per screen (negative would mean scroll; n/a = no text field, so no keyboard)

Columns: size, then "kb" = keyboard open, "130%" = text at 130%. `+0` on the picker screens means
the chip region takes the remaining space by design (it is the `.scrollbox`).

| Screen (worst state) | 390 | 390 130% | 390 kb | 390 kb 130% | 360 | 360 130% | 360 kb | 360 kb 130% | 320 | 320 130% | 320 kb | 320 kb 130% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| welcome <br><small>normal</small> | +482 | +410 | n/a | n/a | +237 | +192 | n/a | n/a | +133 | +108 | n/a | n/a |
| find <br><small>normal</small> | +618 | +602 | +347 | +340 | +386 | +373 | +177 | +171 | +314 | +301 | +115 | +109 |
| create-name <br><small>savefail</small> | +572 | +545 | +306 | +287 | +346 | +297 | +139 | +123 | +274 | +225 | +77 | +61 |
| create-city <br><small>empty</small> | +593 | +573 | +298 | +281 | +365 | +326 | +132 | +95 | +293 | +254 | +70 | +33 |
| contact <br><small>savefail</small> | +444 | +376 | n/a | n/a | +226 | +203 | n/a | n/a | +154 | +73 | n/a | n/a |
| contact-phone <br><small>normal</small> | +572 | +545 | +306 | +287 | +346 | +323 | +139 | +123 | +274 | +251 | +77 | +61 |
| contact-email <br><small>savefail</small> | +572 | +545 | +306 | +287 | +346 | +323 | +139 | +123 | +274 | +251 | +77 | +61 |
| whatsapp <br><small>savefail</small> | +550 | +482 | n/a | n/a | +334 | +278 | n/a | n/a | +262 | +206 | n/a | n/a |
| cat <br><small>savefail</small> | +378 | +335 | n/a | n/a | +184 | +124 | n/a | n/a | +112 | +25 | n/a | n/a |
| link <br><small>savefail</small> | +572 | +545 | +306 | +287 | +346 | +323 | +139 | +123 | +274 | +251 | +77 | +61 |
| logo <br><small>savefail</small> | +532 | +505 | n/a | n/a | +326 | +303 | n/a | n/a | +254 | +231 | n/a | n/a |
| name <br><small>empty</small> | +569 | +543 | +261 | +237 | +335 | +313 | +99 | +77 | +263 | +241 | +37 | +15 |
| photo <br><small>normal</small> | +524 | +497 | n/a | n/a | +302 | +277 | n/a | n/a | +230 | +205 | n/a | n/a |
| role <br><small>savefail</small> | +564 | +530 | n/a | n/a | +277 | +247 | n/a | n/a | +205 | +149 | n/a | n/a |
| nat <br><small>normal</small> | +2 | +2 | +306 | +287 | +0 | +0 | +139 | +123 | +0 | +0 | +77 | +61 |
| langs <br><small>normal</small> | +2 | +2 | +306 | +287 | +0 | +0 | +139 | +95 | +0 | +0 | +77 | +33 |
| teach <br><small>savefail</small> | +585 | +564 | n/a | n/a | +362 | +331 | n/a | n/a | +289 | +259 | n/a | n/a |
| levels <br><small>normal</small> | +448 | +366 | n/a | n/a | +221 | +160 | n/a | n/a | +146 | +38 | n/a | n/a |
| styles <br><small>normal</small> | +2 | +2 | +306 | +287 | +0 | +0 | +139 | +123 | +0 | +0 | +77 | +61 |
| years <br><small>normal</small> | +510 | +483 | +306 | +287 | +294 | +271 | +139 | +123 | +222 | +199 | +77 | +61 |
| about <br><small>savefail</small> | +319 | +248 | +291 | +226 | +157 | +95 | +104 | +67 | +85 | +23 | +42 | +5 |
| email <br><small>savefail</small> | +482 | +455 | +306 | +287 | +268 | +245 | +139 | +123 | +196 | +115 | +77 | +61 |
| review <br><small>normal</small> | +502 | +466 | n/a | n/a | +277 | +217 | n/a | n/a | +205 | +123 | n/a | n/a |
| live <br><small>normal</small> | +2 | +2 | n/a | n/a | +0 | +0 | n/a | n/a | +0 | +0 | n/a | n/a |
| home (may scroll) <br><small>empty</small> | **-488** | **-686** | n/a | n/a | **-669** | **-953** | n/a | n/a | **-813** | **-1209** | n/a | n/a |

Picker regions that scroll internally (the page itself never does). None without the keyboard
except the Find results list at 320 / 130% with four results, which is a list by nature:

  nat 360 kb 130% (box 139, content 244);
  nat 320 kb 100% (box 88, content 244);
  nat 320 kb 130% (box 77, content 244);
  langs 360 kb 130% (box 137, content 144);
  langs 320 kb 100% (box 109, content 144);
  langs 320 kb 130% (box 75, content 144);
  styles 360 kb 130% (box 139, content 194);
  styles 320 kb 100% (box 88, content 194);
  styles 320 kb 130% (box 55, content 194);
  find 360 kb 100% (box 171, content 215);
  find 360 kb 130% (box 165, content 326);
  find 320 130% (box 293, content 422);
  find 320 kb 100% (box 109, content 248);
  find 320 kb 130% (box 103, content 422);
  create-city 320 kb 100% (box 88, content 94);
  create-city 320 kb 130% (box 77, content 94)

<details><summary>Every screen x state (same columns)</summary>

| Screen | State | 390 | 390 130% | 390 kb | 390 kb 130% | 360 | 360 130% | 360 kb | 360 kb 130% | 320 | 320 130% | 320 kb | 320 kb 130% |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| welcome | normal | +482 | +410 | n/a | n/a | +237 | +192 | n/a | n/a | +133 | +108 | n/a | n/a |
| welcome | loading | +542 | +542 | n/a | n/a | +307 | +307 | n/a | n/a | +235 | +235 | n/a | n/a |
| welcome | error | +586 | +575 | n/a | n/a | +347 | +315 | n/a | n/a | +275 | +243 | n/a | n/a |
| find | normal | +618 | +602 | +347 | +340 | +386 | +373 | +177 | +171 | +314 | +301 | +115 | +109 |
| find | loading | +618 | +602 | +347 | +340 | +386 | +373 | +177 | +171 | +314 | +301 | +115 | +109 |
| find | error | +618 | +602 | +347 | +340 | +386 | +373 | +177 | +171 | +314 | +301 | +115 | +109 |
| find | empty | +618 | +602 | +347 | +340 | +386 | +373 | +177 | +171 | +314 | +301 | +115 | +109 |
| create-name | normal | +591 | +569 | +324 | +312 | +363 | +319 | +156 | +145 | +291 | +247 | +94 | +83 |
| create-name | savefail | +572 | +545 | +306 | +287 | +346 | +297 | +139 | +123 | +274 | +225 | +77 | +61 |
| create-city | normal | +626 | +611 | +324 | +312 | +391 | +378 | +156 | +145 | +319 | +306 | +94 | +83 |
| create-city | error | +626 | +611 | +324 | +312 | +391 | +378 | +156 | +145 | +319 | +306 | +94 | +83 |
| create-city | empty | +593 | +573 | +298 | +281 | +365 | +326 | +132 | +95 | +293 | +254 | +70 | +33 |
| create-city | savefail | +607 | +586 | +306 | +287 | +374 | +356 | +139 | +123 | +302 | +284 | +77 | +61 |
| contact | normal | +491 | +434 | n/a | n/a | +266 | +253 | n/a | n/a | +194 | +123 | n/a | n/a |
| contact | loading | +509 | +509 | n/a | n/a | +279 | +279 | n/a | n/a | +207 | +207 | n/a | n/a |
| contact | error | +547 | +517 | n/a | n/a | +314 | +287 | n/a | n/a | +225 | +215 | n/a | n/a |
| contact | savefail | +444 | +376 | n/a | n/a | +226 | +203 | n/a | n/a | +154 | +73 | n/a | n/a |
| contact-phone | normal | +591 | +569 | +324 | +312 | +363 | +345 | +156 | +145 | +291 | +251 | +94 | +61 |
| contact-phone | savefail | +572 | +545 | +306 | +287 | +346 | +323 | +139 | +123 | +274 | +251 | +77 | +61 |
| contact-email | normal | +591 | +569 | +324 | +312 | +363 | +345 | +156 | +145 | +291 | +273 | +94 | +83 |
| contact-email | savefail | +572 | +545 | +306 | +287 | +346 | +323 | +139 | +123 | +274 | +251 | +77 | +61 |
| whatsapp | normal | +596 | +539 | n/a | n/a | +374 | +328 | n/a | n/a | +302 | +256 | n/a | n/a |
| whatsapp | savefail | +550 | +482 | n/a | n/a | +334 | +278 | n/a | n/a | +262 | +206 | n/a | n/a |
| cat | normal | +397 | +359 | n/a | n/a | +201 | +146 | n/a | n/a | +129 | +47 | n/a | n/a |
| cat | loading | +532 | +526 | n/a | n/a | +298 | +293 | n/a | n/a | +226 | +221 | n/a | n/a |
| cat | error | +634 | +599 | n/a | n/a | +391 | +359 | n/a | n/a | +302 | +287 | n/a | n/a |
| cat | empty | +397 | +359 | n/a | n/a | +201 | +146 | n/a | n/a | +129 | +47 | n/a | n/a |
| cat | savefail | +378 | +335 | n/a | n/a | +184 | +124 | n/a | n/a | +112 | +25 | n/a | n/a |
| link | normal | +591 | +569 | +324 | +312 | +363 | +345 | +156 | +145 | +291 | +273 | +94 | +83 |
| link | savefail | +572 | +545 | +306 | +287 | +346 | +323 | +139 | +123 | +274 | +251 | +77 | +61 |
| logo | normal | +551 | +530 | n/a | n/a | +343 | +325 | n/a | n/a | +271 | +253 | n/a | n/a |
| logo | savefail | +532 | +505 | n/a | n/a | +326 | +303 | n/a | n/a | +254 | +231 | n/a | n/a |
| name | normal | +623 | +607 | +310 | +297 | +382 | +369 | +144 | +131 | +310 | +297 | +82 | +69 |
| name | loading | +654 | +654 | +329 | +329 | +407 | +407 | +161 | +161 | +335 | +335 | +99 | +99 |
| name | error | +662 | +632 | +337 | +307 | +414 | +387 | +168 | +141 | +325 | +315 | +89 | +79 |
| name | empty | +569 | +543 | +261 | +237 | +335 | +313 | +99 | +77 | +263 | +241 | +37 | +15 |
| name | savefail | +576 | +549 | +269 | +244 | +342 | +319 | +106 | +83 | +270 | +247 | +44 | +21 |
| photo | normal | +524 | +497 | n/a | n/a | +302 | +277 | n/a | n/a | +230 | +205 | n/a | n/a |
| photo | savefail | +524 | +497 | n/a | n/a | +302 | +277 | n/a | n/a | +230 | +205 | n/a | n/a |
| role | normal | +583 | +554 | n/a | n/a | +294 | +269 | n/a | n/a | +222 | +171 | n/a | n/a |
| role | savefail | +564 | +530 | n/a | n/a | +277 | +247 | n/a | n/a | +205 | +149 | n/a | n/a |
| nat | normal | +2 | +2 | +324 | +312 | +0 | +0 | +156 | +145 | +0 | +0 | +94 | +83 |
| nat | empty | +2 | +2 | +324 | +312 | +0 | +0 | +156 | +145 | +0 | +0 | +94 | +83 |
| nat | savefail | +2 | +2 | +306 | +287 | +0 | +0 | +139 | +123 | +0 | +0 | +77 | +61 |
| langs | normal | +2 | +2 | +347 | +340 | +0 | +0 | +177 | +143 | +0 | +0 | +115 | +81 |
| langs | empty | +2 | +2 | +347 | +340 | +0 | +0 | +177 | +143 | +0 | +0 | +115 | +81 |
| langs | savefail | +2 | +2 | +306 | +287 | +0 | +0 | +139 | +95 | +0 | +0 | +77 | +33 |
| teach | normal | +604 | +589 | n/a | n/a | +379 | +353 | n/a | n/a | +306 | +281 | n/a | n/a |
| teach | empty | +604 | +589 | n/a | n/a | +379 | +353 | n/a | n/a | +306 | +281 | n/a | n/a |
| teach | savefail | +585 | +564 | n/a | n/a | +362 | +331 | n/a | n/a | +289 | +259 | n/a | n/a |
| levels | normal | +467 | +391 | n/a | n/a | +238 | +182 | n/a | n/a | +163 | +38 | n/a | n/a |
| levels | savefail | +448 | +366 | n/a | n/a | +221 | +160 | n/a | n/a | +146 | +38 | n/a | n/a |
| styles | normal | +2 | +2 | +324 | +312 | +0 | +0 | +156 | +145 | +0 | +0 | +94 | +61 |
| styles | empty | +2 | +2 | +324 | +312 | +0 | +0 | +156 | +145 | +0 | +0 | +94 | +61 |
| styles | savefail | +2 | +2 | +306 | +287 | +0 | +0 | +139 | +123 | +0 | +0 | +77 | +61 |
| years | normal | +529 | +483 | +324 | +287 | +311 | +271 | +156 | +123 | +239 | +199 | +94 | +61 |
| years | savefail | +510 | +483 | +306 | +287 | +294 | +271 | +139 | +123 | +222 | +199 | +77 | +61 |
| about | normal | +365 | +305 | +332 | +279 | +197 | +145 | +142 | +115 | +125 | +73 | +80 | +53 |
| about | savefail | +319 | +248 | +291 | +226 | +157 | +95 | +104 | +67 | +85 | +23 | +42 | +5 |
| email | normal | +528 | +512 | +347 | +340 | +308 | +295 | +177 | +171 | +236 | +165 | +115 | +109 |
| email | savefail | +482 | +455 | +306 | +287 | +268 | +245 | +139 | +123 | +196 | +115 | +77 | +61 |
| review | normal | +520 | +490 | n/a | n/a | +294 | +239 | n/a | n/a | +222 | +123 | n/a | n/a |
| review | loading | +589 | +584 | n/a | n/a | +350 | +345 | n/a | n/a | +278 | +251 | n/a | n/a |
| review | error | +634 | +599 | n/a | n/a | +391 | +359 | n/a | n/a | +302 | +265 | n/a | n/a |
| review | empty | +520 | +490 | n/a | n/a | +294 | +239 | n/a | n/a | +222 | +123 | n/a | n/a |
| review | savefail | +502 | +466 | n/a | n/a | +277 | +217 | n/a | n/a | +205 | +123 | n/a | n/a |
| review | done | +548 | +523 | n/a | n/a | +317 | +219 | n/a | n/a | +228 | +147 | n/a | n/a |
| live | normal | +2 | +2 | n/a | n/a | +0 | +0 | n/a | n/a | +0 | +0 | n/a | n/a |
| live | done | +2 | +2 | n/a | n/a | +0 | +0 | n/a | n/a | +0 | +0 | n/a | n/a |
| live | alreadylive | +2 | +2 | n/a | n/a | +0 | +0 | n/a | n/a | +0 | +0 | n/a | n/a |
| home | normal | **-376** | **-565** | n/a | n/a | **-563** | **-836** | n/a | n/a | **-707** | **-1070** | n/a | n/a |
| home | loading | +424 | +358 | n/a | n/a | +198 | +138 | n/a | n/a | +88 | +18 | n/a | n/a |
| home | error | +496 | +400 | n/a | n/a | +263 | +176 | n/a | n/a | +136 | +56 | n/a | n/a |
| home | empty | **-488** | **-686** | n/a | n/a | **-669** | **-953** | n/a | n/a | **-813** | **-1209** | n/a | n/a |
| home | done | +169 | +100 | n/a | n/a | **-55** | **-136** | n/a | n/a | **-127** | **-208** | n/a | n/a |
| home | graceover | **-376** | **-565** | n/a | n/a | **-601** | **-858** | n/a | n/a | **-724** | **-1070** | n/a | n/a |

</details>

Re-run: `node drive.js docs/design/onboarding-prototype.html audit.json` with the driver below
(kept out of the repo on purpose; the audit itself lives in the HTML):

```js
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('file://' + path.resolve(process.argv[2]));
  for (const s of await pg.evaluate(() => window.__proto.screens()))
    for (const size of ['390','360','320']) for (const ts of ['100','130']) for (const kb of (s.field ? [false,true] : [false])) {
      await pg.reload();
      console.log(JSON.stringify(await pg.evaluate(([id,size,ts,kb]) => { const P = window.__proto; P.setCheck(size, ts, kb); P.show(id); return P.audit(); }, [s.id,size,ts,kb])));
    }
  await b.close(); })();
```

## 4. Assumptions (need a decision before build)

1. **Contact by email.** The plan (A6) says the contact email is set by the team and never asked.
   "Use an email instead" is drawn for pages with no number. Decide: ask when there is no phone, or
   phone only (then drop screen 5c).
2. **Five category cards.** The brief caps tap cards at four; the data has five values. Drawn as
   five and measured to fit everywhere in Short text. Alternative: merge Promoter and Festival Brand
   (product + data decision), or make the fifth a "More" sheet (worse: hides a real value).
3. **Claim code.** The claim sheet shows the existing email-code proof (6 digits to the mailbox on
   the page). If the page has no mailbox the real app falls back to Ask to join; not drawn.
4. **Grace length** is drawn as 14 days from the day the screens ship (plan Q1 still open). "Last
   day" wording not drawn.
5. **Go-live in an ambassador city** (plan Q2) not drawn; the celebration would read "Sent for
   review" with the same layout.
6. **DJ question** (plan A4) not drawn separately: same two cards as Teaching, then genre chips.
7. **City** is asked on Create and not asked again; a person claiming a page keeps the page's city.
8. **Sign-in email** screen never changes the login email itself (auth flow, out of scope).
9. **Keyboard heights** are simulated: 336 / 270 / 260 px for the three sizes (iPhone 14 with the
   QuickType bar, a typical Android, iPhone SE 1st gen). Real heights vary by keyboard; the rule that
   matters is the `max-height: 520px` breakpoint on the visual viewport.
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
- Progress: `ORDER` (22 ids) in the script; width = (index + 1) / 22.
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
- Keyboard: when a field is focused, size the screen to `visualViewport.height` (iOS) or use
  `interactive-widget=resizes-content` (Chrome); the `max-height: 520px` rules then apply.

## 6. Parked ideas (not in the brief, not built)

- Merge Promoter + Festival Brand so category is four cards (product + data decision).
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
- Round 2 (this commit): owner picks as defaults, Not sure yet dropped, 8 screens split into 22,
  thin bar, search + chips + sheet pickers, Review with Show all, size / keyboard simulator, the
  measured no-scroll sweep above.

## Verified / Not verified

Verified: everything in section 3, on this file, in Chromium, offline, with the system-ui font;
file size 132 KB (< 600 KB); no non-ASCII characters in the source; JS parses; 0 page errors across
748 audits and the click-through.

Not verified: a real phone keyboard (the heights are simulated); the Outfit font at 320 / 130%
(system-ui measured); Safari and Firefox (container queries need Safari 16+, Firefox 110+); the
sheets' own content heights at 130% on 320x568 (sheets may scroll by the brief, so not measured);
Home's content against real event data (it may scroll); the Vercel preview (docs-only, no build
impact; no Vercel token in this environment).
