import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEventPage } from '@/modules/event-page/useEventPage';
import { useRecordEventView } from '@/modules/event-page/useRecordEventView';
import { useEventGuestList } from '@/modules/event-page/hooks/useEventGuestList';
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
import { ErrorScreen } from '@/modules/event-page/bento/blocks/ErrorScreen';
import { AddToCalendarChooser } from '@/modules/event-page/bento/modals/AddToCalendarChooser';
import { SeeAllGuestsDrawer } from '@/modules/event-page/bento/modals/SeeAllGuestsDrawer';
import { JoinGuestListDialog } from '@/modules/event-page/bento/modals/JoinGuestListDialog';
import type { CalendarEventInput } from '@/modules/event-page/bento/utils/ics';
import { isPast } from '@/modules/event-page/bento/utils/pastEvent';

type BentoPageProps = {
  eventId: string | null;
  occurrenceId: string | null;
};

const splitTitle = (name: string): { white: string; orange: string } => {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { white: '', orange: 'Event' };
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) return { white: '', orange: trimmed };
  return { white: trimmed.slice(0, lastSpace), orange: trimmed.slice(lastSpace + 1) };
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

  // Mount-time 3s-delay view recording. Identical to old EventPage behaviour.
  useRecordEventView(eventId, 'public_event_page');

  // Guest list fetched once at page level. React Query dedupes by key so the
  // nested GuestListSection inside JoinGuestListDialog hits the same cache.
  const { data: guestList } = useEventGuestList(eventId);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [seeAllOpen, setSeeAllOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

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

    return hidden;
  }, [isLoading, past, pageModel, guestList]);

  if (state === 'not-found' || state === 'error' || state === 'unavailable') {
    const copy = ERROR_COPY[state];
    return (
      <ErrorScreen
        variant={state}
        title={copy.title}
        message={copy.message}
        eventId={eventId}
        occurrenceId={occurrenceId}
      />
    );
  }

  const { white, orange } = splitTitle(pageModel.identity.title);
  const coverImageUrl = snapshot?.event.imageUrl ?? null;
  const organiser = pageModel.organiser.person;

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
            data={guestList ?? null}
            onSeeAll={() => setSeeAllOpen(true)}
            onJoin={() => setJoinOpen(true)}
          />
        );
      default:
        return <BentoTile title={BLOCK_TITLES[id]} color={BLOCK_COLORS[id]} />;
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] px-2 pb-24 pt-4">
      {past && (
        <div className="mb-3 rounded-md bg-white/5 px-3 py-2 text-center text-[11px] text-white/60">
          This event has ended.
        </div>
      )}

      {/* Header: event title in Fraunces with gold-accented last word, plus
          organiser byline. Now sits above the grid (cover moved into the grid
          as a 2-col top-left tile). */}
      <div className="px-1 pb-3 pt-1 text-center">
        {isLoading ? (
          <>
            <div className="mx-auto h-6 w-3/4 animate-pulse rounded bg-white/10" />
            <div className="mx-auto mt-2 h-3 w-1/3 animate-pulse rounded bg-white/10" />
          </>
        ) : (
          <>
            <h1
              className="text-[28px] font-bold leading-[0.95] tracking-[-0.03em]"
              style={{ fontFamily: '"Fraunces", Georgia, serif' }}
            >
              {white && <span>{white} </span>}
              <span style={{ color: 'hsl(33 100% 50%)' }}>{orange}</span>
            </h1>
            {organiser?.displayName && (
              <p className="mt-1 text-[11px] tracking-[0.02em] text-white/60">
                by{' '}
                {organiser.href ? (
                  <Link to={organiser.href} className="font-semibold text-white">
                    {organiser.displayName}
                  </Link>
                ) : (
                  <span className="font-semibold text-white">{organiser.displayName}</span>
                )}
              </p>
            )}
          </>
        )}
      </div>

      <BentoGrid hiddenBlocks={hiddenBlocks} renderBlock={renderBlock} />

      <MusicStylesRow musicStyles={pageModel.identity.musicStyles} />

      <AddToCalendarChooser
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        event={calendarInput}
      />
      <SeeAllGuestsDrawer
        open={seeAllOpen}
        onOpenChange={setSeeAllOpen}
        entries={guestList?.entries ?? []}
      />
      <JoinGuestListDialog open={joinOpen} onOpenChange={setJoinOpen} eventId={eventId} />
    </div>
  );
};
