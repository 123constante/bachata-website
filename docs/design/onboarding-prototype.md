# Onboarding prototype (P3, design only)

**Open `docs/design/onboarding-prototype.html` on a phone** (or in a desktop browser: it shows a
390x844 phone frame, scaled up on tall screens). One file, inline CSS and JS, no network, no fonts,
109 KB. Nothing is saved or sent. Branch `claude/p3-onboarding-prototype`, PR #1124. Brief:
`briefs/p3-onboarding-prototype.md` on `brief/p3-onboarding-prototype`.

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
| 2 | `contact` | "How can dancers reach Bachata Nights Leeds?" Phone pre-filled with "Is this the best number? Yes / Change"; Email tab; WhatsApp switch. | held number, editing number (format error), email (format error), loading, read-error |
| 3 | `you` | First name, **photo (required)** with camera / gallery / round crop sheet, dance role tap cards (Leader / Follower / Both / Not sure yet*), nationality (flags, popular first, type-to-jump, shown back as a chip), languages (chip row + More languages search sheet, ticked ones removable). | name empty, photo missing, nationality missing, no language, no match in either search, loading, read-error |
| 4 | `teach` | "Do you teach?" two cards; if yes: level cards (Beginner / Improver / Intermediate / Advanced, tick several, one-line explanations), style chips, years teaching, "More (optional)" sheet (private lessons, where you teach). | no answer, no level, no style, years out of range, loading, read-error |
| 4b | `about` | Optional About with a starter sentence built from what was answered; Save or Skip for now. | empty, counter |
| 5 | `email` | Sign-in email explanation: private, never shown, why we ask; optional personal email with inline validation. | format error |
| 6 | `review` | "N things left" checklist; missing rows first (amber), done rows (green), optional rows (grey). Every row deep-links to its step. Go live disabled with a reason until nothing is missing. | all done, some missing, everything missing (Empty state), loading, read-error, saving spinner |
| 7 | `live` | Confetti + "You're live" + View my page + Share (Web Share API, else copies the link). | reduced motion: no confetti |
| 8 | `home` | Home with the grace banner (days-left pill, Finish your page, dismiss for today), draft/live status, page-completion rows, empty events card, "Add an event" opening the gate sheet (A1) while incomplete. Settings sheet holds the in-app dark-mode switch. | banner, banner hidden, all done, no events, loading, read-error, gate sheet |
| 10 | all | Dark mode (true black `#000`) via the top toggle or the in-app Settings switch. Light by default; the choice is remembered on the device. | |

\* "Not sure yet" is a design assumption, see section 3.

**Sheets** (bottom sheets inside the frame): sign out, not my page, claim (code), ask to join, asked,
nationality, more languages, add a photo, crop, more about teaching, gate, settings, public page
(not drawn), other tabs (not drawn). The last two say so in words.

**Flow order and progress** (dots at the top, 7 steps, "3 of 7" beside them): Page, Contact, You,
Teaching, About, Email, Review. The real app counts only the steps a person still has to see (plan
Appendix A), so the dots shrink for someone who already has most answers.

## 2. Decisions taken (the owner's brief, applied)

- **Mood** clean and calm, voice playful, audience confident. Headings are short and direct
  ("A bit about you", "Nearly there", "You're live"). The mood switch changes only heading weight,
  button shape and a few words; tokens, spacing and layout never change.
- **Quick**: one question group per screen, the minimum per screen (3: name, photo, role,
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
- **Grace banner**: amber card on Home, "12 days left" pill, Finish your page, hide-for-today cross.
  Hidden for admins and when complete. At 0 days the create/edit tap opens the gate sheet instead.
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

1. **"Not sure yet" dance role.** Drawn as a dashed card with a "needs decision" badge. There is no
   stored value for it: `DANCE_ROLE_VALUES = ['Leader', 'Follower', 'Lead and Follow']`. Options:
   (a) new enum value in admin's migration, (b) `dance_role = null` plus a `role_undecided` flag,
   (c) drop the card. Until decided the card cannot ship; the prototype shows an inline note when it
   is tapped.
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

## 4. Checks run on the file (Playwright, Chromium, 2026-10-28)

Script: `check.cjs` (scratch, not committed). Viewport 390x844, touch on, then 320x568, then
130% text scale, then `prefers-reduced-motion: reduce`.

| Check | Result |
|---|---|
| Contrast >= 4.5, light: 19 token pairs used for text (fg/bg, mut/card, gold-fg/card, btnfg/btn, danger/card, ok, warn, cancel, toast, banner) | all pass, lowest 4.99 (gold-fg on warn-bg, used for the tick on a chosen tile) |
| Contrast >= 4.5, dark (true black) | all pass, lowest 6.00 |
| Tap targets >= 44 px, every visible button/input/link on every screen | pass (only the visually hidden file input is 1x1; it is not a tap target, the two photo buttons are) |
| No horizontal scroll at 390 and at 320 px, every screen | pass |
| No clipped text at 130% text scale, every screen | pass (no `nowrap`/`overflow:hidden` element wider than its box; no horizontal scroll) |
| Reduced motion removes slide, confetti, sheet slide | pass: `animation-name: none`, confetti `display: none` |
| Keyboard focus visible | pass: 2 px solid outline on each of the first 14 Tab stops on the You screen |
| Every screen reachable by tapping from the start | pass: mood > welcome > contact > you > teach > about > email > review > live > home by real clicks; find, claim (code), create reached via Direct arrival |
| Back works everywhere | pass: every step's Back lands on the previous screen (mood when opened by the jump list). No Back on the first screen, the celebration (by design, forward only) and Home (tab bar) |
| No dead buttons | pass after review: an automated click-every-button sweep flagged 14, all re-verified by hand as state-aware (already-selected tiles, the current tab, a textarea fill, Share's toast). Anything not wired (public page, other tabs, event wizard) opens a sheet or toast saying so |
| JS errors on load and through the walk | none |
| ASCII-only source (entities for punctuation, flags built from code points) | pass |

Not verified: a real phone (vibration, camera capture, Web Share), Windows flag rendering, VoiceOver
and TalkBack reading order (roles and labels are set; not listened to).

## 5. What the owner is asked to pick

1. Corners: Soft / Round (today's P3) / Pill.
2. Text amount: Short / Explained.
3. Mood: Calm / Playful / Bold (brief says clean and calm; the three are there to compare).
4. Section 3 items 1 and 2 (Not sure yet; contact by email).

## 6. What a developer needs (per screen)

Primitives: existing P3 `SheetView`, `Field`, `PrimaryButton`, `GhostButton`, `EmptyState`,
`ErrorState`, `AvatarUpload`, `LanguagePicker`, nationality picker, `citySearch`. New pieces:
**TapCard** (tile with tick, single or multi), **ProgressDots**, **StickyFooter** (button + why-line),
**NiceOne** (tick pop + vibrate), **GraceBanner**, **Confetti** (canvas, 90 particles, 1.9 s, skipped
under reduced motion), **CropSheet** (pointer drag + zoom, 320 px JPEG out).

Reads/writes (all existing or in the plan, none new here): `organiser_onboarding_status_v1`
(missing[] drives the dots, Review rows, Home rows and the gate), `searchClaimableOrganisers` +
`organiser_claim_hints_v1`, `claim_organiser_v1` (+ OTP proof), `request_organiser_access_v1`,
`create_organiser_profile_v1`, `search_cities`, `organiser_profile_update_p5_v1` (contact),
`save_my_role_v1` (teach/DJ), `levels_taught` + private sign-in email + audit (S1),
`complete_organiser_onboarding_v1` (S6). Every Continue saves; Back never loses saved answers.

Tokens: copy the `:root` block (light) and the `[data-theme="dark"]` block from the HTML into
`p3.css` as the dark override only if the owner approves true black; otherwise keep P3's `#202226`.
Variants: corner tokens `--r-card / --r-ctl / --r-sheet / --r-tile` per the chosen set; "explained"
sentences are the `.tx-l` spans, drop them for "short".

Copy is in the HTML as-is (British English, entities). Per-screen developer notes are inside the
file: Design options > Developer notes.

## 7. Parked ideas (not in the brief, not built)

- Instagram handle on the You screen (plan A2) and the organiser logo + one link (plan A5).
- "Last day" and "today" wording for the grace pill; a push/email reminder at 3 days.
- Pre-filling nationality from the device locale.
- Animated flag/emoji fallback image set for Windows.
- Letting the inviter see "Sam finished the page" on their Home.
- A "Preview my page" sheet before Go live.
- Haptics on iPhone via a native wrapper (not possible on the web).
