# P3 phone check (owner, one pass on a Vercel preview)

Drafted 2026-10-30, read-only. Run it AFTER PRs #1163 (plain sign-in link, invite opens sign-up),
#1164 (accepted invite lands on Welcome) and #1165 (old ticket screens point to P3) are merged.
Sources: `docs/handovers/p3-golive-wiring.md`, `docs/scoping/go-live-flags-checklist.md`
(PR #1166), the screens under `src/modules/organiser/p3`.

## Before you start (must be true, or the preview will not work)

1. **Preview settings in Vercel.** In the website project, Settings, Environment Variables, the
   **Preview** column must have, spelled exactly `true`:
   - `VITE_ENABLE_ORGANISER_P3`
   - `VITE_ENABLE_ORGANISER_SELF_SERVE`
   - `VITE_ENABLE_ORGANISER_TICKETING`
   - `VITE_ENABLE_ORGANISER_DETAIL` (so "View my page" can open the public page; optional)

   Anything else (blank, `True`, `1`) means OFF. A change only takes effect on a **new preview
   build**: after changing a value, redeploy the preview.
2. **The self-serve Preview setting is locked today.** `VITE_ENABLE_ORGANISER_SELF_SERVE` cannot be
   edited for Preview at the moment, and without it every P3 screen shows "not found". The owner
   unlocks it in Vercel (only the owner can), sets Preview to `true`, leaves Production as it is,
   and redeploys the preview. Claude cannot change Vercel settings.
3. **The preview uses the real database.** Everything you save on the preview is saved for real.
   Pages you create start as drafts and are not public. Use names that start with `WALK` so they
   are easy to find and remove later.
4. **Sign in by email link.** On the phone, open the preview address, go to `/auth`, type the
   email, tap the send button, then open the email ON THE SAME PHONE and tap the link.
   - For steps 2 to 5 use the walk test account (its email is `WALK_TEST_EMAIL` in the admin
     project's local settings file; the owner needs access to that inbox). It already owns a test
     page with draft `WALK ...` events.
   - For step 1 you need a **brand-new** email that has never signed up (for example a
     `yourname+p3check1@...` address).
   - If tapping the email link opens the live site instead of the preview, the preview address is
     not on the Supabase sign-in "Redirect URLs" list. The owner adds the preview pattern there (in
     the Supabase dashboard, Authentication, URL configuration). Not checked by Claude.
5. **Never tap "Go live" in this check.** On a real page Go live really publishes it: a draft page
   becomes public on the live site straight away (or is sent for a check), and switching the
   preview settings off afterwards does **not** undo it. All 49 real organiser pages are already
   live, so there is nothing to gain. Stop at the Review screen.
6. **Do not claim or ask to join a real organiser's page.** That sends a real request. You may
   search for one to see the result, then go Back.

## The check (6 steps)

### 1. First-time organiser lands on Welcome (brand-new email)

- **Tap path:** `/auth` &rarr; Join / sign up &rarr; brand-new email &rarr; when asked what you do,
  pick organising (not only dancing) &rarr; open the email link.
- **You should see:** a full-screen Welcome with your first name in the title (for example
  "Welcome, Sam") and one big button, **Find your page**. No tab bar yet.
- **Failure looks like:** you land on the home page, the old organiser home, a "not found" page,
  or the title flickers from one wording to another after it first appears.

### 2. Finish the dancer profile

- **Tap path:** same new account &rarr; Find your page &rarr; Not listed? Create a page &rarr; name
  `WALK phone check (do not publish)` &rarr; pick a city &rarr; Create page. If it asks you to
  **Finish your profile**, tap it and fill in the short "Your details" screens, then Continue.
- **You should see:** after the details, you come straight back to the page steps where you left
  off (no need to start again), with the progress bar further along.
- **Failure looks like:** a dead end with no button, a loop back to Welcome, the details screens
  forgetting what you typed, or "Create page" doing nothing with no reason shown.

### 3. Create or claim a page, up to Review (stop there)

- **Tap path:** keep tapping Continue through contact, WhatsApp, type of events, link and logo
  (skip what you can) until the Review screen. Then, as a second look: back on Welcome &rarr;
  Find your page &rarr; type two letters of a real organiser's name.
- **You should see:** Review lists anything still missing; each missing row jumps to its step.
  The bar reads below 100% while anything is missing. The search shows matching pages with a claim
  or "Ask to join" choice. **Do not tap Go live. Do not claim. Go Back.**
- **Failure looks like:** Review says ready while something is missing, a missing row that does
  not open its step, the bar at 100% with things left, or the search never finishing.

### 4. Open an event and change how it repeats (walk test account)

- **Tap path:** sign in as the walk test account &rarr; tab bar **Events** &rarr; tap
  `WALK weekly16 (draft, do not publish)` &rarr; tap the **Repeats** row &rarr; change the days
  (for example tick a second day) &rarr; wait for "The next dates" &rarr; **Save the new pattern**.
  Then open **Repeats** again, put it back, and save.
- **You should see:** the event page with its status row ("Draft"), Repeats, Sessions and the
  coming dates. The Repeat sheet shows "Checking which dates change&hellip;", then the next 8
  dates. After saving: "Saved. The dates follow the new pattern." and the Repeats row wording
  changes to match.
- **Failure looks like:** the event shows as Live, the sheet never stops checking, Save works
  before the dates are shown, the saved dates do not match what you picked, or a weekly event says
  "One date".

### 5. Team invite link opens sign-up

- **Tap path:** walk test account &rarr; tab bar **You** &rarr; **Team** &rarr; **Add someone**
  &rarr; **Share an invite link** &rarr; send it to yourself (or copy it) &rarr; sign out, or use a
  private browser tab &rarr; open the link.
- **You should see:** the link ends in `/auth?mode=signup` and opens the **sign-up** screen
  ("Join the community"), not sign-in.
- **Failure looks like:** the link is a plain `/auth` with nothing after it, or it opens the
  sign-in screen. (Plain `/auth` now opens sign-in on purpose, so a plain link means #1163 is not
  in this preview.)

### 6. Where ticketing lives (walk test account)

- **Tap path:** **Home** tab &rarr; look for the **Get paid** card; **You** tab &rarr; **Get paid**
  row; Events &rarr; any WALK event &rarr; **Tickets** and **Scan tickets** rows. Then type
  `/account/tickets` after the preview address.
- **You should see:** ticketing has no tab of its own; it sits only in those four places. The old
  `/account/tickets` address jumps straight to the Get paid screen. Buying tickets on the public
  event page is a separate setting that is not on in this check, so no Buy block is expected there.
- **Failure looks like:** any of the four places missing, a "not found" at `/account/tickets`, or
  the old ticket screens (a different look from the rest of P3) still showing.

## After the check

- Tell Claude which step failed and what the phone showed (a screenshot helps).
- The `WALK phone check` page from steps 2 and 3 is a draft on the real database; ask Claude to
  list it for removal through the admin side. Do not publish it.
- Not covered here: a real Go live, the "sent for a quick check" path (no city needs a check
  today), a real camera scan at the door, a real Stripe payment.
