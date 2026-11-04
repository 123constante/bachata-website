# Handover: claim-code-design-r2 (docs only)

Ticket dt_96910143eb94. Branch `claude/claim-code-design-r2` from `main` 8d2131f.
Brief: `docs/briefs/claim-code-design-r2.md` on `brief/claim-code-design-r2`.
Input: independent review `docs/review/claim-code-design-r1.md` (BLOCK).

## Done
- `docs/design/claim-code/PLAN.md` rewritten as r2:
  - R1: issue RPC takes `p_user_id`, gates BY ID (`_member_target_account_p5(p_user_id, NULL)` +
    by-id dancer gate), `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`, edge function calls with the
    service key; matrix row "issue RPC via PostgREST as authenticated -> permission denied".
    Chosen: the edge function generates the code; only hash + salt reach the DB (reason in s.3).
  - R2: per-(page,user) cap 1/h 2/d, page cap counts distinct requesters, 7-day cool-down after 3
    unredeemed codes, admin kill switch `claim_code_blocked_at`, fixed copy with no requester text,
    opt-out footer.
  - R3: s.4a states the live `redeem_organiser_invite_v1` behaviour (seats a second owner) and the
    `claim_my_organisers_v1` bound-invite join; two matrix rows; owner decision F4 with options.
  - R4: every pseudo-signature has `SECURITY DEFINER SET search_path`; `extensions.digest` /
    `extensions.gen_random_bytes` qualified.
  - R5: F1 rewritten (email-only moves about 0 pages; value is the phone route); the seven
    phone-route abuse cases each with a mitigation (s.2b).
  - N1-N9 folded in (1-hour window, `_organiser_member_set_p5`, "unowned" definition, pruning/admin
    read, `_claim_target_mask_v1` vs `_email_hint_v1`, mask cap 10, contact-change 24 h refusal,
    INVENTORY invite-hint line, 1-char mask sentence).
- `INVENTORY.md`: counts updated to 2026-11-02 (37 = 2 email, 32 phone only, 3 none); invite row
  states the owner seating and `_email_hint_v1` mask.

## Owner decisions (none decided here)
- **F1 Channel**: email only / email + phone(WhatsApp) / do not build. Recommendation: email + phone in
  one release, or do not build; email alone is ~0 pages.
- **F2 Hidden email**: send to a hidden `contact_email`. Recommendation: send (mask reveals that one exists).
- **F3 "founding" set**: owner to name it.
- **F4 Open invite vs code claim**: (a) co-owner, (b) invite seats manager, (c) no code route while an
  invite is open, (d) code claim revokes invites. Recommendation: (c).
- **F5 Copy**: fixed copy, no requester name in the code message; validated first name only in the
  success notice. Recommendation: as stated.
- Also owner-set numbers: global daily send ceiling (proposal 200), allowed phone country codes
  (proposal UK + EU).

## Verified
- Prod `stsdtacfauprzrdebmzg`, SELECT only, 2026-11-02: live unclaimed (live, `claimed_by` NULL, no
  owner member row) = 37; email evidence 2, phone only 32, none 3.

## Not verified
- Live RPC bodies (`redeem_organiser_invite_v1`, `claim_my_organisers_v1`, `_require_complete_dancer_profile_v1`)
  were NOT re-read by me; R1/R3 statements rely on the r1 review's reading. Same for "4 open invites on
  unowned pages", "34 public phones", "36 of 37 with one admin manager row", and the `pg_default_acl` facts.
- No SQL executed or mutated (no RPC exists yet); no edge-function, provider or WhatsApp template check.
- `_phone_e164_v1`, `_claim_target_mask_v1`, `admin_claim_code_activity_v1`,
  `_set_claim_code_send_outcome_v1` are proposed names, not live.
- No website tests/lint run: Markdown-only diff.

## Next
Owner answers F1-F5; then M1/M2 in the admin repo from this PLAN, with an independent review at the
highest effort before push.
