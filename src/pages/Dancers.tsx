import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Heart, Music, Star, Sparkles, Users, UserCheck, Loader2, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/PageLayout';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import { buildFullName } from '@/lib/name-utils';
import { useCity } from '@/contexts/CityContext';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

type Dancer = {
  id: string;
  first_name: string | null;
  surname: string | null;
  favorite_styles: string[] | null;
  dance_started_year: number | null;
  avatar_url: string | null;
  looking_for_partner: boolean | null;
  cities: { name: string } | null;
  nationality: string | null;
  dance_role: string | null;
};

type AttendanceRow = {
  event_id: string;
  status: 'going' | 'interested';
  updated_at: string | null;
};

type AttendanceEvent = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  date: string | null;
  start_time: string | null;
  type: 'festival' | 'standard';
};

type AttendanceItem = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  date: string | null;
  start_time: string | null;
  type: 'festival' | 'standard';
  status: 'going' | 'interested';
};

const Dancers = () => {
  const navigate = useNavigate();
  const { citySlug } = useCity();
  const { toast } = useToast();
  const { user } = useAuth();
    const practicePartnersPath = citySlug ? `/${citySlug}/practice-partners` : '/practice-partners';
  const [dancers, setDancers] = useState<Dancer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDancers = async () => {
      try {
        const { data, error } = await supabase
          .from('dancer_profiles')
          .select('id, first_name, surname, favorite_styles, dance_started_year, avatar_url, looking_for_partner, nationality, dance_role, cities!based_city_id(name)')
          .or('is_active.is.null,is_active.eq.true')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setDancers(data || []);
      } catch (error: any) {
        toast({
          title: 'Error loading dancers',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDancers();
  }, [toast]);

  const { data: attendanceRows = [] } = useQuery({
    queryKey: ['dancer-attendance', user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as AttendanceRow[];
      const { data, error } = await supabase
        .from('event_attendance')
        .select('status, updated_at, calendar_occurrences!inner(event_id)')
        .eq('user_id', user.id)
        .in('status', ['going', 'interested']);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        event_id: r.calendar_occurrences.event_id as string,
        status: r.status as 'going' | 'interested',
        updated_at: r.updated_at as string | null,
      }));
    },
    enabled: Boolean(user?.id),
    staleTime: 1000 * 20,
  });

  const { data: attendanceEvents = [] } = useQuery({
    queryKey: ['dancer-attendance-events', attendanceRows.map((row) => row.event_id).join('|')],
    queryFn: async () => {
      if (!attendanceRows.length) return [] as AttendanceEvent[];
      const eventIds = attendanceRows.map((row) => row.event_id);
      const { data, error } = await supabase
        .from('events')
        .select('id, name, city, country, date, start_time, type')
        .in('id', eventIds);
      if (error) throw error;
      return (data || []) as AttendanceEvent[];
    },
    enabled: attendanceRows.length > 0,
    staleTime: 1000 * 20,
  });

  const attendanceItems = useMemo(() => {
    if (!attendanceRows.length || !attendanceEvents.length) return [] as AttendanceItem[];
    const eventMap = new Map(attendanceEvents.map((event) => [event.id, event]));
    return attendanceRows
      .map((row) => {
        const event = eventMap.get(row.event_id);
        if (!event) return null;
        return {
          id: event.id,
          name: event.name,
          city: event.city,
          country: event.country,
          date: event.date,
          start_time: event.start_time,
          type: event.type,
          status: row.status,
        } satisfies AttendanceItem;
      })
      .filter(Boolean) as AttendanceItem[];
  }, [attendanceEvents, attendanceRows]);

  const now = new Date();
  const toEventDate = (item: AttendanceItem) => {
    const raw = item.date || item.start_time;
    return raw ? new Date(raw) : null;
  };
  const isUpcoming = (item: AttendanceItem) => {
    const date = toEventDate(item);
    return date ? date >= now : false;
  };

  const upcomingEvents = useMemo(
    () => attendanceItems.filter((item) => item.type === 'standard' && isUpcoming(item)),
    [attendanceItems]
  );
  const upcomingFestivals = useMemo(
    () => attendanceItems.filter((item) => item.type === 'festival' && isUpcoming(item)),
    [attendanceItems]
  );

  const getNextUpcoming = (items: AttendanceItem[]) => {
    const sorted = [...items].sort((a, b) => {
      const aDate = toEventDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDate = toEventDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });
    return sorted[0] ?? null;
  };

  const nextEvent = getNextUpcoming(upcomingEvents);
  const nextFestival = getNextUpcoming(upcomingFestivals);

  const formatEventDate = (item: AttendanceItem | null) => {
    if (!item) return 'Date TBA';
    const date = toEventDate(item);
    if (!date) return 'Date TBA';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const formatCountdown = (item: AttendanceItem) => {
    const date = toEventDate(item);
    if (!date) return 'Date TBA';

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfEvent = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (startOfEvent <= startOfToday) return 'Happening now';

    let months = (startOfEvent.getFullYear() - startOfToday.getFullYear()) * 12
      + (startOfEvent.getMonth() - startOfToday.getMonth());
    let anchor = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate());
    anchor.setMonth(anchor.getMonth() + months);

    if (anchor > startOfEvent) {
      months -= 1;
      anchor = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate());
      anchor.setMonth(anchor.getMonth() + months);
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.max(0, Math.floor((startOfEvent.getTime() - anchor.getTime()) / msPerDay));

    const monthLabel = months === 1 ? 'month' : 'months';
    const dayLabel = days === 1 ? 'day' : 'days';

    if (months <= 0) return `${days} ${dayLabel}`;
    if (days <= 0) return `${months} ${monthLabel}`;
    return `${months} ${monthLabel} ${days} ${dayLabel}`;
  };

  const openAttendanceItem = (item: AttendanceItem) => {
    navigate(item.type === 'festival' ? `/festival/${item.id}` : `/event/${item.id}`);
  };

  const getAvatarEmoji = (name: string | null | undefined) => {
    if (!name) return '??';
    const hash = name.charCodeAt(0) % 2;
    return hash === 0 ? '??' : '??';
  };

  const getDisplayName = (dancer: Dancer) => {
    return buildFullName(dancer.first_name, dancer.surname) || 'Dancer';
  };

  return (
    <PageLayout
      emoji="💃"
      titleWhite="Meet"
      titleOrange="Dancers"
      breadcrumbLabel="Dancers"
      floatingIcons={[Users, Star, Heart, Music, Sparkles, UserCheck]}
      largeTitle={true}
    >
      {/* Hero Widgets */}
      <div className='relative z-10 px-4 -mt-6 mb-16'>
          {/* Hero Widgets - 2 small cards */}
          <ScrollReveal animation="scale" delay={0.6}>
            <div className="flex flex-wrap justify-center gap-3 md:gap-4 mt-8">
              {/* Find Practice Partners Widget */}
              <motion.div
                onClick={() => navigate(practicePartnersPath)}
                className="cursor-pointer p-4 md:p-5 bg-gradient-to-br from-surface/80 to-surface/40 backdrop-blur-sm rounded-2xl border border-primary/30 shadow-lg w-[140px] md:w-[160px]"
                whileHover={{ 
                  scale: 1.05, 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-3xl md:text-4xl block mb-2">??</span>
                <h3 className="font-bold text-xs md:text-sm text-foreground">Find Practice Partners</h3>
              </motion.div>
              
              {/* Create A Profile Widget */}
              <motion.div
                onClick={() => navigate('/create-dancers-profile')}
                className="cursor-pointer p-4 md:p-5 bg-gradient-to-br from-surface/80 to-surface/40 backdrop-blur-sm rounded-2xl border border-festival-pink/30 shadow-lg w-[140px] md:w-[160px]"
                whileHover={{ 
                  scale: 1.05, 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-3xl md:text-4xl block mb-2">?</span>
                <h3 className="font-bold text-xs md:text-sm text-foreground">Create a Profile</h3>
              </motion.div>

              {/* Book Media Widget */}
              <motion.div
                onClick={() => navigate('/photographers')}
                className="cursor-pointer p-4 md:p-5 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 backdrop-blur-sm rounded-2xl border border-blue-500/30 shadow-lg w-[140px] md:w-[160px]"
                whileHover={{ 
                  scale: 1.05, 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-3xl md:text-4xl block mb-2">??</span>
                <h3 className="font-bold text-xs md:text-sm text-foreground">Book a Photoshoot</h3>
              </motion.div>
            </div>
          </ScrollReveal>

      </div>

      {/* Browse Dancers Directory */}
      <section id="directory" className="px-4 mb-16">
        <ScrollReveal animation="fadeUp">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-6">
            <span className="text-foreground">Browse </span>
            <span className="text-primary">Dancers</span>
          </h2>
        </ScrollReveal>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : dancers.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg mb-4">
              No dancers yet. Be the first to join!
            </p>
            <Button onClick={() => navigate('/create-dancers-profile')}>
              Create Your Profile
            </Button>
          </div>
        ) : (
          <StaggerContainer className="max-w-7xl mx-auto grid grid-cols-4 gap-2 md:gap-4 px-2">
            {dancers.map((dancer) => (
              <StaggerItem key={dancer.id}>
                <motion.div whileHover={{ y: -4, scale: 1.02 }} transition={{ duration: 0.3 }}>
                  <Card 
                    className="p-2 md:p-4 h-full bg-gradient-to-br from-surface to-background border-primary/20 hover:border-primary/50 transition-all duration-300 group cursor-pointer"
                    onClick={() => navigate(`/dancers/${dancer.id}`)}
                  >
                    {/* Avatar */}
                    <div className="flex justify-center mb-1 md:mb-2">
                      <motion.div
                        className="text-2xl md:text-4xl"
                        whileHover={{ scale: 1.2, rotate: 10 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                      >
                        {dancer.avatar_url ? (
                          <img src={dancer.avatar_url} alt={getDisplayName(dancer)} className="w-8 h-8 md:w-12 md:h-12 rounded-full object-cover" />
                        ) : (
                          getAvatarEmoji(dancer.first_name)
                        )}
                      </motion.div>
                    </div>

                    {/* Info */}
                    <h3 className="text-[10px] md:text-sm font-bold text-foreground text-center group-hover:text-primary transition-colors line-clamp-1">
                      {getDisplayName(dancer)}
                    </h3>
                    <div className="flex flex-col items-center gap-1 mt-1">
                      {dancer.dance_role && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/30 text-secondary-foreground border border-secondary/20">
                          {dancer.dance_role}
                        </span>
                      )}
                      <div className="hidden md:flex flex-wrap items-center justify-center gap-1">
                        {dancer.favorite_styles?.slice(0, 1).map((style) => (
                          <span key={style} className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                            {style}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </section>

      <section className="px-4 mb-16">
        <ScrollReveal animation="fadeUp">
          <h2 className="text-2xl md:text-3xl font-black text-center mb-6">
            <span className="text-foreground">Your </span>
            <span className="text-primary">Plans</span>
          </h2>
        </ScrollReveal>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6 bg-gradient-to-br from-card via-card to-primary/10 border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Events</h3>
              </div>
              <span className="text-xs text-muted-foreground">{upcomingEvents.length} saved</span>
            </div>

            {user ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Next: {nextEvent ? `${nextEvent.name} • ${formatEventDate(nextEvent)}` : 'No upcoming events'}
                </p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-muted-foreground">
                    Going: {upcomingEvents.filter((item) => item.status === 'going').length} · Interested: {upcomingEvents.filter((item) => item.status === 'interested').length}
                  </span>
                </div>
                <div className="mt-4 space-y-2 max-h-56 overflow-y-auto pr-1">
                  {upcomingEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No upcoming events yet.</p>
                  ) : (
                    upcomingEvents.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openAttendanceItem(item)}
                        className="w-full text-left rounded-lg border border-border/60 px-3 py-2 hover:border-primary/50 transition"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.country || 'Country TBA'}</p>
                          <p className="text-xs text-muted-foreground">{formatCountdown(item)}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Sign in to track your events.</p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate('/auth?mode=signin&returnTo=/dancers')}
                >
                  Sign in
                </Button>
              </>
            )}
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card via-card to-festival-pink/20 border-festival-pink/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-festival-pink" />
                <h3 className="text-lg font-bold text-foreground">Festivals</h3>
              </div>
              <span className="text-xs text-muted-foreground">{upcomingFestivals.length} saved</span>
            </div>

            {user ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Next: {nextFestival ? `${nextFestival.name} • ${formatEventDate(nextFestival)}` : 'No upcoming festivals'}
                </p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-muted-foreground">
                    Going: {upcomingFestivals.filter((item) => item.status === 'going').length} · Interested: {upcomingFestivals.filter((item) => item.status === 'interested').length}
                  </span>
                </div>
                <div className="mt-4 space-y-2 max-h-56 overflow-y-auto pr-1">
                  {upcomingFestivals.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No upcoming festivals yet.</p>
                  ) : (
                    upcomingFestivals.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openAttendanceItem(item)}
                        className="w-full text-left rounded-lg border border-border/60 px-3 py-2 hover:border-festival-pink/60 transition"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.country || 'Country TBA'}</p>
                          <p className="text-xs text-muted-foreground">{formatCountdown(item)}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Sign in to track your festivals.</p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate('/auth?mode=signin&returnTo=/dancers')}
                >
                  Sign in
                </Button>
              </>
            )}
          </Card>
        </div>
      </section>


      {/* Find A Dance Partner CTA */}
      <section id="find-partner" className="px-4 mb-16 max-w-4xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <Card className="p-6 md:p-8 bg-gradient-to-br from-festival-pink/20 via-festival-purple/10 to-primary/20 border-festival-pink/30">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
              <motion.span 
                className="text-5xl md:text-6xl"
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ??
              </motion.span>
              <div className="text-center md:text-left flex-1">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                  <span className="text-foreground">Find A </span>
                  <span className="text-primary">Dance Partner</span>
                </h2>
                <p className="text-muted-foreground mb-4">Connect with dancers looking for practice partners</p>
                
                {/* Avatar stack */}
                <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                  <div className="flex -space-x-3">
                    {['??', '??', '??', '??'].map((emoji, i) => (
                      <motion.div 
                        key={i} 
                        className="w-10 h-10 rounded-full bg-surface border-2 border-background flex items-center justify-center text-lg"
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        {emoji}
                      </motion.div>
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground ml-2">200+ looking for partners</span>
                </div>
              </div>
              
              <Button 
                onClick={() => navigate(practicePartnersPath)}
                className="shrink-0"
                size="lg"
              >
                <Heart className="w-4 h-4 mr-2" />
                Find Partners
              </Button>
            </div>
          </Card>
        </ScrollReveal>
      </section>

      {/* Footer */}
    </PageLayout>
  );
};

export default Dancers;



