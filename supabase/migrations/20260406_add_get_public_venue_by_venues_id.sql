create or replace function get_public_venue_by_venues_id(p_venue_id uuid)
returns json
language sql
stable
security definer
as $$
  select json_build_object(
    'id',               v.id,
    'entity_id',        v.entity_id,
    'name',             v.name,
    'address',          v.address,
    'postcode',         v.postcode,
    'country',          v.country,
    'timezone',         v.timezone,
    'image_url',        v.photo_url,
    'gallery_urls',     v.gallery_urls,
    'description',      v.description,
    'capacity',         v.capacity,
    'floor_type',       v.floor_type,
    'facilities',       v.facilities,
    'facilities_new',   v.facilities_new,
    'opening_hours',    v.opening_hours,
    'google_maps_url',  v.google_maps_url,
    'google_maps_link', v.google_maps_link,
    'website',          v.website,
    'instagram',        v.instagram,
    'phone',            v.phone,
    'email',            v.email,
    'transport',        v.transport,
    'transport_json',   v.transport_json,
    'parking',          v.parking,
    'parking_json',     v.parking_json,
    'faq_json',         v.faq_json,
    'bar_available',    v.bar_available,
    'cloakroom_available', v.cloakroom_available,
    'id_required',      v.id_required,
    'accessibility',    v.accessibility
  )
  from venues v
  where v.id = p_venue_id;
$$;

grant execute on function get_public_venue_by_venues_id(uuid) to anon, authenticated;
