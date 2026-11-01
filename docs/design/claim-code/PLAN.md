# Claim a page by one-time code: data design (r1)

Status: DESIGN ONLY. No SQL file, no feature code, no prod write. Pseudo-signatures only.
Reads: [`INVENTORY.md`](INVENTORY.md) (paths P1-P9, gaps G1-G6, prod counts).
Migrations will live in `bachata-admin-11april` (this repo owns none).

## 0. The goal in one line

A signed-in dancer on a public organiser page asks for a code; the code goes to the
**page's own contact**; whoever can read that contact types it back; they become owner.
No admin step. Pages with no usable contact stay **ask to join** (or a hand-sent invite link).

### Owner forks (need a decision before the build PR; recommendation first)

| Fork | Recommendation | Why |
|---|---|---|
| F1 Channel | **Email in v1; table carries `channel` so WhatsApp is v2 with no schema change.** | Prod: email evidence on 2 of 38 unclaimed pages, phone-only on 32 (G1). Email-only v1 helps 2 pages. A WhatsApp sender exists (`send-event-whatsapp`) but a WhatsApp code needs an approved template and phones on a page are often a shared promoter line. Owner should know v1 alone moves ~5% of the backlog. |
| F2 Hidden email | **Send to `contact_email` even when `show_email_publicly` is off.** | Visibility is about visitors, not about who the page belongs to. Only a mask is ever shown. |
| F3 "14 of 15 founding" | Owner to name the set. | Prod has no "founding" marker; by the claim rule 36 of 38 have no email (G2). Design does not depend on it. |

## 1. Which contact, how it is shown, and the no-contact page

**Target address**, decided in the database, never by the client:
`COALESCE(organiser_claim_emails.claim_email, organiser_profiles.contact_email)`, trimmed and
lower-cased exactly as `claim_organiser_v1` does. Same evidence rule as the instant claim, so the
two paths can never disagree about whose page it is. Phone: not a target in v1 (F1).

**Never leaked.** The address leaves the database only to the sender (service side). The browser
gets a **mask only**, computed in SQL: first character of the local part, `***`, `@`, first
character of the domain, `***`, then the last label: `r***@g***.com`. Local parts of 1 character
render as `*` only. The mask is returned only to a signed-in, non-anonymous caller, only for a
live page with no owner, and only after the dancer gate passes (same gate as claiming).

**Public page copy** (in the build PR; HTML entities, never raw punctuation):
- Has email target: "Is this your page? We can send a code to r***@g***.com." + `[Send code]`,
  then a code box; below, a quiet "Can&rsquo;t get to that inbox? Ask to join instead."
- No target (no email; phone-only counts as none in v1): **no code UI at all**, only
  "Ask to join" with: "We&rsquo;ll check with you before giving access." No mention of codes,
  no "one tap". Batch-1 outreach text must not promise one-tap claim.
- Signed out: unchanged (`kind: 'sign_in'`); the mask is never shown to anon.

## 2. The code

| Property | Value | Note |
|---|---|---|
| Format | 8 digits, leading zeros kept, from `gen_random_bytes` (not `random()`) | Same length users see from Auth OTP in prod (`EmailCodeProof.tsx:21`). |
| Expiry | 15 minutes | |
| Single use | `used_at` set on success; every other open code for that page is `superseded_at` | |
| One live code per (page, user) | a new request supersedes the caller's previous code for that page | |
| Bound to | `(organiser_id, user_id)` of the requester AND a hash of the target address | A code is useless in another account; if the contact changes after sending, redeem says `contact_changed`. |
| Storage | `code_hash = sha256(salt || code)`, per-row 16-byte random `salt`; plaintext never stored | Compare in SQL; no plaintext column, no plaintext in audit or logs. |
| Wrong guesses per code | 5, then the code is burned (`too_many_attempts`) | 5 / 10^8 per code. |
| Failed redeems per user | 10 per 24 h across all pages (copy of `c_limit = 10`, P8) | |
| Failed redeems per page | 20 per 24 h across all users | Stops many accounts grinding one page. |
| Sends per user | 1 per 60 s, 3 per hour, 5 per 24 h | |
| Sends per page (spam to the contact) | 3 per hour, 5 per 24 h, across all users | The contact can be mailed at most 5 times a day by this feature. |
| Who can request | authenticated, non-anonymous, confirmed account (`_member_target_account_p5` problem = none), complete dancer profile, not already a member, page live and unowned | Exactly the people `claim_organiser_v1` would let claim. |

**Abuse cases**

| Case | Defence |
|---|---|
| Enumerate pages to harvest masks | Mask only for live+unowned pages, signed-in + dancer gate; 38 such pages today; mask reads are capped at 30 distinct pages per user per 24 h (attempt rows of kind `target`), returning `rate_limited` after that. |
| Spam a contact | Per-page send cap (5/day) + per-user cap; the email says who asked and that ignoring it is safe. |
| Brute-force the code | 10^8 space, 5 guesses per code, 10 per user/day, 20 per page/day. |
| Replay | `used_at` + supersede; code bound to requester and target hash. |
| Talk the real organiser into reading out the code | Email text: "<display name> asked to manage <page>. Only type this code in yourself. If that is not you, ignore this email." On success a **second email** to the same contact: "<display name> now manages <page>. Not you? Reply / tell us." Plus `ClaimNotice` (P4) and the audit row. |
| Contact changed by an admin mid-flow | `target_hash` mismatch -> `contact_changed`; new code needed. |
| Race: two users redeem at once | Both lock the organiser row (same order as `claim_organiser_v1`); the second sees an owner -> `organiser_already_claimed`. |

## 3. The RPCs and storage

A database cannot send email, and the browser must never see the code. So sending is split:
a **service-only issue RPC** that returns the plaintext once, called by an **edge function**
that authenticates the user and sends the mail.

### Tables (new, admin repo)

```
organiser_claim_codes(
  id uuid pk, organiser_id uuid fk, user_id uuid fk auth.users,
  channel text check in ('email')            -- 'whatsapp' added in v2 (F1)
  target_hash bytea, code_hash bytea, salt bytea,
  created_at, expires_at, used_at null, superseded_at null, wrong_guesses int default 0)
  -- partial unique: one open row per (organiser_id, user_id) where used_at and superseded_at are null

organiser_claim_code_attempts(
  id uuid pk, user_id uuid, organiser_id uuid, kind text check in ('target','send','redeem'),
  outcome text, attempted_at timestamptz)
  -- copy of organiser_invite_redeem_attempts; pruned >24h, bounded batch per call
```

Both: RLS **on**, **no policies**, and explicit privileges (Supabase auto-grants new public
tables to anon/authenticated/service_role, so the migration must undo that):
`REVOKE ALL ... FROM PUBLIC, anon, authenticated, service_role;` the SECURITY DEFINER owner is the
only reader/writer. A new DB contract check (website `scripts/check-*.mjs`, run in
`db-contract-check.yml`) asserts: RLS on, 0 policies, no table privilege for anon/authenticated/service_role,
and the function grants below.

### Pseudo-signatures

```
-- 1. What the card may offer (signed-in). Additive v2 of the hints, or a single-page read:
organiser_claim_code_target_v1(p_organiser_id uuid) -> jsonb
  { ok: true, channel: 'email', masked_to: 'r***@g***.com' }
  { ok: false, reason: 'no_contact' | 'not_live' | 'organiser_already_claimed' | 'already_member' | 'rate_limited' }
  raises: authentication_required, <dancer gate as claim_organiser_v1>, organiser_not_found
  GRANT EXECUTE TO authenticated; REVOKE FROM PUBLIC, anon, service_role

-- 2. Issue (service-only; the edge function passes the user id it verified from the JWT):
_issue_organiser_claim_code_v1(p_user_id uuid, p_organiser_id uuid) -> jsonb
  { ok: true, code: '01234567', to_address, channel, masked_to, expires_at, organiser_name, requester_name }
  { ok: false, reason: 'no_contact' | 'not_live' | 'organiser_already_claimed' | 'already_member'
                      | 'account_unconfirmed' | 'dancer_profile_incomplete' | 'rate_limited',
    retry_after_s? }
  writes: code row (hash only), send attempt row, audit 'claim_code_sent' {channel, masked_to} (no code, no address)
  GRANT EXECUTE TO service_role; REVOKE FROM PUBLIC, anon, authenticated

-- Edge function organiser-claim-code-send (verify_jwt = true):
  POST { organiser_id } -> calls (2) with the JWT's user id -> sends mail -> returns to the browser
  { ok, reason?, masked_to?, expires_at?, retry_after_s? }   -- NEVER code or to_address
  On mail failure: { ok:false, reason:'send_failed' } and the code row is superseded.

-- 3. Redeem (signed-in):
redeem_organiser_claim_code_v1(p_organiser_id uuid, p_code text) -> jsonb
  { ok: true, status: 'claimed' | 'already_owner', organiser_id, member_role: 'owner', is_primary }
  { ok: false, reason: 'no_code' | 'expired' | 'invalid_code' | 'too_many_attempts' | 'rate_limited'
                     | 'contact_changed' | 'organiser_already_claimed' | 'not_live' }
  raises: authentication_required, <dancer gate>, organiser_id_required, organiser_not_found
  order: auth -> dancer gate -> lock organiser row FOR UPDATE -> idempotent already_owner
         -> not_live -> already_claimed -> per-user advisory lock + caps -> latest open code
         -> expiry -> target_hash still equals current target -> compare -> on wrong: wrong_guesses+1,
            attempt row; at 5 burn -> on right: entity_members owner (primary if none),
            claimed_by, used_at, supersede others, close caller's open access request on this page,
            audit 'claimed' {via:'claim_code', channel}, success email (via edge, outbox row)
  GRANT EXECUTE TO authenticated; REVOKE FROM PUBLIC, anon, service_role
```

Returning `{ok:false, reason}` (not RAISE) for user-facing outcomes matches `redeem_organiser_invite_v1`
and lets the attempt row be written in the same transaction (a RAISE would roll it back). Raises
are kept only for "should never happen from the UI" cases, matching `claim_organiser_v1`.

The success email: redeem inserts an outbox/audit row; the edge function (or the existing digest
sender) delivers it. Exact transport is a build-PR choice once the existing mail senders are read (G4).

## 4. How it fits the existing paths

| Existing path | Interaction |
|---|---|
| P1 instant claim (`email_matches`) | **Unchanged and preferred.** If the account email equals the evidence, the card offers the instant claim; the code path is offered when the hint is `email_differs` (or `email_matches_unproven`, G3) and a target exists. |
| P2 mailbox proof | Unrelated: proves the account's own inbox. The new code UI reuses its look (code box, 6-10 digit tolerance, Enter submits, resend cooldown) but not its API. |
| P3 auto-claim at sign-in | Unchanged. A code claim stashes the same `ClaimNotice` entry (P4) so "Not you? Tell us" stays the undo. |
| P5 hints | Either a v2 of `organiser_claim_hints_v1` adding `code_channel` per row, or the single-page target RPC (1). Recommendation: target RPC, because the mask must not be computed for 50 ids at a time. |
| P7 ask to join | Remains the only path for no-target pages and is offered under the code UI as the fallback. A successful code claim closes the caller's own open request on that page (status `superseded`). |
| P8/P9 invites | Untouched. An invite issued for a page later claimed by code still redeems under `redeem_organiser_invite_v1`'s existing owned-page rules; build PR must test that shape. |
| Dancer gate | `_require_complete_dancer_profile_v1()` runs in **all three** RPCs and before any send, so no contact is mailed on behalf of someone who cannot finish. |

## 5. Test matrix and migration order

### Matrix (table-driven; DB tests in admin repo, card render tests in this repo)

Page shapes (from prod): email target public / email target hidden / claim_email only (0 in prod, still tested) /
phone only / no contact / owned / legacy `claimed_by` no owner row / not live / caller already member.
Caller shapes: signed out / anonymous / unconfirmed / dancer profile incomplete / complete, email matches /
complete, email differs.

| Path | Assert for every page x caller shape |
|---|---|
| target RPC | mask only when live+unowned+email; `no_contact` for phone-only and none; never an address |
| issue | caps (60 s, 3/h, 5/d per user; 3/h, 5/d per page); supersede; hash-only row; audit has no code/address |
| edge send | browser response never contains `code` or `to_address` (assert by key scan); `send_failed` supersedes |
| redeem | right code -> owner; wrong x5 -> burned; expired; other user's code -> `no_code`; contact changed; race of two redeemers; idempotent repeat; 10/user and 20/page caps; open request closed |
| privileges | anon/authenticated/service_role have no table privilege; function grants exactly as above |
| card | each hint x target -> exactly one of: instant claim / code / ask-to-join; no copy naming a control that is absent; no-contact copy never says "code" or "one tap" |

Bug-shaped tests run against the unfixed code first (CLAUDE.md). Real-data check: the 38 live
unclaimed pages map to 2 code-offering + 36 ask-to-join.

### Migration order (admin repo, CLI push only)

1. **M1** tables + RLS + REVOKEs; website contract check lands in the same window (red until M1 is applied, then green).
2. **M2** target, issue, redeem RPCs with explicit GRANT/REVOKE (incl. service_role).
3. **Edge function** `organiser-claim-code-send` deployed; mail template reviewed by owner.
4. **Website PR** behind a flag: card states, G3 hint fix, `ClaimNotice` reuse, matrix tests, 390x844 walk.
5. Flag on after owner phone test.

**Replay proof:** in the admin repo, a fresh local `supabase db reset` replays the full chain
including M1-M2 with no error; then M1-M2 are applied a second time to show they are guarded
(`IF NOT EXISTS` / `CREATE OR REPLACE`) and idempotent; the contract check passes against the replayed DB.
**Independent review:** M1+M2 are a DB-contract PR -> independent review at the highest effort
(per CLAUDE.md), by a session that did not write them, before push.
