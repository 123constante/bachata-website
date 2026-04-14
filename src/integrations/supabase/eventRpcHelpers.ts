/**
 * Advanced utilities and helpers for working with event RPC data
 */

import { CalendarEventRow, EventPageSnapshot, FestivalDetail } from '@/integrations/supabase/eventRpcs';

// ============================================================================
// Calendar Event Utilities
// ============================================================================

/**
 * Group festival events by event_id (since each day is a separate row)
 * Useful for displaying festival cards that span multiple days
 */
export function groupFestivalRows(events: CalendarEventRow[]): Map<string, CalendarEventRow[]> {
  const grouped = new Map<string, CalendarEventRow[]>();

  events.forEach((event) => {
    if (event.type === 'festival') {
      const key = event.event_id;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(event);
    }
  });

  return grouped;
}

/**
 * Get the date range of a festival from its row group
 */
export function getFestivalDateRange(rows: CalendarEventRow[]): {
  startDate: string;
  endDate: string;
} {
  if (rows.length === 0) {
    return { startDate: '', endDate: '' };
  }

  const dates = rows.map((r) => r.instance_date).sort();
  return {
    startDate: dates[0],
    endDate: dates[dates.length - 1],
  };
}

/**
 * Check if event row has party / classes using precomputed flags
 */
export function getEventFilters(event: CalendarEventRow) {
  return {
    hasClass: event.has_class,
    hasParty: event.has_party,
    classTimeRange: event.class_start
      ? { start: event.class_start, end: event.class_end }
      : null,
    partyTimeRange: event.party_start
      ? { start: event.party_start, end: event.party_end }
      : null,
  };
}

// ============================================================================
// Event Detail Utilities
// ============================================================================

/**
 * Extract primary organiser from snapshot
 * Handles missing organisers array gracefully
 */
export function getPrimaryOrganiser(snapshot: EventPageSnapshot | null) {
  return snapshot?.organisers?.[0] ?? null;
}

/**
 * Get featured artists (is_primary=true) from lineup
 */
export function getFeaturedArtists(snapshot: EventPageSnapshot | null) {
  if (!snapshot?.occurrence_effective?.lineup) {
    return [];
  }

  const { lineup } = snapshot.occurrence_effective;
  const featured = [];

  if (lineup.teachers) {
    featured.push(
      ...lineup.teachers.filter((t) => t.is_primary).map((t) => ({ ...t, role: 'teacher' as const })),
    );
  }
  if (lineup.djs) {
    featured.push(
      ...lineup.djs.filter((d) => d.is_primary).map((d) => ({ ...d, role: 'dj' as const })),
    );
  }
  if (lineup.performers) {
    featured.push(
      ...lineup.performers.filter((p) => p.is_primary).map((p) => ({ ...p, role: 'performer' as const })),
    );
  }

  return featured;
}

/**
 * Get music styles from snapshot or festival detail
 * Festival detail takes precedence if both available
 */
export function getMusicStyles(
  snapshot: EventPageSnapshot | null,
  festival: FestivalDetail | null,
): string[] {
  return festival?.identity.music_styles ?? snapshot?.event.music_styles ?? [];
}

/**
 * Get event cover/poster image
 * For standard events: cover_image_url from snapshot
 * For festivals: poster_url from festival detail (preferred)
 */
export function getEventCoverImage(
  snapshot: EventPageSnapshot | null,
  festival: FestivalDetail | null,
): string | null {
  if (festival?.identity.poster_url) {
    return festival.identity.poster_url;
  }
  return snapshot?.event.cover_image_url ?? null;
}

/**
 * Get all external links (website, tickets, social)
 */
export function getEventLinks(
  snapshot: EventPageSnapshot | null,
  festival: FestivalDetail | null,
) {
  const snapshotLinks = snapshot?.event.actions;
  const festivalLinks = festival?.links;

  return {
    website: festivalLinks?.website ?? snapshotLinks?.website_url ?? null,
    ticketUrl: festivalLinks?.ticket_url ?? snapshotLinks?.ticket_url ?? null,
    facebookUrl: festivalLinks?.facebook_url ?? snapshotLinks?.facebook_url ?? null,
    instagramUrl: festivalLinks?.instagram_url ?? snapshotLinks?.instagram_url ?? null,
    whatsappLink: festivalLinks?.whatsapp_link ?? null,
    volunteerUrl: festivalLinks?.volunteer_url ?? null,
  };
}

/**
 * Get all photo URLs for gallery/carousel
 * Returns cover image first, then remaining photos
 */
export function getEventPhotos(
  snapshot: EventPageSnapshot | null,
  festival: FestivalDetail | null,
): string[] {
  const photos: Set<string> = new Set();

  // Add cover image first
  const cover = getEventCoverImage(snapshot, festival);
  if (cover) {
    photos.add(cover);
  }

  // Add snapshot photos
  snapshot?.event.photo_urls?.forEach((url) => photos.add(url));

  // Add festival gallery
  festival?.identity.gallery_urls?.forEach((url) => photos.add(url));

  return Array.from(photos);
}

/**
 * Get all lineup people with their roles
 */
export function getAllLineupMembers(
  snapshot: EventPageSnapshot | null,
  festival: FestivalDetail | null,
) {
  const lineup = festival?.lineup ?? snapshot?.occurrence_effective?.lineup ?? {};
  const members: Array<{
    id: string;
    name: string;
    avatar: string | null;
    role: string;
    isPrimary: boolean;
  }> = [];

  const addRole = (people: any[] | undefined, role: string) => {
    people?.forEach((person) => {
      members.push({
        id: person.id,
        name: person.display_name,
        avatar: person.avatar_url,
        role,
        isPrimary: person.is_primary ?? false,
      });
    });
  };

  addRole(lineup.teachers, 'Teacher');
  addRole(lineup.djs, 'DJ');
  addRole(lineup.performers, 'Performer');
  addRole(lineup.mcs, 'MC');
  addRole(lineup.videographers, 'Videographer');
  addRole(lineup.dancers, 'Dancer');
  addRole(lineup.vendors, 'Vendor');

  // Add guest dancers if festival
  addRole(festival?.guest_dancers, 'Guest Dancer');

  return members;
}

// ============================================================================
// Festival-Specific Utilities
// ============================================================================

/**
 * Get festival schedule grouped by day
 */
export function getScheduleByDay(festival: FestivalDetail | null) {
  if (!festival?.schedule) {
    return new Map<string, typeof festival.schedule>();
  }

  const grouped = new Map<string, typeof festival.schedule>();
  festival.schedule.forEach((item) => {
    if (!grouped.has(item.day)) {
      grouped.set(item.day, []);
    }
    grouped.get(item.day)!.push(item);
  });

  return grouped;
}

/**
 * Get all pass types and their details
 */
export function getPassTypeSummary(festival: FestivalDetail | null) {
  if (!festival?.passes) {
    return [];
  }

  return festival.passes.map((pass) => ({
    id: pass.id,
    name: pass.name,
    description: pass.description,
    price: pass.price,
    currency: pass.currency,
    type: pass.type,
    tier: pass.tier,
    available: pass.available_until ? new Date(pass.available_until) : null,
  }));
}

/**
 * Get promo code information
 */
export function getPromoCodeDetail(festival: FestivalDetail | null) {
  if (!festival?.promo_codes) {
    return [];
  }

  return festival.promo_codes.map((code) => ({
    code: code.code,
    discount: code.discount_value,
    discountType: code.discount_type,
  }));
}

/**
 * Check if festival has specific features
 */
export function hasFestivalFeatures(
  festival: FestivalDetail | null,
  features: string[],
): boolean {
  if (!festival?.identity.features) {
    return false;
  }

  const hasFeatures = festival.identity.features;
  return features.some((f) => hasFeatures.includes(f));
}
