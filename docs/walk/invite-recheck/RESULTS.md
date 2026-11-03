# Walk: invite first minute, RE-WALK on main (after #1301 and #1294)

Report only. Spec: `tests/e2e/walk-invite-recheck.spec.ts` (not in CI gate). 390x844, reduced motion, dev server Chromium, every server answer a `page.route` mock, no product code touched, Supabase not queried.
Pictures: `docs/walk/invite-recheck/on/` (flags ON: SELF_SERVE + P3) and `off/` (flags OFF). Exact words and controls: `on/texts.jsonl`, `off/texts.jsonl`.
Harness: the spec fails any state showing the error card (kept). Capture now waits for a heading and finished animations, then resizes to full page height before the shot (copied from walk-fix-join-dead-ends). I opened the pictures quoted below; the rest of `on/` and `off/` were read through `texts.jsonl` only (see Not verified). ON run: 20 of 21 passed first time; "Home + gate with 10 things left" failed once and passed on re-run (flake, cause not found). OFF run: 21 of 21.

## Per state (flags ON; OFF is identical except where stated)

| # | State | Picture | Words on screen (quoted) | ONE action? |
|---|---|---|---|---|
| 01 | Page invite, no claim email | `on/01-email-page-nohint.png` | "Diego invited you to manage Ritmo Bachata London" / "We'll send you an 8-digit code. No password needed." / "Send my code" / "Type your email to get a code." | Yes |
| 02 | Claim email set (masked hint) | `on/02-email-page-hint.png` | identical to 01 (hint not shown) | Yes |
| 03 | Person-bound | `on/03-email-person-bound.png` | "Hi Maria" / "THIS IS YOUR PROFILE" / "Joining links it to your email, with everything already on it." | Yes |
| 04 | Sender prefill | `on/04-email-with-prefill.png` | identical to 01 | Yes |
| 05 | Expired | `on/05-dead-expired.png` | "This link has run out" / "Links last 7 days." / "Ask Diego for a new one" / "Go to Bachata Calendar" | Yes |
| 06 | Revoked | `on/06-dead-revoked.png` | "This link was withdrawn" / "Ask Diego for a new one" | Yes |
| 07 | Used, signed out | `on/07-dead-used.png` | "You already joined" / "Sign in to continue." / "Sign in" / "Ask Diego for a new one" | Yes |
| 08 | Unknown link | `on/08-dead-invalid.png` | "This link does not work" / "It may have been copied incompletely." / "Ask the person who sent it for a new link." / "Ask for a new link" | Yes |
| 09 | Tap ask (expired) | `on/09-dead-expired-asked.png` | "Request sent. The admin will send you a new link." / "Go to Bachata Calendar" | Ends; no time or channel |
| 10 | Invite-only 403 on send | `on/10-signup-wall-403.png` | "We can't send a code to this email" / "Sign-up with this email provider isn't accepted. Use another email address, or message us and we'll help." / "Message us on WhatsApp" / "Use another email" | Two buttons, wrong reason |
| 11 | Code sent | `on/11-code-sent.png` | "Type your code" / "Sent to diego@ritmo.example. It can take a minute." / "Resend code in 60s" / "Wrong email? Change it" | Yes |
| 12 | Wrong/expired code (row 12 known, skipped) | `on/12-code-wrong-or-expired.png` | "That code is wrong or has run out. Check the email, or get a new code." | Yes |
| 13 | Rate limited | `on/13-rate-limited.png` | "Too many tries" / "We sent you a code a moment ago. Wait a minute, then try again." / "Try again" | Yes |
| 14 | Typo email | `on/14-bad-email.png` | "Use an email like name@example.com." | Yes |
| 15 | About, empty | `on/15-about-empty.png`, `15b-about-name-typed.png` | "A bit about you" / "Four things, then you're in." / "Continue" (disabled) / "Still to add: first name, city, dance role and photo." Above it, site banner "Finish your profile ... to rate parties." + "Finish profile" | Yes, but two buttons |
| 16 | Join card | `on/16-join-card.png` | "Join Ritmo Bachata London?" / "You'll finish a few details about you and the page, then you can add and edit events." / "Join Ritmo Bachata London" / "Not you? Use another email" | Yes |
| 17 | Done | `on/17-done.png`, `17-done-button.png` | "You're on Ritmo Bachata London's team." / "Everything on its page is yours to use: events, team and profile." / "Open your organiser home" (`/account/p3?o=...`) | Yes. OFF goes to the old organiser home |
| 18 | Redeem refused `profile_incomplete` (mock) | `on/18-redeem-profile-incomplete.png` | Join card again, NO message | No: silent |
| 20 | Home, N things left | `on/20-home-10-left.png` (+6/3/2) | "Finish your details first to create or edit events. It takes about five minutes." / "10 things left" / "Continue" / "Hide for today" | Yes. OFF: old home "Your to-do list", no banner |
| 21 | Event page | `on/21-event-10-left.png` | event menu: Repeats, Name and details, Prices, ... | n/a |
| 22 | Gate after Repeat Save | `on/22-gate-10-left.png` | "A few details first" / "We ask everyone who runs a page. It takes about five minutes and you only do it once." / "10 things left" + 10 rows / "Continue" / "Not now". 3 taps, 0 writes sent | Yes |
| 23 | After Continue | `on/23-after-continue-10-left.png` | "10 things left" / "10 to do. About not added (optional)." / ONE row "Your first name" / "Show all" / "Go to Home" | Yes, but no way back to the event |

## What changed since the old RESULTS (`claude/walk-invite-first-minute`)
Fixed (by #1301 and later):
- 07 used link: now "You already joined / Sign in to continue." with a Sign in button (was "ask for a new one" only).
- 08 unknown link: now has an "Ask for a new link" button (was a sentence only).
- 16 join card: promise reworded to "You'll finish a few details about you and the page, then you can add and edit events." (was "add and edit the events ... and manage its page").
- 20 Home banner: no longer says "Until then everything works as usual"; now says finish details first to create or edit events.
- 22 gate sheet: wording is clear and has "Not now".

Still open: 09 (no time or channel), 10 (wrong reason), 15 (two buttons), 18 (silent, mock shape unverified), 22 (refusal arrives after the work), 23 (one row, "Go to Home", no return to the event).
New: 20/22 now say "about five minutes" next to 10 rows, including nationality, languages, teach and DJ answers; that reads as under-promised. The 22 sheet at 10 rows pushes Continue to the bottom of the screen.

## Ranked remaining dead ends and wording gaps (worst first)
1. **Refusal after the work, and the edit is lost.** Repeat sheet filled, Save, gate sheet (`on/22-gate-10-left.png`); Continue lands on checklist with no route back to the event (`on/23-after-continue-10-left.png`, "Go to Home").
2. **Silent refusal on the Join card.** `profile_incomplete` shows the same card with no words, button looks dead (`on/18-redeem-profile-incomplete.png`). Mock shape, not verified against the server.
3. **Invite-only refusal worded as a blocked email provider** (`on/10-signup-wall-403.png`). The invite screen never shows which email was invited (`on/02-email-page-hint.png`).
4. **"About five minutes" vs 10 things** (`on/20-home-10-left.png`, `on/22-gate-10-left.png`); the checklist then shows one row at a time (`on/23-after-continue-10-left.png`).
5. **Two buttons for one job on About**: "Finish profile" banner above "Continue" (`on/15-about-empty.png`).
6. **Request sent has no time or channel** (`on/09-dead-expired-asked.png`).
7. **Done page says "Everything on its page is yours to use"** yet the first edit is gated (`on/17-done.png`, `on/22-gate-10-left.png`).
8. **Revoked link offers only "ask Diego"**, no hint it was withdrawn on purpose or who else to ask (`on/06-dead-revoked.png`).

## Not verified
- Every server answer is a mock; no prod data shape read. The 10/6/3/2 checklists use invented code mixes.
- I opened these pictures myself: on/01, 05, 09, 10, 13, 15, 17-done, 18, 20-home-10, 22-gate-10, 23-after-continue-10. Others (02-04, 06-08, 11, 12, 14, 15b, 16, 21, 6/3/2-left, all of `off/`) were read through `texts.jsonl` text only, not as images.
- `17-done.png` is tall and mostly empty because the capture resizes to the page height of the dev layout; no real-phone check.
- State 09: `askedNewLink` records false because the button is gone when the flag is read; the picture shows the click worked.
- Row 12 (wrong vs expired code) skipped as briefed. The 10-left flake in the ON run was not diagnosed.
- Vercel flag values on prod not read (needs owner: Vercel token).
