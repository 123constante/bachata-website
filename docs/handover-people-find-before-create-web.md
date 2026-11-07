# Handover: people find before create (Website) -- /invite join

Ticket: dt_506feb599065. Brief: `brief/people-find-before-create-website:docs/briefs/people-find-before-create-website.md`
(sha 48513d3). Branch pushed: `claude/people-find-before-create-website` (the dispatch named this branch; the brief's
`Branch:` line says `...-web`). No RPC change was needed, so no admin brief request.

## Done
- ONE mapping `claimNextStep(claimAnswer, inviteKind)` in `src/modules/admin-organisers/join/joinModel.ts`;
  `inviteKind` reads only the invite's own proof (person-bound / email-bound / neither). No name search anywhere.

  | claim answer | person-bound | email-bound | neither |
  |---|---|---|---|
  | linked, already_linked, not_applicable, unavailable | continue | continue | continue |
  | no_match | safety_redeem (not_linked, inviter told) | continue (new person) | continue |
  | ambiguous | safety_redeem | **unmatched** | **unmatched** |
  | email_unproven | **unmatched** | **unmatched** | **unmatched** |

- `unmatched` = new stop "We couldn't match you automatically" + "The organiser's admin can join you to your existing
  profile" + "Let <inviter> know" + one link (organiser home; public site when the organiser area is off). Nothing is
  created, chosen or redeemed. Survives a reload in the same tab (sessionStorage, per account + link tail); forgotten
  on sign-out/switch. Failure tag `invite_join:claim:unmatched_<ambiguous|email_unproven>`.
- Person-bound `ambiguous` kept on the existing safety redeem (server records not_linked, so "we've told" is real) --
  a deliberate reading of brief item 1 vs the existing A2 contract. Flag if the owner wants the unmatched screen there.
- Tests: `join/__tests__/joinJourney.test.tsx` (7 answers x 3 kinds x 3 signed-in shapes = 63 rows, reload, other
  account, untouched page) -- the 15 unmatched rows were red on the unfixed page. `join/__tests__/claimNextStep.table.test.tsx`.

## Left / known limits
- A person ALREADY signed in elsewhere who opens the link never passes the code step, so no claim runs here (an
  untouched page sends nothing extra, by brief). Closing that needs the claim at page load or the rule inside
  redeem (admin RPC) -- an admin brief if wanted.
- `recordJoinRoles` (role intent dancer+organiser) still runs before the unmatched decision (review r1 note; kept).
- `email_unproven` follows the brief's copy, though the existing "Sign out and get a code" stop is more actionable;
  after a code sign-in on this page it is effectively unreachable.
- 390x844 walk of /invite/<token> with a real invite: the lead's (brief).

## Next steps
Lead: phone walk with a real email-bound or plain invite whose email matches 2 admin-made profiles (survey: 0 such
open invites today), and a person-bound invite. Merge after checks are green.
