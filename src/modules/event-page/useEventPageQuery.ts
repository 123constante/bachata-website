import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import { resolveEventImage } from '@/lib/utils';
import type { EventPageKeyTimes, EventPagePerson, EventPagePromoCode, EventPageSnapshot, EventPageSnapshotOccurrence, EventPageTicket } from '@/modules/event-page/types';

// ---------------------------------------------------------------------------
// JSON helpers — safe extraction from untyped RPC payloads
// ---------------------------------------------------------------------------

type JsonRecord = Record<string, unknown>;

type SnapshotRpcArgs = Database['public']['Functions']['get_event_page_snapshot_v2']['Args'];

const asObject = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const asString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value : null;
};

const asBoolean = (value: unknown): boolean => value === true;

const asNumber = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const requireObject = (value: unknown, label: string): JsonRecord => {
  const objectValue = asObject(value);
  if (!objectValue) {
    throw new Error(`Invalid event page snapshot: ${label} must be an object`);
  }
  return objectValue;
};

const requireArray = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid event page snapshot: ${label} must be an array`);
  }
  return value;
};

const requireString = (value: unknown, label: string): string => {
  const stringValue = asString(value);
  if (!stringValue) {
    throw new Error(`Invalid event page snapshot: ${label} must be a non-empty string`);
  }
  return stringValue;
};

// ---------------------------------------------------------------------------
// Occurrence normalizer
// ---------------------------------------------------------------------------

const parsePerson = (value: unknown, hrefBase: string | null, label: string): EventPagePerson | null => {
  const raw = requireObject(value, label);
  const id = requireString(raw.id, `${label}.id`);
  return {
    id,
    displayName: asString(raw.display_name),
    avatarUrl: asString(raw.avatar_url),
    href: hrefBase ? `${hrefBase}${id}` : null,
  };
};

const parsePeople = (value: unknown, hrefBase: string | null, label: string): EventPagePerson[] => {
  return requireArray(value, label)
    .map((item, index) => parsePerson(item, hrefBase, `${label}[${index}]`))
    .filter((item): item is EventPagePerson => item !== null);
};

const parseOccurrence = (value: unknown, label: string): EventPageSnapshotOccurrence | null => {
  if (value === null) return null;
  const raw = requireObject(value, label);
  const occurrenceId = requireString(raw.occurrence_id, `${label}.occurrence_id`);
  const lineup = requireObject(raw.lineup, `${label}.lineup`);
  return {
    occurrenceId,
    startsAt: asString(raw.starts_at),
    endsAt: asString(raw.ends_at),
    localDate: asString(raw.local_date),
    timezone: asString(raw.timezone),
    isCancelled: asBoolean(raw.is_cancelled),
    isLive: asBoolean(raw.is_live),
    isPast: asBoolean(raw.is_past),
    isUpcoming: asBoolean(raw.is_upcoming),
    lineup: {
      teachers: parsePeople(lineup.teachers, '/teachers/', `${label}.lineup.teachers`),
      djs: parsePeople(lineup.djs, '/djs/', `${label}.lineup.djs`),
      dancers: parsePeople(lineup.dancers, '/dancers/', `${label}.lineup.dancers`),
      vendors: parsePeople(lineup.vendors, '/vendors/', `${label}.lineup.vendors`),
      videographers: parsePeople(lineup.videographers, '/videographers/', `${label}.lineup.videographers`),
    },
  };
};

// ---------------------------------------------------------------------------
// Top-level snapshot normalizer
// ---------------------------------------------------------------------------

const parseEventPageSnapshot = (value: unknown): EventPageSnapshot | null => {
  if (value === null) return null;
  const payload = requireObject(value, 'snapshot');
  const eventId = requireString(payload.event_id, 'snapshot.event_id');
  const event = requireObject(payload.event, 'snapshot.event');
  const actions = requireObject(event.actions, 'snapshot.event.actions');
  const metaPub = asObject(event.meta_data_public) ?? {};
  const locationDefault = requireObject(payload.location_default, 'snapshot.location_default');
  const attendance = requireObject(payload.attendance, 'snapshot.attendance');
  if (!payload) return null;

  return {
    eventId,
    occurrenceId: asString(payload.occurrence_id),
    event: {
      name: asString(event.name),
      description: asString(event.description),
      date: asString(event.date),
      type: asString(event.type),
      timezone: asString(event.timezone),
      citySlug: asString(event.city_slug),
      location: asString(event.location),
      status: asString(event.status),
      isPublished: event.is_published !== false,
      createdBy: asString(event.created_by),
      imageUrl:
        resolveEventImage(
          null,
          asString(event.cover_image_url) ?? asString(event.hero_image_url),
        ) ?? null,
      posterUrl: asString(event.poster_url),
      galleryUrls: asArray(event.photo_urls)
        .map((s) => asString(s))
        .filter((s): s is string => s !== null),
      musicStyles: asArray(event.music_styles)
        .map((s) => asString(s))
        .filter((s): s is string => s !== null),
      paymentMethods: asString(event.payment_methods),
      keyTimes: (() => {
        const kt = asObject(event.key_times);
        if (!kt) return null;
        const classes = asObject(kt.classes);
        const party = asObject(kt.party);
        if (!classes && !party) return null;
        const result: EventPageKeyTimes = {};
        if (classes) result.classes = { start: asString(classes.start) ?? '', end: asString(classes.end) ?? '' };
        if (party) result.party = { start: asString(party.start) ?? '', end: asString(party.end) ?? '' };
        return result;
      })(),
      metaDataPublic: asObject(event.meta_data_public) ?? {},
      tickets: (() => {
        const raw = asObject(event.meta_data_public);
        return asArray(raw?.tickets).reduce<EventPageTicket[]>((acc, item) => {
          const t = asObject(item);
          const id = asString(t?.id);
          if (!id) return acc;
          acc.push({
            id,
            name: asString(t?.name) ?? '',
            price: asString(t?.price) ?? '',
            quantity: asString(t?.quantity) ?? '',
            description: asString(t?.description) ?? '',
          });
          return acc;
        }, []);
      })(),
      promoCodes: (() => {
        const raw = asObject(event.meta_data_public);
        return asArray(raw?.promo_codes).reduce<EventPagePromoCode[]>((acc, item) => {
          const p = asObject(item);
          const id = asString(p?.id);
          if (!id) return acc;
          const discountType = asString(p?.discount_type);
          acc.push({
            id,
            code: asString(p?.code) ?? '',
            discount_type: discountType === 'fixed' ? 'fixed' : 'percent',
            discount_amount: typeof p?.discount_amount === 'number' ? p.discount_amount : 0,
            limit: asString(p?.limit) ?? '',
            valid_until: asString(p?.valid_until) ?? '',
          });
          return acc;
        }, []);
      })(),
      actions: {
        ticketUrl: asString(actions.ticket_url),
        websiteUrl: asString(actions.website_url),
        facebookUrl: asString(actions.facebook_url),
        instagramUrl: asString(actions.instagram_url),
        whatsappLink: asString(metaPub.whatsapp_link),
        tiktokUrl: asString(metaPub.tiktok_url),
        livestreamUrl: asString(metaPub.livestream_url),
        pricing: (actions.pricing as Json | null | undefined) ?? null,
      },
    },
    organisers: parsePeople(payload.organisers, '/organisers/', 'snapshot.organisers'),
    occurrences: requireArray(payload.occurrences, 'snapshot.occurrences')
      .map((item, index) => parseOccurrence(item, `snapshot.occurrences[${index}]`))
      .filter((item): item is EventPageSnapshotOccurrence => item !== null),
    occurrenceEffective: parseOccurrence(payload.occurrence_effective ?? null, 'snapshot.occurrence_effective'),
    locationDefault: {
      city: locationDefault.city
        ? {
            id: asString(requireObject(locationDefault.city, 'snapshot.location_default.city').id),
            name: asString(requireObject(locationDefault.city, 'snapshot.location_default.city').name),
            slug: asString(requireObject(locationDefault.city, 'snapshot.location_default.city').slug),
          }
        : null,
      venue: (() => {
        if (!locationDefault.venue) return null;
        const v = requireObject(locationDefault.venue, 'snapshot.location_default.venue');
        const tj = asObject(v.transport_json);
        return {
          id: asString(v.id),
          name: asString(v.name),
          address: asString(v.address_line),
          postcode: asString(v.postcode),
          google_maps_link: asString(v.google_maps_link),
          image_url: asString(v.image_url),
          gallery_urls: asArray(v.gallery_urls)
            .map((s) => asString(s))
            .filter((s): s is string => s !== null),
          transport_json: tj
            ? {
                notes: asString(tj.notes) ?? undefined,
                nearest_stations: asArray(tj.nearest_stations).reduce<
                  Array<{ station: string; line_names: string[]; walking_distance_minutes: number }>
                >((acc, item) => {
                  const s = asObject(item);
                  if (!s) return acc;
                  acc.push({
                    station: asString(s.station) ?? '',
                    line_names: asArray(s.line_names)
                      .map((l) => asString(l))
                      .filter((l): l is string => l !== null),
                    walking_distance_minutes: asNumber(s.walking_distance_minutes) ?? 0,
                  });
                  return acc;
                }, []),
              }
            : null,
          description: asString(v.description),
          capacity: asNumber(v.capacity),
          floor_type: asString(v.floor_type),
          facilities_new: asArray(v.facilities_new)
            .map((s) => asString(s))
            .filter((s): s is string => s !== null),
          timezone: asString(v.timezone),
        };
      })(),
      timezone: asString(locationDefault.timezone),
    },
    attendance: {
      goingCount: asNumber(attendance.going_count) ?? 0,
      currentUserStatus: asString(attendance.current_user_status),
      preview: parsePeople(attendance.preview, null, 'snapshot.attendance.preview'),
    },
  };
};

// ---------------------------------------------------------------------------
// React Query hook
// ---------------------------------------------------------------------------

export const eventPageQueryKey = (eventId?: string | null, occurrenceId?: string | null) => [
  'event-page-snapshot',
  eventId ?? null,
  occurrenceId ?? null,
] as const;

export const useEventPageQuery = (eventId?: string | null, occurrenceId?: string | null) => {
  return useQuery<EventPageSnapshot | null, Error>({
    queryKey: eventPageQueryKey(eventId, occurrenceId),
    queryFn: async () => {
      if (!eventId) return null;

      const args: SnapshotRpcArgs = { p_event_id: eventId };
      if (occurrenceId) {
        args.p_occurrence_id = occurrenceId;
      }

      const { data, error } = await supabase.rpc('get_event_page_snapshot_v2', args);
      if (error) throw error;

      return parseEventPageSnapshot(data);
    },
    enabled: Boolean(eventId),
    staleTime: 1000 * 30,
  });
};
