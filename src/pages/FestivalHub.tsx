import { useMemo, useState, useEffect, type MouseEvent } from "react";
import { PageErrorBoundary } from "@/components/ErrorBoundary";
import { motion } from "framer-motion";
import { Users, Home, Car, Heart, ChevronRight, Plane, Music, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/ScrollReveal";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { FESTIVALS_LIST_QUERY_KEY, fetchPublicFestivalsList, filterUpcomingFestivals, type FestivalListItem } from "@/lib/festivalsList";
import { londonTodayKey } from "@/lib/londonDate";
import { AuthPromptModal } from "@/components/AuthPromptModal";
import { GOING_CHECKIN_ENABLED } from "@/lib/goingCheckin";
import { festivalCountLabel } from "@/pages/festivalCountLabel";
import { GOING_COPY } from "@/modules/going/goingCopy";
import { fetchFestivalNight, festivalNightQueryKey } from "@/pages/festivalHubNights";
import { FestivalGoing } from "@/pages/FestivalHubGoing";

// Confetti particle component
const ConfettiParticle = ({ delay, startX }: { delay: number; startX: number }) => (
  <motion.div
    initial={{ y: -20, x: startX, opacity: 0, rotate: 0 }}
    animate={{
      y: ["0vh", "100vh"],
      x: [startX, startX + (Math.random() - 0.5) * 100],
      opacity: [0, 1, 1, 0],
      rotate: [0, 360, 720]
    }}
    transition={{
      duration: 4 + Math.random() * 2,
      delay,
      repeat: Infinity,
      ease: "linear"
    }}
    className="absolute text-lg pointer-events-none"
    style={{ left: `${startX}%` }}
  >
    {["‰", "Š", "¨", "­", "ª", " ", "¡", "¥³", "’ƒ", "•º"][Math.floor(Math.random() * 10)]}
  </motion.div>
);

const FestivalHubInner = () => {
  // No useSeo() here: FestivalHub renders only under app/routes/festivals.tsx,
  // which wraps in InitialVisiblePageTransition and so sets RouteOwnsHeadContext --
  // useSeo returns before touching the head. That route's meta() owns it, from the
  // same buildSeoForRoute('festivals'). Which useSeo calls are inert and which are
  // live is a census, not a rule of thumb -- see BentoPage.tsx (arc W22).
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [, setTick] = useState(0);
  // The countdown is time-derived (getCountdown reads `now`), so its text differs
  // between the build-time prerender and the client's first render → React #425
  // hydration mismatch. (suppressHydrationWarning doesn't help: framer-motion's
  // motion.div drops that React-special prop.) Gate the pill on mount so server +
  // client-first-render agree (pill absent), then it appears + ticks client-side.
  const [mounted, setMounted] = useState(false);

  // Update countdown every second
  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const getCountdown = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff <= 0) return "Now!";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h`;
  };

  const { data: festivals = [] } = useQuery({
    queryKey: FESTIVALS_LIST_QUERY_KEY,
    queryFn: fetchPublicFestivalsList,
    // Matches the ISR edge window (s-maxage=3600) -- the /festivals loader
    // dehydrates this key; see useEventPageQuery for the full rationale. The
    // going reads below stay short-lived (they're personalised and never
    // dehydrated).
    staleTime: 1000 * 60 * 60,
    // The RPC returns every public festival, past included; the shared rule (as the
    // home rail) keeps upcoming only. select re-runs on render, so London midnight rolls over.
    select: (rows: FestivalListItem[]) => filterUpcomingFestivals(rows, londonTodayKey()),
  });

  const festivalIds = useMemo(() => festivals.map((festival) => festival.id), [festivals]);

  // Each festival's ONE night (its P5 occurrence id), only while the going switch
  // is on: off = no request at all. One small read per card; the going read
  // itself is ONE batched request for every card (FestivalGoing's batchIds).
  const nightQueries = useQueries({
    queries: festivalIds.map((id) => ({
      queryKey: festivalNightQueryKey(id),
      queryFn: () => fetchFestivalNight(id),
      enabled: GOING_CHECKIN_ENABLED,
      staleTime: 1000 * 60 * 5,
    })),
  });
  const nightsReady = GOING_CHECKIN_ENABLED && nightQueries.every((q) => !q.isPending);
  // Keyed on the ids, not the query objects (useQueries returns a fresh array every render).
  const nightIdsKey = nightQueries.map((q) => q.data?.occurrenceId).filter(Boolean).join(',');
  const nightIds = useMemo(() => (nightIdsKey ? nightIdsKey.split(',') : []), [nightIdsKey]);
  // The clock for "night ended", read after mount (see `mounted`).
  const now = mounted ? new Date() : null;

  const heroWidgets = [
    { emoji: "🎪", title: "Festivals", desc: "Upcoming events", sectionId: "festivals" },
    { emoji: "🏠", title: "Roommates", desc: "Share costs", sectionId: "festivals" },
    { emoji: "🚕", title: "Travel", desc: "Taxi buddies", sectionId: "festivals" },
    { emoji: "💃", title: "Partners", desc: "Pre-plan dances", sectionId: "festivals" },
  ];

  const floatingIcons = [Plane, Music, Heart, Star, Home, Users];

  return (
    <GlobalLayout
      showSubheader={false}
      showGradientBg={false}
      hero={{
        emoji: '🎪',
        titleWhite: 'Festival',
        titleOrange: 'Hub',
        subtitle: '',
        widgets: heroWidgets,
        floatingIcons: floatingIcons,
        largeTitle: true,
      }}
    >
      {/* Animated Confetti Background — preserved as custom page background.
          Mount-gated: each particle rolls Math.random() for its emoji, position
          and motion props, so a server/prerender render never matches the client
          render → hydration text/structure mismatch (React #425/#418) on every
          particle. It's purely decorative (no SEO value), so render nothing on the
          server + first client render, then let it appear post-hydration. */}
      {mounted && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          {Array.from({ length: 15 }).map((_, i) => (
            <ConfettiParticle key={i} delay={i * 0.3} startX={Math.random() * 100} />
          ))}
        </div>
      )}

      {/* Carnival Gradient Background — preserved as custom page background */}
      <div className="fixed inset-0 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-orange-500/10 pointer-events-none z-0" />

      <section className="mx-auto max-w-3xl px-4 pt-3 pb-1 relative z-10">
        <p className="text-sm sm:text-base leading-relaxed text-muted-foreground text-center">
          Upcoming bachata festivals and congresses - weekend intensives,
          international line-ups, and travel-worthy events across the UK and Europe.
          Looking for weekly socials instead? See the{' '}
          <Link to="/parties" className="text-primary underline">parties listing</Link>.
        </p>
      </section>

      {/* Stats */}
      {festivalCountLabel(festivals.length) && (
        <div className="flex items-center justify-center gap-2 mt-2 mb-6 relative z-10">
          <span className="text-xs text-muted-foreground">
            {festivalCountLabel(festivals.length)}
          </span>
        </div>
      )}

      {/* Festival Cards Grid */}
      <section id="festivals" className="px-4 mb-24 relative z-10">
        <StaggerContainer staggerDelay={0.15} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {festivals.map((festival, index) => {
            const nightQuery = nightQueries[index];
            const startDateRaw = festival.date || festival.start_time;
            const startDate = startDateRaw ? new Date(startDateRaw) : null;
            const dateLabel = startDate
              ? startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/London' })
              : 'Date TBA';
            const locationLabel = festival.city || 'Location TBA';

            return (
              <StaggerItem key={festival.id}>
                <motion.div
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    className="p-6 bg-gradient-to-br from-card via-card to-primary/5 border-primary/20 hover:border-primary/40 transition-all cursor-pointer overflow-hidden relative"
                    onClick={() => navigate(`/event/${festival.id}`)}
                  >
                    {/* Carnival stripe decoration */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500" />

                    {/* Festival Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">★</span>
                          <h3 className="font-bold text-foreground text-lg">{festival.name}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{dateLabel} · {locationLabel}</p>
                      </div>
                      {mounted && (
                        <motion.div
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full"
                        >
                          {startDate ? getCountdown(startDate) : 'TBA'}
                        </motion.div>
                      )}
                    </div>

                    {/* Dance Styles */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      <span className="text-[10px] bg-accent/50 text-accent-foreground px-2 py-0.5 rounded-full">
                        Festival
                      </span>
                    </div>

                    {/* Who's going to this festival's night (Going P2): behind the switch. */}
                    {GOING_CHECKIN_ENABLED && (
                      <FestivalGoing
                        festivalId={festival.id}
                        night={nightQuery?.data}
                        nightFailed={Boolean(nightQuery?.isError)}
                        onRetryNight={() => void nightQuery?.refetch()}
                        batchIds={nightIds}
                        ready={nightsReady}
                        now={now}
                        onSignIn={() => setShowAuthModal(true)}
                      />
                    )}
                    {/* Crew Finder Stats */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full">
                        <Home className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px]">{festival.roommatesLooking}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full">
                        <Car className="w-3 h-3 text-yellow-400" />
                        <span className="text-[10px]">{festival.taxiBuddiesLooking}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full">
                        <Heart className="w-3 h-3 text-pink-400" />
                        <span className="text-[10px]">{festival.dancePartnersLooking}</span>
                      </div>
                    </div>

                    {/* View Details Arrow */}
                    <div className="flex items-center justify-center mt-3 text-primary">
                      <span className="text-[10px]">View details & find crew</span>
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </div>
                  </Card>
                </motion.div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </section>

      {/* Bottom CTA */}
      <ScrollReveal animation="scale" duration={0.8}>
        <section className="px-4 mt-24 mb-16 relative z-10">
          <Card className="p-6 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-orange-500/20 border-primary/20 text-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <span className="text-2xl">Š</span>
            </motion.div>
            <h3 className="text-xl font-bold text-foreground mt-2">More festivals coming soon!</h3>
            <p className="text-xs text-muted-foreground mt-1">We're adding new festivals every week</p>
          </Card>
        </section>
      </ScrollReveal>

      <AuthPromptModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        title={GOING_COPY.signInTitle}
        description={GOING_COPY.signInBody}
        returnTo="/festivals"
      />
    </GlobalLayout>
  );
};

const FestivalHub = () => (
  <PageErrorBoundary>
    <FestivalHubInner />
  </PageErrorBoundary>
);

export default FestivalHub;
