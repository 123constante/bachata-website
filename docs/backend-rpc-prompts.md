# Backend RPC Prompts (City-Aware Event System)

Purpose: These prompts instruct the backend AI to create Supabase RPCs that replace direct table reads on the frontend. Each RPC standardizes access to event data, enforces city filtering, and returns the exact shapes the frontend now expects.

How to use:
- Copy each prompt and run it with your backend AI.
- Each prompt explains the required inputs, outputs, and filtering rules.
- After the RPCs are created, deploy and test the frontend.

General constraints for all RPCs:
- Respect RLS and existing visibility rules.
- Public reads should only return published events where appropriate.
- If a city filter is provided, it must be applied consistently.
- Prefer returning explicit fields over "select *" to keep payloads stable.

---

## Prompt 1: Event Detail RPC

Goal:
Provide a single RPC that returns the full event detail payload so the frontend does not need multiple queries to events, venues, or event_entities.

Required inputs:
- p_event_id (uuid): the event ID.

Required output:
Return a single JSON object with these keys:
- event: full event row (id, name, date, description, cover_image_url, photo_url, key_times, meta_data, class_start, class_end, social_start, social_end, created_by, is_published, venue_id, location)
- venue: full venue row for event.venue_id (or null if none)
- organisers: array of entities linked in event_entities with role = 'organiser'
- teachers: array of entities linked in event_entities with role = 'teacher'
- djs: array of entities linked in event_entities with role = 'dj'
- venue_entity: single entity linked in event_entities with role = 'venue' (or null)

Behavior:
- If p_event_id does not exist, return a null event or raise an error.
- If the event is not published, the RPC should still return it if the caller has access; otherwise return an error or empty result per current policy.

Prompt to backend AI:
"""
Create a Supabase SQL RPC named get_event_detail(p_event_id uuid) that returns a JSON object with:
- event: full row from events (include id, name, date, description, cover_image_url, photo_url, key_times, meta_data, class_start, class_end, social_start, social_end, created_by, is_published, venue_id, location)
- venue: row from venues for event.venue_id (or null)
- organisers: array of entities linked in event_entities for role='organiser'
- teachers: array of entities linked in event_entities for role='teacher'
- djs: array of entities linked in event_entities for role='dj'
- venue_entity: the entity linked in event_entities for role='venue' (or null)
Return a single JSON payload with those keys.
Ensure RLS/permissions allow public read of published events and related entities.
"""

---

## Prompt 2: Entity Events RPC

Goal:
Provide a single RPC to list events associated with an entity (organiser/teacher/dj) so dashboards and profiles do not need direct joins.

Required inputs:
- p_entity_id (uuid): entity ID
- p_role (text): one of 'organiser', 'teacher', 'dj'
- p_city_slug (text, optional): active city filter

Required output:
Return an array of event objects with these fields:
- id
- name
- date
- is_published
- location
- cover_image_url
- photo_url

Behavior:
- If p_city_slug is provided, only return events for that city.
- Order by date ascending.
- If p_role does not match expected roles, return empty list.

Prompt to backend AI:
"""
Create a Supabase SQL RPC named get_entity_events(p_entity_id uuid, p_role text, p_city_slug text default null) that returns events linked in event_entities by entity_id + role.
Return fields per event:
- id, name, date, is_published, location, cover_image_url, photo_url
If p_city_slug is provided, only return events in that city (events.city_slug or events.city if mapped).
Order by date ascending.
"""

---

## Prompt 3: Venue Events RPC

Goal:
Provide venue-specific event lists so venue pages do not read the events table directly.

Required inputs:
- p_venue_id (uuid): venue ID
- p_city_slug (text, optional): active city filter

Required output:
Return an array of event objects with these fields:
- id
- name
- date
- is_published
- location

Behavior:
- Only return published events.
- If p_city_slug is provided, apply the city filter.
- Order by date descending, limit 10.

Prompt to backend AI:
"""
Create a Supabase SQL RPC named get_venue_events(p_venue_id uuid, p_city_slug text default null) that returns events for a venue.
Return fields: id, name, date, is_published, location
Filter is_published = true
If p_city_slug is provided, apply city filter (events.city_slug or events.city if mapped)
Order by date desc, limit 10
"""

---

## Prompt 4: Participant Events RPC

Goal:
Provide event lists for the logged-in user based on event_participants without exposing joins in the client.

Required inputs:
- p_user_id (uuid): user ID
- p_city_slug (text, optional): active city filter

Required output:
Return an array of participant rows with:
- status
- event_id
- event_name
- event_date
- location
- cover_image_url

Behavior:
- Filter by user_id.
- If p_city_slug is provided, apply the city filter.

Prompt to backend AI:
"""
Create a Supabase SQL RPC named get_user_participant_events(p_user_id uuid, p_city_slug text default null) that returns rows from event_participants joined to events.
Return fields:
- status
- event_id
- event_name
- event_date
- location
- cover_image_url
Filter by user_id = p_user_id
If p_city_slug is provided, apply city filter (events.city_slug or events.city if mapped)
"""

---

## Prompt 5: Discount Partners RPC

Goal:
Return organisers with their next upcoming event so the Discount Partners section can be city-aware without client-side joins.

Required inputs:
- p_city_slug (text, optional): active city filter

Required output:
Return an array of organisers with:
- id, name, photo_url, city, instagram
- nextEvent: { name, date } for the organiser's next upcoming published event

Behavior:
- Use event_entities (role='organiser') to link organisers to events.
- Only consider upcoming published events.
- If p_city_slug is provided, apply the city filter.
- Sort organisers so those with nextEvent appear first.

Prompt to backend AI:
"""
Create a Supabase SQL RPC named get_discount_partners_with_next_event(p_city_slug text default null).
Return array of organisers with:
- id, name, photo_url, city, instagram
- nextEvent: { name, date } for the organiser's next upcoming published event
Use event_entities (role='organiser') to link organisers to events.
If p_city_slug is provided, only consider events in that city.
Sort organisers so those with a nextEvent appear first.
"""

---

## Prompt 6: Organiser Event Counts RPC

Goal:
Return event counts per organiser for the organiser directory without client-side joins.

Required inputs:
- p_city_slug (text, optional): active city filter

Required output:
Return an array of rows with:
- entity_id
- event_count

Behavior:
- Count only published events.
- If p_city_slug is provided, apply city filter.

Prompt to backend AI:
"""
Create a Supabase SQL RPC named get_organiser_event_counts(p_city_slug text default null).
Return rows with: entity_id, event_count.
Count published events linked to organisers.
If p_city_slug is provided, apply city filter.
"""

---

## Prompt 7: Venue Detail RPC

Goal:
Provide a single RPC that returns venue details for the venue page without direct table reads.

Required inputs:
- p_venue_id (uuid): venue ID

Required output:
Return a single venue object including fields used by the frontend:
- id, name, city, address, description, photo_url, capacity, transport, parking
- google_maps_url, phone, email, website, instagram, facebook
- facilities, floor_type, opening_hours, gallery_urls, rules

Behavior:
- If p_venue_id does not exist, return null or raise an error.

Prompt to backend AI:
"""
Create a Supabase SQL RPC named get_venue_detail(p_venue_id uuid) that returns a single venue row with:
id, name, city, address, description, photo_url, capacity, transport, parking,
google_maps_url, phone, email, website, instagram, facebook,
facilities, floor_type, opening_hours, gallery_urls, rules.
Return null or error if p_venue_id is invalid.
"""

---

Notes:
- If your schema uses events.city_slug, apply the filter on that. If not, map events.city to cities.slug or cities.name as appropriate.
- If you need RLS exceptions for these RPCs, use security definer carefully and limit exposure to published data.
