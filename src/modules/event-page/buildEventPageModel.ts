import { format } from 'date-fns';
import { resolveHeroImage } from '@/lib/utils';
import type { EventPageModel, EventPageSnapshot } from '@/modules/event-page/types';

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

const formatDateLabel = (value: string | null) => {
  if (!value) return null;
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : format(parsedDate, 'EEEE, MMMM d, yyyy');
};

const formatTimeLabel = (value: string | null) => {
  if (!value) return null;
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : format(parsedDate, 'h:mm a');
};

const EMPTY_PAGE_MODEL: EventPageModel = {
  page: { state: 'loading', canEdit: false, title: '', message: null },
  identity: { title: '', eventId: null, occurrenceId: null, statusLabel: null, eventType: null, musicStyles: [] },
  hero: { imageUrl: null, imageAlt: '', monogram: 'EV', mediaState: 'fallback' },
  actions: { ticketUrl: null, websiteUrl: null, facebookUrl: null, instagramUrl: null, whatsappLink: null, tiktokUrl: null, livestreamUrl: null, pricing: null, hasAny: false },
  schedule: { dateLabel: null, timeLabel: null, timezoneLabel: null, keyTimes: null, isCancelled: false, isVisible: false },
  location: { venueId: null, venueName: null, address: null, postcode: null, googleMapsLink: null, venueImageUrl: null, galleryUrls: [], transportJson: null, venueDescription: null, capacity: null, floorType: null, facilitiesNew: [], venueTimezone: null, cityName: null, locationText: null, timezoneLabel: null, isVisible: false },
  organiser: { person: null, isVisible: false },
  lineup: { groups: [], hasAny: false },
  guestDancers: { items: [], isVisible: false },
  attendance: { goingCount: 0, goingCountLabel: '0 going', currentUserStatus: null, preview: [], ctaLabel: "I'm Going", canToggle: false, isVisible: false },
  description: { body: null, isVisible: false },
  eventInfo: { dressCode: null, ageRestriction: null, paymentMethods: null, isVisible: false },
  tickets: { items: [], isVisible: false },
  promoCodes: { items: [], isVisible: false },
  galleryUrls: [],
  metaDataPublic: {},
};

const buildReadyPageModel = (snapshot: EventPageSnapshot, canEdit: boolean): EventPageModel => {
  const occurrence = snapshot.occurrenceEffective;
  const scheduleDate = formatDateLabel(occurrence?.startsAt ?? occurrence?.localDate ?? snapshot.event.date ?? null);
  const startLabel = formatTimeLabel(occurrence?.startsAt ?? null);
  const endLabel = formatTimeLabel(occurrence?.endsAt ?? null);
  const scheduleTime = startLabel && endLabel ? `${startLabel} - ${endLabel}` : startLabel;
  const scheduleTimezone = occurrence?.timezone ?? snapshot.event.timezone ?? snapshot.locationDefault.timezone ?? null;
  const lineup = occurrence?.lineup ?? { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] };
  const statusLabel = snapshot.event.isPublished === false || snapshot.event.status === 'draft' ? 'Draft' : null;
  const primaryOrganiser = snapshot.organisers[0] ?? null;
  const meta = snapshot.event.metaDataPublic;
  const dressCode = typeof meta.dress_code === 'string' && meta.dress_code.trim() ? meta.dress_code.trim() : null;
  const ageRestriction = typeof meta.age_restriction === 'string' && meta.age_restriction.trim() ? meta.age_restriction.trim() : null;
  const lineupGroups: EventPageModel['lineup']['groups'] = ([
    { key: 'teachers' as const, label: 'Teachers', items: lineup.teachers.map(p => ({ ...p, href: `/teachers/${p.id}` })) },
    { key: 'djs' as const, label: 'DJs', items: lineup.djs.map(p => ({ ...p, href: `/djs/${p.id}` })) },
    { key: 'videographers' as const, label: 'Videographers', items: lineup.videographers.map(p => ({ ...p, href: p.href })) },
    { key: 'vendors' as const, label: 'Vendors', items: lineup.vendors.map(p => ({ ...p, href: p.href })) },
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
    },
    identity: {
      title: snapshot.event.name ?? 'Event',
      eventId: snapshot.eventId,
      occurrenceId: snapshot.occurrenceId,
      statusLabel,
      eventType: snapshot.event.type,
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
    metaDataPublic: snapshot.event.metaDataPublic,
  };
};

export const buildEventPageModel = ({ snapshot, canEdit, isLoading, hasError }: BuildEventPageModelArgs): EventPageModel => {
  if (isLoading) {
    return { ...EMPTY_PAGE_MODEL, page: { state: 'loading', canEdit, title: 'Loading event', message: null } };
  }

  if (hasError && !snapshot) {
    return {
      ...EMPTY_PAGE_MODEL,
      page: { state: 'error', canEdit, title: 'Unable to Load Event', message: 'Please try again in a moment.' },
    };
  }

  if (!snapshot) {
    return {
      ...EMPTY_PAGE_MODEL,
      page: { state: 'not-found', canEdit, title: 'Event Not Found', message: "The event you're looking for doesn't exist or has been removed." },
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
      },
    };
  }

  return readyPageModel;
};