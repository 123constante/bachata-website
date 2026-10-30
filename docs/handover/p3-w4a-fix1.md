# Handover: P3 W4a FIX 1 (walk fixes) &mdash; 2026-10-27

Branch `claude/p3-w4a-team-switch-page`, PR #1080 (draft). Ticket dt_a6af6e012a37.
Brief: `brief/p3-w4a-team-switch-page:docs/briefs/p3-w4a-fix1.md`. Fresh `origin/main` merged first.

## Done
1. **Page editor in P3 tokens** (`/account/p3/you/page`). The facts card is `bg-[var(--card)]` +
   `.p3-eip` in P3. The edit-in-place pieces the page renders (pencils, chips, Your links, Contact,
   the `unsaved` tag and the drafted outline) now read `--eip-*` variables (`edit-in-place/parts.tsx`:
   `ACCENT`, `ACCENT_BG`, `ON_ACCENT`, `FG`, `MUTED`, `RULE`). Every fallback is the old R1 value,
   so the public organiser page and R1 `/account/o/page` paint exactly as before. `p3.css` `.p3-eip`
   maps the variables to the existing P3 tokens (no new values, no second token file).
   `GOLD`/`INK`/`CREAM` are still hex (the sheets and `fixedLayers.test` read them).
2. **Title clipping.** Root cause: `.p3-top-row h1` has `overflow:hidden` and inherited `line-height:1.1`
   from `src/index.css`, so the tall Outfit glyphs lost their tops. Now `line-height: 28px`. The page
   name `h2` (also truncating) gets `leading-[28px]` in P3 only.
3. **One Team entry** (decided from mockup A, whose page editor has no Team block): in P3 the editor's
   Team card ("On the team..." + "Add a person") is not rendered; the ONE `page-team-link` row to
   P3 Team stays. R1 keeps both.
4. **Done in P3.** New route `/account/p3/you/done` (`P3_PATHS.youDone`, `P3_SURFACE.paths.done`).
   `goDone(..., donePath)` takes the surface's Done (R1's by default). `Done.tsx` reads `Shell` + `hub`
   from the surface: in P3 it is P3's frame, the primary goes back to Team / Organiser page and the
   second button is "Back to You"; a reload goes to You. R1 still says "Back to Home".
5. Tests (red first, then green): `p3/you/__tests__/you.matrix.test.tsx`, the "W4a fix 1" blocks
   (25 new tests). Before the fix, 20 of them failed.

## Left / next steps
1. **The orchestrator re-walks** at 390x844 (light and dark). Not walked here, per the brief.
2. The edit-in-place **bottom sheets, unsaved-changes bar, notice and leave dialog** are portalled into
   `document.body`, outside `.p3-theme`, so they still have the R1 dark look in P3. Re-skinning them
   means passing the P3 scope into the portal. Not in this brief; listed for the walk.
3. The other R1 screens P3 opens (Account and help, Message us, Add a page, Add an event, the
   profile wizard, Leave) are unchanged (Phase B handover #3).
4. `bundle-budget` is red on `main` too: dancer-app is 374.1 KB on main vs a 374 KB budget (374.3 here).
5. `/code-review` was not run by this worker.
