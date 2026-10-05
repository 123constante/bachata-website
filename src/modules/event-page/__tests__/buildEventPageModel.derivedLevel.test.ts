import { describe, expect, it } from 'vitest';
import { buildEventPageModel } from '@/modules/event-page/buildEventPageModel';
import type { EventPageSnapshot } from '@/modules/event-page/types';
import { asWallClock } from '@/lib/time/wallClock';

const occurrence = {
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
};

const buildSnapshot = (extra: Record<string, unknown>): EventPageSnapshot =>
  ({
    eventId: 'event-1',
    occurrenceId: 'occ-1',
    event: {
      name: 'Bachata Picnic',
      description: null,
      date: '2027-01-15',
      type: 'party',
      timezone: 'Europe/London',
      citySlug: 'london',
      location: null,
      status: 'published',
      lifecycleStatus: null,
      level: 'beginner',
      musicStyles: [],
      isPublished: true,
      createdBy: null,
      imageUrl: null,
      posterUrl: null,
      galleryUrls: [],
      paymentMethods: null,
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
      ...extra,
    },
    organisers: [],
    organiserCard: { slot1: null, slot2: null },
    occurrences: [occurrence],
    occurrenceEffective: occurrence,
    locationDefault: { city: null, venue: null, timezone: 'Europe/London' },
    attendance: { goingCount: 0, interestedCount: 0, currentUserStatus: null, preview: [] },
  } as unknown as EventPageSnapshot);

const build = (extra: Record<string, unknown>) => buildEventPageModel({ snapshot: buildSnapshot(extra) });

describe('buildEventPageModel derived level', () => {
  it('passes derived level and vote count through, keeping stored level', () => {
    const { identity } = build({ derivedLevel: 'advanced', levelVoteCount: 9 });
    expect(identity.derivedLevel).toBe('advanced');
    expect(identity.levelVoteCount).toBe(9);
    expect(identity.level).toBe('beginner');
  });

  it('keeps null when under the rating threshold', () => {
    const { identity } = build({ derivedLevel: null, levelVoteCount: 3 });
    expect(identity.derivedLevel).toBeNull();
    expect(identity.levelVoteCount).toBe(3);
  });

  it('is null-safe when the keys are absent (older cached payload)', () => {
    const { identity } = build({});
    expect(identity.derivedLevel).toBeNull();
    expect(identity.levelVoteCount).toBeNull();
    expect(identity.level).toBe('beginner');
  });
});
