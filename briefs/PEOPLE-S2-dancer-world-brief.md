# People arc S2 -- the dancer world on the shared frame

The owner approved the worlds direction ("Yes, build this") on 2026-10-23. S0 (#975, the wall) and S1 (#980, the foundation) are merged.
Work branch: `claude/people-dancer-world` (new, from origin/main). Lane: normal. Website only, no database change.
A sibling worker (S3, the DJ world) runs at the same time on `claude/people-dj-world`.

## Who owns which files (do not cross)
- S2 (you): `/dancers/:id` -> `app/routes/dancers.tsx`, `src/pages/DancerProfile.tsx`, `src/modules/dancer-app/public-page/**`,
  and new files under `src/modules/person-page/worlds/dancer/`.
- S3 owns: `src/modules/person-page/frame/**`, `src/modules/person-page/facts/**`, `worlds/tokens.ts`, the DJ page and components.
  If you need a change there, do not make it. Write it in your handover as "needs S3/frame", and work around it in your own files.
- Nobody touches `src/modules/person-page/wall/**`.

## Read first
- The approved design is on branch `claude/people-arc-worlds`, in `docs/people-arc/worlds/`: `HANDOVER.md`, `gallery.html`,
  `src/worlds.js` (the dancer world) and `src/facts.js`. Shots are in `shots/`.
- S1's API: `docs/people-arc/s1/HANDOVER.md` on main (facts/, frame/, tokens, and the table of old copies to switch over).
- The audit: branch `claude/people-arc-audit`, `docs/people-arc/audit/REPORT.md`.
- `scripts/check-dancer-area-isolation.mjs` + `scripts/dancer-area-isolation-allowlist.json`. Changing a file under
  `src/modules/dancer-app/` makes this a dancer-area PR: every other changed file must be a seam, and dancer-app imports are
  allowed only through the seams. Read the rules BEFORE planning the file list. If the build cannot fit the rules, stop and
  explain why in the handover (PARTIAL) rather than bending the guard.
- `.claude/rules/design-density.md`, `docs/testing-doctrine.md`.

## Owner decisions (binding)
- D1' Role tabs sit at the TOP, above the photo. Each role is its OWN world: the dancer world is the teal card from the reference.
- D3 Thin first: most dancers have almost nothing filled in. A thin page must look finished, never empty ground.
- D6 Lower half: if the person has another world with an upcoming date, show a preview of it ("Next class ..." / "Next gig ...",
  linking to that world). Otherwise show "Socials in <city> this week" from the calendar. With no city, use London and say "in London".
- D8 "Dance bachata too? Get your own card" invite, as a real button at least 44px tall (explicit px; html is about 13.5px on phones).
  It goes to the existing sign-up / claim entry the site already uses for dancers; find it, and do not invent a new route.
- D9 Back: goes where they came from (history back). Opened straight from a shared link or a new tab -> the list `/dancers`. The label is just "Back".
  The frame is S3's: pass `backHref="/dancers"` and use the frame as it is; S3 adds the history rule to the frame.
- Full weekday names in copy ("Friday", never "Fri"). Hide a fact that is empty or zero (no "0 years").

## Build (behind `flags.personWorlds`; OFF = the dancer page exactly as today, byte for byte in behaviour)
1. Flag ON: `/dancers/:id` renders `PersonFrame` (Back + Share, then `RoleTabs`) and then the dancer world. All facts come from
   `facts/`, and the avatar is `Avatar`. The world formats nothing itself.
2. The D6 lower half and the D8 invite, as above.
3. Switch dancer-app's `languageName(s)` and `cityOnly` to `@/lib/languageNames` and `facts.cityLabel`, and delete the old copies,
   if the isolation rules allow it (S1 handover, "dancer-app"). If they do not, list exactly what blocks it.
4. Dancer bio: the audit found `model.bio` is computed and never shown. Show it on the card if the reference has a place for it;
   otherwise leave it, and note it for the owner.

## Prod shapes (read-only survey first; counts only, no personal data)
Survey the real dancer shapes: photo vs none, city vs none, languages, nationality, other roles (teacher/DJ) with and without an
upcoming date, socials, bio, a long name, a one-name person. Dancers themselves have 0 calendar rows (P2 survey). Each shape gets a screenshot.

## Tests (red first where something is fixed)
A table-driven matrix: every shape x the dancer world (flag ON) and the old page (flag OFF unchanged). Cover the D6 branch
(other world dated / not / no city), D8 present on every shape, no copy pointing at a control that is not on screen, and every
empty state saying what the person can do.

## Design Gate 4 (self-checks, in the PR)
Contrast >= 4.5, taps >= 44px, no clipping, no sideways scroll, every empty/loading/error state actionable, every real shape.
Screenshots at 390x844 and 360x800 for every shape, flag ON, on prod data. Design record: `docs/design/people-s2-dancer-world.md`, linked in the PR body.

## Checks before push
Run every CI job step that applies (read `.github/workflows`). PR body: the per-job CI table, then a "## Verified on real data"
section whose lines start EXACTLY `- Shapes surveyed: `, `- Checks run: `, `- NOT verified: ` (nothing between the label and the
colon; no bold), and a "## Phone QA" section. A preview IS needed: the final push must build one, so set the flag for the preview
the way the repo does for other flags, or say in the handover how the orchestrator should turn it on.

## Handover
Push once. `docs/people-arc/s2/HANDOVER.md`: head sha, PR number, the shape table with screenshots, "needs S3/frame" items, not verified.
