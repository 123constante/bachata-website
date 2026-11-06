# Design record &mdash; organiser public page P1

Branch `claude/organiser-page-p1`. Contract: `docs/organiser-page/ACCEPTANCE.md`
(sections cited as A1, A5 ... below) and `INVENTORY.md`. Brief:
`docs/briefs/organiser-page-p1.md` (branch `brief/organiser-page-p1`).
OP = `src/pages/OrganiserProfile.tsx` on this branch.

## Step 0 &mdash; coverage table

| Row | Slice | Where (this branch) | Status |
|---|---|---|---|
| A1 Hero unchanged | S1 | OP hero block (only the dead Verified badge removed) | handled |
| A1 Order hero > stats > Get in touch > Team > About > Next > Past | S1 | OP render, comment "S1 order" | handled |
| A1 Get in touch rows | S2 | `OrganiserGetInTouch.tsx` `buildContactRows` | handled |
| A1 Team plain list, no roles | S3 | `OrganiserTeamSection.tsx`; OP `buildOrganiserTeam` memo | handled (listed people only; owners/managers parked) |
| A1 Stats first 3 that qualify | S1 | `OrganiserStatsStrip.tsx`; OP `organiserStats` memo | handled (tickets / dancers inputs null: not read yet) |
| A1 Owner-only prompts never for visitors | S1 | OP owner-blank gated by `canEdit`; "Not added" only in EIP | handled |
| A1 PARKED gallery/address/map | &mdash; | not read | parked (owner) |
| A1 Later: share link, owner counts | &mdash; | &mdash; | parked (later slice) |
| J1 upcoming / 100+ / past-only / none | S1+S4 copy | OP Next nights, Recently hosted, `NO_DATES_ANNOUNCED` | handled |
| J1 another city / beyond +365 d (E4/E5) | S4 | &mdash; | parked: admin RPC ticket |
| J1 P3/P4 create-event link | edit layer | EIP slots kept beside headings | unchanged |
| J2 WhatsApp / Instagram / Website / Email, Copy | S2 | `OrganiserGetInTouch.tsx` | handled |
| J2 Facebook only | S2 | `buildContactRows` has no Facebook row | handled (E2 by decision) |
| J2 nothing public | S2 | section returns null | handled |
| J2 clipboard missing | S2 | OP `copyValue` toast | handled (unchanged helper) |
| J2 contact RPC fails (E9) | S2 | `fetchPublicContactOrThrow`; `org-contact-error` | handled |
| J3 listed 1 / 2-3, links, no roles | S3 | `OrganiserTeamSection.tsx` | handled |
| J3 owner with no dancer profile | S3 | mapping supports it; access = [] today | parked (needs admin RPC) |
| J3 hidden person | S3 | page reads `is_active = true` only; mapping drops hidden | handled for listed |
| J3 About only if written | S1 | OP About `(ep.bio \|\| eip)` | handled |
| J3 team read fails | S5 | `org-feed-error-team` | handled |
| J4 past 5+ / 1-4 / 0 / fails | S1+S5 | stats mapping + FeedErrorLine | handled |
| J5 share | &mdash; | &mdash; | parked (analytics arc) |
| J6 owner edits | edit layer | unchanged | unchanged, not walked (no owner login) |
| J7 hide a person | S3 write | &mdash; | parked (edit layer, later) |
| J8 claim card | &mdash; | `PublicClaimCard` unchanged | unchanged |
| State: loading | S5 | OP skeleton (no headings, no numbers) | handled |
| State: not found | S5 | OP "Organiser not found" + noindex | handled |
| State: entity read error (E8) | S5 | OP `org-entity-error`, no noindex | handled |
| State: one feed fails | S5 | per-section error line; stats get no nights | handled |
| State: every feed fails | S5 | hero + Get in touch + Team + error lines | handled |
| State: empty profile, visitor | S5 | hero + quiet line | handled |
| E1 dead Verified badge | S1 | removed (type, component, 2 uses) | handled |
| E2 Facebook | S2 | not a row | handled by decision |
| E3 fake empty on error | S5 | extended to entity + stats | handled |
| E4 city filter | S4 | &mdash; | parked: admin ticket |
| E5 365-day window | S4 | &mdash; | parked: admin ticket |
| E6 "elsewhere in London" | S4 copy | removed; copy names no city | handled |
| E7 cancelled nights | S4 | as on main (hidden) | parked: owner to confirm |
| E8 entity error vs not found | S5 | OP | handled |
| E9 contact RPC error | S2 | OP + `OrganiserGetInTouch` | handled |
| E10 0 and `--` stats | S1 | old strip deleted | handled |
| E11 role tags, owners missing | S3 | role tags gone; owners parked | handled in part |
| E12 past window two truths | S4 | unchanged (client passes 3650 d) | parked to S4 |
| E13 split rows + Online pills | S2 | one stacked list | handled |

**Coverage: 45 rows, 32 handled (2 in part), 3 unchanged by design, 10
parked with a reason; none silently omitted.**

## Chosen design

Everything below the hero sits in the page&rsquo;s existing dark token set
(`#0C0A0D` ground, cream `#F6F1EA` text, gold `#E7BE6E` labels, Cormorant
headings at 16 px, Manrope body at 14 px), compact density (`px-3`/`py-3`
bands, `gap-3`), every tap target 44 px in explicit px.

- **Stats strip**: an equal-column grid of 1-3 tiles (value 22 px serif,
  label 11 px gold caps). "Next night" scrolls to Next nights. No tile ever
  renders without a qualifying value; no strip when none qualify.
- **Get in touch**: one stacked list, a 44 px icon tile + label + value as one
  link, a 44 px Copy button at the row end. The contact-error line sits under
  the rows.
- **Team**: a 3-column grid of 64 px circles with the name under each, no
  role text; above 6 people a "+N more" toggle.
- **Nights**: "Next nights" (unchanged list mechanics); when nothing is
  upcoming the past list is titled "Recently hosted" and carries one quiet
  line "No dates announced yet." with the Browse link; with no nights at all
  that line stands alone.

### Alternatives considered

1. **Stats as pills under the hero name.** Saves a band, but puts new content
   inside the hero, which the owner froze. Rejected.
2. **Get in touch as a 2x2 icon grid.** Denser, but four icon-only tiles lose
   the value (number, handle, domain) the visitor wants to check before
   tapping, and Copy would need a long-press. Rejected.

Why: the chosen layout keeps the hero frozen, shows the actual value on every
contact row, and reuses the page&rsquo;s own tokens so no new visual language
lands in a code-only slice. The lead decides look and feel at the Design Gate.
