# Review r1: claim a page by one-time code, data design (docs/design/claim-code)

Target: `docs/design/claim-code/INVENTORY.md` and `PLAN.md` as merged to `main` at `ff20808`
(PR #1258; the design branch `claude/claim-code-design-r1` head `53257cb` is the same text).
Reviewer: zero prior context, a different session from the builder. Review only; no product code,
no SQL, no prod write. Brief: `docs/briefs/review-claim-code-design-r1.md` on
`brief/review-claim-code-design-r1`. Reviewed as a SECURITY design, because the PLAN becomes a
migration in `bachata-admin-11april`.

Evidence: live RPC bodies read from prod `stsdtacfauprzrdebmzg` on 2026-11-02 with
`pg_get_functiondef` (SELECT only): `claim_organiser_v1`, `redeem_organiser_invite_v1`,
`claim_my_organisers_v1`, `organiser_claim_hints_v1`, `organiser_ownership_v1`,
`request_organiser_access_v1`, `request_new_invite_v1`, `organiser_invite_preview_v1`,
`_caller_proven_email_p5`, `_mailbox_proven_p5`, `_member_target_account_p5`,
`_require_complete_dancer_profile_v1`, `_email_hint_v1`, `_organiser_member_set_p5`; plus
`pg_default_acl`, table ACLs and RLS state, function ACLs, and counts (never personal data).

## Verdict: BLOCK (the PLAN as a migration spec), cheap to lift

The shape of the design is right: the target address is decided in SQL by the same rule as
`claim_organiser_v1`, the browser never sees the code or the address, the code is hashed with a
per-row salt, both tables are RLS-on / no-policy / explicit REVOKE, and the redeem order copies the
live locking order. Nothing here is a bypass of the existing ownership routes.

Two findings must be fixed IN THE PLAN before anyone authors M1/M2 from it, because a migration
written from the text as it stands is either wrong (R1: the service-only issue RPC's gate cannot
run) or ships an abuse channel the brief explicitly asked about (R2: a one-account lockout plus an
unstoppable daily mail to a real person carrying requester-chosen text). Both are a paragraph each
to fix. R3 and R4 are should-fix in the same edit. The rest are nits. Ranked: R1, R2, R3, R4, R5,
then nits N1-N9.

| # | Severity | Finding | Where |
|---|---|---|---|
| R1 | must-fix | `_issue_organiser_claim_code_v1` runs as `service_role`, so `auth.uid()` is NULL, and every gate the PLAN says it runs (`_require_complete_dancer_profile_v1`, which also calls `_my_dancer_profile_id_v1`) raises `authentication_required` for every caller. The PLAN's "dancer gate runs in all three RPCs" is not implementable as written. | PLAN s.3 pseudo-signature 2, s.4 "Dancer gate" |
| R2 | must-fix | Per-page send cap (5/day, all users) + per-user cap (5/day) means ONE account can exhaust a page's quota every day, forever: the real organiser gets `rate_limited` each time they try, and the organiser's inbox gets 5 mails a day they cannot stop, each carrying the requester's display name verbatim. | PLAN s.2 caps, "Spam a contact", s.3 issue RPC |
| R3 | should-fix | "P8/P9 invites: untouched ... still redeems under `redeem_organiser_invite_v1`'s existing owned-page rules." The live body has NO owned-page rule: it seats the redeemer as `owner` via `_organiser_member_set_p5` whenever the invite is open and the caller is not already a member. After a code claim, every open invite on that page is a second ownership route. 4 open invites sit on unowned live pages today. | PLAN s.4 P8/P9 row; s.5 matrix |
| R4 | should-fix | No `SET search_path` and no schema-qualification in the pseudo-signatures, although the brief asked for it and every live DEFINER function pins `search_path` (`public, auth|extensions, pg_catalog`). `gen_random_bytes` and `digest` live in `extensions` on this project. | PLAN s.3 |
| R5 | should-fix (owner decision) | F1 as written ("email in v1") moves about 0 pages, not "~5%": both email-evidence pages are ALREADY claimable by the instant claim the moment the organiser signs in with that address. The code path only adds the case "account email differs from the page contact but the person reads that inbox". The feature's whole value is the phone route, which is a new evidence class with its own abuse list (below). | PLAN s.0 F1 |

## Findings in detail, each with the attack or failing scenario

### R1. The service-only issue RPC cannot run the dancer gate (fails closed for everyone)

Scenario: edge function `organiser-claim-code-send` verifies the JWT, calls
`_issue_organiser_claim_code_v1(p_user_id, p_organiser_id)` with the service key. Inside,
`auth.uid()` is NULL. `_require_complete_dancer_profile_v1()` (live body) starts with
`IF auth.uid() IS NULL THEN RAISE 'authentication_required'`. Every request fails. If the builder
"fixes" that by dropping the gate from the issue RPC, a person with no dancer profile can have a
code mailed to a third party, which s.4 promises never happens. If the builder instead calls the RPC
as the USER (forwarding the JWT), the RPC must be EXECUTE-able by `authenticated`, and it returns
the plaintext code: any signed-in caller can then mint and read their own code with PostgREST and
skip the mail entirely. That is a full bypass.

Fix (PLAN text): the issue RPC takes `p_user_id` and gates by id, not by session:
`_member_target_account_p5(p_user_id, NULL)` (already by-id) and a by-id variant of the profile
gate (`profile_complete_v1(_my_dancer_profile_id_for_v1(p_user_id))`, or extend
`_require_complete_dancer_profile_v1(p_user_id uuid DEFAULT NULL)` to prefer the argument). State
that the edge function MUST call with the service key, that the RPC MUST have
`REVOKE EXECUTE FROM PUBLIC, anon, authenticated` (the default ACL below would otherwise grant it),
and add a matrix row: "issue RPC called by an `authenticated` session via PostgREST -> permission
denied". Alternative that removes the plaintext from the DB entirely: the edge function generates
the code, sends `p_code_hash`+`p_salt` to the RPC, and the RPC stores only those; then even a
DEFINER-owner read of the table never sees a code.

### R2. One account locks a page out of codes forever, and the contact gets daily mail with attacker text

Scenario A (lockout): attacker account A (dancer profile complete, 1 minute of setup) sends 5 codes
to page P at 00:01 each day (within A's own 5/day). P's per-page cap (5/day) is now spent. The real
organiser presses "Send code" at any time that day: `rate_limited`. Repeat daily. Cost to attacker:
one account, 5 taps a day. The real organiser can never claim by code, and the fallback "ask to
join" on an unowned page is answered only by an admin (INVENTORY G5), so the owner's goal
("no admin step") is defeated for that page by one hostile account.

Scenario B (harassment / phishing channel): the same 5 mails a day land in a real person's inbox
(the page contact, often a hidden address per F2). The PLAN's mail body is "<display name> asked to
manage <page> ...". The display name is requester-chosen text. Display name
"URGENT: verify at https://evil.example or your page is deleted" reaches the organiser 5 times a
day from the platform's own sender, and the organiser has no way to stop it: no opt-out, no "block
codes for this page" switch, and nothing in the design burns an account whose codes are never
redeemed.

Fix (PLAN text, any two of these close A; the last two close B):
- Count the per-page cap per DISTINCT requester, and cap each (page, user) pair at 1 send per hour
  and 2 per day; a page's total stays 5/day but no single account can spend it.
- Escalating cool-down on unredeemed codes: a user whose 3 most recent codes (any page) expired or
  were superseded unused is blocked from requesting on ANY page for 7 days (`rate_limited`,
  `retry_after_s`). Attempt rows of kind `send` already hold what is needed.
- Admin kill switch: a row in `organiser_claim_emails`-style private table or a column
  `organiser_profiles.claim_code_blocked_at` that the target RPC reads (`no_contact` to the
  caller, audit `claim_code_blocked`). Mention it in the mail footer ("Tell us and we stop these").
- Never put requester-controlled text in the mail. Use the platform's fixed copy and the
  requester's FIRST NAME only after `_self_serve_text_problem_p5`-style validation (no URLs, no
  `@`, max 40 chars), or omit it and show the name only on the success mail after the fact.

### R3. The invite route is not "untouched"; it is a second owner after a code claim

Live `redeem_organiser_invite_v1`: the only membership checks are "caller already a member" (no-op
`already_member`) and the 20-seat cap; it then calls `_organiser_member_set_p5(org, user, 'owner',
'invite', ...)`. There is no `organiser_already_claimed` branch (compare `claim_organiser_v1`,
which has one). Scenario: admin issued an invite to the person they believe is the organiser
(4 such open invites exist on unowned live pages today); a different person claims the page by code
(say, whoever reads the shared `info@` inbox); the invited person redeems later and is seated as a
second owner. Whether that is intended (an admin-issued invite is a deliberate grant) or a bug
(the code claimant now has an owner they did not add) is the owner's call, but the PLAN must not
claim a rule that does not exist. Also the reverse: an attacker who is the code claimant cannot
revoke that invite (not in the team UI), so the real organiser's recovery path survives. State both,
and add two matrix rows: "code claim, then open invite redeemed" and "open invite, then code claim
by another user; `claim_my_organisers_v1` at the invitee's next sign-in" (live: it skips owned
pages for claim emails, but the second loop JOINS bound invites on owned pages via
`_join_bound_invite_v1`, so the invitee is seated anyway).

### R4. search_path and schema qualification are missing from the signatures

Every live DEFINER function pins `SET search_path TO 'public', ('auth'|'extensions'), 'pg_catalog'`
and calls `extensions.digest(...)`. The PLAN names `gen_random_bytes` and `sha256` bare. A function
created without the pin, EXECUTE-able by `authenticated`, resolves unqualified names through the
caller's `search_path`; the project's own anon-grants guard exists because this class of hole was
found before (2026-07-08 audit in `scripts/check-anon-grants.mjs`). Fix: add to each signature
`SECURITY DEFINER SET search_path = public, extensions, auth, pg_catalog` (auth only where
`auth.users` is read) and write `extensions.gen_random_bytes(4)` / `extensions.digest(...)`.

Also the default ACL in prod today (read from `pg_default_acl`): for owner `postgres` in `public`,
new TABLES get `arwdDxtm` for `anon`, `authenticated` AND `service_role`, and new FUNCTIONS get
`EXECUTE` for all three. So the PLAN's "Supabase auto-grants new public tables ... the migration
must undo that" is correct and still live; the brief's "no auto-grants since 2026-10-30" is a repo
convention (explicit GRANT/REVOKE in every migration), not a DB fact. Keep both the table REVOKEs and
an explicit `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` on the `_issue_...` function and
`FROM PUBLIC, anon, service_role` on the two `authenticated` ones, exactly as the PLAN lists.

### R5. F1 (channel) and the phone route

Numbers, re-counted today (same definition as INVENTORY s.4: live, `claimed_by` NULL, no owner row):

| Kind | 2026-11-01 (INVENTORY) | 2026-11-02 (this review) |
|---|---|---|
| Email evidence (claim_email or contact_email) | 2 (claim_email 0, email public 1) | 2 (claim_email 0, email public 1) |
| Phone only | 32 | 32 |
| None | 4 | 3 |
| Total unclaimed live | 38 | 37 |

The INVENTORY numbers were right when written; one no-contact page left the set since (the audit
shows 2 `invite_redeemed` and 2 `set_lifecycle` on organisers in the last 48 h). Not a defect.
Extra shapes worth knowing for the build: phone present on 34, and ALL 34 are public
(`show_phone_publicly`); 34 distinct phones (no shared promoter line in prod today); every phone and
email passes a plain format check; 36 of the 37 unowned pages carry ONE `manager` row, and it is
one admin user (so the "member already" refusal is hit by that admin on 36 pages; fine, but the
matrix's "caller already member" shape is the COMMON shape, not an edge); `auth.users` has 0
phone-confirmed and 0 anonymous accounts, so a phone code would be the first phone-based evidence
in the system.

Is F1 sound? As security sequencing (email first, since it adds no new evidence class), yes. As a
product recommendation the PLAN overstates it: the 2 email pages are already claimable by the
instant claim (P1) the moment the organiser signs in with that very address and proves the mailbox,
which is exactly what receiving the code proves. The email code path helps only "account email
differs from page contact, but I read that inbox" (shared `info@`, assistant's account). For the
owner's stated goal, v1-email is near zero backlog movement; the decision is really "WhatsApp code
or nothing". Say so in F1.

What a phone/WhatsApp route adds (new abuse, each a scenario):
1. OTP-relay social engineering is far easier in a chat: attacker requests the code, then messages
   the public number on WhatsApp "we are verifying your listing, forward the 8 digits". The mail
   wording defence in s.2 is weaker on WhatsApp because the attacker's message arrives in the same
   app seconds later. Mitigation: the template must say the page name AND "never share this code,
   not even with us"; add a 10-minute expiry (not 15); and send the success notice too.
2. Cost and pumping: every send is billed. Per-page caps bound it (37 pages x 5 = 185 messages a
   day worst case today), but as pages grow the per-user cap is the only brake and accounts are
   cheap. Keep the per-page cap and add the R2 escalating cool-down; bill protection also wants a
   global daily ceiling in the edge function.
3. Number normalisation: `target_hash` must be computed on E.164, or an admin edit that changes
   only formatting ("+44 7..." to "07...") makes every open code `contact_changed`, and two
   spellings of the same number are two targets. Prod phones all match a plain pattern today;
   the PLAN must name the normaliser.
4. Delivery is asynchronous and lossy (template rejected, number not on WhatsApp, 24-hour
   session rules). `send_failed` must be distinguishable from "sent, not delivered", and a failed
   send must NOT count against the page cap, or a broken number locks the page out (R2 again).
5. Shared venue lines: 0 shared numbers today, but a venue's phone on an organiser page means
   venue staff can claim the organiser's page. The mask leaks nothing for a public phone, so the
   only defence is the success notice and the audit row. Add "phone is a venue line" to the matrix
   as a shape the copy must not promise one-tap for.
6. Inbound replies ("Not you? Reply") need a receiving number and a handler; a WhatsApp Business
   sender without inbound handling leaves the organiser's "that was not me" unread.
7. SIM-swap / number recycling: a page's phone that was reassigned to a stranger gives that stranger
   the page. Lower bar than an inbox takeover. The admin kill switch (R2) is the answer.

## Checks the brief asked for, item by item

1. Abuse cases. Enumeration: the target RPC is `authenticated` + dancer gate; a mask-read cap of 30
   distinct pages per user per day against 37 unclaimed pages means one account harvests ~80% of all
   masks per day and two accounts all of them (N6). The mask itself is low value (`r***@g***.com`),
   and `organiser_ownership_v1` (anon) already tells anyone which pages are unowned, so enumeration
   is not a real gain for an attacker. Spam to a contact: R2. Replay: `used_at` + supersede + bound
   to (page, user, target hash): sound. Guessing: 10^8 space, 5 guesses per code, 20 failed redeems
   per page per day: sound (2e-7 per page per day). Timing: the compare is hash-to-hash in SQL; no
   plaintext compare, no timing leak on the code; `no_code` vs `invalid_code` only distinguishes the
   caller's own rows: fine. A contact the attacker can influence: only admins and the page's own
   owner/manager edit `contact_email`/`contact_phone` (table ACL `postgres`+`service_role` only, the
   website edits through member-gated RPCs); the one manager row on 36 unowned pages is an admin; the
   PLAN's "not already a member" refusal closes the manager-edits-then-requests route, but a
   manager editing the contact and having a FRIEND request the code remains (N7). Masked hint leaking
   the contact: the mask shows first char of local part, first char of domain and the TLD, and ALSO
   reveals that a page with `show_email_publicly = false` has a hidden email at all (F2 accepts that;
   say it in the PLAN).
2. Storage: hashed + salted: sound. Tables RLS-on / no-policy / full REVOKE incl. `service_role`:
   sound and stricter than the two live attempt tables (`postgres`+`service_role`); fine, but the
   admin repo's own tooling then cannot read attempts with the service key (N4). GRANT/REVOKE on
   functions: listed; search_path: missing (R4). Audit rows: `claim_code_sent` (masked only),
   `claimed {via:'claim_code'}`: sound; add `claim_code_burned` (5 wrong guesses) and
   `claim_code_blocked` (R2) so an admin can see an attack.
3. Interactions. Instant claim: same evidence rule, same lock order: no disagreement possible.
   Ask-to-join: closing the caller's request with a NEW status `superseded` needs the website parser
   (`selfServeApi.ts:62` accepts `'open' | 'granted' | 'declined' | string`, so it will not crash)
   and `_organiser_access_requests_p5()`; name it. Dancer gate: R1. `organiser_claim_emails`: the
   code goes to `claim_email` when an admin has set one, which is the stronger evidence: sound; after
   a code claim the row stays, and `claim_my_organisers_v1` skips owned pages, so no re-arm: sound.
   `redeem_organiser_invite_v1`: R3. Legacy `claimed_by = caller` with no owner row: 0 in prod, and
   `claim_organiser_v1` treats it as claimable by that caller; the PLAN's "unowned" must say the same
   (N3).
4. Numbers: re-checked, see R5. The F1 recommendation: sound as sequencing, overstated as value;
   phone abuse list in R5.
5. Test matrix and migration order: mostly complete. Missing rows: R1 (issue RPC via PostgREST ->
   denied; anonymous JWT at the edge -> `account_unconfirmed`), R2 (lockout by one account; blocked
   account; kill switch), R3 (two invite shapes), the failed-send-does-not-count rule, "page becomes
   not live between send and redeem" is covered, "admin caller" (gate returns quietly for
   `is_admin()`; an admin can code-claim any page, which is fine but should be a stated row), and the
   `superseded` status round-trip. Migration order: M1 then the website contract check in the same
   window is the repo's pattern; the PLAN should say the check is a NEW `scripts/check-*.mjs` that
   follows the six `check-script-conventions.mjs` rules, or extend `check_anon_grants_contract_v1()`
   (N5). Replay proof and independent review at the highest effort: present and right.

## Nits

- N1. Rate-limit window: PLAN s.2 says "10 per 24 h (copy of `c_limit = 10`, P8)". Live
  `redeem_organiser_invite_v1` counts failures over ONE HOUR (prune at 24 h). Pick one and say which.
- N2. Seat the owner through `_organiser_member_set_p5(org, user, 'owner', 'claim_code', NULL, false)`
  rather than a direct `INSERT` as `claim_organiser_v1` does: it is the one rule for the 20-seat cap,
  `claimed_by` follow and the `member_set` audit (the invite path already uses it).
- N3. Define "unowned" exactly as `claim_organiser_v1` does: no owner row AND (`claimed_by` IS NULL
  OR `claimed_by` = caller).
- N4. Revoking `service_role` on the attempts table means admin-repo tooling and any pruning job
  need a DEFINER function; say who prunes `target` rows.
- N5. There is a live mask helper `_email_hint_v1` (`r...@gmail.com`, full domain) used by the invite
  preview. The PLAN's `r***@g***.com` is stricter; name it `_email_mask_v2` or similar and say why two
  masks exist, or the build will reuse the leakier one.
- N6. Mask-read cap 30/day vs 37 unclaimed pages: either lower it (10) or drop the pretence that it
  limits enumeration.
- N7. Manager edits the contact, a friend requests the code: a low-probability escalation
  (manager -> friend owner). Today moot (the only manager on unowned pages is an admin). Bind the
  code to the contact value AND refuse a request within N minutes of a `profile_edited` audit that
  changed the contact, or accept and record.
- N8. INVENTORY P1 says `claim_organiser_v1` is "authenticated, service_role (no anon)": confirmed
  from `proacl`. P8's "day-old rows pruned 100/call" and "a `rate_limited` answer is not recorded":
  confirmed. `_email_hint_v1` is used by `redeem_organiser_invite_v1` (`invite_email_hint`) and the
  preview: INVENTORY omits that the invite path already shows a masked address to a wrong-email
  caller; worth one line since the brief asks about mask leaks.
- N9. PLAN s.1 "Local parts of 1 character render as `*` only": with a 1-char local part the mask
  `*@g***.com` still reveals the domain's first letter and TLD; say "domain part unchanged" or drop
  the sentence.

## What was NOT verified (honest)

- No mutation or execution of any proposed SQL (docs only; the RPCs do not exist). R1 is argued from
  the live body of `_require_complete_dancer_profile_v1` and how `service_role` calls run, not from a
  test.
- The edge function runtime (`verify_jwt`, how `sub` is read, whether an anonymous-provider JWT
  passes) was not exercised; no edge function source exists in this repo (`supabase/functions` is
  absent), and the live senders named in INVENTORY G4 were not read.
- The admin repo (`organiser_claim_emails` writer, `_join_bound_invite_v1`, `profile_complete_v1`,
  `_my_dancer_profile_id_v1` bodies) was not read; R1 assumes the last two are `auth.uid()`-based,
  which the gate's own body implies.
- Mail provider rate limits and WhatsApp template rules were not checked.
- No website test or lint was run: this PR adds one Markdown file and no code; the only CI that
  applies is the docs-aware path filtering of the workflows (not re-verified here).

## Handover

Done: this review, read-only against prod and `main` at `ff20808`. Left: nothing in this ticket.
Next: builder amends `PLAN.md` for R1-R4 (one docs PR), owner answers F1 with R5 in hand, then M1/M2
in the admin repo with the matrix rows above and an independent review at the highest effort.
