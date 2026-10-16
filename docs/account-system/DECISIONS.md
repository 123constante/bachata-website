# Decisions needed: click questions, in 3 rounds of 4

The owner decisions O1-O8 (ACCOUNT-MODEL section 6) are binding and are not asked again. Every other question
the model leaves open is here. The **recommended option is listed first** with its reason. Each question names
the grid rows and GAPS ids it settles.

The rounds are ordered by what blocks building:

- **Round 1** blocks launch safety.
- **Round 2** changes how sign-in and sign-out behave.
- **Round 3** settles edge routing and operations.

PLAN.md uses each recommended option as its default. Changing an answer changes only the PR named.

---

## Round 1: launch safety (answer before PR-3 and PR-6)

### D9. Which sign-up hook is wired in the Supabase dashboard right now? (GAPS G-S2, G-R1)
The worker cannot read this through SQL. The dancer area is open (flag true since 14:05 today). If the
dashboard still calls v1, every non-allowlisted sign-up is refused.
1. **I'll check and switch it to `hook_before_user_created_v2` (recommended).** v2 is the only hook that
   makes the area flag a working sign-up kill switch. Runbook: admin `docs/runbooks/dancer-area-open-close.md`.
2. It is already v2.
3. Keep v1 (sign-up stays allowlist-only even with the area open).

### D10. Bot protection on sign-up (GAPS G-S1)
1. **Turn on Cloudflare Turnstile now and seed the disposable-domain blocklist (recommended).** Sign-up is
   open, CAPTCHA is off and the blocklist is empty. Every bot sign-up spends one of the 30 auth e-mails per
   hour (G-S3). Turnstile is free and mostly invisible. Notion and Slack gate e-mail sends the same way.
2. Seed the blocklist only; add CAPTCHA if abuse shows up.
3. Neither for now.

### D1. What sign-out clears on this device (grid `ac.signout.storage`, GAPS G-P1, MATRIX M76)
1. **Every person-scoped key, on every sign-out path and on the `SIGNED_OUT` event from other tabs
   (recommended).** On a shared phone, the next person's sign-up form is pre-filled with the last person's
   e-mail, name and city today. Google and Meta wipe all local traces on sign-out.
2. Clear only the form state (`auth_form_state_v1`, `auth_last_email`).
3. Leave as is.

### D8. Terms and privacy consent (GAPS G-P2)
`member_consents` has 0 rows, so there is no record that anyone accepted anything.
1. **A "By continuing you accept the Terms and Privacy policy" line on the sign-up e-mail step, recorded with
   `accept_terms_v1` at the first callback. Existing logins see a one-tap accept on their next sign-in
   (recommended).** This is the lightest way to meet GDPR Art. 7(1) (able to show consent) and matches
   Google's and Slack's clickwrap. It needs `/terms` and `/privacy` pages: does the owner have the text?
2. A tick-box the person must tick (explicit, but costs conversion; only needed for marketing consent).
3. Not now.

## Round 2: sign-in and sign-out behaviour (answer before PR-3)

### D6. Sign-out scope (GAPS G-S6)
Today, signing out on a phone also signs the laptop out (Supabase default `global`).
1. **Sign out this device only, and add "Sign out of all devices" in Account settings (recommended).** This is
   what Google, Slack and Meta do. It also gives a person who lost a phone a way to end that session.
2. Keep global on every sign-out.
3. Local only, with no "all devices" button.

### D7. The code screen after a reload, and after repeated wrong codes (grid `si.code-step-reload`, G-S4)
A reload on the code screen today drops back to the e-mail form, and the e-mailed code is wasted.
1. **Remember "code sent to <e-mail>" for 10 minutes in sessionStorage, so a reload shows the code box again.
   After 5 wrong codes, show "Send a new code" instead of the box (recommended).** On phones a mail-app
   round-trip often reloads the tab. The cap mirrors Google's "too many attempts".
2. Remember the code step only (no client cap; the server limit decides).
3. Leave as is.

### D11. Dancer invite opened while signed in as a different e-mail (grid `di.other-email`, O6)
The back end binds the invite to the e-mail (`email_mismatch`). A team invite is bearer (O3).
1. **Keep it e-mail-bound: the card names the signed-in e-mail, masks the invited one (`r***@ymail.com`) and
   offers "Sign out and continue" (recommended).** A dancer invite hands over a person's own profile, so it
   must reach that person. Meta binds Page-role invites to the invited account in the same way.
2. Make it bearer like the team invite (the back end must change).

### D15. How to retire the 30-day grace erase path that contradicts O4 (GAPS G-P4)
1. **Unschedule the cron, undeploy `account-erase-due`, revoke EXECUTE on the request/cancel/run-as RPCs and
   leave the table empty as a record (recommended).** It is reversible, has 0 rows and needs no data
   migration. The Website drops `erase_requested_at`.
2. Drop the table, RPCs and function outright.
3. Keep it dormant as is (it stays callable by any signed-in person through PostgREST).

## Round 3: edge routing and operations (answer before PR-1 finishes)

### D2. Admin with no dancer profile (grid `si.admin-only`, `ol.admin-only.signed-in`, `dp.app.admin-only`)
1. **Keep today's behaviour: sign-in lands on `/`, and opening the organiser area runs the dancer setup first
   (recommended).** These are 2 internal accounts. The "dancer side first" rule (model rule 4) stays without
   exceptions, and admins work in the admin app.
2. Give admins a direct `/account/o` path without a dancer profile.

### D3+D4. Onboarding re-entry (grid `ol/dl.new.back-each-card`, `xd.two-tabs-onboarding`, `dp.app-welcome.finished`)
1. **Back from an onboarding end never re-opens "You're in" (replace navigation, as today). Two tabs mid-
   onboarding is acceptable as is. A finished dancer opening `/app/welcome` sees the end card "Go to Home",
   never the questions again (recommended).** Questions already answered are never asked twice; the end
   card is harmless.
2. Same, but `/app/welcome` for a finished dancer redirects straight to `/app/home`.

**Settled reading of D4 (orchestrator, for the owner; review S3):** D4 means "a finished dancer is never sent back into setup". A 100% dancer on `/app/welcome` goes straight on; a 70-99% dancer sees the end card. Changing it needs a dancer-app-only PR.

### D5. Team contributor role: does it give an organiser side? (model section 8)
`organiser_home_v1` counts owner and manager only. `entity_members` holds only owner rows today.
1. **No side for contributors until a contributor screen exists (recommended).** A side with nothing to do
   is a dead end. Notion shows a workspace only to members who can open something in it.
2. Contributors get a read-only side.

### D12. Session lifetime and the funnel dashboard (GAPS G-S7, G-O1)
1. **A 90-day inactivity timeout, and an admin-only funnel table (counts per step, no personal data) next to
   `window.dataLayer` (recommended).** 7 of 13 live sessions are older than 30 days. 30% of logins never
   entered their code, and nobody could see that. A DB table is readable without Google Analytics access.
2. A 30-day timeout plus the funnel table.
3. No timeout; dataLayer events only.

---

**Owner tasks that are not questions** (no choice, just a person with access):

- Read the dashboard Auth settings once and paste them into PR-6, or grant a Management-API token so the
  contract check can read them.
- Add `rua=` to DMARC, then move to `p=quarantine` after 2 clean weeks (G-D1).
- Add an inbound MX (G-D2).
- Raise the auth e-mail rate limit above 30 per hour (G-S3).
