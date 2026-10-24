# People arc S6 -- remove the dancer "Socials in <city> this week" filler

Orchestrator, 2026-10-24. Work branch: `claude/people-dancer-no-socials` (new, from origin/main). Lane: normal (no DB, no migration, no RPC). If you find you need SQL, STOP and say so in the handover.
Worlds sit behind `flags.personWorlds` (flag OFF = the old dancer page exactly as today; do not touch that path).

## Owner words (binding)
Phone test 2026-10-24: the "Socials in London this week" block "looked like the dancer's own plans". REMOVE it. Owner click answer: when the dancer has no other dated world, the lower half is **just the invite** ("Dance bachata too?" + "Get your own card"). No calendar filler, no extra link, no "Find a party" button.
Kept as is: the D6 "Coming up" preview of the dancer's OWN other worlds (next class / next gig) when one has a date; the D8 invite on every shape (hidden when signed in via `facts.showsJoinInvite`).

## Where (all under `src/modules/person-page/worlds/dancer/`, NOT `people/`)
- `useDancerLower.ts` -- the `dancer-world-socials` useQuery, `SocialsState`, `getCalendarEvents`/`resolveCanonicalCity`/`londonDayRangeUtc` imports.
- `model.ts` -- `lowerHalf` (the `socials` branch), `socialsThisWeek`, `CalendarLike`, `SocialRow`, `SocialsDay`, `SOCIALS_MAX`, `SOCIALS_COPY`, `ALL_SOCIALS_HREF`, `DEFAULT_CITY` (only if nothing else uses it: grep first), `PARTY_ACTION` (keep if the DJ world or others import it).
- `DancerWorld.tsx` -- `Socials`, `SkeletonWeek`, the lower-half switch.
- `DancerWorldPage.tsx` -- whatever wires the socials state.
- `__tests__/dancerWorld.matrix.test.tsx` (466 lines) -- rewrite the socials rows of the matrix.
Delete code that has no importer left (prove with grep); do not leave dead exports. Anything outside this folder you touch needs a reason in the PR body.

## Design points to decide (record in the design record)
1. **Loading state (OWNER DECIDED).** The skeleton existed so the invite and footer did not jump when a week of socials arrived (S2 critique: 0.09-0.29 shift). Now: a dancer-only person (no other role; 159 of 189) reserves NOTHING and the invite is already in place. A person who holds teacher and/or DJ roles reserves ONE preview-row height (64px, the PreviewRow minHeight) while their dates load, collapsing to the real rows or to nothing when the read settles. Measure the layout shift before/after at 390x844 for both kinds and put the numbers in the design record.
2. **A failed or empty other-world date read** = no preview = just the invite (never a stuck box).
3. No "Coming up" heading without an item under it.
4. `lowerHalf()` result becomes previews-or-nothing; keep the type small and total.

## Prod shapes (read-only survey first; counts only, prod `stsdtacfauprzrdebmzg`)
dancer-only / +teacher / +DJ / +both x other world dated-upcoming / past-only / no date x city / no city x photo / no photo x signed in / signed out (invite hidden when signed in). 189 dancers at last count; 159 hold no other role. Every shape walked at 390x844 AND 360x800, flag ON, using the real aitor-style thin page and one dancer with a dated DJ or teacher world.

## Tests (red first)
Table-driven shape x lower-half matrix: previews shown iff an upcoming date exists; otherwise the invite is the last thing before the footer; the string "Socials in" / "this week" / "All socials" appears NOWHERE on any dancer shape (add this as an explicit negative assertion); no copy points at a missing control; no network call to the calendar from a dancer page (assert `getCalendarEvents` is never called). Run the new tests against the UNFIXED code first and show they fail. Flag OFF unchanged. Identical-frame test across DJ/Dancer/Teacher still passes.

## Design Gate
Visible change -> record `docs/design/people-s6-dancer-no-socials.md` linked in the PR body: brief (5 lines), chosen outcome (owner already chose), checks (contrast >= 4.5, taps >= 44px explicit px, no clipping, no sideways scroll, every state actionable, every real shape), shift numbers. Stage 5 critique is a separate worker afterwards; do not self-certify.

## Checks, PR body, handover
Run every CI job step that applies (read `.github/workflows`); per-job table in the PR body; sections `## Verified on real data` with lines starting EXACTLY `- Shapes surveyed: `, `- Checks run: `, `- NOT verified: ` (no bold, nothing before the colon) and `## Phone QA`. Push once. `docs/people-arc/s6/HANDOVER.md`: head sha, PR, shape table with shots, how the orchestrator turns the flag on (`preview-deploy.mjs --flag VITE_ENABLE_PERSON_WORLDS=true`), not verified. HTML entities not raw Unicode punctuation in JSX. Source files over 2 KB go through `scripts/safe-edit.py` / `safe-write.py`. Context under 50%.
