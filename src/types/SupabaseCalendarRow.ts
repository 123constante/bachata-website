export interface SupabaseCalendarRow {
  id: string;
  event_id: string;
  name?: string | null;
  instance_start: string;
  instance_end: string | null;
  local_date: string | null;
  timezone: string | null;
  has_class: boolean | null;
  has_party: boolean | null;
  is_cancelled: boolean | null;
  type: string | null;
  location: string | null;
  venue_id: string | null;
  venue_name: string | null;
  city_slug: string | null;
  photo_url: string[] | null;
  cover_image_url: string | null;
  event?: {
    id: string;
    name: string | null;
    venue_id: string | null;
    venue?: {
      entities?: {
        name: string | null;
      } | null;
    } | null;
  } | null;
}
