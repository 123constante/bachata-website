# Walk: PR #1305 (join-gaps-1) at 390x844. Report only, no product code touched

Branch walked: `claude/fix-join-gaps-1` @ 8a319d6. Spec: `tests/e2e/walk-join-gaps-1-pr1305.spec.ts` (all server answers
mocked at the network boundary; P3 flags on; dev server). Every picture below was opened and looked at.
Sweep (taps under 44px, garbled punctuation, sideways scroll) comes from `texts.jsonl` per picture, and I looked at it.
`texts.jsonl` has a few duplicate lines for 01, 02 and 6-left: those pictures were retaken (see FAIL notes).

## FAILs first
**None on the product.** Three harness FAILs on the FIRST run, each retaken and now PASS:
- 01 and 02 first run: BLANK dark page (DOM text was there, the picture was taken before paint). FAIL, retaken, PASS below.
- 12-welcome-6-left first run: "Application Error ... Cannot read properties of null (reading 'useContext')" from the Vite dev
  server (a dependency re-optimise mid-run, not the PR). FAIL, retaken on a clean run, PASS below.

## Pictures
| # | Picture | Verdict | What I saw |
|---|---------|---------|-----------|
| 01 | email step, no hint | PASS | "Join Ritmo ... on Bachata Calendar", Your email box, orange Send my code, no "invite was sent to" line. |
| 02 | email step, hint | PASS | Same, plus "This invite was sent to d***@ritmo.example." above the box. |
| 03 | invite-only, hint, typed other email | PASS | "We can't create an account for this email yet", "Sign-up isn't open to this email yet.", the hint line, orange "Use the email the invite was sent to", WhatsApp. |
| 04 | invite-only, no hint, locked | PASS | Same heading; "This link is now tied to that email... Ask Diego for a new link, or message us."; WhatsApp + "Go to Bachata Calendar"; no "use another email" button. |
| 05 | invite-only, typed = invited | PASS | Hint line + "That's the email the invite was sent to. Message us and we'll open it for you."; WhatsApp + Go to Bachata Calendar; no dead button. |
| 06 | blocked domain, hint | PASS | "We can't send a code to this email"; provider words unchanged; WhatsApp + "Use another email". |
| 07 | blocked domain, locked | PASS | Blocked words + the "tied to that email" line; WhatsApp + Go to Bachata Calendar; no "Use another email". |
| 08 | About with refusal notice | PASS | Step 2 of 3 "A bit about you"; "A few details are missing. Finish them, then join." above the lead; one Continue (disabled until filled) with "Still to add: ..." below. |
| 09 | profile_stale | PASS | "We couldn't join you yet" / "Your details look finished, but we couldn't confirm them yet. Wait a moment, then try again."; Try again + Go to Bachata Calendar. |
| 10-10 | Home banner, 10 left | PASS | "...It takes about five minutes. You can stop and come back." + "10 things left", Continue. |
| 10-6 | Home banner, 6 left | PASS | "about three minutes. You can stop and come back." + 6 things left. |
| 10-3 | Home banner, 3 left | PASS | "It takes a minute or two." (no stop line) + 3 things left. |
| 10-0 | Home, 0 left | PASS | No banner; Home starts at the next-up card. |
| 11-10 | gate sheet, 10 left | PASS | "A few details first"; "...about five minutes. You can stop and come back."; 10 rows listed; Continue, Not now. |
| 11-6 | gate sheet, 6 left | PASS | "about three minutes. You can stop and come back."; 6 rows. |
| 11-3 | gate sheet, 3 left | PASS | "It takes a minute or two."; 3 rows. |
| 11-0 | gate sheet, 0 left | BLOCKED | A complete person is never refused, so the gate cannot be shown honestly at 0. Not faked. |
| 12-10 | welcome line, 10 left | PASS | "A few quick questions and your page is ready to edit, once only. It takes about five minutes. You can stop and come back." |
| 12-6 | welcome line, 6 left | PASS | "...about three minutes. You can stop and come back." |
| 12-3 | welcome line, 3 left | PASS | "...It takes a minute or two." |
| 12-0 | welcome line, 0 left | PASS | "...ready to edit, once only." with no time claimed. |

The three time lines match across banner, gate and welcome at every count walked (10 -> five, 6 -> three, 3 -> a minute or two).

## Sweep (per picture)
- Sideways scroll: none on any picture. Garbled punctuation: none (curly apostrophes render right everywhere).
- Taps under 44px: none in the changed screens (03-07, 09, banner, gate, welcome). Only the always-present site chrome
  (nav/footer text links, 14-17px) and, on 08 only, one control reported as INPUT 131x42 (probably the Upload Photo
  file control; About screen, not changed by this PR). Minor, FYI.
- Observation, not in this diff: on 08 a global "Finish your profile" banner sits above the join card; it repeats the
  About ask while the card is open.

## Not verified / BLOCKED
- Everything is mocked: no real Supabase auth hook, no real OTP, no prod-shaped rows beyond the counts in INVENTORY.md.
- Real 403 bodies were taken from the PR inventory (prod function text), not re-read here.
- Gate at 0 rows: BLOCKED (see above). Dev server, not a Vercel preview. No e2e-gate, CI or pre-ship run: report-only task.
- Dancer-profile About with a profile that has some fields filled (only the empty shape was walked).
