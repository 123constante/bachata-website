# Brief: swap the waving flag for the Sticker style (PR #740)

Branch `feat/people-nationality-flags`, open PR #740, head before this brief `0f43ee36afd58acee99460edd1d390e0d6bfa888`. Push ONE commit to this branch. Do not open a new PR. If the head moved, say so.

## Context
PR #740 puts a small nationality flag on every person photo (15 surfaces). One shared component `src/components/people/NationalityFlag.tsx` plus `PersonAvatar.tsx`, the rule in `nationality.ts`, artwork in `flagArt.ts`, the surface x shape matrix test, the phone spec `tests/e2e-phone/people-nationality-flag.phone.spec.ts`, and the handover `docs/session-handover-2026-10-12-people-nationality-flags.md`. All CI was green on 0f43ee3; /djs showed 10 flags and /teachers 14 on prod data.

## Owner decision (2026-10-13)
THE OWNER REJECTED THE WAVING FLAG and picked the **Sticker** style. Keep ALL data wiring, the surface list, the rule (a code shows a flag; null, empty, non-code, private-use and Kosovo show nothing), the aria-label `Nationality: <country>` and title, `pointer-events: none`, the inline offline SVG artwork and the matrix test. Change ONLY the drawing and its motion.

## Sticker spec (port faithfully; it is style F of the owner's mockup)
- A static flag in true 3:2 proportion.
- Width = 46% of the photo diameter, minimum 20px.
- Position `top: -6%`, `right: -14%` of the photo box. Rotate 9deg. Border radius 3px.
- 2px WHITE edge: `box-shadow: 0 0 0 2px #fff, 0 3px 8px rgba(0,0,0,.6)`.
- NO pole, NO gold cap, NO cloth shading, NO ripple, NO animation of any kind: no requestAnimationFrame, no IntersectionObserver, no shared clock. Reduced motion needs no special case.
- Artwork stays plain 30x20 SVG with `preserveAspectRatio` slice.

## Remove
Delete `flagWave.ts`, `flagClock.ts`, `flagClock.test.ts`, the Silk-maths cases in `nationalityFlag.unit.test.ts`, and dead code. Remove every mention of Silk / waving / pole from comments, docs and the PR body. Keep the flag out of first load as in 0f43ee3. Re-measure `check:bundle-budget`; if `/parties` and `/classes` are back under 320 KB, REVERT the `perf-budgets.json` 321 KB bump and its note.

## Risks to prove (the sticker sticks OUT of the photo by 14% right and 6% top)
1. For each of the 15 surfaces, in the phone spec at 390x844 and 360x640 on prod-shaped data: assert the sticker's rect is fully inside the viewport and NOT clipped by any ancestor with overflow hidden/auto/clip (walk ancestors, compare rects), and does not overlap the person's name or a neighbouring photo's sticker. Fix with padding, or the existing "inset" placement for card photos that sit flush to a card edge (search cards, festival frames, videographer and all-profiles images).
2. 20px (vendor team) and 40px (list rows) circles: the 20px minimum sticker must still show stripes and cover no more than the corner. If a surface is too small, say so in the PR rather than hide it.
3. Owner pencil/remove on a photo (organiser `PhotoSlot`) stays bottom-right and does not overlap the sticker (elementFromPoint at the control).
4. The badge never blocks taps on the photo.
5. Update the matrix test for the new markup so the same fact reads the same on every surface.

## Gates
Run every CI job step you can locally (read `.github/workflows`), the pre-push chain once, push ONCE. Update the PR #740 title (drop waving wording) and body: new design, what was removed, clipping/overlap NUMBERS, `## Phone QA`, and `Verified / Not verified` (real phone NOT verified). Replace the screenshots under `docs/screenshots/nationality-flags/` (390x844 and 360x640). Update the handover doc.

## Report
Head SHA, CI per job, test counts, measured clipping for all 15 surfaces, screenshots, bundle-budget numbers, Verified / Not verified.
