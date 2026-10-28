# Onboarding prototype (P3, design only)

**Open `docs/design/onboarding-prototype.html` on a phone** (or in a desktop browser: it shows a
390x844 phone frame, scaled up on tall screens). One file, inline CSS and JS, no network, no fonts,
121 KB. Nothing is saved or sent. Branch `claude/p3-onboarding-prototype`, PR #1124. Brief:
`briefs/p3-onboarding-prototype.md` on `brief/p3-onboarding-prototype`. Fix round 1 (the only one) applied
the independent critique `docs/review/onboarding-prototype-r1.md` (branch `claude/review-onboarding-prototype`):
section 8 lists what changed per fix.

The owner only needs to: tap through from the first screen, try the **Design options** drawer
(corners, text amount, mood, light/dark), and say which variants to keep. The decisions this file
asks for are in section 5.

---

## 1. What is in it (screen list)

Every screen is reachable by tapping from the start. The **Jump to a screen** list at the top is a
reviewer shortcut, not part of the product.

| # | Screen (`data-id`) | What it shows | States drawn |
|---|---|---|---|
| 0 | `mood` | Three moods (Calm / Playful / Bold) as mini previews of the welcome screen. Tap one, it applies live. | prototype only |
| 1 | `welcome` | Invite-aware welcome: "Ana invited you to help run Bachata Nights Leeds", signed-in line, one big button. Direct arrival (no invite) drops the card and goes to Find your page. | loading, read-error, not-my-page sheet, sign-out sheet |
| 1b | `find` | Search pages by name; rows say Claim / Ask to join / Asked (today's `claimStates.ts` words); "Not listed yet? Create". | typing (skeleton), no match (with Create), offline error, claim sheet with 6-digit code (+ wrong-code error), ask-to-join sheet, asked confirmation |
| 1c | `create` | Page name + city (type-ahead chips). Button disabled with a reason until both are there. | name-too-short error, no-city error, name-taken refusal (Error state) |
| 2 | `contact` | "How can dancers reach Bachata Nights Leeds?" Phone pre-filled with "Is this the best number? Yes / Change"; **Yes saves and moves on in one tap** (A6); Continue stays for Change and Email; WhatsApp switch. | held number, editing number (format error), email (format error), loading, read-error, save failed |
| 3 | `page` | **Your page (A5)**: name shown with "Change name", city held, category as five tap cards (`CATEGORY_OPTIONS`: Dance School, Event Brand, Community Group, Promoter, Festival Brand), one link (website or `@handle`, inline validation), logo upload (gallery, square crop, sample). Button disabled with a reason until all three are there. | no category, bad link, no logo, loading, read-error, empty, save failed |
| 4 | `you` | First name, **photo (required)** with camera / gallery / round crop sheet, dance role tap cards (Leader / Follower / Both / Not sure yet*), nationality (flags, popular first, type-to-jump, shown back as a chip), languages (chip row + More languages search sheet, ticked ones removable). | name empty, photo missing, nationality missing, no language, no match in either search, loading, read-error, save failed |
| 5 | `teach` | "Do you teach?" two cards; if yes: level cards (Beginner / Improver / Intermediate / Advanced, tick several, one-line explanations), style chips, years teaching, "More (optional)" sheet (private lessons, where you teach). | no answer, no level, no style, years out of range, loading, read-error, save failed |
| 5b | `about` | Optional About with a starter sentence built from what was answered; Save or Skip for now. | empty, counter, save failed |
| 6 | `email` | Sign-in email explanation: private, never shown, why we ask; optional personal email with inline validation. | format error, save failed |
| 7 | `review` | "N things left" checklist; missing rows first (amber), done rows (green), optional rows (grey). Every row deep-links to its step. Go live disabled with a reason until nothing is missing. "Not sure yet" counts as missing (section 3). | all done, some missing, everything missing (Empty state), loading, read-error, saving spinner, go-live failed |
| 8 | `live` | Confetti + "You're live" + View my page (opens the public-page sheet) + Share (Web Share API, else copies the link) + Go to Home. | reduced motion: no confetti; **Already live**: "All done. You can create and edit events now." + Add an event (A8) |
| 9 | `home` | Home with the grace banner (A0 copy, "From Monday 16 November you'll need them", days-left pill, Finish your page, dismiss for today), draft/live status, page-completion rows (incl. category, link, logo), empty events card. **During grace "Add an event" goes through** (plan section 5, stages 1-2); after the grace end it opens the gate sheet (A1). Settings icon and Settings tab open the same sheet (dark-mode switch). | banner, banner hidden, **grace ended** (pill "Grace ended", gate on Add an event), all done, no events, loading, read-error, gate sheet |
| 10 | all | Dark mode (true black `#000`) via the top toggle or the in-app Settings switch. Light by default; the choice is remembered on the device. | |

\* "Not sure yet" is a design assumption, see section 3.

**Sheets** (bottom sheets inside the frame): sign out, not my page, claim (code), ask to join, asked,
nationality, more languages, add a photo, crop, more about teaching, gate, settings, public page
(not drawn), other tabs (not drawn). The last two say so in words.

**Flow order and progress** (dots at the top, 8 steps, "3 of 8" beside them): Page, Contact, Your page,
You, Teaching, About, Email, Review. The real app counts only the steps a person still has to see (plan
Appendix A), so the dots shrink for someone who already has most answers.

## 2. Decisions taken (the owner's brief, applied)

- **Mood** clean and calm, voice playful, audience confident. Headings are short and direct
  ("A bit about you", "Nearly there", "You're live"). The mood switch changes only heading weight,
  button shape and a few words; tokens, spacing and layout never change.
- **Quick**: one question group per screen; the held phone number is confirmed in ONE tap (Yes saves and
  moves on); the minimum per screen (3: name, photo, role,
  nationality, languages is the most, because they are one "you" card and the plan's A2 groups them).
  Every optional item is labelled "optional" and skippable; About has a dedicated Skip.
- **Back everywhere**: top-left arrow on every step, Esc on a keyboard. Back never loses what was
  ticked on earlier screens (state lives outside the screens).
- **One big full-width button stuck at the bottom** on every step; a disabled button says why in a
  line above it ("Add a photo to continue. It's the one thing we must have.") and tapping it shows
  that line as a toast.
- **Errors beside the field** in plain words, with a small warning icon, and the field gets a 2 px
  red border. Read failures are a card with Try again. Save failures (not drawn as a separate
  state) use the same line beside the button.
- **Nice one**: a tick pops in the middle for 380 ms, the button bounces, `navigator.vibrate(12)` on
  Android. Not promised on iPhone (Safari has no Vibration API). Reduced motion: no pop, no bounce,
  instant step change, no confetti, no shimmer, no sheet slide (checked, section 4).
- **Progress**: dots with the current one stretched, plus "3 of 7" so it survives colour-blindness.
- **Photo required**: the one hard stop. Camera or gallery (`<input type=file accept=image/*>`,
  `capture=user` for camera), round preview, a crop sheet with drag + zoom slider, a "sample photo"
  button so the flow can be tried where the file picker is blocked.
- **Dance role as cards**, single choice: Leader / Follower / Both (stored `Lead and Follow`).
- **Nationality**: flag + name, Popular first (UK, England, Scotland, Wales, Northern Ireland, Spain,
  Dominican Republic, Italy, Poland, Brazil, Portugal, France, Romania, Ireland, Colombia, Cuba) then
  the rest, type-to-jump search, chosen value shown as a chip that reopens the sheet. Flags are
  built from ISO codes at runtime (no images); Windows shows two letters instead of a flag, which
  is acceptable and the name is always beside it.
- **Languages**: six likely chips (English, Spanish, Portuguese, Italian, Polish, French), "More
  languages" opens a searchable sheet, ticked ones appear as removable chips in the row; values are
  English names.
- **Grace banner** (A0): amber card on Home, "Finish your details to create and edit events. From Monday
  16 November you'll need them.", "12 days left" pill, Finish your page, hide-for-today cross. Hidden for
  admins and when complete. During grace, creating and editing still work (plan section 5, stages 1-2);
  after the grace end (drawer state "Grace ended") every create/edit tap opens the gate sheet (A1).
- **Your page** (A5): category as tap cards (one tap), one link (website, Instagram or Facebook; `@handle`
  accepted), logo with a square crop. All three are rows in `missing[]`, so Review and Home list them and
  Go live waits for them.
- **Dark mode = true black** background, cards `#141414`, lines `#2f2f2f`; the accent stays
  `#f0703a`. Light is the default; the toggle is remembered per device.
- **Accent unchanged** (`--gold #f0703a`, `--gold-fg #a8461a` light / `#f5865a` dark).
- **Density**: tap cards are 2-across (labels like "Intermediate" with an explanation do not fit
  3-across at 320 px), stats are 3-across, padding 10-12 px, body 17 px. The brief's "text comfortably
  large" wins over `text-sm` on this flow; the rest of P3 is unchanged.
- **Longer words**: every label uses `overflow-wrap: anywhere`; checked at 130% text scale with no
  clipping (section 4). German-length labels in a later language would wrap, not clip.
- **Tap sizes are explicit px** (44 minimum, main button 52) because the site's html font-size is
  about 13.5 px on phones and rem would shrink them.

## 3. Assumptions (need a decision before build)

1. **"Not sure yet" dance role (kept by the owner, still an assumption).** Drawn as a dashed card with a
   "needs decision" badge. There is no stored value for it: `DANCE_ROLE_VALUES = ['Leader', 'Follower',
   'Lead and Follow']` (`src/modules/organiser/wizard/dancerApi.ts`). Options: (a) new enum value in
   admin's migration, (b) `dance_role = null` plus a `role_undecided` flag, which ALSO needs
   `organiser_onboarding_status_v1` changed in the admin repo (otherwise `missing[]` keeps listing the role
   and the person can never go live), (c) drop the card for launch (the reviewer's recommendation). Until
   decided the card cannot ship. The prototype never shows a state the backend cannot produce: tapping
   the card shows an inline note, and Review and Home list "How you dance" as still missing.
2. **Contact by email.** The plan (A6) says the contact email is set by the team and never asked. The
   brief says "phone or email, plain wording", so an Email tab is drawn for pages with no number.
   Decide: ask for a contact email when there is no phone, or phone only.
3. **Claim code.** The claim sheet shows the existing email-code proof (6 digits to the mailbox on
   the page), as today. If the page has no mailbox the real app falls back to Ask to join; not drawn.
4. **Grace length** is drawn as 14 days from the day the screens ship (owner's brief, plan Q1 still
   open). The pill reads "N days left"; the copy for the last day is "Last day" (not drawn).
5. **Go-live in an ambassador city** (plan Q2) is not drawn; the celebration would read "Sent for
   review" with the same layout.
6. **DJ question** (plan A4) is not drawn separately: same two cards as Teaching, then genre chips.
7. **City** is asked on Create (new page) and not on the You screen; a person claiming an existing
   page keeps the page's city. Instagram handle (A2) is parked (section 7).
8. **Sign-in email** screen is explanation + optional personal email. It never changes the login
   email itself (that is an auth flow, out of scope).

## 4. Checks run on the file (Playwright + Chromium, offline, 2026-10-28, after fix round 1)

Script: `check.cjs` (scratch, not committed). Every screen x every drawer state (normal, loading, error,
empty, save failed, grace ended, already live) x light and true-black dark x 390 and 320 px x 100% and
130% text scale = 728 screen/state combos per variant, plus every sheet, then a real tap walk at 390 px.
Fix 1 (`[hidden] { display: none !important }`) was applied FIRST and the whole sweep re-run with the
hidden parts really hidden; the checker was proved against the pre-fix file (it reports `ct-phone-edit`,
the Contact email field, `teach-more` and `grace` there, and nothing after the fix) and against a
mutated `--mut` colour (the contrast rule fires at 1.11).

| Check | Result |
|---|---|
| Every `[hidden]` element has no client rect, every screen x state x variant | pass (0; was 3 before fix 1) |
| Contrast >= 4.5 for every visible text node, light and dark, composited against the real ancestor background, all screens, states, sheets and the toast | pass, 0 failures |
| Tap targets >= 44 px (buttons, inputs, switches, sheet controls; `<label for>` text excluded, its input is 44+) | pass |
| No horizontal scroll (stage, screen, main, sheet) at 390 and 320, 100% and 130% | pass |
| No clipped text (overflow other than visible with scrollWidth > clientWidth) | pass (only the `.sr` span, intended) |
| Reduced motion | unchanged from round 0 (`animation-name: none`, confetti `display: none`) |
| Keyboard focus visible | pass: 2 px solid outline on the first 8 Tab stops on Your page |
| Tap walk from the start | pass: mood > welcome > contact (Yes = one tap, lands on Your page) > page (category, bad link rejected, `@handle` accepted, logo via sheet > sample > square crop) > you (photo via gallery > sample > crop; logo and photo stay separate; Not sure yet; nationality) > teach (Yes shows levels, No hides them) > about (starter names the category) > email > review ("How you dance" listed as missing with Not sure yet, Go live disabled; Leader picked, Go live enabled) > live (View my page opens the public-page sheet; Go to Home) > home (banner A0 copy + days pill; Add an event during grace shows the toast, NOT the gate; Grace ended: Add an event opens the gate, pill reads "Grace ended"; Normal restores 12 days; Hide for today really hides the banner; Settings tab opens the Settings sheet) |
| Contact hidden panes (`ct-phone-edit`, email field) have no client rect on the Phone tab | pass |
| Back chain from Review (Esc) | email > about > teach > you > page > contact > welcome > mood |
| Dots and stepline | 8 dots on every step; Review reads "8 of 8" |
| JS errors on load and through the sweep and the walk | none |
| ASCII-only source | pass |
| Size | 121,094 bytes (limit 600 KB), fully offline |

**How the 130% check works.** The drawer's "Text 130%" sets `--ts: 1.3`, which multiplies every
`calc(... * var(--ts))` size: the `--fs-*` tokens, the stepline, tile explanations, chips, badges, stats,
tabs, devnotes, and (since this round) the flag glyphs (`.flag`, `.chip-flag`). It is not the OS font
scaling: Android's setting scales every px size, including the ones here that are layout (tap minimums,
the 88 px avatar, the 240 px crop circle). The claim is therefore "no clipped text when every text size is
1.3x", checked by the sweep above, not "checked with Android font scaling".

Not verified: a real phone (vibration, camera capture, Web Share), Windows flag rendering, VoiceOver and
TalkBack reading order (roles and labels are set; not listened to), Android OS font scaling (see above),
and **320 px / 130% with the Outfit font**: the file uses system-ui only (no network), and P3 renders in
`"Outfit", system-ui` (`p3.css`), whose metrics are wider; the build must re-run the clipping sweep with
Outfit loaded. Also not verified: contrast of the true-black token set on the other P3 screens (section 6).

## 5. What the owner is asked to pick

1. Corners: Soft / Round (today's P3) / Pill.
2. Text amount: Short / Explained.
3. Mood: Calm / Playful / Bold (brief says clean and calm; the three are there to compare).
4. Section 3 items 1 and 2 (Not sure yet; contact by email).
5. Whether "Add an event" should stay open during the 14 days (drawn per the plan: yes) and whether the
   page details (category, link, logo) belong before Go live (drawn per the plan: yes).

## 6. What a developer needs (per screen)

Primitives: existing P3 `SheetView`, `Field`, `PrimaryButton`, `GhostButton`, `EmptyState`,
`ErrorState`, `AvatarUpload`, `LanguagePicker`, nationality picker, `citySearch`. New pieces:
**TapCard** (tile with tick, single or multi), **ProgressDots**, **StickyFooter** (button + why-line),
**NiceOne** (tick pop + vibrate), **GraceBanner**, **Confetti** (canvas, 90 particles, 1.9 s, skipped
under reduced motion), **CropSheet** (pointer drag + zoom, 320 px JPEG out; round for the photo, square for
the logo). Keep Confetti and CropSheet behind a dynamic import in the onboarding route, never in the app
shell, and ship the nationality and language lists with the sheet chunk (no new manual chunk; see
`vite.config.ts` and `perf-budgets.json`).

Reads/writes (all existing or in the plan, none new here): `organiser_onboarding_status_v1`
(missing[] drives the dots, Review rows, Home rows and the gate), `searchClaimableOrganisers` +
`organiser_claim_hints_v1`, `claim_organiser_v1` (+ OTP proof), `request_organiser_access_v1`,
`create_organiser_profile_v1`, `search_cities`, `organiser_profile_update_p5_v1` (contact; category, one
link and logo on Your page, A5, fields not yet checked against the schema),
`save_my_role_v1` (teach/DJ), `levels_taught` + private sign-in email + audit (S1),
`complete_organiser_onboarding_v1` (S6). Every Continue saves; Back never loses saved answers.

Tokens (one token set, binding owner decision): the prototype's true-black dark block
(`[data-theme="dark"]` in the HTML: `--bg #000`, `--card #141414`, `--card2 #212121`, `--line #2f2f2f`,
opaque tints `--warn-bg #3a2113`, `--ok-bg #0f2a1d`, `--cancel-bg #3a1d19`) **replaces P3's dark block
(`--bg #202226 / --card #2a2d32`, rgba tints, `p3.css` lines 30-44) for every P3 surface**, not only the
onboarding screens, so there is no colour change at the step from onboarding to Home. The build re-runs
the contrast sweep on all P3 screens with the new block. Light is P3's block unchanged.

Deliberate token deltas in the prototype versus `p3.css` (decide: onboarding-only or P3-wide; the
prototype assumes onboarding-only for the sizes and P3-wide for dark):

| Token | P3 today | Prototype | Why |
|---|---|---|---|
| font | `"Outfit", system-ui` | system-ui only | no network in the file; the build keeps Outfit and re-checks clipping |
| `--fs-body` | 16 px | 17 px | brief: "text comfortably large" |
| `--fs-title` | 22 px | 24 px | same |
| `--fs-h2` | (none) | 19 px | sheet and Home titles |
| `--r-tile` | (none) | 12 / 8 / 16 px per corner set | tap cards |
| `--tab`, `--danger-fg` | present | dropped | not used on these screens; keep them in P3 |

Variants: corner tokens `--r-card / --r-ctl / --r-sheet / --r-tile` per the chosen set; "explained"
sentences are the `.tx-l` spans, drop them for "short".

Copy is in the HTML as-is (British English, entities). Per-screen developer notes are inside the
file: Design options > Developer notes.

## 7. Parked ideas (not in the brief, not built)

- Instagram handle on the You screen (plan A2). (Logo and one link are now drawn on Your page, A5.)
- More than one link on Your page (the plan says "at least one"; the prototype asks for one).
- A "Go to Home" shortcut inside the public-page sheet.
- "Last day" and "today" wording for the grace pill; a push/email reminder at 3 days.
- Pre-filling nationality from the device locale.
- Animated flag/emoji fallback image set for Windows.
- Letting the inviter see "Sam finished the page" on their Home.
- A "Preview my page" sheet before Go live.
- Haptics on iPhone via a native wrapper (not possible on the web).

## 8. Fix round 1 (review `onboarding-prototype-r1.md`, all 11 applied)

| Fix | What changed |
|---|---|
| 1 BLOCK | `[hidden] { display: none !important; }` next to the variant rules. Contact's edit pane and email field, Teach's levels after "No", and the banner after "Hide for today" are now really hidden. Whole sweep re-run (section 4). |
| 2 | Banner copy is A0 ("Finish your details to create and edit events. From Monday 16 November you'll need them.") with the days pill kept. During grace, Add an event goes through (toast). New drawer state "Grace ended": pill "Grace ended", Add an event opens the gate (A1). |
| 3 | New step 3 "Your page" (A5): five category cards, one link, logo with square crop, name + "Change name", held city. Rows added to Review and Home via `missing[]`; dots are 8. Later steps renumbered. |
| 4 | "Not sure yet" card KEPT (owner), marked in section 3 as an assumption that also needs the status RPC changed in admin for option (b); Review and Home treat it as missing, so no state the backend cannot produce is shown. |
| 5 | "Yes, that's right" saves and moves on in one tap (A6); Continue stays for Change and Email. |
| 6 | "View my page" opens the public-page sheet; "Go to Home" ghost button under Share. Share link uses the real route shape `/organisers/:id`. |
| 7 | Section 6: the true-black block replaces P3's dark block for every P3 surface (one token set); the build re-runs contrast on all P3 screens. |
| 8 | Section 6: token deltas table (font, `--fs-body`, `--fs-title`, `--fs-h2`, `--r-tile`, dropped `--tab` / `--danger-fg`); "320 px / 130% with Outfit" under Not verified. |
| 9 | (a) one wording for the short name ("The name needs three letters or more."); (b) "(step 6)" is now "(we ask later)"; (c) the Settings tab opens the same Settings sheet as the icon. |
| 10 | Drawer states "Save failed" (every saving step: error line beside the button, input kept, Continue stays enabled) and "Already live" (A8 live-organiser copy + Add an event). |
| 11 | Flag glyph sizes follow `--ts`; section 4 says exactly how the 130% check works and what it does not cover. |

Not in scope and not done (ideas went to section 7): no other changes.

