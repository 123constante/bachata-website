import type { EventPageModel, FestivalDetail, FestivalScheduleItem } from '@/modules/event-page/types';
import { ShareButton } from '@/components/ShareButton';
import { EventHeroSection } from '@/modules/event-page/sections/EventHeroSection';
import { EventIdentityActionsSection } from '@/modules/event-page/sections/EventIdentityActionsSection';
import { EventScheduleGrid } from '@/modules/event-page/sections/EventScheduleGrid';
import { EventLocationSection } from '@/modules/event-page/sections/EventLocationSection';
import { EventOrganiserSection } from '@/modules/event-page/sections/EventOrganiserSection';
import { EventLineupSection } from '@/modules/event-page/sections/EventLineupSection';
import { EventGuestDancersSection } from '@/modules/event-page/sections/EventGuestDancersSection';
import { EventAttendanceSection } from '@/modules/event-page/sections/EventAttendanceSection';
import { GuestListSection } from '@/modules/event-page/sections/GuestListSection';
import { EventDescriptionSection } from '@/modules/event-page/sections/EventDescriptionSection';
import { EventGallerySection } from '@/modules/event-page/sections/EventGallerySection';
import { EventMusicStylesSection } from '@/modules/event-page/sections/EventMusicStylesSection';
import { EventInfoSection } from '@/modules/event-page/sections/EventInfoSection';
import { EventTicketsSection } from '@/modules/event-page/sections/EventTicketsSection';
import { EventPromoSection } from '@/modules/event-page/sections/EventPromoSection';
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
  onBack: () => void;
  onToggleRsvp: () => void;
};

export const EventPageScreen = ({ pageModel, festivalDetail, eventSchedule, isRsvpPending, onBack, onToggleRsvp }: EventPageScreenProps) => {

  // For festivals, prefer richer links from festival detail (includes whatsapp_link).
  // Snapshot actions are limited: ticket_url, website_url, facebook_url, instagram_url.
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

  return (
    <div className="relative min-h-screen overflow-hidden pb-24 bg-background isolate">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsla(0,0%,100%,0.07),_transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-black/40" />
      </div>

      <div className="relative z-10 pt-[84px] pb-14">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 lg:px-6">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">

            {/* ── Main column ── */}
            <div className="space-y-3">
              <EventHeroSection
                hero={pageModel.hero}
                title={pageModel.identity.title}
                onBack={onBack}
                schedule={festivalDetail?.schedule ?? null}
              />
              <EventIdentityActionsSection
                identity={pageModel.identity}
                actions={actions}
              />
              <div className="flex justify-end">
                <ShareButton
                  eventName={pageModel.identity.title}
                  dateLabel={pageModel.schedule.dateLabel}
                  venueName={pageModel.location.venueName}
                />
              </div>

              {/* Mobile-only: all sidebar content stacked here (hidden on desktop where sidebar shows) */}
              <div className="lg:hidden space-y-3">
                {/* Schedule timeline — non-festival only; festivals use FestivalProgramSection below */}
                {!festivalDetail && (
                  <EventScheduleGrid
                    schedule={pageModel.schedule}
                    eventId={pageModel.identity.eventId}
                    fallbackSchedule={eventSchedule}
                  />
                )}

                {/* Tickets / passes */}
                {festivalDetail
                  ? <FestivalPassesSection passes={festivalDetail.passes} />
                  : <EventTicketsSection tickets={pageModel.tickets} />
                }

                {/* Location + hotels */}
                <EventLocationSection location={pageModel.location} />
                {festivalDetail && <FestivalHotelsSection hotels={festivalDetail.hotels} />}

                {/* Info, promo codes, organiser */}
                <EventInfoSection eventInfo={pageModel.eventInfo} />
                <EventPromoSection promoCodes={pageModel.promoCodes} />
                <EventOrganiserSection organiser={pageModel.organiser} />
              </div>

              {festivalDetail && <FestivalProgramSection schedule={festivalDetail.schedule} />}
              {festivalDetail && <FestivalCompetitionsSection competitions={festivalDetail.competitions} />}

              {/* Guest dancers */}
              {festivalDetail
                ? festivalDetail.guestDancers.length > 0 && (
                    <EventGuestDancersSection
                      guestDancers={{
                        items: festivalDetail.guestDancers.map((d) => ({ ...d, href: `/dancers/${d.id}` })),
                        isVisible: true,
                      }}
                    />
                  )
                : <EventGuestDancersSection guestDancers={pageModel.guestDancers} />
              }

              <EventAttendanceSection
                attendance={pageModel.attendance}
                isPending={isRsvpPending}
                onToggle={onToggleRsvp}
                isCancelled={pageModel.schedule.isCancelled}
              />
              <GuestListSection eventId={pageModel.identity.eventId} />
              <EventDescriptionSection description={pageModel.description} />
              <EventGallerySection galleryUrls={galleryUrls} />
              <EventMusicStylesSection musicStyles={musicStyles} />

              {/* Lineup — at the very bottom as a final summary */}
              {festivalDetail
                ? <FestivalLineupSection lineup={festivalDetail.lineup} />
                : <EventLineupSection lineup={pageModel.lineup} />
              }
            </div>

            {/* ── Sidebar — hidden on mobile ── */}
            <div className="hidden lg:block space-y-3">
              {/* For festivals, FestivalProgramSection in main column handles the detailed schedule */}
              {!festivalDetail && (
                <EventScheduleGrid
                  schedule={pageModel.schedule}
                  eventId={pageModel.identity.eventId}
                  fallbackSchedule={eventSchedule}
                />
              )}

              {/* Festival passes take priority over generic tickets */}
              {festivalDetail
                ? <FestivalPassesSection passes={festivalDetail.passes} />
                : <EventTicketsSection tickets={pageModel.tickets} />
              }

              <EventLocationSection location={pageModel.location} />
              {festivalDetail && <FestivalHotelsSection hotels={festivalDetail.hotels} />}
              <EventInfoSection eventInfo={pageModel.eventInfo} />
              <EventPromoSection promoCodes={pageModel.promoCodes} />
              <EventOrganiserSection organiser={pageModel.organiser} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
