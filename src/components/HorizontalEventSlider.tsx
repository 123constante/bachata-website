import { motion, useMotionValue, animate } from 'framer-motion';
import { useRef, useEffect, useMemo, useState } from 'react';
import { Calendar, MapPin, Users, ArrowRight, Flame } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveEventImage } from '@/lib/utils';
import { useCity } from '@/contexts/CityContext';
import { useNavigate } from 'react-router-dom';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500';

export const HorizontalEventSlider = () => {
  const navigate = useNavigate();
  const { citySlug } = useCity();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const x = useMotionValue(0);

  const { data: featuredEvents = [] } = useQuery({
    queryKey: ['featured-events', citySlug],
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

      if (error || !data) {
        return [];
      }

      return (data as any[])
        .sort((a, b) => new Date(a.instance_date).getTime() - new Date(b.instance_date).getTime())
        .slice(0, 6)
        .map((event) => ({
          id: event.event_id,
          name: event.name,
          date: new Date(event.instance_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          venue: event.location || 'Venue TBA',
          image: resolveEventImage(event.photo_url, null) || DEFAULT_COVER,
          attendees: 0,
          hot: !!event.has_party || !!event.has_class,
        }));
    },
    enabled: !!citySlug,
  });

  const repeatedEvents = useMemo(() => {
    if (featuredEvents.length === 0) {
      return [];
    }
    return [...featuredEvents, ...featuredEvents];
  }, [featuredEvents]);

  // Auto-scroll animation
  useEffect(() => {
    // TEMPORARILY DISABLED TO DEBUG CRASH
    /*
    if (isDragging) return;
    
    const controls = animate(x, [-1000, 0], {
      duration: 20,
      repeat: Infinity,
      repeatType: 'loop',
      ease: 'linear',
    });

    return () => controls.stop();
    */
  }, [isDragging, x]);

  return (
    <section className="py-32 overflow-hidden relative">
      {/* Background */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-r from-festival-purple/10 via-transparent to-primary/10"
        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 10, repeat: Infinity }}
        style={{ backgroundSize: '200% 100%' }}
      />

      <div className="max-w-7xl mx-auto px-4 mb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-6xl font-black mb-4">
            Featured <span className="gradient-text">Events</span>
          </h2>
          <p className="text-muted-foreground text-xl">Drag to explore • Click to book</p>
        </motion.div>
      </div>

      {/* Slider */}
      <motion.div
        ref={containerRef}
        className="flex gap-6 cursor-grab active:cursor-grabbing px-4"
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -1500, right: 0 }}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
      >
        {repeatedEvents.map((event, i) => (
          <motion.div
            key={i}
            className="flex-shrink-0 w-[350px] md:w-[400px] group"
            whileHover={{ scale: 1.05, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative bg-surface rounded-3xl overflow-hidden border border-primary/10">
              {/* Image */}
              <div className="relative h-[200px] overflow-hidden">
                <motion.img
                  src={event.image}
                  alt={event.name}
                  className="w-full h-full object-cover"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
                
                {/* Hot badge */}
                {event.hot && (
                  <motion.div
                    className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-primary to-festival-pink rounded-full"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <Flame className="w-4 h-4 text-white" />
                    <span className="text-white text-xs font-bold">HOT</span>
                  </motion.div>
                )}
              </div>

              {/* Content */}
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {event.name}
                </h3>
                
                <div className="space-y-2 mb-4">
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    {event.date}
                  </p>
                  <p className="text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    {event.venue}
                  </p>
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    {event.attendees} going
                  </p>
                </div>

                <motion.button
                  className="w-full py-3 bg-primary/20 text-primary rounded-xl font-bold flex items-center justify-center gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/event/${event.id}`)}
                >
                  View Event <ArrowRight className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  boxShadow: '0 0 0 0 hsl(var(--primary) / 0)',
                }}
                whileHover={{
                  boxShadow: '0 0 40px 0 hsl(var(--primary) / 0.3)',
                }}
              />
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Scroll indicators */}
      <div className="flex justify-center gap-2 mt-8">
        {[0, 1, 2, 3, 4].map((_, i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-primary/30"
            animate={{ 
              scale: [1, 1.5, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
        ))}
      </div>
    </section>
  );
};
