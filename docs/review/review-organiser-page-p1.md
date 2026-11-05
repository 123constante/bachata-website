# Independent review + 390x844 walk: Website PR #1399 (P1 visitor page) at 78763fba

**VERDICT: FIX (no HIGH).** 3 MED to fix or consciously accept, plus LOWs, plus the lead's 4 code-review findings. One push can carry all of them.

Reviewer: Sonnet 5.5 reviewer agent (findings spot-checked by website-18); builder was Opus. Read-only: no push to the branch, no PR comment. Method: static read of the diff against `docs/organiser-page/ACCEPTANCE.md` and `docs/briefs/organiser-page-p1.md`, plus a walk of the live branch build. **Not run by the reviewer:** CI, vitest, the bundle budget, red-first on unfixed code.

## Walk (walk-all.mjs, 390x844, `VITE_ENABLE_ORGANISER_P3/SELF_SERVE/DETAIL=true`)
First attempt without `VITE_ENABLE_ORGANISER_DETAIL` showed the "Coming soon" gate on all four (tool default flags lack it; not a page defect). Second attempt, flag on:
| Page | Sideways scroll | Page errors | Taps under 44px | Contrast | What the picture shows |
|---|---|---|---|---|---|
| incognito-dance | 0 | 0 | 20 (all global footer links, 15px high) | 0 flags | stats strip "Tonight / Next night" and "40 Nights hosted", three Get in touch rows with Copy, Team with one person |
| anna-galenda | 0 | 0 | 20 (same footer) | 0 flags | ok |
| tropicana | 0 | 0 | 20 (same footer) | 1 flag: the hero name "Tropicana" reads 1:1 (gradient-fill text; hero is untouched and the tool cannot read gradient text, so a tool false positive and not P1) | no stats strip (none qualify, as expected), Get in touch, Team, then "No dates announced yet" + Browse upcoming nights |
| bachata-community | 0 | 0 | 20 (same footer) | 0 flags | ok |
Pictures (local, not in the repo): `scratchpad/walk1399b/01.png`-`04.png`. **Not verified by the walk:** only the first viewport was captured, so Next nights, Past nights and the dates sheet below the fold were not seen; no signed-in owner view; footer tap targets are pre-existing and out of scope.

## Contract checks that PASS (by reading source and tests)
Section order hero, stats, Get in touch, Team, About, Next nights, Past nights (`OrganiserProfile.tsx:1254-1383`; the claim card sits between Team and About, LOW). Parked items not built (E4, E5, E7, owners/managers: `access: []` at :756, hide, share). E1 gone, E2 no Facebook row, E10 old strip replaced by `OrganiserStatsStrip` (null when empty), E3/E8 `error && !entity` shows "Couldn't load this organiser" + Try again (:1002-1023) and noindex only on a real not-found (:639), E9 `fetchPublicContactOrThrow` throws and the Get in touch error line shows (OrganiserGetInTouch.tsx:116-121), E13 four rows in fixed order each with an `<a>` and its own Copy at 44x44. SSR loader untouched. Stats use the merged `organiserStats`, nights empty when a feed failed (:828-841). No raw Unicode punctuation introduced.

## Findings
**MED-1. Team circles lose nationality flags** (inferred). The new roster query selects only `first_name, avatar_url` (`OrganiserProfile.tsx:722-742`) and `OrganiserTeamSection.tsx` has no flag; `tests/e2e-phone/people-nationality-flag.phone.spec.ts:89` expects flags on /organisers/:id. The unit row `nationalityFlag.surfaces.matrix.test.tsx:295` mocks its own mapping and never mounts the page, so it stays green. The handover does not say it is intended. Fix: restore the flag or delete that spec and row on purpose and say so in the PR body.
**MED-2. `TeamCircle` tests deleted, not replaced** (proven by the diff, ~85 lines in `w1S3Strips.test.tsx`). They covered DJ and teacher links behind `teacherDetail`, role-typed `emitProfileView` and badge fallbacks. New Team always links `/dancers/<id>` and emits `profileType: 'dancer'` (`OrganiserTeamSection.tsx:60`). A team member who is a DJ or teacher now opens the generic dancer page; analytics type changes. Fix: state it in the PR body or keep the role-aware link.
**MED-3. One failed feed discards every stat** (proven by the matrix test `:180` pinning `stats: []`). "Next night" disappears when only the past feed blipped. Safe but conservative; ACCEPTANCE J4 only hides the hosted stat. Decide: compute upcoming-only stats when only the past feed failed.
**LOW-4 (also lead's #1).** The roster's second query (`dancer_profiles`, :732-735) never checks its `error`; names go null, `buildOrganiserTeam` drops everyone, Team hides with no error line: a false "no team".
**LOW-5.** `emptyKind` is forced null when `teamMembersError` (:1095): a team-only failure on a no-nights organiser shows neither "No dates announced yet" nor a nights error. Over-suppression; no test.
**LOW-6.** Try again buttons have no pending state; the entity-error `refetchEntity()` shows nothing during retry (`isLoading` stays false, :984 vs :1002), so a double tap is possible.
**LOW-7.** Owners (`facts.canEdit`) still get "Just getting started" and "Complete your profile" rendered by the page (:1289-1303), not by the edit layer (J6). Visitors never see it.
**LOW-8.** Invariants use absence assertions ("Verified", "Not added", "Online", "elsewhere in London", "Facebook"); the matrix has no signed-in owner row; red-first is claimed in the handover and not verifiable by reading.
**LOW-9.** `tests/e2e-phone/organiser-name-city-create.phone.spec.ts:14,182` still refer to the "Upcoming events" heading, now "Next nights" (e2e-phone is outside `test:e2e`, so CI will not catch it).
**LOW-10.** Contract vs mapping: past-only organisers lead with a `last_night` stat (`organiserStats.ts:196`); ACCEPTANCE section 1's list has no "last night" stat. Not a PR defect; tell the owner.
**LOW-11.** Layout shift: Get in touch and the stats strip pop in after the feeds settle; `now: new Date()` in a `useMemo` could mismatch server and client HTML near midnight.

## Lead's own code-review findings (fold in)
L1 `dancer_profiles` read error swallowed ~:733 (same as LOW-4). L2 `hasContact` ignores `publicContactError` ~:1083. L3 dead `extractFbHandle` import at line 15. L4 the past-only empty block sits inside `pastEvents > 0` ~:1380.

## Not verified
Bundle budget, per-job CI table, red-first on unfixed code, below-the-fold sections in the walk, owner (signed-in) view, whether `/dancers/<uuid>` resolves, live RPC bodies and the shape survey, the handover and design record contents.
