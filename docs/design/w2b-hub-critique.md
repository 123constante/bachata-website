# Design critique: W2-B person hub (PR #947), Design Gate stage 5

Reviewer: a fresh worker (not the builder), ticket dt_6a53cc3c9770. Written BEFORE any edit, from the branch head
cf5dc7be, the builder's pictures in `docs/mockups/w2b-hub/`, the approved S12 mock (`claude/s12-hub`,
`S12Hub.tsx`, views hub-roger / hub-gatica / hub-pierre) and new measurements at 360, 390 and 430 px wide (scratch
harness, same fixtures as `harness-main.tsx.txt` plus a timeline that arrives 800 ms after mount, like prod).

Who is looking: a newcomer to the London scene, on a phone, who just tapped a face on the wall. On prod (orchestrator
survey 2026-10-22) teacher pages are closed, so the commonest hubs are: **dancer only** (one card), **dancer +
hidden teacher** (one card, plus a "Teacher" chip in the header), **DJ + dancer** (two cards). 62 teacher-only
people get no hub (404 rule, tiles keep their role-page link).

Severity: **blocker** = wrong or broken for a visitor; **should** = a newcomer notices and it costs trust or a tap;
**nice** = polish. Verdict: **fixed here**, **not a bug**, or **owner call** (changes an owner decision, needs a new
read, or adds the organiser card / level fact; recommendation given, no code).

## Ordered fix list

| # | Finding | Why it matters to a newcomer | Severity | Verdict |
|---|---|---|---|---|
| 1 | **Cards swap places after first paint.** For a DJ with a gig and another role, the first paint shows Dancer then DJ; ~800 ms later (when the gig list arrives) the DJ card jumps to the top and the next-event button pushes everything down. Measured at 390x844: dancer card top 280 -> 433 px (153 px), DJ card 367 -> 346 px, layout-shift score 0.021; DJ-only with a gig: card 280 -> 346 px (0.014). It happens **also when the visitor came from the wall**, although the wall already knew the gig date. | The visitor reaches for the first card and taps the other one: they land on the wrong page and do not know why. | should | **fixed here** for the main path (from the wall: no new read; the hub reuses the wall's own badges answer, already in memory, to order the cards and keep the button's place on first paint). Direct loads (search, shared link) still move: **owner call**, see O1. |
| 2 | **"WHAT BACHATA DOES"** as the cards heading for a person with no public real name and 2+ cards (the placeholder name "Bachata Calendar profile" is split for its first word). Seen in the harness: DJ Nova, DJ + dancer. | Nonsense words on the page; reads as a bug. | should | **fixed here**: "What they do" when there is no real name. |
| 3 | **The flag sticker covers the initials.** The hub passes the face size (112) to the sticker, so it is 52x35 px (57x42 box) and overlaps the initials by 297 px&sup2; ("R") to 572 px&sup2; ("CC"). The approved S12 mock sizes it from half the face (about 26 px wide). | The face is the first thing the eye hits; half of it is a flag. With a photo it covers the person's head. | should | **fixed here**: sticker sized like the mock (half the face), 0 px&sup2; overlap. |
| 4 | **Thin pages end in a cold void.** On the commonest shape (one card) the warm base stops 64 px under the card, then ~750 px of the cooler site ground, then the orange footer (`on-dancer-real.png`). | Looks like the page did not finish loading; the warm, social feel stops halfway down the first screen. | should | **fixed here**: the warm base fills at least the first screen, then fades out above the footer as before. |
| 5 | **Chip order and card order differ.** Header chips use the ONE vocabulary order (Teacher, DJ, Dancer); cards use the lead order (DJ with a gig, Dancer, DJ, Teacher). 3-role picture: chips "Teacher DJ Dancer", cards "DJ Dancer Teacher". | Two orders for the same three words side by side. | nice | **owner call** (O2): both orders are owner rules (chips = same as the wall; cards = S12 lead order). |
| 6 | **"Teacher" chip with no Teacher card** while teacher pages are closed (61 prod people, e.g. dancer + teacher: chip "Teacher", one Dancer card). | The header says they teach, the cards do not show where. Not a dead link (the chip is plain text, as on the wall). | nice | **not a bug** (the ONE mapping shows the tag as text while pages are closed, same as the wall); noted for O2. |
| 7 | **One-card hubs.** Dancer-only (and dancer + hidden teacher) hubs are a header plus one card labelled "THEIR PAGE" that repeats the header's chip. | It is an extra tap before the real page; the hub still earns its place (face, facts, Back), but only just. | nice | **owner call** (O3); not removed, as the brief says. |
| 8 | **"Back" on a direct load goes to /dancers**, a page the visitor never saw (no same-site referrer). | Mildly surprising, never a dead end. The label cannot change by referrer without a hydration mismatch. | nice | **not a bug** (brief rule: history back, else /dancers). |
| 9 | **Card copy is generic** ("Their dancer page", "Their DJ page") where the mock said what is there ("DJ sets and music", "Classes and workshops"). | A newcomer learns little from "their page", but every line is true. The mock's lines promise content a page may not have. | nice | **not a bug**; kept. |
| 10 | **Years dancing shows twice** (facts strip and Dancer card line). | Repetition, not wrong. Same as the mock. | nice | **not a bug**. |
| 11 | **Header chips are small** (10 px text, 15 px tall) beside 15 px body text. | Readable (contrast 7+), but quiet; they are the wall's chips, by design the same everywhere. | nice | **not a bug** (shared wall component). |
| 12 | **Footer seam**: dark ground meets the orange footer with a hard edge. | Site-wide footer, same on every page. | nice | **not a bug** (not this PR). |
| 13 | **Heading keeps "DJ"** ("DJ Rogelio") while the wall tile shows "Rogelio". | The chip already says DJ; but the DJ page heading also shows the full stage name, and the brief says reuse `nameFor`. | nice | **not a bug** (brief rule). |

Found during the fix pass (self-review of fix #1, not in the builder's code): with the wall's date known but the gig
list read FAILING, the not-yet-a-link gold box would stay forever. Fixed in the same pass (a failed read = no gigs, the
box goes), red first.

## Checks with nothing to fix (measured on cf5dc7be)
- **Hierarchy:** face + name first, then the gold next-event button (only with a gig), then the cards. Matches S12.
- **Name heading + sub-name:** one h1; stage name leads for a DJ with the real name under it; long names wrap at 360
  (no ellipsis, no sideways scroll: scrollWidth = viewport at 360 / 390 / 430).
- **Tap targets:** Back 63x44, next-event 341x52, cards 370x77 (390 wide). All >= 44.
- **Focus ring:** 2 px `#FBEBDD` outline, offset 2, on Back, the button and every card (FOCUS_RING, the wall's).
- **Contrast:** lowest text 6.41 (muted name on the card); chip text on chip colours >= 7.
- **Nothing points at a control that is not on screen:** no "next event" text without the button; no card without a
  real href; teacher card absent while pages are closed.
- **Wording vs the wall:** chip words are the ONE mapping (Teacher / DJ / Dancer), same as the wall chips.
- **Seams:** hub ground fades in and out of the site ground (max one-row step 1/255); header card and role cards are
  outlined cards on the warm base, as the mock.

## Owner calls (recommendations; no code)
- **O1. Direct loads still reorder the cards** (search result or shared link, DJ with a gig and another role).
  Recommend: put the next gig date in the page loader (the badges read already has `dj_has_upcoming` /
  `next_gig_date`; calling it once for this one id is a new read on this page, so not done here). Alternative with
  no read: always put the DJ card first for a DJ-led person (the header already leads with the stage name and gold
  face); that changes the approved "dancer before a DJ without gigs" order.
- **O2. One order for chips and cards?** Recommend keeping both as they are (chips match the wall everywhere), or, if
  you want them to match on the hub, sort the hub's chips by card order (hub only).
- **O3. One-card hub.** Recommend keeping it (face, facts, Back, and the same place for everyone), and later making the
  single card a bigger "Open <name>'s dancer page" button. Not removed.
- Organiser card and a "level" fact still need one more public read each (builder's look-at item 3, unchanged).
