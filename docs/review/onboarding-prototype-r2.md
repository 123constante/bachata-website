# Review: onboarding prototype, round 2 (independent critique)

Reviewed: `docs/design/onboarding-prototype.html` + `.md` on `claude/p3-onboarding-prototype`
at `5e10d81` (PR #1124, head after dt_2089206ffa4d). Brief: `briefs/review-onboarding-prototype-r2.md`.
Reviewer did not build it and did not edit it. Ticket dt_80cd2722c8f7.

Method: Playwright + Chromium, offline, 2026-10-29. My own measuring scripts (not the file's
`__proto.audit()`), using only `__proto.show / setCheck / applyState` to reach a screen and state.
Fit = `.main` `scrollHeight - clientHeight` (>0 = page scroll), `.scr` the same, "room" = content
bottom minus the lowest visible item, and the height of every visible `.scrollbox`. Clicks are real
Playwright clicks. 888 fit cells per run (23 onboarding screens x normal / savefail / empty / error
x 3 sizes x 100 / 130% x keyboard where the screen has a field).

## Verdict: PASS with should-fix

Every owner pick is met in the prototype as drawn, and the worker's measured table reproduces
exactly at the three device sizes. Two things should be fixed before this becomes the build spec:
the no-scroll rule is only proven for full-screen device sizes, not for a phone browser's real
viewport (fix 1), and the picker list collapses to less than one chip row under the keyboard on
the smallest phone (fix 2). If the owner reads "no page scroll at 320x568" as "on my phone in
Safari", fix 1 is a blocker.

## 1. Owner picks

| Pick | Result | Evidence |
|---|---|---|
| Corners softer / pill | Met | `data-corners="pill"` default: buttons, inputs, chips 999px, cards 24px, tiles 20px, sheets 32px. |
| Short text | Met | `data-text="short"` hides every `.tx-l`; each screen = title + control + at most one helper line (copy dump below). |
| Calm mood | Met | `data-mood="calm"` default; mood picker screen removed. |
| No "Not sure yet" | Met | Role screen: Leader, Follower, Both only. |
| No page scroll (390x844, 360x640, 320x568, 130%, keyboard) | Met at device sizes; not met at browser viewports | 0 of 888 cells scroll at the three sizes. At the visible height a phone browser actually gives (fix 1) 34 of 888 cells scroll, worst 59 px. |
| One question per screen | Met | 22 onboarding screens; Years keeps a "More (optional)" sheet, which is a second question behind a link (acceptable). |
| Nationality / languages = search + ~6 chips + picker sheet | Met | 6 popular big chips + "All countries" / "More languages" sheet; typing filters to six. |
| Field and big Continue move above keyboard | Met (simulated) | Footer is `flex: none`, keyboard is the frame's last child; the footer stayed fully inside the stage in all 888 cells. Real iOS behaviour not proven (fix 5). |
| Dark mode true black | Met, but not the default for a dark-mode phone | Dark tokens: `--bg #000000`. Line 892 forces `data-theme="light"` on first load even when the device is in dark mode (fix 4). |
| English only | Met | `lang="en-GB"`, no language switch. |
| Photo required | Met | Photo Continue is `aria-disabled` until a photo is set; tapping it explains why. Copy contradicts the other required screens (fix 3). |
| Go-live confetti + "You're live" | Met | Live screen title "You're live", canvas confetti shown; hidden under reduced motion. |
| Friendly dismissible grace banner | Met | Home banner with a 44x44 close; "12 days left" pill; the close changes state (dead-button probe). |
| Level picker = big tap cards | Met | 4 cards 2x2, 72 px tall (64 px on compact), each with a one-line explanation. |
| Medium animation | Met | 260 ms slide, tick pop, button bounce, confetti; all off under `prefers-reduced-motion` (measured: screen animation `none`, confetti `display: none`, tick `none`). |

## 2. Re-measured fit table (the tightest cells)

Worker's "room" vs mine, same file, same sizes, keyboard simulated by the file's keyboard
(336 / 270 / 260 px). All 12 agree to the pixel; `.main` overflow is 0 in each.

| Cell | Worker | Mine (room) | `.main` overflow |
|---|---:|---:|---:|
| about 320 kb 130% savefail | +5 | +5 | 0 |
| name 320 kb 130% empty | +15 | +15 | 0 |
| name 320 kb 130% savefail | +21 | +21 | 0 |
| about 320 130% savefail | +23 | +23 | 0 |
| cat 320 130% savefail | +25 | +25 | 0 |
| name 320 kb 100% empty | +37 | +37 | 0 |
| levels 320 130% normal | +38 | +38 | 0 |
| about 320 kb 100% savefail | +42 | +42 | 0 |
| cat 320 130% normal | +47 | +47 | 0 |
| about 360 kb 130% savefail | +67 | +67 | 0 |
| create-city 320 kb 130% empty | +33 | room 0, picker box 27 px | 0 |
| langs 320 kb 130% savefail | +33 | room 0, picker box **27 px** showing 144 px of chips | 0 |

Disagreement (the last two rows): the worker's "room" skips the `.scrollbox`, so "+33" reads as
spare space. In fact the picker region is 27 px tall, less than one 44 px chip, so the language
matches are cut through the middle and need an internal scroll to see any of them. Nationality and
styles at 320 kb 130% get 55 px (one row). That is fix 2.

Browser viewport re-run (same scripts, frame height set to what the browser leaves, keyboard
included): 390 = 664 px visible / 410 px with keyboard (iPhone 14 Safari with its toolbars);
360 = 560 / 290 (Android Chrome, status + URL bar); 320 = 460 / 244 (iPhone SE Safari). These
heights are my estimates, not device measurements. Result, page scroll:

| Size | Screens that scroll | Worst |
|---|---|---|
| 320 kb 130% | create-name, create-city, contact-phone, contact-email, link, name, nat, langs, styles, years, about, email | about savefail -59 px, name empty -49 px |
| 320 130% (no keyboard) | cat | savefail -48 px |
| 360 kb 130% | name, about | about savefail -13 px |
| 320 kb 100% | name, about | name empty -27 px, about savefail -22 px |

And the picker region falls to 0-9 px (nat, langs, styles, city at 320 kb; langs at 360 kb 130%).
390 at every setting still fits.

## 3. Reach, Back, buttons, taps, contrast, motion, focus, overflow

- Reach by taps from Welcome: invite path Welcome > Contact > WhatsApp > Category > Link > Logo >
  Name > Photo (sample photo + crop) > Role > Nationality > Languages > Teach > Levels > Styles >
  Years > About > Email > Review > Go live > You're live > Home. Direct path: "That's not my page"
  sheet > Find my page > Find > search > Claim sheet, Ask to join sheet, "Not listed? Create a page"
  > Name > City > Create page. "Change number" > Phone; "Use an email instead" > Contact email.
  All 24 screens reached. 0 page errors.
- Back: present and working on every screen except Welcome (first) and You're live (after going
  live; it offers Home). Back from Logo walked 5 steps to Welcome correctly. Acceptable.
- Dead buttons: clicked every visible button on every screen from a fresh load and compared the
  whole frame + state. One "no change": WhatsApp "Yes", which is pre-selected. Not a defect.
- Taps >= 44 px: every screen at 320, 100% and 130%, light and dark: 0 failures. Sheets: the sheet
  Close button shrinks to **37-38 x 44** at 130% on "Show all" (Review) and "More" (Years), and
  43.x x 44 at 100% on Years (fix 6).
- Contrast (my own WCAG calculation, composited backgrounds), screens + 9 sheets at 320: light min
  5.35, dark min 6.46, 0 text below 4.5 (large 3.0). Matches the worker. The zoom slider's gold
  thumb on white is 2.9:1, under the 3:1 non-text rule (minor, fix 6).
- Reduced motion (`reducedMotion: 'reduce'`): screen slide, tick pop and confetti all off. Met.
- Focus visible: tabbed through all 24 screens, 111 focus stops, every one shows an outline. Met.
- Horizontal scroll at a real 320 x 568 viewport (page width, not the frame): 0 on every screen
  and sheet.

## 4. Material fixes (ordered)

1. **Prove no-scroll at the browser's real viewport, not the device size.** Where: the fit rules
   in the `<style>` block and section 3 of the `.md`. How: add a 4th size (or re-define the three)
   at the visible heights above, and either lower the compact breakpoint (e.g. a `max-height:
   480px` step for 320 Safari: top strip 40, title 18, tile 56) or drop the helper line on
   field screens when the visual viewport is under ~300 px. Re-run the table for the 4 rows above.
   For the build: size the app shell to `100dvh` / `visualViewport.height`, never `100vh`.
2. **Give pickers a minimum height under the keyboard.** Where: `.scrollbox` on nat, langs, styles,
   create-city (and Find). How: `min-height: 52px` (one big chip + gap) and, if that does not fit,
   hide the search helper / "All countries" link under `max-height: 520px` before shrinking the
   list. At 320 kb 130% the language list is 27 px today.
3. **Photo copy contradicts the other required screens.** Where: photo screen "It's the one thing
   we must have." and the Home row "The one thing we must have". Logo, link, category, role,
   nationality, levels, styles and years also block Continue, and Review says "8 things left".
   How: "Dancers like to see who they're meeting." or simply "Add a photo to continue."
4. **Follow the phone's dark mode on first load.** Where: script line 892 sets `data-theme="light"`
   when nothing is saved. How: default to `auto` (the CSS already handles `prefers-color-scheme`);
   keep the Settings switch as an override. If light-by-default is the owner's intent, say so in
   the `.md`.
5. **iOS keyboard needs a real plan.** `interactive-widget=resizes-content` is Chrome only; iOS
   Safari does not resize the layout viewport, scrolls the page to the focused field and leaves
   the footer behind the keyboard. Build needs a `visualViewport` resize listener that sizes the
   shell and resets `window.scrollTo(0,0)`. State this as the build requirement in section 5 and
   test on a real iPhone before calling the pick met.
6. **Small a11y fixes.** `.sheet-close { flex: none; }` so Close keeps 44 x 44 when a sheet title
   wraps at 130%; give the zoom slider a 3:1 thumb (use `--gold-fg`).
7. **Category is five cards, the pick says max four.** Already flagged by the worker (Assumption
   2). It is also the one no-keyboard screen that scrolls at 320 Safari 130% (-48 px). Owner
   decision needed: merge Promoter + Festival Brand, or accept five and shrink the tiles to 56 px
   on compact.
8. **Progress bar jumps on the common path.** `ORDER` counts contact-phone and contact-email; a
   "Yes, that's right" tap jumps the bar from 4/22 to 7/22, and Teach = No jumps 3 more. Compute
   the bar from the path actually ahead (or count alternatives as one step).
9. **Title Case data values on cards.** "Dance School", "Event Brand", "Festival Brand" against
   sentence case everywhere else. Display-map them ("Dance school") without changing the stored
   values.
10. **Keep the build in px.** The public site sets `html` font-size to ~13.5px on phones
    (CLAUDE.md trap), so a rem port of these px values renders ~16% small and the fit table no
    longer holds. Say "px only" in section 5.

## 5. Costly or impossible to build

- iOS keyboard handling (fix 5): doable, fiddly, must be tested on devices. The single biggest
  build risk for the "field and Continue above the keyboard" pick.
- 22 screens with a save on each Continue = up to 22 writes, each with its own "Couldn't save"
  state. Fine, but cheaper to keep answers client-side and write per group (page / you / teaching)
  with one retry path. Decide before build.
- Haptics on iPhone: impossible on the web (worker already says Android only).
- Flag emoji render as letters on Windows (parked by the worker; minor on a 95% mobile site).
- Container queries map 1:1 to viewport media queries; no cost.

## 6. Copy

Plain, short and British: "Tick all that apply", "organiser", "Couldn't save. Check your connection
and try again." No American spellings found in the visible copy. It reads calm rather than playful,
which matches the calm pick; the one playful beat is "You're live" with confetti. Weak spots: fix 3
(photo), fix 9 (Title Case), and "More (optional): private lessons, where you teach" on Years is the
longest line on any screen; "Add more (optional)" would do.

## What the owner should look at first

1. Open the prototype on the smallest phone you have, in Safari, on the Languages screen, tap the
   search box with large text on: the chip list is a sliver (fixes 1 and 2).
2. The photo screen line "It's the one thing we must have" after six other required screens (fix 3).
3. Put the phone in dark mode and open the file fresh: it opens light (fix 4).

## Verified / Not verified

Verified (Chromium, offline, my scripts): owner picks table; 888-cell fit sweep at the three device
sizes (0 scroll, 12 tightest cells equal to the worker's); 888-cell sweep at estimated browser
viewports (34 scroll); click-through of all 24 screens and the Claim / Ask / Create / Change number /
email paths; every visible button clicked; Back on every screen; taps, contrast (light + dark),
horizontal overflow at 320 on all screens and 9 sheets; focus ring on 111 tab stops; reduced motion.

Not verified: real phones and real keyboards (the browser viewport heights in section 2 are my
estimates); Safari and Firefox engines; the Outfit font; OS-level text scaling (the file simulates
130% by scaling its own font tokens); sheet contents with the keyboard open; the Vercel preview
(docs-only change; no Vercel token checked or needed for a markdown review).
