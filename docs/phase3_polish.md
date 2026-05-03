# Phase 3 Polish — Section F: Schedule Renderer Unification

> Branch: `phase3-polish`  
> Status: **complete** — all sub-items shipped.

---

## F.1 — Person Discoverability Rollout

_Commit `526642d` · 2026-04-30_

### F.1.a — PersonChip rollout across 3 public surfaces
Converted `EventLineupSection`, `FestivalLineupSection`, and
`EventGuestDancersSection` to route instructor/DJ/performer display through
`PersonChip` (size=`lg`, layout=`stacked`). Each surface fires
`emitProfileView` on click with a per-surface context label and gets the
44 px hit area plus dim-on-unlinked behaviour for free. `eventId` threaded
from `EventPageScreen` into all three.

### F.1.b — chip-overlap variant on PeopleStack
New opt-in variant: overlapping circles with a single tap-target that opens a
popover (or mobile bottom sheet at <640 px). Handles Esc, click-outside,
focus-on-open, and focus-return-to-trigger-on-close. Use only where density is
the hard constraint and individual navigation can live one tap deeper.

### F.1.c — no-bare-avatar-images ESLint rule + sweep
Custom ESLint rule (`local/no-bare-avatar-images`, WARN level) added to
`eslint.config.js`. Found 9 flags in 7 files; all resolved after F.1.a fixes.
Final allowlist documents exempt files (PersonChip/PeopleStack primitives,
profile-edit avatars, etc.).

---

## F.2 — Schedule Renderer Unification

Goal: extract the 969-line `ScheduleBlock.tsx` monolith into composable
primitives that both the standard bento block and the festival section reuse.

### F.2.a — Design tokens

_Commit `526642d` · 2026-04-30_

Created `src/modules/event-page/bento/blocks/schedule/schedule.tokens.ts`
(`SCHEDULE_TOKENS`) with canonical values for avatar sizes (sm:28, md:32,
lg:52, xl:64), gap values, time-column width, and text sizes. All slot
renderers import from this single source.

### F.2.b — SessionCell + ScheduleGrid extraction

_Commits on `phase3-polish` · 2026-05-03_

**`SessionCell.tsx`** (~260 lines) — unified single-cell renderer.

* `SessionKind` type: `'class' | 'masterclass' | 'party' | 'performance' | 'show'`
* `kindFor(type)` maps session type strings to `SessionKind`; `'social'` maps
  to `'class'` to preserve the original FestivalProgramSection behaviour.
* Three internal layouts dispatched by `isMultiRoom` + `kind`:
  * `SingleRoomContent` — pill-headline + chip-row
  * `MultiRoomClassCell` — rank chip + title + PeopleStack (`wrap-row` /
    `wrap-leveled` for Phase C per-level binding)
  * `MultiRoomPartyCell` — title + PeopleStack `vertical-feature`
* Phase C per-level binding preserved: `useLeveled = hasLevelBinding &&
  session.levels.length >= 2` → PeopleStack `variant='wrap-leveled'`.

**`ScheduleGrid.tsx`** (~270 lines) — matrix layout wrapper.

* Props: `{ rooms, sessions, eventId }` — `rooms.length >= 2` triggers
  multi-room matrix mode; empty / single entry = single-room column.
* Internally runs `normalize()`, `groupIntoSlots()`, `groupIntoSections()`.
* `Section` type distinguishes `'class'` and `'party'` blocks with a vertical
  rotated spine label ("Classes" / "Party").
* Room column headers rendered when `rooms.length >= 2`.
* Time column at 64 px; stripe overlay at `left: 102px` (spine + gap + time).

**`ScheduleBlock.tsx`** refactored 969 → 141 lines. Retains: data fetch
(`useProgramItems`), day-tab shell (`DayTabs`), `orderedRooms` derivation.
All rendering delegated to `ScheduleGrid`.

### F.2.c — Festival adapter (thin)

_Commits on `phase3-polish` · 2026-05-03_

`FestivalProgramSection.tsx` refactored 370 → 164 lines. Retained:
outer section chrome, day-tab strip (pink festival styling), `formatDayLabel`.
Added:
* `festivalItemToSession()` — converts `FestivalScheduleItem` → `ScheduleSession`.
  Handles `isMasterclass` flag, `venueRoom` → `room`, and proper `avatarUrl`
  pass-through (was `null` in original). Safe-cast for `FestivalSessionLevel`
  (identical string union to `SessionLevel`).
* `orderedRooms` computation for multi-venue festivals.
* Delegates all cell rendering to `<ScheduleGrid rooms={orderedRooms} sessions={daySessions} eventId={null} />`.

### F.2.d — Storybook + 8 stories

_Commits on `phase3-polish` · 2026-05-03_

**Storybook 10.3.6** installed with `react-vite` preset.
`@storybook/addon-vitest` excluded — it requires `vitest@^3.0.0` but the
project pins `vitest@1.6.1`; omitting it keeps core stories fully functional.
`vitest.config.ts` restored to its pre-init state (init had overwritten it).

**Stories:** `src/modules/event-page/bento/blocks/schedule/Schedule.stories.tsx`
**Fixtures:** `src/modules/event-page/bento/blocks/schedule/Schedule.fixtures.ts`

| # | Story name | Scenario |
|---|---|---|
| 1 | SingleRoomOnePerson | 1 room · 1 instructor |
| 2 | SingleRoomThreePeople | 1 room · 3 people (chip-row) |
| 3 | SingleRoomOverflow | 1 room · 7 people (chip-overlap "+1") |
| 4 | TwoRoomsSingleLevel | 2-room matrix · one level per session |
| 5 | TwoRoomsPerLevelBinding | 2-room matrix · Phase C per-level binding |
| 6 | ThreeRoomsMixedKinds | 3-room matrix · class + masterclass + party |
| 7 | FestivalTwoDaysTwoRooms | Festival-scale 2-room day (7 slots) |
| 8 | FestivalThreeDaysThreeRooms | Festival 3-room day + per-level bindings |

**Before/after visual parity check** — reference events used:

* _Single-room standard event_ — Story 1–3 fixtures mirror a typical single-room
  weekly bachata class; parity should be verified against any event whose
  `useProgramItems` returns sessions with `room: null` (e.g. a regular weekly
  class with one instructor pair).
* _Multi-room Phase C event_ — Story 5 (`TwoRoomsPerLevelBinding`) mirrors the
  May Day Cuban Room structure: Carlton Gibson teaches Beginners, Damarys Moreno
  teaches Intermediates in the same session slot. Parity should be verified
  against any event that has per-person level bindings in `event_program_people`.
* _Festival multi-room_ — Stories 7–8 mirror a two/three-room festival day.
  Parity should be verified against any festival event that returns
  `FestivalScheduleItem[]` with `venueRoom` set (e.g. a festival with a Latin
  Room and Cuban Room).

**CI integration:** skipped — none of the existing GitHub Actions workflows
(`architecture-guard`, `db-contract-check`, `e2e-nightly`, `e2e-smoke`) build
the frontend. `npm run build-storybook` can be added to a future frontend CI
job if introduced.

### F.2.e — Plan-observations sweep

_Commit `202fcce` · 2026-05-01_

* Deleted unused `TimeSection` component (replaced by per-row time-on-the-right
  after Phase C; only referenced in stale comments).
* Deleted dead bindings `useRoomAsHeading` (always false post-Phase-C) and
  `useTitleAsHeading` (computed but never read) inside `RankCard`.
* Moved `LEVEL_LABEL_FULL_TOOLTIP` definition above its first call site.
* Added `id` tiebreaker to session sort: `a.startMins - b.startMins || a.id.localeCompare(b.id)` — stable ordering when two sessions share a startMins.
* Empty-state check now uses `visibleSessions.length`, with distinct copy for
  "No sessions on this day" (day filter empty) vs "Schedule coming soon" (no
  schedule at all).

Visual no-op except empty-state copy refinement on multi-day events.

---

## Files changed in Section F

| File | Status | Notes |
|------|--------|-------|
| `src/.../schedule/schedule.tokens.ts` | Added | F.2.a design tokens |
| `src/.../schedule/SessionCell.tsx` | Added | F.2.b unified cell renderer |
| `src/.../schedule/ScheduleGrid.tsx` | Added | F.2.b matrix layout wrapper |
| `src/.../blocks/ScheduleBlock.tsx` | Rewritten | 969 → 141 lines |
| `src/.../sections/FestivalProgramSection.tsx` | Rewritten | 370 → 164 lines |
| `src/.../schedule/Schedule.fixtures.ts` | Added | F.2.d story fixture data |
| `src/.../schedule/Schedule.stories.tsx` | Added | F.2.d 8 Storybook stories |
| `.storybook/main.ts` | Added | Storybook config (react-vite, docs addon) |
| `.storybook/preview.ts` | Added | Storybook preview config |
