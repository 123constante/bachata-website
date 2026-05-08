-- Dummy venue for design preview. Applied to remote DB 2026-05-08 as
-- dummy_design_preview_venue_v2. Local record only — data already exists.

DO $$
DECLARE
  v_entity_id uuid := 'eeeeeeee-eeee-eeee-eeee-000000000001';
  v_venue_id  uuid := '11111111-1111-1111-1111-111111111111';
  v_city_id   uuid := 'dc8417b8-489c-4e67-87ad-4e0e35b45d06';
  v_user_id   uuid;
  v_photo_url text;
  v_ev1 uuid; v_ev2 uuid; v_ev3 uuid; v_ev4 uuid; v_ev5 uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  SELECT photo_url[1] INTO v_photo_url
    FROM public.venues
    WHERE photo_url IS NOT NULL AND array_length(photo_url, 1) > 0
      AND id != v_venue_id
    LIMIT 1;

  -- Entity
  INSERT INTO public.entities (id, type, created_at)
    VALUES (v_entity_id, 'venue', now())
    ON CONFLICT (id) DO NOTHING;

  -- Venue
  INSERT INTO public.venues (
    id, entity_id, name, address, postcode, country,
    description, photo_url,
    facilities_new, bar_available, cloakroom_available, id_required,
    capacity, floor_type,
    transport_json, parking_json, parking_cost_notes,
    opening_hours, google_maps_link, faq_json,
    publish_state, user_id
  ) VALUES (
    v_venue_id, v_entity_id,
    '— Design Preview Venue —',
    '458 Brixton Road', 'SW9 8EN', 'GB',
    'A spacious sprung-floor dance studio in the heart of Brixton with professional sound, full lighting rig, and an in-house bar. Hosts classes and socials every night of the week. Changing rooms are on the lower ground floor. Fully wheelchair accessible via the main entrance.',
    ARRAY[COALESCE(v_photo_url, 'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=800')],
    ARRAY['mirrors','sound_system','changing_area','wifi','wheelchair_access','air_conditioning','drinking_water','bottle_refill','kitchen','snacks_available','late_train_friendly'],
    true, true, true,
    250, 'sprung',
    '{"nearest_stations":[{"station":"Brixton","line_names":["Victoria","Overground"],"walking_distance_minutes":5}]}'::jsonb,
    '{"parking_available":true,"nearby_parking_notes":"NCP multi-storey on Stockwell Road 8 min walk. Street parking free after 21:00 on Coldharbour Lane. Cycle racks at the front entrance."}'::jsonb,
    'NCP rate 4 GBP/hr. Street parking free from 21:00.',
    '{"monday":{"open":"10:00","close":"22:00"},"tuesday":{"open":"10:00","close":"22:00"},"wednesday":{"open":"10:00","close":"22:00"},"thursday":{"open":"10:00","close":"22:00"},"friday":{"open":"10:00","close":"02:00"},"saturday":{"open":"12:00","close":"03:00"},"sunday":{"isOpen":false}}'::jsonb,
    'https://maps.google.com/?q=458+Brixton+Road+London+SW9+8EN',
    '[{"q":"Is there parking?","a":"Yes, NCP on Stockwell Road and free street parking from 21:00."},{"q":"What is the dress code?","a":"Smart casual. No trainers or sportswear."},{"q":"Can I bring my own food?","a":"No outside food. Snacks and drinks available at the bar."}]'::jsonb,
    'dancer_ready', v_user_id
  ) ON CONFLICT (id) DO NOTHING;

  -- Events (5 upcoming, staggered 7/14/21/35/50 days from now)
  v_ev1 := gen_random_uuid();
  v_ev2 := gen_random_uuid();
  v_ev3 := gen_random_uuid();
  v_ev4 := gen_random_uuid();
  v_ev5 := gen_random_uuid();

  INSERT INTO public.events (id, name, type, venue_id, city_id, city_slug, country, is_active, user_id)
  VALUES
    (v_ev1, 'Friday Night Social', 'party',    v_venue_id, v_city_id, 'london-gb', 'GB', true, v_user_id),
    (v_ev2, 'Bachata Footwork Lab', 'class',   v_venue_id, v_city_id, 'london-gb', 'GB', true, v_user_id),
    (v_ev3, 'Salsa Saturday',       'party',   v_venue_id, v_city_id, 'london-gb', 'GB', true, v_user_id),
    (v_ev4, 'Latin Summer Festival','festival',v_venue_id, v_city_id, 'london-gb', 'GB', true, v_user_id),
    (v_ev5, 'Sensual Styling Class', 'class',  v_venue_id, v_city_id, 'london-gb', 'GB', true, v_user_id);

  INSERT INTO public.calendar_occurrences (event_id, instance_start, instance_end, is_override)
  VALUES
    (v_ev1, now() + interval '7 days',  now() + interval '7 days'  + interval '4 hours', false),
    (v_ev2, now() + interval '14 days', now() + interval '14 days' + interval '2 hours', false),
    (v_ev3, now() + interval '21 days', now() + interval '21 days' + interval '4 hours', false),
    (v_ev4, now() + interval '35 days', now() + interval '35 days' + interval '8 hours', false),
    (v_ev5, now() + interval '50 days', now() + interval '50 days' + interval '2 hours', false);

END $$;
