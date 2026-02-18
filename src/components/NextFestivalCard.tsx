
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveEventImage } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useCity } from "@/contexts/CityContext";

interface Event {
  event_id: string;
  name: string;
  instance_date: string;
  type?: string | null;
  photo_url: string[] | null;
  location: string | null;
}

export const NextFestivalCard = () => {
  const navigate = useNavigate();
  const { citySlug } = useCity();
  const { data: event } = useQuery({
    queryKey: ['next-festival', citySlug],
    queryFn: async () => {
      if (!citySlug) {
        return null;
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 180);

      const { data, error } = await supabase.rpc('get_calendar_events' as any, {
        range_start: startDate.toISOString(),
        range_end: endDate.toISOString(),
        city_slug_param: citySlug,
      });

      if (error || !data) {
        return null;
      }

      const sorted = (data as Event[]).sort(
        (a, b) => new Date(a.instance_date).getTime() - new Date(b.instance_date).getTime()
      );

      const festival = sorted.find((item) => item?.type === 'festival' || item?.type === 'festivals');
      return festival || sorted[0] || null;
    },
    enabled: !!citySlug,
  });

  if (!event) return (
     <Card className="p-6 md:p-8 bg-muted/20 border-border/50 animate-pulse h-[300px] flex items-center justify-center">
        <span className="text-muted-foreground">Loading next event...</span>
     </Card>
  );

  return (
    <Card className="group relative overflow-hidden border-0 shadow-lg h-[300px] flex flex-col justify-end p-6 text-white isolate">
      {/* Background Image */}
      <div className="absolute inset-0 z-[-1]">
        {resolveEventImage(event.photo_url, null) ? (
          <img 
            src={resolveEventImage(event.photo_url, null)!} 
            alt={event.name} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900 to-indigo-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-primary rounded-full">
                UPCOMING
            </span>
            <span className="text-xs text-white/80 font-medium tracking-wide uppercase">
                {new Date(event.instance_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </span>
        </div>
        
        <h3 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">
            {event.name}
        </h3>
        
        <div className="flex items-center gap-4 text-sm text-white/80 mb-6">
            <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {event.location || "Location TBD"}
            </span>
        </div>

        <Button 
            onClick={() => navigate(`/event/${event.event_id}`)}
            className="w-full sm:w-auto bg-white text-black hover:bg-white/90"
        >
            View Details <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </Card>
  );
};
