import { resolveHeroImage } from '@/lib/utils';
import type { EventPageModel, EventPageSnapshot } from '@/modules/event-page/types';
import { formatWallClockLocal, formatWallClockLocalIntl, type WallClock } from '@/lib/time/wallClock';

type BuildEventPageModelArgs = {
  snapshot: EventPageSnapshot | null;
  canEdit: boolean;
  isLoading: boolean;
  hasError: boolean;
};

const getMonogram = (value: string | null) => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'EV';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
};

const formatDateLabel = (value: WallClock | null) =>
  // Render the day AS STORED (no browser-local / BST shift, no wrong-day).
  formatWallClockLocal(value, 'EEEE, d MMMM yyyy');

const formatTimeLabel = (value: WallClock | null) =>
  formatWallClockLocal(value, 'h:mm a');

const formatShortDateLabel = (value: WallClock | null): string | null =>
  // Read the stored calendar day directly -- the old `timeZone: timezone` shifted
  // the wall clock as if it were a real instant (the BST / wrong-day bug).
  formatWallClockLocalIntl(value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

// Every lifecycle fact the page model carries, in its "nothing is known yet"
// form. The non-ready states (loading / error / not-found) all need the same
// set, and W8 in the admin repo was exactly the bug of a new lifecycle value
// being added to some of a repeated literal and not the rest -- so this is one
// owner rather than four copies to keep in step.
const NO_LIFECYCLE = {
  isCancelled: false,
  cancellationReasonLabel: null,
  isPaused: false,
  isEnded: false,
  endedOn: null,
  ranFrom: null,
} as const;

const EMPTY_PAGE_MODEL: EventPageModel = {
  page: { state: 'loading', canEdit: false, title: '', message: null, ...NO_LIFECYCLE },
  identity: { title: '', eventId: null, occurrenceId: null, statusLabel: null, eventType: null, eventFormat: null, level: null, musicStyles: [] },
  hero: { imageUrl: null, imageAlt: '', monogram: 'EV', mediaState: 'fallback' },
  actions: { ticketUrl: null, websiteUrl: null, facebookUrl: null, instagramUrl: null, whatsappLink: null, tiktokUrl: null, livestreamUrl: null, pricing: null, hasAny: false },
  schedule: { dateLabel: null, shortDateLabel: null, timeLabel: null, timezoneLabel: null, keyTimes: null, isCancelled: false, isVisible: false },
  location: { venueId: null, venueName: null, address: null, postcode: null, googleMapsLink: null, venueImageUrl: null, galleryUrls: [], transportJson: null, venueDescription: null, capacity: null, floorType: null, facilitiesNew: [], venueTimezone: null, cityId: null, cityName: null, locationText: null, timezoneLabel: null, isVisible: false },
  organiser: { person: null, isVisible: false },
  lineup: { groups: [], hasAny: false },
  guestDancers: { items: [], isVisible: false },
  attendance: { goingCount: 0, goingCountLabel: '0 going', interestedCount: 0, currentUserStatus: null, preview: [], ctaLabel: "I'm Going", canToggle: false, isVisible: false },
  description: { body: null, isVisible: false },
  eventInfo: { dressCode: null, ageRestriction: null, paymentMethods: null, isVisible: false },
  tickets: { items: [], isVisible: false },
  promoCodes: { items: [], isVisible: false },
  galleryUrls: [],
  videoUrls: [],
  metaDataPublic: {},
};

const buildReadyPageModel = (snapshot: EventPageSnapshot, canEdit: boolean): EventPageModel => {
  const occurrence = snapshot.occurrenceEffective;
  // Whole-event cancellation: the effective occurrence is cancelled AND
  // there is no other future non-cancelled occurrence in the same series.
  // Lets the page show a sticky banner + hero overlay for fully-dead
  // events while leaving per-date cancellation (one Tuesday in a series)
  // on the existing DateBlock pill treatment.
  const hasOtherLiveFuture = (snapshot.occurrences ?? []).some(
    (o) => o.occurrenceId !== occurrence?.occurrenceId && !o.isCancelled && o.isUpcoming,
  );
  const isWholeEventCancelled = Boolean(occurrence?.isCancelled && !hasOtherLiveFuture);
  const wholeEventCancellationReason = isWholeEventCancelled
    ? occurrence?.cancellationReasonLabel ?? null
    : null;
  // Series-termination arc P4. The series has stopped running for good. The DB
  // guarantees endedOn is non-null exactly when this is true, but the client is
  // not entitled to assume the migration exposing it has been applied yet -- so
  // isEnded is read from the lifecycle alone and the date is treated as optional
  // everywhere downstream. That is what lets the render ship before P4a.
  const isEnded = snapshot.event.lifecycleStatus === 'ended';
  // First night of the run -- the SCALAR the RPC emits (P4c), never re-derived.
  //
  // This used to be min(localDate) over `snapshot.occurrences`, and that was only
  // ever correct by coincidence. The array is a capped 52-row window whose
  // server-side order takes FUTURE rows first
  // (`ORDER BY (materialised_start_utc >= now()) DESC, materialised_start_utc ASC`),
  // and an ended series can still hold future rows -- the P3 prune spares curated
  // ones and cancelled rows are never archived. A series with 52+ of them returns
  // no history at all, so min(localDate) would have printed a FUTURE date as the
  // start of the run. 29 of 72 live series are already over the cap.
  //
  // The definition also differs, deliberately: ran_from counts only 'scheduled'
  // rows and keys on occurrence_date, where the array admits cancelled nights and
  // derives local_date from materialised_start_utc, which an override can shift
  // across a day boundary. "The first night it actually ran" is the intent.
  //
  // Still optional downstream: a payload served before the P4c migration carries
  // no ran_from, and the render must fall back to date-free copy.
  const ranFrom = isEnded ? snapshot.event.ranFrom : null;
  const scheduleRawDate = occurrence?.startsAt ?? occurrence?.localDate ?? snapshot.event.date ?? null;
  const scheduleDate = formatDateLabel(scheduleRawDate);
  const startLabel = formatTimeLabel(occurrence?.startsAt ?? null);
  const endLabel = formatTimeLabel(occurrence?.endsAt ?? null);
  const scheduleTime = startLabel && endLabel ? `${startLabel} - ${endLabel}` : startLabel;
  const scheduleTimezone = occurrence?.timezone ?? snapshot.event.timezone ?? snapshot.locationDefault.timezone ?? null;
  const scheduleShortDate = formatShortDateLabel(scheduleRawDate);
  const lineup = occurrence?.lineup ?? { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] };
  const statusLabel = snapshot.event.isPublished === false || snapshot.event.status === 'draft' ? 'Draft' : null;
  const primaryOrganiser = snapshot.organisers[0] ?? null;
  const meta = snapshot.event.metaDataPublic;
  const dressCode = typeof meta.dress_code === 'string' && meta.dress_code.trim() ? meta.dress_code.trim() : null;
  const ageRestriction = typeof meta.age_restriction === 'string' && meta.age_restriction.trim() ? meta.age_restriction.trim() : null;
  const lineupGroups: EventPageModel['lineup']['groups'] = ([
    { key: 'teachers' as const, label: 'Teachers', items: lineup.teachers.map(p => ({ ...p, href: `/teachers/${p.id}` })) },
    { key: 'djs' as const, label: 'DJs', items: lineup.djs.map(p => ({ ...p, href: `/djs/${p.id}` })) },
    { key: 'vendors' as const, label: 'Vendors', items: lineup.vendors.map(p => ({ ...p, href: `/vendors/${p.id}` })) },
    { key: 'videographers' as const, label: 'Videographers', items: lineup.videographers.map(p => ({ ...p, href: p.href })) },
  ] as EventPageModel['lineup']['groups']).filter((group) => group.items.length > 0);

  const heroImageUrl =
    resolveHeroImage(
      snapshot.event.imageUrl,
      snapshot.organisers[0]?.avatarUrl ?? null,
      snapshot.locationDefault.venue?.image_url ?? null,
    ) ?? snapshot.event.posterUrl ?? snapshot.event.galleryUrls[0] ?? null;

  return {
    page: {
      state: 'ready',
      canEdit,
      title: snapshot.event.name ?? 'Event',
      message: null,
      isCancelled: isWholeEventCancelled,
      cancellationReasonLabel: wholeEventCancellationReason,
      isPaused: snapshot.event.lifecycleStatus === 'paused',
      // Series-termination arc P4. isEnded is the SERIES fact; it is independent
      // of `past`, which is a property of the one occurrence being viewed and is
      // equally true of a past date on a series that still runs every week.
      isEnded,
      endedOn: isEnded ? snapshot.event.endedOn : null,
      ranFrom,
    },
    identity: {
      title: snapshot.event.name ?? 'Event',
      eventId: snapshot.eventId,
      occurrenceId: snapshot.occurrenceId,
      statusLabel,
      eventType: snapshot.event.type,
      eventFormat: snapshot.event.format,
      level: snapshot.event.level,
      musicStyles: snapshot.event.musicStyles,
    },
    hero: {
      imageUrl: heroImageUrl,
      imageAlt: snapshot.event.name ?? 'Event image',
      monogram: getMonogram(snapshot.event.name),
      mediaState: heroImageUrl ? 'image' : 'fallback',
    },
    actions: {
      ticketUrl: snapshot.event.actions.ticketUrl,
      websiteUrl: snapshot.event.actions.websiteUrl,
      facebookUrl: snapshot.event.actions.facebookUrl,
      instagramUrl: snapshot.event.actions.instagramUrl,
      whatsappLink: snapshot.event.actions.whatsappLink,
      tiktokUrl: snapshot.event.actions.tiktokUrl,
      livestreamUrl: snapshot.event.actions.livestreamUrl,
      pricing: snapshot.event.actions.pricing,
      hasAny: Boolean(
        snapshot.event.actions.ticketUrl ||
          snapshot.event.actions.websiteUrl ||
          snapshot.event.actions.facebookUrl ||
          snapshot.event.actions.instagramUrl ||
          snapshot.event.actions.whatsappLink ||
          snapshot.event.actions.tiktokUrl ||
          snapshot.event.actions.livestreamUrl,
      ),
    },
    schedule: {
      dateLabel: scheduleDate,
      shortDateLabel: scheduleShortDate,
      timeLabel: scheduleTime,
      timezoneLabel: scheduleTimezone,
      keyTimes: snapshot.event.keyTimes,
      isCancelled: occurrence?.isCancelled ?? false,
      isVisible: Boolean(scheduleDate || scheduleTime || scheduleTimezone || snapshot.event.keyTimes),
    },
    location: {
      venueId: snapshot.locationDefault.venue?.id ?? null,
      venueName: snapshot.locationDefault.venue?.name ?? null,
      address: snapshot.locationDefault.venue?.address ?? null,
      postcode: snapshot.locationDefault.venue?.postcode ?? null,
      googleMapsLink: snapshot.locationDefault.venue?.google_maps_link ?? null,
      venueImageUrl: snapshot.locationDefault.venue?.image_url ?? null,
      galleryUrls: snapshot.locationDefault.venue?.gallery_urls ?? [],
      transportJson: snapshot.locationDefault.venue?.transport_json ?? null,
      venueDescription: snapshot.locationDefault.venue?.description ?? null,
      capacity: snapshot.locationDefault.venue?.capacity ?? null,
      floorType: snapshot.locationDefault.venue?.floor_type ?? null,
      facilitiesNew: snapshot.locationDefault.venue?.facilities_new ?? [],
      venueTimezone: snapshot.locationDefault.venue?.timezone ?? null,
      cityId: snapshot.locationDefault.city?.id ?? null,
      cityName: snapshot.locationDefault.city?.name ?? null,
      locationText: snapshot.event.location,
      timezoneLabel: snapshot.locationDefault.timezone,
      isVisible: Boolean(
        snapshot.locationDefault.venue?.name ||
          snapshot.locationDefault.venue?.address ||
          snapshot.locationDefault.city?.name ||
          snapshot.event.location,
      ),
    },
    organiser: {
      person: primaryOrganiser,
      isVisible: primaryOrganiser !== null,
    },
    lineup: {
      groups: lineupGroups,
      hasAny: lineupGroups.length > 0,
    },
    guestDancers: {
      items: lineup.dancers,
      isVisible: lineup.dancers.length > 0,
    },
    attendance: {
      goingCount: snapshot.attendance.goingCount,
      goingCountLabel: `${snapshot.attendance.goingCount} going`,
      interestedCount: snapshot.attendance.interestedCount,
      currentUserStatus: snapshot.attendance.currentUserStatus,
      preview: snapshot.attendance.preview,
      ctaLabel: snapshot.attendance.currentUserStatus === 'going' ? "You're Going" : "I'm Going",
      canToggle: snapshot.occurrenceId !== null,
      isVisible: false,
    },
    description: {
      body: snapshot.event.description,
      isVisible: Boolean(snapshot.event.description?.trim()),
    },
    eventInfo: {
      dressCode,
      ageRestriction,
      paymentMethods: snapshot.event.paymentMethods,
      isVisible: Boolean(dressCode || ageRestriction || snapshot.event.paymentMethods),
    },
    tickets: {
      items: snapshot.event.tickets,
      isVisible: snapshot.event.tickets.length > 0,
    },
    promoCodes: {
      items: snapshot.event.promoCodes,
      isVisible: snapshot.event.promoCodes.length > 0,
    },
    galleryUrls: snapshot.event.galleryUrls,
    videoUrls: snapshot.event.videoUrls,
    metaDataPublic: snapshot.event.metaDataPublic,
  };
};

export const buildEventPageModel = ({ snapshot, canEdit, isLoading, hasError }: BuildEventPageModelArgs): EventPageModel => {
  if (isLoading) {
    return { ...EMPTY_PAGE_MODEL, page: { state: 'loading', canEdit, title: 'Loading event', message: null, ...NO_LIFECYCLE } };
  }

  if (hasError && !snapshot) {
    return {
      ...EMPTY_PAGE_MODEL,
      page: { state: 'error', canEdit, title: 'Unable to Load Event', message: 'Please try again in a moment.', ...NO_LIFECYCLE },
    };
  }

  if (!snapshot) {
    return {
      ...EMPTY_PAGE_MODEL,
      page: { state: 'not-found', canEdit, title: 'Event Not Found', message: "The event you're looking for doesn't exist or has been removed.", ...NO_LIFECYCLE },
    };
  }

  const readyPageModel = buildReadyPageModel(snapshot, canEdit);
  if ((snapshot.event.isPublished === false || snapshot.event.status === 'draft') && !canEdit) {
    return {
      ...readyPageModel,
      page: {
        state: 'unavailable',
        canEdit,
        title: 'Event Not Available',
        message: 'This event is not publicly available yet.',
        isCancelled: readyPageModel.page.isCancelled,
        cancellationReasonLabel: readyPageModel.page.cancellationReasonLabel,
        isPaused: readyPageModel.page.isPaused,
        isEnded: readyPageModel.page.isEnded,
        endedOn: readyPageModel.page.endedOn,
        ranFrom: readyPageModel.page.ranFrom,
      },
    };
  }

  return readyPageModel;
};
