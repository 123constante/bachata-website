# Attendance Unification Plan

## Decision Summary
- Keep one event entity table: `public.events`.
- Keep one attendance table: `public.event_participants`.
- Use only two statuses: `interested`, `going`.
- Festivals are events where `events.type = 'festival'`.
- Deprecate `public.dancers.festival_plans` and migrate values into `event_participants`.

## Final Schema Recommendation

### Events
- Canonical event record remains in `public.events`.
- `type` is standardized to:
  - `festival`
  - `standard`

### Event Participants
- Canonical attendance record in `public.event_participants` with:
  - `user_id`
  - `event_id`
  - `status` (`interested` | `going`)
  - `updated_at`
- Uniqueness guarantee:
  - unique `(user_id, event_id)`
- Write strategy:
  - upsert-only for set/update attendance

## Migration Strategy
1. Normalize `events.type` values.
2. Normalize existing `event_participants.status` values to two-state model.
3. Backfill missing `updated_at`.
4. De-duplicate `(user_id, event_id)` rows with deterministic winner policy.
5. Add unique constraint and performance indexes.
6. Backfill `dancers.festival_plans` into `event_participants` as `interested`.
7. Mark `festival_plans` deprecated (comment + app write freeze).
8. Remove `festival_plans` only after rollout validation window.

## Risk Analysis
- Status downgrade risk during migration:
  - mitigated by conflict rule that preserves `going` over `interested`.
- Existing UI relying on additional statuses:
  - mitigated by normalizing all legacy values to `interested` before constraint.
- Duplicate attendance rows:
  - mitigated by dedupe pass before uniqueness enforcement.
- Breaking behavior from immediate column drop:
  - mitigated by staged deprecation first, then removal.

## Execution Order
1. Run migration: `supabase/migrations/20260221182000_unify_event_attendance.sql`.
2. Regenerate database types.
3. Update backend write paths to upsert-only attendance.
4. Remove frontend/backend writes to `festival_plans`.
5. Run reconciliation query checks.
6. After validation window, drop `festival_plans`.
