# Session handover 2026-10-23: W3 (invite names the person + duplicates repair)

Branch `claude/invite-w3-names-person`, PR #981. First run dt_b2b85c439f90; fix-up dt_98e601914736.
Brief: `brief/invite-journey:briefs/invite-journey/W3.md`.

## Done (first run)
- "Who is this for?" (`InvitePersonWho.tsx`), refusal screens (`refusalScreen` in `invitePersonModel.ts`),
  duplicates (`duplicates/*`) with "available soon" while A2's RPCs are missing, matrix tests, the
  production-build walk, the design record and screenshots (`docs/design/w3-invite-names-person*`).

## Done (fix-up dt_98e601914736: A2's database contract wins)
- `duplicatesModel.ts` parses A2's real `check_invitee_duplicates_v1()` object: `pairs[]` (keep =
  `premade_profile_id`/`premade_label`, fold = `login_profile_id`/`login_label`, `team_stub` -> `stub`) and
  `not_linked[]`, which is NOT a pair: it is counted in the alert and shown as its own row ("<person_label>
  tried to join <organiser_name>; the join is paused"), with a Review button only when a pair for the same
  invited profile is listed.
- Dismiss calls `admin_dismiss_invitee_duplicate_v1(p_profile_a, p_profile_b, p_dismiss => true)`.
- The join reads `{changes, applied, refused?, already_done?}`; refusal codes `keep_profile_archived`,
  `two_real_logins`, `no_signed_in_login`, `anonymous_login`, `keep_claimed_by_other`,
  `login_has_other_persona` each have one plain-English line (plus `already_done` and the raised errors).
- Tests and the build walk use A2's shapes; screenshots w3-09..w3-15 re-taken.
- `scripts/lint-runtime-architecture.mjs`: the duplicates model and its test join the `organiser_id`
  allowlist (A2's answer carries that key), the same way the other boundary parsers are listed.
- `routes.matrix.test.tsx` is NOT touched by the fix-up (W1 is rewriting it on `claude/invite-w1-join`).

## Open
- `admin_invite_person_v1` on A2's branch raises `shadow_login` (a never-used own login); the invite screens
  still match `login_has_signed_in`, which A2 never raises. Outside this fix-up's list; needs a decision.
- Not verified: a Vercel-preview walk with real data and a real invite (orchestrator stages 5-6, after A2 apply).

## Next
1. Orchestrator: decide the `shadow_login` copy (W3 invite side) and dispatch it.
2. After the owner applies A2, walk the preview at 390x844 with a fresh invite.
