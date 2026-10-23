# PR #924 W2-A people wall: independent design critique (Design Gate stage 5, 2026-10-22)

Reviewer: a fresh worker, not the builder (ticket dt_7082432fddd9, brief `W2A-critique-brief.md` 450768fd).
Written BEFORE any edit, from: `docs/design/924.md`, `docs/handover/w2a-wall.md`, every picture in
`docs/mockups/w2a-wall/` (looked at), the code at head a1b655b7, and my own production build (flag ON, PROD
reads, `stsdtacfauprzrdebmzg`) measured at 360 / 390 / 430 x 844.

Visitor: a newcomer to London bachata, on a phone. Feel: warm and social. Owner decisions NOT reopened:
today's hero unchanged, the order (hero -> pills -> 4-column wall -> rest of page), the pill set
(All / Dancers / DJs / Teachers + Organisers link), Teachers = coming soon, Organisers = link.

## Measured before (head a1b655b7, prod reads)

| Width | Page | Pill row(s) | Pill height | First tile top |
|---|---|---|---|---|
| 360 | /dancers, /djs | All, Dancers, DJs, Teachers / **Organisers alone on row 2** | 40 | 592 / 418 |
| 390 | /dancers, /djs | All, Dancers, DJs, Teachers / **Organisers alone on row 2** | 40 | 594 / 419 |
| 430 | /dancers, /djs | one row | 40 | 550 / 374 |

Pill widths at 390 (px): All 47, Dancers 83, DJs 54, Teachers 89, Organisers 100; gap 6.75 (`gap-2` is rem:
the site's ~13.5px root). Room inside the wall's padding: 370. One row needs 400, so it wraps by 30px.

## Ordered fix list

| # | Finding | Why it matters to a newcomer | Severity | Verdict |
|---|---|---|---|---|
| 1 | Filter pills, the Organisers link and the coming-soon "Browse DJs / Browse dancers" buttons are 40px tall (`SIZE.filterHeight = 40`), under the 44px tap target. | These are the first controls under the hero and the main way to narrow the wall; a 40px pill on a phone gets mis-tapped (neighbour pill, or the tile row under it). | blocker | **fixed here**: 44px (`SIZE.filterHeight`), plus a 44px minimum width so "All" is not a 44-tall sliver. |
| 2 | At 390 (the common phone) the pill row wraps and Organisers sits ALONE on a second row (`on-dancers-pills.png`, `on-djs-top.png`). With 44px pills that second row costs ~51px before the first face, and a lone pill reads like an orphan / a different section. | The wall already starts low on /dancers (594px); a second pill row pushes faces further down for the one control that leaves the page. The row also looks unfinished. | should | **fixed here**: pills tightened (side padding 14 -> 10px, gap 6px in px, not rem) so all five fit ONE row at 390 and 430. At 360 the row still wraps, Organisers alone on row 2: accepted (it is the one control that navigates away; a sideways-scroll row would hide it off-screen at 360, worse for a newcomer). Text stays 13px bold, contrast unchanged. |
| 3 | Teachers pill says "Teachers are coming soon" while the wall right above it shows "Teacher" chips on many faces (on /djs most tiles: Daniel Carbonero, Jeff, Magic Spike...). | The sentence contradicts what the visitor can see: there ARE teachers on the wall. What is coming is the teacher pages / filter, not the teachers. Confusing copy erodes trust. | should | **fixed here** (wording only; the coming-soon behaviour, buttons and pill set are unchanged): "Teacher pages are coming soon. Meanwhile, browse DJs and dancers." |
| 4 | Large empty band (~64px) between the /dancers hero's last card (Book a Photoshoot) and the pills; on /djs ~40px under the subtitle. | Dead space on the first screen pushes the faces into the bottom third on /dancers. | nice | **owner call** (it is the hero's own bottom padding; the hero is owner-locked). Recommendation: with the flag ON, trim the hero's bottom padding by ~40px so the first face row lifts into view. |
| 5 | The Organisers link is styled exactly like the in-place filter pills, but it leaves the page. | A newcomer expects a pill to filter; landing on another page is a small surprise. The destination is what the label says, so the harm is small. | nice | **owner call**. Recommendation: a small trailing chevron on Organisers. Not done here: it adds ~12px and would re-break the one-row fit at 390 (item 2). |
| 6 | The decorative light circle top-left on every initials tile (from the S10 mockup) reads at 86px like a ghost button / a missing photo. | Mild visual noise on 44 of 94 /dancers tiles; nothing breaks. | nice | **owner call** (approved S10 look). Recommendation: drop the circle, keep the diagonal texture. |
| 7 | Uneven row heights: tiles with three chips (Teacher DJ / Dancer) wrap to two chip lines, so rows differ by ~18px. | Slight rhythm wobble, but the chips are the social signal; truncating them would hide roles. | nice | not a bug (owner chose full-word chips; documented in the handover "One mapping"). |
| 8 | "DJ" vs "DJs" wording. | Could look inconsistent. | - | **not a bug**: pills are plural group names (All / Dancers / DJs / Teachers), chips are one person's role (Dancer / DJ / Teacher), same rule for every role; the hero says "Bachata DJs". |
| 9 | Colour seams: hero -> pills, pills -> wall, wall -> Your Plans (/dancers), wall -> footer ground (/djs). | A hard line reads as two glued pages. | - | **not a bug** at head: soft (max step 1-3 per row, `seam-after-390.txt`), pills -> tiles is one surface. Re-checked after this pass (the pills grow 4px and the pill row shrinks, so the fade zone is re-measured). |
| 10 | Chip and name legibility. | 10px chips / 11px names are small. | - | **not a bug**: bold, explicit px (not rem), contrast >= 4.5 asserted in `wallContrast.test.tsx`; names max 2 lines, 0 clipped (report). |
| 11 | Hierarchy: what the eye hits first. | - | - | **not a bug**: hero title, then the cream selected "All" pill, then the faces. The low wall on /dancers is item 4 (owner call). |
| 12 | Empty / coming-soon states; anything pointing at a control that is not on screen. | Copy that names an absent control strands the visitor. | - | **not a bug**: the coming-soon sentence sits directly above its two buttons; "match this filter. Show everyone" is inline; the empty wall links to "what is on this week" in the sentence. |
| 13 | Focus ring. | Keyboard / switch users. | - | **not a bug**: 2px `#FBEBDD` outline, offset 2, on pills, the link, tiles and the coming-soon buttons (R2). |

Out of scope by brief: the hero itself, the order, the pill set, Teachers coming-soon, the Organisers link.
