# Organiser login: first run walk + authz re-check (2026-10-09)

Question: **can a brand-new organiser go from nothing to a live event?**

Answer on E2E today: **not without an admin stepping in out of band.** Sign-up, link, callback,
profile stub, claim and the event editor all work. The "create a new organiser" path dead-ends: the
new organiser is saved as `draft`, nothing in the UI can send it for review, the admin queue only
lists `pending_review`, and the New event form refuses until the organiser is approved.

Scope: E2E project `srrpvuxldthwumzrngla` for every write; prod `stsdtacfauprzrdebmzg` read-only
(settings, grants, policies, function bodies, row counts; no personal data). Website `main` @ `46a1b85`,
dev server with `VITE_ENABLE_ORGANISER_SELF_SERVE=true` (the launch-walk config). No product code changed.
Not covered here: gate, rollback, monitoring (another worker owns those).

Screenshots: `test-results/organiser-first-run/` (gitignored, local to the run). File names below.

## Task 1: the walk (E2E, 390x844 and 1280x800)

| # | Step | 390 | 1280 | What the stranger sees / notes |
|---|---|---|---|---|
| 1 | Open the site signed out | PASS* | PASS* | `/` redirects to `/city/london-gb`; E2E's city slug is `london`, so on E2E `/` is "Page not found" (E2E fixture gap, not a prod defect). Walked from `/city/london`. `01-home-signedout-*` |
| 2 | Reach sign-in | **FAIL (390)** | PASS | City home at 390 shows **no Sign in / account control at all** (bottom bar: Organisers, Venues, Community). 1280 has "Sign in" in the header. At 390 the header "Sign in" exists on `/organisers`. |
| 2b | The obvious "organiser" doors | **DEAD END** | **DEAD END** | Bottom-bar "Organisers" -> `/organisers` = "Coming soon -- Organisers. This section is under construction. If you have an event you'd like on the calendar, drop your details below -- Ricky will call you to add it." Footer "Get listed" -> WhatsApp. Public organiser pages are also "Coming soon -- Organiser" (`VITE_ENABLE_ORGANISER_DETAIL` off), so the "Is this you?" claim card is unreachable. Nothing on the public site says organisers can sign up and run their own listing. `02-organisers-390`, `40-B-public-org-signedout-390` |
| 3 | Sign up (fresh address) | PASS (UI) / **FAIL (send)** | -- | "Join the community / Create your account in 3 easy steps." Role step offers Dancer; Organiser hides under "I'm also an organiser / teacher / DJ / videographer / vendor". Details: first name + city. Email: "Email me a link". Send failed: E2E GoTrue answered **400 `email_address_invalid`** for a `.test` address, then **429 `over_email_send_rate_limit`** on the next try (E2E uses Supabase default SMTP). UI copy for both: "We couldn't send your email. Please try again in a moment." -- no hint that the address itself was refused. `04`..`08-*-390` |
| 4 | Read the confirmation link | n/a | n/a | **E2E has no inbox** and the Management API key fetch the seed script uses was refused in this cloud run. Instead the user + a known `confirmation_token`/`one_time_tokens` row were written on E2E by SQL (same shape GoTrue writes, same metadata the form sends) and the browser followed the real `GET /auth/v1/verify?token=...&type=signup&redirect_to=...` link. |
| 5 | Redirect after the link | PASS | -- | GoTrue honoured `redirect_to=http://127.0.0.1:4191/auth/callback?...` on E2E (303 -> callback). The prod redirect-normalisation issue could not be reproduced or checked (doc `prod-issue-supabase-redirect-normalisation.md` not present in either repo; prod allow-list not readable). One prod `/verify`/`/otp` log line in the last 24h has referer `https://www.bachatacalendar.co.uk/` (bare root), the rest `/auth/callback?...` -- weak hint only. `09-callback-A-390` |
| 6 | First profile on callback | PASS | -- | Signup trigger made the `dancer_profiles` stub; callback filled `first_name` + `based_city_id` from metadata. The "dancer profile autocreate fails" issue did **not** reproduce on E2E (caveat: user row written by SQL fires the same trigger, but not GoTrue's own insert path). Session `amr=otp`, `email_confirmed_at` set. |
| 6b | Where the callback lands | **FAIL (UX)** | -- | With `returnTo=/organisers` (signed up from the Organisers tab) the new organiser lands back on the "Coming soon" lead form. Without returnTo: `/account` -> `/account/o` "Which organiser are you?" (PASS). Signed in, the header shows "Your account" -> `/account/o`. `10-home-signedin-390`, `11-account-first-run-390` |
| 7a | Become an organiser: create new | PASS (create) / **DEAD END** | **DEAD END** | "Create a new organiser -- Name and city. The team checks new organisers within a day." -> "Firstrun New Org A is saved as a draft. It is not public until the team approves it." Then: **Home** shows "No events yet / Add your first event... / New event" with no status note and no Send for review; **New event** refuses: "Firstrun New Org A is not public yet. Once the Bachata Calendar team approves it you can add events." (Create event disabled); **Profile** says "This profile is not available. It may have been switched off. Ask the Bachata Calendar team." The organiser stays `draft` in the DB; the admin queue (`admin_list_pending_review_v1`) lists `pending_review` only, so the team never sees it. `20..23-A-create*/home-after-create-390`, `24-A-new-event-FAIL-390` (the refusal), `30-A-profile-draft-org-390`, `70..75-A2-*-1280/390` |
| 7b | Become an organiser: claim existing | PASS | PASS (UI same) | Search shows "Its contact email is yours, so you can claim it now. [Claim]" -> "Firstrun Claimable Org is yours. You can now manage it." Profile: "STATUS Live". Organisers with another email show only "Listed with a different email. Ask to join and the team replies within a day." / "Run by someone else. ..." -- no Claim button. `50..57-B-*-390` (`51-B-claim-other-FAIL` = expected: no Claim button on another's organiser) |
| 8 | First event -> Send for review | PASS (after workaround) | PASS (after workaround) | Workaround for 7a: `submit_organiser_profile_v1` as the user (RPC 200, draft -> pending_review) and `admin_approve_entity_v1` as the E2E admin. Then: New event (Party) -> weekly + E2E Test Venue -> session 21:00-02:00 -> cover -> **Send for review -> "In review"**; Home lists the dates "In review". No 4xx from Supabase. `20..25-A-{new-event,repeats-venue,session,cover,send-for-review,home-after-send}-390/1280` |

Dead ends / empty states without a next action / wrong copy, ranked:

1. **Draft organiser cannot be sent for review from the UI (P0 for self-serve launch).** Root cause in
   code: `create_organiser_profile_v1` inserts `is_active=false`; the Profile page reads the organiser
   through `fetchOrganiserEntity` (`src/modules/profile/organiserPublicProfile.ts:50`) which filters
   `NOT_DEACTIVATED` (`is_active is not false`), so it renders `profile-missing` and the `ReviewCard`
   (the only "Send for review" for the organiser) never mounts. `organiserStatusView`
   (`src/modules/organiser/shared/homeModel.ts`, the draft note + `canSendForReview`) has no caller.
   Copy "The team checks new organisers within a day" is untrue for this path.
2. Home for a draft organiser offers "New event" / "Add your first event", and the form then refuses.
3. Profile for a draft organiser says "It may have been switched off" -- wrong for a brand-new draft.
4. Mobile city home has no Sign in entry (390). The Organisers tab and public organiser pages are
   "Coming soon" lead forms (flags off on E2E dev; prod flag state not verified) and "Get listed" goes
   to WhatsApp: a stranger organiser is steered to Ricky, not to self-serve.
5. Signing up from `/organisers` returns the new organiser to the "Coming soon" form.
6. Send-email failures (invalid address, rate limit) share one generic message.

## Task 2: authz re-check (prod read-only; E2E probes as a fresh stranger)

Auth settings (`GET /auth/v1/settings`, anon/publishable key) -- prod and E2E identical:
`disable_signup=false`, `mailer_autoconfirm=false`, `phone_autoconfirm=false`, `external.email=true`,
every OAuth provider false, `anonymous_users=false`, `passkeys_enabled=false`. **Rate limits / SMTP
host / redirect allow-list: NOT read** (they are only in the Management API auth config; that call was
refused in this run). Prod auth logs, last 24h: `/otp` 200 x4, `/verify` 303 x3 + 200 x1, no
`over_email_send_rate_limit`. E2E: default SMTP (rejects `.test`, 429 after ~2 sends/hour).

| Object | Who can do what | Risk | Evidence |
|---|---|---|---|
| `organiser_profiles` table | anon/authenticated: column SELECT only (no INSERT/UPDATE/DELETE grant). RLS on; one SELECT policy (`live` OR admin OR owner/manager OR city ambassador). | Low | prod `role_table_grants` has no rows for anon/authenticated (column grants only, A57); E2E stranger PATCH name/contact_email and POST insert -> **403 42501** |
| `entity_members` table | authenticated has table INSERT/UPDATE/DELETE grants; RLS insert/update/delete = `_self_serve_is_admin()`; select = admin or own rows | Low (RLS is the only wall; grants are wider than needed) | prod `pg_policy`; E2E stranger POST owner row on another organiser -> **403 RLS** |
| `claim_organiser_v1` (DEFINER, authenticated) | Claims a `live` organiser with no owner and `claimed_by` null/self, only when `_caller_proven_email_p5()` = `contact_email` | Low | Body: `_mailbox_proven_p5()` needs a session whose amr is otp/magiclink/recovery/email-signup/invite AND `email_confirmed_at` not null. So it does **not** trust `auth.users.email` alone. Row locked `FOR UPDATE`. E2E: other email -> `email_mismatch`; has owner -> `organiser_already_claimed`; own -> 200 owner |
| `create_organiser_profile_v1` (DEFINER, authenticated) | Any signed-in user makes a `draft` organiser (they become owner); `contact_email` only = own proven email; name unique vs `live` only; max 3 open drafts per user | Low (draft-name squatting of an unlisted organiser's name is possible; admin review is the gate) | Body; E2E foreign email -> `contact_email_not_own` |
| `organiser_profile_update_p5_v1` | owner/manager/admin; key allow-list; `contact_email` changes admin-only (trigger) | Low | E2E stranger -> `permission_denied`; owner setting foreign contact_email -> `contact_email_admin_only` |
| `submit_organiser_profile_v1` | owner/manager; draft/rejected -> pending_review | Low | E2E stranger -> `not_authorised` |
| `request_organiser_access_v1` | any signed-in user, live organiser, not already member; 1 open per organiser, 10 open total; writes an audit row only | Low (spam bounded) | Body |
| `resolve_organiser_access_request_v1`, `admin_add_entity_member_v1` | admin or the organiser's owner | Low | Body gate; E2E stranger `admin_add_entity_member_v1` -> `not_authorised` |
| `remove_organiser_member_v1` | owner/manager; manager only self; cannot remove another owner or the last owner | Low | Body |
| `admin_save_organiser_v1`, `admin_delete_organiser` (`is_admin()`), `admin_set_organiser_lifecycle_v1`, `admin_remove_entity_member_v1` (`_self_serve_is_admin()`) | admin only | Low | Body gates |
| `_sync_series_organiser_junction_from_array_v1` (DEFINER, anon-executable) | returns `trigger`: not callable through PostgREST | None | `prorettype=trigger` |
| `save_my_organiser_profile_v1` | own person row's legacy `organising_role_details` only | None for organiser_profiles | Body |

Ranked: no authz hole found. Watch items: (1) `entity_members` relies on RLS alone over full
table grants to `authenticated`; (2) claim depends on `contact_email`, which only 1 of 45 prod live
organisers has (43 of 45 have no owner), so in practice almost every existing organiser is
"Ask to join" -> owner/admin decides; (3) draft-name squatting.

Prod counts used (no personal data): live organisers 45; live with no owner 43; claimable by email 1;
self-serve organisers 1; auth users 23, unconfirmed 10.

## What could NOT be verified

- Real email delivery (no inbox on E2E; E2E default SMTP rejects `.test` and rate-limits), the
  emailed 8-digit code path, and the prod SMTP/rate-limit/redirect allow-list config.
- The prod redirect-normalisation issue; the prod values of `VITE_ENABLE_ORGANISER_DETAIL` /
  self-serve flags (prod site unreachable from this sandbox: proxy 403).
- A real phone (Playwright Chromium with touch at 390 only).
- Sign-up through GoTrue's own user insert (the user row was written by SQL on E2E).
- The admin moderation UI itself (approval done through `admin_approve_entity_v1`).

## E2E fixtures this run left

Users `e2e-firstrun-a-20261009@` / `e2e-firstrun-b-20261009@fixtures.bachata-admin.test`;
organisers "Firstrun New Org A" (live after workaround), "Firstrun Claimable Org" (live, owned by B),
"Firstrun New Org B2" (draft); series "Firstrun Party 390" / "Firstrun Party 1280" (in review).

## Spec

No Playwright spec added: sign-up needs a mailbox or a service-key link generator, neither available
deterministically in this run. The drivers were throwaway scripts; the steps above are the recipe.
