import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useUpcomingEvents } from "@/hooks/useEvents";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const getCountdownWithSeconds = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, mins, secs };
};

interface ComingUpSectionProps {
  className?: string;
  title?: string;
}

export const ComingUpSection = ({ className, title = "Coming Up" }: ComingUpSectionProps) => {
  const navigate = useNavigate();
  const { data: upcomingEvents, isLoading } = useUpcomingEvents();

  if (isLoading) {
    return (
      <section className={cn("mb-24 mt-12 px-4", className)}>
        <div className="h-8 w-32 bg-muted rounded mb-4 animate-pulse" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="min-w-[140px] h-24 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!upcomingEvents || upcomingEvents.length === 0) {
    // Hide section if no events (cleaner than showing "No events")
    return null;
  }

  return (
    <ScrollReveal animation="fadeUp" duration={0.8} delay={0.15}>
      <section className={cn("mb-24 mt-12", className)}>
        <h2 className="text-xl font-bold text-foreground mb-4 px-4 flex items-center gap-2">
          <span className="text-primary">{title}</span>
        </h2>
        <div className="flex gap-3 px-4 overflow-x-auto pb-4 scrollbar-hide">
          {upcomingEvents.map((event) => {
            const countdown = getCountdownWithSeconds(event.date);
            return (
              <motion.div
                key={event.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="min-w-[140px] cursor-pointer"
                onClick={() => navigate(`/event/${event.id}`)}
              >
                <Card className="p-3 bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all">
                  <h4 className="font-semibold text-foreground text-xs truncate">{event.name}</h4>
                  <p className="text-[10px] text-muted-foreground truncate">{event.venue_name}</p>
                  <p className="text-[10px] text-primary font-medium mt-1">
                    {format(new Date(event.date), 'EEE, MMM d')}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <Users className="w-2.5 h-2.5" />
                      {event.attendance_count > 0 ? event.attendance_count : '-'}
                    </span>
                    <span className="text-[9px] text-primary font-mono">
                      {countdown.days}d {countdown.hours}h
                    </span>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>
    </ScrollReveal>
  );
};
