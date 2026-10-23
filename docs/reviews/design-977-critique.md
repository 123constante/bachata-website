# Design critique, PR #977 (invite W2: phone + Instagram, "Do you also DJ or teach?", "It's live")

Design Gate stage 5. Read-only review; no product code, test or design file changed.

- **Reviewed head:** `5b46b191e5a74050927f8a1a199b70a51c3a90f4` (branch `claude/invite-w2-phone-ig-golive`)
- **Read:** `docs/design/977.md`, all 15 PNGs under `docs/design/977/` (each opened), the W2 brief, `git diff origin/main...HEAD -- src` (forms, wizard contact steps, ContactSheet, raffle wrapper, golive roles, Done / ItsLiveOffer).
- **Re-ran the shots:** `npx playwright test --config playwright.phone.config.ts tests/e2e-phone/invite-w2-golive.phone.spec.ts --project phone-390x844`. First run 10/12: the two phone-field tests failed on dev-server cold start ("execution context was destroyed", a navigation timeout). Re-run of those two: 2/2 pass. So 12/12, but see blocker 1: the spec types with `fill()`, which hides the bug.

VERDICT: FIX (1 blocker, 2 should-fix)

## Findings (material only, most severe first)

### 1. BLOCKER: the phone box disappears after the first digit typed
- **Where:** `src/components/forms/PhoneInput.tsx:166` (`legacy = allowLegacy && !legacyOpen && isLegacyPhone(value)`) with `isLegacyPhone` at `:61-65`; the callers feed every keystroke back in as `value`: `src/modules/organiser/wizard/contactSteps.tsx:45` (`setDraft(e164)`) and `src/modules/organiser/edit-in-place/ContactSheet.tsx:117` (`setPhone(e164)`). The raffle sets `allowLegacy={false}`, so it is not affected.
- **What a person sees:** on "What number can dancers call?" (so on "Almost live" too) or in the contact sheet, with an empty box, they type `7`. The partial number `+447` is not E.164 yet, so the field counts it as a *legacy stored value*. The input is replaced by "Saved before: **+447**. No country on this one. It still works; pick the country when you change it." with a Change button. Both statements are wrong: nothing was saved and the country was picked. They have to tap Change after every digit until 8+ digits are in. `phone-invalid.png` shows exactly this ("Saved before: +4477" after typing 77). The record labels that shot "Phone field, invalid". It is the bug, not the designed invalid state.
- **Proof:** a jsdom render of `PhoneInput` with a `useState` host and one `change` event of `'7'` gives `phone-legacy` on screen, the `<input>` gone, legacy value `+447`. The phone spec passes because `box.fill('77')` / `fill('7700900123')` sets the whole string in one event.
- **Change:** decide "legacy" once, from the stored value, never from the live draft. For example, take a `stored` prop as `InstagramInput` does and use `legacy = allowLegacy && !legacyOpen && value === stored && isLegacyPhone(stored)`, or freeze it with `useState(() => allowLegacy && isLegacyPhone(value))`. Then add a test that types digit by digit (`pressSequentially('77')` in the phone spec, `userEvent.type` in `contactSteps.test.tsx` and `ContactSheet.test.tsx`), and make `phone-invalid.png` again. The invalid state should show the box with `77` in it and "Looks short. United Kingdom numbers have 10 digits after +44."

### 2. SHOULD-FIX: two of the three surfaces have no shots, so "same field, no colour seams" is not shown
- **Where:** `docs/design/977.md` (Screenshots table). All 15 shots are the go-live wizard. There are none of the organiser contact sheet (`ContactSheet.tsx:113-118`) and none of the raffle (`RaffleEntryDialog.tsx:359`).
- **Why it matters:** the sheet is inline-styled ink/cream (`CREAM`, `rgba(246,241,234,…)`). The field inside it is an `org-theme` wrapper with `background: transparent` and token colours (`--card2`, `--line-strong`, `--mut`). So the field, its feedback lines and the legacy box sit on a background the tokens were not picked for. No one has looked at it at 390x844, and in the Ember world (`ember.css:29`) the tokens change again. Blocker 1 also lands in the sheet, and that was not seen.
- **Change:** add sheet shots (empty, valid, too short, legacy + Change) and raffle shots (empty, valid, too short) to the spec with `screenChecks`, run axe on the sheet dialog (it is in `document.body`, outside `main`, so the current `main`-scoped axe pass does not cover it), and list them in the record.

### 3. SHOULD-FIX: raffle phone taps are 40px
- **Where:** `src/components/forms/PhoneInput.tsx:120` (raffle `input: … h-10`) and `:110` (country button `h-full`, so also 40px). Feedback text is 11px (`:121-124`).
- **What a person sees:** on the event page raffle, the country picker and number box are smaller than every other tap target in this PR. Under the site's ~13.5px root font size they render smaller still for some rem-based parts. Country rows in the list are `py-1.5` with 12px names, about 30px tall.
- **Change:** in the raffle tone only, `h-10` to `h-[44px]` on the input (the button follows through `h-full`), and `min-h-[44px]` on the raffle `row`. Keep the raffle colours. This is still a thin wrapper, not a rewrite, so it fits the brief's rule.

### 4. Nit: the "too short" step error sends the person to the wrong control
- **Where:** `src/modules/organiser/wizard/contactSteps.tsx:14`. `PHONE_INCOMPLETE` = "Finish the number first: pick the country, then type the rest." This shows when Continue is tapped on a short number, even though the country is already picked (+44 shown).
- **Change:** say what is missing, reusing `phoneFeedback`'s words, for example "That number looks short: United Kingdom numbers have 10 digits after +44." Or set the field's `touched` on Continue so its own line shows, and drop the second message.

### 5. Nit: the flag shows as a broken-image icon when flagcdn does not answer
- **Where:** `PhoneInput.tsx:128-139` (`FlagImg`, no `onError`). Every shot in `docs/design/977/` shows the broken glyph next to +44. In production flagcdn is CSP-allowed (`app/csp.ts:27`), but a slow or blocked fetch on a weak phone signal gives the same look.
- **Change:** on `onError`, hide the `<img>` (the dial code already says the country).

### 6. Nit: the confirmation says the number twice
- **Where:** `PhoneInput.tsx:360-363` (`phone-valid.png`): "✓ +44 7700 900123" and then "Saved as +447700900123". For a low-tech organiser the second line is the same number in a harder-to-read form.
- **Change:** keep the grouped line only, unless the owner-approved prototype has both (the record does not say).

### 7. Nit: the DJ offer asks for something just given
- **Where:** `src/modules/organiser/flows/ItsLiveOffer.tsx:15`. "Add a photo and the music you play…" A DJ who answered Yes on the roles screen *had* to type "Music you play" two screens earlier.
- **Change:** "Add a photo and a few words about your sets, so dancers know whose set they are coming to."

### 8. Nit: the question order does not match the answers
- **Where:** `roleQuestion.ts:11` (title "Do you also DJ or teach?"), but the fieldsets go teacher then DJ (`roles-*.png`).
- **Change:** title "Do you also teach or DJ?", or put DJ first.

## Per-screen table (390x844)

Contrast and taps are from the spec's axe `color-contrast` and tap measurements on `main`, which passed on my re-run. Clipping and sideways scroll are from my look at each image plus the spec's `checkOverflow`.

| Screen | Image | Contrast >= 4.5 | Taps >= 44 | Clipping / sideways scroll | State says what to do | Verdict |
|---|---|---|---|---|---|---|
| Phone, empty | phone-empty.png | pass | pass | none | yes (Continue off; hint says it is needed) | ok (broken flag, nit 5) |
| Phone, valid | phone-valid.png | pass | pass | none | yes | ok (nit 6) |
| Phone, invalid ("77") | phone-invalid.png | pass | pass | none | **no**: shows a false "Saved before / No country" box instead of the number | **FIX (blocker 1)** |
| Phone, legacy stored | phone-legacy.png | pass | pass (Change 44px) | none | yes (Change) | ok |
| Instagram, @name | ig-at-name.png | pass | pass | none | yes (check link) | ok |
| Instagram, full link | ig-link.png | pass | pass | long link fits, no clip | yes | ok |
| Instagram, bare name | ig-bare.png | pass | pass | none | yes | ok |
| Instagram, invalid | ig-invalid.png | pass | pass | none | yes (rule in words; no `invalid_instagram` code shown) | ok |
| Roles, unanswered | roles-unanswered.png | pass (disabled Continue text is dark on grey, readable) | pass | none | yes ("Answer both questions to continue.") | ok (nit 8) |
| Roles, no to both | roles-no.png | pass | pass | none | yes | ok |
| Roles, DJ yes | roles-dj-yes.png | pass | pass | none | yes (comma hint) | ok |
| Roles, teacher yes | roles-teacher-yes.png | pass | pass | none | yes | ok |
| Roles, both yes | roles-both.png | pass | pass | none; Continue still above the fold | yes | ok |
| Go-live gaps | golive-gaps.png | pass | pass | none | yes (each gap links to its editor; "Finish the list above first.") | ok |
| It's live + offer | its-live-offer.png | pass | pass | none | yes (Open / Maybe later) | ok (nit 7) |
| Contact sheet phone | none | not shown | not shown | not shown | blocker 1 applies | **should-fix 2** |
| Raffle phone | none | not shown | **40px** (code) | not shown | yes | **should-fix 2, 3** |

## Checks against the owner rules
- **Chosen direction (record + brief):** kept. One shared `PhoneInput` / `InstagramInput`, used in the wizard (and so in "Almost live"), the contact sheet and the raffle. The roles question sits in "About your page". Gaps link to the role editors. The "It's live" offer is optional and saves nothing. Warm, plain copy throughout.
- **No codes shown to a person:** pass. `invalid_phone` / `invalid_instagram` map to sentences in `wizard/dancerApi.ts:40-41`. The ContactSheet uses `checkField` copy. `selfServeErrors.ts` maps `invalid_instagram` and falls back to a generic line for anything else. One gap: `selfServeErrors.ts:86` still says "Enter an Instagram handle or a full https:// link.", which does not match the new rule (bare name / @name / link). That line is not in this diff; it is worth matching when that file is next touched.
- **Disabled controls say why:** pass (roles Continue, Go live, wizard Continue through the hint).

## Verified / Not verified
- **Verified:** all 15 images opened and read. The changed UI source read. The phone spec re-run: 12/12 across two runs (the first run's 2 failures were cold-start navigation). Blocker 1 reproduced in jsdom (one keystroke turns the field into the legacy box).
- **Not verified:** the contact sheet and raffle surfaces in a browser (no shots exist, and I did not build new ones). The Ember world colours. A real phone. The owner-approved prototype (claude.ai artifact, not reachable from here). Prod data shapes (not needed for a design critique).
