import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { safeExternalHref } from '@/lib/url';
import type {
  FestivalArtist,
  FestivalCompetition,
  FestivalDetail,
  FestivalHotel,
  FestivalPass,
  FestivalPromoCode,
  FestivalScheduleItem,
  FestivalVenue,
} from '@/modules/event-page/types';

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

type JsonRecord = Record<string, unknown>;

const asObject = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asBoolean = (value: unknown): boolean => value === true;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asStringList = (value: unknown): string[] =>
  asArray(value)
    .map((s) => asString(s))
    .filter((s): s is string => s !== null);

// ---------------------------------------------------------------------------
// Sub-parsers
// ---------------------------------------------------------------------------

const parseArtist = (raw: unknown): FestivalArtist | null => {
  const obj = asObject(raw);
  if (!obj) return null;
  const id = asString(obj.id);
  if (!id) return null;
  return { id, displayName: asString(obj.display_name), avatarUrl: asString(obj.avatar_url), href: null };
};

const parseArtists = (raw: unknown, hrefBase: string | null = null): FestivalArtist[] =>
  asArray(raw)
    .map((item) => {
      const artist = parseArtist(item);
      if (!artist) return null;
      return hrefBase ? { ...artist, href: `${hrefBase}${artist.id}` } : artist;
    })
    .filter((a): a is FestivalArtist => a !== null);

// 2026-04-27: 'open_level' added as a 5th value alongside the 4 named levels.
const ALLOWED_LEVELS = new Set<string>(['beginner','improver','intermediate','advanced','open_level']);
type LevelLiteral = 'beginner'|'improver'|'intermediate'|'advanced'|'open_level';
const parseLevels = (raw: unknown): LevelLiteral[] => {
  if (!Array.isArray(raw)) return [];
  const out: LevelLiteral[] = [];
  for (const v of raw as unknown[]) {
    if (typeof v === 'string' && ALLOWED_LEVELS.has(v)) {
      out.push(v as LevelLiteral);
    }
  }
  // Canonical order so re-renders are stable
  const order = ['beginner','improver','intermediate','advanced','open_level'] as const;
  return out.sort((a, b) => order.indexOf(a) - order.indexOf(b));
};

const parseSchedule = (raw: unknown): FestivalScheduleItem[] =>
  asArray(raw).reduce<FestivalScheduleItem[]>((acc, item) => {
    const obj = asObject(item);
    if (!obj) return acc;
    acc.push({
      id: asString(obj.id),
      day: asString(obj.day) ?? '',
      type: asString(obj.type) ?? 'class',
      title: asString(obj.title) ?? '',
      startTime: asString(obj.start_time) ?? '',
      endTime: asString(obj.end_time),
      venueRoom: asString(obj.venue_room),
      isMasterclass: asBoolean(obj.is_masterclass),
      levels: parseLevels(obj.levels),
      // RPC returns `instructors` (hydrated teacher_profiles), map to our shape
      instructors: parseArtists(obj.instructors),
      djs: parseArtists(obj.djs),
      style: asString(obj.style),
    });
    return acc;
  }, []);

const parseCompetitions = (raw: unknown): FestivalCompetition[] =>
  asArray(raw).reduce<FestivalCompetition[]>((acc, item) => {
    const obj = asObject(item);
    if (!obj) return acc;
    acc.push({
      id: asString(obj.id),
      name: asString(obj.name) ?? '',
      day: asString(obj.day),
      qualifiersTime: asString(obj.qualifiers_time),
      finalsTime: asString(obj.finals_time),
      entryFee: asNumber(obj.entry_fee),
      prizeDescription: asString(obj.prize_description),
      isQualifier: asBoolean(obj.is_qualifier),
      judges: parseArtists(obj.judges),
    });
    return acc;
  }, []);

const parsePasses = (raw: unknown): FestivalPass[] =>
  asArray(raw).reduce<FestivalPass[]>((acc, item) => {
    const obj = asObject(item);
    if (!obj) return acc;
    const id = asString(obj.id) ?? crypto.randomUUID();
    acc.push({
      id,
      name: asString(obj.name) ?? 'Pass',
      price: asNumber(obj.price) ?? 0,
      earlyBirdPrice: asNumber(obj.early_bird_price),
      currency: asString(obj.currency),
      type: asString(obj.type) ?? 'full_pass',
      tier: asString(obj.tier),
      description: asString(obj.description),
      saleEnd: asString(obj.sale_end),
      coversDays: asStringList(obj.covers_days),
    });
    return acc;
  }, []);

const parseVenues = (raw: unknown): FestivalVenue[] =>
  asArray(raw).reduce<FestivalVenue[]>((acc, item) => {
    const obj = asObject(item);
    if (!obj) return acc;
    acc.push({
      id: asString(obj.id),
      name: asString(obj.name) ?? '',
      address: asString(obj.address),
      mapUrl: asString(obj.map_url),
      isPrimary: asBoolean(obj.is_primary),
      role: asString(obj.role),
    });
    return acc;
  }, []);

const parseHotels = (raw: unknown): FestivalHotel[] =>
  asArray(raw).reduce<FestivalHotel[]>((acc, item) => {
    const obj = asObject(item);
    if (!obj) return acc;
    acc.push({
      id: asString(obj.id),
      name: asString(obj.name) ?? '',
      starRating: asNumber(obj.star_rating),
      address: asString(obj.address),
      photoUrl: asString(obj.photo_url),
      websiteUrl: asString(obj.website_url),
      bookingUrl: asString(obj.booking_url),
      distance: asString(obj.distance),
      priceFrom: asNumber(obj.price_from),
      priceCurrency: asString(obj.price_currency),
      isOfficial: asBoolean(obj.is_official),
      shuttleAvailable: asBoolean(obj.shuttle_available),
      amenities: asStringList(obj.amenities),
    });
    return acc;
  }, []);

const parsePromoCodes = (raw: unknown): FestivalPromoCode[] =>
  asArray(raw).reduce<FestivalPromoCode[]>((acc, item) => {
    const obj = asObject(item);
    if (!obj) return acc;
    const code = asString(obj.code);
    if (!code) return acc;
    acc.push({
      id: asString(obj.id) ?? code,
      code,
      discountType: asString(obj.discount_type) === 'fixed' ? 'fixed' : 'percent',
      discountAmount: asNumber(obj.discount_amount) ?? 0,
      currency: asString(obj.currency) ?? '',
      limit: asString(obj.limit) ?? '',
      validUntil: asString(obj.valid_until) ?? '',
    });
    return acc;
  }, []);

// ---------------------------------------------------------------------------
// Top-level parser
// ---------------------------------------------------------------------------

const parseFestivalDetail = (value: unknown): FestivalDetail | null => {
  const payload = asObject(value);
  if (!payload) return null;

  const eventId = asString(payload.event_id);
  if (!eventId) return null;

  const identity = asObject(payload.identity) ?? {};
  const dates = asObject(payload.dates) ?? {};
  const links = asObject(payload.links) ?? {};
  const location = asObject(payload.location) ?? {};
  const organiserRaw = asObject(payload.organiser);
  const lineupRaw = asObject(payload.lineup) ?? {};
  const publishRaw = asObject(payload.publish) ?? {};

  // Location sub-objects
  const cityRaw = asObject(location.city);
  const venueRaw = asObject(location.primary_venue);

  return {
    eventId,

    identity: {
      name: asString(identity.name),
      description: asString(identity.description),
      edition: asString(identity.edition),
      isQualifier: asBoolean(identity.is_qualifier),
      features: asStringList(identity.features),
      ageRestriction: asString(identity.age_restriction),
      dressCode: asString(identity.dress_code),
      livestreamUrl: asString(identity.livestream_url),
      aftermovieUrl: asString(identity.aftermovie_url),
      posterUrl: asString(identity.poster_url),
      galleryUrls: asStringList(identity.gallery_urls),
      musicStyles: asStringList(identity.music_styles),
    },

    dates: {
      startsAt: asString(dates.starts_at),
      endsAt: asString(dates.ends_at),
      localStart: asString(dates.local_start),
      localEnd: asString(dates.local_end),
      timezone: asString(dates.timezone),
    },

    links: {
      website: asString(links.website),
      facebookUrl: asString(links.facebook_url),
      instagramUrl: asString(links.instagram_url),
      // Defence-in-depth: bad ticket_url values fall through to null so no
      // broken Tickets button is rendered. See useEventPageQuery.ts for the
      // matching guard on the standard-event path.
      ticketUrl: safeExternalHref(links.ticket_url) ?? null,
      whatsappLink: asString(links.whatsapp_link),
      // Canonical group-chat key with a fallback to the legacy whatsapp_link
      // (currently the storage key admins write). safeExternalHref guards against
      // malformed values so no broken "Join the group chat" button renders.
      groupChatUrl:
        safeExternalHref(links.group_chat_url) ?? safeExternalHref(links.whatsapp_link) ?? null,
      volunteerUrl: asString(links.volunteer_url),
      codeOfConductUrl: asString(links.code_of_conduct_url),
    },

    location: {
      city: cityRaw && asString(cityRaw.id)
        ? { id: asString(cityRaw.id)!, name: asString(cityRaw.name) ?? '', slug: asString(cityRaw.slug) ?? '' }
        : null,
      primaryVenue: venueRaw && asString(venueRaw.id)
        ? (() => {
            // Nearest station: pick the one with smallest walking distance
            const transport = asObject(venueRaw.transport_json);
            const stations = asArray(transport?.nearest_stations);
            const sorted = stations
              .map((s) => asObject(s))
              .filter((s): s is JsonRecord => s !== null)
              .map((s) => ({
                station: asString(s.station) ?? '',
                walkingMinutes: asNumber(s.walking_distance_minutes),
                lines: asStringList(s.line_names),
                mode: asString(s.mode),
              }))
              .filter((s) => s.station)
              .sort((a, b) => (a.walkingMinutes ?? 999) - (b.walkingMinutes ?? 999));
            return {
              id: asString(venueRaw.id)!,
              name: asString(venueRaw.name) ?? '',
              address: asString(venueRaw.address),
              imageUrl: asString(venueRaw.image_url),
              capacity: asNumber(venueRaw.capacity),
              floorType: asString(venueRaw.floor_type),
              facilities: asStringList(venueRaw.facilities_new),
              nearestStation: sorted.length > 0 ? sorted[0] : null,
            };
          })()
        : null,
    },

    organiser: organiserRaw && asString(organiserRaw.id)
      ? { id: asString(organiserRaw.id)!, displayName: asString(organiserRaw.display_name), avatarUrl: asString(organiserRaw.avatar_url) }
      : null,

    lineup: {
      teachers: parseArtists(lineupRaw.teachers, '/teachers/'),
      djs: parseArtists(lineupRaw.djs, '/djs/'),
      mcs: parseArtists(lineupRaw.mcs),
      performers: parseArtists(lineupRaw.performers),
      videographers: parseArtists(lineupRaw.videographers),
      vendors: parseArtists(lineupRaw.vendors, '/vendors/'),
    },

    guestDancers: parseArtists(payload.guest_dancers),
    schedule: parseSchedule(payload.schedule),
    competitions: parseCompetitions(payload.competitions),
    passes: parsePasses(payload.passes),
    venues: parseVenues(payload.venues),
    hotels: parseHotels(payload.hotels),
    promoCodes: parsePromoCodes(payload.promo_codes),

    publish: {
      hasCodeOfConduct: asBoolean(publishRaw.has_code_of_conduct),
      codeOfConductUrl: asString(publishRaw.code_of_conduct_url),
      hasVolunteerInfo: asBoolean(publishRaw.has_volunteer_info),
      volunteerUrl: asString(publishRaw.volunteer_url),
      pressMediaContactName: asString(publishRaw.press_media_contact_name),
      pressMediaContactEmail: asString(publishRaw.press_media_contact_email),
    },
  };
};

export const festivalDetailQueryKey = (eventId?: string | null) =>
  ['festival-detail', eventId ?? null] as const;

export const useFestivalDetailQuery = (eventId?: string | null, enabled = false) => {
  return useQuery<FestivalDetail | null, Error>({
    queryKey: festivalDetailQueryKey(eventId),
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase.rpc('get_public_festival_detail', {
        p_event_id: eventId,
      });
      if (error) throw new Error(error.message ?? JSON.stringify(error));
      return parseFestivalDetail(data);
    },
    enabled: Boolean(eventId) && enabled,
    staleTime: 1000 * 60,
  });
};
