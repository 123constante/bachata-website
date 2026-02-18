import { motion } from "framer-motion";
import { Clock, MapPin, Ticket, Sparkles, Gem, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useUpcomingEvents } from "@/hooks/useEvents";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const TonightSavingsAlert = () => {
  const { data: events, isLoading } = useUpcomingEvents();
  const { session } = useAuth();
  const isMember = !!session;

  if (isLoading || !events) return null;

  // Filter for events strictly happening today
  const today = new Date();
  const todaysEvents = events.filter(event => {
    const eventDate = new Date(event.date);
    return (
      eventDate.getDate() === today.getDate() &&
      eventDate.getMonth() === today.getMonth() &&
      eventDate.getFullYear() === today.getFullYear()
    );
  });

  if (todaysEvents.length === 0) return null;

  const mainEvent = todaysEvents[0];
  const otherCount = todaysEvents.length - 1;

  // Hardcoded approximate saving for demo visual
  const potentialSavings = 10 + (otherCount * 12); 

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full max-w-4xl mx-auto mb-8 px-4"
    >
      <div className={`
        relative overflow-hidden rounded-xl border p-6
        ${isMember 
          ? 'bg-gradient-to-br from-emerald-950/50 to-black border-emerald-500/30' 
          : 'bg-gradient-to-br from-violet-950/50 to-black border-violet-500/30'
        }
      `}>
        {/* Background Effects */}
        <div className={`absolute top-0 right-0 w-64 h-64 blur-[100px] rounded-full opacity-20 pointer-events-none
          ${isMember ? 'bg-emerald-500' : 'bg-violet-500'}`} 
        />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          
          {/* Left Content */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`
                flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                ${isMember 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                  : 'bg-violet-500/20 text-violet-400 border border-violet-500/20'
                }
              `}>
                <Clock className="w-3 h-3" />
                Happening Tonight
              </span>
              {!isMember && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-400 animate-pulse">
                  <Sparkles className="w-3 h-3" />
                  Save £{potentialSavings} instantly
                </span>
              )}
            </div>

            <div>
              <h3 className="text-xl font-bold text-white mb-1">
                {mainEvent.name}
              </h3>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {mainEvent.venue_name}
                </span>
                {otherCount > 0 && (
                  <span className="text-white/60">
                    + {otherCount} other events
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action */}
          <div className="w-full md:w-auto flex flex-col items-stretch md:items-end gap-3">
            {isMember ? (
              <div className="text-right">
                <div className="flex items-center justify-center md:justify-end gap-2 text-emerald-400 font-bold mb-1">
                  <Ticket className="w-5 h-5" />
                  <span>Guest List Active</span>
                </div>
                <p className="text-sm text-gray-400 max-w-[200px] text-center md:text-right">
                  Show your digital ID at the door for free entry.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button 
                  asChild
                  size="lg"
                  className="bg-white text-black hover:bg-gray-200 font-bold"
                >
                  <Link to="/auth?mode=signup">
                    Unlock Free Entry
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-xs text-violet-300/80">
                  <Gem className="w-3 h-3" />
                  <span>Member exclusive perk</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
