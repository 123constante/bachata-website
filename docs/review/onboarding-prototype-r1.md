# Onboarding prototype, independent critique, round 1

Reviewed: `docs/design/onboarding-prototype.html` + `.md` on `claude/p3-onboarding-prototype`
(PR #1124, head `8bae8e3`), against `briefs/p3-onboarding-prototype.md` (branch
`brief/p3-onboarding-prototype`) and `docs/plans/onboarding-arc.md` section 5 and Appendix A on `main`.
Line numbers below are in the prototype HTML at `8bae8e3`. The prototype was not edited.

## Verdict: BLOCK (one-line fix, then PASS with should-fix)

The prototype is good work: contrast, tap sizes, no sideways scroll, reduced motion, focus rings and the
Back chain all pass my own checks. But one CSS bug makes three screens show the wrong thing, and the
designer's own checks did not catch it: anything with the `hidden` attribute whose class sets `display`
stays on screen. The owner would be approving a Contact screen with both the phone and the email box
open, a Teach screen that still shows the levels after "No", and a banner whose cross does not hide it.
The fix is one line (fix 1). After that, fixes 2 to 11 are should-fix, and the fix round in the
designer brief covers them.

## Ordered material fixes

1. **`hidden` is overridden by `display`, so three toggles do nothing (BLOCK).** Measured in Chromium:
   `#teach-more` (`hidden=true`, computed `display:flex`, 631 px tall, still shown after tapping "No"),
   `#ct-phone-edit` plus the Contact email field (both shown on the Phone tab, before tapping Change), and
   `#grace` (`.banner { display:flex }` line 201; after the cross at line 801 it is `hidden=true` but still
   140 px tall, while the toast says "Hidden for today"). **How:** add `[hidden] { display: none !important; }`
   next to the variant rules (line ~52), then re-run the designer's own 130%, 320 px and contrast sweep,
   because those passed with the extra fields showing.
2. **The grace banner and gate go against the plan's rollout.** Plan section 5, stages 1 and 2: "editing
   still works" during grace, and the banner adds "From <weekday> <date> you will need these". The
   prototype says "Finish your page to add events" with "12 days left", and **Add an event opens the gate
   at 12 days** (line 802). That is the stage 3 behaviour. **How:** during grace, Add an event goes through
   (the "not in this prototype" toast); the banner reads "Finish your details to create and edit events.
   From Monday 16 November you&rsquo;ll need them." (Appendix A0) with the days-left pill kept; add a
   drawer state "Grace ended" in which Add an event opens the gate (A1).
3. **Appendix A5 "Your page" is missing, so Go live lights up without data the plan requires.** A5 asks for
   logo, one link ("at least one"), city and Category (five options). None of these is on any screen or
   on the Review list, and Go live is enabled once the dancer steps are done (walked: Review shows Page,
   Contact, You, Teaching, About, Personal email; Go live `aria-disabled=false`). City has also moved from
   You (A2) to Create (`.md` section 3 item 7). **How:** draw an A5 step (Category as 5 tap cards, one-link
   field, logo upload) between Contact and You, add its rows to Review and Home, and make the dots 8;
   or, if left out on purpose, list it in the `.md` section 3 as an owner decision, not under "Parked".
4. **"Not sure yet" cannot be built cheaply, and option (b) breaks completion.** Stored values are only
   `['Leader', 'Follower', 'Lead and Follow']` (`src/modules/organiser/wizard/dancerApi.ts:18`). With (b),
   `dance_role = null`, `organiser_onboarding_status_v1().missing[]` would keep listing the role, so the
   person could never go live, unless the status RPC changes as well (an admin-repo migration). **How:** in
   `.md` section 3 item 1, state that (b) also needs a status-RPC change, and recommend (c) "drop the
   card for launch". If Review accepts `unsure` as done (not checked), make it count as missing, so the prototype does not show a state the
   backend cannot produce.
5. **Contact needs two taps where the plan says one.** "Yes, that&rsquo;s right" keeps you on Contact, and
   then Continue is needed (walked: tap Yes, still on `contact`). Appendix A6: "Yes, that&rsquo;s right
   (one tap)". **How:** make Yes save and move on (with the Nice one), and keep Continue for the Change
   and Email paths. This fits the owner's "quick".
6. **"View my page" goes to Home** (line 592 `data-go="home"`). The label promises the public page. **How:**
   open the existing `viewpage` sheet ("public page, not drawn"), with a "Go to Home" ghost button under
   Share. Also, the Share URL at line 797 uses `/organiser/<slug>`, but the real route is `/organisers/:id`.
7. **True black is a change to the whole P3 dark palette, not just the onboarding screens.** P3 dark today
   is `--bg #202226 / --card #2a2d32` (`p3.css` lines 30-44). The prototype also draws Home in true black,
   with opaque tints (`--warn-bg #3a2113`, `--ok-bg #0f2a1d`, `--cancel-bg #3a1d19`) where P3 uses rgba.
   The `.md` section 6 line "otherwise keep P3's `#202226`" goes against a binding owner decision. Doing
   true black in onboarding only would add a colour change at the step from onboarding to Home. **How:** say
   in section 6 that the prototype's dark block replaces P3's dark block for every P3 surface (one token
   set), and that the build re-runs contrast on all P3 screens.
8. **The font and type tokens differ from P3, and the clipping checks used the wrong font.** P3 uses
   `"Outfit", system-ui` (`p3.css:25`); the prototype uses only system-ui (fine for a file with no network).
   The prototype also changes `--fs-body` 16 to 17, `--fs-title` 22 to 24, adds `--r-tile` and `--fs-h2`,
   and drops `--tab` and `--danger-fg`. **How:** list these as deliberate token deltas in `.md` section 6
   (onboarding-only, or P3-wide), and add "320 px / 130% not checked with Outfit" under Not verified.
9. **Unclear copy.** (a) Create with a 2-letter name shows two different sentences for one problem:
   "A bit longer, please: three letters or more." beside the field, and "The name needs three letters or
   more." above the button. Keep one wording. (b) Contact says "Your sign-in email stays private (step 6)".
   The step number changes when steps are skipped (the dots shrink per person), so say "(we ask later)".
   (c) Home has two different "Settings" (top icon opens the settings sheet, tab bar opens "Not in this
   prototype"); point the tab at the same sheet.
10. **Appendix A states that are not drawn.** Offline save ("keep input, show the error, Continue stays
    enabled"), A2's "only missing fields first + Show all", and the live organiser's "All done. You can
    create and edit events now." + Add an event (only a devnote at line ~589). **How:** add "Save failed"
    to the drawer's States for each step, and an "Already live" state for `live`.
11. **The 130% check only scales the token sizes.** `--ts` multiplies the `--fs-*` tokens. Hard-coded sizes
    (`.flag` 22 px line 235, `.chip-flag` 18 px line 164) do not scale, but Android's system font scaling
    does scale them. The risk is low (they are flags), but the `.md` claim "no clipped text at 130%" should
    say how the check was done.

## Owner decisions (brief), one by one

| Decision | Result | Evidence |
|---|---|---|
| Mood clean and calm, three-mood picker | met | `mood` screen; calm is the default (`data-mood="calm"`, line 2) |
| Feeling quick, minimum questions per screen | met, but see fix 5 | one group per screen; Contact needs an extra tap |
| Voice playful, audience confident | met | "A bit about you", "Nearly there", "You&rsquo;re live"; no jargon outside devnotes |
| Progress dots or thin bar | met | dots + "3 of 7" |
| Every optional step skippable | met | About "Skip for now"; personal email marked optional; Review "optional" rows |
| Back button always | met | Back chain from Review: email > about > teach > you > contact > welcome > mood; no Back on Live/Home (by design) |
| Light by default, toggle, true black dark | met in the file (see fix 7 for the build) | JS forces `light` unless saved (line 719); dark `--bg #000000` |
| One big full-width button at the bottom | met | `.foot .btn` 358x52 at 390 px |
| Small friendly icons | met | inline SVG symbols |
| Accent unchanged | met | `--gold #f0703a`, `--gold-fg #a8461a` / `#f5865a`, identical to `p3.css:17,32` |
| Text comfortably large | met | body 17 px (see fix 8) |
| Errors beside the field, plain words | met | `errAt()`; Create, You, Teach, Email errors seen beside fields |
| Optional fields say "optional" | met | |
| Nice one: tick pop, bounce, Android vibration, no iPhone promise | met | `nice()` line 660, `vibrate(12)` |
| Animation medium, reduced motion honoured | met | measured: under `reduce`, step `animation-name: none`, confetti `display: none` |
| Level picker: big cards, one line, tick several | met | 4 tiles 2-across, multi-select |
| Go live: confetti + "You&rsquo;re live" + View my page + Share | partly | View my page goes to Home (fix 6) |
| Photo required, camera or gallery, round preview, crop | met | `capture=user` set for camera (line 761), crop sheet, sample photo |
| Grace banner, days left, dismissible | **not met** | dismiss is broken (fix 1); the gate happens too early (fix 2) |
| English only, survives longer words | met | `overflow-wrap: anywhere`; no clipping at 320/130% (my run) |
| Arrival from invite names the inviter | met | "Ana invited you to help run Bachata Nights Leeds" |
| Variants drawer: 2-3 corners, 2 text amounts | met | measured: soft 8/10 px, round 15/20 px, pill 999/24 px; short hides all 16 `.tx-l` |
| Role cards incl. "Not sure yet" marked as an assumption | met | "needs decision" badge + devnote (see fix 4 for the build) |
| Nationality: flags, type-to-jump, popular first, chip | met | |
| Languages: chip row, More languages sheet, removable chips | met | |
| Screens 0-10 incl. states and dark | partly | A4 DJ, A5 page, offline save not drawn (fixes 3, 10) |

## My checks (Playwright + Chromium, offline, 2026-10-28)

| Check | Result |
|---|---|
| Contrast >= 4.5: every visible text node on all 12 screens x normal/loading/error/empty states, light and true-black dark, 390 and 320 | **0 failures** (alpha composited against the real ancestor background) |
| Tap targets >= 44 px (buttons, inputs, radios, checkboxes, switches) | pass; the only items under 44 px are `<label for>` text (17-23 px tall), and their inputs are 44+ |
| Horizontal scroll at 390 and 320, at 100% and 130% | none |
| Clipped text (overflow other than visible, scrollWidth > clientWidth) | only the `.sr` visually-hidden span (intended) |
| Reduced motion | pass (see table above) |
| Focus visible | the first 10 Tab stops on You all have a 2 px solid outline |
| Reachable by tapping from the start | pass: mood > welcome > contact > you (photo via gallery sheet > sample > crop) > teach > about > email > review > live > home; find via "That&rsquo;s not my page" > Find my page; claim sheet (wrong code shows "That code didn&rsquo;t match&hellip;", 123456 goes on to Contact); create (errors shown); Home gate sheet; tab sheets |
| JS errors | none |
| Hidden elements still shown | **3 (fix 1)** |
| ASCII-only source | pass (0 non-ASCII bytes; entities used). Note for JSX: the copy uses `&rsquo;`/`&ldquo;`, which carries over as is |
| Size | 109,062 bytes (limit 600 KB) |

## Build cost and first-load notes

- **Database:** "Not sure yet" has no stored value (fix 4). Everything else maps to existing or planned
  RPCs (per the `.md` section 6 list; A5 fields not checked against the schema).
- **First load:** keep `Confetti` and `CropSheet` behind a dynamic import in the onboarding route, never in
  the app shell. Flags come from code points (zero bytes). The nationality and 38-language lists are a few
  KB, so ship them with the sheet chunk, not `lib-event-rules` or a vendor chunk. Check that the onboarding
  route adds no new manual chunk (CLAUDE.md, request-count budget).
- **Photo crop:** pointer drag + zoom, then a 320 px JPEG from canvas. No library needed. Low cost.
- **Web Share / vibrate:** feature-detected. Fine.

## What the owner should look at first

Wait for fix 1 before judging the Contact, Teach and Home screens: today they show extra fields, and a
banner that will not close, because of one CSS line. Then look at two product questions, not design ones:
should Add an event really be blocked while the 14 days are still running (the plan says no, fix 2), and
should the page details (category, one link, logo) be part of this flow before Go live (fix 3). After
that, use the Design options drawer to pick corners and text amount, and answer "Not sure yet" (I
recommend dropping it for launch).

## Verified / Not verified

Verified: the items in "My checks" above, run by me on the file from `8bae8e3` in headless Chromium,
offline. Not verified: a real phone (vibration, camera capture, Web Share), the Outfit font, screen
readers, Windows flag rendering, and live DB constraints on `dance_role` (taken from the code, not
queried).
