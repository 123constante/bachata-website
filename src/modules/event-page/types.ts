import type { Json } from '@/integrations/supabase/types';
import type { Instant, WallClock } from '@/lib/time/wallClock';

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
  startsAt: WallClock | null;
  endsAt: WallClock | null;
  localDate: WallClock | null;
  timezone: string | null;
  isCancelled: boolean;
  cancellationReasonLabel: string | null;
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
  /** ISO 4217 code as stored on the ticket row; null when absent (display/JSON-LD default to GBP). */
  currency: string | null;
  quantity: string;
  description: string;
};

export type EventPagePromoCode = {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_amount: number;
  currency: string;
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
    date: WallClock | null;
    type: string | null;
    /** P5 structural shape: one_off | recurring | course | festival. Null for legacy-only events. */
    format: string | null;
    /** P5 discovery genre: party | class | workshop | masterclass. Null for legacy-only events. */
    category: string | null;
    timezone: string | null;
    citySlug: string | null;
    location: string | null;
    status: string | null;
    lifecycleStatus: string | null;
    /** Series-termination arc P4a: the date a series stopped running, from
     *  event_series_p5.ended_on. Non-null ONLY when lifecycleStatus is 'ended'
     *  (a BEFORE trigger coerces it to NULL on every other status).
     *
     *  A naive 'YYYY-MM-DD' London date, NOT an instant. Format it from its own
     *  parts -- never through Date/Intl, which would shift it a day either side
     *  of a BST boundary.
     *
     *  This and `ranFrom` are the two ends of the run, and they are SCALARS for
     *  a reason: `occurrences` is a capped 52-row WINDOW and carries neither end
     *  reliably. Its server-side order is
     *  `ORDER BY (materialised_start_utc >= now()) DESC, materialised_start_utc ASC`
     *  -- future rows are taken FIRST, and an ended series can still hold future
     *  rows (the P3 prune spares curated ones, and cancelled rows are not
     *  archived). 29 of 72 live series already exceed the cap. Never re-derive
     *  either end from the array. */
    endedOn: string | null;
    /** Series-termination arc P4c: the first night the series actually ran, from
     *  the RPC's `event.ran_from` scalar. Same naive 'YYYY-MM-DD' London shape as
     *  `endedOn`, and the same warning about the array applies.
     *
     *  NOT the same definition as min(localDate) over `occurrences`, which is
     *  what this module computed before P4c: `ran_from` counts only 'scheduled'
     *  rows (cancelled nights are excluded) and keys on `occurrence_date`, where
     *  the array admits cancelled nights and derives `local_date` from
     *  `materialised_start_utc`, which an override can shift across a day
     *  boundary. "The first night it actually ran" is the intended meaning. */
    ranFrom: string | null;
    isPublished: boolean;
    createdBy: string | null;
    imageUrl: string | null;
    posterUrl: string | null;
    galleryUrls: string[];
    /** P5 — series-level video URLs (YouTube/Vimeo embeds or R2 direct uploads).
     *  Rendered as the cover video on the event page. */
    videoUrls: string[];
    musicStyles: string[];
    paymentMethods: string | null;
    level: EventPageEventLevel;
    keyTimes: EventPageKeyTimes | null;
    metaDataPublic: Record<string, unknown>;
    tickets: EventPageTicket[];
    promoCodes: EventPagePromoCode[];
    /** Per-occurrence "featured / promoted" flag. null = inherit series default;
     *  true / false = override. Populated by the per-occurrence override
     *  overlay shipped in admin migration 20260531200000. */
    featured: boolean | null;
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
          mode?: string | null;
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
    // Whole-event cancellation. True when the loaded occurrence is cancelled
    // AND no other future non-cancelled occurrence exists in the same series.
    // Per-date cancellation (one Tuesday in a recurring class) keeps the
    // existing DateBlock/DatesBlock pill treatment instead.
    isCancelled: boolean;
    cancellationReasonLabel: string | null;
    isPaused: boolean;
    // Series-termination arc P4. SERIES-level: this night no longer runs at all.
    // Distinct from the per-occurrence `past` flag, which is equally true of a
    // past date on a series that still runs every week.
    isEnded: boolean;
    // 'YYYY-MM-DD' London date, or null when the series has not ended -- and also
    // null on an ended series whose payload predates the migration that exposes
    // it, which is why every consumer must render a date-free form.
    endedOn: string | null;
    // First night of the run, 'YYYY-MM-DD', null unless isEnded. Read straight
    // from the RPC's `event.ran_from` scalar (P4c) -- NOT derived from the
    // occurrences window, which carries neither end of a long run.
    ranFrom: string | null;
  };
  identity: {
    title: string;
    eventId: string | null;
    occurrenceId: string | null;
    statusLabel: string | null;
    eventType: string | null;
    eventFormat: string | null;
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
        mode?: string | null;
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
  videoUrls: string[];
  metaDataPublic: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Festival Detail -- mirrors get_public_festival_detail_v2 RPC output
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
  day: WallClock;
  type: string;
  title: string;
  startTime: WallClock;
  endTime: WallClock | null;
  venueRoom: string | null;
  isMasterclass: boolean;
  /** Skill levels for this session (workshop / bootcamp / masterclass).
   *  Subset of {beginner, improver, intermediate, advanced, open_level}. Empty = unspecified.
   *  All four named = "All levels". `open_level` alone = "Open Level". */
  levels: FestivalSessionLevel[];
  instructors: FestivalArtist[];
  djs: FestivalArtist[];
  /** Dance style for this session (e.g. "Bachata Influence", "Brazilian Zouk"). */
  style: string | null;
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
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountAmount: number;
  currency: string;
  limit: string;
  validUntil: string;
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
    videoUrls: string[];
    posterUrl: string | null;
    galleryUrls: string[];
    musicStyles: string[];
  };

  dates: {
    /** TRUE UTC instants from get_public_festival_detail_v2 (tz-corrected).
     *  Use instantToDate for countdown/JSON-LD/GCal/ICS. For calendar-field
     *  DISPLAY (tiles, labels) read localStart/localEnd instead. */
    startsAt: Instant | null;
    endsAt: Instant | null;
    /** Event-timezone calendar dates ('YYYY-MM-DD', date-only wall clocks) --
     *  the sanctioned source for hero tiles / date labels / share subtitles. */
    localStart: WallClock | null;
    localEnd: WallClock | null;
    timezone: string | null;
  };

  links: {
    website: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    ticketUrl: string | null;
    whatsappLink: string | null;
    /** The festival's community group-chat invite (WhatsApp / Telegram /
     *  Discord / …). Source: meta_data.group_chat_url, falling back to the
     *  legacy whatsapp_link key. Rendered as the "Join the group chat" band. */
    groupChatUrl: string | null;
    volunteerUrl: string | null;
    codeOfConductUrl: string | null;
  };

  location: {
    city: { id: string; name: string; slug: string } | null;
    primaryVenue: {
      id: string;
      name: string;
      address: string | null;
      imageUrl: string | null;
      capacity: number | null;
      floorType: string | null;
      facilities: string[];
      nearestStation: { station: string; walkingMinutes: number | null; lines: string[]; mode?: string | null } | null;
    } | null;
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
