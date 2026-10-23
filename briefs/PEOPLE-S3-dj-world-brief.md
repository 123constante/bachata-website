# People arc S3 -- the DJ world on the shared frame, plus the frame's Back rule

The owner approved the worlds direction ("Yes, build this") on 2026-10-23. S0 (#975, the wall) and S1 (#980, the foundation) are merged.
Work branch: `claude/people-dj-world` (new, from origin/main). Lane: normal. Website only, no database change.
A sibling worker (S2, the dancer world) runs at the same time on `claude/people-dancer-world`.

## Who owns which files (do not cross)
- S3 (you): `/djs/:id` -> `app/routes/djs.tsx`, `src/pages/DJProfile.tsx`, `src/components/dj/**`, new files under
  `src/modules/person-page/worlds/dj/`, AND the shared `src/modules/person-page/frame/**`, `facts/**` and `worlds/tokens.ts`
  (you are their only editor in this wave; keep every change additive and backwards compatible, because S2 builds on the API as merged).
- S2 owns: the dancer page and `src/modules/dancer-app/**`. Do not touch them.
- Nobody touches `src/modules/person-page/wall/**`.

## Read first
- The approved design is on branch `claude/people-arc-worlds`, in `docs/people-arc/worlds/`: `HANDOVER.md`, `gallery.html`,
  `src/worlds.js` (the DJ world: record sleeve, serif name, "Played at", upcoming rows) and `src/facts.js`. Shots are in `shots/`.
- S1's API and the old-copies table: `docs/people-arc/s1/HANDOVER.md` on main.
- The audit: branch `claude/people-arc-audit`, `docs/people-arc/audit/REPORT.md` (DJ rows: name, dates, counts, Share at the bottom).
- `.claude/rules/design-density.md`, `docs/testing-doctrine.md`.

## Owner decisions (binding)
- D1' Role tabs at the TOP, above the photo; the DJ world is its OWN world (sleeve, DM Serif Display, played-at).
- D5 The DJ name big, the real public name small under it (`facts.worldNames(..., 'dj')`); never a doubled "DJ " prefix.
- D3 Thin first: most DJs have 0-1 upcoming gigs, and none of the DJ-only people have 2+. A thin page must look finished.
- Drop the guestbook from the DJ page. Keep "Played at" and the upcoming rows.
- D8 "Dance bachata too? Get your own card" invite, as a real button at least 44px tall (explicit px), going to the existing
  sign-up / claim entry the site already uses (find it, and do not invent a route).
- D9 Back (frame-wide, you build it): goes where they came from (history back) when the previous page was on this site; opened
  straight from a shared link or a new tab -> `backHref` (the world's list, e.g. `/djs`). The label is just "Back". Put it in `PersonFrame` with a test for both paths,
  and keep the `backHref` prop as the fallback so S2's call keeps working.
- Counts only from 2 (`facts.countLabel`). Full weekday names. Hide an empty fact.

## Build (behind `flags.personWorlds`; OFF = the DJ page exactly as today in behaviour)
1. Flag ON: `/djs/:id` renders `PersonFrame` and then the DJ world. Use `useDjPageFonts()` for DM Serif Display. All facts come
   from `facts/`, and the avatar is `Avatar`.
2. Add the time label ("19:30") and the "played at" month label to `facts/` (S1 handover item 5) with matrix tests; no world formats them itself.
3. Switch the DJ code's old copies to facts (S1 table: `DJProfile.tsx` upcoming split and name, `djFormat.ts` month names,
   `djRoleModel.ts` / `DjTiles.tsx` counts and initials), but only on the flag-ON path, or where the output is identical. Delete a copy only when nothing uses it.
4. Share sits in the frame (top right), no longer at the bottom.

## Prod shapes (read-only survey first; counts only)
DJs with 0 / 1 / 2+ upcoming gigs, past gigs (played at) yes/no, DJ name vs none vs equal to the public name, "DJ " prefix cases,
photo vs none, other roles, languages, a long name. Each shape gets a screenshot.

## Tests (red first where something is fixed)
A table-driven matrix: every shape x the DJ world (flag ON) and the old page (flag OFF unchanged). The Back rule (history vs
fallback). The new facts functions over every shape. No copy that points at a control that is not on screen.

## Design Gate 4 (self-checks, in the PR)
Contrast >= 4.5, taps >= 44px, no clipping, no sideways scroll, every empty/loading/error state actionable, every real shape.
Screenshots at 390x844 and 360x800 for every shape, flag ON, on prod data. Design record: `docs/design/people-s3-dj-world.md`, linked in the PR body.

## Checks before push
Run every CI job step that applies (read `.github/workflows`). PR body: the per-job CI table, then a "## Verified on real data"
section whose lines start EXACTLY `- Shapes surveyed: `, `- Checks run: `, `- NOT verified: ` (nothing between the label and the
colon; no bold), and a "## Phone QA" section. A preview IS needed: say in the handover how the orchestrator turns the flag on for it.

## Handover
Push once. `docs/people-arc/s3/HANDOVER.md`: head sha, PR number, the shape table with screenshots, the frame and facts API
changes (for S2 to adopt after merge), not verified.
