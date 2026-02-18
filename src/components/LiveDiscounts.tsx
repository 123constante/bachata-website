import { useUpcomingEvents } from "@/hooks/useEvents";
import { Card } from "@/components/ui/card";
import { CalendarDays, MapPin, ArrowRight, Lock, CheckCircle2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const LiveDiscounts = () => {
  const { data: events, isLoading } = useUpcomingEvents();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Strategy: If no user, show LOCKED view. If user, show UNLOCKED view.
  const isMember = !!user; 

  if (isLoading) return null;
  if (!events || events.length === 0) return null;

  const displayEvents = events.slice(0, 3);

  return (
    <section className="py-12 px-4 mb-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
            <div>
                <h2 className="text-3xl font-bold mb-2">
                    {isMember ? "Your Guest List Events" : "Unlock This Week's Guest List"}
                </h2>
                <p className="text-muted-foreground">
                    {isMember 
                        ? "You are automatically on the list for these events. Just say your name at the door." 
                        : "Join now to instantly add your name to the guest list for these events."}
                </p>
            </div>
            
            {isMember && (
                <Button variant="link" asChild className="hidden md:flex text-primary">
                    <Link to="/festival-calendar">View All Eligible Events <ArrowRight className="w-4 h-4 ml-1" /></Link>
                </Button>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            
            {/* LOCKED STATE OVERLAY (Mobile/Desktop) */}
            {!isMember && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/10 backdrop-blur-sm md:backdrop-blur-md rounded-xl border border-white/10 p-6 text-center">
                    <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-amber-500/20 animate-pulse">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-black text-foreground mb-2">Members Only Content</h3>
                    <p className="text-muted-foreground max-w-md mb-8">
                        There are <span className="text-primary font-bold">{events.length} events</span> happening this week with exclusive guest list access. Join to see where you can go.
                    </p>
                    <Button 
                        size="lg" 
                        onClick={() => navigate('/auth')}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-full px-8 shadow-lg hover:scale-105 transition-transform"
                    >
                        <Crown className="w-4 h-4 mr-2" />
                        Unlock Access for £20
                    </Button>
                </div>
            )}

            {/* Event Cards (Blurred if not member) */}
            {displayEvents.map((event, i) => (
                <ScrollReveal key={event.id} animation="fadeUp" delay={i * 0.1}>
                    <div className={cn(
                        "relative h-full",
                        !isMember && "opacity-40 blur-sm pointer-events-none select-none grayscale-[50%]"
                    )}>
                        <Card className="h-full border-primary/20 bg-card/50 overflow-hidden flex flex-col">
                            
                            {/* Member Status Badge */}
                            {isMember ? (
                                <div className="bg-green-500/10 text-green-500 text-xs font-bold px-4 py-2 flex items-center gap-2 border-b border-green-500/20">
                                    <CheckCircle2 className="w-3 h-3 text-green-500 fill-current" />
                                    YOU ARE ON THE LIST
                                </div>
                            ) : (
                                <div className="bg-amber-500/10 text-amber-500 text-xs font-bold px-4 py-2 flex items-center gap-2 border-b border-amber-500/20">
                                    <Crown className="w-3 h-3" />
                                    VIP ONLY
                                </div>
                            )}

                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                                        <CalendarDays className="w-6 h-6 text-primary" />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-muted-foreground">Discount</div>
                                        <div className="text-lg font-black text-amber-500">-£5.00</div>
                                    </div>
                                </div>
                                
                                <h3 className="font-bold text-lg mb-2 line-clamp-2">
                                    {event.name}
                                </h3>
                                
                                <div className="mt-auto space-y-3 pt-4 border-t border-border/50">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <MapPin className="w-4 h-4 text-primary/50" />
                                        <span className="truncate">{event.venue_name}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                        {new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </ScrollReveal>
            ))}
        </div>
      </div>
    </section>
  );
};
