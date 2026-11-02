# Claim paths inventory (claim-by-code-design-r1)

Written BEFORE `PLAN.md`, per the brief. Read-only: code read at `origin/main` ecfe506;
live RPC bodies and counts read from prod `stsdtacfauprzrdebmzg` on 2026-11-01 with
SELECT only (no writes, no personal data; counts only).

## 1. Every claim path today

| # | Path | Website entry (file:line) | Live RPC / evidence | Notes from the live body |
|---|------|---------------------------|---------------------|--------------------------|
| P1 | **Instant claim** from the public page card | `src/modules/organiser/shared/components/PublicClaimCard.tsx:172` (`claim`), `:291` confirm button; API `src/modules/organiser/shared/selfServeApi.ts:173` | `claim_organiser_v1(p_organiser_id uuid) -> jsonb`, SECURITY DEFINER, EXECUTE: authenticated, service_role (no anon) | Order: `authentication_required` -> `_require_complete_dancer_profile_v1()` (dancer gate) -> `organiser_id_required` -> lock `organiser_profiles` row FOR UPDATE -> `organiser_not_found` -> idempotent `already_claimed` if caller already owner (repairs NULL `claimed_by`) -> `not_live` -> `organiser_already_claimed` (owner row exists or `claimed_by` someone else) -> `no_contact_email` -> evidence `lower(btrim(COALESCE(claim_email, contact_email)))` vs `_caller_proven_email_p5()` (raises `mailbox_unproven`, `auth_user_email_missing`) -> `email_mismatch`. Success: insert `entity_members` owner (primary if none), set `claimed_by`, audit `_write_entity_decision_audit('organiser', id, 'claimed', …)`. |
| P2 | **Mailbox proof** (prove the SIGNED-IN user's own email) | `src/modules/organiser/shared/components/EmailCodeProof.tsx:45` (`signInWithOtp`), `:74` (`verifyOtp`); shown at `PublicClaimCard.tsx:300`, `:346` | Supabase Auth OTP; session `amr` gains `otp`, read by `_mailbox_proven_p5()` / `_caller_proven_email_p5()` | Code goes to the **account's** email, never to the page's contact. It proves "I own my inbox", not "I own this page". This is the existing code UX the new feature can reuse visually, not functionally. |
| P3 | **Auto-claim at sign-in** | `src/components/auth/AuthStepper.tsx:154` -> `src/lib/claimMyOrganisers.ts:63` (`CLAIM_MY_ORGANISERS_RPC` at `:15`, 4 s timeout `:16`) | `claim_my_organisers_v1() -> jsonb`, SECURITY DEFINER, authenticated + service_role | Returns `{status:'no_email'|'email_unproven', claimed:[]}` early; else claims every live unowned organiser whose claim email / invite email equals the proven account email (`via: claim_email | invite`), audits, also calls `claim_my_dancer_profile_v1`. Reads `organiser_claim_emails`, `organiser_invites`. |
| P4 | **Post-claim notice / "Not you? Tell us"** | `src/modules/organiser/home/ClaimNotice.tsx:10`; storage helpers `src/lib/claimMyOrganisers.ts:109-128` | none (sessionStorage `bc_org_claim_notice_v1`) | The only undo for a P3 claim that skipped a confirm screen. Any new silent claim must feed the same notice. |
| P5 | **Claim hints** (what the card offers) | `src/modules/organiser/shared/selfServeApi.ts:136` (call), `:109` (accepted hint list); type `src/modules/organiser/shared/claimHint.ts:16`; decision `src/modules/organiser/shared/ownership.ts:72-89` (`ownershipFacts`) | `organiser_claim_hints_v1(p_organiser_ids uuid[]) -> jsonb`, authenticated + service_role, max 50 ids | Hints: `yours`, `managed`, `no_email`, `email_matches`, `email_matches_unproven`, `email_differs`. `no_email` means no claim_email AND no contact_email (phone is ignored). |
| P6 | **Ownership read** (public, anon) | `src/modules/organiser/shared/ownershipApi.ts:27-31`; used `src/pages/OrganiserProfile.tsx:741` | `organiser_ownership_v1(p_organiser_id) -> jsonb`, anon + authenticated | Drives `kind` = `hidden/managed/sign_in/claim/request/member` (`ownership.ts:31`). |
| P7 | **Ask to join** (request access) | `PublicClaimCard.tsx:242` (`request`), `:307-334` panel; API `selfServeApi.ts:179`; owner/admin answers via `selfServeApi.ts:441` and `src/modules/organiser/flows/fix/JoinRequest.tsx:21` | `request_organiser_access_v1(p_organiser_id, p_message) -> jsonb`; `resolve_organiser_access_request_v1(p_request_id, p_decision, p_member_role, p_note)` | Dancer gate; `not_live`; `already_member`; message <= 500 (`message_too_long`/`message_invalid`); `request_already_open`; `request_limit_reached` (10 open per user). Stored as an audit row `access_requested` (no table of its own). On an UNOWNED page only an admin can answer. |
| P8 | **Organiser invite link** `/invite/<token>` | route `src/components/AnimatedRoutes.tsx:284`; page `src/modules/admin-organisers/InviteRedeemPage.tsx`; API `src/modules/admin-organisers/adminApi.ts:117` (redeem), `:126` (preview), `src/modules/admin-organisers/inviteRedeemApi.ts:37` (`request_new_invite_v1`) | `redeem_organiser_invite_v1(p_token text) -> jsonb` (authenticated, service_role); `organiser_invite_preview_v1(p_token)` (anon); `request_new_invite_v1(p_token)` (anon) | Returns `{ok, reason|status}`; reasons seen: `sign_in_required`, `unconfirmed_account`, `email_unproven`, `email_mismatch`, `invalid`, `rate_limited`, `team_full`, `link_failed`, `not_linked`; statuses `redeemed`, `already_member`. Token stored as `token_hash bytea`. Rate limit: `c_limit = 10` FAILED attempts per user, per-user advisory lock `hashtextextended('organiser_invite_redeem:'||user)`, day-old rows pruned 100/call; a `rate_limited` answer is not itself recorded. |
| P9 | **Admin issues invite / enters claim email** | `src/modules/admin-organisers/adminApi.ts:86` (`admin_issue_organiser_invite_v1`), `:97` revoke, `:67` list | `admin_issue_organiser_invite_v1(p_organiser_id, p_email, p_first_name, p_city_id)`; `organiser_claim_emails` is written from the ADMIN repo (no writer in this repo) | This is the "admin first enters the email" step the owner wants to remove for pages that HAVE a contact. |

## 2. Every data field involved

| Field | Where | Access (live) | Role in claiming |
|---|---|---|---|
| `organiser_claim_emails.claim_email` (+ `updated_at`, `updated_by`) | private table | RLS on, 0 policies, grants postgres + service_role only | First choice of evidence (P1, P3, P5). Prod: **0** unclaimed live pages have one. |
| `organiser_profiles.contact_email` | profile | never selected by the Website (`ownershipApi.ts:4-5`); public only via `get_organiser_public_contact_v1` when `show_email_publicly` | Fallback evidence. |
| `organiser_profiles.contact_phone` | profile | public via the same RPC when `show_phone_publicly` | **Not evidence today** anywhere. |
| `show_email_publicly` / `show_phone_publicly` / legacy `show_contact_publicly` | profile | — | Visibility only; must not gate who receives a code (a hidden address is still the organiser's). |
| `organiser_profiles.claimed_by` | profile | read only via RPCs | Set on claim; legacy pointer also means "managed". |
| `entity_members` (owner/manager/contributor, `is_primary`) | membership | — | The real ownership fact. |
| `organiser_invites` (`token_hash bytea`, `expires_at`, `used_at/by`, `revoked_at/by`, `email`, `bound_via`, …) | invites | RLS on, 0 policies, postgres + service_role only | P8/P9. |
| `organiser_invite_redeem_attempts` (`id, user_id, attempted_at, outcome, invite_id`) | attempts | RLS on, 0 policies, postgres + service_role only | The existing rate-limit table; the model to copy. |
| audit rows via `_write_entity_decision_audit` | audit | — | `claimed`, `access_requested`, invite events. |

## 3. GAPs found

- **G1 — phone is the real contact, and nothing can use it.** Of 38 unclaimed live pages, 32 have
  only a phone. Email-only code delivery helps **2** pages. (See counts.)
- **G2 — the owner's "14 of 15 founding pages with no contact" does not match prod as counted here.**
  There is no "founding" column (`profile_source` is `admin_create` for all 38). By the claim RPC's own
  rule (`claim_email` else `contact_email`), 36 of 38 have **no email evidence**, 4 have no contact at all.
  The brief's number may use another list; owner to confirm which set "founding" means. The design does
  not depend on it: any page without a usable contact stays ask-to-join.
- **G3 — Website drops a live hint.** `selfServeApi.ts:109` accepts 5 hints; the DB also returns
  `email_matches_unproven`, which the parser discards (hint -> absent -> card offers "request").
  The card still recovers via `mailbox_unproven` on a claim, but the offered action is wrong for that shape.
  Not fixed here (docs-only); listed for the build PR.
- **G4 — no code can reach a page contact today.** P2 sends only to the signed-in account's email
  (Supabase Auth). Sending to a third-party address needs a server sender. Live senders exist
  (`ticket-email`, `dancer-invite-send`, `send-listing-request-email`, `send-event-whatsapp`) but their
  providers/templates were **not read** in this run.
- **G5 — ask-to-join on an unowned page has no owner to answer it**; only an admin can. Unchanged by
  this design but it is the fallback for 36+ pages, so admin triage volume matters.
- **G6 — `organiser_claim_emails` writer lives in the admin repo**; not inspected here.

## 4. Counts from prod (unclaimed = live, `claimed_by` NULL, no owner row)

| Contact kind | Pages |
|---|---|
| Email evidence (claim_email or contact_email) | 2 (claim_email: 0; contact_email: 2; of those, email public: 1) |
| Other (phone only) | 32 |
| None | 4 |
| **Total unclaimed live** | **38** |

Phone present and public on 34 (phone with or without email).

## 5. Coverage

**9 paths (P1-P9), 9 covered, none silently omitted.** 9 data items covered. 6 GAPs listed.
