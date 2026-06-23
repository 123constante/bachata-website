import { describe, expect, it } from 'vitest';
import { buildEventPageModel } from '@/modules/event-page/buildEventPageModel';
import type {
  EventPageSnapshot,
  EventPageSnapshotOccurrence,
} from '@/modules/event-page/types';

const baseOccurrence = (overrides: Partial<EventPageSnapshotOccurrence> = {}): EventPageSnapshotOccurrence => ({
  occurrenceId: 'occ-1',
  startsAt: '2027-01-15T20:00:00Z',
  endsAt: '2027-01-16T02:00:00Z',
  localDate: '2027-01-15',
  timezone: 'Europe/London',
  isCancelled: false,
  cancellationReasonLabel: null,
  isLive: false,
  isPast: false,
  isUpcoming: true,
  lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
  ...overrides,
});

const buildSnapshot = (
  lifecycleStatus: string | null,
  occurrences: EventPageSnapshotOccurrence[] = [baseOccurrence()],
): EventPageSnapshot =>
  ({
    eventId: 'event-1',
    occurrenceId: occurrences[0]?.occurrenceId ?? null,
    event: {
      name: 'Bachata Picnic',
      description: null,
      date: '2027-01-15',
      type: 'party',
      timezone: 'Europe/London',
      citySlug: 'london',
      location: null,
      status: 'published',
      lifecycleStatus,
      isPublished: true,
      createdBy: null,
      imageUrl: null,
      posterUrl: null,
      galleryUrls: [],
      musicStyles: [],
      paymentMethods: null,
      level: null,
      keyTimes: null,
      metaDataPublic: {},
      tickets: [],
      promoCodes: [],
      actions: {
        ticketUrl: null,
        websiteUrl: null,
        facebookUrl: null,
        instagramUrl: null,
        whatsappLink: null,
        tiktokUrl: null,
        livestreamUrl: null,
        pricing: null,
      },
    },
    organisers: [],
    organiserCard: { slot1: null, slot2: null },
    occurrences,
    occurrenceEffective: occurrences[0] ?? null,
    locationDefault: { city: null, venue: null, timezone: 'Europe/London' },
    attendance: { goingCount: 0, interestedCount: 0, currentUserStatus: null, preview: [] },
  }) as unknown as EventPageSnapshot;

describe('buildEventPageModel -- paused (on hiatus) derivation', () => {
  it('flags page.isPaused when the series lifecycleStatus is "paused"', () => {
    const model = buildEventPageModel({
      snapshot: buildSnapshot('paused'),
      canEdit: false,
      isLoading: false,
      hasError: false,
    });
    expect(model.page.isPaused).toBe(true);
    // Pause is a series state, not an occurrence cancellation.
    expect(model.page.isCancelled).toBe(false);
  });

  it('does NOT flag page.isPaused for a live series', () => {
    const model = buildEventPageModel({
      snapshot: buildSnapshot('live'),
      canEdit: false,
      isLoading: false,
      hasError: false,
    });
    expect(model.page.isPaused).toBe(false);
  });

  it('is null-safe: a null lifecycleStatus (legacy read path) does not flag paused', () => {
    // Guards the legacy-linked path the review flagged: if the DB ever omits
    // lifecycle_status, isPaused must stay false rather than throw or misfire.
    const model = buildEventPageModel({
      snapshot: buildSnapshot(null),
      canEdit: false,
      isLoading: false,
      hasError: false,
    });
    expect(model.page.isPaused).toBe(false);
  });

  it('paused does not mark the page unavailable (page stays reachable for anon)', () => {
    const model = buildEventPageModel({
      snapshot: buildSnapshot('paused'),
      canEdit: false,
      isLoading: false,
      hasError: false,
    });
    expect(model.page.state).toBe('ready');
  });
});
