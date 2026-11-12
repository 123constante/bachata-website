# People arc P2 mockups -- handover

- Branch: `claude/people-arc-mockups` (from `main` 7ba1c6a). Content commit: `4a2bf34`; the head is the
  handover commit right after it (`git log -1 origin/claude/people-arc-mockups`).
- Brief: `briefs/PEOPLE-P2-mockups-brief.md` on `brief/people-arc` (sha 5fbc6393).
- No product code changed. Everything is under `docs/people-arc/mockups/`.

## What is here
| File | What |
|---|---|
| `data.md` | Step 1: prod counts per role (dates, photos), the real people used |
| `BRIEF.md` | Step 2: five lines per screen |
| `a.html` `b.html` `c.html` | Step 3: the three directions, standalone; `?view=page&shape=..&tab=..`, `?view=tile`, `?view=og`, no query = all frames |
| `gallery.html` | Side by side per shape, pitch + trade-offs, the fact-source table, the self-check table |
| `shots/` | 48 PNGs: 3 directions x 7 shape/tab pages x 2 widths, plus wall tiles and link previews |
| `src/` | `facts.js` (the one shared mapping), `ui.js`, `dir-*.js`, `build.mjs`, `capture.mjs` (screens + checks) |

Rebuild: `node docs/people-arc/mockups/src/build.mjs && node docs/people-arc/mockups/src/capture.mjs && node docs/people-arc/mockups/src/build.mjs`.

## The three directions
- **A: Name card**. A compact identity card, a segmented tab bar, plain lists.
- **B: Role poster**. A full-width hero in the role colour, underline tabs, 3-column date tiles.
- **C: Next date first**. A slim name strip, pill tabs, the next gig or class as the hero block.

## Shapes covered
| Shape | Covered | Note |
|---|---|---|
| 1 Thin dancer-only, no photo (Magda) | yes | |
| 2 Teacher-only, no photo (Pierre Henry) | yes | Also has no city, so it is the thinnest real page |
| 3 DJ-only with 2+ upcoming gigs | **substituted** | None exists on prod. Used Papacito (DJ + dancer, 2 gigs), so it has a tab row |
| 4 All three roles, rich (Ramiro Zapata), each tab | yes | |
| 5 Long name (Sabrina Guzman Pastor, 21 chars) | yes | |
| Teacher-only WITH an upcoming class | not as its own shape | The Ramiro teacher tab shows the class layout |
| Real photos | no | The image hosts are unreachable from the sandbox, so photos are a striped stand-in |

## Self-checks (all 14 page renders per direction, 390x844 and 360x800)
| Direction | Lowest contrast | Taps >= 44 | Clipping | Sideways scroll | Action on every page | Tab row only for 2+ roles |
|---|---|---|---|---|---|---|
| A | 5.71 | pass | pass | pass | pass | pass |
| B | 6.09 | pass | pass | pass | pass | pass |
| C | 5.72 | pass | pass | pass | pass | pass |

The wall tile and link-preview views were checked by eye only.

## Open questions for the owner
1. Which direction: A (Name card), B (Role poster) or C (Next date first)? Or a mix, such as B's hero with
   C's next-date block?
2. One name for every tab: Papacito's DJ name is "Morcilla". Should the DJ tab show the DJ name, with the
   real name under it, or should every tab show one name?
3. The dancer tab has no calendar content at all (0 dancer dates on prod). Is "dance role + languages +
   country + a link to this week's socials" enough, or should the dancer tab show something else?
4. The "Classes / Parties this week" button on pages with no dates goes to the calendar. Should it be
   filtered to the person's city, and what should it say when there is no city (Pierre Henry)?

## Verified / Not verified
- Verified: prod counts (read-only SELECT); all renders and self-checks run in Chromium at both widths;
  no non-ASCII characters in any file.
- Not verified: real photos; real phones; the live site; Vercel preview (this is a docs-only folder);
  the DJ-name column (question 2).
