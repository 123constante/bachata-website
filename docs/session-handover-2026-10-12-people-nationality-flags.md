# Session handover 2026-10-12: nationality flag on every person photo

Branch: `feat/people-nationality-flags` (one PR; see the PR body for the number and the checkpoint list).

## Done
- **One implementation**: `src/components/people/` -- `nationality.ts` (the one rule: code or no flag, the one
  wording "Nationality: <country>"), `flagArt.ts` (inline 30x20 SVG artwork, no CDN; the 11 prod codes plus
  ~50 likely next, a generic cloth with the letters for any other valid code), `flagWave.ts` (the reference's
  Silk maths ported: 45/30/25/70/10), `flagClock.ts` (ONE rAF loop, shared IntersectionObserver, stops when the
  tab is hidden, no loop under reduced motion), `NationalityFlag.tsx` (the badge), `PersonAvatar.tsx`.
- **Surfaces wired** (15): /djs list, /teachers list, /dancers list, /all-profiles, /videographers (+`nationality`
  column), /vendors/:id team, /practice-partners (signed in), /djs/:id hero, /dancers/:id hero, /event/:id
  programme (PersonChip; `event_view_p5` has no code, so `get_event_program_v1` / `get_occurrence_program_v1`
  are asked once, only when the programme has people, non-blocking), /festival/:id headliners, header search +
  Cmd+K overlay, /search cards, /organisers/:id Teachers & DJs circles, /account dancer home (own photo).
- **Not wired, on purpose**: CommunitySpotlight (decorative overlapping stack: the next photo would cover each
  flag), AvatarUpload (an upload control), the organiser team picker's search rows
  (`organiser_team_search_people_v1` emits no code -- an admin change), /teachers/:id (no portrait exists), dead
  `sections/` files.
- **Owner controls on a team-chip photo**: none exist. The only pencil on a photo is the organiser entity's own
  (already bottom-right, no flag there). The phone spec proves it stays reachable and clear of every flag.
- Tests: `nationalityFlag.unit.test.ts`, `flagClock.test.ts`, `nationalityFlag.surfaces.matrix.test.tsx`
  (15 surfaces x 9 shapes; red-before 68 failed / 68 passed on the unwired code, green-after 136/136), phone spec
  `people-nationality-flag.phone.spec.ts` (24 pass at 390x844, 360x640, 412x915). Screenshots in
  `docs/screenshots/nationality-flags/`.

## Open
- No `/code-review` has run on this diff; no review stamp (the pre-push gate may refuse the push -- see the PR).
- Not verified on a real phone: motion smoothness, battery, real device pixel ratios.
- `tests/integrityCouldNotRun.test.ts` fails 5 locally on main too (environment), not this PR.

## Next
- The owner runs `/code-review`, then a phone test on /djs, an event with a coded teacher, and an organiser team.
