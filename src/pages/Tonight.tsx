import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, Clock, ArrowRight, Heart, Share2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WeatherWidget } from "@/components/WeatherWidget";
import { useCity } from "@/contexts/CityContext";
import { resolveEventImage } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Event {
  id: number | string;
  name: string;
  location: string;
  time: string;
  image: string;
  attendees: number;
  tags: string[];
  description: string;
  organizer: string;
  leadFollowRatio: number; // 0 to 1 (0.5 is balanced)
  liveStatus: "starting-soon" | "live" | "popular";
}

const mockTonightEvents: Event[] = [
  {
    id: 1,
    name: "Bachata Sensual Night",
    location: "Bar Salsa Temple, London",
    time: "21:00 - 02:00",
    image: "https://images.unsplash.com/photo-1546707012-c46675f12716",
    attendees: 142,
    tags: ["Bachata", "Sensual", "Class"],
    description: "The biggest Monday night party in London. 3 rooms of dance.",
    organizer: "Latin Collective",
    leadFollowRatio: 0.45,
    liveStatus: "live"
  },
  {
    id: 2,
    name: "Salsa Fusion Underground",
    location: "The Vaults, Waterloo",
    time: "20:00 - 01:00",
    image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7",
    attendees: 89,
    tags: ["Salsa", "Cuban", "Social"],
    description: "Underground vibes with live percussion.",
    organizer: "Mambo City",
    leadFollowRatio: 0.60,
    liveStatus: "starting-soon"
  },
  {
    id: 3,
    name: "Kizomba Connection",
    location: "Flow Dance, Oval",
    time: "21:30 - 03:00",
    image: "https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9",
    attendees: 65,
    tags: ["Kizomba", "Urban", "Workshop"],
    description: "Exclusive masterclass followed by social.",
    organizer: "Kizomba UK",
    leadFollowRatio: 0.52,
    liveStatus: "popular"
  }
];

const Tonight = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [likedEventIds, setLikedEventIds] = useState<Record<string, boolean>>({});
  const { citySlug } = useCity();
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: liveEvents = [] } = useQuery({
    queryKey: ['tonight-events', citySlug],
    queryFn: async () => {
      if (!citySlug) {
        return [] as Event[];
      }

      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      const { data, error } = await supabase.rpc('get_calendar_events' as any, {
        range_start: startDate.toISOString(),
        range_end: endDate.toISOString(),
        city_slug_param: citySlug,
      });

      if (error || !data) {
        return [] as Event[];
      }

      const formatTime = (value?: string | null) => (value ? value.substring(0, 5) : 'TBA');

      return (data as any[]).slice(0, 6).map((event) => ({
        id: event.event_id,
        name: event.name,
        location: event.location || 'Location TBD',
        time: `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`,
        image: resolveEventImage(event.photo_url, null) || "https://images.unsplash.com/photo-1546707012-c46675f12716",
        attendees: 0,
        tags: ['Bachata', event.has_party ? 'Party' : 'Class'],
        description: 'Tonight\'s bachata event in your city.',
        organizer: 'Bachata Calendar',
        leadFollowRatio: 0.5,
        liveStatus: 'starting-soon' as const,
      }));
    },
    enabled: !!citySlug,
  });

  const events = liveEvents.length > 0 ? liveEvents : mockTonightEvents;

  const handleShareEvent = async (event: Event) => {
    const eventUrl = `${window.location.origin}/event/${event.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: event.name,
          text: `${event.name} tonight at ${event.location}`,
          url: eventUrl,
        });
      } else {
        await navigator.clipboard.writeText(eventUrl);
        toast({
          title: "Link copied",
          description: "Event link copied to clipboard.",
        });
      }
    } catch {
      // Ignore cancelled native share dialogs
    }
  };

  const handleJoinList = (eventId: Event["id"]) => {
    navigate(`/event/${eventId}`);
  };

  const getRatioVisuals = (ratio: number) => {
    const leadPercent = Math.round(ratio * 100);
    const followPercent = 100 - leadPercent;
    
    let label = "Balanced";
    let colorClass = "bg-green-500";
    
    if (leadPercent > 60) {
      label = "Leads Heavy";
      colorClass = "bg-blue-500";
    } else if (followPercent > 60) {
      label = "Follows Heavy";
      colorClass = "bg-pink-500";
    }

    return { leadPercent, followPercent, label, colorClass };
  };

  return (
    <div className="min-h-screen bg-black pb-20 overflow-x-hidden text-neutral-200 font-sans selection:bg-red-500/30">
      {/* Broadcast Overlay Effects */}
      <div className="fixed inset-0 pointer-events-none z-50">
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.4)_100%)]" />
        {/* Scanlines - subtle */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.02)_50%,transparent_50%)] bg-[length:100%_4px]" />
      </div>

      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 pt-28">
        
        {/* Broadcast Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b border-white/10 pb-6">
          <div className="space-y-2">
             <div className="flex items-center gap-3">
               <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
               </span>
               <span className="text-red-500 font-bold tracking-widest text-sm uppercase">Live Broadcast</span>
               <span className="text-white/20">|</span>
               <span className="font-mono text-sm text-white/60 tabular-nums">
                 {currentTime.toLocaleTimeString('en-GB')}
               </span>
             </div>
             <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight uppercase italic">
               Tonight <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Live</span>
             </h1>
          </div>
          
          <div className="flex items-center gap-4 text-sm font-mono text-white/60 bg-white/5 px-4 py-2 rounded-lg border border-white/5 backdrop-blur-sm">
             <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-white font-bold">1,204</span>
                <span className="hidden sm:inline">watching</span>
             </div>
             <span className="text-white/20">|</span>
             <div className="flex items-center gap-2">
                <span className="text-green-400">●</span>
                <span>{events.length} Cams Active</span>
             </div>
          </div>
        </div>

        {/* Live Feed Ticker - News Style */}
        <div className="mb-8 overflow-hidden bg-red-950/30 border-y border-red-500/20 py-2 backdrop-blur-md relative group">
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black to-transparent z-10" />
          
          <div className="flex items-center space-x-8 animate-scroll whitespace-nowrap font-mono text-sm">
            <span className="text-red-400 font-bold px-2 bg-red-500/10 rounded">BREAKING</span>
            <span className="text-white flex items-center">
              Sarah just joined "Bachata Sensual Night"
            </span>
            <span className="text-red-500/50">///</span>
            <span className="text-white flex items-center">
              "Salsa Fusion" capacity at 85%
            </span>
             <span className="text-red-500/50">///</span>
            <span className="text-white flex items-center">
              New photos uploaded from Flow Dance
            </span>
            <span className="text-red-500/50">///</span>
             <span className="text-white flex items-center">
              DJ Play starting set at Bar Salsa
            </span>
          </div>
        </div>

        <div className="mb-8">
          <WeatherWidget />
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event, index) => {
            const ratio = getRatioVisuals(event.leadFollowRatio);

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group relative"
              >
                <Card className="bg-neutral-900/90 border-neutral-800 overflow-hidden hover:border-primary/50 transition-all duration-300 h-full flex flex-col">
                  
                  {/* Card Image Area */}
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={event.image} 
                      alt={event.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/40 to-transparent" />
                    
                    {/* Live Status Badge */}
                    <div className="absolute top-4 left-4">
                      {event.liveStatus === 'live' && (
                        <Badge className="bg-red-500/90 hover:bg-red-500 border-none text-white animate-pulse shadow-lg shadow-red-500/20">
                          LIVE NOW
                        </Badge>
                      )}
                       {event.liveStatus === 'starting-soon' && (
                        <Badge className="bg-yellow-500/90 hover:bg-yellow-500 border-none text-black font-semibold shadow-lg shadow-yellow-500/20">
                          STARTING SOON
                        </Badge>
                      )}
                      {event.liveStatus === 'popular' && (
                        <Badge className="bg-festival-teal/90 hover:bg-festival-teal border-none text-black font-semibold shadow-lg shadow-festival-teal/20">
                          POPULAR
                        </Badge>
                      )}
                    </div>

                    {/* Quick Action Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center space-x-4">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="rounded-full w-10 h-10 bg-white/90 hover:bg-white text-black border-none"
                        onClick={() => setLikedEventIds((prev) => ({ ...prev, [String(event.id)]: !prev[String(event.id)] }))}
                      >
                        <Heart className="w-5 h-5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="rounded-full w-10 h-10 bg-white/90 hover:bg-white text-black border-none"
                        onClick={() => handleShareEvent(event)}
                      >
                        <Share2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>

                  <CardContent className="p-5 flex-1 flex flex-col">
                    
                    {/* Title & Tags */}
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {event.tags.map(tag => (
                          <span key={tag} className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm bg-white/10 text-gray-300 border border-white/5">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors mb-1 leading-tight">
                        {event.name}
                      </h3>
                      <p className="text-sm text-gray-300 line-clamp-2">{event.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {event.location}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {event.time}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 flex items-center mt-2">
                        <Crown className="w-3 h-3 mr-1.5 text-yellow-500" />
                        <span className="text-gray-500 text-xs uppercase tracking-wide mr-1">Hosted by</span>
                        {event.organizer}
                      </p>
                    </div>

                    {/* Social Proof & Ratio Section */}
                    <div className="mt-auto space-y-4">
                      
                      {/* Lead/Follow Ratio Bar */}
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1.5 font-medium uppercase tracking-wider">
                          <span>Leads</span>
                          <span className={ratio.colorClass === 'bg-green-500' ? 'text-green-400' : 'text-gray-400'}>
                             {ratio.label}
                          </span>
                          <span>Follows</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex">
                          <div 
                            style={{ width: `${ratio.leadPercent}%` }}
                            className="h-full bg-blue-500/80" 
                          />
                          <div 
                            style={{ width: `${ratio.followPercent}%` }}
                            className="h-full bg-pink-500/80" 
                          />
                        </div>
                      </div>

                      {/* Attendee Stack */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex -space-x-2">
                          {[1,2,3].map((i) => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-neutral-900 bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-gray-400">
                              {String.fromCharCode(64+i)}
                            </div>
                          ))}
                          <div className="w-8 h-8 rounded-full border-2 border-neutral-900 bg-neutral-800 flex items-center justify-center text-[9px] font-bold text-gray-400 pl-0.5">
                            +{event.attendees}
                          </div>
                        </div>
                        
                        <Button className="h-9 rounded-full bg-white text-black hover:bg-gray-200 text-xs font-bold px-5 transition-colors" onClick={() => handleJoinList(event.id)}>
                          Join List
                          <ArrowRight className="w-3 h-3 ml-2" />
                        </Button>
                      </div>

                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default Tonight;
