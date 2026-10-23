# W3 design record: "an invite always names the person" + possible-duplicates repair

Branch `claude/invite-w3-names-person`. Brief: `brief/invite-journey:briefs/invite-journey/W3.md`
(PLAN.md section 4 "W3"). Screenshots (390x844, production build, fake Supabase): `docs/design/w3-invite-names-person/w3-*.png`.

## Stage 1: the job
The owner invites someone to manage a page. The invite must name the person (so their login lands on the
profile the owner already made), and a duplicate that slipped through (Papacito / Jinder) must be repairable
from the admin home in plain words, with nothing changed before a second confirm.

## Stage 2: the approved prototype
Profile linking, owner-approved 2026-10-23: https://claude.ai/artifact/3gL4uGiZLMX9QgQrNsUQnk (opened and
followed for this build; cases "You invite Papacito" and "You repair a duplicate").

| Prototype screen | Built as | Shot |
|---|---|---|
| Who is this for? (Leader pre-selected, team list, search, Someone new) | `InvitePersonWho.tsx`, step `who` | `w3-02-who-is-this-for.png` |
| Their email, typed once, saved on the profile | step `email` | `w3-03-their-email.png`, `w3-06-email-person-has-login.png` |
| Invite link ready, works for 7 days, Copy / WhatsApp | `InviteResult` (shared with Invite person) | `w3-04-invite-ready.png` |
| 1 possible duplicate (admin home alert) | `duplicates/DuplicatesAlert.tsx` | `w3-09-duplicates-alert.png` |
| Same person? Keep / Fold in, Not the same person | `duplicates/DuplicateReview.tsx` step `same` | `w3-10-same-person.png` |
| What will change (A2 dry run, plain words) | step `changes` | `w3-11-what-will-change.png` |
| Second confirm: Join these two into one? | step `confirm` | `w3-12-second-confirm.png` |
| Joined | step `joined` | `w3-13-joined.png` |

Deviations from the prototype, on purpose:
- The page's existing admin row (not a separate page header) opens "Who is this for?"; the site's own
  compact admin styling (CLAUDE.md density rule) replaces the prototype's large dark-theme cards.
- "They already have an account" (the existing add-by-login path) stays on the sheet as a second
  person-naming route; the old "Send a link" choice is now "Someone new, not on Bachata Calendar yet",
  the ONLY choice that makes a person-less page link.
- No avatar on pick rows. A text sub-line (Profile you made, no login yet / Has their own login) shows
  only for people found by search: `claimed_by` is a private column (no SELECT for `authenticated`,
  checked on prod), so a team-list row cannot know whether the person has a login; only the admin
  search RPC returns it. Team rows therefore show name + Leader tag only, and the refusal copy says
  "may" for them.
- "Invite link ready for <name>." does not state the expiry: the server's own message under it does.

## Error screens (no prototype: owner decision 2026-10-23)
Written to PLAN.md section 3's copy rule (plain English, says what to do next, never a raw code), one copy
module each: `invitePersonModel.ts` (`WHO_COPY`, `refusalScreen`) and `duplicates/duplicatesCopy.ts`.

| Screen | When | Shot |
|---|---|---|
| Duplicate check: available soon | A2 not applied (RPC missing, PGRST202 / 404) | `w3-01-admin-home-duplicates-available-soon.png` |
| This email cannot be used for this invite (before A2) | `email_in_use`; names the old-login switch as "available soon" with the reason | `w3-05-refused-email-in-use-before-a2.png` |
| This email cannot be used for this invite (after A2) | `email_in_use` once the switch exists | `w3-08-refused-email-in-use-after-a2.png` |
| The profile already has a login someone uses | `login_has_signed_in` (proposed A2 code) | `w3-07-refused-login-has-signed-in.png` |
| Hiding a pair before its RPC exists | dismiss RPC missing | `w3-14-dismiss-not-available.png` |
| Two used logins | dry run `refused: two_real_logins` (file name kept from the first cut) | `w3-15-refused-both-signed-in.png` |
| Other join refusals | `keep_profile_archived`, `no_signed_in_login`, `anonymous_login`, `keep_claimed_by_other`, `login_has_other_persona`, `already_done`: one plain line each in `JOIN_REFUSAL_COPY` (unit-tested, no screenshot) | - |
| A paused join | `not_linked` entry: its own row, "<person> tried to join <page>; the join is paused", counted in the alert, no join button unless a pair for the same invited profile is listed | `w3-09-duplicates-alert.png` |

## Stage 3: build notes
- Nothing is sent before the second confirm: `admin_join_duplicate_people_v1` with `p_dry_run=false` is
  called only from "Yes, join them". Asserted in `duplicates/__tests__/duplicates.matrix.test.tsx` (proven by
  mutation: a join fired on the first tap reds 4 tests) and in the build walk.
- The alert is computed live (`staleTime: 0`) each time the admin page opens.
- Found in the build walk and fixed: after Joined, the live re-check dropped the pair and the Joined screen
  vanished before Close. The review now holds the pair itself; a unit test (red first on the old code) pins it.

- Fixed after `/code-review high` (10 findings, all edits, none deferred): the named-person link is
  now held by the row guard (the row cannot close until Done; unit test red without the fix); the row's
  status, Withdraw and waiting requests refresh after an invite; the default pick is frozen on Next; the
  row's "another owner" and "replaces the live link" notes show on the email step; the A2 probe runs
  only after a refusal; cached team lists and search are refreshed after a join; the hard-coded
  "7 days" is gone; a search whose every hit is already on the team says so; the unreachable
  "Invite by email" row mode is removed.
- Found by the full unit suite and fixed: the first cut selected `claimed_by` on `dancer_profiles`,
  which production refuses (`dancerProfilePrivateColumns.test.tsx` caught it).

## Stage 4: checks by script
- `tests/e2e-build/invite-who-duplicates.build.spec.ts` at 390x844 on the production build: no sideways
  scroll on every screen, every button on "Who is this for?" at least 44px tall, focus moves to the new
  step's heading, no page errors.
- Unit: `__tests__/inviteWho.matrix.test.tsx` (Leader {none, one, several} x person {unclaimed with email,
  unclaimed without email, shadow login, already claimed, new}); duplicates {none, one, dismissed,
  not_linked, unavailable} x confirm {cancel, confirm}.

## Stages 5 and 6
Done by the orchestrator (independent critique, owner walk). Not done here.

## Handover (worker W3, 2026-10-23)
- Done: everything in PLAN.md section 4 "W3" on the Website side; tests and screenshots above.
- Fix-up (dt_98e601914736): A2's database contract wins (orchestrator decision). The duplicates screens now read
  A2's real bodies (bachata-admin `claude/invite-a2-identity-join`, 20261205330000 / 20261205340000):
  `check_invitee_duplicates_v1()` -> `{pairs: [{premade_*, login_*, kind: 'team_stub'}], not_linked: [...]}`
  (keep = premade, fold = login); dismiss is `admin_dismiss_invitee_duplicate_v1(p_profile_a, p_profile_b,
  p_dismiss)`; the join's refusal codes are A2's six plus `already_done`.
- Open, outside this fix-up: A2's `admin_invite_person_v1` raises `shadow_login` for a never-used own login;
  the invite screens still expect `login_has_signed_in`, which A2 never raises. `shadow_login` falls to the
  generic refusal until W3's invite copy is aligned.
- Until A2 is applied: the alert says "available soon", the dismiss says so too, and `email_in_use` names
  the old-login switch as "available soon". Nothing is a broken button.
- Next: orchestrator stages 5-6; after the A2 apply, re-walk on the preview with real data (a fresh
  invite from the owner), and walk the duplicates alert against the live check.
