# Session handover 2026-10-12: nationality flag on every person photo

Branch: `feat/people-nationality-flags`, PR #740.

## Done
- **One implementation**: `src/components/people/` -- `nationality.ts` (the one rule: code or no flag, the one
  wording "Nationality: <country>"), `flagArt.ts` (inline 30x20 SVG artwork, no CDN; the 11 prod codes plus
  ~50 likely next, a generic cloth with the letters for any other valid code), `flagWave.ts` (the reference's
  Silk maths ported: 45/30/25/70/10), `flagClock.ts` (ONE rAF loop, shared IntersectionObserver, stops when the
  tab is hidden, no loop under reduced motion), `NationalityFlag.tsx` (the badge), `PersonAvatar.tsx`.
- **Surfaces wired** (15): /djs list, /teachers list, /dancers list, /all-profiles, /videographers (+`nationality`
  column), /vendors/:id team, /practice-partners (signed in), /djs/:id hero, /dancers/:id hero, /event/:id
  programme (PersonChip; `event_view_p5` has no code and the programme reads that do are retired here --
  check:legacy-program-rpcs -- so `dancer_profiles.nationality` is read for the people on it, non-blocking), /festival/:id headliners, header search +
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

- **CI round 2** (push 2): integrity red (the retired programme RPCs) and bundle-budget red (+1 first-load chunk on
  every route from the header search; /event over 380 KB) fixed: the flag is lazy in HeaderSearch and PersonChip,
  parsers pass the raw code, parties/classes budget 320 -> 321 KB with a note (main 319.9, branch 320.0).

## Open
- **Sticker swap brief** (`docs/briefs/sticker-flag-swap.md`, pushed 2026-10-13 by kiki-claude-bot): it says the owner
  rejected the waving flag for a static Sticker. NOT started in this session (context limit); the next session does it.
- 2026-10-13: merged main (#739) into the branch; main's /parties and /classes budget 325 KB supersedes this PR's 321 bump.
- Backend option: have `event_view_p5` legacy_compat emit `nationality_code` (admin) so the programme needs no
  second read.
- No `/code-review` has run on this diff; no review stamp (the pre-push gate may refuse the push -- see the PR).
- Not verified on a real phone: motion smoothness, battery, real device pixel ratios.
- `tests/integrityCouldNotRun.test.ts` fails 5 locally on main too (environment), not this PR.

## Next
- The owner runs `/code-review`, then a phone test on /djs, an event with a coded teacher, and an organiser team.
