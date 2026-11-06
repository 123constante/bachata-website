# Claim a page by one-time code: data design (r2)

Status: DESIGN ONLY. No SQL file, no feature code, no prod write. Pseudo-signatures only.
Reads: [`INVENTORY.md`](INVENTORY.md) (paths P1-P9, gaps G1-G6, prod counts).
Migrations will live in `bachata-admin-11april` (this repo owns none).

r2 (2026-11-02) answers the independent security review
[`docs/review/claim-code-design-r1.md`](../../review/claim-code-design-r1.md) (BLOCK): R1 issue RPC
gated by id and service-only, code generated in the edge function; R2 lockout + harassment closed;
R3 the false "invites untouched" claim replaced by the live behaviour and an owner decision;
R4 `SET search_path` + schema-qualified extensions on every signature; R5 F1 rewritten with the
phone-route abuse list; nits N1-N9 folded in (marked inline).

## 0. The goal in one line

A signed-in dancer on a public organiser page asks for a code; the code goes to the
**page's own contact**; whoever can read that contact types it back; they become owner.
No admin step. Pages with no usable contact stay **ask to join** (or a hand-sent invite link).

### Owner decisions (needed before the build PR; recommendation first, NOT decided here)

| Decision | Options | Recommendation | Why |
|---|---|---|---|
| **F1 Channel** (review R5) | (a) email only; (b) email + WhatsApp/phone; (c) do not build | **(b), or (c) if the owner will not fund/approve a WhatsApp template and the s.2b mitigations.** Ship email and phone in the same release; email alone is not worth a release. | Prod 2026-11-02: 37 unclaimed live pages = **2 email evidence, 32 phone only, 3 none**. Email-only moves **about 0 pages**: both email pages are already claimable by the instant claim (P1) the moment the organiser signs in with that address and proves the mailbox, which is exactly what receiving a code proves. The email code path only adds "account email differs from the page contact, but I read that inbox" (shared `info@`, an assistant's account). The feature's value is the phone route (32 pages), a NEW evidence class (0 phone-confirmed accounts in `auth.users` today) with its own abuse list in s.2b. Email first is still the right *security sequencing* (no new evidence class), but not a product win on its own. |
| **F2 Hidden email** | send to `contact_email` even when `show_email_publicly` is off / do not | **Send.** | Visibility is about visitors, not about who the page belongs to. Only a mask is shown. Accepted cost (review check 1): the mask also reveals that a hidden-email page HAS an email at all. |
| **F3 "14 of 15 founding"** | owner names the set | Owner to name it. | Prod has no "founding" marker; design does not depend on it. |
| **F4 Open invites vs code claim** (review R3) | see s.4a | **(c) no code route on a page with an open invite.** | See s.4a. |
| **F5 Mail/WhatsApp copy** | fixed copy + validated first name / fixed copy, no name | **Fixed copy, no requester name in the code message;** first name (validated) only in the success notice. | R2 scenario B: requester-chosen text must not reach a third party. |

## 1. Which contact, how it is shown, and the no-contact page

**"Unowned"** (N3), exactly as `claim_organiser_v1`: no `entity_members` owner row AND
(`claimed_by` IS NULL OR `claimed_by` = caller). Legacy `claimed_by = caller` with no owner row
(0 in prod) is claimable by that caller only.

**Target**, decided in the database, never by the client:
- email: `lower(btrim(COALESCE(organiser_claim_emails.claim_email, organiser_profiles.contact_email)))`,
  exactly as `claim_organiser_v1`;
- phone (only if F1 = b, and only when there is no email target): `contact_phone` normalised to
  **E.164** by one named SQL helper `_phone_e164_v1(text, default_region 'GB') -> text|null`
  (review R5.3). `target_hash` is computed on the normalised value, so a formatting-only admin edit
  ("+44 7..." -> "07...") does not invalidate open codes and two spellings are one target. A phone
  that does not normalise counts as no target.

**Never leaked.** The address/number leaves the database only to the edge function (service side).
The browser gets a **mask only**, computed in SQL by a NEW helper `_claim_target_mask_v1` (N5):
email `r***@g***.com` (first char of local part, `***`, `@`, first char of domain, `***`, last
label); phone `+44 ••• ••• 89` (country code + last 2 digits). It is deliberately stricter than the
live `_email_hint_v1` (`r...@gmail.com`, full domain), which the invite preview and
`redeem_organiser_invite_v1` (`invite_email_hint`) keep using; the build must not reuse
`_email_hint_v1` here. For a 1-character local part the mask is `*@g***.com`: the domain part is
unchanged (N9). The mask is returned only to a signed-in, non-anonymous caller, only for a live,
unowned page, only after the dancer gate passes.

**Public page copy** (in the build PR; HTML entities, never raw punctuation):
- Has target: "Is this your page? We can send a code to r***@g***.com." + `[Send code]`, then a
  code box; below, a quiet "Can&rsquo;t get to that inbox? Ask to join instead."
- No target, page blocked (kill switch), or open invite (F4c): **no code UI at all**, only "Ask to
  join" with "We&rsquo;ll check with you before giving access." No mention of codes, no "one tap".
  Batch-1 outreach text must not promise one-tap claim.
- Signed out: unchanged (`kind: 'sign_in'`); the mask is never shown to anon.

## 2. The code

| Property | Value | Note |
|---|---|---|
| Format | 8 digits, leading zeros kept, generated **in the edge function** with `crypto.getRandomValues` (rejection-sampled, no modulo bias) | See s.3 R1 choice. |
| Expiry | 15 min email; **10 min phone** (R5.1) | |
| Single use | `used_at` set on success; every other open code for that page is `superseded_at` | |
| One live code per (page, user) | a new request supersedes the caller's previous code for that page | |
| Bound to | `(organiser_id, user_id)` AND `target_hash` of the normalised target | Useless in another account; if the contact changes, redeem says `contact_changed` (N7 binding). |
| Storage | `code_hash = extensions.digest(salt || convert_to(code,'UTF8'), 'sha256')`, per-row 16-byte `salt`; both computed by the edge function, plaintext never reaches the DB | Compare hash-to-hash in SQL. |
| Wrong guesses per code | 5, then burned (`too_many_attempts`), audit `claim_code_burned` | 5 / 10^8 per code. |
| Failed redeems per user | **10 per rolling hour** across all pages, rows pruned at 24 h (N1: the live `redeem_organiser_invite_v1` window, copied exactly) | |
| Failed redeems per page | 20 per 24 h across all users | Stops many accounts grinding one page. |
| Sends per user | 1 per 60 s, 3 per hour, 5 per 24 h | |
| Sends per **(page, user)** (R2) | **1 per hour, 2 per 24 h** | No single account can spend a page's quota. |
| Sends per page | 5 per 24 h counted only from **distinct requesters**, i.e. at most 2 of the 5 from any one user (R2); 3 per hour | Contact receives at most 5 messages/day from this feature. |
| Escalating cool-down (R2) | a user whose **3 most recent codes (any page)** expired or were superseded unused is blocked from requesting on ANY page for **7 days** (`rate_limited`, `retry_after_s`), audit `claim_code_blocked {scope:'user'}` | Uses the existing `send` attempt rows + code rows. A `send_failed` code is not "unused" for this count. |
| `send_failed` (R5.4) | a send the provider rejected synchronously is recorded with outcome `send_failed`, the code row is superseded, and it **does not count** against the page cap or the cool-down; it does count against the per-user 60 s / hour caps (stops a retry loop) | A broken number cannot lock the page out. "Sent, not delivered" (async) is a separate outcome `sent` and counts normally. |
| Global ceiling (R5.2) | edge function refuses with `rate_limited` above **N sends / 24 h platform-wide** (N set by owner; proposal 200) | Bill protection; per-page caps alone grow with pages. |
| Admin kill switch (R2, R5.7) | `organiser_profiles.claim_code_blocked_at timestamptz` (admin-only write via an existing admin RPC pattern) | Target RPC returns `no_contact` to the caller (no new tell); issue refuses; audit `claim_code_blocked {scope:'page'}`. Also the answer to SIM-swap / number recycling. |
| Who can request | authenticated, non-anonymous, confirmed account (`_member_target_account_p5(p_user_id, NULL)` problem = none), complete dancer profile, not already a member, page live, unowned, not blocked, no open invite (F4c), no contact change in the last 24 h (N7) | |

### 2a. Message content (R2 scenario B, F5)

**No requester-controlled text in a code message.** Fixed platform copy only:
"Someone asked to manage **<page name>** on Bachata Calendar. Your code is 01234567. Only type it
into the page yourself; never share it, not even with us. If you did not ask, ignore this; nothing
changes." Footer: "**Don&rsquo;t want these? Tell us and we stop codes for this page**" (mail: a
link to a contact form / reply address handled by an admin, who sets the kill switch; WhatsApp: the
same as text). Page name comes from the DB (admin-edited), not from the requester.

Success notice to the same contact: "**<first name>** now manages <page name>. Not you? Tell us."
The first name is shown only if it passes `_self_serve_text_problem_p5`-style validation (no URL,
no `@`, no digits run, <= 40 chars); otherwise "Someone". Plus `ClaimNotice` (P4) and the audit row.

### 2b. Abuse cases (email and phone)

| Case | Defence |
|---|---|
| Enumerate pages to harvest masks | Mask only for live+unowned pages, signed-in + dancer gate; cap lowered to **10 distinct pages per user per 24 h** (N6). Honest: this is rate-limiting, not a secret; `organiser_ownership_v1` (anon) already says which pages are unowned, and the mask is low value. |
| One account locks a page out (R2 A) | (page,user) cap 1/h, 2/d; page cap counts distinct requesters; 7-day cool-down after 3 unredeemed codes. |
| Daily harassment / phishing via the page contact (R2 B) | Fixed copy, no requester text (2a); footer opt-out -> admin kill switch; cool-down burns hostile accounts. |
| Brute-force the code | 10^8 space, 5 guesses per code, 10 per user per hour, 20 per page per day. |
| Replay | `used_at` + supersede; bound to requester and target hash. |
| Social-engineer the code out of the organiser (email) | Copy in 2a; success notice; audit. |
| **Phone R5.1 OTP-relay in chat** (attacker messages the public number "forward the 8 digits") | Template names the page AND says "never share, not even with us"; 10-min expiry; success notice on the same channel. |
| **Phone R5.2 cost / SMS pumping** | Per-page + per-(page,user) caps, cool-down, global daily ceiling in the edge function; only numbers that normalise to E.164 in allowed country codes (owner list; proposal: UK + EU). |
| **Phone R5.3 normalisation** | `_phone_e164_v1` used for both target and `target_hash`; matrix row for a formatting-only edit. |
| **Phone R5.4 lossy delivery** | `send_failed` (sync reject) does not count against page cap or cool-down and is distinct from `sent`. |
| **Phone R5.5 shared venue line** | 0 shared numbers in prod today. Phone route offered only when the number is not also the `contact_phone` of any venue or another organiser (target RPC checks; else `no_contact`). Copy never promises one tap. Success notice + audit as the backstop. |
| **Phone R5.6 inbound replies** | v1 has no inbound handler: the WhatsApp/SMS copy must NOT say "reply"; it gives the web "Tell us" link instead. Inbound handling is a v2 item. |
| **Phone R5.7 SIM-swap / number recycling** | Admin kill switch per page; success notice; audit `claimed {via:'claim_code', channel:'phone'}` for admin review; ClaimNotice undo. Lower bar than inbox takeover: stated, accepted only if F1 = b. |
| Manager edits the contact, a friend requests (N7) | Requests refused for 24 h after a `profile_edited` audit that changed `contact_email`/`contact_phone`; code bound to `target_hash`. Today moot (only manager on unowned pages is an admin). |
| Contact changed mid-flow | `target_hash` mismatch -> `contact_changed`. |
| Race: two redeemers | Both lock the organiser row (same order as `claim_organiser_v1`); the second sees an owner -> `organiser_already_claimed`. |

## 3. The RPCs and storage

A database cannot send mail or WhatsApp, and the browser must never see the code. So sending is
split: a **service-only issue RPC** called by an **edge function** that authenticates the user,
generates the code, and sends it.

**R1 choice: the edge function generates the code; only `code_hash` + `salt` reach the DB.**
Reason: the issue RPC then never returns a plaintext code, so even a mis-granted EXECUTE, a
DEFINER-owner read of the table, or a log of the RPC response cannot reveal a code. The cost (the
edge function must hash exactly like SQL compares) is pinned by one fixture test (known salt + code
-> known hash) run on both sides. The RPC still returns the target address, so it stays
service-only.

### Tables (new, admin repo)

```
organiser_claim_codes(
  id uuid pk, organiser_id uuid fk, user_id uuid fk auth.users,
  channel text check in ('email','phone'),          -- 'phone' rows only if F1 = b
  target_hash bytea, code_hash bytea, salt bytea,
  created_at, expires_at, used_at null, superseded_at null, wrong_guesses int default 0,
  send_outcome text check in ('pending','sent','send_failed') default 'pending')
  -- partial unique: one open row per (organiser_id, user_id) where used_at and superseded_at are null

organiser_claim_code_attempts(
  id uuid pk, user_id uuid, organiser_id uuid, kind text check in ('target','send','redeem'),
  outcome text, attempted_at timestamptz)
  -- copy of organiser_invite_redeem_attempts

organiser_profiles.claim_code_blocked_at timestamptz null   -- kill switch (R2)
```

Both tables: RLS **on**, **no policies**, explicit `REVOKE ALL ... FROM PUBLIC, anon, authenticated,
service_role`. Prod's `pg_default_acl` (owner `postgres`, schema `public`) still auto-grants new
tables `arwdDxtm` and new functions EXECUTE to anon/authenticated/service_role (review R4), so every
REVOKE below is load-bearing, not ceremony.

**Pruning and admin reads (N4).** Rows older than 24 h (attempts) and 7 days (codes, needed by
the cool-down) are pruned in bounded batches (100/call) inside the issue and redeem RPCs, the way
`redeem_organiser_invite_v1` prunes. Admin tooling reads them only through a DEFINER
`admin_claim_code_activity_v1(p_organiser_id)` gated by `is_admin()` (counts and outcomes, no
hashes).

**Contract check (N5 of review check 5):** a NEW `scripts/check-claim-code-contract.mjs` in this
repo, following the six `check-script-conventions.mjs` rules, run from `db-contract-check.yml`,
asserting: RLS on, 0 policies, no table privilege for anon/authenticated/service_role, every
function's `proconfig` contains the `search_path`, and the function grants below.

### Pseudo-signatures (R4: every one is SECURITY DEFINER with a pinned search_path)

```
-- 1. What the card may offer (signed-in, single page):
organiser_claim_code_target_v1(p_organiser_id uuid) -> jsonb
  SECURITY DEFINER SET search_path = public, extensions, pg_catalog
  { ok: true, channel: 'email'|'phone', masked_to }
  { ok: false, reason: 'no_contact' | 'not_live' | 'organiser_already_claimed' | 'already_member'
                     | 'invite_open' | 'rate_limited' }      -- blocked page -> 'no_contact'
  raises: authentication_required, <dancer gate as claim_organiser_v1>, organiser_not_found
  GRANT EXECUTE TO authenticated; REVOKE EXECUTE FROM PUBLIC, anon, service_role

-- 2. Issue (SERVICE ONLY; gated by id, never by session -- R1):
_issue_organiser_claim_code_v1(p_user_id uuid, p_organiser_id uuid,
                               p_code_hash bytea, p_salt bytea) -> jsonb
  SECURITY DEFINER SET search_path = public, extensions, auth, pg_catalog   -- auth: reads auth.users
  gates, all BY ID (auth.uid() is NULL under service_role):
    p_user_id NOT NULL else raise user_id_required;
    _member_target_account_p5(p_user_id, NULL)                   -> account_unconfirmed (incl. anonymous)
    by-id dancer gate: _require_complete_dancer_profile_v1(p_user_id uuid DEFAULT NULL)
      extended to prefer the argument (or profile_complete_v1(_my_dancer_profile_id_for_v1(p_user_id)));
      session callers pass nothing and keep today's behaviour     -> dancer_profile_incomplete
    then: live, unowned, not member, not blocked, no open invite, no contact change in 24 h, caps
  { ok: true, to_address, channel, masked_to, expires_at, organiser_name, code_id }  -- NO code
  { ok: false, reason: 'no_contact' | 'not_live' | 'organiser_already_claimed' | 'already_member'
                      | 'invite_open' | 'account_unconfirmed' | 'dancer_profile_incomplete'
                      | 'rate_limited', retry_after_s? }
  writes: code row (hash + salt), send attempt row, audit 'claim_code_sent' {channel, masked_to}
  GRANT EXECUTE TO service_role; REVOKE EXECUTE FROM PUBLIC, anon, authenticated

-- 2b. Send outcome (service only): _set_claim_code_send_outcome_v1(p_code_id uuid, p_outcome text)
  same SECURITY DEFINER + search_path; 'send_failed' supersedes the row and removes it from the
  page cap / cool-down counts. GRANT service_role; REVOKE FROM PUBLIC, anon, authenticated

-- Edge function organiser-claim-code-send (verify_jwt = true):
  reads sub from the verified JWT; refuses an anonymous-provider JWT (is_anonymous) -> account_unconfirmed;
  generates code + salt, hashes, calls (2) WITH THE SERVICE KEY (never the user's JWT),
  sends via provider, calls (2b), returns to the browser
  { ok, reason?, masked_to?, expires_at?, retry_after_s? }   -- NEVER code or to_address
  enforces the global daily ceiling.

-- 3. Redeem (signed-in):
redeem_organiser_claim_code_v1(p_organiser_id uuid, p_code text) -> jsonb
  SECURITY DEFINER SET search_path = public, extensions, pg_catalog
  hash: extensions.digest(salt || convert_to(p_code,'UTF8'), 'sha256')
  { ok: true, status: 'claimed' | 'already_owner', organiser_id, member_role: 'owner', is_primary }
  { ok: false, reason: 'no_code' | 'expired' | 'invalid_code' | 'too_many_attempts' | 'rate_limited'
                     | 'contact_changed' | 'organiser_already_claimed' | 'not_live' }
  raises: authentication_required, <dancer gate>, organiser_id_required, organiser_not_found
  order: auth -> dancer gate -> lock organiser row FOR UPDATE -> idempotent already_owner
         -> not_live -> already_claimed (N3 rule) -> per-user advisory lock + caps -> latest open code
         -> expiry -> target_hash still equals current target -> compare -> on wrong: wrong_guesses+1,
            attempt row; at 5 burn + audit 'claim_code_burned' -> on right:
            _organiser_member_set_p5(org, user, 'owner', 'claim_code', NULL, false)   (N2: one rule for
            the 20-seat cap, claimed_by follow, member_set audit -- not a direct INSERT),
            used_at, supersede others, close caller's open access request on this page (status
            'superseded'), audit 'claimed' {via:'claim_code', channel}, success-notice outbox row
  GRANT EXECUTE TO authenticated; REVOKE EXECUTE FROM PUBLIC, anon, service_role
```

Any helper that generates randomness in SQL (none planned after the R1 choice) must call
`extensions.gen_random_bytes(...)`, never the bare name.

Returning `{ok:false, reason}` (not RAISE) for user-facing outcomes matches `redeem_organiser_invite_v1`
and lets the attempt row be written in the same transaction. Raises are kept only for "should never
happen from the UI" cases, matching `claim_organiser_v1`.

**`superseded` access-request status:** the website parser (`selfServeApi.ts:62` accepts
`'open' | 'granted' | 'declined' | string`) will not crash; the build PR adds it to the type and
to `_organiser_access_requests_p5()`, with a round-trip test.

The success notice: redeem inserts an outbox/audit row; the edge function (or the existing digest
sender) delivers it. Exact transport is a build-PR choice once the existing senders are read (G4).

## 4. How it fits the existing paths

| Existing path | Interaction |
|---|---|
| P1 instant claim (`email_matches`) | **Unchanged and preferred.** The code path is offered when the hint is `email_differs` (or `email_matches_unproven`, G3) or the target is a phone. |
| P2 mailbox proof | Unrelated (proves the account's own inbox). The code UI reuses its look, not its API. |
| P3 auto-claim at sign-in | Unchanged. A code claim stashes the same `ClaimNotice` entry (P4). |
| P5 hints | Single-page target RPC (1), not a v2 of the 50-id hints: the mask must not be computed in bulk. |
| P7 ask to join | Only path for no-target, blocked and open-invite pages; fallback under the code UI. A code claim closes the caller's own open request (`superseded`). |
| P8/P9 invites | **Not untouched. See s.4a (owner decision F4).** |
| Dancer gate | Session gate in (1) and (3); **by-id** gate in (2) (R1). No contact is messaged for someone who cannot finish. |

### 4a. Invites after / before a code claim (review R3, owner decision F4)

What the live `redeem_organiser_invite_v1` does (read 2026-11-02): its only membership checks are
"caller already a member" (`already_member`) and the 20-seat cap; it then seats the redeemer as
**`owner`** via `_organiser_member_set_p5(org, user, 'owner', 'invite', ...)`. There is **no**
owned-page rule. And `claim_my_organisers_v1`, at the invitee's next sign-in, skips owned pages for
claim emails but its second loop JOINS bound invites on owned pages (`_join_bound_invite_v1`), so
the invitee is seated anyway. 4 open invites sit on unowned live pages today.

So, live behaviour if nothing changes:
- code claim by X, then the admin-invited Y redeems -> **Y is a second owner** X did not add, and X
  cannot revoke the invite (not in the team UI);
- the reverse is also true: if X is an attacker (e.g. read a shared `info@`), Y's invite is the real
  organiser's recovery path.

Options (owner decides; F4):
- (a) Accept: an admin invite is a deliberate grant; Y becomes co-owner. Document it in the success
  notice to X ("an invite is also open for this page").
- (b) Invite redeemed on an owned page seats Y as `manager`, not owner (changes a live RPC).
- (c) **No code route while the page has an open invite** (target RPC -> `invite_open`, card shows
  ask-to-join). The admin already picked a person for that page.
- (d) Code claim revokes open invites on the page (audit) and flags the page for admin review.

**Recommendation: (c).** It touches no live RPC, affects only the 4 pages an admin is already
handling, and removes both scenarios instead of choosing a winner. If the owner picks (a), the two
matrix rows below assert the co-owner outcome; if (b) or (d), a change to
`redeem_organiser_invite_v1` / `claim_my_organisers_v1` joins M2 and the review scope.

## 5. Test matrix and migration order

### Matrix (table-driven; DB tests in admin repo, card render tests in this repo)

Page shapes (from prod): email target public / email hidden / claim_email only (0 in prod, still
tested) / phone only (normalises) / phone that does not normalise / phone shared with a venue /
no contact / blocked (kill switch) / open invite / owned / legacy `claimed_by` = caller no owner
row / legacy `claimed_by` = other / not live / **caller already member (the COMMON shape: 36 of
37 unowned pages carry one admin `manager` row)**.
Caller shapes: signed out / anonymous / unconfirmed / dancer profile incomplete / complete, email
matches / complete, email differs / **admin** (gate passes quietly for `is_admin()`; an admin can
code-claim like anyone, stated not hidden).

| Path | Assert for every page x caller shape |
|---|---|
| target RPC | mask only when live+unowned+target and not blocked/invite_open; `no_contact` otherwise; never an address; 10 distinct pages/day cap |
| issue | **called by an `authenticated` session via PostgREST -> permission denied** (R1); called with service key for a user with no dancer profile -> `dancer_profile_incomplete`; caps (60 s, 3/h, 5/d per user; 1/h, 2/d per (page,user); 5/d distinct-requester per page); **one account cannot exhaust a page** (R2 lockout row); 3 unredeemed -> 7-day block; kill switch -> `no_contact`; hash-only row; response has no `code` key |
| edge send | **anonymous-provider JWT -> `account_unconfirmed`**; browser response never contains `code` or `to_address` (key scan); `send_failed` supersedes and **does not count** against page cap or cool-down; global ceiling; hash fixture equals SQL |
| phone | formatting-only edit of the number keeps open codes valid; different number -> `contact_changed`; 10-min expiry; copy has no "reply" |
| redeem | right code -> owner via `_organiser_member_set_p5`; wrong x5 -> burned + audit; expired; other user's code -> `no_code`; contact changed; race of two redeemers; idempotent repeat; 10/user/hour and 20/page/day; open request closed with `superseded` and the website parses it |
| invites (R3) | **code claim, then open invite redeemed** -> per F4 (live: second owner); **open invite, then code claim by another user, then `claim_my_organisers_v1` at the invitee's sign-in** -> per F4 (live: invitee seated via `_join_bound_invite_v1`); with F4c both are unreachable (`invite_open`) |
| privileges | anon/authenticated/service_role have no table privilege; every function grant exactly as above; every function has the pinned `search_path` |
| card | each hint x target -> exactly one of instant claim / code / ask-to-join; no copy names an absent control; no-contact copy never says "code" or "one tap"; code message contains no requester text |

Bug-shaped tests run against the unfixed code first (CLAUDE.md). Real-data check (2026-11-02):
the 37 live unclaimed pages map to 2 email code-offering + (F1=b) up to 32 phone + 3 ask-to-join,
minus any page with an open invite under F4c.

### Migration order (admin repo, CLI push only)

1. **M1** tables + `claim_code_blocked_at` + RLS + REVOKEs; `scripts/check-claim-code-contract.mjs`
   lands in the website in the same window (red until M1 is applied, then green).
2. **M2** helpers (`_phone_e164_v1`, `_claim_target_mask_v1`, by-id dancer gate), target, issue,
   send-outcome, redeem, admin-activity RPCs with explicit GRANT/REVOKE and pinned `search_path`.
3. **Edge function** `organiser-claim-code-send` deployed; copy (2a) reviewed by owner; WhatsApp
   template approved if F1 = b.
4. **Website PR** behind a flag: card states, G3 hint fix, `ClaimNotice` reuse, `superseded`
   status, matrix tests, 390x844 walk.
5. Flag on after owner phone test.

**Replay proof:** in the admin repo, a fresh local `supabase db reset` replays the full chain
including M1-M2 with no error; M1-M2 applied a second time are guarded (`IF NOT EXISTS` /
`CREATE OR REPLACE`) and idempotent; the contract check passes against the replayed DB.
**Independent review:** M1+M2 are a DB-contract PR -> independent review at the highest effort
(per CLAUDE.md), by a session that did not write them, before push.
