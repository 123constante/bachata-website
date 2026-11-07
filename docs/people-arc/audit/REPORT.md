# People pages -- P0 audit report

2026-10-23. Read-only audit for the people arc: no product code changed. The pages were captured on local
production builds reading the **prod** database:

- **main**: prod-like flags. The face wall, the hub and the teacher/organiser pages are OFF.
- **#963**: the head of `claude/w2d-hub-build`, with `peopleWall`, `personHub` and the teacher/organiser
  pages ON.

The evidence is in this folder:

| File | What it holds |
|---|---|
| `shots/` | 198 full-page screenshots, at 390x844 and 360x800 |
| `gallery.html` | every screenshot, grouped by shape |
| `measurements.json` | per-page text, fonts, grounds, chips, tap sizes, contrast, clipping |
| `journeys.json` | tap-by-tap walks |
| `shapes.md` | prod counts |

Every finding ends with **Needs:**, which says what kind of decision it needs. The design decisions belong to
the arc, not to this report.

---

## 1. Verdict: what makes it feel patchwork

These are not one product. They are five products that happen to share a database row.

- Each screen was built in its own wave, with its own ground colour, heading font, chip size, Back control and
  copy.
- Every screen also computes the same facts itself (name, gig date, languages, photo, nationality), so they
  disagree:
  - one person is "Papacito" on the dancer page and "Morcilla" on the DJ page and the hub;
  - languages read "es, en" on the hub, "Spanish, English" on the dancer page, and two "es" / "en" pills on the
    teacher page;
  - there are three different no-photo placeholders.
- The ground changes when you move between pages: teal on the dancer page, brown on the hub and the DJ page,
  grey-black on the teacher page. The role bar is a brown band laid over the teal page, and it sits under the
  hero on the teacher page but above it everywhere else.
- The real data is thin, and that is the deeper reason the pages look patchy:
  - 95% of people have no bio, 91% no languages and 89% no nationality;
  - the most common person (36%) is teacher-only, and their page does not open (section 4).

  The pages were designed for a rich profile that almost nobody has, so for most people they show a big card,
  a name and a lot of empty brown.

---

## 2. Facts shown on more than one screen

Paths: `src/...` is the same on both builds. `H:` is the #963 file, and `M:` is the file as it is on main where
the two differ.

| Fact | Where shown | How it reads on each | Disagreement | Code (more than one copy = a finding) |
|---|---|---|---|---|
| **Name** | wall tile, hub h1, dancer h1, DJ h1, teacher hero, role bar "Back to ..." | Wall tile: 11px/700, "DJ " prefix stripped. Hub: 28px black Inter. Dancer: 26px extrabold Inter. DJ: DM Serif Display 36/30px. Teacher: 40px black Inter, followed by an orange "Teacher" | **Papacito** (dancer page) vs **Morcilla** (DJ page and hub h1, with "Papacito" as a sub-name). **John Otaran** (dancer) vs **"Dj O"** (DJ page) vs **"DJ O"** (hub sub-name), which also differ in case. **"DJ Chino"** keeps the prefix on the DJ page, but the wall strips it. Double spaces ("John  Otaran", "Boadicea  Richards") on the dancer and DJ h1 | **3 name paths.** Dancer: masked names RPC, via `modules/profile/dancerPublicProfile.ts` `attachPublicDancerName`. DJ: `get_public_dj_v1` coalesce in `pages/DJProfile.tsx:164`. Teacher: `pages/TeacherProfile.tsx:251` `getPublicName`, with `hide_surname: false` hard-coded at `:159`. The RPC already masks surnames server-side (checked: its body reads `hide_surname`), so this is not a privacy leak, only a third copy. Hub: `H: modules/person-page/hub/model.ts:147`. Wall: `wall/model.ts:64,76` `bareStage`. **Needs:** one name rule (stage name vs real name, prefix, spacing) owned in one place |
| **Roles** | wall chips, hub chips, role bar pills, AlsoBar (flag off), page kicker | Wall: 10px chip, padding 0 5px. Hub: 13px chip, 26px tall. Role bar: 15px pill, 44px tall. Kickers: dancer "DANCER" 11px tracked; DJ "DJ · LONDON" gold; teacher an orange "Teacher" word in the hero | The labels agree (one source: `person-page/badges.ts:104` → `ROLE_LABEL`). The **sizes and shapes do not**: there are 4 chip sizes for one fact, and the kicker is a 4th style. The wall's dancer tiles only get chips when a badge exists (`wall/model.ts:102`) | **Needs:** one chip spec with sizes per context |
| **Next gig date** | DJ wall tile, hub hero/line, DJ page list | main wall: **"Playing soon"**. #963 wall: **"Next gig / Saturday 7 November"**. Hub: **"Next gig Thursday 29 October · 3 coming up"**. DJ page: **"29 / OCT"** date block, with no "next" label | 3 formats. The hub line wraps "up" onto its own line at 390 (screenshot `hub-hub-all3-claimed-rich-390.png`) | Upcoming split computed **twice**: `pages/DJProfile.tsx:180-204` and `H: hub/model.ts:54-60`. Month names **twice**: `H: wall/model.ts:30` (full) and `components/dj/djFormat.ts:7` (short). **Needs:** one date-label function and one "upcoming" rule |
| **Gig count** | hub, DJ page | Hub: " · N coming up" when N > 1. DJ page: no count, but "See N more dates" after 3 rows. main's DJ page (flag off): Gigs/Upcoming stat tiles | Counts agree with the DB on every captured shape (Jeff 4, Ramiro 3, Papacito 2). The wording differs per screen | `H: hub/model.ts:140`, `components/dj/djRoleModel.ts:93`, `components/dj/DjTiles.tsx:220`. **Needs:** decide whether the count is a fact worth showing, and where |
| **Languages** | hub About + Also card, dancer page "SPEAKS", teacher page Languages card | Hub: **"es, en"** (raw codes). Dancer: **"Spanish, English"**. Teacher: two blue pills **"es"**, **"en"** (10px). DJ page: none | 3 renderings of one value; 2 of them show raw ISO codes to the public | Hub `H: hub/model.ts:77-83` joins raw `dj.languages`. Dancer `modules/dancer-app/public-page/model.ts:110-118` maps codes to names. Teacher `pages/TeacherProfile.tsx:449-465` raw. **Needs:** one language formatter (bug-class: raw codes on screen) |
| **Nationality** | wall flag, hub face flag, dancer card flag, DJ record flag, teacher hero text | Flags everywhere except the teacher page, which prints the **code as text: "London · BO"** | The teacher page is the only text rendering, and it shows the raw code. The dancer page computes `model.place` (city · nationality) and never renders it | `NationalityFlag` shared. The teacher one is `pages/TeacherProfile.tsx:270`. **Needs:** flag-or-text rule |
| **Photo** | wall, hub, dancer, DJ, teacher | No-photo placeholders: **wall** initials tile; **hub** initials in a 128px rounded square (`RZ`); **dancer** grey circle with one letter (`D`); **DJ** initials on a vinyl label (`DC`); **teacher** none at all (`photo_url` mapped at `TeacherProfile.tsx:160`, never rendered) | 4 placeholder styles, 3 initials functions (`wall/model.ts:40`, `components/dj/DjTiles.tsx:68`, `PersonAvatar`). When an image URL fails, only the wall and the hub fall back to initials (`H: wall/usePhotoFallback.ts`). The dancer and DJ pages show the browser's broken image with the name as alt text inside the circle (`hub-role-dancer-all3-claimed-rich-390.png`, `hub-role-dj-all3-claimed-rich-390.png`) | **Needs:** one avatar component with one fallback. Note: images failed in this sandbox because image hosts were unreachable, so the *failure* path is what got captured; that path is real on a bad URL |
| **City** | hub About, dancer sub-line, DJ kicker, teacher hero sub-line | "London" / "Leader · London" / "DJ · LONDON" / "London · BO" | The dancer page strips postcodes (`cityOnly`, `public-page/model.ts:177`); the hub does not | **Needs:** one place formatter |
| **Years dancing** | hub About, dancer "Dancing" fact | Hub only when N > 0; dancer shows "0 years" when N = 0 | Disagree at N = 0. The teacher page has years *teaching* on a different level scale (Master/Senior vs Veteran/Experienced) | `H: hub/model.ts:80`, `public-page/model.ts:128-133,276`, `TeacherProfile.tsx:88-91`. No captured shape had years set (survey: almost nobody does). **Needs:** a rule for showing zero, and one level scale |
| **Bio** | DJ "About", teacher "journey" | The dancer page computes `model.bio` (`public-page/model.ts:269`) and **never renders it**; the hub has none | A dancer who writes a bio never sees it published | **Needs:** decide where the bio lives |
| **Contact** | dancer CONTACT list, DJ "Listen & book", teacher Connect + Website cards | Dancer: underlined URL with Copy. DJ: button per link. Teacher: an icon grid **plus** a separate Website card, so the same website shows twice on one page (`hub-role-teacher-all3-claimed-rich-390.png`) | Phone/WhatsApp shows on the dancer page and is dropped on the DJ page. The Instagram handle is derived 3 times (`public-page/model.ts:146`, `DancerProfileGrid.tsx:21`, `TeacherProfile.tsx:56`), and the URL is built 3 times | **Needs:** one contact list model |

---

## 3. Visual seams (measured)

| | Wall `/dancers` `/djs` (#963) | Wall `/teachers` | Hub | Dancer page | DJ page | Teacher page |
|---|---|---|---|---|---|---|
| Ground | animated / `#0A080B`, fading to `#1E1410` | `#0E1215` | `#1E1410` | **`#06191F` teal** | `#1E1410` | **`#0E1215`** |
| h1 | Inter 40.7px | Inter 40.7px | Inter 28px black | Inter 26px extrabold | **DM Serif Display** 36/30px | Inter 40.7px black + orange "Teacher" |
| Card radius | tiles | 10px cards | face 22px, hero card 16px | card 14px, hero 24px | hero 24px, rows 14px | **10px** (rem-based) |
| Chip | 10px, 0 5px, 999 | none | 13px, 26px tall | 15px pill, 44px (role bar) | 15px pill (role bar) | 10px rem pills, 19px tall |
| Back | none | none | "Back" (top-left) | "Back" or "Back to {name}" + role bar | "Back to DJs" or "Back to {name}" + role bar | **below the hero**: role bar sits mid-page |
| Share | -- | -- | none | top-right | **bottom-right**, after the content | none |

- The teachers "wall" on #963 is the old card list (one long column of cards, `hub-wall-teachers-all-390.png`),
  while dancers and DJs are face walls. Three walls means two designs.
- The hub, the DJ page and the dancer page all use a gold-to-footer fade. The dancer page cuts from teal to
  gold with no fade.
- **Needs:** one ground, one type scale, one radius scale and one position for Back/Share across every people
  screen.

---

## 4. Navigation (walked by tapping at 390x844, `journeys.json`)

| Journey | Hops | Result |
|---|---|---|
| #963 `/dancers` → Ramiro (3 roles) tile → `/people/ramiro-zapata` → "Open DJ page" | → `/djs/ramiro-zapata` | **CRASH: "Something went wrong"** |
| #963 `/dancers` → Elias tile → `/people/elias` → Also "Dancer" card | → `/dancers/elias` | **CRASH** (same) |
| #963 `/djs` → Elias → hub → Dancer card | → `/dancers/elias` | **CRASH** (same) |
| #963 `/people/elias` opened directly → Dancer card | → `/dancers/elias` | works |
| #963 `/djs` → Bobby (DJ only) | tile → `/djs/bobby-blanco` (hub skipped), "Back to DJs" → `/djs` | ok |
| #963 `/people/<one-role dancer>` | redirects to `/dancers/unclaimed-00422bf9`, "Back" → `/dancers` | ok |
| #963 `/dancers` → Organisers link | → `/organisers`, browser Back → `/dancers` | ok |
| main `/djs` → Jeff → Back | `/djs/jeff` → `/djs` | ok (no hub, no cross-link to his dancer page) |
| main `/dancers` → Elias → "DJ" chip → Back | `/dancers/elias` → `/djs/elias` → **Back lands on `/djs`, not on Elias's dancer page** | surprise |
| main `/people/jeff` (flag off) | redirects to a role page | ok |

1. **#963 blocker: wall → hub → role page crashes**, 3 of 3 times. The console shows
   `NotFoundError: Failed to execute 'removeChild' on 'Node'`, which React Router catches during render. This
   is a DOM node removed outside React during the route change (suspects: the hub's photo-fallback swap, or the
   page transition). It reproduces only when the hub was reached by in-app navigation; a fresh load of the hub
   works. **Needs:** a fix before #963 merges.
2. **Teacher pages 404 for teacher-only people.** With the teacher pages ON, `/teachers/<id>` 301-redirects to
   the slug and then shows **"Page not found"** for all 3 teacher-only shapes. The same happens to the
   DJ + teacher person (Nickchata). For dancer + teacher people the same route works.
   - That is **63 of 170 live people** (62 teacher-only + 1 DJ + teacher), the biggest group on the site.
   - The hub links Nickchata to "Their teacher page", which is a dead end.
   - **Needs:** a fix before the teacher pages open. The bug is on main too; #963 did not touch the teacher
     code.
3. Back from a role page you reached through another role page goes to that role's wall, not back where you
   came from (main: dancer → DJ → Back = `/djs`). On #963, "Back to {name}" goes to the hub. That is right when
   you came from the hub, and surprising when you came from a wall. **Needs:** one Back rule.
4. On the teacher page the role bar and Back sit *below* the hero, so the first screen has no way back.
5. The archived person 404s on `/dancers`, `/djs` and `/people` on both builds, and on `/teachers` on #963.
   - On main, `/teachers/<archived>` returns **200 "Coming soon -- Teacher"**, because the gate renders before
     the lookup.
   - **Needs:** probably nothing until the teacher pages open. Note that a closed page answers 200 for any id.

---

## 5. Empty and thin states

Most people are thin, so this is the normal case, not the edge case.

- **Dancer page, thin person** (`role-dancer-dancer-nophoto`): a card with a grey letter circle, the name, a
  partner role and the city, then "No public contacts yet. Use Share to send this page to a friend." About 60%
  of the screen above the footer is empty ground.
- **No public role** (6 live people, e.g. `noroles-live`): the dancer URL still renders a page titled
  **"Dancer"**, with a grey "D" and no name. It is a page about nobody. **Needs:** a 404-or-placeholder rule.
- **Hub with no gig**: "No gigs listed right now" sits on the DJ Also card. The lead CTA becomes "Open dancer
  page" with the sub-line "Opens their dancer page: **style, level and how to say hi**", but most dancer pages
  have no style, no level and no contact. That is copy pointing at content that is not there. **Needs:** copy
  that matches the data.
- **Hub About**: for most people it is just "London". Below it is a tall empty band before the footer fade
  (`hub-hub-all3-claimed-rich-390.png`).
- **DJ page, no gig, no photo** (`role-dj-dj-nogig-nophoto`): "No dates booked right now. Check back soon, or
  find a party on the calendar tonight." plus "See the calendar". This is the one empty state that tells the
  person what to do.
- **Teacher page**: an empty "Connect" card with a single globe icon. There is no photo at all, even when one
  exists.
- **Bio, languages and nationality missing**: hidden silently on every screen, which is fine. But the hub's
  About section is then one word.
- **Test-looking rows on the public dancers wall** ("test 4", "Test2", "Ricky sdds", "Doortest", "JJoin1"): the
  wall shows them. **Needs:** a data-cleanup decision, which is the owner's call.

---

## 6. Accessibility and layout (measured on all 198 captures)

- **Tap targets under 44px:**
  - "Get your own card" link: **117x16** on every dancer page and every hub-to-dancer page (56 captures).
  - "Send my details": 117x31 on every "Coming soon" gate.
  - Teacher icon buttons: 59-66 x 30.
  - Teacher "instagram.com" link: 104x17.
  - Organisers wall: "Parties" 39x17, "Join" 52x32.
  - Header "Sign in": 59x31.
  - The DJ page's Instagram and website buttons are 43px tall (1px short).
  - The hub itself has **no** target under 44px.
- **Contrast under 4.5:1:**
  - "Send my details": white on `#F97316`, **2.8:1**, on every Coming-soon gate (24 captures).
  - No other text failed. The check skips text on gradients and images, and the hub hero and the DJ record sit
    on gradients, so those were **not** measured.
- **Clipping:**
  - Dancer-page contact URLs are ellipsised (for example `www.instagram.com/dj_morcilla/?hl=en`, 294px in a
    218px box). The `?hl=en` tracking tail is shown to the public.
  - Organiser wall names are clipped at 122px (e.g. "Agapi Musicality Dance Project", 183px).
  - The organisers wall's header section is 395px wide in a 390px viewport. The page does **not** scroll
    sideways, because overflow is hidden.
  - The hub gig line wraps one word ("up") onto its own line.
- **Sideways scroll:** none on any capture at either width.

---

## 7. What #963 changes vs main, and what to keep

| #963 change | Seen | Keep? |
|---|---|---|
| Face wall on `/dancers` and `/djs` with role chips and the next gig date in full words | yes | **Keep the face wall.** Make `/teachers` match it; it is still the old list |
| Wall gig label "Next gig / Saturday 7 November" (main: "Playing soon") | yes | Keep the real date; "Playing soon" says less |
| Photo fallback that also catches pre-hydration failures (`usePhotoFallback`) | yes; it is the only screen that degrades cleanly | **Keep and make it the one avatar fallback** for every page |
| Hub `/people/:id`: one-role people skip it; multi-role people get hero + CTA + Also cards | yes | The skip rule is sound. The hub *content* is thin for real data (section 5), and the wall → hub → role crash must be fixed first |
| Role bar "Back to {name}" + pills on the role pages | yes | The idea (one person, several pages) is the right spine, but it is a brown band on a teal page, and on the teacher page it is placed below the hero |
| Gig count only from 2, "Friday 23 October" wording | yes | Keep the wording rule. Make it the one date function |
| Removed main's FactsStrip / RoleCard / NextEventButton | yes | Fine. The facts they held now live in the About line |

---

## Verified / Not verified

**Verified:**

- Prod counts (`shapes.md`).
- 198 captures from local production builds on prod reads, at 390x844 and 360x800.
- Tap-walked journeys.
- The #963 crash, reproduced 3 of 3 times from the wall and 0 of 1 from a fresh hub load.
- The teacher-only 404 (4 people of 4 tried).
- Code locations for every fact (traced, with spot checks on the bio, teacher-photo and surname claims).

**Not verified:**

- **The live prod site.** Egress to `bachatacalendar.co.uk` and `api.vercel.com` was blocked, so the prod
  Vercel flag values were inferred: wall, hub and teacher pages OFF.
- **Real photos.** The image hosts were unreachable from the sandbox, so every photo shows its failure path.
- **Contrast on gradients and images.**
- **Lists over the 100-row cap.** The wall tile counts were not checked against the 170 people.
- **A person with a bio.**
- **Real phones.**
