# Event Aggregate — Frontend Migration Plan

> Generated from locked backend aggregate direction.
> Date: 2026-03-20

---

## A. Exact Frontend Aggregate State Model

### Aggregate Root

```
events (uuid PK)
```

### Owned Child Domains

| Child Table             | Relationship            | Notes                                      |
|-------------------------|-------------------------|--------------------------------------------|
| `event_occurrences`     | `event_id → events.id`  | Replaces `calendar_occurrences`             |
| `event_organisers`      | `event_id → events.id`  | Replaces `event_entities` WHERE role='organiser' and `events.organiser_ids` |
| `event_lineup`          | `event_id → events.id`  | Replaces `events.teacher_ids`, `events.dj_ids`, `event_entities` WHERE role IN ('teacher','dj','videographer','vendor') |
| `event_guest_dancers`   | `event_id → events.id`  | Replaces ad-hoc dancers embedded in lineup  |

### Canonical Frontend Aggregate Type

```typescript
// src/modules/event-admin/types.ts  (new file)

type EventAggregate = {
  event: {
    id: string;
    name: string;
    description: string | null;
    date: string;                     // YYYY-MM-DD
    venueId: string | null;
    citySlug: string | null;
    coverImageUrl: string | null;
    ticketUrl: string | null;
    websiteUrl: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    paymentMethods: string | null;
    keyTimes: {
      classes: { active: boolean; start: string | null; end: string | null };
      party: { active: boolean; start: string | null; end: string | null };
    };
    isPublished: boolean;
    createdBy: string;
    type: string | null;
    timezone: string | null;
  };
  occurrences: EventOccurrence[];
  organisers: EventOrganiser[];
  lineup: EventLineupEntry[];
  guestDancers: EventGuestDancer[];
};

type EventOccurrence = {
  id: string | null;                  // null = new
  instanceStart: string;              // ISO 8601
  instanceEnd: string | null;
  lifecycleStatus: string;            // 'active' | 'cancelled'
};

type EventOrganiser = {
  id: string | null;                  // null = new
  entityId: string;                   // FK → entities.id
  isPrimary: boolean;
  sortOrder: number;
};

type EventLineupEntry = {
  id: string | null;                  // null = new
  personId: string;                   // FK → teacher_profiles.id | dj_profiles.id | etc.
  personType: 'teacher' | 'dj' | 'videographer' | 'vendor';
  sortOrder: number;
  occurrenceId: string | null;        // null = event-level
};

type EventGuestDancer = {
  id: string | null;                  // null = new
  dancerId: string;                   // FK → dancers.id
  sortOrder: number;
  occurrenceId: string | null;        // null = event-level
};
```

This is the **single authoritative shape** for all admin event operations.

---

## B. Exact Snapshot/Save Contract Usage

### B1. Read Contracts

| RPC                                | Caller                    | Purpose                | Frontend Consumer                |
|------------------------------------|---------------------------|------------------------|----------------------------------|
| `admin_get_event_snapshot(uuid)`   | Admin edit page            | Full aggregate for editing | New `useAdminEventSnapshot` hook |
| `get_event_page_snapshot(uuid, uuid?)` | Public event page      | Public read projection | Existing `useEventPageQuery`     |

**admin_get_event_snapshot** must return the full `EventAggregate` shape:

```
{
  event: { ... },
  occurrences: [ ... ],
  organisers: [ ... ],
  lineup: [ ... ],
  guest_dancers: [ ... ]
}
```

The frontend will parse this into `EventAggregate` using a strict normalizer (same pattern as the existing `parseEventPageSnapshot`).

**get_event_page_snapshot** is already consumed by the rebuilt Event Page pipeline. No change to its contract. The Event Page does NOT read child tables directly — the backend flattens everything into the snapshot projection.

### B2. Write Contract

| RPC                       | Caller              | Purpose              | Frontend Consumer              |
|---------------------------|----------------------|----------------------|-------------------------------|
| `admin_save_event(Json)`  | Admin create/edit    | Atomic aggregate save | New `useAdminSaveEvent` hook  |

**admin_save_event** accepts the full aggregate as a single JSON payload:

```typescript
const payload: AdminSaveEventPayload = {
  event: { ... },                // all scalar fields
  occurrences: [ ... ],          // full list (UPSERT semantic)
  organisers: [ ... ],           // full list (UPSERT semantic)
  lineup: [ ... ],               // full list (UPSERT semantic)
  guest_dancers: [ ... ],        // full list (UPSERT semantic)
};

supabase.rpc('admin_save_event', { p_payload: payload });
```

The RPC is already declared in generated types (`admin_save_event: { Args: { p_payload: Json }; Returns: Json }`). The frontend must now actually call it.

**admin_get_event_snapshot** is NOT yet declared in generated types. It must be deployed to backend and types must be regenerated before the admin edit page migration begins.

### B3. Contract Mapping Summary

| Frontend Operation          | Old Path (RETIRE)                              | New Path (AGGREGATE)                     |
|-----------------------------|-------------------------------------------------|------------------------------------------|
| Create event                | `supabase.from('events').insert(...)` directly   | `supabase.rpc('admin_save_event', {...})` |
| Edit event — read           | `supabase.from('events').select('*').eq('id',x)` | `supabase.rpc('admin_get_event_snapshot', {p_event_id: x})` |
| Edit event — save           | `supabase.from('events').update(...)` directly   | `supabase.rpc('admin_save_event', {...})` |
| Public event page — read    | `get_event_page_snapshot` RPC (already done)     | No change                                |
| RSVP toggle                 | Direct `event_attendance` insert/delete          | No change (stays direct table write)     |
| Interest toggle             | Direct `event_participants` upsert/delete        | No change (stays direct table write)     |

---

## C. Exact Per-Screen Migration Plan

### C1. CreateEvent (`src/pages/CreateEvent.tsx`)

**Current state:**
- Direct `supabase.from('events').insert(eventData)` on line 184
- Only writes to `events` table
- No organiser, lineup, occurrence, or guest dancer creation
- No teacher/DJ association
- Venue is selected from a flat venue list (no entity linkage)

**Migration:**

1. Create `src/modules/event-admin/types.ts` containing `EventAggregate` and child types.
2. Create `src/modules/event-admin/useAdminSaveEvent.ts`:
   - Wraps `supabase.rpc('admin_save_event', { p_payload })`.
   - Accepts `EventAggregate`.
   - Returns the saved event ID on success.
3. Create `src/modules/event-admin/buildAdminSavePayload.ts`:
   - Transforms `EventAggregate` form state → `AdminSaveEventPayload` JSON (snake_case, server-ready).
4. Rewrite `CreateEvent.tsx`:
   - Replace direct `events` table insert with `useAdminSaveEvent` hook.
   - Form state becomes `EventAggregate` — the aggregate is always the unit of work.
   - Occurrences section: generate initial occurrence from date + key_times.
   - Organisers section: allow selecting/creating organiser entities.
   - Lineup section: allow adding teachers, DJs (by search/claim).
   - Guest dancers section: optional, add if form UI is ready.
   - All child domain additions are part of the same save payload — no separate writes.
5. Remove: direct `supabase.from('events').insert(...)`.
6. Remove: all `class_start`, `class_end`, `party_start`, `party_end` as top-level event fields — these now derive from occurrences or `key_times`.

**Backend prerequisite:** `admin_save_event` must accept the full aggregate payload shape including occurrences, organisers, lineup, and guest_dancers arrays.

### C2. EditEvent (`src/pages/EditEvent.tsx`)

**Current state:**
- Reads event via `supabase.from('events').select('*').eq('id', id)` on line 83
- Writes via `supabase.from('events').update(eventPayload).eq('id', id)` on line 196
- Has NO access to occurrences, organisers, lineup, or guest dancers
- Uses `eventData.class_start` / `eventData.party_start` etc. with `as any` casts (line 127-130)

**Migration:**

1. Create `src/modules/event-admin/useAdminEventSnapshot.ts`:
   - Calls `supabase.rpc('admin_get_event_snapshot', { p_event_id })`.
   - Parses response into `EventAggregate`.
   - Strict normalizer (same pattern as `parseEventPageSnapshot`).
2. Rewrite `EditEvent.tsx`:
   - Replace `supabase.from('events').select('*')` read with `useAdminEventSnapshot`.
   - Form state populates from the full `EventAggregate`.
   - All child domains (occurrences, organisers, lineup, guest_dancers) are editable.
   - Replace `supabase.from('events').update(...)` write with `useAdminSaveEvent`.
   - Pass the complete `EventAggregate` to save — the backend reconciles diffs atomically.
3. Remove: direct `events` table read and write.
4. Remove: `as any` casts for class_start / party_start fields.

**Backend prerequisite:** `admin_get_event_snapshot` must be deployed, returning the full aggregate. Types must be regenerated.

### C3. Event Page (`src/pages/EventDetail.tsx` + `src/modules/event-page/*`)

**Current state:** Already rebuilt against `get_event_page_snapshot`. Strict pipeline: fetch → validate → build render model → render sections.

**Migration:** None required.

The Event Page is a **read-only projection**. It does not need to know about the aggregate write model. The backend already projects the aggregate into the snapshot shape. The frontend snapshot types (`EventPageSnapshot`) remain as-is.

**Conditional concern:** If `get_event_page_snapshot` backend implementation is updated to read from new child tables (`event_occurrences`, `event_lineup`, etc.) instead of old sources (`calendar_occurrences`, `events.teacher_ids`), the frontend is unaffected as long as the snapshot JSON contract is unchanged.

### C4. OrganiserDashboard (`src/components/profile/OrganiserDashboard.tsx`)

**Current state:**
- Queries `event_entities` directly (line 62) to list events by organiser entity
- Queries `events` directly (line 76) to get event details

**Migration:**
- **Phase 2** (after admin save is stable): Replace `event_entities` queries with queries against `event_organisers` table.
- The organiser dashboard is a read path, not a write path. It does not call `admin_save_event`.
- When `event_organisers` table is the authoritative source, change the query FROM clause only.

### C5. ProfileEventTimeline (`src/components/profile/ProfileEventTimeline.tsx`)

**Current state:**
- Queries `events` directly (line 52)
- Queries `event_entities` (line 59) to filter by person
- Uses `teacher_ids` array contains filter (line 71)

**Migration:**
- **Phase 2**: Replace `events.teacher_ids` contains filter with `event_lineup` join.
- Replace `event_entities` query with `event_organisers` and `event_lineup` joins as appropriate.

### C6. DancerDashboard / FestivalHub / FestivalDetail / VenueEntity / Organisers Page / DiscountPartners

These all query `events` table directly for listing/display. They do NOT write.

**Migration:** Phase 3. These are read-only listing views. They remain stable during Phase 1 and Phase 2. When the backend migrates data from `events.teacher_ids` / `events.dj_ids` to the child tables and drops the old columns, queries here must be updated to use joins through `event_lineup` / `event_organisers`.

---

## D. Exact Legacy Frontend Logic to Retire

### D1. RETIRE — Direct `events` Table Writes

| File | Line | Operation | Retirement |
|------|------|-----------|------------|
| `src/pages/CreateEvent.tsx` | 184 | `supabase.from('events').insert(eventData)` | Replace with `admin_save_event` RPC |
| `src/pages/EditEvent.tsx` | 196 | `supabase.from('events').update(eventPayload).eq('id', id)` | Replace with `admin_save_event` RPC |

### D2. RETIRE — Direct `events` Table Read for Editing

| File | Line | Operation | Retirement |
|------|------|-----------|------------|
| `src/pages/EditEvent.tsx` | 83 | `supabase.from('events').select('*').eq('id', id)` | Replace with `admin_get_event_snapshot` RPC |

### D3. RETIRE — Old Event Form Fields

| Pattern | Location | Retirement |
|---------|----------|------------|
| `class_start`, `class_end`, `party_start`, `party_end` as top-level form fields | CreateEvent.tsx, EditEvent.tsx | Derive from occurrences or key_times within the aggregate |
| `as any` casts for these fields | EditEvent.tsx lines 127-130 | Eliminated when full aggregate type is used |

### D4. RETIRE — Legacy UUID Array Lineup References

| Pattern | Location | Retirement |
|---------|----------|------------|
| `events.teacher_ids` array filter | ProfileEventTimeline.tsx line 71 | Replace with `event_lineup` join |
| `events.dj_ids` in generated types (column reads) | Any future direct column access | Column becomes deprecated once `event_lineup` is authoritative |
| `events.organiser_ids` in generated types | Any future direct column access | Column becomes deprecated once `event_organisers` is authoritative |

### D5. RETIRE — Legacy Junction Table References

| Pattern | Location | Retirement |
|---------|----------|------------|
| `event_entities` WHERE role='organiser' | OrganiserDashboard.tsx line 62 | Replace with `event_organisers` join |
| `event_entities` for event-person links | ProfileEventTimeline.tsx line 59 | Replace with `event_lineup` / `event_organisers` joins |

### D6. RETIRE — Old RPC Declarations (generated types cleanup)

| RPC | Status | Action |
|-----|--------|--------|
| `get_event_page_detail` | Unused by frontend src | Drop from backend when ready; types auto-clean on regeneration |
| `get_public_event_detail` | Unused by frontend src | Drop from backend when ready; types auto-clean on regeneration |
| `get_event_detail` | Unused by frontend src | Drop from backend when ready; types auto-clean on regeneration |
| `get_event_profile_connections` | Unused by admin save flow | Evaluate; may still serve other use cases |

### D7. RETIRE — Old Types File

| File | Status | Action |
|------|--------|--------|
| `src/types/supabase.ts` | Stale duplicate of `src/integrations/supabase/types.ts` | Delete after confirming no imports reference it |

---

## E. Exact Phase-by-Phase Rollout

### Phase 0 — Backend Prerequisites (BLOCKING)

| Step | Owner | Deliverable |
|------|-------|-------------|
| 0.1 | Backend | Deploy `admin_get_event_snapshot(p_event_id uuid)` returning full aggregate JSON |
| 0.2 | Backend | Ensure `admin_save_event(p_payload Json)` accepts full aggregate payload (occurrences, organisers, lineup, guest_dancers) |
| 0.3 | Backend | Fix `get_event_page_snapshot` — resolve `ee.is_primary` column error (42703) so Event Page unblocks |
| 0.4 | Backend | Deploy new child tables (`event_occurrences`, `event_organisers`, `event_lineup`, `event_guest_dancers`) if not already live |
| 0.5 | Frontend | Regenerate `src/integrations/supabase/types.ts` after 0.1–0.4 are deployed |

**Phase 0 gate:** Frontend must not begin Phase 1 until `admin_get_event_snapshot` appears in regenerated types and returns valid JSON for at least one test event.

### Phase 1 — Admin Aggregate Pipeline (Create + Edit)

| Step | File | Change |
|------|------|--------|
| 1.1 | `src/modules/event-admin/types.ts` | Create `EventAggregate`, `EventOccurrence`, `EventOrganiser`, `EventLineupEntry`, `EventGuestDancer`, `AdminSaveEventPayload` |
| 1.2 | `src/modules/event-admin/useAdminEventSnapshot.ts` | Create hook: call `admin_get_event_snapshot`, parse into `EventAggregate` |
| 1.3 | `src/modules/event-admin/useAdminSaveEvent.ts` | Create hook: call `admin_save_event`, accept `EventAggregate`, return event ID |
| 1.4 | `src/modules/event-admin/buildAdminSavePayload.ts` | Create mapper: `EventAggregate` → snake_case JSON payload |
| 1.5 | `src/modules/event-admin/parseAdminSnapshot.ts` | Create normalizer: raw JSON → `EventAggregate` (strict, same style as `parseEventPageSnapshot`) |
| 1.6 | `src/pages/CreateEvent.tsx` | Rewrite: form state is `EventAggregate`, save calls `useAdminSaveEvent` |
| 1.7 | `src/pages/EditEvent.tsx` | Rewrite: read via `useAdminEventSnapshot`, save via `useAdminSaveEvent` |
| 1.8 | Run `npm run lint` + `npm run test:unit` | Validate |

**Phase 1 gate:** CreateEvent and EditEvent successfully create and edit events using only the admin RPCs. No direct table writes remain in these files.

### Phase 2 — Profile/Dashboard Read Paths

| Step | File | Change |
|------|------|--------|
| 2.1 | `src/components/profile/OrganiserDashboard.tsx` | Replace `event_entities` query with `event_organisers` query |
| 2.2 | `src/components/profile/ProfileEventTimeline.tsx` | Replace `teacher_ids` contains filter with `event_lineup` join; replace `event_entities` with `event_organisers`/`event_lineup` |
| 2.3 | Run lint + unit tests | Validate |

**Phase 2 gate:** OrganiserDashboard and ProfileEventTimeline read exclusively from aggregate child tables.

### Phase 3 — Remaining Listing Pages

| Step | File | Change |
|------|------|--------|
| 3.1 | `src/hooks/useFestivalEvents.ts` | If it filters by teacher/DJ arrays, update to join through `event_lineup` |
| 3.2 | `src/pages/FestivalHub.tsx` | Same as above if applicable |
| 3.3 | `src/pages/FestivalDetail.tsx` | Same as above if applicable |
| 3.4 | `src/components/profile/DancerDashboard.tsx` | Update event queries if they reference old `events` columns being dropped |
| 3.5 | `src/pages/VenueEntity.tsx` | Update if referencing deprecated columns |
| 3.6 | `src/pages/Organisers.tsx` | Update if referencing deprecated columns |
| 3.7 | Run lint + unit tests + E2E smoke | Validate |

**Phase 3 gate:** No remaining frontend code references `events.teacher_ids`, `events.dj_ids`, `events.organiser_ids`, or `event_entities` for event-person relationships.

### Phase 4 — Cleanup

| Step | Action |
|------|--------|
| 4.1 | Delete `src/types/supabase.ts` (stale duplicate) |
| 4.2 | Regenerate `src/integrations/supabase/types.ts` after backend drops old RPCs |
| 4.3 | Remove old migration SQL files from docs if desired |
| 4.4 | Archive `docs/event-profile-graph-phases.md` and related old plans |
| 4.5 | Run full E2E suite: `npm run test:e2e:all` |

---

## F. Exact Synchronization Rules with Backend

### F1. Type Regeneration Protocol

1. After every backend RPC deploy, frontend runs `npx supabase gen types typescript --project-id stsdtacfauprzrdebmzg > src/integrations/supabase/types.ts`.
2. Frontend verifies the new RPC appears in `Database['public']['Functions']`.
3. Frontend runs `npx tsc --noEmit` to confirm no type breakage.
4. Only then does frontend begin consuming the new RPC.

### F2. Snapshot Contract Stability Rule

- `get_event_page_snapshot` JSON keys must NOT change without coordinated frontend + backend PR.
- Any key rename or structural change in the snapshot breaks the strict parser in `useEventPageQuery.ts`.
- The parser will throw a hard error, which surfaces as "Unable to Load Event." This is by design — silent shape drift is worse.

### F3. Admin Aggregate Contract Stability Rule

- `admin_save_event` payload schema must match `EventAggregate` exactly.
- `admin_get_event_snapshot` return schema must match `EventAggregate` exactly.
- Any new child domain (e.g., `event_sponsors`) requires:
  1. Backend deploys updated RPCs.
  2. Frontend regenerates types.
  3. Frontend adds the new child array to `EventAggregate`.
  4. Frontend adds form UI for the new child domain.
  5. Coordinated release.

### F4. Dual-Write Transition Period

During the transition where old tables (`event_entities`, `events.teacher_ids`) and new tables (`event_organisers`, `event_lineup`) coexist:

- Backend `admin_save_event` must dual-write: populate BOTH old and new tables.
- Backend `get_event_page_snapshot` should read from new tables when available, fall back to old.
- Frontend relies only on RPC contracts — it NEVER reads old tables directly after Phase 1.
- Frontend NEVER writes to old tables after Phase 1.

### F5. Phase Gate Verification

Before each phase gate:

1. Run `npm run lint` — zero errors.
2. Run `npm run test:unit` — all pass.
3. Run `npm run test:e2e` — smoke subset passes.
4. Manually verify one event create + edit flow end-to-end.
5. Verify Event Page still renders for an existing published event.

---

## G. Professional Recommendation

### Do First (This Week)

1. **Fix the P0 backend blocker.** `get_event_page_snapshot` on project `stsdtacfauprzrdebmzg` still returns `42703: column ee.is_primary does not exist`. The entire Event Page is dead until this is resolved. This is Phase 0, Step 0.3.

2. **Deploy `admin_get_event_snapshot`.** Without this RPC, the admin edit page migration cannot begin. This is Phase 0, Step 0.1.

3. **Confirm `admin_save_event` aggregate payload support.** The RPC signature exists but its implementation scope is unknown. Backend must confirm it accepts the full payload shape including all four child arrays. This is Phase 0, Step 0.2.

### Do NOT Do

- Do not patch `CreateEvent.tsx` or `EditEvent.tsx` incrementally. The aggregate model is the target — partial patches create drift.
- Do not add organiser/lineup selection UI to the existing form without switching to `admin_save_event`. Adding UI that writes child domains through direct table inserts would create a second parallel write path.
- Do not refactor `event_entities` references in profile dashboards until Phase 2. Keep Phase 1 focused on the admin write path.
- Do not drop old columns (`teacher_ids`, `dj_ids`, `organiser_ids`) from the backend until Phase 3 is complete and verified.

### Architecture Principle

The aggregate boundary means:

- **One write entry point** for all event mutations: `admin_save_event`.
- **One read entry point** for admin editing: `admin_get_event_snapshot`.
- **One read entry point** for public display: `get_event_page_snapshot`.
- **No direct child table writes** from the frontend except for attendance (which is a separate bounded context).
- **The frontend never reconstructs the aggregate from multiple table reads.** The backend always provides the fully joined aggregate or snapshot.

This eliminates the current failure mode where `CreateEvent.tsx` writes to `events` but has no mechanism to write organisers, lineup, or occurrences — leaving events permanently incomplete.
