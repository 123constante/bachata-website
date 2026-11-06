# Handover 2026-10-30: P3 create-event BUILD, slice 1

Branch `claude/p3-create-event-build`. Brief: `brief/p3-create-event-build-1:docs/briefs/p3-create-event-build-1.md`.
Inventory: [`docs/design/p3-create-event/BUILD-INVENTORY.md`](../design/p3-create-event/BUILD-INVENTORY.md)
(71 rows: 63 from the design inventory plus 8 added; all 71 accounted for. BUILT 30, DEFERRED-slice-2 18, DEFERRED-needs-admin 12, EXCLUDED 11).

## Done

- New flow `src/modules/organiser/p3/new/*`, lazy, at `/account/p3/create`
  (`?at=page|form&kind=&o=`). The kind picker comes first. Course, festival and online are disabled with "Coming soon". The page picker shows only with 2+ pages. Then a single form: name, venue search, cover, first date or dates, repeat rule, sessions, price basics and how people pay. Save draft or Go live.
- The R1 bridge (`NEW_STEPS`) is removed.
  - Old `new/what` and `new/name` redirect to the new flow and keep `o` and the format.
  - Old `new/:id/*` redirects to that event's page.
- `P3_SURFACE.newWhat`/`newWhatFor` point at the new flow, which fixes Welcome's "Add an event". `AddEventLink` (Home, Events) points there too.
- Save order, all through `series_command_p5`, one idempotency key per step, each step chained on the last `new_version`:
  1. Cover upload.
  2. `series.upsert` create (draft, no series time).
  3. `series.set_recurrence`, using the P3 `rulePayload`.
  4. `series.add_date`, once per extra date.
  5. `series.set_program`, which carries the sessions.
  6. Optional `lifecycle live`.
- If a step fails after the create, the screen says "Not saved yet: ..." with Try again (only the remaining steps), Open the draft, and Discard it (archive).
- Two review rounds were run, and every finding is fixed as an edit with a failing-first test (`review1.test.tsx`, `review2.test.tsx`). The fixes to round-2 findings have not been reviewed.

## Risks / facts for the next worker

- **Times live on sessions only.** Materialise fills a date's times from the series default time. `set_program` derives that time from the sessions, and on a draft it re-times future dates. So the dates come out right only if step 5 lands. If it fails, the failure screen names "the sessions".
- **Go live needs `payment_methods`.** Prod has 0 of 758 series with it. The new flow asks for it in Price.
- **There is no onboarding gate screen on main.** A refusal shows the existing `ONBOARDING_REFUSAL` copy and links to `p3StartReview(page)`. The `organiser_onboarding_gate` flag is off on prod.
- **Venue "not found"** offers "Skip for now" and "Open Help". Creating a venue is slice 2.
- **The Repeat sheet has no live date preview**, because a dry run needs an existing series. It shows the rule in words, the 29th&ndash;31st warning and the 30-date note.
- **R1 `flows/new` P3-only branches are now dead in P3.** They are left in place for a clean-up PR.
- **Phone walk follow-up:** the blank form's sticky footer plus the tab bar take about 240px of 844px. Not changed.
- **Name hint:** the input allows 140 characters but the hint says 120. Past 120 the form shows an error, which is the same pattern as DateFieldSheets.

## DEFERRED for slice 2 (no DB change needed)

#2 Course, #3 Festival, #10 Description, #13 New venue (`owner_create_venue_draft_v1`), #14 Co-hosts,
#16 Gallery, #17 Video links, #33 Dates taken off, #34 Course length, #35 Festival days, #39 Line-up,
#40 Rooms (pick existing), #45 Sell tickets here, #46 Music styles, #51 Group chat, #52 Instagram,
#59 Copy / duplicate, #64 Slug, #70 Template.

## DEFERRED, needs admin first

#6 Online (`livestream_url` owner key), #26 Every weekday except last (owner rule arm), #40 Define rooms
(`series.set_rooms` owner kind), #47 Age, #48 Dress code, #49 Capacity, #50 Teaching language (columns),
#53 Website/Facebook/TikTok (owner keys), #54 Guest list, #55 Raffle (owner commands), #56 Promo codes
(owner key), #71 Festival meta (owner key).

## Next steps

1. Owner phone test of `/account/p3/create`. The screenshots are in `docs/design/p3-create-event/walk/`.
2. Slice 2: course and festival kinds first (the server paths exist), then the venue create.
3. Admin asks: the 12 rows above.
