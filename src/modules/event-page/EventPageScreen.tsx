import type { EventPageModel, FestivalDetail, FestivalScheduleItem } from '@/modules/event-page/types';
import type { RsvpStatus } from '@/modules/event-page/useEventPageRsvpMutation';
import PageHero from '@/components/PageHero';
import { EventDraftBadge } from '@/modules/event-page/sections/EventDraftBadge';
import { EventHeroMetaBlock } from '@/modules/event-page/sections/EventHeroMetaBlock';
import { EventSocialIcons } from '@/modules/event-page/sections/EventSocialIcons';
import { EventScheduleGrid } from '@/modules/event-page/sections/EventScheduleGrid';
import { EventLineupSection } from '@/modules/event-page/sections/EventLineupSection';
import { EventDescriptionSection } from '@/modules/event-page/sections/EventDescriptionSection';
import { GuestListSection } from '@/modules/event-page/sections/GuestListSection';
import { EventAttendanceSection } from '@/modules/event-page/sections/EventAttendanceSection';
import { EventGuestDancersSection } from '@/modules/event-page/sections/EventGuestDancersSection';
import { EventGallerySection } from '@/modules/event-page/sections/EventGallerySection';
import { EventInfoSection } from '@/modules/event-page/sections/EventInfoSection';
import { EventActionBar } from '@/modules/event-page/sections/EventActionBar';
import { EventMusicStylesSection } from '@/modules/event-page/sections/EventMusicStylesSection';
import { FestivalLineupSection } from '@/modules/event-page/sections/FestivalLineupSection';
import { FestivalProgramSection } from '@/modules/event-page/sections/FestivalProgramSection';
import { FestivalPassesSection } from '@/modules/event-page/sections/FestivalPassesSection';
import { FestivalHotelsSection } from '@/modules/event-page/sections/FestivalHotelsSection';
import { FestivalCompetitionsSection } from '@/modules/event-page/sections/FestivalCompetitionsSection';

type EventPageScreenProps = {
  pageModel: EventPageModel;
  festivalDetail?: FestivalDetail | null;
  eventSchedule?: FestivalScheduleItem[] | null;
  isRsvpPending: boolean;
  setRsvp: (status: RsvpStatus) => Promise<RsvpStatus>;
};

const splitTitle = (name: string): { white: string; orange: string } => {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { white: '', orange: 'Event' };
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) return { white: '', orange: trimmed };
  return { white: trimmed.slice(0, lastSpace), orange: trimmed.slice(lastSpace + 1) };
};

export const EventPageScreen = ({
  pageModel,
  festivalDetail,
  eventSchedule,
  isRsvpPending,
  setRsvp,
}: EventPageScreenProps) => {
  // For festivals, prefer richer links from festival detail (includes whatsapp_link).
  const actions = festivalDetail
    ? {
        ...pageModel.actions,
        ticketUrl: festivalDetail.links.ticketUrl ?? pageModel.actions.ticketUrl,
        websiteUrl: festivalDetail.links.website ?? pageModel.actions.websiteUrl,
        facebookUrl: festivalDetail.links.facebookUrl ?? pageModel.actions.facebookUrl,
        instagramUrl: festivalDetail.links.instagramUrl ?? pageModel.actions.instagramUrl,
        whatsappLink: festivalDetail.links.whatsappLink ?? pageModel.actions.whatsappLink,
        hasAny: Boolean(
          (festivalDetail.links.ticketUrl ?? pageModel.actions.ticketUrl) ||
            (festivalDetail.links.website ?? pageModel.actions.websiteUrl) ||
            (festivalDetail.links.facebookUrl ?? pageModel.actions.facebookUrl) ||
            (festivalDetail.links.instagramUrl ?? pageModel.actions.instagramUrl) ||
            festivalDetail.links.whatsappLink ||
            pageModel.actions.tiktokUrl ||
            pageModel.actions.livestreamUrl,
        ),
      }
    : pageModel.actions;

  // Gallery and music styles: snapshot doesn't expose these; festival detail does.
  const galleryUrls = (festivalDetail?.identity.galleryUrls.length ?? 0) > 0
    ? festivalDetail!.identity.galleryUrls
    : pageModel.galleryUrls;

  const musicStyles = (festivalDetail?.identity.musicStyles.length ?? 0) > 0
    ? festivalDetail!.identity.musicStyles
    : pageModel.identity.musicStyles;

  const guestDancers = festivalDetail && festivalDetail.guestDancers.length > 0
    ? {
        items: festivalDetail.guestDancers.map((d) => ({ ...d, href: `/dancers/${d.id}` })),
        isVisible: true,
      }
    : pageModel.guestDancers;

  const { white, orange } = splitTitle(pageModel.identity.title);

  return (
    <div className="relative min-h-screen bg-background pb-24">
      <EventDraftBadge
        canEdit={pageModel.page.canEdit}
        statusLabel={pageModel.identity.statusLabel}
      />

      <PageHero
        emoji=""
        titleWhite={white}
        titleOrange={orange}
        subtitle=""
        largeTitle
        hideBackground={false}
        breadcrumbItems={[{ label: 'All events', path: '/' }]}
        floatingIcons={[]}
        topPadding="pt-4"
      />

      <div className="mx-auto w-full max-w-2xl space-y-3 px-3 sm:px-4">
        {/* ── Top half (1-5) ── */}

        <EventHeroMetaBlock
          hero={pageModel.hero}
          shortDateLabel={pageModel.schedule.shortDateLabel}
          location={pageModel.location}
          actions={actions}
          promoCodes={pageModel.promoCodes}
          organiser={pageModel.organiser}
        />

        <EventSocialIcons actions={actions} />

        {festivalDetail ? (
          <FestivalProgramSection schedule={festivalDetail.schedule} />
        ) : (
          <EventScheduleGrid
            schedule={pageModel.schedule}
            eventId={pageModel.identity.eventId}
            fallbackSchedule={eventSchedule}
          />
        )}

        {festivalDetail ? (
          <FestivalLineupSection lineup={festivalDetail.lineup} />
        ) : (
          <EventLineupSection lineup={pageModel.lineup} />
        )}

        <EventDescriptionSection description={pageModel.description} />

        <GuestListSection eventId={pageModel.identity.eventId} />

        {/* ── Bottom half (6-11) ── */}

        <EventAttendanceSection attendance={pageModel.attendance} />

        <EventGuestDancersSection guestDancers={guestDancers} />

        <EventGallerySection galleryUrls={galleryUrls} />

        <EventInfoSection eventInfo={pageModel.eventInfo} />

        <EventActionBar
          attendance={pageModel.attendance}
          identity={pageModel.identity}
          schedule={pageModel.schedule}
          location={pageModel.location}
          isPending={isRsvpPending}
          isCancelled={pageModel.schedule.isCancelled}
          setRsvp={setRsvp}
        />

        <EventMusicStylesSection musicStyles={musicStyles} />

        {/* ── Festival-only extras (no 6-11 equivalent; preserved to avoid data loss) ── */}

        {festivalDetail && <FestivalPassesSection passes={festivalDetail.passes} />}
        {festivalDetail && <FestivalHotelsSection hotels={festivalDetail.hotels} />}
        {festivalDetail && <FestivalCompetitionsSection competitions={festivalDetail.competitions} />}
      </div>
    </div>
  );
};
