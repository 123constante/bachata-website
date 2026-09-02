import { describe, expect, it } from 'vitest';
import { buildEventPageModel } from '@/modules/event-page/buildEventPageModel';
import type {
  EventPageSnapshot,
  EventPageSnapshotOccurrence,
} from '@/modules/event-page/types';
import { asWallClock } from '@/lib/time/wallClock';

// Series-termination arc P4. What is actually under test here is the CONTRACT
// between the RPC payload and the page model, not any rendering: `ranFrom` and
// `endedOn` are SCALARS the RPC emits, and the model must never re-derive either
// from `occurrences`. An earlier draft of P4b did derive ranFrom as
// min(localDate) over that array; P4c's review found it, and these are the tests
// that would have found it first.

const occurrence = (
  overrides: Partial<EventPageSnapshotOccurrence> = {},
): EventPageSnapshotOccurrence => ({
  occurrenceId: 'occ-1',
  startsAt: asWallClock('2026-06-28T15:00:00Z'),
  endsAt: asWallClock('2026-06-28T17:00:00Z'),
  localDate: asWallClock('2026-06-28'),
  timezone: 'Europe/London',
  isCancelled: false,
  cancellationReasonLabel: null,
  isLive: false,
  isPast: true,
  isUpcoming: false,
  lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
  ...overrides,
});

type EventOverrides = Partial<EventPageSnapshot['event']>;

const buildSnapshot = (
  eventOverrides: EventOverrides,
  occurrences: EventPageSnapshotOccurrence[] = [occurrence()],
): EventPageSnapshot => ({
  eventId: 'event-1',
  occurrenceId: occurrences[0]?.occurrenceId ?? null,
  event: {
    name: 'June Styling Course',
    description: 'Join me every Sunday this June.',
    date: asWallClock('2026-06-28'),
    type: 'course',
    format: 'course',
    category: 'class',
    timezone: 'Europe/London',
    citySlug: 'london',
    location: null,
    status: 'published',
    lifecycleStatus: 'live',
    endedOn: null,
    ranFrom: null,
    isPublished: true,
    createdBy: null,
    imageUrl: null,
    posterUrl: null,
    galleryUrls: [],
    videoUrls: [],
    musicStyles: [],
    paymentMethods: null,
    level: null,
    keyTimes: null,
    metaDataPublic: {},
    tickets: [],
    promoCodes: [],
    featured: null,
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
    ...eventOverrides,
  },
  organisers: [],
  organiserCard: { slot1: null, slot2: null },
  occurrences,
  occurrenceEffective: occurrences[0] ?? null,
  locationDefault: { city: null, venue: null, timezone: 'Europe/London' },
  attendance: { goingCount: 0, interestedCount: 0, currentUserStatus: null, preview: [] },
});

const model = (snapshot: EventPageSnapshot) =>
  buildEventPageModel({ snapshot, canEdit: false, isLoading: false, hasError: false });

describe('buildEventPageModel -- ended-series derivation', () => {
  it('reports the two ends of the run from the event scalars', () => {
    const page = model(
      buildSnapshot({ lifecycleStatus: 'ended', endedOn: '2026-06-28', ranFrom: '2026-06-07' }),
    ).page;
    expect(page.isEnded).toBe(true);
    expect(page.ranFrom).toBe('2026-06-07');
    expect(page.endedOn).toBe('2026-06-28');
  });

  // THE regression test for the P4c contract. `occurrences` is a capped 52-row
  // window whose server-side order takes FUTURE rows first, so neither end of a
  // long run is guaranteed to be in it. Here the array's earliest row disagrees
  // with the scalar by two years; the scalar must win, unconditionally.
  it('takes ranFrom from the scalar even when the occurrence window disagrees', () => {
    const page = model(
      buildSnapshot(
        { lifecycleStatus: 'ended', endedOn: '2026-06-28', ranFrom: '2024-01-06' },
        [
          occurrence({ occurrenceId: 'occ-1', localDate: asWallClock('2026-06-28') }),
          occurrence({ occurrenceId: 'occ-2', localDate: asWallClock('2026-06-21') }),
        ],
      ),
    ).page;
    expect(page.ranFrom).toBe('2024-01-06');
  });

  // The other half of the same rule, and the one a re-derivation would quietly
  // pass: a payload served before the P4c migration carries no ran_from at all.
  // The page must render date-free copy, NOT invent a start from the window.
  it('leaves ranFrom null on a pre-P4c payload rather than inventing one', () => {
    const page = model(
      buildSnapshot({ lifecycleStatus: 'ended', endedOn: '2026-06-28', ranFrom: null }, [
        occurrence({ occurrenceId: 'occ-1', localDate: asWallClock('2026-06-07') }),
      ]),
    ).page;
    expect(page.isEnded).toBe(true);
    expect(page.endedOn).toBe('2026-06-28');
    expect(page.ranFrom).toBeNull();
  });

  // Belt and braces against a payload whose scalars survive a lifecycle change.
  // The DB coerces ended_on to NULL off 'ended' via a BEFORE trigger, but the
  // page must not depend on that: isEnded is the gate for both dates.
  it('suppresses both dates when the series is not ended', () => {
    const page = model(
      buildSnapshot({ lifecycleStatus: 'live', endedOn: '2026-06-28', ranFrom: '2026-06-07' }),
    ).page;
    expect(page.isEnded).toBe(false);
    expect(page.endedOn).toBeNull();
    expect(page.ranFrom).toBeNull();
  });

  // isEnded is a SERIES fact. A past date on a series that still runs every week
  // is `past`, not ended -- the two drive different renders (thin strip vs the
  // record card) and conflating them would tombstone a live class.
  it('does not treat a past occurrence on a live series as ended', () => {
    expect(model(buildSnapshot({ lifecycleStatus: 'live' })).page.isEnded).toBe(false);
  });

  // The unavailable/error/not-found branches share one NO_LIFECYCLE literal, so
  // a new lifecycle field cannot be added to some of them and missed on others
  // (the W8 bug class). Assert the defaults actually reach a non-ready state.
  it('carries lifecycle defaults through the non-ready states', () => {
    const loading = buildEventPageModel({
      snapshot: null,
      canEdit: false,
      isLoading: true,
      hasError: false,
    }).page;
    expect(loading.isEnded).toBe(false);
    expect(loading.endedOn).toBeNull();
    expect(loading.ranFrom).toBeNull();

    const notFound = buildEventPageModel({
      snapshot: null,
      canEdit: false,
      isLoading: false,
      hasError: false,
    }).page;
    expect(notFound.state).toBe('not-found');
    expect(notFound.isEnded).toBe(false);
    expect(notFound.ranFrom).toBeNull();
  });
});
