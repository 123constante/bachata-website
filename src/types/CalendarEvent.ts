export interface CalendarEvent {
  id: string;
  occurrenceId?: string | null;
  eventId: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  hasParty: boolean;
  hasClass: boolean;
  venueName: string | null;
  citySlug: string | null;
  location: string | null;
  instanceDate: string | null;
  timezone: string | null;
  type: string | null;
  photoUrls: string[] | null;
  coverImageUrl: string | null;
  key_times?: unknown | null;
  classStart?: string | null;
  classEnd?: string | null;
  partyStart?: string | null;
  partyEnd?: string | null;
}
