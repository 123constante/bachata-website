import { useState, useEffect } from "react";
import { PageErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plane, Bus, Train, Users, Home, Car, Heart, MessageCircle, Clock, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/ScrollReveal";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { attendanceQueryKeys, useAttendance, type AttendanceStatus } from "@/hooks/useAttendance";

type FestivalEvent = {
  id: string;
  name: string;
  city: string | null;
  date: string | null;
  start_time: string | null;
  poster_url: string | null;
  description: string | null;
};

type FestivalAttendee = {
  id: string;
  avatar_url: string | null;
  username: string | null;
  status: AttendanceStatus;
};

const FestivalDetailInner = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [crewTab, setCrewTab] = useState("roommates");
  const [attendeesTab, setAttendeesTab] = useState<"going" | "interested">("going");
  const [handRaised, setHandRaised] = useState<{ roommate: boolean; taxi: boolean; dance: boolean }>({
    roommate: false, taxi: false, dance: false
  });
  const [clickedStatus, setClickedStatus] = useState<AttendanceStatus | null>(null);
  const [, setTick] = useState(0);

  const festivalId = id || '';

  const { data: festival, isLoading: isFestivalLoading } = useQuery({
    queryKey: ['festival-event', festivalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, city, date, start_time, poster_url, description')
        .eq('id', festivalId)
        .eq('type', 'festival')
        .maybeSingle();
      if (error) throw error;
      return data as FestivalEvent | null;
    },
    enabled: Boolean(festivalId),
  });

  const { currentStatus, setStatus, isLoading: isUpdating, error } = useAttendance(festivalId);

  const { data: engagement } = useQuery({
    queryKey: attendanceQueryKeys.engagement(festivalId),
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_event_engagement', { p_event_id: festivalId });
      if (!error) return data?.[0] ?? { interested_count: 0, going_count: 0 };

      // Re-throw — RPC is canonical source for engagement counts
      throw error;
    },
    enabled: Boolean(festivalId),
  });

  const { data: attendeeData } = useQuery({
    queryKey: ['festival-attendees', festivalId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_festival_attendance', { p_event_id: festivalId });
      if (error) throw error;

      // RPC returns JSON — normalise into the shape the UI needs
      const payload = (data as any) || {};
      const going: FestivalAttendee[] = (payload.going ?? []).map((row: any) => ({
        id: row.user_id ?? row.id,
        avatar_url: row.avatar_url ?? null,
        username: row.username ?? null,
        status: 'going' as AttendanceStatus,
      }));
      const interested: FestivalAttendee[] = (payload.interested ?? []).map((row: any) => ({
        id: row.user_id ?? row.id,
        avatar_url: row.avatar_url ?? null,
        username: row.username ?? null,
        status: 'interested' as AttendanceStatus,
      }));

      return { going, interested };
    },
    enabled: Boolean(festivalId),
    staleTime: 1000 * 15,
  });

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (isFestivalLoading) {
    return (
      <div className="min-h-screen pt-[84px] pb-24">
        <div className="max-w-4xl mx-auto px-4 space-y-4 mt-4">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!festival) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">Festival not found</h1>
          <Button onClick={() => navigate("/festivals")} className="mt-4">Back to Festivals</Button>
        </div>
      </div>
    );
  }

  const getCountdown = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return { days, hours, mins, secs };
  };

  const startDateRaw = festival.date || festival.start_time;
  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  const countdown = startDate ? getCountdown(startDate) : { days: 0, hours: 0, mins: 0, secs: 0 };
  const formattedDate = startDate
    ? startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Date TBA';
  const goingCount = engagement?.going_count ?? 0;
  const interestedCount = engagement?.interested_count ?? 0;
  const totalAttendees = goingCount + interestedCount;
  const WHATSAPP_THRESHOLD = 10;
  const progress = Math.min((totalAttendees / WHATSAPP_THRESHOLD) * 100, 100);
  const whatsappActive = totalAttendees >= WHATSAPP_THRESHOLD;
  const showProfiles = Boolean(user);

  const goingAttendees = attendeeData?.going ?? [];
  const interestedAttendees = attendeeData?.interested ?? [];

  const handleStatus = async (status: AttendanceStatus) => {
    if (!festivalId) return;
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Sign in to update your attendance.',
        variant: 'destructive',
      });
      return;
    }

    setClickedStatus(status);
    try {
      await setStatus(status);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.engagement(festivalId) }),
        queryClient.invalidateQueries({ queryKey: ['festival-attendees', festivalId] }),
      ]);
    } catch (err: any) {
      toast({
        title: 'Could not update attendance',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setClickedStatus(null);
    }
  };

  return (
    <div className="min-h-screen pb-24 pt-20">
      <PageBreadcrumb items={[
        { label: 'Experience', path: '/experience' },
        { label: 'Festivals', path: '/festivals' },
        { label: festival.name }
      ]} />
      {/* Header */}
      <div className="sticky top-[100px] z-40 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/festivals")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-foreground text-sm truncate">{festival.name}</h1>
            <p className="text-[10px] text-muted-foreground">{formattedDate}</p>
          </div>
        </div>
      </div>

      {/* Hero with Countdown */}
      <ScrollReveal animation="fadeUp" duration={0.8}>
        <section className="px-4 py-16 mb-16 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-orange-500/10 relative overflow-hidden">
          {/* Carnival decorations */}
          <motion.span
            animate={{ y: [-5, 5, -5], rotate: [-10, 10, -10] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="absolute top-4 right-4 text-2xl"
          >🎉</motion.span>
          <motion.span
            animate={{ y: [5, -5, 5] }}
            transition={{ repeat: Infinity, duration: 4 }}
            className="absolute bottom-4 left-4 text-xl"
          >*</motion.span>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">★</span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-foreground tracking-tight">{festival.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-8">{festival.city || 'Location TBA'}</p>

          {/* Dance styles */}
          <div className="flex flex-wrap gap-1 mb-6">
            <span className="text-xs bg-accent/50 text-accent-foreground px-2 py-0.5 rounded-full">
              Festival
            </span>
          </div>

          {/* Countdown */}
          <div className="flex items-center gap-1 mb-4">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Countdown:</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: countdown.days, label: "Days" },
              { value: countdown.hours, label: "Hours" },
              { value: countdown.mins, label: "Mins" },
              { value: countdown.secs, label: "Secs" },
            ].map((item) => (
              <motion.div
                key={item.label}
                className="bg-card/80 backdrop-blur rounded-lg p-2 text-center border border-primary/20"
              >
                <motion.span
                  key={item.value}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-xl font-bold text-foreground block"
                >
                  {item.value}
                </motion.span>
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Attendance buttons */}
          <div className="flex gap-2 mt-6">
            <Button
              variant={currentStatus === "going" ? "default" : "outline"}
              className="flex-1"
              onClick={() => void handleStatus("going")}
              disabled={isUpdating}
            >
              {isUpdating && clickedStatus === 'going' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : currentStatus === "going" ? "Going" : "I'm Going"}
            </Button>
            <Button
              variant={currentStatus === "interested" ? "default" : "outline"}
              className="flex-1"
              onClick={() => void handleStatus("interested")}
              disabled={isUpdating}
            >
              {isUpdating && clickedStatus === 'interested' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : currentStatus === "interested" ? "Interested" : "I'm Interested"}
            </Button>
          </div>
        </section>
      </ScrollReveal>

      {/* Travel & Logistics */}
      <ScrollReveal animation="fadeUp" duration={0.8} delay={0.1}>
        <section className="px-4 py-12 mb-16">
          <Card className="p-6 bg-card/50 border-primary/20">
            <div className="flex items-center gap-3 mb-8">
              <Plane className="w-6 h-6 text-primary" />
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Getting There</h2>
            </div>

            <div className="space-y-4">
              {/* Nearest Airport */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Plane className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Nearest Airport</p>
                  <p className="text-sm text-muted-foreground">TBA</p>
                </div>
              </div>

              {/* Other Airports */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Plane className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Other Nearby Airports</p>
                  <p className="text-sm text-muted-foreground">Details coming soon.</p>
                </div>
              </div>

              {/* Coach Station */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                  <Bus className="w-4 h-4 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Nearest Coach Station</p>
                  <p className="text-sm text-muted-foreground">TBA</p>
                </div>
              </div>

              {/* Public Transport */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <Train className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Public Transport to Venue</p>
                  <p className="text-sm text-muted-foreground">Check back closer to the event.</p>
                </div>
              </div>
            </div>
          </Card>
        </section>
      </ScrollReveal>

      {/* WhatsApp Group Status */}
      <ScrollReveal animation="fadeUp" duration={0.8} delay={0.15}>
        <section className="px-4 py-2 mb-8">
          <Card className="p-6 bg-gradient-to-r from-green-500/10 to-green-500/5 border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-foreground">WhatsApp Group</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Attendees needed</span>
              <span className="text-xs font-medium text-green-500">{totalAttendees}/{WHATSAPP_THRESHOLD}</span>
            </div>
            <Progress value={progress} className="h-2 mb-2" />
            <AnimatePresence>
              {whatsappActive ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 p-2 bg-green-500/20 rounded-lg"
                >
                  <Sparkles className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-500 font-medium">Group active! Admin will share the link once you mark Going.</span>
                </motion.div>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  {WHATSAPP_THRESHOLD - totalAttendees} more needed to unlock WhatsApp group
                </span>
              )}
            </AnimatePresence>
          </Card>
        </section>
      </ScrollReveal>

      {/* Crew Finder */}
      <ScrollReveal animation="fadeUp" duration={0.8} delay={0.2}>
        <section className="px-4 py-12 mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            Find Your Crew
          </h2>
          
          <Tabs value={crewTab} onValueChange={setCrewTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="roommates" className="text-xs">
                <Home className="w-3 h-3 mr-1" />
                Roommates (0)
              </TabsTrigger>
              <TabsTrigger value="taxi" className="text-xs">
                <Car className="w-3 h-3 mr-1" />
                Taxi (0)
              </TabsTrigger>
              <TabsTrigger value="dance" className="text-xs">
                <Heart className="w-3 h-3 mr-1" />
                Dance (0)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="roommates">
              <Card className="p-4">
                <div className="text-sm text-muted-foreground text-center py-6">
                  Crew matching opens closer to the event.
                </div>
                <Button
                  variant={handRaised.roommate ? "default" : "outline"}
                  className="w-full mt-4"
                  onClick={() => setHandRaised(prev => ({ ...prev, roommate: !prev.roommate }))}
                  disabled
                >
                  Raise Your Hand - Looking for Roommate
                </Button>
              </Card>
            </TabsContent>

            <TabsContent value="taxi">
              <Card className="p-4">
                <div className="text-sm text-muted-foreground text-center py-6">
                  Crew matching opens closer to the event.
                </div>
                <Button
                  variant={handRaised.taxi ? "default" : "outline"}
                  className="w-full mt-4"
                  onClick={() => setHandRaised(prev => ({ ...prev, taxi: !prev.taxi }))}
                  disabled
                >
                  Raise Your Hand - Looking for Taxi Buddy
                </Button>
              </Card>
            </TabsContent>

            <TabsContent value="dance">
              <Card className="p-4">
                <div className="text-sm text-muted-foreground text-center py-6">
                  Crew matching opens closer to the event.
                </div>
                <Button
                  variant={handRaised.dance ? "default" : "outline"}
                  className="w-full mt-4"
                  onClick={() => setHandRaised(prev => ({ ...prev, dance: !prev.dance }))}
                  disabled
                >
                  Raise Your Hand - Looking for Dance Partner
                </Button>
              </Card>
            </TabsContent>
          </Tabs>
        </section>
      </ScrollReveal>

      {/* Attendees */}
      <ScrollReveal animation="fadeUp" duration={0.8} delay={0.25}>
        <section className="px-4 py-12 mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            Attendees ({totalAttendees})
          </h2>

          <div className="flex gap-2 mb-4">
            <Button
              variant={attendeesTab === "going" ? "default" : "outline"}
              size="sm"
              onClick={() => setAttendeesTab("going")}
            >
              Going ({goingAttendees.length})
            </Button>
            <Button
              variant={attendeesTab === "interested" ? "default" : "outline"}
              size="sm"
              onClick={() => setAttendeesTab("interested")}
            >
              Interested ({interestedAttendees.length})
            </Button>
          </div>

          <Card className="p-4">
            <StaggerContainer staggerDelay={0.05} className="grid grid-cols-5 gap-2">
              {(attendeesTab === "going" ? goingAttendees : interestedAttendees).slice(0, 20).map((attendee) => (
                <StaggerItem key={attendee.id}>
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center text-[10px] uppercase ${showProfiles ? '' : 'blur-sm'}`}>
                      {attendee.avatar_url ? (
                        <img src={attendee.avatar_url} alt={attendee.username ?? 'Attendee'} className="w-full h-full object-cover" />
                      ) : (
                        <span>{(attendee.username ?? 'Member').slice(0, 1)}</span>
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-1 truncate max-w-full">
                      {showProfiles ? (attendee.username ?? 'Member') : 'Member'}
                    </span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
            {!showProfiles && (
              <p className="text-xs text-muted-foreground text-center mt-4">
                Sign in to see full profiles.
              </p>
            )}
            {(attendeesTab === "going" ? goingAttendees : interestedAttendees).length > 20 && (
              <p className="text-xs text-muted-foreground text-center mt-4">
                +{(attendeesTab === "going" ? goingAttendees : interestedAttendees).length - 20} more
              </p>
            )}
          </Card>
        </section>
      </ScrollReveal>
    </div>
  );
};

const FestivalDetail = () => (
  <PageErrorBoundary>
    <FestivalDetailInner />
  </PageErrorBoundary>
);

export default FestivalDetail;


