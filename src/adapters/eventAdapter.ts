import type { CalendarEvent } from "@/types/CalendarEvent";
import type { SupabaseCalendarRow } from "@/types/SupabaseCalendarRow";

const asStringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const normalizePhotoUrls = (value: unknown): string[] | null => {
  if (Array.isArray(value)) {
    const urls = value.filter((v) => typeof v === "string") as string[];
    return urls.length ? urls : null;
  }
  if (typeof value === "string" && value.trim()) return [value];
  return null;
};

export const adaptEvent = (row: SupabaseCalendarRow): CalendarEvent => {
  const venueName = asStringOrNull(row.event?.venue?.entities?.name) || asStringOrNull(row.venue_name) || 'Venue TBA';

  return {
    id: row.id,
    eventId: row.event?.id ?? row.event_id,
    name: row.event?.name ?? row.name ?? '',
    startTime: asStringOrNull(row.instance_start),
    endTime: asStringOrNull(row.instance_end),
    hasParty: Boolean(row.has_party),
    hasClass: Boolean(row.has_class),
    venueName,
    citySlug: asStringOrNull(row.city_slug),
    location: asStringOrNull(row.location) ?? venueName ?? null,
    instanceDate: asStringOrNull(row.instance_start),
    timezone: asStringOrNull(row.timezone),
    type: asStringOrNull(row.type),
    photoUrls: normalizePhotoUrls(row.photo_url),
    coverImageUrl: asStringOrNull(row.cover_image_url),
  };
};