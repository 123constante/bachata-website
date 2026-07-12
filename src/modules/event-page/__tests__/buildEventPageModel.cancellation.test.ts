import { describe, expect, it } from 'vitest';
import { buildEventPageModel } from '@/modules/event-page/buildEventPageModel';
import type {
  EventPageSnapshot,
  EventPageSnapshotOccurrence,
} from '@/modules/event-page/types';
import { asWallClock } from '@/lib/time/wallClock';

const baseOccurrence = (overrides: Partial<EventPageSnapshotOccurrence> = {}): EventPageSnapshotOccurrence => ({
  occurrenceId: 'occ-1',
  startsAt: asWallClock('2027-01-15T20:00:00Z'),
  endsAt: asWallClock('2027-01-16T02:00:00Z'),
  localDate: asWallClock('2027-01-15'),
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
  occurrences: EventPageSnapshotOccurrence[],
  effectiveIndex = 0,
): EventPageSnapshot => ({
  eventId: 'event-1',
  occurrenceId: occurrences[effectiveIndex]?.occurrenceId ?? null,
  event: {
    name: 'Pulse Bachata Friday',
    description: null,
    date: asWallClock('2027-01-15'),
    type: 'party',
    timezone: 'Europe/London',
    citySlug: 'london',
    location: null,
    status: 'published',
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
  occurrenceEffective: occurrences[effectiveIndex] ?? null,
  locationDefault: { city: null, venue: null, timezone: 'Europe/London' },
  attendance: { goingCount: 0, interestedCount: 0, currentUserStatus: null, preview: [] },
});

describe('buildEventPageModel -- whole-event cancellation derivation', () => {
  it('flags page.isCancelled when a one-off cancelled event is the only occurrence', () => {
    const snapshot = buildSnapshot([
      baseOccurrence({
        occurrenceId: 'occ-1',
        isCancelled: true,
        cancellationReasonLabel: 'Venue closed',
      }),
    ]);
    const model = buildEventPageModel({ snapshot, canEdit: false, isLoading: false, hasError: false });
    expect(model.page.isCancelled).toBe(true);
    expect(model.page.cancellationReasonLabel).toBe('Venue closed');
  });

  it('does NOT flag page.isCancelled when one occurrence is cancelled but another future date is live', () => {
    const snapshot = buildSnapshot([
      baseOccurrence({ occurrenceId: 'occ-tue', isCancelled: true, cancellationReasonLabel: 'Teacher sick' }),
      baseOccurrence({ occurrenceId: 'occ-thu', isCancelled: false, isUpcoming: true }),
    ]);
    const model = buildEventPageModel({ snapshot, canEdit: false, isLoading: false, hasError: false });
    expect(model.page.isCancelled).toBe(false);
    expect(model.page.cancellationReasonLabel).toBeNull();
    // The schedule-level flag is still set so DateBlock keeps its pill.
    expect(model.schedule.isCancelled).toBe(true);
  });

  it('flags page.isCancelled when every occurrence in a recurring series is cancelled', () => {
    const snapshot = buildSnapshot([
      baseOccurrence({ occurrenceId: 'occ-tue', isCancelled: true }),
      baseOccurrence({ occurrenceId: 'occ-thu', isCancelled: true, isUpcoming: true }),
    ]);
    const model = buildEventPageModel({ snapshot, canEdit: false, isLoading: false, hasError: false });
    expect(model.page.isCancelled).toBe(true);
  });

  it('flags page.isCancelled when the only other live-status occurrence is in the past (no future left)', () => {
    const snapshot = buildSnapshot([
      baseOccurrence({ occurrenceId: 'occ-current', isCancelled: true }),
      baseOccurrence({ occurrenceId: 'occ-past', isCancelled: false, isUpcoming: false, isPast: true }),
    ]);
    const model = buildEventPageModel({ snapshot, canEdit: false, isLoading: false, hasError: false });
    expect(model.page.isCancelled).toBe(true);
  });

  it('does not flag page.isCancelled on a non-cancelled event even if other dates are cancelled', () => {
    const snapshot = buildSnapshot([
      baseOccurrence({ occurrenceId: 'occ-current', isCancelled: false }),
      baseOccurrence({ occurrenceId: 'occ-other', isCancelled: true, isUpcoming: true }),
    ]);
    const model = buildEventPageModel({ snapshot, canEdit: false, isLoading: false, hasError: false });
    expect(model.page.isCancelled).toBe(false);
    expect(model.page.cancellationReasonLabel).toBeNull();
  });
});
