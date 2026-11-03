# Walk: onboarding checklist field rows, 390x844 (brief walk-onboarding-field-rows)

Spec: `tests/e2e/walk-onboarding-field-rows.spec.ts` (19 tests, all pass). Pictures `docs/walk/onboarding-field-rows/<name>.png`; every screen's words and visible controls: `texts.jsonl` (same names).
Setup per row: Review opened at `/account/p3/start?at=review&o=<org>` with exactly ONE thing left (the row's code); a successful write removes it from the mocked status.
Review screen for every row: "1 thing left" / "1 to do. About added." / row card (title + "To do" or "To do, in your dancer profile") / button "Go to Home" (`<code>-a-review.png`, e.g. `01-a-review.png`).

## Table (code x case)

| Row (Review label) | Case | Picture(s) | Words on screen | One next action named? | Silent failure? |
|---|---|---|---|---|---|
| instagram ("Your Instagram") | Enter | `01-b-entered.png` | Leaves onboarding for the dancer editor `/app/me/edit?focus=instagram&returnTo=...`: "Edit my profile", the WHOLE profile form (photo, names, city, role, nationality, languages, bio, Instagram, Facebook, Website). Button "Save changes" (disabled, "Nothing has changed yet. Edit a field above to save."). No wording says this is the Review item. | Partly: Save is the only primary, but the screen is a 20-field form and the row's field is at the very bottom (whether the page scrolls to the field was not checked). | no |
| instagram | Typed `@simon.bachata` | `01-c-typed.png` | "✓ @simon.bachata / Saved as simon.bachata / instagram.com/simon.bachata: tap to check it's you" | yes | no |
| instagram | Success | `01-d-after-save.png` | Toast "Your changes are live." then Review at 100%: "All done / Your page is live. About added." / "Go to Home". Auto-returns to Review (no extra tap). | yes ("Go to Home") | no |
| instagram | Invalid handle, client side (`https://example.com/simon`) | `06-b-typed.png`, `06-c-after-tap.png` | Under field: "Enter your Instagram handle (like @yourname) or a full instagram.com link." Under Save: "Fix the fields marked above, then save." Save disabled, nothing sent. | yes | no |
| instagram | Invalid handle, server 22023 `invalid_handle` (`simon`) | `02-invalid-22023-b-after-save.png` | Under the field: "Enter your Instagram handle (like @yourname) or a full instagram.com link." | yes | no |
| instagram | Handle taken, 23505 on `dancer_profiles_instagram_normalized_uidx` | `03-taken-23505-b-after-save.png` | Under the field (red): "That Instagram is already on another profile. Check the spelling, or message us if it is yours." No button or link to "message us" (plain text). | partly: tells the person to check spelling or message us, but "message us" is not a control | no |
| instagram | Network failure (request aborted) | `04-network-failure-b-after-save.png` | Message is at the TOP of the page, "Something went wrong. Check your connection and try again." with a "Try again" button, plus (kept) "Saved as simon.bachata" hint under the field. At the bottom of the screen, where the finger just tapped Save, the picture shows NO error, only the Save button. | the message names an action, but it is off-screen | **YES (flash-and-nothing): the error is above the fold; the viewport the person is looking at shows nothing change.** |
| instagram | Server 500 | `05-server-500-b-after-save.png` | Same as network failure: top-of-page "Something went wrong. Check your connection and try again." + "Try again"; nothing visible at the Save button. The words blame the connection for a server error. | as above | **YES, same as above** |
| instagram | Slow save (held 4 s), double tap | `07-b-pending-0_3s.png`, `07-c-pending-2_3s.png`, `07-d-after.png` | While waiting: "Saving your changes…" under Save; Save is disabled; the field still says "Saved as simon.bachata" (the hint is a preview, reads as already saved). Second tap did nothing (one `save_my_dancer_profile_v2` call logged). After 4 s: toast + Review "All done". | yes | no (but "Saved as ..." appears BEFORE the save finished) |
| dj_genres ("Music you play") | Enter | `10-dj_genres-b-djgenres-entered.png` | "Music you play / For example Bachata, Kizomba or Salsa. / Type at least one to continue." Input "Bachata, Kizomba", button "Continue" (disabled). Progress 88%. | yes | no |
| dj_genres | Filled, success | `10-dj_genres-b-djgenres-filled.png`, `10-dj_genres-c-review-entered.png` | Typed "Bachata sensual, Dominican" -> Continue sends `save_my_role_v1 dj {genres:[2]}` -> Review 100% "All done". No toast. | yes ("Go to Home") | no |
| dj_genres | Slow save (4 s), double tap | `19-b-pending-0_3s.png`, `19-c-after.png` | Button reads "Saving…" and is disabled; one write logged. | yes | no |
| dj_genres | Network failure | `20-b-after.png` | "Couldn't save. Check your connection and try again." under the input, Continue stays. | yes | no |
| dj_genres | Back from the row | `21-b-row.png`, `21-c-after-back.png` | Back returns to the Review card (not to the event). | n/a | no |
| dj_answer ("Do you DJ?") | Enter | `11-dj_answer-b-dj-entered.png` | "Do you DJ? / This shows on your DJ page. / [Yes, I DJ] [No] / Answer to continue." Continue disabled. | yes | no |
| dj_answer | Yes | `11-dj_answer-c-djgenres-entered.png`, `11-dj_answer-d-review-entered.png` | Continue -> "Music you play" (genres, 100% bar) -> Review "All done". Two writes (`set_my_role_intent_v1`, then genres). | yes | no |
| dj_answer | No | `12-dj_answer-c-review-entered.png` | Continue -> Review "All done" (one write, `set_my_role_declined_v1`). | yes | no |
| teach_answer ("Do you teach?") | Enter | `15-teach_answer-b-teach-entered.png` | "Do you teach? / This shows on your teacher page. / [Yes, I teach] [No] / Answer to continue." Progress 69% (jumps to the full-path percentage, not 88%). | yes | no |
| teach_answer | Yes | `15-teach_answer-c-levels-entered.png`, `-d-styles-`, `-e-years-`, `-f-about-`, `-g-review-` | Walks 5 screens: Levels -> Styles -> Years -> "About <page name> optional" (not on the checklist) -> Review. Writes after each. | yes at each screen; About adds an unlisted extra step ("Skip for now") | no |
| teach_answer | No | `16-teach_answer-c-about-entered.png`, `16-teach_answer-d-review-entered.png` | Continue -> About (unlisted extra) -> Review. | yes | no |
| teach_years ("Years teaching") | Enter, success | `13-teach_years-b-years-entered.png`, `13-teach_years-c-about-entered.png` | "Years teaching / 0 is fine. / Type a number from 0 to 60 to continue." Typed 4 -> About (unlisted) -> Review. | yes | no |
| teach_levels ("Levels you teach") | Enter | `14-teach_levels-b-levels-entered.png` | "Which levels? / Tick all that apply." four tiles; "Pick at least one level to continue." | yes | no |
| teach_levels | Success | `14-teach_levels-c-styles-entered.png`, `-d-years-`, `-e-about-`, `-f-review-` | ONE missing level item walks through Styles, Years and About too (3 more screens for things not on the list; each saves). | yes per screen, but 4 screens for 1 item | no |
| org_link ("Page link") | Enter | `17-org_link-b-link-entered.png` | "One link / Website, Instagram or Facebook." Input placeholder "yourpage.com or @yourpage". | yes | no |
| org_link | Invalid (`not a link !!`) | `18-org_link-b-link-filled.png`, `18-org_link-b-link-stuck.png` | "Use a web address, like yourschool.com." Continue stays; nothing sent. | yes | no |
| org_link | Success | `17-org_link-c-logo-entered.png` ... `17-org_link-g-nat-entered.png` | Saved `{instagram:"ritmobachata"}`, then does NOT return to Review: it walks on through Logo ("Change logo"), Your first name, Your photo ("Add a photo to continue"), How do you dance?, Nationality... none of which were on the checklist (logo, name, photo, role were already done in the mock). Stopped by the driver at Nationality (needs a pick). | yes per screen, but the person is led away from the one thing they came to do | no (but not coherent with "1 thing left") |

## Back to the event
No row, screen, toast or Review control names or links the event the person came from (controls list in `texts.jsonl`). From a row, Back goes to Review (`21-c-after-back.png`); Review's "Go to Home" goes to Home (Review's own Back was not walked; by code it returns to the last person step). Same as the first walk: no way back to the event.

## Ranked: the 5 worst stops
1. **Instagram network/500 failure (`04-`, `05-`)**: the refusal text sits at the top of a long form; at the Save button nothing visibly changes. This matches Simon's "flashes and nothing happens" on a bad connection.
2. **org_link (`17-`)**: finishing the one item leads into logo, name, photo, role, nationality (the whole page-onboarding path), not back to Review. "1 thing left" turns into 6+ screens.
3. **teach_levels / teach_years / teach_answer (`14-`, `13-`, `15-`)**: one item walks 3-5 screens including About, which is not on the list.
4. **Instagram entry (`01-b-entered.png`)**: the row dumps the person into the entire dancer editor; nothing says which field or that Save returns them to the checklist.
5. **Instagram taken (`03-`)** and **slow save (`07-b-`)**: "message us" is text, not a control, so no single next action; and "Saved as simon.bachata" shows while the save is still in flight.

## Not verified
- Every server answer is mocked at the network layer; no prod data, no real account, no real write, Supabase untouched. Prod responses (real error wording from PostgREST, real `missing[]` ordering, real `my_dancer_edit_v1` shape) were not seen.
- Status mock removes the row's code after ANY write, so the post-save Review state ("All done") says nothing about what the real server will still list.
- org_link walking on to Logo/Name/Photo/Role/Nationality depends on those screens being entered from `link` in `OnboardingFlow`; in prod it may differ with a different held page state. The walk stopped at Nationality (no pick made).
- `teach_levels` prefill is not emitted by prod (per `personApi.ts` comment), so "Levels" always opens empty; not independently checked.
- Dark/light theme variants, 360 and 430 widths, keyboard-open states and real slow networks not walked. No fixes proposed.
