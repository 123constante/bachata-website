import { useMemo, useState, useEffect, type MouseEvent } from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { Users, Home, Car, Heart, MessageCircle, ChevronRight, Plane, Music, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/ScrollReveal";
import PageHero from "@/components/PageHero";
import { FloatingElements } from "@/components/FloatingElements";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AuthPromptModal } from "@/components/AuthPromptModal";
import { setAttendanceRpc, type AttendanceStatus } from "@/hooks/useAttendance";

type FestivalEvent = {
  id: string;
  name: string;
  city: string | null;
  date: string | null;
  start_time: string | null;
  poster_url: string | null;
};

type AttendanceCounts = {
  interested_count: number;
  going_count: number;
};

type AttendeePreview = {
  event_id: string;
  user_id: string;
  avatar_url: string | null;
  username: string | null;
};

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
    {["‰", "Š", "¨", "­", "ª", " ", "¡", "¥³", "’ƒ", "•º"][Math.floor(Math.random() * 10)]}
  </motion.div>
);

const FestivalHub = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authReturnTo, setAuthReturnTo] = useState<string | null>(null);
  const [pendingByEvent, setPendingByEvent] = useState<Record<string, AttendanceStatus | null>>({});
  const [optimisticStatusByEvent, setOptimisticStatusByEvent] = useState<Record<string, AttendanceStatus | null>>({});
  const [, setTick] = useState(0);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  // Update countdown every second
  useEffect(() => {
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
    queryKey: ['festival-events-live'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, city, date, start_time, poster_url')
        .eq('type', 'festival')
        .eq('is_published', true)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data || []) as FestivalEvent[];
    },
    staleTime: 1000 * 60 * 2,
  });

  const festivalIds = useMemo(() => festivals.map((festival) => festival.id), [festivals]);

  const {
    data: countRows = [],
    refetch: refetchCounts,
  } = useQuery({
    queryKey: ['festival-attendance-counts', festivalIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_event_attendance_counts', {
        p_event_ids: festivalIds,
      });
      if (!error) {
        return (data || []) as Array<{ event_id: string; interested_count: number; going_count: number }>;
      }

      const isSchemaCacheError =
        error.code === 'PGRST202' ||
        (typeof error.message === 'string' && error.message.toLowerCase().includes('schema cache'));

      if (!isSchemaCacheError) throw error;

      const { data: participantRows, error: fallbackError } = await supabase
        .from('event_participants')
        .select('event_id, status')
        .in('event_id', festivalIds)
        .in('status', ['going', 'interested']);

      if (fallbackError) throw fallbackError;

      const counts = new Map<string, AttendanceCounts>();
      (participantRows || []).forEach((row) => {
        const current = counts.get(row.event_id) || { interested_count: 0, going_count: 0 };
        if (row.status === 'going') current.going_count += 1;
        if (row.status === 'interested') current.interested_count += 1;
        counts.set(row.event_id, current);
      });

      return Array.from(counts.entries()).map(([event_id, value]) => ({
        event_id,
        interested_count: value.interested_count,
        going_count: value.going_count,
      }));
    },
    enabled: festivalIds.length > 0,
    staleTime: 1000 * 30,
  });

  const countsByEvent = useMemo(() => {
    const map = new Map<string, AttendanceCounts>();
    countRows.forEach((row) => {
      map.set(row.event_id, {
        interested_count: row.interested_count,
        going_count: row.going_count,
      });
    });
    return map;
  }, [countRows]);

  const {
    data: statusRows = [],
    refetch: refetchStatuses,
  } = useQuery({
    queryKey: ['festival-attendance-status', festivalIds, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('event_participants')
        .select('event_id, status')
        .eq('user_id', user.id)
        .in('event_id', festivalIds);
      if (error) throw error;
      return data || [];
    },
    enabled: festivalIds.length > 0 && Boolean(user?.id),
    staleTime: 1000 * 15,
  });

  const statusByEvent = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    statusRows.forEach((row: { event_id: string; status: string }) => {
      if (row.status === 'going' || row.status === 'interested') {
        map.set(row.event_id, row.status);
      }
    });
    return map;
  }, [statusRows]);

  const { data: attendeePreviews = [] } = useQuery({
    queryKey: ['festival-attendee-previews', festivalIds],
    queryFn: async () => {
      const { data: participantRows, error } = await supabase
        .from('event_participants')
        .select('event_id, user_id, updated_at, status')
        .in('event_id', festivalIds)
        .in('status', ['going', 'interested'])
        .order('updated_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const participants = (participantRows || []) as Array<{ event_id: string; user_id: string }>;
      if (!participants.length) return [] as AttendeePreview[];

      const userIds = Array.from(new Set(participants.map((row) => row.user_id)));
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, avatar_url, username')
        .in('id', userIds);

      const safeProfiles = profileError ? [] : (profiles || []);

      const profileMap = new Map<string, { avatar_url: string | null; username: string | null }>();
      safeProfiles.forEach((profile) => {
        profileMap.set(profile.id, {
          avatar_url: profile.avatar_url || null,
          username: profile.username || null,
        });
      });

      return participants.map((row) => {
        const profile = profileMap.get(row.user_id);
        return {
          event_id: row.event_id,
          user_id: row.user_id,
          avatar_url: profile?.avatar_url || null,
          username: profile?.username || null,
        } satisfies AttendeePreview;
      });
    },
    enabled: festivalIds.length > 0,
    staleTime: 1000 * 30,
  });

  const attendeePreviewsByEvent = useMemo(() => {
    const map = new Map<string, AttendeePreview[]>();
    attendeePreviews.forEach((preview) => {
      const current = map.get(preview.event_id) ?? [];
      if (current.length < 3) {
        current.push(preview);
        map.set(preview.event_id, current);
      }
    });
    return map;
  }, [attendeePreviews]);

  const resolveStatus = (eventId: string) => {
    if (Object.prototype.hasOwnProperty.call(optimisticStatusByEvent, eventId)) {
      return optimisticStatusByEvent[eventId] ?? null;
    }
    return statusByEvent.get(eventId) ?? null;
  };

  const handleStatus = async (festivalId: string, status: AttendanceStatus) => {
    if (!user) {
      setAuthReturnTo(`/event/${festivalId}`);
      setShowAuthModal(true);
      return;
    }

    const currentStatus = resolveStatus(festivalId);
    const nextStatus = currentStatus === status ? null : status;

    setPendingByEvent((prev) => ({ ...prev, [festivalId]: status }));
    setOptimisticStatusByEvent((prev) => ({ ...prev, [festivalId]: nextStatus }));

    try {
      await setAttendanceRpc(festivalId, nextStatus);
      await Promise.all([refetchCounts(), refetchStatuses()]);
      setOptimisticStatusByEvent((prev) => {
        const next = { ...prev };
        delete next[festivalId];
        return next;
      });
    } catch (error: any) {
      setOptimisticStatusByEvent((prev) => ({ ...prev, [festivalId]: currentStatus }));
      toast({
        title: 'Could not update attendance',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPendingByEvent((prev) => {
        const next = { ...prev };
        delete next[festivalId];
        return next;
      });
    }
  };

  const handleAvatarClick = (event: MouseEvent<HTMLButtonElement>, festivalId: string) => {
    event.stopPropagation();
    const returnTo = `/event/${festivalId}`;

    if (!user) {
      setAuthReturnTo(returnTo);
      setShowAuthModal(true);
      return;
    }

    navigate(returnTo);
  };

  const WHATSAPP_THRESHOLD = 10;
  const showProfiles = Boolean(user);

  const heroWidgets = [
    { emoji: "ª", title: "Festivals", desc: "Upcoming events", sectionId: "festivals" },
    { emoji: " ", title: "Roommates", desc: "Share costs", sectionId: "festivals" },
    { emoji: "š•", title: "Travel", desc: "Taxi buddies", sectionId: "festivals" },
    { emoji: "’ƒ", title: "Partners", desc: "Pre-plan dances", sectionId: "festivals" },
  ];

  const floatingIcons = [Plane, Music, Heart, Star, Home, Users];

  return (
    <div className="min-h-screen pb-24 pt-20 overflow-x-hidden relative">
      <PageBreadcrumb items={[{ label: 'Experience', path: '/experience' }, { label: 'Festivals' }]} />
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-50 origin-left"
        style={{ scaleX }}
      />

      {/* Floating Elements Background */}
      <FloatingElements count={20} />

      {/* Animated Confetti Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {Array.from({ length: 15 }).map((_, i) => (
          <ConfettiParticle key={i} delay={i * 0.3} startX={Math.random() * 100} />
        ))}
      </div>

      {/* Carnival Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-orange-500/10 pointer-events-none z-0" />
      
      {/* Hero Section */}
      <PageHero
        emoji="ª"
        titleWhite="Festival"
        titleOrange="Hub"
        subtitle=""
        widgets={heroWidgets}
        gradientFrom="pink-500"
        floatingIcons={floatingIcons}
        largeTitle={true}
      />

      {/* Stats */}
      <div className="flex items-center justify-center gap-2 -mt-4 mb-8 relative z-10">
        <span className="text-xs text-muted-foreground">
          {festivals.length} upcoming festivals
        </span>
      </div>

      {/* Festival Cards Grid */}
      <section id="festivals" className="px-4 mb-24 relative z-10">
        <StaggerContainer staggerDelay={0.15} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {festivals.map((festival) => {
            const counts = countsByEvent.get(festival.id) || { interested_count: 0, going_count: 0 };
            const totalAttendees = counts.going_count + counts.interested_count;
            const progress = Math.min((totalAttendees / WHATSAPP_THRESHOLD) * 100, 100);
            const whatsappActive = totalAttendees >= WHATSAPP_THRESHOLD;
            const status = resolveStatus(festival.id);
            const attendeePreviewsForFestival = attendeePreviewsByEvent.get(festival.id) ?? [];
            const visiblePreviews = attendeePreviewsForFestival.slice(0, 3);
            const startDateRaw = festival.date || festival.start_time;
            const startDate = startDateRaw ? new Date(startDateRaw) : null;
            const dateLabel = startDate
              ? startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : 'Date TBA';
            const locationLabel = festival.city || 'Location TBA';
            const isPending = Boolean(pendingByEvent[festival.id]);
            const pendingStatus = pendingByEvent[festival.id];

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
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full"
                      >
                        {startDate ? getCountdown(startDate) : 'TBA'}
                      </motion.div>
                    </div>

                    {/* Dance Styles */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      <span className="text-[10px] bg-accent/50 text-accent-foreground px-2 py-0.5 rounded-full">
                        Festival
                      </span>
                    </div>

                    {/* Attendance Stats */}
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">‹</span>
                        <span className="text-xs font-medium text-foreground">
                          Going:{' '}
                          <motion.span
                            key={counts.going_count}
                            initial={{ y: -4, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="inline-block"
                          >
                            {counts.going_count}
                          </motion.span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">‘€</span>
                        <span className="text-xs text-muted-foreground">
                          Interested:{' '}
                          <motion.span
                            key={counts.interested_count}
                            initial={{ y: -4, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="inline-block"
                          >
                            {counts.interested_count}
                          </motion.span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span>{totalAttendees} attending</span>
                    </div>

                    {visiblePreviews.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex -space-x-2">
                          {visiblePreviews.map((attendee) => (
                            <button
                              key={attendee.user_id}
                              type="button"
                              onClick={(event) => handleAvatarClick(event, festival.id)}
                              className="focus:outline-none"
                            >
                              <div
                                className={`w-7 h-7 rounded-full border border-background bg-primary/20 overflow-hidden flex items-center justify-center text-[10px] uppercase ${showProfiles ? '' : 'blur-sm'}`}
                              >
                                {attendee.avatar_url ? (
                                  <img
                                    src={attendee.avatar_url}
                                    alt={attendee.username ?? 'Attendee'}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>{(attendee.username ?? 'Member').slice(0, 1)}</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                        {!showProfiles && (
                          <span className="text-[10px] text-muted-foreground">Sign in to see profiles</span>
                        )}
                      </div>
                    )}

                    {/* WhatsApp Progress */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">WhatsApp Group</span>
                        <span className="text-[10px] font-medium text-primary">{totalAttendees}/{WHATSAPP_THRESHOLD}</span>
                      </div>
                      <div className="relative">
                        <Progress value={progress} className="h-2" />
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        />
                      </div>
                      <AnimatePresence>
                        {whatsappActive ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-1 mt-1"
                          >
                            <MessageCircle className="w-3 h-3 text-green-500" />
                            <span className="text-[10px] text-green-500 font-medium">WhatsApp group active!</span>
                          </motion.div>
                        ) : (
                          <motion.span className="text-[10px] text-muted-foreground mt-1 block">
                            ”“ {WHATSAPP_THRESHOLD - totalAttendees} more needed for WhatsApp group!
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>

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

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <motion.div className="flex-1" whileTap={{ scale: 0.95 }}>
                        <Button
                          variant={status === "going" ? "default" : "outline"}
                          size="sm"
                          className="w-full text-xs h-9"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleStatus(festival.id, "going");
                          }}
                          disabled={isPending}
                        >
                          {isPending && pendingStatus === 'going' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : status === "going" ? "“ Going" : "‹ I'm Going"}
                        </Button>
                      </motion.div>
                      <motion.div className="flex-1" whileTap={{ scale: 0.95 }}>
                        <Button
                          variant={status === "interested" ? "default" : "outline"}
                          size="sm"
                          className="w-full text-xs h-9"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleStatus(festival.id, "interested");
                          }}
                          disabled={isPending}
                        >
                          {isPending && pendingStatus === 'interested' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : status === "interested" ? "“ Interested" : "‘€ Interested"}
                        </Button>
                      </motion.div>
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
        onOpenChange={(open) => {
          setShowAuthModal(open);
          if (!open) setAuthReturnTo(null);
        }}
        title="Sign in required"
        description="Sign in to view attendee profiles and update attendance."
        returnTo={authReturnTo}
      />
    </div>
  );
};

export default FestivalHub;


