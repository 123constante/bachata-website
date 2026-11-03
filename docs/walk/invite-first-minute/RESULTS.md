# Walk: invite link, first minute to first event edit (390x844)

Brief: `docs/briefs/walk-invite-first-minute.md` (branch `brief/walk-invite-first-minute`). Spec: `tests/e2e/walk-invite-first-minute.spec.ts`
(not in the CI gate). Every server answer is a route mock; no product code touched, no prod write, no real invite, Supabase not queried.
Pictures: `docs/walk/invite-first-minute/on/` (both flags ON) and `.../off/` (flags OFF, only the states that differ). Exact screen words and
the controls on each screen: `on/texts.jsonl`, `off/texts.jsonl`.

## Flags: which one prod serves
- Code defaults (`src/lib/featureFlags.ts`): `organiserSelfServe` and `organiserP3` are both `false` unless the Vercel env var is exactly `'true'`
  (`VITE_ENABLE_ORGANISER_SELF_SERVE`, `VITE_ENABLE_ORGANISER_P3`). CI's e2e job sets them ON for the P3 walks only.
- What prod serves TODAY is a Vercel env value, not code. **Needs owner: Vercel token** (api.vercel.com is refused by this sandbox's egress proxy).
  Both columns are therefore walked. The gate itself (`gate_on`) is a server flag; the brief says it went ON 2026-11-02 08:01Z.
- Where the flags change what a new invitee sees: only after Join. ON: "Open your organiser home" -> `/account/p3?o=<org>` (P3 Home).
  OFF: the same button -> `/account/o/welcome?o=<org>`, then the old organiser home (`off/20-home-*.png`: a to-do list of 7 items, no checklist, no gate).

## Not verified (read first)
- Prod data shapes were not read (no Supabase query). The 10/6/3/2 checklists use the brief's counts with an invented code mix
  (person codes first_name, city, dance_role, photo, nationality, languages, teach_answer, dj_answer; page codes org_logo, contact_confirm; fewer for 6/3/2).
- "First event edit" = Repeat on the Friday event (Every week -> Monday -> Save), refused with the exact `onboarding_incomplete` shape. Other edit
  paths (Details, Prices, Cancel) were not walked; they share the same gate sheet.
- Server answers (preview, claim, redeem, OTP refusals) are the app's expected shapes, not captured from prod. Row 18 below may be a mock-shape miss.
- Taps from the link to the first edit are partly counted from the screens (typing not counted), only "event -> refusal -> checklist" was timed by the spec.

## Per state

Next action quotes are the words on screen. "ONE action?" = does the screen name a single next step.

| # | State | Picture | What the person is told (quote) | ONE action? | Notes |
|---|---|---|---|---|---|
| 01 | Page invite, no claim email, no prefill | `on/01-email-page-nohint.png` | "Diego invited you to manage Ritmo Bachata London" / "We'll send you an 8-digit code. No password needed." / button "Send my code" | Yes | Step 1 of 3 |
| 02 | Same, claim email set (masked hint) | `on/02-email-page-hint.png` | identical to 01 | Yes | The hint is never shown on the email step, so the person is not told WHICH email the invite is for; typing a different one is only caught later (wrong-account screen). |
| 03 | Person-bound ("This is your profile") | `on/03-email-person-bound.png` | "Hi Maria ... This is your profile on Bachata Calendar. Joining links it to your email, with everything already on it." | Yes | |
| 04 | Page invite, sender typed a first name | `on/04-email-with-prefill.png` | identical to 01 | Yes | Prefill only shows later on About. |
| 05 | Expired | `on/05-dead-expired.png` | "This link has run out" / "Links last 7 days." / button "Ask Diego for a new one" | Yes | |
| 06 | Revoked | `on/06-dead-revoked.png` | "This link was withdrawn" / "Ask Diego for a new one" | Yes | |
| 07 | Already used (signed out) | `on/07-dead-used.png` | "This link was already used" / "If that was not you, ask for a new one." | No | A person who DID redeem it and returns on another device is told to ask for a new link; no "sign in" way back. |
| 08 | Unknown link | `on/08-dead-invalid.png` | "This link does not work" / "It may have been copied incompletely." / "Ask the person who sent it for a new link." | No button | No control: the instruction is a sentence only; only "Go to Bachata Calendar". |
| 09 | Tap "Ask Diego for a new one" | `on/09-dead-expired-asked.png` | "Request sent. The admin will send you a new link." | Ends | No time, no channel (the person gave no email on this screen). |
| 10 | Sign-up wall: server answers 403 "limited to approved organisers" | `on/10-signup-wall-403.png` | "We can't send a code to this email" / "Sign-up with this email provider isn't accepted. Use another email address, or message us and we'll help." / "Message us on WhatsApp", "Use another email" | Two | `classifySendError` maps the invite-only 403 to the blocked-domain screen: wrong reason ("email provider"), and `SIGNUP_INVITE_ONLY_*` copy (auth-otp-routing.ts) is not used here. |
| 11 | Code sent | `on/11-code-sent.png` | "Type your code" / "Sent to diego@ritmo.example. It can take a minute." / "Resend code in 60s" / "Wrong email? Change it" | Yes | |
| 12 | Wrong or expired code | `on/12-code-wrong-or-expired.png` | "That code is wrong or has run out. Check the email, or get a new code." | Yes | Expired and wrong look the same; resend is disabled for 60 s. |
| 13 | Rate limited on send | `on/13-rate-limited.png` | "Too many tries" / "We sent you a code a moment ago. Wait a minute, then try again." | Yes | |
| 14 | Mistyped email | `on/14-bad-email.png` | "Use an email like name@example.com." | Yes | |
| 15 | About, nothing on the profile | `on/15-about-empty.png`, `on/15b-about-name-typed.png` | "A bit about you / Four things, then you're in." First name, city, dance role, photo (upload) + "Continue" | Yes | The site's own banner is ALSO on screen above it: "Finish your profile / Add your first name, city, dance role and photo to rate parties." with a second button "Finish profile" (two buttons for the same job). |
| 16 | Join card | `on/16-join-card.png` | "Join Ritmo Bachata London?" / "You'll be able to add and edit the events of Ritmo Bachata London and manage its page." | Yes | The promise "add and edit events" is what the gate later refuses (see 22). |
| 17 | Done (flags ON) | `on/17-done.png` | "You're on Ritmo Bachata London's team." / "Open your organiser home" -> `/account/p3?o=...` | Yes | Flags OFF: `off/17-done.png`, same words, goes to `/account/o/welcome`. |
| 18 | Redeem refused `profile_incomplete` (mock) | `on/18-redeem-profile-incomplete.png` | Join card again, no message | n/a | Mock may not match the server's shape; not verified. |

### 4. Home, flags ON vs OFF
- ON (`on/20-home-N-left.png`): "Finish your details to create and edit events." / "10 things left. Until then everything works as usual." / "Continue", "Hide for today". Then the cards "Next up", "Needs you: 2 events have no photo", "No views yet".
- OFF (`off/20-home-N-left.png`): old organiser home, "Your to-do list" of 7 items ("Change a date", "Add a date", "Cancel a date", "Answer a request to join" x2, "Add a flyer" x2). Nothing about the person's own details, no gate.

### 5/6. Checklist and the first event edit, flags ON, gate ON
Same path for N = 10, 6, 3, 2. Home banner `on/20-home-N-left.png` -> event page `on/21-event-N-left.png` -> Repeat, pick Monday, Save (3 taps) -> gate sheet `on/22-gate-N-left.png` (zero writes sent) -> Continue (4th tap) -> `on/23-after-continue-N-left.png`.

| N | Gate sheet says | Rows listed | After Continue |
|---|---|---|---|
| 10 | "A few details first" / "We ask everyone who runs a page. It takes about five minutes and you only do it once." / "10 things left" | Your first name, Your city, How you dance, Your photo, Nationality, Languages, Do you teach?, Do you DJ?, Page logo, Contact number | "10 things left" / "10 to do. About not added (optional)." ONE row ("Your first name", To do) + "Show all"; footer "Go to Home" |
| 6 | same, "6 things left" | first name, city, how you dance, photo, page logo, contact number | "6 things left", same layout, 53% |
| 3 | same, "3 things left" | first name, photo, page logo | "3 things left", 73% |
| 2 | same, "2 things left" | photo, page logo | "2 things left", 80%, first row "Your photo" |

- Can the person continue? Yes: "Continue" is `/account/p3/start?o=<org>&at=review`. "Not now" closes the sheet and the person stays on the event (1 tap).
- Taps back to the event: no control on the checklist says "back to your event". Footer is "Go to Home" (Home, not the event). The refused Repeat is not resumed; the person re-opens the event and redoes the 3 taps (not walked past the checklist: forms of each row not completed).
- Codes the brief lists that the sheet words as: first_name "Your first name", city "Your city", dance_role "How you dance", photo "Your photo", nationality "Nationality", languages "Languages", teach/dj "Do you teach?"/"Do you DJ?", org_logo "Page logo", contact_confirm "Contact number". Codes not shown in my shapes (instagram, dj_genres, teach_years, teach_levels, org_link) were not walked.

## The 5 worst places a person would stop (ranked)
1. **The refusal comes after the work, and the way out starts with one row.** The person fills the Repeat sheet, taps Save, and gets "A few details first ... 10 things left" with 10 rows (`on/22-gate-10-left.png`). Continue lands on "10 things left" showing ONE row ("Your first name") and "Show all", then "Go to Home" (`on/23-after-continue-10-left.png`). Nothing returns them to the event; the edit is lost.
2. **Home says the opposite of what happens next.** Banner: "Finish your details to create and edit events. 10 things left. Until then everything works as usual." (`on/20-home-10-left.png`). The first edit is then refused (`on/22-...`). "Works as usual" is false once the gate is on.
3. **Invite-only wall is shown as a blocked email provider.** A 403 "limited to approved organisers" on Send my code shows "Sign-up with this email provider isn't accepted" (`on/10-signup-wall-403.png`). The invite screen never says which email the invite is for (02 identical to 01), so an invitee who typed another address cannot tell why.
4. **Used or expired link has no way back in.** "This link was already used / If that was not you, ask for a new one." (`on/07-dead-used.png`) for the person who did redeem it and just returns; the only buttons are "Ask Diego for a new one" and "Go to Bachata Calendar". Unknown link (`on/08-dead-invalid.png`) has no button at all. After asking: "Request sent. The admin will send you a new link." with no time or channel (`on/09-...`).
5. **About asks for four things incl. a photo upload, under a second "Finish your profile" banner.** `on/15-about-empty.png`: two different buttons ("Continue" and "Finish profile") for the same job, while the Join card promises "add and edit the events" (`on/16-join-card.png`) and the edit later needs 2-10 more things. (The brief notes 6 of the 8 redeemed before the gate was ON; this walk cannot say where they stopped.)

No code fixes proposed.
