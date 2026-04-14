import { supabase } from './client';

// ============================================================================
// Types for RPC 1: get_calendar_events
// ============================================================================

export interface CalendarEventRow {
  event_id: string;
  name: string;
  photo_url: string[];
  location: string;
  instance_date: string; // 'YYYY-MM-DD' in event timezone
  start_time: string; // ISO8601 timestamptz
  end_time: string | null; // ISO8601 timestamptz
  is_recurring: boolean;
  meta_data: Record<string, any>;
  key_times?: Record<string, any>;
  has_class: boolean;
  has_party: boolean;
  class_start: string | null;
  class_end: string | null;
  party_start: string | null;
  party_end: string | null;
  type: 'standard' | 'festival' | string;
  city_slug: string | null;
}

export interface GetCalendarEventsParams {
  range_start: string; // ISO8601
  range_end: string; // ISO8601
  city_slug_param?: string | null; // optional, omit for all cities
}

// ============================================================================
// Types for RPC 2: get_event_page_snapshot_v2
// ============================================================================

export interface EventPerson {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_primary?: boolean;
}

export interface EventLineup {
  teachers?: EventPerson[];
  djs?: EventPerson[];
  dancers?: EventPerson[];
  vendors?: EventPerson[];
  mcs?: EventPerson[];
  performers?: EventPerson[];
  videographers?: EventPerson[];
}

export interface Occurrence {
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  local_date: string;
  lineup: EventLineup;
}

export interface EventActions {
  website_url?: string | null;
  ticket_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
}

export interface KeyTimes {
  classes?: {
    active: boolean;
    start: string | null;
    end: string | null;
  };
  party?: {
    active: boolean;
    start: string | null;
    end: string | null;
  };
}

export interface EventSnapshot {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  photo_urls: string[] | null;
  music_styles: string[] | null;
  type: 'standard' | 'festival' | string;
  is_recurring: boolean;
  actions: EventActions;
  key_times?: KeyTimes;
  meta_data_public?: Record<string, any>;
}

export interface Venue {
  name: string;
  address_line: string | null;
  google_maps_link: string | null;
  image_url: string | null;
}

export interface City {
  id: string;
  name: string;
  slug: string;
}

export interface LocationDefault {
  venue?: Venue;
  city?: City;
}

export interface EventPageSnapshot {
  event: EventSnapshot;
  organisers: EventPerson[];
  occurrence_effective: Occurrence;
  occurrences: Occurrence[];
  location_default: LocationDefault;
}

export interface GetEventPageSnapshotParams {
  p_event_id: string;
  p_occurrence_id?: string | null;
}

// ============================================================================
// Types for RPC 3: get_public_festival_detail
// ============================================================================

export interface FestivalIdentity {
  name: string;
  description: string | null;
  edition: string | null;
  is_qualifier: boolean;
  features: string[] | null;
  languages: string[] | null;
  dress_code: string | null;
  livestream_url: string | null;
  aftermovie_url: string | null;
  tiktok_url: string | null;
  poster_url: string | null; // Festival poster (NOT cover_image_url)
  gallery_urls: string[] | null;
  music_styles: string[] | null;
  age_restriction: string | null;
}

export interface FestivalDates {
  starts_at: string;
  ends_at: string;
  local_start: string;
  local_end: string;
  timezone: string;
}

export interface FestivalLinks {
  website?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  ticket_url?: string | null;
  whatsapp_link?: string | null;
  volunteer_url?: string | null;
  code_of_conduct_url?: string | null;
}

export interface FestivalPrimaryVenue {
  id: string;
  name: string;
  address: string | null;
  image_url: string | null;
}

export interface FestivalLocation {
  city?: City;
  primary_venue?: FestivalPrimaryVenue;
}

export interface FestivalScheduleItem {
  day: string;
  start_time: string;
  end_time: string;
  title: string;
  type: string;
  teachers?: EventPerson[];
  djs?: EventPerson[];
}

export interface FestivalCompetition {
  name: string;
  style: string;
  judges?: EventPerson[];
}

export interface FestivalPass {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  type: string | null;
  tier: number | null;
  available_until: string | null;
}

export interface FestivalVenue {
  id: string;
  name: string;
  address: string | null;
  is_primary: boolean;
}

export interface FestivalHotel {
  name: string;
  stars: number | null;
  address: string | null;
  distance_text: string | null;
  booking_url: string | null;
  price_from: number | null;
  currency: string | null;
  amenities: string[] | null;
}

export interface FestivalPromoCode {
  code: string;
  discount_value: number | null;
  discount_type: string | null;
}

export interface FestivalPublish {
  has_code_of_conduct: boolean;
  code_of_conduct_url?: string | null;
  has_volunteer_info: boolean;
  volunteer_url?: string | null;
  press_media_contact_name?: string | null;
  press_media_contact_email?: string | null;
}

export interface FestivalDetail {
  identity: FestivalIdentity;
  dates: FestivalDates;
  links: FestivalLinks;
  location: FestivalLocation;
  organiser: EventPerson;
  lineup: EventLineup;
  guest_dancers: EventPerson[] | null;
  schedule: FestivalScheduleItem[] | null;
  competitions: FestivalCompetition[] | null;
  passes: FestivalPass[] | null;
  venues: FestivalVenue[] | null;
  hotels: FestivalHotel[] | null;
  travel: Record<string, any> | null;
  promo_codes: FestivalPromoCode[] | null;
  publish: FestivalPublish;
}

export interface GetPublicFestivalDetailParams {
  p_event_id: string;
}

// ============================================================================
// RPC Utilities
// ============================================================================

/**
 * RPC 1: Fetch calendar events for a date range
 * Returns one row per occurrence. For festivals, returns ONE ROW PER DAY.
 */
export async function getCalendarEvents(
  params: GetCalendarEventsParams,
): Promise<CalendarEventRow[]> {
  const { data, error } = await supabase.rpc('get_calendar_events', {
    range_start: params.range_start,
    range_end: params.range_end,
    city_slug_param: params.city_slug_param,
  });

  if (error) {
    console.error('getCalendarEvents RPC error:', error);
    throw error;
  }

  return (data as CalendarEventRow[]) || [];
}

/**
 * RPC 2: Fetch event detail page snapshot
 * Works for both standard events and festivals. Can optionally specify an occurrence.
 */
export async function getEventPageSnapshot(
  params: GetEventPageSnapshotParams,
): Promise<EventPageSnapshot | null> {
  const { data, error } = await supabase.rpc('get_event_page_snapshot_v2', {
    p_event_id: params.p_event_id,
    p_occurrence_id: params.p_occurrence_id,
  });

  if (error) {
    console.error('getEventPageSnapshot RPC error:', error);
    throw error;
  }

  return (data as EventPageSnapshot) || null;
}

/**
 * RPC 3: Fetch festival-specific details
 * Call in PARALLEL with getEventPageSnapshot for festival events.
 * Returns null for standard events — use this to detect event type.
 */
export async function getPublicFestivalDetail(
  params: GetPublicFestivalDetailParams,
): Promise<FestivalDetail | null> {
  const { data, error } = await supabase.rpc('get_public_festival_detail', {
    p_event_id: params.p_event_id,
  });

  if (error) {
    console.error('getPublicFestivalDetail RPC error:', error);
    throw error;
  }

  return (data as FestivalDetail) || null;
}

/**
 * Helper: Fetch event page snapshot and festival detail in parallel
 * Automatically detects event type from festival result (null = standard)
 */
export async function getEventDetailWithFestival(
  eventId: string,
  occurrenceId?: string | null,
): Promise<{
  snapshot: EventPageSnapshot | null;
  festival: FestivalDetail | null;
}> {
  const [snapshot, festival] = await Promise.all([
    getEventPageSnapshot({ p_event_id: eventId, p_occurrence_id: occurrenceId }),
    getPublicFestivalDetail({ p_event_id: eventId }),
  ]);

  return { snapshot, festival };
}
