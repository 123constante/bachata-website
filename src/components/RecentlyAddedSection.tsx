import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveEventImage } from "@/lib/utils";
import { motion } from 'framer-motion';
import { Clock, Calendar, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollReveal } from '@/components/ScrollReveal';
import { useCity } from '@/contexts/CityContext';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500';

export const RecentlyAddedSection = () => {
  const { citySlug } = useCity();
  const { data: events, isLoading } = useQuery({
    queryKey: ['recent-events', citySlug],
    queryFn: async () => {
      if (!citySlug) {
        return [];
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 60);

      const { data, error } = await supabase.rpc('get_calendar_events' as any, {
        range_start: startDate.toISOString(),
        range_end: endDate.toISOString(),
        city_slug_param: citySlug,
      });

      if (error) throw error;

      return (data as any[])
        .sort((a, b) => new Date(a.instance_date).getTime() - new Date(b.instance_date).getTime())
        .slice(0, 3);
    },
    enabled: !!citySlug,
  });

  if (isLoading) {
    return (
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
           <Skeleton className="h-10 w-64 mb-8" />
           <div className="flex gap-4 overflow-hidden">
             {[1,2,3].map(i => (
               <Skeleton key={i} className="w-[300px] h-[350px] rounded-3xl flex-shrink-0" />
             ))}
           </div>
        </div>
      </section>
    );
  }

  // Hide section if no events returned
  if (!events || events.length === 0) return null;

  return (
    <section className="py-20 relative overflow-hidden bg-muted/20">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 mb-10">
        <ScrollReveal animation="fadeUp">
            <div className="flex items-center gap-3 mb-3">
                <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> New Arrivals
                </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Just <span className="gradient-text">Added</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl">
                Fresh events hot off the press. Be the first to secure your spot.
            </p>
        </ScrollReveal>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="overflow-x-auto pb-8 -mx-4 px-4 hide-scrollbar">
        <div className="flex gap-5 w-max px-4 mx-auto md:mx-0 md:w-full md:grid md:grid-cols-3 md:justify-items-center md:gap-8">
            {events.map((event, i) => (
                <motion.div
                    key={event.event_id}
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    viewport={{ once: true }}
                    className="w-[280px] md:w-full flex-shrink-0"
                >
                    <Link to={`/event/${event.event_id}`} className="block group h-full">
                        <div className="relative h-[400px] rounded-3xl overflow-hidden bg-surface border border-primary/10 transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(var(--primary),0.3)]">
                            
                            {/* Image Part */}
                            <div className="h-[220px] relative overflow-hidden">
                                <img
                                    src={resolveEventImage(event.photo_url, null) || DEFAULT_COVER}
                                    alt={event.name}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-90" />
                                
                                {/* "Added X ago" Badge */}
                                <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/10 shadow-lg">
                                    <Clock className="w-3 h-3 text-primary" />
                                    <span>Happening {formatDistanceToNow(new Date(event.instance_date))}</span>
                                </div>
                            </div>

                            {/* Content Part */}
                            <div className="p-5 absolute bottom-0 left-0 right-0 top-[220px] flex flex-col justify-between bg-surface">
                                <div>
                                    <h3 className="text-xl font-bold mb-3 leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                        {event.name}
                                    </h3>
                                    
                                    <div className="space-y-2.5">
                                        <div className="flex items-center gap-2.5 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                                <Calendar className="w-4 h-4" />
                                            </div>
                                            <span>{format(new Date(event.instance_date), 'EEE, MMM d')}</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                                <MapPin className="w-4 h-4" />
                                            </div>
                                            <span className="truncate">{event.location || 'Venue TBC'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 mt-2 border-t border-primary/10 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Details
                                    </span>
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Link>
                </motion.div>
            ))}
        </div>
      </div>
    </section>
  );
};
