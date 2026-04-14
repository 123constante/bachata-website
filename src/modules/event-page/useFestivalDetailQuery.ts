import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      // RPC returns `instructors` (hydrated teacher_profiles), map to our shape
      instructors: parseArtists(obj.instructors),
      djs: parseArtists(obj.djs),
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
      code,
      discountType: asString(obj.discount_type) ?? 'percent',
      discountValue: asNumber(obj.discount_value) ?? 0,
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
      ticketUrl: asString(links.ticket_url),
      whatsappLink: asString(links.whatsapp_link),
      volunteerUrl: asString(links.volunteer_url),
      codeOfConductUrl: asString(links.code_of_conduct_url),
    },

    location: {
      city: cityRaw && asString(cityRaw.id)
        ? { id: asString(cityRaw.id)!, name: asString(cityRaw.name) ?? '', slug: asString(cityRaw.slug) ?? '' }
        : null,
      primaryVenue: venueRaw && asString(venueRaw.id)
        ? { id: asString(venueRaw.id)!, name: asString(venueRaw.name) ?? '', address: asString(venueRaw.address), imageUrl: asString(venueRaw.image_url) }
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
      if (error) throw error;
      return parseFestivalDetail(data);
    },
    enabled: Boolean(eventId) && enabled,
    staleTime: 1000 * 60,
  });
};
