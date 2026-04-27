import { useMemo, useState } from 'react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useEventPage } from '@/modules/event-page/useEventPage';
import { useRecordEventView } from '@/modules/event-page/useRecordEventView';
import { useEventGuestList } from '@/modules/event-page/hooks/useEventGuestList';
import { useGuestListRealtime } from '@/modules/event-page/hooks/useGuestListRealtime';
import {
  BentoGrid,
  BLOCK_COLORS,
  BLOCK_TITLES,
  type BentoBlockId,
  type GridBlockId,
} from '@/modules/event-page/bento/BentoGrid';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { CoverBlock } from '@/modules/event-page/bento/blocks/CoverBlock';
import { DateBlock } from '@/modules/event-page/bento/blocks/DateBlock';
import { DescriptionBlock } from '@/modules/event-page/bento/blocks/DescriptionBlock';
import { ContactsBlock } from '@/modules/event-page/bento/blocks/ContactsBlock';
import { MusicStylesRow } from '@/modules/event-page/bento/blocks/MusicStylesRow';
import { VenueBlock } from '@/modules/event-page/bento/blocks/VenueBlock';
import { ScheduleBlock } from '@/modules/event-page/bento/blocks/ScheduleBlock';
import { PromoBlock } from '@/modules/event-page/bento/blocks/PromoBlock';
import { CityBlock } from '@/modules/event-page/bento/blocks/CityBlock';
import { GuestListBlock } from '@/modules/event-page/bento/blocks/GuestListBlock';
import { RaffleBlock } from '@/modules/event-page/bento/blocks/RaffleBlock';
import { ErrorScreen } from '@/modules/event-page/bento/blocks/ErrorScreen';
import { AddToCalendarChooser } from '@/modules/event-page/bento/modals/AddToCalendarChooser';
import { StickyTicketButton } from '@/modules/event-page/bento/StickyTicketButton';
import type { CalendarEventInput } from '@/modules/event-page/bento/utils/ics';
import { isPast } from '@/modules/event-page/bento/utils/pastEvent';
import { useEventRaffleConfig } from '@/hooks/useEventRaffleConfig';
import { getRaffleSessionId } from '@/lib/raffleSession';

type BentoPageProps = {
  eventId: string | null;
  occurrenceId: string | null;
};

// Copy for the three non-ready states, surfaced through the shared pink-cover
// ErrorScreen. Kept centralised so the three branches don't drift in tone.
const ERROR_COPY: Record<
  'not-found' | 'error' | 'unavailable',
  { title: string; message: string }
> = {
  'not-found': {
    title: 'Event not found',
    message: "The event you're looking for doesn't exist or has been removed.",
  },
  error: {
    title: "Couldn't load this event",
    message: 'Please try again in a moment.',
  },
  unavailable: {
    title: 'Event not available yet',
    message: 'This event is not publicly available to view.',
  },
};

// Loading shimmer placeholder sized to fill a tile's content region.
const TileShimmer = () => (
  <div className="min-h-[24px] flex-1 animate-pulse rounded-md bg-white/10" />
);

export const BentoPage = ({ eventId, occurrenceId }: BentoPageProps) => {
  const { snapshot, pageModel } = useEventPage(eventId, occurrenceId);

  // Phase 6D — drives whether the bento grid reserves a slot for the raffle
  // tile. When the event has no raffle (config.enabled === false), 'raffle' is
  // added to hiddenBlocks below so the packer skips it entirely. RaffleBlock
  // also fetches this internally, but keeping it here is the single source of
  // truth for grid layout.
  const raffleSessionId = typeof window !== 'undefined' ? getRaffleSessionId() : null;
  const { config: raffleConfig } = useEventRaffleConfig(eventId ?? null, raffleSessionId);

  // Mount-time 3s-delay view recording. Identical to old EventPage behaviour.
  useRecordEventView(eventId, 'public_event_page');

  // Guest list fetched once at page level. React Query dedupes by key
  // so GuestListBlock (which self-fetches) hits the same cache. The
  // realtime subscription is mounted here so it stays active for the
  // entire page lifetime and streams INSERTs into the shared cache.
  const { data: guestList } = useEventGuestList(eventId);
  useGuestListRealtime(eventId);

  const [calendarOpen, setCalendarOpen] = useState(false);

  const occurrence = snapshot?.occurrenceEffective ?? null;
  const state = pageModel.page.state;
  const isLoading = state === 'loading';
  // Past-event logic runs only on ready pages. Not-found / error / unavailable
  // short-circuit above; loading would race since occurrence is null then.
  const past = state === 'ready' ? isPast(occurrence) : false;

  const calendarInput: CalendarEventInput | null = useMemo(() => {
    if (!eventId) return null;
    return {
      eventId,
      title: pageModel.identity.title,
      startIso: occurrence?.startsAt ?? null,
      endIso: occurrence?.endsAt ?? null,
      timezone: occurrence?.timezone ?? pageModel.schedule.timezoneLabel ?? null,
      description: pageModel.description.body ?? null,
      locationName: pageModel.location.venueName ?? null,
      locationAddress: pageModel.location.address ?? null,
      pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    };
  }, [eventId, pageModel, occurrence]);

  // Compute which blocks are hidden. Driven by content: a block is hidden iff
  // it has nothing meaningful to show. The BentoGrid packer skips these so no
  // empty grid cells are left behind.
  //
  // During the loading state, nothing is hidden — every tile renders as a
  // shimmer so the skeleton footprint matches the eventual content layout.
  const hiddenBlocks = useMemo<Set<BentoBlockId>>(() => {
    const hidden = new Set<BentoBlockId>();
    if (isLoading) return hidden;

    const hasPromo = pageModel.promoCodes.items.length > 0 && !past;
    // Promo and City are mutually exclusive — they share the top-right 1-col
    // slot next to Date. Whichever one is not showing is marked hidden.
    if (hasPromo) {
      hidden.add('city');
    } else {
      hidden.add('promo');
    }

    // Venue hides when there's no identity to show. Matches VenueBlock's own
    // internal null-return, but hiding at this layer keeps the grid cell out.
    const hasVenue = Boolean(pageModel.location.venueName || pageModel.location.address);
    if (!hasVenue) hidden.add('venue');

    // Description hides when body is empty. Same null-return guard as
    // DescriptionBlock.
    const body = pageModel.description.body;
    if (!body || !body.trim()) hidden.add('description');

    // Guest list hides when disabled, past event, or data hasn't resolved yet.
    if (past || !guestList || !guestList.enabled) hidden.add('guest');

    // Contacts hides when there are zero socials.
    const hasContacts = Boolean(
      pageModel.actions.websiteUrl ||
        pageModel.actions.facebookUrl ||
        pageModel.actions.instagramUrl,
    );
    if (!hasContacts) hidden.add('contacts');

    // Phase 6D — raffle tile hides when no raffle configured on this event.
    // While raffleConfig is still loading we keep the slot in (renders a
    // shimmer); once the answer arrives, an absent or disabled raffle hides
    // the tile so no empty cell or "Prize pool unlocking soon" placeholder
    // appears in the grid.
    if (raffleConfig && !raffleConfig.enabled) hidden.add('raffle');

    return hidden;
  }, [isLoading, past, pageModel, guestList, raffleConfig]);

  if (state === 'not-found' || state === 'error' || state === 'unavailable') {
    const copy = ERROR_COPY[state];
    return (
      <GlobalLayout
        breadcrumbs={[{ label: 'Events' }]}
        // No emoji and no title text on error states — the page chrome
        // (breadcrumb + gradient) frames the page; the ErrorScreen below
        // owns the messaging. Avoids any generic stand-in like 'Event'.
        hero={{ titleWhite: '', titleOrange: '' }}
        gradientPalette="bento"
        floatingCount={0}
      >
        <div
          className="fixed inset-0 -z-20 pointer-events-none"
          style={{ background: 'hsl(var(--bento-surface))' }}
          aria-hidden="true"
        />
        <ErrorScreen
          variant={state}
          title={copy.title}
          message={copy.message}
          eventId={eventId}
          occurrenceId={occurrenceId}
        />
      </GlobalLayout>
    );
  }

  const coverImageUrl = snapshot?.event.imageUrl ?? null;

  const renderBlock = (id: GridBlockId) => {
    if (isLoading) {
      // Cover gets its own tinted shimmer (no title strip) so the skeleton
      // mirrors the real cover tile which also has no title strip.
      if (id === 'cover') {
        return (
          <div
            className="h-full w-full animate-pulse rounded-[22px]"
            style={{ background: BLOCK_COLORS.cover }}
          />
        );
      }
      return (
        <BentoTile title={BLOCK_TITLES[id]} color={BLOCK_COLORS[id]}>
          <TileShimmer />
        </BentoTile>
      );
    }

    switch (id) {
      case 'cover':
        return (
          <CoverBlock
            imageUrl={coverImageUrl}
            galleryUrls={pageModel.galleryUrls}
            title={pageModel.identity.title}
            dateLabel={pageModel.schedule.shortDateLabel}
            venueName={pageModel.location.venueName}
          />
        );
      case 'date':
        return (
          <DateBlock
            occurrence={occurrence}
            // DateBlock still renders the date when past — just not clickable.
            onClick={past ? undefined : () => setCalendarOpen(true)}
          />
        );
      case 'description':
        return <DescriptionBlock body={pageModel.description.body} />;
      case 'contacts':
        return (
          <ContactsBlock
            websiteUrl={pageModel.actions.websiteUrl}
            facebookUrl={pageModel.actions.facebookUrl}
            instagramUrl={pageModel.actions.instagramUrl}
          />
        );
      case 'venue':
        // When the standalone CityBlock is hidden (because PromoBlock is
        // occupying the top-right slot), fold the city name into Venue as a
        // third line so the city is still visible somewhere on the page.
        return (
          <VenueBlock
            location={pageModel.location}
            showCityLine={hiddenBlocks.has('city')}
            eventId={eventId}
          />
        );
      case 'schedule':
        return <ScheduleBlock eventId={eventId} />;
      case 'promo':
        return <PromoBlock codes={pageModel.promoCodes.items} />;
      case 'city':
        return (
          <CityBlock
            cityId={pageModel.location.cityId}
            cityName={pageModel.location.cityName}
          />
        );
      case 'guest':
        return (
          <GuestListBlock
            eventId={eventId}
            eventStartIso={occurrence?.startsAt ?? null}
            eventTimezone={
              occurrence?.timezone ?? pageModel.schedule.timezoneLabel ?? null
            }
          />
        );
      case 'raffle':
        return <RaffleBlock />;
      default:
        return <BentoTile title={BLOCK_TITLES[id]} color={BLOCK_COLORS[id]} />;
    }
  };

  return (
    <GlobalLayout
      breadcrumbs={[{ label: 'Events' }]}
      // No emoji — title-only hero (the first GlobalLayout consumer to do
      // this). titleOrange is gated on state === 'ready' so the loading
      // window shows an empty hero rather than the 'Event' fallback that
      // buildEventPageModel returns when snapshot is null.
      hero={{
        titleWhite: '',
        titleOrange: state === 'ready' ? pageModel.identity.title : '',
      }}
      gradientPalette="bento"
      floatingCount={0}
    >
      {/* Velvet backdrop sits at -z-20, beneath GlobalLayout's bento-tinted
          gradient at -z-10. Preserves the original "themed surface, like a
          Spotify now-playing screen" velvet base from the pre-migration outer
          wrapper, while letting the new brass/plum/velvet gradient play on top. */}
      <div
        className="fixed inset-0 -z-20 pointer-events-none"
        style={{ background: 'hsl(var(--bento-surface))' }}
        aria-hidden="true"
      />

      <div
        className="mx-auto w-full max-w-[430px] px-2 pb-24 pt-4"
        style={{ color: 'hsl(var(--bento-fg))' }}
      >
        {past && (
          <div
            className="mb-3 rounded-md px-3 py-2 text-center text-[11px]"
            style={{
              background: 'hsl(var(--bento-surface-raised))',
              color: 'hsl(var(--bento-fg-muted))',
            }}
          >
            This event has ended.
          </div>
        )}

        <BentoGrid hiddenBlocks={hiddenBlocks} renderBlock={renderBlock} />

        <MusicStylesRow musicStyles={pageModel.identity.musicStyles} />

        <AddToCalendarChooser
          open={calendarOpen}
          onOpenChange={setCalendarOpen}
          event={calendarInput}
        />
      </div>

      {/* Floating brass pill linking to the organiser's external ticket page.
          Self-hides when no ticket URL is set. Fixed-positioned, sits above
          the BottomNav. Placed outside the centred content column so the
          viewport-centered layout is correct on wide screens. */}
      <StickyTicketButton ticketUrl={pageModel.actions.ticketUrl} />
    </GlobalLayout>
  );
};
