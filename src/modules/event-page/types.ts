import type { Json } from '@/integrations/supabase/types';

// ---------------------------------------------------------------------------
// Shared person shape used across organisers, lineup, attendance preview
// ---------------------------------------------------------------------------

export type EventPagePerson = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  href: string | null;
  // Organiser card contact fields (Phase 1, 2026-04-28). Populated only on
  // organisers; lineup people leave them undefined. Each is the raw value as
  // stored on the entities table — caller decides how to display.
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  contactPhone?: string | null;
};

// ---------------------------------------------------------------------------
// Canonical Event Page Snapshot — mirrors get_event_page_snapshot RPC output
// ---------------------------------------------------------------------------

export type EventPageSnapshotOccurrence = {
  occurrenceId: string;
  startsAt: string | null;
  endsAt: string | null;
  localDate: string | null;
  timezone: string | null;
  isCancelled: boolean;
  isLive: boolean;
  isPast: boolean;
  isUpcoming: boolean;
  lineup: {
    teachers: EventPagePerson[];
    djs: EventPagePerson[];
    dancers: EventPagePerson[];
    vendors: EventPagePerson[];
    videographers: EventPagePerson[];
  };
};

export type EventPageTicket = {
  id: string;
  name: string;
  price: string;
  quantity: string;
  description: string;
};

export type EventPagePromoCode = {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_amount: number;
  limit: string;
  valid_until: string;
};

export type EventPageKeyTimes = {
  classes?: { start: string; end: string };
  party?: { start: string; end: string };
};

export type EventPageEventLevel = 'beginner' | 'intermediate' | 'advanced' | 'all_levels' | null;

export type EventPageSnapshot = {
  eventId: string;
  occurrenceId: string | null;
  event: {
    name: string | null;
    description: string | null;
    date: string | null;
    type: string | null;
    timezone: string | null;
    citySlug: string | null;
    location: string | null;
    status: string | null;
    isPublished: boolean;
    createdBy: string | null;
    imageUrl: string | null;
    posterUrl: string | null;
    galleryUrls: string[];
    musicStyles: string[];
    paymentMethods: string | null;
    level: EventPageEventLevel;
    keyTimes: EventPageKeyTimes | null;
    metaDataPublic: Record<string, unknown>;
    tickets: EventPageTicket[];
    promoCodes: EventPagePromoCode[];
    actions: {
      ticketUrl: string | null;
      websiteUrl: string | null;
      facebookUrl: string | null;
      instagramUrl: string | null;
      whatsappLink: string | null;
      tiktokUrl: string | null;
      livestreamUrl: string | null;
      pricing: Json | null;
    };
  };
  organisers: EventPagePerson[];
  // Organiser card slot picks for the public event page (Phase 1, 2026-04-28).
  // Each slot names which contact field to display on that pill column.
  // Allowed: 'website' | 'instagram' | 'facebook' | 'contact_phone' | null.
  organiserCard: {
    slot1: string | null;
    slot2: string | null;
  };
  occurrences: EventPageSnapshotOccurrence[];
  occurrenceEffective: EventPageSnapshotOccurrence | null;
  locationDefault: {
    city: {
      id: string | null;
      name: string | null;
      slug: string | null;
    } | null;
    venue: {
      id: string | null;
      name: string | null;
      address: string | null;
      postcode: string | null;
      google_maps_link: string | null;
      image_url: string | null;
      gallery_urls: string[];
      transport_json: {
        notes?: string;
        nearest_stations?: Array<{
          station: string;
          line_names: string[];
          walking_distance_minutes: number;
        }>;
      } | null;
      description: string | null;
      capacity: number | null;
      floor_type: string | null;
      facilities_new: string[];
      timezone: string | null;
    } | null;
    timezone: string | null;
  };
  attendance: {
    goingCount: number;
    interestedCount: number;
    currentUserStatus: string | null;
    preview: EventPagePerson[];
  };
};

// ---------------------------------------------------------------------------
// Event Page Model — minimal render model derived from EventPageSnapshot
// ---------------------------------------------------------------------------

export type EventPageState = 'loading' | 'ready' | 'not-found' | 'unavailable' | 'error';

export type EventPageModel = {
  page: {
    state: EventPageState;
    canEdit: boolean;
    title: string;
    message: string | null;
  };
  identity: {
    title: string;
    eventId: string | null;
    occurrenceId: string | null;
    statusLabel: string | null;
    eventType: string | null;
    level: EventPageEventLevel;
    musicStyles: string[];
  };
  hero: {
    imageUrl: string | null;
    imageAlt: string;
    monogram: string;
    mediaState: 'image' | 'fallback';
  };
  actions: {
    ticketUrl: string | null;
    websiteUrl: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    whatsappLink: string | null;
    tiktokUrl: string | null;
    livestreamUrl: string | null;
    pricing: Json | null;
    hasAny: boolean;
  };
  schedule: {
    dateLabel: string | null;
    shortDateLabel: string | null;
    timeLabel: string | null;
    timezoneLabel: string | null;
    keyTimes: EventPageKeyTimes | null;
    isCancelled: boolean;
    isVisible: boolean;
  };
  location: {
    venueId: string | null;
    venueName: string | null;
    address: string | null;
    postcode: string | null;
    googleMapsLink: string | null;
    venueImageUrl: string | null;
    galleryUrls: string[];
    transportJson: {
      notes?: string;
      nearest_stations?: Array<{
        station: string;
        line_names: string[];
        walking_distance_minutes: number;
      }>;
    } | null;
    venueDescription: string | null;
    capacity: number | null;
    floorType: string | null;
    facilitiesNew: string[];
    venueTimezone: string | null;
    cityId: string | null;
    cityName: string | null;
    locationText: string | null;
    timezoneLabel: string | null;
    isVisible: boolean;
  };
  organiser: {
    person: EventPagePerson | null;
    isVisible: boolean;
  };
  lineup: {
    groups: Array<{
      key: 'teachers' | 'djs' | 'videographers' | 'vendors';
      label: string;
      items: EventPagePerson[];
    }>;
    hasAny: boolean;
  };
  guestDancers: {
    items: EventPagePerson[];
    isVisible: boolean;
  };
  attendance: {
    goingCount: number;
    goingCountLabel: string;
    interestedCount: number;
    currentUserStatus: string | null;
    preview: EventPagePerson[];
    ctaLabel: string;
    canToggle: boolean;
    isVisible: boolean;
  };
  description: {
    body: string | null;
    isVisible: boolean;
  };
  eventInfo: {
    dressCode: string | null;
    ageRestriction: string | null;
    paymentMethods: string | null;
    isVisible: boolean;
  };
  tickets: {
    items: EventPageTicket[];
    isVisible: boolean;
  };
  promoCodes: {
    items: EventPagePromoCode[];
    isVisible: boolean;
  };
  galleryUrls: string[];
  metaDataPublic: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Festival Detail — mirrors get_public_festival_detail RPC output
// ---------------------------------------------------------------------------

/** Artist/person in festival lineup — no is_primary (use ordering instead) */
export type FestivalArtist = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  href: string | null;
};

export type FestivalSessionLevel = 'beginner' | 'improver' | 'intermediate' | 'advanced' | 'open_level';
export const ALL_FESTIVAL_LEVELS: readonly FestivalSessionLevel[] = [
  'beginner', 'improver', 'intermediate', 'advanced', 'open_level',
] as const;

/** One row in the hydrated festival schedule */
export type FestivalScheduleItem = {
  id: string | null;
  day: string;
  type: string;
  title: string;
  startTime: string;
  endTime: string | null;
  venueRoom: string | null;
  isMasterclass: boolean;
  /** Skill levels for this session (workshop / bootcamp / masterclass).
   *  Subset of {beginner, improver, intermediate, advanced, open_level}. Empty = unspecified.
   *  All four named = "All levels". `open_level` alone = "Open Level". */
  levels: FestivalSessionLevel[];
  instructors: FestivalArtist[];
  djs: FestivalArtist[];
};

export type FestivalCompetition = {
  id: string | null;
  name: string;
  day: string | null;
  qualifiersTime: string | null;
  finalsTime: string | null;
  entryFee: number | null;
  prizeDescription: string | null;
  isQualifier: boolean;
  judges: FestivalArtist[];
};

export type FestivalPass = {
  id: string;
  name: string;
  price: number;
  earlyBirdPrice: number | null;
  currency: string | null;
  type: string;
  tier: string | null;
  description: string | null;
  saleEnd: string | null;
  coversDays: string[];
};

export type FestivalVenue = {
  id: string | null;
  name: string;
  address: string | null;
  mapUrl: string | null;
  isPrimary: boolean;
  role: string | null;
};

export type FestivalHotel = {
  id: string | null;
  name: string;
  starRating: number | null;
  address: string | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  bookingUrl: string | null;
  distance: string | null;
  priceFrom: number | null;
  priceCurrency: string | null;
  isOfficial: boolean;
  shuttleAvailable: boolean;
  amenities: string[];
};

export type FestivalPromoCode = {
  code: string;
  discountType: string;
  discountValue: number;
};

export type FestivalDetail = {
  eventId: string;

  identity: {
    name: string | null;
    description: string | null;
    edition: string | null;
    isQualifier: boolean;
    features: string[];
    ageRestriction: string | null;
    dressCode: string | null;
    livestreamUrl: string | null;
    aftermovieUrl: string | null;
    posterUrl: string | null;
    galleryUrls: string[];
    musicStyles: string[];
  };

  dates: {
    startsAt: string | null;
    endsAt: string | null;
    localStart: string | null;
    localEnd: string | null;
    timezone: string | null;
  };

  links: {
    website: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    ticketUrl: string | null;
    whatsappLink: string | null;
    volunteerUrl: string | null;
    codeOfConductUrl: string | null;
  };

  location: {
    city: { id: string; name: string; slug: string } | null;
    primaryVenue: { id: string; name: string; address: string | null; imageUrl: string | null } | null;
  };

  organiser: FestivalArtist | null;

  lineup: {
    teachers: FestivalArtist[];
    djs: FestivalArtist[];
    mcs: FestivalArtist[];
    performers: FestivalArtist[];
    videographers: FestivalArtist[];
    vendors: FestivalArtist[];
  };

  guestDancers: FestivalArtist[];
  schedule: FestivalScheduleItem[];
  competitions: FestivalCompetition[];
  passes: FestivalPass[];
  venues: FestivalVenue[];
  hotels: FestivalHotel[];
  promoCodes: FestivalPromoCode[];

  publish: {
    hasCodeOfConduct: boolean;
    codeOfConductUrl: string | null;
    hasVolunteerInfo: boolean;
    volunteerUrl: string | null;
    pressMediaContactName: string | null;
    pressMediaContactEmail: string | null;
  };
};
